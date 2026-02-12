import type { Agent, AgentAction, Memory } from './agent.js'
import type { Position, WorldClock, WeatherState } from './world.js'
import type { Item, MarketOrder } from './item.js'
import type { CharacterAppearance, CharacterClass, Race } from './character.js'
import type { WorldEventType, WorldEventCategory, WorldEventEffect } from './world-event.js'
import type { MonsterType, CombatRound, CombatOutcome } from './combat.js'
import type { RelationshipInteraction, RelationshipTag, RumorType, SecretType, SocialStatus } from './relationship.js'
import type { GuildType, SettlementType, DiplomacyStatus, TreatyType, WarGoal } from './politics.js'
import type { HistoryEventType } from './history.js'
import type { Season, AnimalType } from './ecosystem.js'
import type { BuildingType, BuildingState, SiegeWeaponType } from './building.js'

/** All event types in the world */
export type WorldEvent =
  | AgentMovedEvent
  | AgentActionEvent
  | AgentSpokeEvent
  | AgentMemoryEvent
  | ResourceGatheredEvent
  | ItemCraftedEvent
  | TradeCompletedEvent
  | MarketOrderEvent
  | TickEvent
  | AgentSpawnedEvent
  | ChunksGeneratedEvent
  | CharacterUpdatedEvent
  | TradeProposedEvent
  | ChatDeliveredEvent
  | StateUpdatedEvent
  | WeatherChangedEvent
  | WorldEventStartedEvent
  | WorldEventEndedEvent
  | CombatStartedEvent
  | CombatRoundEvent
  | CombatEndedEvent
  | MonsterSpawnedEvent
  | MonsterDiedEvent
  | ItemNamingCandidateEvent
  | ItemNamedEvent
  | ItemDestroyedEvent
  | ItemMasterworkCreatedEvent
  | RelationshipChangedEvent
  | RumorCreatedEvent
  | RumorSpreadEvent
  | SecretRevealedEvent
  | ReputationChangedEvent
  | SocialStatusChangedEvent
  | GuildCreatedEvent
  | GuildMemberJoinedEvent
  | GuildMemberLeftEvent
  | GuildDramaEvent
  | SettlementCreatedEvent
  | SettlementGrewEvent
  | ElectionStartedEvent
  | ElectionEndedEvent
  | SettlementLawEnactedEvent
  | KingdomFoundedEvent
  | TreatySignedEvent
  | WarDeclaredEvent
  | WarEndedEvent
  | HistoryRecordedEvent
  | CultureGeneratedEvent
  | SeasonChangedEvent
  | AnimalSpawnedEvent
  | AnimalDiedEvent
  | ResourceStateChangedEvent
  | BuildingConstructionStartedEvent
  | BuildingConstructionCompletedEvent
  | BuildingUpgradedEvent
  | BuildingDamagedEvent
  | BuildingDestroyedEvent
  | BuildingRepairedEvent
  | SiegeStartedEvent
  | SiegeEndedEvent

export interface AgentMovedEvent {
  type: 'agent:moved'
  agentId: string
  from: Position
  to: Position
  timestamp: number
}

export interface AgentActionEvent {
  type: 'agent:action'
  agentId: string
  action: AgentAction
  timestamp: number
}

export interface AgentSpokeEvent {
  type: 'agent:spoke'
  agentId: string
  targetAgentId?: string
  message: string
  timestamp: number
}

export interface AgentMemoryEvent {
  type: 'agent:memory'
  agentId: string
  memory: Memory
  timestamp: number
}

export interface ResourceGatheredEvent {
  type: 'resource:gathered'
  agentId: string
  resourceType: string
  amount: number
  position: Position
  timestamp: number
}

export interface ItemCraftedEvent {
  type: 'item:crafted'
  agentId: string
  item: Item
  timestamp: number
}

export interface TradeCompletedEvent {
  type: 'trade:completed'
  buyerId: string
  sellerId: string
  item: Item
  price: number
  timestamp: number
}

export interface MarketOrderEvent {
  type: 'market:order'
  order: MarketOrder
  action: 'created' | 'fulfilled' | 'cancelled'
  timestamp: number
}

export interface TickEvent {
  type: 'world:tick'
  clock: WorldClock
  timestamp: number
}

export interface AgentSpawnedEvent {
  type: 'agent:spawned'
  agent: Agent
  timestamp: number
}

export interface ChunksGeneratedEvent {
  type: 'world:chunks_generated'
  chunkKeys: string[]
  timestamp: number
}

export interface CharacterUpdatedEvent {
  type: 'character:updated'
  agentId: string
  appearance: CharacterAppearance
  race: Race
  characterClass?: CharacterClass
  persona_reasoning?: string
  spriteHash: string
  timestamp: number
}

