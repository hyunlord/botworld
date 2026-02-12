/**
 * KingdomManager — kingdom founding, diplomacy, treaties, and war.
 *
 * Kingdoms form when 2+ settlements ally. Diplomacy ranges from war to allied.
 * Treaties have terms and expiration. Wars have casus belli, battles, fatigue,
 * and surrender negotiations.
 */

import type {
  Kingdom, Treaty, War, WarBattle, DiplomacyStatus, TreatyType, WarGoal,
  KingdomPolicies, WorldClock, Agent,
} from '@botworld/shared'
import { generateId, TICKS_PER_GAME_DAY } from '@botworld/shared'
import type { EventBus } from '../core/event-bus.js'
import type { SettlementManager } from './settlement-manager.js'
import type { RelationshipManager } from '../social/relationship-manager.js'
import type { ReputationSystem } from '../social/reputation-system.js'

const TREATY_CHECK_INTERVAL = 500
const WAR_FATIGUE_PER_DAY = 3
const WAR_AUTO_CEASEFIRE_DAYS = 30
const WAR_AUTO_CEASEFIRE_TICKS = WAR_AUTO_CEASEFIRE_DAYS * TICKS_PER_GAME_DAY

export class KingdomManager {
  private kingdoms = new Map<string, Kingdom>()
  private treaties = new Map<string, Treaty>()
  private wars = new Map<string, War>()
  private eventBus: EventBus
  private settlementManager: SettlementManager | null = null
  private relationshipManager: RelationshipManager | null = null
  private reputationSystem: ReputationSystem | null = null
  private lastTreatyCheck = 0

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus
  }

  setSettlementManager(sm: SettlementManager): void {
    this.settlementManager = sm
  }

  setRelationshipManager(rm: RelationshipManager): void {
    this.relationshipManager = rm
  }

  setReputationSystem(rs: ReputationSystem): void {
    this.reputationSystem = rs
  }

  /** Found a new kingdom from 2+ allied settlements */
  foundKingdom(
    settlementIds: string[],
    rulerId: string,
    tick: number,
    getAgentName: (id: string) => string,
    name?: string,
  ): Kingdom | null {
    if (settlementIds.length < 2) return null
    if (!this.settlementManager) return null

    // Verify settlements exist and aren't already in a kingdom
    for (const sId of settlementIds) {
      const s = this.settlementManager.getSettlement(sId)
      if (!s || s.allegiance) return null
    }

    const kingdomName = name ?? this.generateKingdomName()

    const kingdom: Kingdom = {
      id: generateId(),
      name: kingdomName,
      rulerId,
      settlements: [...settlementIds],
      policies: {
        taxRate: 0.05,
        conscription: false,
        openBorders: true,
      },
      diplomacy: {},
      treaties: [],
      wars: [],
      foundedAt: tick,
    }

    this.kingdoms.set(kingdom.id, kingdom)

    // Set allegiance for all settlements
    for (const sId of settlementIds) {
      const s = this.settlementManager.getSettlement(sId)
      if (s) s.allegiance = kingdom.id
    }

    // Leadership reputation boost
    if (this.reputationSystem) {
      this.reputationSystem.adjustReputation(rulerId, 'leadership', 15, `Founded the kingdom of ${kingdomName}`, tick)
    }

    this.eventBus.emit({
      type: 'kingdom:founded',
      kingdomId: kingdom.id,
      kingdomName,
      rulerId,
      rulerName: getAgentName(rulerId),
      settlementIds,
      timestamp: tick,
    })

    return kingdom
  }

  /** Add a settlement to a kingdom */
  addSettlement(kingdomId: string, settlementId: string): boolean {
    const kingdom = this.kingdoms.get(kingdomId)
    if (!kingdom || !this.settlementManager) return false

    const settlement = this.settlementManager.getSettlement(settlementId)
    if (!settlement || settlement.allegiance) return false

    kingdom.settlements.push(settlementId)
    settlement.allegiance = kingdomId
    return true
  }

  /** Set diplomatic status between two kingdoms */
  setDiplomacy(kingdomAId: string, kingdomBId: string, status: DiplomacyStatus): void {
    const kA = this.kingdoms.get(kingdomAId)
    const kB = this.kingdoms.get(kingdomBId)
    if (!kA || !kB) return

    kA.diplomacy[kingdomBId] = status
    kB.diplomacy[kingdomAId] = status
  }

  /** Get diplomatic status between two kingdoms */
  getDiplomacy(kingdomAId: string, kingdomBId: string): DiplomacyStatus {
    const kA = this.kingdoms.get(kingdomAId)
    return kA?.diplomacy[kingdomBId] ?? 'neutral'
  }

  /** Sign a treaty between two kingdoms */
  signTreaty(
    partyAId: string,
    partyBId: string,
    type: TreatyType,
    terms: string[],
    durationTicks: number,
    tick: number,
    getKingdomName: (id: string) => string,
  ): Treaty | null {
    const kA = this.kingdoms.get(partyAId)
    const kB = this.kingdoms.get(partyBId)
    if (!kA || !kB) return null

    const treaty: Treaty = {
      id: generateId(),
      type,
      partyA: partyAId,
      partyB: partyBId,
      terms,
      expires: tick + durationTicks,
      status: 'active',
      signedAt: tick,
    }

    this.treaties.set(treaty.id, treaty)
    kA.treaties.push(treaty.id)
    kB.treaties.push(treaty.id)

    // Improve diplomacy based on treaty type
    if (type === 'mutual_defense' || type === 'trade') {
      this.setDiplomacy(partyAId, partyBId, 'friendly')
    }
    if (type === 'non_aggression') {
      const current = this.getDiplomacy(partyAId, partyBId)
      if (current === 'hostile' || current === 'neutral') {
        this.setDiplomacy(partyAId, partyBId, 'neutral')
      }
    }
    if (type === 'ceasefire') {
      // End any active war between them
      this.endWarBetween(partyAId, partyBId, tick, null)
    }

    this.eventBus.emit({
      type: 'treaty:signed',
      treatyId: treaty.id,
      treatyType: type,
      partyAId,
      partyAName: getKingdomName(partyAId),
      partyBId,
      partyBName: getKingdomName(partyBId),
      terms,
      timestamp: tick,
    })

    return treaty
  }

  /** Violate a treaty */
  violateTreaty(treatyId: string, violatorId: string, tick: number): void {
    const treaty = this.treaties.get(treatyId)
    if (!treaty || treaty.status !== 'active') return

    treaty.status = 'violated'

    // Trust penalty for violator's ruler against all kingdoms
    if (this.relationshipManager) {
      const violatorKingdom = this.kingdoms.get(violatorId)
      if (violatorKingdom) {
        for (const kingdom of this.kingdoms.values()) {
          if (kingdom.id === violatorId) continue
          this.relationshipManager.applyInteraction(
            kingdom.rulerId, violatorKingdom.rulerId, 'betrayal', tick,
          )
        }
      }
    }

    // Infamy increase
    if (this.reputationSystem) {
      const violator = this.kingdoms.get(violatorId)
      if (violator) {
        this.reputationSystem.addInfamy(violator.rulerId, 15)
        this.reputationSystem.adjustReputation(violator.rulerId, 'leadership', -10, 'Violated a treaty', tick)
      }
    }
  }

  /** Declare war between two kingdoms */
  declareWar(
    attackerId: string,
    defenderId: string,
    casusBelli: string,
    goal: WarGoal,
    tick: number,
    getKingdomName: (id: string) => string,
  ): War | null {
    const kA = this.kingdoms.get(attackerId)
    const kB = this.kingdoms.get(defenderId)
    if (!kA || !kB) return null

    // Check if already at war
    const existingWar = this.getWarBetween(attackerId, defenderId)
    if (existingWar) return null

    const war: War = {
      id: generateId(),
      attackerId,
      defenderId,
      casusBelli,
      goal,
      startedAt: tick,
      warFatigue: { [attackerId]: 0, [defenderId]: 0 },
      battles: [],
      status: 'active',
      endedAt: null,
      terms: null,
    }

    this.wars.set(war.id, war)
    kA.wars.push(war.id)
    kB.wars.push(war.id)

    // Set diplomacy to war
    this.setDiplomacy(attackerId, defenderId, 'war')

    // Unjustified war penalty
    if (!casusBelli || casusBelli.trim() === '') {
      if (this.reputationSystem) {
        this.reputationSystem.adjustReputation(kA.rulerId, 'leadership', -30, 'Declared unjustified war', tick)
        this.reputationSystem.addInfamy(kA.rulerId, 20)
      }
    }

    this.eventBus.emit({
      type: 'war:declared',
      warId: war.id,
      attackerId,
      attackerName: getKingdomName(attackerId),
      defenderId,
      defenderName: getKingdomName(defenderId),
      casusBelli,
      goal,
      timestamp: tick,
    })

    return war
  }

  /** Record a battle in an active war */
  recordBattle(warId: string, battle: Omit<WarBattle, 'tick'>, tick: number): void {
    const war = this.wars.get(warId)
    if (!war || war.status !== 'active') return

    war.battles.push({ ...battle, tick })

    // Increase war fatigue for the loser
    if (battle.result === 'attacker_won') {
      war.warFatigue[war.defenderId] = Math.min(100, (war.warFatigue[war.defenderId] ?? 0) + 10)
      war.warFatigue[war.attackerId] = Math.min(100, (war.warFatigue[war.attackerId] ?? 0) + 3)
    } else if (battle.result === 'defender_won') {
      war.warFatigue[war.attackerId] = Math.min(100, (war.warFatigue[war.attackerId] ?? 0) + 10)
      war.warFatigue[war.defenderId] = Math.min(100, (war.warFatigue[war.defenderId] ?? 0) + 3)
    } else {
      war.warFatigue[war.attackerId] = Math.min(100, (war.warFatigue[war.attackerId] ?? 0) + 5)
      war.warFatigue[war.defenderId] = Math.min(100, (war.warFatigue[war.defenderId] ?? 0) + 5)
    }
  }

  /** End a war with terms */
  endWar(warId: string, tick: number, terms: string[] | null, winnerId: string | null): void {
    const war = this.wars.get(warId)
    if (!war) return

    war.status = 'ended'
    war.endedAt = tick
    war.terms = terms

    // Set diplomacy to hostile (not neutral, they just fought)
    this.setDiplomacy(war.attackerId, war.defenderId, 'hostile')

    // Remove war from kingdoms
    const kA = this.kingdoms.get(war.attackerId)
    const kB = this.kingdoms.get(war.defenderId)
    if (kA) kA.wars = kA.wars.filter(id => id !== warId)
    if (kB) kB.wars = kB.wars.filter(id => id !== warId)

    this.eventBus.emit({
      type: 'war:ended',
      warId,
      winnerId,
      terms,
      timestamp: tick,
    })
  }

  /** Get war between two kingdoms */
  getWarBetween(kingdomAId: string, kingdomBId: string): War | undefined {
    for (const war of this.wars.values()) {
      if (war.status !== 'active') continue
      if (
        (war.attackerId === kingdomAId && war.defenderId === kingdomBId) ||
        (war.attackerId === kingdomBId && war.defenderId === kingdomAId)
      ) {
        return war
      }
    }
    return undefined
  }

  /** Get kingdom by ID */
  getKingdom(id: string): Kingdom | undefined {
    return this.kingdoms.get(id)
  }

  /** Get all kingdoms */
  getAllKingdoms(): Kingdom[] {
    return [...this.kingdoms.values()]
  }

  /** Get all active treaties */
  getAllTreaties(): Treaty[] {
    return [...this.treaties.values()]
  }

  /** Get all active wars */
  getAllWars(): War[] {
    return [...this.wars.values()]
  }

  /** Tick: expire treaties, increase war fatigue, check auto-ceasefire */
  tick(clock: WorldClock): void {
    if (clock.tick - this.lastTreatyCheck < TREATY_CHECK_INTERVAL) return
    this.lastTreatyCheck = clock.tick

    // Expire treaties
    for (const treaty of this.treaties.values()) {
      if (treaty.status === 'active' && clock.tick >= treaty.expires) {
        treaty.status = 'expired'
      }
    }

    // War fatigue and auto-ceasefire
    for (const war of this.wars.values()) {
      if (war.status !== 'active') continue

      // Increase fatigue over time
      const warDurationDays = (clock.tick - war.startedAt) / TICKS_PER_GAME_DAY
      war.warFatigue[war.attackerId] = Math.min(100, warDurationDays * WAR_FATIGUE_PER_DAY)
      war.warFatigue[war.defenderId] = Math.min(100, warDurationDays * WAR_FATIGUE_PER_DAY)

      // Auto-ceasefire after threshold
      if (clock.tick - war.startedAt > WAR_AUTO_CEASEFIRE_TICKS) {
        war.status = 'ceasefire'
        this.setDiplomacy(war.attackerId, war.defenderId, 'hostile')
      }
    }
  }

  /** Format kingdom info for LLM context */
  formatForLLM(agentId: string, getAgentName: (id: string) => string): string {
    if (!this.settlementManager) return ''

    // Find agent's kingdom through their settlement
    const settlement = this.settlementManager.getAgentSettlement(agentId)
    if (!settlement?.allegiance) return ''

    const kingdom = this.kingdoms.get(settlement.allegiance)
    if (!kingdom) return ''

    let line = `[Your Kingdom] ${kingdom.name}\n`
    line += `  Ruler: ${kingdom.rulerId === agentId ? 'You' : getAgentName(kingdom.rulerId)}\n`
    line += `  Settlements: ${kingdom.settlements.length}\n`

    // Diplomacy summary
    const diplomacyEntries = Object.entries(kingdom.diplomacy).filter(([, v]) => v !== 'neutral')
    if (diplomacyEntries.length > 0) {
      line += `  Diplomacy:\n`
      for (const [otherId, status] of diplomacyEntries) {
        const other = this.kingdoms.get(otherId)
        if (other) line += `    - ${other.name}: ${status}\n`
      }
    }

    // Active wars
    const activeWars = kingdom.wars
      .map(wId => this.wars.get(wId))
      .filter((w): w is War => w !== undefined && w.status === 'active')
    if (activeWars.length > 0) {
      line += `  Active wars:\n`
      for (const war of activeWars) {
        const enemyId = war.attackerId === kingdom.id ? war.defenderId : war.attackerId
        const enemy = this.kingdoms.get(enemyId)
        if (enemy) {
          const fatigue = war.warFatigue[kingdom.id] ?? 0
          line += `    - vs ${enemy.name} (fatigue: ${fatigue}%) — ${war.casusBelli}\n`
        }
      }
    }

    return line
  }

  // ── Private helpers ──

  private endWarBetween(kingdomAId: string, kingdomBId: string, tick: number, winnerId: string | null): void {
    const war = this.getWarBetween(kingdomAId, kingdomBId)
    if (war) {
      this.endWar(war.id, tick, null, winnerId)
    }
  }

  private generateKingdomName(): string {
    const prefixes = ['United', 'Grand', 'Free', 'Northern', 'Southern', 'Eastern', 'Western', 'Iron', 'Golden']
    const cores = ['Kingdom', 'Realm', 'Dominion', 'Republic', 'Federation', 'Confederation', 'Alliance']
    const suffixes = ['of the Vale', 'of the Peaks', 'of the Plains', 'of the Coast', 'of the Forest', '']

    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
    const core = cores[Math.floor(Math.random() * cores.length)]
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)]

    return `${prefix} ${core}${suffix ? ` ${suffix}` : ''}`
  }
}
