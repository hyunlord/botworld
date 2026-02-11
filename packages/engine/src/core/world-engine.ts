import type { WorldClock } from '@botworld/shared'
import { TICK_RATE, LOAD_DISTANCE_CHUNKS } from '@botworld/shared'
import { EventBus } from './event-bus.js'
import { createWorldClock, advanceClock } from './world-clock.js'
import { AgentManager } from '../agent/agent-manager.js'
import { TileMap } from '../world/tile-map.js'
import { WeatherSystem } from '../systems/weather.js'
import { NpcManager } from '../systems/npc-manager.js'

export class WorldEngine {
  readonly eventBus = new EventBus()
  readonly agentManager: AgentManager
  readonly tileMap: TileMap
  readonly weather: WeatherSystem
  readonly npcManager: NpcManager
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
  }

  start(): void {
    if (this.running) return
    this.running = true

    // Spawn NPCs at POIs if none exist yet
    if (this.npcManager.getAllNpcs().length === 0) {
      this.npcManager.spawnFromPOIs(this.tileMap.pois)
    }

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

    // 5. Update passive effects (hunger, emotions, movement, rest)
    this.agentManager.updatePassiveEffects(this.clock)

    // 6. Regenerate resources
    this.tileMap.tickResources()

    // 7. NPC behaviors (wanderer movement, idle chatter)
    this.npcManager.tick(this.clock)

    // 8. Weather system tick
    const weatherChanged = this.weather.tick(this.clock)
    if (weatherChanged) {
      this.eventBus.emit({
        type: 'weather:changed',
        weather: this.weather.getState(),
        timestamp: this.clock.tick,
      })
    }

    // 9. Broadcast updated state (all processing complete)
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
      recentEvents: this.eventBus.getRecentEvents(20),
    }
  }
}
