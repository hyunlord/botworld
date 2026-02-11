import type { WorldEngine } from '../core/world-engine.js'

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface MetricsSnapshot {
  ticksProcessed: number
  avgTickDurationMs: number
  apiCalls: number
  activeAgents: number
  startedAt: string
}

// ──────────────────────────────────────────────
// MetricsCollector
// ──────────────────────────────────────────────

export class MetricsCollector {
  private tickCount = 0
  private tickDurations: number[] = [] // last 100 tick durations
  private apiCallCount = 0
  private lastTickTime = Date.now()
  private readonly startedAt = new Date().toISOString()

  constructor(private world: WorldEngine) {
    // Subscribe to world:tick events for duration measurement
    this.world.eventBus.on('world:tick', () => {
      const now = Date.now()
      const duration = now - this.lastTickTime
      this.lastTickTime = now
      this.tickCount++
      this.tickDurations.push(duration)
      if (this.tickDurations.length > 100) {
        this.tickDurations.shift()
      }
    })
  }

  /** Call from Express middleware to count API requests */
  recordApiCall(): void {
    this.apiCallCount++
  }

  getSnapshot(): MetricsSnapshot {
    const avg =
      this.tickDurations.length > 0
        ? this.tickDurations.reduce((a, b) => a + b, 0) / this.tickDurations.length
        : 0

    return {
      ticksProcessed: this.tickCount,
      avgTickDurationMs: Math.round(avg * 100) / 100,
      apiCalls: this.apiCallCount,
      activeAgents: this.world.agentManager.getAllAgents().length,
      startedAt: this.startedAt,
    }
  }
}
