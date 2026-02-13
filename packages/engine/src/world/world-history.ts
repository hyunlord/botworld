/**
 * WorldHistoryManager — auto-records significant world events as history entries.
 *
 * Listens to EventBus for founding, battle, alliance, betrayal, discovery,
 * disaster, achievement, election, treaty, and cultural events.
 * Each entry has a significance score (1-10) that determines its importance.
 */

import type { WorldHistoryEntry, HistoryEventType, WorldClock } from '@botworld/shared'
import { generateId, getSeasonFromDay } from '@botworld/shared'
import type { EventBus } from '../core/event-bus.js'
import type { LLMRouter } from '../llm/llm-router.js'

const MAX_HISTORY_ENTRIES = 500

export class WorldHistoryManager {
  private entries: WorldHistoryEntry[] = []
  private eventBus: EventBus
  private nameResolver: (id: string) => string
  private llmRouter: LLMRouter | null = null

  constructor(eventBus: EventBus, nameResolver: (id: string) => string) {
    this.eventBus = eventBus
    this.nameResolver = nameResolver
    this.wireEvents()
  }

  /** Set LLM router for narrative generation */
  setLLMRouter(router: LLMRouter): void {
    this.llmRouter = router
  }

  /** Get all history entries sorted by tick descending */
  getAll(): WorldHistoryEntry[] {
    return [...this.entries].sort((a, b) => b.tick - a.tick)
  }

  /** Get entries filtered by minimum significance */
  getBySignificance(minSignificance: number): WorldHistoryEntry[] {
    return this.entries
      .filter(e => e.significance >= minSignificance)
      .sort((a, b) => b.tick - a.tick)
  }

  /** Get entries by type */
  getByType(type: HistoryEventType): WorldHistoryEntry[] {
    return this.entries.filter(e => e.type === type).sort((a, b) => b.tick - a.tick)
  }

  /** Get entries involving a specific participant */
  getByParticipant(participantId: string): WorldHistoryEntry[] {
    return this.entries
      .filter(e => e.participants.includes(participantId))
      .sort((a, b) => b.tick - a.tick)
  }

  /** Get recent history for LLM context (top N by significance) */
  formatForLLM(limit = 5): string {
    const top = this.entries
      .sort((a, b) => b.significance - a.significance || b.tick - a.tick)
      .slice(0, limit)

    if (top.length === 0) return ''

    const lines = ['[World History]']
    for (const entry of top) {
      lines.push(`  - [${entry.season}, Day ${entry.day}] ${entry.title} (${entry.type})`)
    }
    return lines.join('\n')
  }

  /** Record a history entry directly */
  record(
    tick: number,
    day: number,
    type: HistoryEventType,
    title: string,
    description: string,
    participants: string[],
    location: string,
    significance: number,
  ): WorldHistoryEntry {
    const entry: WorldHistoryEntry = {
      id: generateId(),
      tick,
      day,
      season: getSeasonFromDay(day),
      type,
      title,
      description,
      participants,
      location,
      significance: Math.max(1, Math.min(10, significance)),
    }

    this.entries.push(entry)

    // Trim old low-significance entries if too many
    if (this.entries.length > MAX_HISTORY_ENTRIES) {
      this.entries.sort((a, b) => b.significance - a.significance || b.tick - a.tick)
      this.entries = this.entries.slice(0, MAX_HISTORY_ENTRIES)
    }

    // Generate AI narrative for significant events (async, non-blocking)
    if (significance >= 6) {
      this.generateNarrative(entry).catch(err =>
        console.warn(`[WorldHistory] Narrative generation failed for "${title}":`, err.message)
      )
    }

    this.eventBus.emit({
      type: 'history:recorded',
      entryId: entry.id,
      historyType: type,
      title,
      significance,
      timestamp: tick,
    })

    return entry
  }

  /** Generate a narrative description for a history entry */
  private async generateNarrative(entry: WorldHistoryEntry): Promise<void> {
    if (!this.llmRouter) return

    try {
      const prompt = [
        'You are a chronicle writer for a fantasy world. Write a 2-3 sentence dramatic narrative for this historical event.',
        `Event type: ${entry.type}`,
        `Title: ${entry.title}`,
        `Description: ${entry.description}`,
        `Season: ${entry.season}, Day: ${entry.day}`,
        `Location: ${entry.location}`,
        `Participants: ${entry.participants.join(', ') || 'unknown'}`,
        'Write in an epic, medieval chronicle style. Be concise.',
      ].join('\n')

      const response = await this.llmRouter.complete({
        category: 'history_writing',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
      })

      if (response?.content) {
        entry.narrative = response.content
        console.log(`[WorldHistory] Narrative generated for "${entry.title}"`)
      }
    } catch (err) {
      // Silently fail — narrative is optional enrichment
      console.debug(`[WorldHistory] Narrative generation error:`, err)
    }
  }

  // ── Event wiring ──