export interface TradeProposedEvent {
  type: 'trade:proposed'
  proposalId: string
  fromAgentId: string
  toAgentId: string
  offerItemId: string
  requestItemId: string
  timestamp: number
}

export interface ChatDeliveredEvent {
  type: 'chat:delivered'
  fromAgentId: string
  fromAgentName: string
  message: string
  messageType: 'say' | 'whisper' | 'shout'
  recipientIds: string[]
  position: { x: number; y: number }
  timestamp: number
}

export interface StateUpdatedEvent {
  type: 'world:state_updated'
  clock: WorldClock
  timestamp: number
}

export interface WeatherChangedEvent {
  type: 'weather:changed'
  weather: WeatherState
  timestamp: number
}

export interface WorldEventStartedEvent {
  type: 'world_event:started'
  eventId: string
  eventType: WorldEventType
  title: string
  description: string
  category: WorldEventCategory
  position: Position
  radius: number
  effects: WorldEventEffect[]
  duration: number
  expiresAt: number
  timestamp: number
}

export interface WorldEventEndedEvent {
  type: 'world_event:ended'
  eventId: string
  eventType: WorldEventType
  title: string
  timestamp: number
}

// ── Combat Events ──

export interface CombatStartedEvent {
  type: 'combat:started'
  combatId: string
  agentId: string
  monsterId: string
  monsterType: MonsterType
  monsterName: string
  position: Position
  timestamp: number
}

export interface CombatRoundEvent {
  type: 'combat:round'
  combatId: string
  agentId: string
  monsterId: string
  round: CombatRound
  timestamp: number
}

export interface CombatEndedEvent {
  type: 'combat:ended'
  combatId: string
  agentId: string
  monsterId: string
  outcome: CombatOutcome
  loot: Item[]
  xpGained: number
  timestamp: number
}

export interface MonsterSpawnedEvent {
  type: 'monster:spawned'
  monsterId: string
  monsterType: MonsterType
  name: string
  level: number
  position: Position
  timestamp: number
}

export interface MonsterDiedEvent {
  type: 'monster:died'
  monsterId: string
  monsterType: MonsterType
  killedBy: string
  position: Position
  timestamp: number
}

// ── Item System Events ──

export interface ItemNamingCandidateEvent {
  type: 'item:naming_candidate'
  itemId: string
  reason: string
  timestamp: number
}

export interface ItemNamedEvent {
  type: 'item:named'
  itemId: string
  customName: string
  quality: string
  namedBy?: string
  timestamp: number
}

export interface ItemDestroyedEvent {
  type: 'item:destroyed'
  itemId: string
  itemName: string
  quality: string
  reason: string
  timestamp: number
}

export interface ItemMasterworkCreatedEvent {
  type: 'item:masterwork_created'
  itemId: string
  itemName: string
  customName: string
  quality: string
  crafterName: string
  timestamp: number
}

// ── Relationship Events ──

export interface RelationshipChangedEvent {
  type: 'relationship:changed'
  fromId: string
  toId: string
  interaction: RelationshipInteraction
  trustDelta: number
  respectDelta: number
  affectionDelta: number
  newTags: RelationshipTag[]
  timestamp: number
}

export interface RumorCreatedEvent {
  type: 'rumor:created'
  rumorId: string
  rumorType: RumorType
  aboutId: string
  originatedFrom: string
  content: string
  timestamp: number
}

export interface RumorSpreadEvent {
  type: 'rumor:spread'
  rumorId: string
  fromAgentId: string
  toAgentId: string
  reliability: number
  timestamp: number
}

export interface SecretRevealedEvent {
  type: 'secret:revealed'
  secretId: string
  secretType: SecretType
  ownerId: string
  revealedBy: string
  content: string
  timestamp: number
}

export interface ReputationChangedEvent {
  type: 'reputation:changed'
  agentId: string
  category: string
  oldValue: number
  newValue: number
  reason: string
  timestamp: number
}

export interface SocialStatusChangedEvent {
  type: 'social_status:changed'
  agentId: string
  oldStatus: SocialStatus
  newStatus: SocialStatus
  timestamp: number
}

// ── Politics Events ──

export interface GuildCreatedEvent {
  type: 'guild:created'
  guildId: string
  guildName: string
  guildType: GuildType
  founderId: string
  memberIds: string[]
  timestamp: number
}

export interface GuildMemberJoinedEvent {
  type: 'guild:member_joined'
  guildId: string
  guildName: string
  agentId: string
  rank: string
  timestamp: number
}

export interface GuildMemberLeftEvent {
  type: 'guild:member_left'
  guildId: string
  guildName: string
  agentId: string
  reason: 'left' | 'kicked' | 'betrayed'
  timestamp: number
}

