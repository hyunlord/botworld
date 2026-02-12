// ──────────────────────────────────────────────
// Politics System — Guilds, Settlements, Kingdoms, Diplomacy
// ──────────────────────────────────────────────

// ── Guild Types ──

export type GuildType = 'trade' | 'combat' | 'craft' | 'exploration' | 'social'

export type GuildRankName = 'guild_master' | 'vice_master' | 'elder' | 'member' | 'apprentice'

export type GuildPermission =
  | 'treasury'
  | 'invite'
  | 'kick'
  | 'propose_law'
  | 'declare_war'
  | 'sign_treaty'
  | 'promote'
  | 'set_tax'

export interface GuildRank {
  name: GuildRankName
  permissions: GuildPermission[]
  salary: number
  holders: string[]
}

export interface GuildCharter {
  foundingPrinciples: string
  memberDuties: string[]
  memberRights: string[]
  prohibitions: string[]
  amendmentProcess: string
}

export interface GuildFaction {
  name: string
  leader: string
  members: string[]
  agenda: string
  influence: number // 0-100
}

export interface GuildLeaderRecord {
  agentId: string
  name: string
  from: number
  to: number | null
  reason: 'founded' | 'elected' | 'coup' | 'merged' | 'resigned'
}

export interface Guild {
  id: string
  name: string
  motto: string
  type: GuildType
  leaderId: string
  treasury: number
  territoryPoi: string | null
  reputation: number
  ranks: GuildRank[]
  charter: GuildCharter
  factions: GuildFaction[]
  alliances: string[]
  rivals: string[]
  leaderHistory: GuildLeaderRecord[]
  members: string[]
  createdAt: number
}

// ── Settlement Types ──

export type SettlementType = 'camp' | 'village' | 'town' | 'city'

export interface SettlementLaw {
  id: string
  type: 'tax_rate' | 'trade_restriction' | 'mandatory_defense' | 'welcome_policy' | 'custom'
  description: string
  value: string | number
  proposedBy: string
  enactedAt: number
}

export interface SettlementCulture {
  mainActivity: string
  festivals: string[]
  traditions: string[]
}

export interface ElectionCandidate {
  agentId: string
  platform: string
  votes: number
}

export interface Election {
  id: string
  settlementId: string
  candidates: ElectionCandidate[]
  startedAt: number
  endsAt: number
  status: 'campaigning' | 'voting' | 'completed'
  winnerId: string | null
}

export interface Settlement {
  id: string
  name: string
  type: SettlementType
  poiId: string
  leaderId: string | null
  council: string[]
  laws: SettlementLaw[]
  treasury: number
  taxRate: number
  defenseLevel: number
  prosperity: number
  allegiance: string | null
  culture: SettlementCulture
  residents: string[]
  currentElection: Election | null
  createdAt: number
}

// ── Kingdom Types ──

export type DiplomacyStatus = 'war' | 'hostile' | 'neutral' | 'friendly' | 'allied' | 'vassal'

export type TreatyType = 'trade' | 'non_aggression' | 'mutual_defense' | 'tribute' | 'ceasefire'

export interface Treaty {
  id: string
  type: TreatyType
  partyA: string
  partyB: string
  terms: string[]
  expires: number
  status: 'active' | 'expired' | 'violated' | 'dissolved'
  signedAt: number
}

export type WarGoal = 'territory' | 'tribute' | 'regime_change' | 'resource'

export interface WarBattle {
  tick: number
  location: string
  attackerForce: number
  defenderForce: number
  result: 'attacker_won' | 'defender_won' | 'draw'
  casualties: { attacker: number; defender: number }
}

export interface War {
  id: string
  attackerId: string
  defenderId: string
  casusBelli: string
  goal: WarGoal
  startedAt: number
  warFatigue: Record<string, number>
  battles: WarBattle[]
  status: 'active' | 'ceasefire' | 'ended'
  endedAt: number | null
  terms: string[] | null
}

export interface KingdomPolicies {
  taxRate: number
  conscription: boolean
  openBorders: boolean
}

export interface Kingdom {
  id: string
  name: string
  rulerId: string
  settlements: string[]
  policies: KingdomPolicies
  diplomacy: Record<string, DiplomacyStatus>
  treaties: string[]
  wars: string[]
  foundedAt: number
}

// ── Helper constructors ──

export function createDefaultRanks(): GuildRank[] {
  return [
    { name: 'guild_master', permissions: ['treasury', 'invite', 'kick', 'propose_law', 'declare_war', 'sign_treaty', 'promote', 'set_tax'], salary: 10, holders: [] },
    { name: 'vice_master', permissions: ['treasury', 'invite', 'kick', 'promote', 'propose_law'], salary: 7, holders: [] },
    { name: 'elder', permissions: ['treasury', 'invite', 'propose_law'], salary: 5, holders: [] },
    { name: 'member', permissions: ['propose_law'], salary: 0, holders: [] },
    { name: 'apprentice', permissions: [], salary: 0, holders: [] },
  ]
}

export function createDefaultCharter(): GuildCharter {
  return {
    foundingPrinciples: 'Founded on the principles of mutual aid and shared prosperity.',
    memberDuties: ['Pay monthly guild tax', 'Defend guild territory when called'],
    memberRights: ['Equal share of treasury profits', 'Freedom to leave'],
    prohibitions: ['Trading with rival guilds is discouraged'],
    amendmentProcess: 'Majority vote of all members to amend.',
  }
}

export function getSettlementTypeForPopulation(count: number): SettlementType {
  if (count >= 30) return 'city'
  if (count >= 16) return 'town'
  if (count >= 6) return 'village'
  return 'camp'
}
