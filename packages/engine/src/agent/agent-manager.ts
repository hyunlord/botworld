import type {
  Agent, AgentAction, AgentLLMConfig, WorldClock,
  Position, SkillType, EmotionState, PersonalityTraits,
} from '@botworld/shared'
import {
  generateId, createEmotionState, createRandomPersonality,
  DEFAULT_MAX_HP, DEFAULT_MAX_ENERGY, DEFAULT_MAX_HUNGER,
  HUNGER_DRAIN_PER_TICK, REST_ENERGY_REGEN, ENERGY_COST,
  EMOTION_DECAY_RATE,
} from '@botworld/shared'
import { EventBus } from '../core/event-bus.js'
import { TileMap } from '../world/tile-map.js'
import { findPath } from '../world/pathfinding.js'
import { MemoryStream } from './memory/memory-stream.js'
import { evaluateBehavior } from './behavior-tree.js'
import { GoalSystem } from './goal-system.js'
import { DayPlanner } from './day-planner.js'
import { ConversationManager } from './conversation-manager.js'
import { DecisionQueue } from '../llm/decision-queue.js'
import { processInteraction, personalityCompatibility } from '../systems/social/relationship.js'

interface AgentRuntime {
  agent: Agent
  memory: MemoryStream
  goals: GoalSystem
  path: Position[]
  pathIndex: number
  lastPlanDay: number
}

export class AgentManager {
  private agents = new Map<string, AgentRuntime>()
  private dayPlanner: DayPlanner
  private conversationManager: ConversationManager
  private decisionQueue: DecisionQueue

  constructor(
    private eventBus: EventBus,
    private tileMap: TileMap,
  ) {
    this.decisionQueue = new DecisionQueue(3)
    this.dayPlanner = new DayPlanner(this.decisionQueue)
    this.conversationManager = new ConversationManager(this.decisionQueue, this.eventBus)
  }

  createAgent(options: {
    name: string
    position: Position
    bio: string
    llmConfig: AgentLLMConfig
    personality?: PersonalityTraits
  }): Agent {
    const id = generateId('agent')
    const skills: Record<SkillType, number> = {
      gathering: 1, crafting: 1, combat: 1, diplomacy: 1,
      leadership: 1, trading: 1, farming: 1, cooking: 1,
    }

    const agent: Agent = {
      id,
      name: options.name,
      position: { ...options.position },
      stats: {
        hp: DEFAULT_MAX_HP,
        maxHp: DEFAULT_MAX_HP,
        energy: DEFAULT_MAX_ENERGY,
        maxEnergy: DEFAULT_MAX_ENERGY,
        hunger: DEFAULT_MAX_HUNGER,
        maxHunger: DEFAULT_MAX_HUNGER,
      },
      level: 1,
      xp: 0,
      skills,
      inventory: [],
      memories: [],
      relationships: {},
      personality: options.personality ?? createRandomPersonality(),
      currentMood: createEmotionState(),
      llmConfig: options.llmConfig,
      currentAction: null,
      bio: options.bio,
    }

    const runtime: AgentRuntime = {
      agent,
      memory: new MemoryStream(id),
      goals: new GoalSystem(),
      path: [],
      pathIndex: 0,
      lastPlanDay: -1,
    }

    this.agents.set(id, runtime)

    this.eventBus.emit({
      type: 'agent:spawned',
      agent,
      timestamp: 0,
    })

    return agent
  }

  getAgent(id: string): Agent | undefined {
    return this.agents.get(id)?.agent
  }

  getAllAgents(): Agent[] {
    return Array.from(this.agents.values()).map(r => r.agent)
  }

  getMemoryStream(agentId: string): MemoryStream | undefined {
    return this.agents.get(agentId)?.memory
  }

  updateAll(clock: WorldClock): void {
    for (const runtime of this.agents.values()) {
      this.updateAgent(runtime, clock)
    }
  }

  private updateAgent(runtime: AgentRuntime, clock: WorldClock): void {
    const { agent } = runtime

    // Update stats
    agent.stats.hunger = Math.max(0, agent.stats.hunger - HUNGER_DRAIN_PER_TICK)

    // Decay emotions over time
    this.decayEmotions(agent.currentMood)

    // Day planning: trigger at dawn of each new day
    if (clock.timeOfDay === 'dawn' && runtime.lastPlanDay < clock.day) {
      runtime.lastPlanDay = clock.day
      this.triggerDayPlanning(runtime, clock)
    }

    // Check if current action is complete
    if (agent.currentAction) {
      const done = clock.tick >= agent.currentAction.startedAt + agent.currentAction.duration
      if (done) {
        this.completeAction(runtime, clock)
        agent.currentAction = null
      } else {
        this.progressAction(runtime, clock)
        return
      }
    }

    // Get nearby agents for behavior decisions
    const nearbyAgents = this.getNearbyAgents(agent, 8)

    // Get current goal
    const currentGoal = runtime.goals.getCurrentGoal()

    // Get next action from behavior tree (now goal-aware)
    const action = evaluateBehavior(agent, clock, this.tileMap, currentGoal, nearbyAgents)
    if (action) {
      this.startAction(runtime, action, clock)
    }
  }