  private wireEvents(): void {
    // Settlement created → founding (significance 6)
    this.eventBus.on('settlement:created', (event) => {
      if (event.type !== 'settlement:created') return
      this.record(
        event.timestamp,
        Math.floor(event.timestamp / 1200), // TICKS_PER_GAME_DAY
        'founding',
        `${event.settlementName} Founded`,
        `A new ${event.settlementType} called ${event.settlementName} was established.`,
        [],
        event.settlementName,
        6,
      )
    })

    // Settlement grew → founding (significance 4)
    this.eventBus.on('settlement:grew', (event) => {
      if (event.type !== 'settlement:grew') return
      this.record(
        event.timestamp,
        Math.floor(event.timestamp / 1200),
        'founding',
        `${event.settlementName} Grew to ${event.newType}`,
        `${event.settlementName} grew from a ${event.oldType} to a ${event.newType} with ${event.population} residents.`,
        [],
        event.settlementName,
        event.newType === 'city' ? 7 : event.newType === 'town' ? 5 : 4,
      )
    })

    // Guild created → founding (significance 5)
    this.eventBus.on('guild:created', (event) => {
      if (event.type !== 'guild:created') return
      const founderName = this.nameResolver(event.founderId)
      this.record(
        event.timestamp,
        Math.floor(event.timestamp / 1200),
        'founding',
        `${event.guildName} Guild Founded`,
        `${founderName} founded the ${event.guildType} guild "${event.guildName}" with ${event.memberIds.length} members.`,
        [event.founderId, ...event.memberIds],
        event.guildName,
        5,
      )
    })

    // Guild drama → betrayal or achievement (significance 6)
    this.eventBus.on('guild:drama', (event) => {
      if (event.type !== 'guild:drama') return
      const histType: HistoryEventType = event.dramaType === 'coup' || event.dramaType === 'betrayal' ? 'betrayal' : 'achievement'
      this.record(
        event.timestamp,
        Math.floor(event.timestamp / 1200),
        histType,
        `${event.guildName}: ${event.dramaType}`,
        event.description,
        event.involvedAgentIds,
        event.guildName,
        event.dramaType === 'coup' ? 7 : 6,
      )
    })

    // Kingdom founded → founding (significance 8)
    this.eventBus.on('kingdom:founded', (event) => {
      if (event.type !== 'kingdom:founded') return
      const rulerName = this.nameResolver(event.rulerId)
      this.record(
        event.timestamp,
        Math.floor(event.timestamp / 1200),
        'founding',
        `Kingdom of ${event.kingdomName} Founded`,
        `${rulerName} proclaimed the Kingdom of ${event.kingdomName}, uniting ${event.settlementIds.length} settlements.`,
        [event.rulerId],
        event.kingdomName,
        8,
      )
    })

    // War declared → battle (significance 7)
    this.eventBus.on('war:declared', (event) => {
      if (event.type !== 'war:declared') return
      this.record(
        event.timestamp,
        Math.floor(event.timestamp / 1200),
        'battle',
        `War: ${event.attackerName} vs ${event.defenderName}`,
        `${event.attackerName} declared war on ${event.defenderName}. Casus belli: ${event.casusBelli}. Goal: ${event.goal}.`,
        [event.attackerId, event.defenderId],
        'Battlefield',
        7,
      )
    })

    // War ended → battle (significance 8)
    this.eventBus.on('war:ended', (event) => {
      if (event.type !== 'war:ended') return
      const winnerName = event.winnerId ? this.nameResolver(event.winnerId) : 'No clear victor'
      this.record(
        event.timestamp,
        Math.floor(event.timestamp / 1200),
        'battle',
        `War Ended — ${winnerName}`,
        `The war ended. ${winnerName} emerged victorious.${event.terms ? ` Terms: ${event.terms.join('; ')}` : ''}`,
        event.winnerId ? [event.winnerId] : [],
        'Battlefield',
        8,
      )
    })

    // Treaty signed → treaty (significance 5)
    this.eventBus.on('treaty:signed', (event) => {
      if (event.type !== 'treaty:signed') return
      this.record(
        event.timestamp,
        Math.floor(event.timestamp / 1200),
        'treaty',
        `${event.treatyType} Treaty: ${event.partyAName} & ${event.partyBName}`,
        `${event.partyAName} and ${event.partyBName} signed a ${event.treatyType} treaty. Terms: ${event.terms.join('; ')}.`,
        [event.partyAId, event.partyBId],
        'Diplomatic Hall',
        5,
      )
    })

    // Election ended → election (significance 4)
    this.eventBus.on('election:ended', (event) => {
      if (event.type !== 'election:ended') return
      this.record(
        event.timestamp,
        Math.floor(event.timestamp / 1200),
        'election',
        `${event.winnerName} Elected Leader of ${event.settlementName}`,
        `${event.winnerName} won the election in ${event.settlementName} with ${event.voteCount}/${event.totalVotes} votes.`,
        [event.winnerId],
        event.settlementName,
        4,
      )
    })

    // Masterwork item → achievement (significance 5)
    this.eventBus.on('item:masterwork_created', (event) => {
      if (event.type !== 'item:masterwork_created') return
      this.record(
        event.timestamp,
        Math.floor(event.timestamp / 1200),
        'achievement',
        `Masterwork "${event.customName}" Forged`,
        `${event.crafterName} crafted a ${event.quality} item: ${event.customName}.`,
        [],
        'Workshop',
        event.quality === 'legendary' ? 7 : 5,
      )
    })

    // World event started → disaster or discovery (significance 6)
    this.eventBus.on('world_event:started', (event) => {
      if (event.type !== 'world_event:started') return
      const histType: HistoryEventType = event.category === 'danger' ? 'disaster' : 'discovery'
      this.record(
        event.timestamp,
        Math.floor(event.timestamp / 1200),
        histType,
        event.title,
        event.description,
        [],
        `(${event.position.x}, ${event.position.y})`,
        6,
      )
    })
  }
}
