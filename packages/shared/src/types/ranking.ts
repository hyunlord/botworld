// ═══════════════════════════════════════════════════════════════
// Rankings, Records & Statistics Types
// ═══════════════════════════════════════════════════════════════

// ── Ranking Categories ──

export type RankingCategory =
  | 'combat' | 'economy' | 'crafting' | 'exploration'
  | 'social' | 'overall' | 'items'

export type CombatRankingField =
  | 'total_kills' | 'boss_kills' | 'win_streak' | 'max_single_damage'
  | 'win_rate' | 'total_battles'

export type EconomyRankingField =
  | 'total_wealth' | 'max_trade_value' | 'total_trades'
  | 'total_income' | 'total_tax_paid'

export type CraftingRankingField =
  | 'total_crafted' | 'masterwork_count' | 'legendary_count'
  | 'recipes_known'

export type ExplorationRankingField =
  | 'tiles_explored' | 'dungeons_cleared' | 'deepest_underground'
  | 'farthest_sailed' | 'secret_regions_found'

export type SocialRankingField =
  | 'total_relationships' | 'avg_trust' | 'rumor_target_count'
  | 'longest_guild_leader' | 'election_wins'

export type OverallRankingField =
  | 'power_score' | 'level' | 'reputation' | 'infamy'

export type RankingField =
  | CombatRankingField | EconomyRankingField | CraftingRankingField
  | ExplorationRankingField | SocialRankingField | OverallRankingField

// ── Ranking Entry ──

export interface RankingEntry {
  rank: number
  agentId: string
  agentName: string
  value: number
  /** Optional secondary info (e.g. "Level 12 Warrior") */
  detail?: string
}

export interface RankingBoard {
  field: RankingField
  label: string
  category: RankingCategory
  entries: RankingEntry[]
  updatedAt: number
}

export interface RankingsSnapshot {
  combat: RankingBoard[]
  economy: RankingBoard[]
  crafting: RankingBoard[]
  exploration: RankingBoard[]
  social: RankingBoard[]
  overall: RankingBoard[]
}

// ── Agent Stats (for ranking computation) ──

export interface AgentRankingStats {
  agentId: string
  agentName: string
  level: number
  // Combat
  totalKills: number
  bossKills: number
  currentWinStreak: number
  bestWinStreak: number
  maxSingleDamage: number
  totalBattles: number
  wins: number
  // Economy
  gold: number
  inventoryValue: number
  maxTradeValue: number
  totalTrades: number
  totalIncome: number
  totalTaxPaid: number
  // Crafting
  totalCrafted: number
  masterworkCount: number
  legendaryCount: number
  recipesKnown: number
  // Exploration
  tilesExplored: number
  dungeonCleared: number
  deepestUnderground: number
  farthestSailed: number
  secretRegionsFound: number
  // Social
  totalRelationships: number
  avgTrust: number
  rumorTargetCount: number
  longestGuildLeader: number
  electionWins: number
  // Overall
  reputation: number
  infamy: number
}

// ── Item Rankings ──

export interface ItemRankingEntry {
  itemId: string
  itemName: string
  itemType: string
  ownerName: string
  ownerId: string
  value: number
  rarity?: string
  historyLength: number
  age: number // ticks since creation
  battleCount: number
  ownerCount: number
  maxTradePrice: number
}

export interface ItemRankings {
  mostFamous: ItemRankingEntry[]       // longest history
  oldest: ItemRankingEntry[]           // oldest items
  mostExpensive: ItemRankingEntry[]    // highest single trade price
  mostBattled: ItemRankingEntry[]      // most combat uses
  mostOwners: ItemRankingEntry[]       // most owner changes
  legendary: ItemRankingEntry[]        // legendary quality items
}

// ── World Records ──

export type WorldRecordCategory =
  | 'highest_single_damage' | 'highest_trade_value' | 'longest_war'
  | 'largest_battle' | 'largest_guild' | 'longest_town_leader'
  | 'fastest_levelup' | 'wealthiest_ever' | 'longest_peace'
  | 'most_items_crafted' | 'first_legendary_crafter'
  | 'first_dragon_slayer' | 'first_nation_founder'

