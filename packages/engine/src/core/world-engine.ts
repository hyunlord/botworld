import type { WorldClock } from '@botworld/shared'
import { TICK_RATE } from '@botworld/shared'
import { EventBus } from './event-bus.js'
import { createWorldClock, advanceClock } from './world-clock.js'
import { AgentManager } from '../agent/agent-manager.js'
import { TileMap } from '../world/tile-map.js'

export class WorldEngine {
  readonly eventBus = new EventBus()
  readonly agentManager: AgentManager
  readonly tileMap: TileMap
  clock: WorldClock

  private tickInterval: ReturnType<typeof setInterval> | null = null
  private running = false
  private paused = false
  private speedMultiplier = 1

  constructor() {
    this.clock = createWorldClock()
    this.tileMap = new TileMap()
    this.agentManager = new AgentManager(this.eventBus, this.tileMap)
  }

  start(): void {
    if (this.running) return
    this.running = true

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

    // 2. Emit tick event
    this.eventBus.emit({
      type: 'world:tick',
      clock: this.clock,
      timestamp: this.clock.tick,
    })

    // 3. Update all agents
    this.agentManager.updateAll(this.clock)

    // 4. Regenerate resources
    this.tileMap.tickResources()
  }

  getState() {
    return {
      clock: this.clock,
      agents: this.agentManager.getAllAgents(),
      map: this.tileMap.getSerializable(),
      recentEvents: this.eventBus.getRecentEvents(20),
    }
  }
}
