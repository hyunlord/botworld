import type { ActionPlan, NpcRole } from '@botworld/shared'

export const PATTERN_CACHE_VERSION = 1

export type TimeSlot = 'dawn' | 'morning' | 'noon' | 'afternoon' | 'evening' | 'night'

export interface DailyPattern {
  /** NPC role this pattern is for */
  role: NpcRole
  /** Time slot plans */
  timeSlots: Record<TimeSlot, ActionPlan>
  /** When this pattern was generated (tick) */
  generatedAt: number
  /** Number of times this pattern has been used */
  useCount: number
  /** Last time this pattern was used (tick) */
  lastUsed: number
  /** Season when this pattern was generated */
  season: string
}

/**
 * PatternCache: Strategy 1 for NPC AI optimization.
 * NPCs generate their daily routine once via LLM, then reuse it every day.
 * Only when interrupt triggers fire does the LLM get called again.
 */
export class PatternCache {
  /** In-memory cache: npcId -> DailyPattern */
  private patterns = new Map<string, DailyPattern>()

  /** Hit/miss tracking for stats */
  private _hits = 0
  private _misses = 0

  /**
   * Check if NPC has a valid cached pattern for current season.
   * Patterns regenerate on season change.
   */
  hasPattern(npcId: string, currentSeason: string): boolean {
    const pattern = this.patterns.get(npcId)
    if (!pattern) {
      return false
    }

    // Invalidate if season changed
    if (pattern.season !== currentSeason) {
      this.invalidatePattern(npcId)
      return false
    }

    return true
  }

  /**
   * Get the ActionPlan for the current time slot from cache.
   * Returns null if no pattern exists.
   * Increments useCount and updates lastUsed on success.
   */
  getPatternPlan(npcId: string, timeSlot: TimeSlot): ActionPlan | null {
    const pattern = this.patterns.get(npcId)
    if (!pattern) {
      this._misses++
      return null
    }

    const plan = pattern.timeSlots[timeSlot]
    if (!plan) {
      this._misses++
      return null
    }

    // Update usage stats
    pattern.useCount++
    pattern.lastUsed = Date.now()
    this._hits++

    return plan
  }

  /**
   * Store a generated daily pattern.
   */
  setPattern(npcId: string, pattern: DailyPattern): void {
    this.patterns.set(npcId, pattern)
    console.log(
      `[PatternCache] Created pattern for ${npcId} (${pattern.role}, ${pattern.season})`
    )
  }

  /**
   * Invalidate a pattern (when trigger fires).
   * Forces LLM regeneration on next tick.
   */
  invalidatePattern(npcId: string): void {
    const existed = this.patterns.delete(npcId)
    if (existed) {
      console.log(`[PatternCache] Invalidated pattern for ${npcId}`)
    }
  }

  /**
   * Get stats for monitoring.
   */
  getStats(): { total: number; hitRate: number } {
    const total = this._hits + this._misses
    const hitRate = total > 0 ? (this._hits / total) * 100 : 0
    return {
      total: this.patterns.size,
      hitRate: Math.round(hitRate * 100) / 100,
    }
  }

  /**
   * Build the LLM prompt for generating a daily pattern.
   */
  static buildPatternPrompt(
    name: string,
    role: NpcRole,
    personality: string,
    settlement?: string,
    building?: string,
  ): string {
    const location = settlement || 'the settlement'
    const workplace = building || 'your workplace'

    return `You are ${name}, a ${role}.
${personality}
You live in ${location} and work at ${workplace}.

Create a daily routine as a JSON object with time slots (dawn, morning, noon, afternoon, evening, night).
Each time slot should have an ActionPlan with natural activities for your role.

Format:
{
  "dawn": {
    "plan_name": "Morning prep",
    "steps": [
      {"action": "idle", "params": {}, "wait_after": 10}
    ],
    "max_duration": 30
  },
  "morning": {
    "plan_name": "Morning work",
    "steps": [
      {"action": "move", "params": {"destination": "${workplace}"}, "wait_after": 5},
      {"action": "craft", "params": {}, "wait_after": 15}
    ],
    "max_duration": 60
  },
  "noon": { ... },
  "afternoon": { ... },
  "evening": { ... },
  "night": { ... }
}

Actions available: move, speak, idle, rest, eat, craft, gather, trade, emote
- For move: use params.destination as a string like "tavern", "marketplace", "home", "forge"
- For speak: use params.message as a string
- For eat: use params: {}
- For craft/gather/trade: use params: {}
- For idle/rest: use params: {}
- For emote: use params.emote as string like "wave", "nod"

Keep each time slot to 2-4 steps. Be natural and role-appropriate.
Return ONLY valid JSON, no markdown or extra text.`
  }