  private triggerDayPlanning(runtime: AgentRuntime, clock: WorldClock): void {
    const { agent } = runtime
    const nearbyAgents = this.getNearbyAgents(agent, 15)

    this.dayPlanner.createPlan(agent, clock, runtime.memory, this.tileMap, nearbyAgents)
      .then(goals => {
        runtime.goals.setPlan(goals)
        const goalDescriptions = goals.map(g => g.description).join(', ')
        runtime.memory.addPlan(`Today's plan: ${goalDescriptions}`, clock.tick)
        console.log(`[DayPlanner] ${agent.name}'s plan: ${goalDescriptions}`)

        this.eventBus.emit({
          type: 'agent:spoke',
          agentId: agent.id,
          message: `[Plan] ${goalDescriptions}`,
          timestamp: clock.tick,
        })
      })
      .catch(err => {
        console.warn(`[DayPlanner] Failed for ${agent.name}:`, err)
      })
  }

  private getNearbyAgents(agent: Agent, radius: number): Agent[] {
    const result: Agent[] = []
    for (const runtime of this.agents.values()) {
      if (runtime.agent.id === agent.id) continue
      const dx = Math.abs(runtime.agent.position.x - agent.position.x)
      const dy = Math.abs(runtime.agent.position.y - agent.position.y)
      if (dx <= radius && dy <= radius) {
        result.push(runtime.agent)
      }
    }
    return result
  }

  private startAction(runtime: AgentRuntime, action: AgentAction, clock: WorldClock): void {
    const { agent } = runtime
    agent.currentAction = action

    // If moving, calculate path
    if (action.type === 'move' && action.targetPosition) {
      const path = findPath(this.tileMap, agent.position, action.targetPosition)
      runtime.path = path
      runtime.pathIndex = 0
      action.duration = Math.max(path.length * 2, 2)
    }

    // Handle talk action: trigger conversation via ConversationManager
    if (action.type === 'talk' && action.targetAgentId) {
      this.handleTalkAction(runtime, action, clock)
    }

    // Deduct energy
    const cost = ENERGY_COST[action.type] ?? 0
    agent.stats.energy = Math.max(0, agent.stats.energy - cost)

    this.eventBus.emit({
      type: 'agent:action',
      agentId: agent.id,
      action,
      timestamp: clock.tick,
    })
  }

  private handleTalkAction(runtime: AgentRuntime, action: AgentAction, clock: WorldClock): void {
    const { agent } = runtime
    const targetRuntime = this.agents.get(action.targetAgentId!)
    if (!targetRuntime) return

    const targetAgent = targetRuntime.agent

    if (
      this.conversationManager.canConverse(agent.id, clock.tick) &&
      this.conversationManager.canConverse(targetAgent.id, clock.tick)
    ) {
      const compatibility = personalityCompatibility(agent, targetAgent)
      this.conversationManager.startConversation(
        agent, targetAgent, clock, runtime.memory, targetRuntime.memory,
      ).then(() => {
        // Update relationships after conversation
        const positive = compatibility > 0.4
        const intensity = 0.5 + compatibility * 0.5
        processInteraction(agent, targetAgent, { type: 'conversation', positive, intensity }, clock.tick)
        processInteraction(targetAgent, agent, { type: 'conversation', positive, intensity }, clock.tick)

        const currentGoal = runtime.goals.getCurrentGoal()
        if (currentGoal?.actionType === 'talk') {
          runtime.goals.completeCurrentGoal()
        }
      }).catch(err => {
        console.warn(`[Conversation] Error:`, err)
      })
    }
  }

  private progressAction(runtime: AgentRuntime, clock: WorldClock): void {
    const { agent } = runtime

    if (agent.currentAction?.type === 'move' && runtime.path.length > 0) {
      if (runtime.pathIndex < runtime.path.length && clock.tick % 2 === 0) {
        const nextPos = runtime.path[runtime.pathIndex]
        const prevPos = { ...agent.position }
        agent.position = nextPos
        runtime.pathIndex++

        this.eventBus.emit({
          type: 'agent:moved',
          agentId: agent.id,
          from: prevPos,
          to: nextPos,
          timestamp: clock.tick,
        })
      }
    }

    if (agent.currentAction?.type === 'rest') {
      agent.stats.energy = Math.min(
        agent.stats.maxEnergy,
        agent.stats.energy + REST_ENERGY_REGEN,
      )
    }
  }

