import type { Agent } from '@botworld/shared'

export type TriggerType =
  | 'spoken_to'           // Someone spoke directly to this NPC
  | 'combat'              // NPC is in combat or under attack
  | 'event_nearby'        // World event started nearby (Monster Wave, Festival, etc.)
  | 'relationship_change' // Major relationship change (trust/affection ±20)
  | 'important_rumor'     // Heard a rumor with importance >= 7
  | 'low_hp'              // HP below 30%
  | 'high_hunger'         // Hunger above 80% of max
  | 'item_change'         // Important item gained/lost (legendary, quest item)
  | 'political_change'    // Guild/settlement/kingdom event affecting this NPC
  | 'season_change'       // Season changed

export interface TriggerEvent {
  type: TriggerType
  /** Description for LLM context */
  description: string
  /** Priority (higher = more urgent) */
  priority: number
  /** Tick when this trigger was detected */
  tick: number
}

export interface TriggerState {
  /** Pending triggers that haven't been consumed */
  pending: TriggerEvent[]
  /** Last consumed trigger tick (prevents re-triggering) */
  lastConsumedTick: number
}

export const TRIGGER_DETECTOR_VERSION = 1

export class TriggerDetector {
  /** Per-NPC trigger state */
  private states = new Map<string, TriggerState>()

  /** Register an NPC for trigger tracking */
  register(npcId: string): void {
    if (!this.states.has(npcId)) {
      this.states.set(npcId, {
        pending: [],
        lastConsumedTick: 0,
      })
    }
  }

  /** Unregister an NPC */
  unregister(npcId: string): void {
    this.states.delete(npcId)
  }

  /** Add a trigger event for an NPC */
  addTrigger(npcId: string, type: TriggerType, description: string, tick: number): void {
    const state = this.states.get(npcId)
    if (!state) {
      return
    }

    // Assign priority based on type
    const priorityMap: Record<TriggerType, number> = {
      combat: 100,
      low_hp: 90,
      spoken_to: 80,
      event_nearby: 70,
      political_change: 60,
      high_hunger: 50,
      relationship_change: 40,
      important_rumor: 30,
      item_change: 25,
      season_change: 20,
    }

    const priority = priorityMap[type]

    // Add the new trigger
    state.pending.push({
      type,
      description,
      priority,
      tick,
    })

    // Cap at 10 events, keeping highest priority ones
    if (state.pending.length > 10) {
      state.pending.sort((a, b) => b.priority - a.priority)
      state.pending = state.pending.slice(0, 10)
    }
  }

  /** Check if NPC has pending triggers (should break from pattern cache) */
  hasTriggers(npcId: string): boolean {
    const state = this.states.get(npcId)
    return state ? state.pending.length > 0 : false
  }

  /** Consume and return all pending triggers (sorted by priority desc), clear them */
  consumeTriggers(npcId: string, tick: number): TriggerEvent[] {
    const state = this.states.get(npcId)
    if (!state) {
      return []
    }

    // Sort by priority descending
    const triggers = [...state.pending].sort((a, b) => b.priority - a.priority)

    // Clear pending and update last consumed tick
    state.pending = []
    state.lastConsumedTick = tick

    return triggers
  }

  /** Convenience: check NPC stats for automatic triggers */
  checkStatTriggers(npcId: string, agent: Agent, tick: number): void {
    const state = this.states.get(npcId)
    if (!state) {
      return
    }

    // Check low HP (below 30%)
    if (agent.stats.hp < agent.stats.maxHp * 0.3) {
      const hasLowHpTrigger = state.pending.some((t) => t.type === 'low_hp')
      if (!hasLowHpTrigger) {
        this.addTrigger(
          npcId,
          'low_hp',
          `You are badly wounded (${Math.round((agent.stats.hp / agent.stats.maxHp) * 100)}% HP remaining)`,
          tick
        )
      }
    }

    // Check high hunger (above 80%)
    if (agent.stats.hunger > agent.stats.maxHunger * 0.8) {
      const hasHungerTrigger = state.pending.some((t) => t.type === 'high_hunger')
      if (!hasHungerTrigger) {
        this.addTrigger(
          npcId,
          'high_hunger',
          `You are very hungry (${Math.round((agent.stats.hunger / agent.stats.maxHunger) * 100)}% hunger)`,
          tick
        )
      }
    }
  }

  /** Format triggers into LLM context string */
  static formatTriggersForLLM(triggers: TriggerEvent[]): string {
    if (triggers.length === 0) {
      return ''
    }

    const lines = ['[Urgent interrupts requiring your attention]:']

    // Already sorted by priority in consumeTriggers
    for (const trigger of triggers) {
      const label = trigger.type.toUpperCase().replace(/_/g, ' ')
      lines.push(`- [${label}] ${trigger.description}`)
    }

    return lines.join('\n')
  }
}