  /**
   * Parse LLM response into a DailyPattern.
   * Returns null on parse failure.
   */
  static parsePatternResponse(
    raw: string,
    role: NpcRole,
    tick: number,
  ): DailyPattern | null {
    try {
      // Strip markdown fences
      let cleaned = raw.trim()
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n/, '')
        cleaned = cleaned.replace(/\n```\s*$/, '')
      }

      const parsed = JSON.parse(cleaned)

      // Validate structure
      const timeSlots = ['dawn', 'morning', 'noon', 'afternoon', 'evening', 'night'] as const
      const result: Record<TimeSlot, ActionPlan> = {} as Record<TimeSlot, ActionPlan>

      for (const slot of timeSlots) {
        const plan = parsed[slot]
        if (plan && plan.plan_name && Array.isArray(plan.steps)) {
          result[slot] = {
            plan_name: plan.plan_name,
            steps: plan.steps,
            interrupt_conditions: plan.interrupt_conditions,
            max_duration: plan.max_duration || 60,
          }
        } else {
          // Default idle plan for missing time slots
          result[slot] = {
            plan_name: `${slot} rest`,
            steps: [
              {
                action: 'idle',
                params: {},
                wait_after: 10,
              },
            ],
            max_duration: 30,
          }
        }
      }

      // Compute season from tick (1 tick = 1 second, day = 86400 ticks)
      const day = Math.floor(tick / 86400)
      const seasonIndex = Math.floor((day % 28) / 7)
      const season = ['spring', 'summer', 'autumn', 'winter'][seasonIndex] || 'spring'

      return {
        role,
        timeSlots: result,
        generatedAt: tick,
        useCount: 0,
        lastUsed: tick,
        season,
      }
    } catch (error) {
      console.error('[PatternCache] Failed to parse pattern response:', error)
      return null
    }
  }

  /**
   * Get the current time slot based on time of day.
   * Day is 24 hours, each slot is 4 hours.
   */
  static getTimeSlot(hour: number): TimeSlot {
    if (hour >= 4 && hour < 8) return 'dawn'
    if (hour >= 8 && hour < 12) return 'morning'
    if (hour >= 12 && hour < 16) return 'noon'
    if (hour >= 16 && hour < 20) return 'afternoon'
    if (hour >= 20 && hour < 24) return 'evening'
    return 'night' // 0-4
  }

  /**
   * Helper to compute current season from tick.
   */
  static getSeason(tick: number): string {
    const day = Math.floor(tick / 86400)
    const seasonIndex = Math.floor((day % 28) / 7)
    return ['spring', 'summer', 'autumn', 'winter'][seasonIndex] || 'spring'
  }

  /**
   * Helper to compute current hour from tick (0-23).
   */
  static getHour(tick: number): number {
    const secondsInDay = 86400
    const secondOfDay = tick % secondsInDay
    return Math.floor((secondOfDay / secondsInDay) * 24)
  }

  /**
   * Clear all patterns (for testing or reset).
   */
  clear(): void {
    this.patterns.clear()
    this._hits = 0
    this._misses = 0
  }

  /**
   * Get all patterns (for inspection).
   */
  getAllPatterns(): Map<string, DailyPattern> {
    return new Map(this.patterns)
  }
}