export interface WorldRecord {
  id: string
  category: WorldRecordCategory
  recordValue: number
  holderId: string | null
  holderName: string
  itemId: string | null
  achievedAt: number // tick
  description: string
  previousHolderId?: string | null
  previousHolderName?: string
  previousValue?: number
}

// ── Statistics / Dashboard ──

export interface TimeSeriesPoint {
  tick: number
  day: number
  value: number
}

export interface TimeSeries {
  label: string
  data: TimeSeriesPoint[]
  color?: string
}

export interface DistributionEntry {
  label: string
  value: number
  color?: string
}

export interface HeatmapCell {
  x: number
  y: number
  value: number
}

export interface EconomyStats {
  priceSeries: Record<string, TimeSeries>  // item name → price over time
  gdpSeries: TimeSeries
  wealthDistribution: DistributionEntry[]
  totalGoldCirculating: number
  avgItemPrice: number
  tradeVolumeSeries: TimeSeries
  tradeHeatmap: HeatmapCell[]
}

export interface CombatStats {
  dailyBattles: TimeSeries
  monsterKillsByType: DistributionEntry[]
  pvpVsPveRatio: { pvp: number; pve: number }
  avgBattleDuration: number
  dangerousAreas: HeatmapCell[]
  warTimeline: { name: string; startDay: number; endDay: number; nations: string[] }[]
}

export interface PopulationStats {
  totalAgentsSeries: TimeSeries
  raceDistribution: DistributionEntry[]
  townPopulations: DistributionEntry[]
  levelDistribution: DistributionEntry[]
  classDistribution: DistributionEntry[]
}

export interface EcologyStats {
  creaturePopulations: Record<string, TimeSeries>
  resourceRegen: TimeSeries
  resourceConsumption: TimeSeries
  biomeResources: DistributionEntry[]
  desertificationWarnings: { biome: string; depletion: number }[]
}

export interface PoliticsStats {
  guildPower: DistributionEntry[]
  recentElections: { position: string; winner: string; votes: number; day: number }[]
  activeWars: { attacker: string; defender: string; startDay: number }[]
  treaties: { parties: string[]; type: string; day: number }[]
  nationPower: DistributionEntry[]
}

export interface WorldStatistics {
  economy: EconomyStats
  combat: CombatStats
  population: PopulationStats
  ecology: EcologyStats
  politics: PoliticsStats
  lastUpdated: number
}

// ── Timeline ──

export type TimelineEventCategory =
  | 'nation_founded' | 'war' | 'legendary_item' | 'boss_kill'
  | 'election' | 'disaster' | 'record_broken' | 'discovery'

export interface TimelineEvent {
  id: string
  day: number
  tick: number
  category: TimelineEventCategory
  title: string
  description: string
  agentIds: string[]
  position?: { x: number; y: number }
  importance: number // 1-10
}

// ── Agent Compare ──

export interface AgentCompareData {
  agentId: string
  agentName: string
  level: number
  stats: {
    combat: number
    economy: number
    crafting: number
    exploration: number
    social: number
    magic: number
  }
  skills: Record<string, number>
  gold: number
  inventoryValue: number
  totalKills: number
  totalCrafted: number
  tilesExplored: number
  headToHead: {
    wins: number
    losses: number
    draws: number
  }
}

// ── Favorites ──

export interface FavoriteEntry {
  type: 'agent' | 'guild' | 'settlement'
  id: string
  name: string
  addedAt: number
}

// ── Events ──

export interface WorldRecordBrokenEvent {
  type: 'world_record:broken'
  category: WorldRecordCategory
  newValue: number
  holderId: string
  holderName: string
  previousHolderName?: string
  previousValue?: number
  description: string
  timestamp: number
}

export interface RankingsUpdatedEvent {
  type: 'rankings:updated'
  timestamp: number
}
