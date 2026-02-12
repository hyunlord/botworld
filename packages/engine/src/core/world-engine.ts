import type { WorldClock } from '@botworld/shared'
import { TICK_RATE, LOAD_DISTANCE_CHUNKS } from '@botworld/shared'
import { EventBus } from './event-bus.js'
import { createWorldClock, advanceClock } from './world-clock.js'
import { AgentManager } from '../agent/agent-manager.js'
import { PlanExecutor } from '../agent/plan-executor.js'
import { TileMap } from '../world/tile-map.js'
import { WeatherSystem } from '../systems/weather.js'
import { NpcManager } from '../systems/npc-manager.js'
import { QuestManager } from '../systems/quest-manager.js'
import { WorldEventSystem } from '../systems/world-events.js'
import { CombatSystem } from '../systems/combat.js'
import { NpcEventReactions } from '../npc/npc-event-reactions.js'

export class WorldEngine {
  readonly eventBus = new EventBus()
  readonly agentManager: AgentManager
  readonly planExecutor: PlanExecutor
  readonly tileMap: TileMap
  readonly weather: WeatherSystem
  readonly npcManager: NpcManager
  readonly questManager: QuestManager
  readonly worldEvents: WorldEventSystem
  readonly combat: CombatSystem
  readonly npcEventReactions: NpcEventReactions
  clock: WorldClock

  private tickInterval: ReturnType<typeof setInterval> | null = null
  private running = false
  private paused = false
  private speedMultiplier = 1

  constructor() {
    this.clock = createWorldClock()
    this.tileMap = new TileMap()
    this.weather = new WeatherSystem()
    this.npcManager = new NpcManager(this.eventBus, this.tileMap, () => this.clock)
    this.agentManager = new AgentManager(this.eventBus, this.tileMap, () => this.clock)
    this.planExecutor = new PlanExecutor(
      this.eventBus,
      this.tileMap,
      (id) => this.agentManager.getAgent(id) ?? this.npcManager.getNpc(id),
      () => [...this.agentManager.getAllAgents(), ...this.npcManager.getAllNpcs()],
      (agentId, action) => {
        // Try AgentManager first (player bots)
        const result = this.agentManager.enqueueAction(agentId, action)
        if (result.success) return result
        // Fall back to NpcManager for NPC agents
        if (this.npcManager.isNpc(agentId)) {
          if (action.type === 'move' && action.targetPosition) {
            return this.npcManager.moveNpc(agentId, action.targetPosition)
              ? { success: true } : { success: false, error: 'NPC path not found' }
          }
          // For non-move actions, set the action directly on the NPC
          return this.npcManager.setNpcAction(agentId, action)
            ? { success: true } : { success: false, error: 'NPC not found' }
        }
        return result
      },
      () => this.clock,
    )
    this.questManager = new QuestManager(this.eventBus, this.tileMap, this.npcManager, () => this.clock)
    this.worldEvents = new WorldEventSystem(this.eventBus, this.tileMap, () => this.clock)
    this.combat = new CombatSystem(this.eventBus, this.tileMap, () => this.clock)
    this.npcEventReactions = new NpcEventReactions(this.eventBus, this.npcManager, this.planExecutor, this.tileMap)
  }

  start(): void {
    if (this.running) return
    this.running = true

    // Spawn NPCs at POIs if none exist yet
    if (this.npcManager.getAllNpcs().length === 0) {
      this.npcManager.spawnFromPOIs(this.tileMap.pois)
    }

    // Initialize NPC LLM scheduler with cross-system dependencies
    this.npcManager.initScheduler(
      () => [...this.agentManager.getAllAgents(), ...this.npcManager.getAllNpcs()],
      () => this.weather.getState().current,
      () => {
        // Combine recent events with active world event descriptions
        const recent = this.eventBus.getRecentEvents(5)
          .filter(e => e.type === 'world_event:started' || e.type === 'combat:started' || e.type === 'monster:spawned')
          .map(e => {
            if (e.type === 'world_event:started') return e.title
            if (e.type === 'monster:spawned') return `A ${e.monsterType} appeared nearby`
            if (e.type === 'combat:started') return `Combat broke out nearby`
            return ''
          })
          .filter(Boolean)
        // Add active world event descriptions for richer NPC awareness
        const active = this.worldEvents.getActiveEvents()
          .map(e => `[Active Event] ${e.title}: ${e.description}`)
        return [...recent, ...active]
      },
    )

    // Wire plan executor to NPC scheduler
    this.npcManager.setPlanExecutor(this.planExecutor)

    // Handle pause_and_respond for plan executor
    this.eventBus.on('agent:spoke', (event) => {
      if (event.type !== 'agent:spoke') return
      if (!event.targetAgentId) return
      const state = this.planExecutor.getPlanState(event.targetAgentId)
      if (state && !state.paused) {
        const plan = state.plan
        if (plan.interrupt_conditions?.on_spoken_to === 'pause_and_respond') {
          this.planExecutor.pausePlan(event.targetAgentId)
          // Resume after 10 ticks (enough time for response)
          setTimeout(() => {
            this.planExecutor.resumePlan(event.targetAgentId!)
          }, 10_000)
        }
      }
    })

    // React to world events — spawn monsters for danger/portal events
    this.eventBus.on('world_event:started', (event) => {
      if (event.type !== 'world_event:started') return
      const { eventType, position } = event

      if (eventType === 'monster_spawn') {
        // Spawn 10-15 monsters (monster wave) around the event location
        const count = 10 + Math.floor(Math.random() * 6)
        let spawned = 0
        for (let i = 0; i < count; i++) {
          const offset = { x: position.x + Math.floor(Math.random() * 10) - 5, y: position.y + Math.floor(Math.random() * 10) - 5 }
          if (this.tileMap.isWalkable(offset.x, offset.y)) {
            this.combat.spawnMonsterAt(offset, 2)
            spawned++
          }
        }
        console.log(`[WorldEngine] Spawned ${spawned} monsters for Monster Wave at (${position.x}, ${position.y})`)
      }

      if (eventType === 'new_poi') {
        // Portal guardian — spawn a boss-level monster (HP ~500, attack ~30)
        const guardian = this.combat.spawnMonsterAt(position, 8, 'dragon_whelp')
        // Override stats to match portal guardian spec
        guardian.maxHp = 500
        guardian.hp = 500
        guardian.attack = 30
        guardian.defense = 15
        guardian.name = '포탈 가디언'
        guardian.loot = [
          ...guardian.loot,
          { itemType: 'portal_shard', chance: 1.0, quantityMin: 1, quantityMax: 1 },
          { itemType: 'gold_coin', chance: 1.0, quantityMin: 50, quantityMax: 100 },
        ]
        console.log(`[WorldEngine] Spawned portal guardian at (${position.x}, ${position.y}) [HP: 500, ATK: 30]`)
      }
    })

    console.log('[WorldEngine] Starting simulation...')
    this.restartInterval()
  }

