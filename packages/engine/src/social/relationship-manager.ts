/**
 * RelationshipManager — 6-axis asymmetric relationship tracking with memories.
 *
 * Each pair (A→B) is independent from (B→A). Interactions automatically
 * adjust axes and create memories. Memories with importance >= 8 are permanent;
 * those with importance <= 5 fade over time (10% decay every 500 ticks).
 */

import type {
  Relationship6, RelationshipAxes, RelationshipMemory,
  RelationshipTag, RelationshipInteraction, WorldClock,
} from '@botworld/shared'
import { generateId, createDefaultAxes } from '@botworld/shared'
import type { EventBus } from '../core/event-bus.js'

// ── Interaction rules ──

interface InteractionRule {
  trust: number
  respect: number
  affection: number
  fear: number
  rivalry: number
  debt: number
  tags?: { add?: RelationshipTag[]; remove?: RelationshipTag[] }
  memoryTemplate: string
  importance: number
  fading: boolean
  memoryType: 'positive' | 'negative' | 'neutral'
  /** Also apply to the reverse direction (B→A) with these overrides */
  reverse?: Partial<InteractionRule>
}

const INTERACTION_RULES: Record<RelationshipInteraction, InteractionRule> = {
  combat_victory: {
    trust: 8, respect: 5, affection: 3, fear: 0, rivalry: 0, debt: 0,
    memoryTemplate: 'Fought together and won at {location}',
    importance: 5, fading: true, memoryType: 'positive',
  },
  life_saved: {
    trust: 25, respect: 10, affection: 15, fear: 0, rivalry: 0, debt: 30,
    tags: { add: ['life_saved_by'] },
    memoryTemplate: '{actor} saved my life at {location}',
    importance: 9, fading: false, memoryType: 'positive',
    reverse: {
      trust: 15, respect: 5, affection: 10, debt: -30,
      tags: { add: ['saved_life'] },
      memoryTemplate: 'I saved {target} at {location}',
      importance: 7, fading: false,
    },
  },
  fair_trade: {
    trust: 3, respect: 2, affection: 0, fear: 0, rivalry: 0, debt: 0,
    memoryTemplate: 'Had a fair trade of {item}',
    importance: 3, fading: true, memoryType: 'positive',
  },
  skill_taught: {
    trust: 5, respect: 10, affection: 5, fear: 0, rivalry: 0, debt: 5,
    tags: { add: ['student'] },
    memoryTemplate: '{actor} taught me {skill}',
    importance: 6, fading: false, memoryType: 'positive',
    reverse: {
      respect: 3, affection: 3,
      tags: { add: ['mentor'] },
      memoryTemplate: 'Taught {target} {skill}',
      importance: 5,
    },
  },
  gift_given: {
    trust: 2, respect: 0, affection: 8, fear: 0, rivalry: 0, debt: 5,
    memoryTemplate: '{actor} gave me {item}',
    importance: 4, fading: true, memoryType: 'positive',
    reverse: {
      affection: 3, debt: -5,
      memoryTemplate: 'Gave {item} to {target}',
      importance: 3,
    },
  },
  secret_shared: {
    trust: 10, respect: 0, affection: 5, fear: 0, rivalry: 0, debt: 0,
    memoryTemplate: '{actor} shared a secret with me',
    importance: 6, fading: false, memoryType: 'positive',
  },
  quest_completed: {
    trust: 5, respect: 3, affection: 3, fear: 0, rivalry: 0, debt: 0,
    memoryTemplate: 'Completed a quest together at {location}',
    importance: 5, fading: true, memoryType: 'positive',
  },
  abandoned: {
    trust: -20, respect: -15, affection: -10, fear: 0, rivalry: 0, debt: 0,
    memoryTemplate: '{actor} abandoned me in danger at {location}',
    importance: 8, fading: false, memoryType: 'negative',
    reverse: {
      trust: -5, respect: -5, affection: -3,
      memoryTemplate: 'I abandoned {target} at {location}',
      importance: 6, fading: true,
    },
  },
  trade_scam: {
    trust: -15, respect: -5, affection: -5, fear: 0, rivalry: 0, debt: -10,
    memoryTemplate: '{actor} cheated me in a trade',
    importance: 5, fading: true, memoryType: 'negative',
    reverse: {
      trust: -3, debt: 10,
      memoryTemplate: 'Cheated {target} in a trade',
      importance: 4,
    },
  },
  betrayal: {
    trust: -50, respect: -10, affection: -30, fear: 0, rivalry: 10, debt: 0,
    tags: { add: ['betrayed_by'], remove: ['sworn_ally', 'guild_mate'] },
    memoryTemplate: '{actor} betrayed me',
    importance: 10, fading: false, memoryType: 'negative',
    reverse: {
      trust: -20, affection: -15,
      tags: { add: ['betrayed'], remove: ['sworn_ally', 'guild_mate'] },
      memoryTemplate: 'I betrayed {target}',
      importance: 9, fading: false,
    },
  },
  attacked: {
    trust: -30, respect: 0, affection: -20, fear: 20, rivalry: 5, debt: 0,
    memoryTemplate: '{actor} attacked me at {location}',
    importance: 8, fading: false, memoryType: 'negative',
    reverse: {
      trust: -10, affection: -5,
      memoryTemplate: 'I attacked {target} at {location}',
      importance: 6, fading: true,
    },
  },
  insulted: {
    trust: -2, respect: -3, affection: -5, fear: 0, rivalry: 2, debt: 0,
    memoryTemplate: '{actor} insulted me',
    importance: 3, fading: true, memoryType: 'negative',
  },
  competition_lost: {
    trust: 0, respect: 3, affection: 0, fear: 0, rivalry: 10, debt: 0,
    memoryTemplate: 'Lost a competition to {actor}',
    importance: 4, fading: true, memoryType: 'neutral',
    reverse: {
      rivalry: 5, respect: 2,
      memoryTemplate: 'Beat {target} in a competition',
      importance: 3,
    },
  },
  conversation: {
    trust: 1, respect: 0, affection: 1, fear: 0, rivalry: 0, debt: 0,
    memoryTemplate: 'Had a conversation with {actor}',
    importance: 2, fading: true, memoryType: 'neutral',
  },
}