export interface GuildDramaEvent {
  type: 'guild:drama'
  guildId: string
  guildName: string
  dramaType: 'coup' | 'split' | 'merge' | 'betrayal'
  description: string
  involvedAgentIds: string[]
  timestamp: number
}

export interface SettlementCreatedEvent {
  type: 'settlement:created'
  settlementId: string
  settlementName: string
  settlementType: SettlementType
  poiId: string
  timestamp: number
}

export interface SettlementGrewEvent {
  type: 'settlement:grew'
  settlementId: string
  settlementName: string
  oldType: SettlementType
  newType: SettlementType
  population: number
  timestamp: number
}

export interface ElectionStartedEvent {
  type: 'election:started'
  settlementId: string
  settlementName: string
  candidates: { agentId: string; platform: string }[]
  timestamp: number
}

export interface ElectionEndedEvent {
  type: 'election:ended'
  settlementId: string
  settlementName: string
  winnerId: string
  winnerName: string
  voteCount: number
  totalVotes: number
  timestamp: number
}

export interface SettlementLawEnactedEvent {
  type: 'settlement:law_enacted'
  settlementId: string
  settlementName: string
  lawType: string
  description: string
  timestamp: number
}

export interface KingdomFoundedEvent {
  type: 'kingdom:founded'
  kingdomId: string
  kingdomName: string
  rulerId: string
  rulerName: string
  settlementIds: string[]
  timestamp: number
}

export interface TreatySignedEvent {
  type: 'treaty:signed'
  treatyId: string
  treatyType: TreatyType
  partyAId: string
  partyAName: string
  partyBId: string
  partyBName: string
  terms: string[]
  timestamp: number
}

export interface WarDeclaredEvent {
  type: 'war:declared'
  warId: string
  attackerId: string
  attackerName: string
  defenderId: string
  defenderName: string
  casusBelli: string
  goal: WarGoal
  timestamp: number
}

export interface WarEndedEvent {
  type: 'war:ended'
  warId: string
  winnerId: string | null
  terms: string[] | null
  timestamp: number
}

// ── History Events ──

export interface HistoryRecordedEvent {
  type: 'history:recorded'
  entryId: string
  historyType: HistoryEventType
  title: string
  significance: number
  timestamp: number
}

// ── Culture Events ──

export interface CultureGeneratedEvent {
  type: 'culture:generated'
  settlementId: string
  settlementName: string
  timestamp: number
}

// ── Ecosystem Events ──

export interface SeasonChangedEvent {
  type: 'season:changed'
  oldSeason: Season
  newSeason: Season
  day: number
  timestamp: number
}

export interface AnimalSpawnedEvent {
  type: 'animal:spawned'
  animalId: string
  animalType: AnimalType
  position: { x: number; y: number }
  timestamp: number
}

export interface AnimalDiedEvent {
  type: 'animal:died'
  animalId: string
  animalType: AnimalType
  killedBy: string | null
  loot: string[]
  timestamp: number
}

export interface ResourceStateChangedEvent {
  type: 'resource:state_changed'
  tileKey: string
  oldState: string
  newState: string
  timestamp: number
}

// ── Building Events ──

export interface BuildingConstructionStartedEvent {
  type: 'building:construction_started'
  buildingId: string
  buildingName: string
  buildingType: BuildingType
  builderId: string
  position: Position
  timestamp: number
}

export interface BuildingConstructionCompletedEvent {
  type: 'building:construction_completed'
  buildingId: string
  buildingName: string
  buildingType: BuildingType
  position: Position
  timestamp: number
}

export interface BuildingUpgradedEvent {
  type: 'building:upgraded'
  buildingId: string
  buildingName: string
  buildingType: BuildingType
  oldLevel: number
  newLevel: number
  timestamp: number
}

export interface BuildingDamagedEvent {
  type: 'building:damaged'
  buildingId: string
  buildingName: string
  damage: number
  currentHp: number
  maxHp: number
  source: string   // who/what caused damage
  timestamp: number
}

export interface BuildingDestroyedEvent {
  type: 'building:destroyed'
  buildingId: string
  buildingName: string
  buildingType: BuildingType
  destroyedBy: string
  position: Position
  timestamp: number
}

export interface BuildingRepairedEvent {
  type: 'building:repaired'
  buildingId: string
  buildingName: string
  repairedBy: string
  hpRestored: number
  timestamp: number
}

export interface SiegeStartedEvent {
  type: 'siege:started'
  siegeId: string
  attackerId: string   // kingdom/guild ID
  defenderId: string   // settlement ID
  position: Position
  timestamp: number
}

export interface SiegeEndedEvent {
  type: 'siege:ended'
  siegeId: string
  result: 'attacker_won' | 'defender_won' | 'draw' | 'abandoned'
  timestamp: number
}