  stop(): void {
    if (!this.running) return
    this.running = false

    if (this.tickInterval) {
      clearInterval(this.tickInterval)
      this.tickInterval = null
    }
    console.log('[WorldEngine] Simulation stopped.')
  }

  setPaused(paused: boolean): void {
    this.paused = paused
    console.log(`[WorldEngine] ${paused ? 'Paused' : 'Resumed'}`)
  }

  isPaused(): boolean {
    return this.paused
  }

  setSpeed(multiplier: number): void {
    this.speedMultiplier = Math.max(0.25, Math.min(5, multiplier))
    if (this.running) {
      this.restartInterval()
    }
    console.log(`[WorldEngine] Speed set to ${this.speedMultiplier}x`)
  }

  getSpeed(): number {
    return this.speedMultiplier
  }

  isRunning(): boolean {
    return this.running
  }

  private restartInterval(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval)
    }
    const intervalMs = (1000 / TICK_RATE) / this.speedMultiplier
    this.tickInterval = setInterval(() => this.tick(), intervalMs)
  }

  private tick(): void {
    if (this.paused) return

    // 1. Advance clock
    this.clock = advanceClock(this.clock)

    // 2. Emit tick event (pre-processing notification)
    this.eventBus.emit({
      type: 'world:tick',
      clock: this.clock,
      timestamp: this.clock.tick,
    })

    // 3. Expand world around agents (lazy chunk generation)
    this.expandWorldAroundAgents()

    // 4. Process queued actions (complete finished → start queued)
    this.agentManager.processQueuedActions(this.clock)

    // 4.5. Execute active plans (move to next step when current step completes)
    this.planExecutor.tick(this.clock)

    // 5. Update passive effects (hunger, emotions, movement, rest)
    this.agentManager.updatePassiveEffects(this.clock)

    // 6. Regenerate resources
    this.tileMap.tickResources()

    // 7. NPC behaviors (wanderer movement, idle chatter)
    this.npcManager.tick(this.clock)

    // 8. Quest system tick (refresh pool, expire old quests)
    this.questManager.tick(this.clock)

    // 9. World events tick (spawn/expire events)
    this.worldEvents.tick(this.clock)

    // 10. Combat system tick (spawn/respawn monsters)
    this.combat.tick(this.clock)

    // 11. Weather system tick
    const weatherChanged = this.weather.tick(this.clock)
    if (weatherChanged) {
      this.eventBus.emit({
        type: 'weather:changed',
        weather: this.weather.getState(),
        timestamp: this.clock.tick,
      })
    }

    // 12. Broadcast updated state (all processing complete)
    this.eventBus.emit({
      type: 'world:state_updated',
      clock: this.clock,
      timestamp: this.clock.tick,
    })
  }

  /** Generate new chunks around agents as they explore */
  private expandWorldAroundAgents(): void {
    const agents = this.agentManager.getAllAgents()
    const allNewKeys: string[] = []

    for (const agent of agents) {
      const newKeys = this.tileMap.ensureChunksAround(
        agent.position.x, agent.position.y, LOAD_DISTANCE_CHUNKS,
      )
      allNewKeys.push(...newKeys)
    }

    if (allNewKeys.length > 0) {
      this.eventBus.emit({
        type: 'world:chunks_generated',
        chunkKeys: allNewKeys,
        timestamp: this.clock.tick,
      })
    }
  }

  getState() {
    return {
      clock: this.clock,
      weather: this.weather.getState(),
      agents: [...this.agentManager.getAllAgents(), ...this.npcManager.getAllNpcs()],
      chunks: this.tileMap.getSerializableChunks(),
      worldEvents: this.worldEvents.getActiveEvents(),
      monsters: this.combat.getAliveMonsters(),
      recentEvents: this.eventBus.getRecentEvents(20),
    }
  }
}