// ── Fading constants ──

const FADE_INTERVAL = 500   // Every 500 ticks
const FADE_RATE = 0.10      // 10% decay per interval
const FADE_MAX_IMPORTANCE = 5  // Only fade memories importance <= 5

// ── Manager ──

export class RelationshipManager {
  /** fromId → toId → Relationship6 */
  private relationships = new Map<string, Map<string, Relationship6>>()
  private eventBus: EventBus
  private lastFadeTick = 0

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus
  }

  /** Get or create relationship A→B */
  getOrCreate(fromId: string, toId: string, tick: number): Relationship6 {
    let fromMap = this.relationships.get(fromId)
    if (!fromMap) {
      fromMap = new Map()
      this.relationships.set(fromId, fromMap)
    }
    let rel = fromMap.get(toId)
    if (!rel) {
      rel = {
        fromId,
        toId,
        axes: createDefaultAxes(),
        tags: [],
        memories: [],
        firstMet: tick,
        lastInteraction: tick,
        interactionCount: 0,
      }
      fromMap.set(toId, rel)
    }
    return rel
  }

  /** Get relationship A→B (may be undefined) */
  get(fromId: string, toId: string): Relationship6 | undefined {
    return this.relationships.get(fromId)?.get(toId)
  }

  /** Get all relationships FROM an agent */
  getAllFrom(fromId: string): Relationship6[] {
    const fromMap = this.relationships.get(fromId)
    return fromMap ? [...fromMap.values()] : []
  }

  /** Get all relationships TO an agent */
  getAllTo(toId: string): Relationship6[] {
    const result: Relationship6[] = []
    for (const fromMap of this.relationships.values()) {
      const rel = fromMap.get(toId)
      if (rel) result.push(rel)
    }
    return result
  }

  /**
   * Apply an interaction between two agents.
   * This modifies A→B (and optionally B→A for reverse rules).
   * @param fromId The agent who experienced the interaction
   * @param toId The other agent
   * @param interaction The interaction type
   * @param tick Current game tick
   * @param context Extra data for memory template (location, item, actor, target, skill)
   */
  applyInteraction(
    fromId: string,
    toId: string,
    interaction: RelationshipInteraction,
    tick: number,
    context: Record<string, string> = {},
  ): void {
    const rule = INTERACTION_RULES[interaction]
    if (!rule) return

    // Apply A→B
    const rel = this.getOrCreate(fromId, toId, tick)
    this.applyRule(rel, rule, tick, { ...context, actor: context.actor ?? toId, target: context.target ?? fromId })

    // Apply B→A (reverse) if defined
    if (rule.reverse) {
      const reverseRel = this.getOrCreate(toId, fromId, tick)
      const mergedReverse: InteractionRule = {
        ...rule,
        ...rule.reverse,
        memoryTemplate: rule.reverse.memoryTemplate ?? rule.memoryTemplate,
        importance: rule.reverse.importance ?? rule.importance,
        fading: rule.reverse.fading ?? rule.fading,
        memoryType: rule.reverse.memoryType ?? rule.memoryType,
      }
      this.applyRule(reverseRel, mergedReverse, tick, {
        ...context,
        actor: context.target ?? fromId,
        target: context.actor ?? toId,
      })
    }

    // Emit event
    this.eventBus.emit({
      type: 'relationship:changed',
      fromId,
      toId,
      interaction,
      trustDelta: rule.trust,
      respectDelta: rule.respect,
      affectionDelta: rule.affection,
      newTags: rule.tags?.add ?? [],
      timestamp: tick,
    })
  }

  /** Tick: decay fading memories */
  tick(clock: WorldClock): void {
    if (clock.tick - this.lastFadeTick < FADE_INTERVAL) return
    this.lastFadeTick = clock.tick

    for (const fromMap of this.relationships.values()) {
      for (const rel of fromMap.values()) {
        this.fadeMemories(rel)
        this.recalculateAxes(rel)
      }
    }
  }

  /**
   * Build a formatted string describing relationships for LLM context.
   * Only includes relationships with nearby agents.
   */
  formatForLLM(
    agentId: string,
    nearbyAgentIds: string[],
    getAgentName: (id: string) => string,
  ): string {
    const lines: string[] = []

    for (const otherId of nearbyAgentIds) {
      const rel = this.get(agentId, otherId)
      if (!rel) continue

      const name = getAgentName(otherId)
      const { trust, respect, affection, fear, rivalry, debt } = rel.axes

      const trustLabel = trust >= 60 ? 'high' : trust >= 20 ? 'moderate' : trust <= -20 ? 'low' : 'neutral'

      let line = `${name}:\n`
      line += `  Trust: ${trust} (${trustLabel}) | Respect: ${respect} | Affection: ${affection}`
      if (fear > 10) line += ` | Fear: ${fear}`
      if (rivalry > 10) line += ` | Rivalry: ${rivalry}`
      if (debt !== 0) line += ` | Debt: ${debt > 0 ? `I owe ${debt}` : `They owe ${-debt}`}`
      line += '\n'

      if (rel.tags.length > 0) {
        line += `  Tags: ${rel.tags.join(', ')}\n`
      }

      // Top 2 most important memories
      const topMemories = [...rel.memories]
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 2)
      for (const mem of topMemories) {
        if (mem.importance >= 4) {
          line += `  Memory: '${mem.event}' (importance ${mem.importance})\n`
        }
      }

      // Behavioral hint based on relationship
      const hint = this.generateBehavioralHint(rel)
      if (hint) line += `  -> ${hint}\n`

      lines.push(line)
    }

    return lines.length > 0 ? `[Relationships with nearby agents]\n${lines.join('\n')}` : ''
  }

  /** Get all data for API response */
  getAgentRelationships(agentId: string): Relationship6[] {
    return this.getAllFrom(agentId)
  }

  // ── Private ──

  private applyRule(
    rel: Relationship6,
    rule: InteractionRule,
    tick: number,
    context: Record<string, string>,
  ): void {
    // Create memory
    const memory: RelationshipMemory = {
      tick,
      type: rule.memoryType,
      event: this.fillTemplate(rule.memoryTemplate, context),
      trustChange: rule.trust,
      respectChange: rule.respect,
      affectionChange: rule.affection,
      fearChange: rule.fear ?? 0,
      rivalryChange: rule.rivalry ?? 0,
      debtChange: rule.debt ?? 0,
      importance: rule.importance,
      fading: rule.fading,
      decayFactor: 1.0,
    }
    rel.memories.push(memory)

    // Cap memories at 50 (remove least important old ones)
    if (rel.memories.length > 50) {
      rel.memories.sort((a, b) => b.importance - a.importance)
      rel.memories = rel.memories.slice(0, 50)
    }

    // Update tags
    if (rule.tags?.add) {
      for (const tag of rule.tags.add) {
        if (!rel.tags.includes(tag)) rel.tags.push(tag)
      }
    }
    if (rule.tags?.remove) {
      rel.tags = rel.tags.filter(t => !rule.tags!.remove!.includes(t))
      // Convert removed alliance tags to former_guild
      if (rule.tags.remove.includes('guild_mate') && !rel.tags.includes('former_guild')) {
        rel.tags.push('former_guild')
      }
    }

    // Recalculate axes from all memories
    this.recalculateAxes(rel)

    // Update metadata
    rel.lastInteraction = tick
    rel.interactionCount++
  }

  /** Recalculate axes as sum of all memory changes (with decay applied) */
  private recalculateAxes(rel: Relationship6): void {
    const axes: RelationshipAxes = { trust: 0, respect: 0, affection: 0, fear: 0, rivalry: 0, debt: 0 }

    for (const mem of rel.memories) {
      const factor = mem.decayFactor
      axes.trust += mem.trustChange * factor
      axes.respect += mem.respectChange * factor
      axes.affection += mem.affectionChange * factor
      axes.fear += mem.fearChange * factor
      axes.rivalry += mem.rivalryChange * factor
      axes.debt += mem.debtChange * factor
    }

    // Clamp values
    rel.axes.trust = Math.max(-100, Math.min(100, Math.round(axes.trust)))
    rel.axes.respect = Math.max(-100, Math.min(100, Math.round(axes.respect)))
    rel.axes.affection = Math.max(-100, Math.min(100, Math.round(axes.affection)))
    rel.axes.fear = Math.max(0, Math.min(100, Math.round(axes.fear)))
    rel.axes.rivalry = Math.max(0, Math.min(100, Math.round(axes.rivalry)))
    rel.axes.debt = Math.round(axes.debt)
  }

  /** Decay fading memories */
  private fadeMemories(rel: Relationship6): void {
    for (const mem of rel.memories) {
      if (mem.fading && mem.importance <= FADE_MAX_IMPORTANCE && mem.decayFactor > 0.01) {
        mem.decayFactor *= (1 - FADE_RATE)
      }
    }
  }

  /** Generate a behavioral hint based on relationship state */
  private generateBehavioralHint(rel: Relationship6): string {
    const { trust, respect, affection, fear, rivalry, debt } = rel.axes

    if (rel.tags.includes('sworn_ally') || (trust >= 70 && affection >= 50)) {
      return 'Strong ally. Cooperate fully, offer discounts, help in danger.'
    }
    if (rel.tags.includes('betrayed_by')) {
      return 'Betrayer. Never trust, never share secrets. Be cautious.'
    }
    if (trust <= -30) {
      return 'Untrustworthy. Verify everything, never share secrets.'
    }
    if (fear >= 40) {
      return 'Intimidating. Be respectful and cautious, follow their lead.'
    }
    if (rivalry >= 50) {
      return 'Rival. Compete but maintain respect.'
    }
    if (debt > 20) {
      return `Owe them a significant debt (${debt}). Should help when asked.`
    }
    if (debt < -20) {
      return `They owe me (${-debt}). Can ask for favors.`
    }
    if (affection >= 40 && trust >= 30) {
      return 'Friend. Be warm and supportive.'
    }
    if (respect >= 50) {
      return 'Respected. Show deference for their expertise.'
    }
    return ''
  }

  private fillTemplate(template: string, context: Record<string, string>): string {
    let result = template
    for (const [key, value] of Object.entries(context)) {
      result = result.replace(`{${key}}`, value)
    }
    // Clean up unfilled placeholders
    result = result.replace(/\{[^}]+\}/g, 'somewhere')
    return result
  }
}
