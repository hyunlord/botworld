import type {
  Agent, AgentAction, WorldClock,
  Position, SkillType, EmotionState, PersonalityTraits, Item,
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
import { processInteraction } from '../systems/social/relationship.js'

interface AgentRuntime {
  agent: Agent
  memory: MemoryStream
  path: Position[]
  pathIndex: number
}

export class AgentManager {
  private agents = new Map<string, AgentRuntime>()
  private pendingActions = new Map<string, AgentAction>()

  constructor(
    private eventBus: EventBus,
    private tileMap: TileMap,
    private clockGetter: () => WorldClock,
  ) {}

  createAgent(options: {
    name: string
    position: Position
    bio: string
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
      currentAction: null,
      bio: options.bio,
    }

    const runtime: AgentRuntime = {
      agent,
      memory: new MemoryStream(id),
      path: [],
      pathIndex: 0,
    }

    this.agents.set(id, runtime)

    this.eventBus.emit({
      type: 'agent:spawned',
      agent,
      timestamp: 0,
    })

    return agent
  }

  /** Load an agent from DB, preserving the DB-provided ID */
  loadAgent(options: {
    id: string
    name: string
    position: Position
    bio: string
    personality?: PersonalityTraits
    skills?: Partial<Record<SkillType, number>>
    inventory?: Item[]
  }): Agent {
    const defaultSkills: Record<SkillType, number> = {
      gathering: 1, crafting: 1, combat: 1, diplomacy: 1,
      leadership: 1, trading: 1, farming: 1, cooking: 1,
    }
    if (options.skills) {
      for (const [k, v] of Object.entries(options.skills)) {
        defaultSkills[k as SkillType] = v
      }
    }

    const agent: Agent = {
      id: options.id,
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
      skills: defaultSkills,
      inventory: options.inventory ? [...options.inventory] : [],
      memories: [],
      relationships: {},
      personality: options.personality ?? createRandomPersonality(),
      currentMood: createEmotionState(),
      currentAction: null,
      bio: options.bio,
    }

    const runtime: AgentRuntime = {
      agent,
      memory: new MemoryStream(options.id),
      path: [],
      pathIndex: 0,
    }

    this.agents.set(options.id, runtime)

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

  getNearbyAgents(agentId: string, radius: number): Agent[] {
    const runtime = this.agents.get(agentId)
    if (!runtime) return []
    const agent = runtime.agent
    const result: Agent[] = []
    for (const rt of this.agents.values()) {
      if (rt.agent.id === agent.id) continue
      const dx = Math.abs(rt.agent.position.x - agent.position.x)
      const dy = Math.abs(rt.agent.position.y - agent.position.y)
      if (dx <= radius && dy <= radius) {
        result.push(rt.agent)
      }
    }
    return result
  }

  /** @deprecated Use enqueueAction() for external callers. Kept for internal/AI behavior tree use. */
  private requestAction(agentId: string, action: AgentAction): { success: boolean; error?: string } {
    const runtime = this.agents.get(agentId)
    if (!runtime) return { success: false, error: 'Agent not found' }

    const { agent } = runtime

    // Check if already performing an action
    if (agent.currentAction) {
      const clock = this.clockGetter()
      const done = clock.tick >= agent.currentAction.startedAt + agent.currentAction.duration
      if (!done) {
        return { success: false, error: 'Agent is busy with another action' }
      }
      // Complete the current action first
      this.completeAction(runtime, clock)
      agent.currentAction = null
    }

    // Check energy
    const cost = ENERGY_COST[action.type] ?? 0
    if (agent.stats.energy < cost) {
      return { success: false, error: `Not enough energy. Need ${cost}, have ${agent.stats.energy}` }
    }

    this.startAction(runtime, action)
    return { success: true }
  }

  /** Queue an action for tick-boundary processing (replaces requestAction for external callers) */
  enqueueAction(agentId: string, action: AgentAction): { success: boolean; error?: string } {
    const runtime = this.agents.get(agentId)
    if (!runtime) return { success: false, error: 'Agent not found' }

    const { agent } = runtime

    // Reject if currently busy (action not yet completed)
    if (agent.currentAction) {
      const clock = this.clockGetter()
      if (clock.tick < agent.currentAction.startedAt + agent.currentAction.duration) {
        return { success: false, error: 'Agent is busy with another action' }
      }
    }

    // Reject if already queued
    if (this.pendingActions.has(agentId)) {
      return { success: false, error: 'Agent already has a pending action queued' }
    }

    // Energy check
    const cost = ENERGY_COST[action.type] ?? 0
    if (agent.stats.energy < cost) {
      return { success: false, error: `Not enough energy. Need ${cost}, have ${agent.stats.energy}` }
    }

    this.pendingActions.set(agentId, action)
    return { success: true }
  }

  /** Tick step: complete finished actions, then start queued actions */
  processQueuedActions(clock: WorldClock): void {
    // 1) Complete finished actions
    for (const runtime of this.agents.values()) {
      if (runtime.agent.currentAction) {
        const done = clock.tick >= runtime.agent.currentAction.startedAt + runtime.agent.currentAction.duration
        if (done) {
          this.completeAction(runtime, clock)
          runtime.agent.currentAction = null
        }
      }
    }

    // 2) Start queued actions
    for (const [agentId, action] of this.pendingActions) {
      const runtime = this.agents.get(agentId)
      if (!runtime) {
        this.pendingActions.delete(agentId)
        continue
      }
      // Still busy (action didn't finish this tick) — keep in queue for next tick
      if (runtime.agent.currentAction) continue

      // Re-validate energy (may have changed between enqueue and tick)
      const cost = ENERGY_COST[action.type] ?? 0
      if (runtime.agent.stats.energy < cost) {
        this.pendingActions.delete(agentId)
        continue
      }

      // Deterministic timing: action starts at this tick
      action.startedAt = clock.tick
      this.startAction(runtime, action)
      this.pendingActions.delete(agentId)
    }
  }

  /** Tick step: passive effects — hunger, emotion decay, action progress */
  updatePassiveEffects(clock: WorldClock): void {
    for (const runtime of this.agents.values()) {
      const { agent } = runtime
      agent.stats.hunger = Math.max(0, agent.stats.hunger - HUNGER_DRAIN_PER_TICK)
      this.decayEmotions(agent.currentMood)
      if (agent.currentAction) {
        this.progressAction(runtime, clock)
      }
    }
  }

  /** @deprecated Use processQueuedActions + updatePassiveEffects instead */
  updateAll(clock: WorldClock): void {
    for (const runtime of this.agents.values()) {
      this.updateAgent(runtime, clock)
    }
  }

  /** @deprecated Use processQueuedActions + updatePassiveEffects instead */
  private updateAgent(runtime: AgentRuntime, clock: WorldClock): void {
    const { agent } = runtime

    // Update stats
    agent.stats.hunger = Math.max(0, agent.stats.hunger - HUNGER_DRAIN_PER_TICK)

    // Decay emotions over time
    this.decayEmotions(agent.currentMood)

    // Check if current action is complete
    if (agent.currentAction) {
      const done = clock.tick >= agent.currentAction.startedAt + agent.currentAction.duration
      if (done) {
        this.completeAction(runtime, clock)
        agent.currentAction = null
      } else {
        this.progressAction(runtime, clock)
      }
    }
  }

  private startAction(runtime: AgentRuntime, action: AgentAction): void {
    const { agent } = runtime
    const clock = this.clockGetter()
    agent.currentAction = action

    // If moving, calculate path
    if (action.type === 'move' && action.targetPosition) {
      const path = findPath(this.tileMap, agent.position, action.targetPosition)
      runtime.path = path
      runtime.pathIndex = 0
      action.duration = Math.max(path.length * 2, 2)
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
        break
      }
    }
  }

  /** Execute a trade between two agents with specific items */
  executeTrade(
    fromAgentId: string,
    toAgentId: string,
    offerItemId: string,
    requestItemId: string,
  ): { success: boolean; error?: string; gave?: string; received?: string } {
    const fromRuntime = this.agents.get(fromAgentId)
    const toRuntime = this.agents.get(toAgentId)
    if (!fromRuntime || !toRuntime) return { success: false, error: 'Agent not found' }

    const clock = this.clockGetter()
    const fromAgent = fromRuntime.agent
    const toAgent = toRuntime.agent

    const offerItem = fromAgent.inventory.find(i => i.id === offerItemId)
    const requestItem = toAgent.inventory.find(i => i.id === requestItemId)

    if (!offerItem || offerItem.quantity <= 0) return { success: false, error: 'Offer item not found or depleted' }
    if (!requestItem || requestItem.quantity <= 0) return { success: false, error: 'Request item not found or depleted' }

    // Execute exchange
    offerItem.quantity--
    requestItem.quantity--

    const forThem = { ...offerItem, id: generateId('item'), quantity: 1 }
    const forMe = { ...requestItem, id: generateId('item'), quantity: 1 }

    toAgent.inventory.push(forThem)
    fromAgent.inventory.push(forMe)

    fromAgent.inventory = fromAgent.inventory.filter(i => i.quantity > 0)
    toAgent.inventory = toAgent.inventory.filter(i => i.quantity > 0)

    fromAgent.xp += 5
    toAgent.xp += 5
    fromAgent.skills.trading = Math.min(100, fromAgent.skills.trading + 0.2)
    toAgent.skills.trading = Math.min(100, toAgent.skills.trading + 0.2)

    fromRuntime.memory.add(
      `Traded ${forThem.name} with ${toAgent.name} for ${forMe.name}`,
      5, clock.tick, [toAgent.id],
    )
    toRuntime.memory.add(
      `Traded ${forMe.name} with ${fromAgent.name} for ${forThem.name}`,
      5, clock.tick, [fromAgent.id],
    )

    processInteraction(fromAgent, toAgent, { type: 'trade', positive: true, intensity: 0.7 }, clock.tick)
    processInteraction(toAgent, fromAgent, { type: 'trade', positive: true, intensity: 0.7 }, clock.tick)

    this.eventBus.emit({
      type: 'trade:completed',
      buyerId: fromAgent.id,
      sellerId: toAgent.id,
      item: forMe,
      price: 0,
      timestamp: clock.tick,
    })

    return { success: true, gave: forThem.name, received: forMe.name }
  }

  private decayEmotions(mood: EmotionState): void {
    const keys = Object.keys(mood) as (keyof EmotionState)[]
    for (const key of keys) {
      mood[key] = Math.max(0, mood[key] - EMOTION_DECAY_RATE)
    }
  }
}
