/**
 * SettlementManager — settlement creation, growth, elections, and laws.
 *
 * Settlements grow from camp→village→town→city based on resident count.
 * Elections run every 7 game days. Leaders can enact laws via vote.
 * AI agents decide their vote based on relationships, reputation, and platforms.
 */

import type {
  Settlement, SettlementType, SettlementLaw, SettlementTradition, SettlementLegend,
  Election, ElectionCandidate,
  WorldClock, Agent,
} from '@botworld/shared'
import { generateId, getSettlementTypeForPopulation, TICKS_PER_GAME_DAY } from '@botworld/shared'
import type { EventBus } from '../core/event-bus.js'
import type { RelationshipManager } from '../social/relationship-manager.js'
import type { ReputationSystem } from '../social/reputation-system.js'

const ELECTION_INTERVAL_DAYS = 7
const ELECTION_INTERVAL_TICKS = ELECTION_INTERVAL_DAYS * TICKS_PER_GAME_DAY
const CAMPAIGN_DURATION_TICKS = Math.floor(TICKS_PER_GAME_DAY * 2) // 2 game days
const GROWTH_CHECK_INTERVAL = 100

export class SettlementManager {
  private settlements = new Map<string, Settlement>()
  private agentSettlement = new Map<string, string>() // agentId → settlementId
  private eventBus: EventBus
  private relationshipManager: RelationshipManager | null = null
  private reputationSystem: ReputationSystem | null = null
  private lastGrowthCheck = 0
  private lastElectionCheck = 0

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus
  }

  setRelationshipManager(rm: RelationshipManager): void {
    this.relationshipManager = rm
  }

  setReputationSystem(rs: ReputationSystem): void {
    this.reputationSystem = rs
  }

  /** Create a new settlement at a POI */
  createSettlement(
    poiId: string,
    founderIds: string[],
    tick: number,
    poiName?: string,
  ): Settlement {
    const type = getSettlementTypeForPopulation(founderIds.length)
    const name = type === 'camp'
      ? (poiName ? `${poiName} Camp` : 'Unnamed Camp')
      : (poiName ?? this.generateSettlementName())

    const settlement: Settlement = {
      id: generateId(),
      name,
      type,
      poiId,
      leaderId: null,
      council: [],
      laws: [],
      treasury: 0,
      taxRate: 0.05,
      defenseLevel: 0,
      prosperity: 50,
      allegiance: null,
      culture: {
        mainActivity: 'general',
        languageStyle: '',
        greeting: '',
        values: [],
        taboos: [],
        traditions: [],
        legends: [],
        festivals: [],
      },
      residents: [...founderIds],
      currentElection: null,
      createdAt: tick,
    }

    this.settlements.set(settlement.id, settlement)
    for (const id of founderIds) {
      this.agentSettlement.set(id, settlement.id)
    }

    this.eventBus.emit({
      type: 'settlement:created',
      settlementId: settlement.id,
      settlementName: settlement.name,
      settlementType: type,
      poiId,
      timestamp: tick,
    })

    // Villages and above get a first election
    if (type !== 'camp' && founderIds.length >= 6) {
      this.startElection(settlement, tick)
    }

    return settlement
  }

  /** Add a resident to a settlement */
  addResident(settlementId: string, agentId: string): boolean {
    const settlement = this.settlements.get(settlementId)
    if (!settlement) return false
    if (settlement.residents.includes(agentId)) return false

    settlement.residents.push(agentId)
    this.agentSettlement.set(agentId, settlementId)
    return true
  }

  /** Remove a resident from a settlement */
  removeResident(agentId: string): boolean {
    const settlementId = this.agentSettlement.get(agentId)
    if (!settlementId) return false

    const settlement = this.settlements.get(settlementId)
    if (!settlement) return false

    settlement.residents = settlement.residents.filter(id => id !== agentId)
    this.agentSettlement.delete(agentId)

    // If leader left, clear
    if (settlement.leaderId === agentId) {
      settlement.leaderId = null
      settlement.council = settlement.council.filter(id => id !== agentId)
    }

    return true
  }

  /** Get settlement by ID */
  getSettlement(id: string): Settlement | undefined {
    return this.settlements.get(id)
  }

  /** Get settlement an agent lives in */
  getAgentSettlement(agentId: string): Settlement | undefined {
    const id = this.agentSettlement.get(agentId)
    return id ? this.settlements.get(id) : undefined
  }

  /** Get all settlements */
  getAllSettlements(): Settlement[] {
    return [...this.settlements.values()]
  }

  /** Propose a law (requires leader or council member) */
  proposeLaw(
    settlementId: string,
    proposerId: string,
    law: Omit<SettlementLaw, 'id' | 'enactedAt' | 'proposedBy'>,
    tick: number,
  ): boolean {
    const settlement = this.settlements.get(settlementId)
    if (!settlement) return false

    // Only leader or council can propose
    if (settlement.leaderId !== proposerId && !settlement.council.includes(proposerId)) {
      return false
    }

    // Simple majority vote (for now, auto-pass if leader proposes)
    const newLaw: SettlementLaw = {
      ...law,
      id: generateId(),
      proposedBy: proposerId,
      enactedAt: tick,
    }

    settlement.laws.push(newLaw)

    // Apply tax rate changes
    if (newLaw.type === 'tax_rate' && typeof newLaw.value === 'number') {
      settlement.taxRate = Math.max(0, Math.min(0.20, newLaw.value))
    }

    this.eventBus.emit({
      type: 'settlement:law_enacted',
      settlementId: settlement.id,
      settlementName: settlement.name,
      lawType: newLaw.type,
      description: newLaw.description,
      timestamp: tick,
    })

    return true
  }

  /** Collect taxes from all residents */
  collectTaxes(settlementId: string, agents: Agent[]): number {
    const settlement = this.settlements.get(settlementId)
    if (!settlement || settlement.taxRate <= 0) return 0

    let collected = 0
    for (const residentId of settlement.residents) {
      const agent = agents.find(a => a.id === residentId)
      if (!agent) continue

      const gold = agent.inventory.find(i => i.name === 'Gold Coin' || i.name === 'gold_coin')
      if (gold && gold.quantity) {
        const tax = Math.floor(gold.quantity * settlement.taxRate)
        if (tax > 0) {
          gold.quantity -= tax
          collected += tax
        }
      }
    }

    settlement.treasury += collected
    return collected
  }

  /** Tick: check growth, elections, prosperity */
  tick(clock: WorldClock, agents: Agent[], getAgentName: (id: string) => string): void {
    // Growth check
    if (clock.tick - this.lastGrowthCheck >= GROWTH_CHECK_INTERVAL) {
      this.lastGrowthCheck = clock.tick
      this.checkGrowth(clock.tick)
    }

    // Election check
    if (clock.tick - this.lastElectionCheck >= TICKS_PER_GAME_DAY) {
      this.lastElectionCheck = clock.tick

      for (const settlement of this.settlements.values()) {
        // Check if it's time for a new election
        if (settlement.type !== 'camp' && !settlement.currentElection) {
          const daysSinceCreation = Math.floor((clock.tick - settlement.createdAt) / TICKS_PER_GAME_DAY)
          if (daysSinceCreation > 0 && daysSinceCreation % ELECTION_INTERVAL_DAYS === 0) {
            this.startElection(settlement, clock.tick)
          }
        }

        // Process active elections
        if (settlement.currentElection) {
          this.processElection(settlement, clock.tick, agents, getAgentName)
        }
      }
    }
  }

  /** Format settlement info for LLM context */
  formatForLLM(agentId: string): string {
    const settlement = this.getAgentSettlement(agentId)
    if (!settlement) return ''

    let line = `[Your Settlement] ${settlement.name} (${settlement.type})\n`
    line += `  Population: ${settlement.residents.length} | Treasury: ${settlement.treasury}G | Tax: ${Math.round(settlement.taxRate * 100)}%\n`
    line += `  Defense: ${settlement.defenseLevel} | Prosperity: ${settlement.prosperity}\n`

    if (settlement.leaderId) {
      const isLeader = settlement.leaderId === agentId
      line += `  Leader: ${isLeader ? 'You' : settlement.leaderId}\n`
    }

    // Culture context
    if (settlement.culture.languageStyle) {
      line += `  [Culture] Speaking style: ${settlement.culture.languageStyle}\n`
      line += `  Greeting: "${settlement.culture.greeting}"\n`
      line += `  Values: ${settlement.culture.values.join(', ')}\n`
      line += `  Taboos: ${settlement.culture.taboos.join(', ')}\n`
    }

    if (settlement.culture.traditions.length > 0) {
      line += `  Traditions: ${settlement.culture.traditions.map(t => t.name).join(', ')}\n`
    }

    if (settlement.culture.legends.length > 0) {
      const recentLegend = settlement.culture.legends[settlement.culture.legends.length - 1]
      line += `  Local legend: "${recentLegend.title}"\n`
    }

    if (settlement.currentElection) {
      const e = settlement.currentElection
      line += `  [Active Election] Status: ${e.status}`
      if (e.candidates.length > 0) {
        line += ` | Candidates: ${e.candidates.map(c => c.agentId).join(', ')}`
      }
      line += '\n'
    }

    if (settlement.laws.length > 0) {
      const recent = settlement.laws.slice(-3)
      line += `  Recent laws: ${recent.map(l => l.description).join('; ')}\n`
    }

    return line
  }

  /** Generate culture for a settlement based on its biome and characteristics */
  generateCulture(settlement: Settlement, biome: string, mainResource: string): void {
    // Language style based on biome
    const BIOME_STYLES: Record<string, { style: string; greeting: string; values: string[]; taboos: string[] }> = {
      mountain: {
        style: 'Formal and stoic, with weight behind every word',
        greeting: 'Stand strong, friend!',
        values: ['strength', 'loyalty', 'honor'],
        taboos: ['cowardice', 'oath breaking'],
      },
      forest: {
        style: 'Quiet and contemplative, often poetic',
        greeting: 'The trees whisper welcome.',
        values: ['wisdom', 'harmony', 'patience'],
        taboos: ['wanton destruction', 'greed'],
      },
      coast: {
        style: 'Free-spirited and cheerful',
        greeting: 'Fair winds to you!',
        values: ['freedom', 'adaptability', 'courage'],
        taboos: ['hoarding', 'dishonesty'],
      },
      plains: {
        style: 'Warm and hospitable, direct',
        greeting: 'Welcome, traveler!',
        values: ['hospitality', 'hard work', 'community'],
        taboos: ['laziness', 'selfishness'],
      },
      swamp: {
        style: 'Mysterious and cryptic',
        greeting: 'The mist parts for you.',
        values: ['resourcefulness', 'secrecy', 'survival'],
        taboos: ['betrayal', 'waste'],
      },
      desert: {
        style: 'Spare and measured, every word counts',
        greeting: 'Water and shade upon you.',
        values: ['endurance', 'frugality', 'respect'],
        taboos: ['water waste', 'false promises'],
      },
    }

    // Determine biome category
    let biomeCategory = 'plains'
    if (['mountain', 'cliff', 'volcanic', 'tundra'].includes(biome)) biomeCategory = 'mountain'
    else if (['forest', 'dense_forest'].includes(biome)) biomeCategory = 'forest'
    else if (['water', 'beach', 'river'].includes(biome)) biomeCategory = 'coast'
    else if (['swamp'].includes(biome)) biomeCategory = 'swamp'
    else if (['sand', 'lava'].includes(biome)) biomeCategory = 'desert'

    const cultural = BIOME_STYLES[biomeCategory] ?? BIOME_STYLES.plains

    // Generate traditions based on main resource
    const traditions: SettlementTradition[] = []
    if (mainResource === 'wood') {
      traditions.push({
        name: 'Timber Festival',
        description: 'A seasonal celebration of the forest bounty with log-rolling competitions.',
        frequency: 'seasonal',
        effects: ['gathering_xp_bonus'],
      })
    } else if (mainResource === 'iron' || mainResource === 'stone') {
      traditions.push({
        name: 'Forge Day',
        description: 'Master smiths compete to craft the finest blade.',
        frequency: 'seasonal',
        effects: ['crafting_xp_bonus'],
      })
    } else if (mainResource === 'food') {
      traditions.push({
        name: 'Harvest Feast',
        description: 'The whole settlement gathers to celebrate the harvest.',
        frequency: 'seasonal',
        effects: ['morale_boost'],
      })
    } else {
      traditions.push({
        name: 'Founders Day',
        description: 'Commemorating the founding of the settlement with song and story.',
        frequency: 'annual',
        effects: ['morale_boost'],
      })
    }

    // Add a combat tradition for settlements with defense
    if (settlement.defenseLevel > 0) {
      traditions.push({
        name: "Warrior's Trial",
        description: 'A tournament to determine the strongest defender.',
        frequency: 'seasonal',
        effects: ['combat_xp_bonus'],
      })
    }

    settlement.culture = {
      mainActivity: mainResource === 'food' ? 'farming' : mainResource === 'iron' ? 'mining' : mainResource === 'wood' ? 'logging' : 'trading',
      languageStyle: cultural.style,
      greeting: cultural.greeting,
      values: cultural.values,
      taboos: cultural.taboos,
      traditions,
      legends: [],
      festivals: traditions.map(t => t.name),
    }

    this.eventBus.emit({
      type: 'culture:generated',
      settlementId: settlement.id,
      settlementName: settlement.name,
      timestamp: settlement.createdAt,
    })

    console.log(`[Settlement] Generated culture for ${settlement.name}: ${cultural.style.slice(0, 40)}...`)
  }

  /** Add a legend to a settlement's culture based on a world event */
  addLegend(settlementId: string, title: string, story: string, relatedEventId?: string, tick?: number): void {
    const settlement = this.settlements.get(settlementId)
    if (!settlement) return

    settlement.culture.legends.push({
      title,
      story,
      relatedEventId,
      addedAt: tick ?? 0,
    })

    // Keep only 10 most recent legends
    if (settlement.culture.legends.length > 10) {
      settlement.culture.legends = settlement.culture.legends.slice(-10)
    }
  }

  // ── Private helpers ──

  private checkGrowth(tick: number): void {
    for (const settlement of this.settlements.values()) {
      const newType = getSettlementTypeForPopulation(settlement.residents.length)
      if (newType !== settlement.type) {
        const oldType = settlement.type
        settlement.type = newType

        // Generate name if upgrading from camp
        if (oldType === 'camp' && newType !== 'camp' && settlement.name.includes('Camp')) {
          settlement.name = this.generateSettlementName()
        }

        this.eventBus.emit({
          type: 'settlement:grew',
          settlementId: settlement.id,
          settlementName: settlement.name,
          oldType,
          newType,
          population: settlement.residents.length,
          timestamp: tick,
        })

        // Generate culture when settlement grows to village
        if (oldType === 'camp' && (newType === 'village' || newType === 'town' || newType === 'city')) {
          // Determine biome from first tile of POI area (simple heuristic)
          const biome = 'plains' // default, could be enriched with tile map data
          const mainResource = settlement.culture.mainActivity === 'general' ? 'food' : settlement.culture.mainActivity
          this.generateCulture(settlement, biome, mainResource)
        }

        // Upgrade defense for towns and cities
        if (newType === 'town' && settlement.defenseLevel < 1) settlement.defenseLevel = 1
        if (newType === 'city' && settlement.defenseLevel < 3) settlement.defenseLevel = 3
      }
    }
  }

  private startElection(settlement: Settlement, tick: number): void {
    if (settlement.residents.length < 3) return

    // Auto-generate candidates: current leader (if any) + 1-2 random residents
    const candidates: ElectionCandidate[] = []

    if (settlement.leaderId && settlement.residents.includes(settlement.leaderId)) {
      candidates.push({
        agentId: settlement.leaderId,
        platform: 'I will continue to lead with stability and wisdom.',
        votes: 0,
      })
    }

    // Pick 1-2 challengers from residents
    const eligible = settlement.residents.filter(id =>
      id !== settlement.leaderId && !candidates.find(c => c.agentId === id),
    )

    const challengerCount = Math.min(2, eligible.length)
    for (let i = 0; i < challengerCount; i++) {
      const idx = Math.floor(Math.random() * eligible.length)
      const challengerId = eligible.splice(idx, 1)[0]
      candidates.push({
        agentId: challengerId,
        platform: this.generatePlatform(),
        votes: 0,
      })
    }

    if (candidates.length < 2) return

    const election: Election = {
      id: generateId(),
      settlementId: settlement.id,
      candidates,
      startedAt: tick,
      endsAt: tick + CAMPAIGN_DURATION_TICKS,
      status: 'campaigning',
      winnerId: null,
    }

    settlement.currentElection = election

    this.eventBus.emit({
      type: 'election:started',
      settlementId: settlement.id,
      settlementName: settlement.name,
      candidates: candidates.map(c => ({ agentId: c.agentId, platform: c.platform })),
      timestamp: tick,
    })
  }

  private processElection(settlement: Settlement, tick: number, agents: Agent[], getAgentName: (id: string) => string): void {
    const election = settlement.currentElection
    if (!election) return

    // Transition from campaigning to voting
    if (election.status === 'campaigning' && tick >= election.endsAt - Math.floor(CAMPAIGN_DURATION_TICKS / 2)) {
      election.status = 'voting'
    }

    // Count votes when voting period ends
    if (election.status === 'voting' && tick >= election.endsAt) {
      this.resolveElection(settlement, agents, tick, getAgentName)
    }
  }

  private resolveElection(settlement: Settlement, agents: Agent[], tick: number, getAgentName: (id: string) => string): void {
    const election = settlement.currentElection
    if (!election) return

    // Each resident votes based on relationships and reputation
    for (const residentId of settlement.residents) {
      // Skip candidates voting for themselves
      const isCandidate = election.candidates.find(c => c.agentId === residentId)
      if (isCandidate) {
        isCandidate.votes += 1
        continue
      }

      // Vote based on relationship + reputation score
      let bestScore = -Infinity
      let bestCandidate: ElectionCandidate | null = null

      for (const candidate of election.candidates) {
        let score = 0

        // Relationship-based scoring
        if (this.relationshipManager) {
          const rel = this.relationshipManager.get(residentId, candidate.agentId)
          if (rel) {
            score += rel.axes.trust * 0.4
            score += rel.axes.respect * 0.3
            score += rel.axes.affection * 0.2
            score -= rel.axes.fear * 0.1
          }
        }

        // Reputation-based scoring
        if (this.reputationSystem) {
          const rep = this.reputationSystem.getReputation(candidate.agentId)
          score += rep.leadership * 0.3
          score += rep.social * 0.2
          score -= rep.infamy * 0.5
        }

        // Random factor (representing platform appeal)
        score += (Math.random() - 0.5) * 20

        if (score > bestScore) {
          bestScore = score
          bestCandidate = candidate
        }
      }

      if (bestCandidate) {
        bestCandidate.votes += 1
      }
    }

    // Determine winner
    election.candidates.sort((a, b) => b.votes - a.votes)
    const winner = election.candidates[0]

    election.status = 'completed'
    election.winnerId = winner.agentId

    // Set new leader
    settlement.leaderId = winner.agentId

    // Council = runner-ups
    settlement.council = election.candidates
      .slice(1)
      .map(c => c.agentId)
      .filter(id => settlement.residents.includes(id))

    // Leadership reputation boost
    if (this.reputationSystem) {
      this.reputationSystem.adjustReputation(winner.agentId, 'leadership', 5, `Elected leader of ${settlement.name}`, tick)
    }

    const totalVotes = election.candidates.reduce((sum, c) => sum + c.votes, 0)

    this.eventBus.emit({
      type: 'election:ended',
      settlementId: settlement.id,
      settlementName: settlement.name,
      winnerId: winner.agentId,
      winnerName: getAgentName(winner.agentId),
      voteCount: winner.votes,
      totalVotes,
      timestamp: tick,
    })

    // Clear election after resolution
    settlement.currentElection = null
  }

  private generateSettlementName(): string {
    const prefixes = ['Silver', 'Deep', 'Iron', 'Green', 'Storm', 'Dawn', 'Moon', 'Shadow', 'River', 'Stone']
    const suffixes = ['Ford', 'Haven', 'Hold', 'Reach', 'Brook', 'Dale', 'Fall', 'Gate', 'Rest', 'Watch']
    return `${prefixes[Math.floor(Math.random() * prefixes.length)]} ${suffixes[Math.floor(Math.random() * suffixes.length)]}`
  }

  private generatePlatform(): string {
    const platforms = [
      'I will lower taxes and strengthen our defenses.',
      'I promise prosperity through trade and cooperation.',
      'Security first! I will protect our people.',
      'We need new infrastructure and better facilities.',
      'I will build alliances with neighboring settlements.',
      'Time for change! New leadership, new direction.',
      'I will ensure fair treatment for all residents.',
    ]
    return platforms[Math.floor(Math.random() * platforms.length)]
  }
}