  private completeAction(runtime: AgentRuntime, clock: WorldClock): void {
    const { agent } = runtime
    const action = agent.currentAction
    if (!action) return

    switch (action.type) {
      case 'gather': {
        const result = this.tileMap.harvestResource(agent.position.x, agent.position.y, 3)
        if (result) {
          const existing = agent.inventory.find(i => i.name === result.type)
          if (existing) {
            existing.quantity += result.harvested
          } else {
            agent.inventory.push({
              id: generateId('item'),
              type: 'resource',
              name: result.type,
              quantity: result.harvested,
            })
          }
          agent.xp += 5
          agent.skills.gathering = Math.min(100, parseFloat((agent.skills.gathering + 0.1).toFixed(2)))
          runtime.memory.add(
            `I gathered ${result.harvested} ${result.type} at (${agent.position.x}, ${agent.position.y})`,
            3, clock.tick,
          )
          this.eventBus.emit({
            type: 'resource:gathered',
            agentId: agent.id,
            resourceType: result.type,
            amount: result.harvested,
            position: agent.position,
            timestamp: clock.tick,
          })
          const currentGoal = runtime.goals.getCurrentGoal()
          if (currentGoal?.actionType === 'gather') {
            runtime.goals.completeCurrentGoal()
          }
        }
        break
      }

      case 'eat': {
        const food = agent.inventory.find(i => i.id === action.targetItemId)
        if (food && food.quantity > 0) {
          food.quantity--
          agent.stats.hunger = Math.min(agent.stats.maxHunger, agent.stats.hunger + 30)
          if (food.quantity <= 0) {
            agent.inventory = agent.inventory.filter(i => i.id !== food.id)
          }
        }
        break
      }

      case 'move': {
        if (runtime.path.length > 0 && runtime.pathIndex < runtime.path.length) {
          agent.position = runtime.path[runtime.path.length - 1]
        }
        runtime.path = []
        runtime.pathIndex = 0
        break
      }

      case 'craft': {
        if (agent.inventory.length >= 2) {
          const mat1 = agent.inventory[0]
          const mat2 = agent.inventory[1]
          mat1.quantity--
          mat2.quantity--
          agent.inventory = agent.inventory.filter(i => i.quantity > 0)

          const craftedItem = {
            id: generateId('item'),
            type: 'crafted' as const,
            name: `${mat1.name}-${mat2.name} tool`,
            quantity: 1,
          }
          agent.inventory.push(craftedItem)
          agent.xp += 10
          agent.skills.crafting = Math.min(100, agent.skills.crafting + 0.2)

          runtime.memory.add(
            `I crafted a ${craftedItem.name} from ${mat1.name} and ${mat2.name}`,
            4, clock.tick,
          )
          this.eventBus.emit({
            type: 'item:crafted',
            agentId: agent.id,
            item: craftedItem,
            timestamp: clock.tick,
          })
          const currentGoal = runtime.goals.getCurrentGoal()
          if (currentGoal?.actionType === 'craft') {
            runtime.goals.completeCurrentGoal()
          }
        }
        break
      }

      case 'trade': {
        if (action.targetAgentId) {
          const targetRuntime = this.agents.get(action.targetAgentId)
          if (targetRuntime && agent.inventory.length > 0 && targetRuntime.agent.inventory.length > 0) {
            const myItem = agent.inventory[0]
            const theirItem = targetRuntime.agent.inventory[0]

            if (myItem.quantity > 0 && theirItem.quantity > 0) {
              myItem.quantity--
              theirItem.quantity--

              const forThem = { ...myItem, id: generateId('item'), quantity: 1 }
              const forMe = { ...theirItem, id: generateId('item'), quantity: 1 }

              targetRuntime.agent.inventory.push(forThem)
              agent.inventory.push(forMe)

              agent.inventory = agent.inventory.filter(i => i.quantity > 0)
              targetRuntime.agent.inventory = targetRuntime.agent.inventory.filter(i => i.quantity > 0)

              agent.xp += 5
              agent.skills.trading = Math.min(100, agent.skills.trading + 0.2)

              runtime.memory.add(
                `Traded ${forThem.name} with ${targetRuntime.agent.name} for ${forMe.name}`,
                5, clock.tick, [targetRuntime.agent.id],
              )
              targetRuntime.memory.add(
                `Traded ${forMe.name} with ${agent.name} for ${forThem.name}`,
                5, clock.tick, [agent.id],
              )

              // Update relationships after trade
              processInteraction(agent, targetRuntime.agent, { type: 'trade', positive: true, intensity: 0.7 }, clock.tick)
              processInteraction(targetRuntime.agent, agent, { type: 'trade', positive: true, intensity: 0.7 }, clock.tick)

              this.eventBus.emit({
                type: 'trade:completed',
                buyerId: agent.id,
                sellerId: targetRuntime.agent.id,
                item: forMe,
                price: 0,
                timestamp: clock.tick,
              })
              const currentGoal = runtime.goals.getCurrentGoal()
              if (currentGoal?.actionType === 'trade') {
                runtime.goals.completeCurrentGoal()
              }
            }
          }
        }
        break
      }

      case 'explore': {
        agent.xp += 3
        agent.skills.gathering = Math.min(100, agent.skills.gathering + 0.05)
        runtime.memory.add(
          `Explored area around (${agent.position.x}, ${agent.position.y})`,
          2, clock.tick,
        )
        const currentGoal = runtime.goals.getCurrentGoal()
        if (currentGoal?.actionType === 'explore') {
          runtime.goals.completeCurrentGoal()
        }
        break
      }
    }
  }

  private decayEmotions(mood: EmotionState): void {
    const keys = Object.keys(mood) as (keyof EmotionState)[]
    for (const key of keys) {
      mood[key] = Math.max(0, mood[key] - EMOTION_DECAY_RATE)
    }
  }
}
