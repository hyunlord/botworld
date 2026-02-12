/**
 * RumorSystem — gossip spreads through agent conversations.
 *
 * Rumors are created when events happen (combat victories, trade scams, etc.).
 * They spread when agents converse (50% chance per conversation).
 * Reliability decreases with each spread (-10). Rumors below reliability 20
 * stop spreading. Rumors expire after 2000 ticks.
 *
 * Innkeepers are rumor hubs: they hear and spread more rumors.
 */

import type { Rumor, RumorType, WorldClock, Agent, ReputationCategory } from '@botworld/shared'
import { generateId } from '@botworld/shared'
import type { EventBus } from '../core/event-bus.js'

const RUMOR_LIFETIME = 2000
const SPREAD_CHANCE = 0.5
const INNKEEPER_SPREAD_CHANCE = 0.8
const RELIABILITY_DECAY = 10
const MIN_RELIABILITY = 20
const MAX_RUMORS = 200

/** How rumors affect reputation when heard */
const RUMOR_REPUTATION_EFFECTS: Record<RumorType, { category: ReputationCategory; delta: number }> = {
  achievement: { category: 'combat', delta: 5 },
  scandal: { category: 'social', delta: -3 },
  warning: { category: 'social', delta: -2 },
  gossip: { category: 'social', delta: 0 },
  trade_tip: { category: 'trading', delta: 2 },
}

export class RumorSystem {
  private rumors = new Map<string, Rumor>()
  private eventBus: EventBus

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus
  }

  /** Create a new rumor from a witnessed event */
  createRumor(
    type: RumorType,
    content: string,
    aboutId: string,
    originatedFrom: string,
    tick: number,
  ): Rumor {
    const rumor: Rumor = {
      id: generateId(),
      type,
      content,
      aboutId,
      originatedFrom,
      spreadTo: [originatedFrom],
      reliability: 100,
      createdAt: tick,
      expiresAt: tick + RUMOR_LIFETIME,
    }

    this.rumors.set(rumor.id, rumor)

    this.eventBus.emit({
      type: 'rumor:created',
      rumorId: rumor.id,
      rumorType: type,
      aboutId,
      originatedFrom,
      content,
      timestamp: tick,
    })

    // Prune if too many
    if (this.rumors.size > MAX_RUMORS) {
      this.pruneOldest()
    }

    return rumor
  }

  /**
   * Attempt to spread rumors during a conversation between two agents.
   * Each agent shares rumors the other hasn't heard yet (50% chance each).
   * Innkeeper role gets 80% spread chance.
   */
  spreadRumors(
    agentA: Agent,
    agentB: Agent,
    tick: number,
  ): { aHeard: Rumor[]; bHeard: Rumor[] } {
    const aHeard: Rumor[] = []
    const bHeard: Rumor[] = []

    for (const rumor of this.rumors.values()) {
      if (tick >= rumor.expiresAt) continue
      if (rumor.reliability < MIN_RELIABILITY) continue

      const aKnows = rumor.spreadTo.includes(agentA.id)
      const bKnows = rumor.spreadTo.includes(agentB.id)

      if (aKnows && !bKnows) {
        const chance = agentA.npcRole === 'innkeeper' ? INNKEEPER_SPREAD_CHANCE : SPREAD_CHANCE
        if (Math.random() < chance) {
          rumor.spreadTo.push(agentB.id)
          rumor.reliability = Math.max(0, rumor.reliability - RELIABILITY_DECAY)
          bHeard.push(rumor)
          this.emitSpread(rumor.id, agentA.id, agentB.id, rumor.reliability, tick)
        }
      } else if (bKnows && !aKnows) {
        const chance = agentB.npcRole === 'innkeeper' ? INNKEEPER_SPREAD_CHANCE : SPREAD_CHANCE
        if (Math.random() < chance) {
          rumor.spreadTo.push(agentA.id)
          rumor.reliability = Math.max(0, rumor.reliability - RELIABILITY_DECAY)
          aHeard.push(rumor)
          this.emitSpread(rumor.id, agentB.id, agentA.id, rumor.reliability, tick)
        }
      }
    }

    return { aHeard, bHeard }
  }

  /** Get rumors an agent has heard, sorted by recency */
  getRumorsForAgent(agentId: string, limit = 5): Rumor[] {
    const result: Rumor[] = []
    for (const rumor of this.rumors.values()) {
      if (rumor.spreadTo.includes(agentId)) {
        result.push(rumor)
      }
    }
    return result
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
  }

  /** Format rumors for LLM context */
  formatForLLM(agentId: string, getAgentName: (id: string) => string): string {
    const rumors = this.getRumorsForAgent(agentId, 3)
    if (rumors.length === 0) return ''

    const lines = rumors.map(r => {
      const aboutName = getAgentName(r.aboutId)
      const reliabilityLabel = r.reliability >= 80 ? 'reliable' :
                               r.reliability >= 50 ? 'somewhat reliable' : 'dubious'
      return `- "${r.content}" (about ${aboutName}, ${reliabilityLabel})`
    })

    return `[Recent rumors you've heard]\n${lines.join('\n')}`
  }

  /** Get reputation effect when an agent hears a rumor */
  getReputationEffect(rumor: Rumor): { category: ReputationCategory; delta: number } | null {
    const effect = RUMOR_REPUTATION_EFFECTS[rumor.type]
    if (!effect || effect.delta === 0) return null
    // Scale by reliability
    const scaledDelta = Math.round(effect.delta * (rumor.reliability / 100))
    if (scaledDelta === 0) return null
    return { category: effect.category, delta: scaledDelta }
  }

  /** Tick: expire old rumors */
  tick(clock: WorldClock): void {
    for (const [id, rumor] of this.rumors) {
      if (clock.tick >= rumor.expiresAt) {
        this.rumors.delete(id)
      }
    }
  }

  /** Get all active rumors (for API) */
  getAllRumors(): Rumor[] {
    return [...this.rumors.values()]
  }

  private emitSpread(rumorId: string, fromId: string, toId: string, reliability: number, tick: number): void {
    this.eventBus.emit({
      type: 'rumor:spread',
      rumorId,
      fromAgentId: fromId,
      toAgentId: toId,
      reliability,
      timestamp: tick,
    })
  }

  private pruneOldest(): void {
    const sorted = [...this.rumors.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt)
    const toRemove = sorted.slice(0, Math.floor(MAX_RUMORS * 0.2))
    for (const [id] of toRemove) {
      this.rumors.delete(id)
    }
  }
}
