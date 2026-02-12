import type { Agent, AgentAction, Memory } from './agent.js'
import type { Position, WorldClock, WeatherState } from './world.js'
import type { Item, MarketOrder } from './item.js'
import type { CharacterAppearance, CharacterClass, Race } from './character.js'
import type { WorldEventType, WorldEventCategory, WorldEventEffect } from './world-event.js'
import type { MonsterType, CombatRound, CombatOutcome, CombatType, CombatActionType, BodyPartType, ConditionType, FormationType, CombatSide, CombatRole } from './combat.js'
import type { RelationshipInteraction, RelationshipTag, RumorType, SecretType, SocialStatus } from './relationship.js'
import type { GuildType, SettlementType, DiplomacyStatus, TreatyType, WarGoal } from './politics.js'
import type { HistoryEventType } from './history.js'
import type { Season, AnimalType, CreatureType, CreatureTier, DenType } from './ecosystem.js'
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
  | CreatureSpawnedEvent
  | CreatureDiedEvent
  | PackFormedEvent
  | PackHuntEvent
  | PackDisbandedEvent
  | DenDiscoveredEvent
  | DenClearedEvent
  | DenRespawnedEvent
  | AdvancedCombatStartedEvent
  | AdvancedCombatRoundEvent
  | AdvancedCombatEndedEvent
  | BodyPartDisabledEvent
  | ConditionAppliedEvent
  | FormationChangedEvent
  | CombatSurrenderEvent
  | SiegeCombatPhaseEvent

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

// ── Creature Events ──

export interface CreatureSpawnedEvent {
  type: 'creature:spawned'
  creatureId: string
  templateId: string
  creatureType: CreatureType
  tier: CreatureTier
  name: string
  position: Position
  timestamp: number
}

export interface CreatureDiedEvent {
  type: 'creature:died'
  creatureId: string
  templateId: string
  name: string
  killedBy: string | null
  loot: string[]
  position: Position
  timestamp: number
}

export interface PackFormedEvent {
  type: 'pack:formed'
  packId: string
  packType: string
  leaderId: string
  memberCount: number
  territory: { x: number; y: number }
  timestamp: number
}

export interface PackHuntEvent {
  type: 'pack:hunt'
  packId: string
  packType: string
  targetId: string
  targetName: string
  position: Position
  timestamp: number
}

export interface PackDisbandedEvent {
  type: 'pack:disbanded'
  packId: string
  packType: string
  reason: string
  timestamp: number
}

export interface DenDiscoveredEvent {
  type: 'den:discovered'
  denId: string
  denType: DenType
  name: string
  tier: CreatureTier
  position: Position
  discoveredBy: string
  timestamp: number
}

export interface DenClearedEvent {
  type: 'den:cleared'
  denId: string
  denType: DenType
  name: string
  clearedBy: string
  bossName?: string
  timestamp: number
}

export interface DenRespawnedEvent {
  type: 'den:respawned'
  denId: string
  denType: DenType
  name: string
  newTier: CreatureTier
  timestamp: number
}

// ── Advanced Combat Events ──

export interface AdvancedCombatStartedEvent {
  type: 'advanced_combat:started'
  combatId: string
  combatType: CombatType
  terrain: string
  attackerNames: string[]
  defenderNames: string[]
  attackerFormation: FormationType
  defenderFormation: FormationType
  position: Position
  timestamp: number
}

export interface AdvancedCombatRoundEvent {
  type: 'advanced_combat:round'
  combatId: string
  round: number
  actions: {
    actorName: string
    actionType: CombatActionType
    targetName?: string
    bodyPart?: BodyPartType
    damage: number
    hit: boolean
    critical: boolean
    conditionApplied?: ConditionType
    description: string
  }[]
  timestamp: number
}

export interface AdvancedCombatEndedEvent {
  type: 'advanced_combat:ended'
  combatId: string
  combatType: CombatType
  winningSide: CombatSide | 'draw'
  survivors: { name: string; hpRemaining: number }[]
  casualties: { name: string; side: CombatSide }[]
  duration: number
  summary: string
  timestamp: number
}

export interface BodyPartDisabledEvent {
  type: 'combat:body_part_disabled'
  combatId: string
  participantId: string
  participantName: string
  bodyPart: BodyPartType
  disabledBy: string
  timestamp: number
}

export interface ConditionAppliedEvent {
  type: 'combat:condition_applied'
  combatId: string
  targetId: string
  targetName: string
  condition: ConditionType
  appliedBy: string
  duration: number
  timestamp: number
}

export interface FormationChangedEvent {
  type: 'combat:formation_changed'
  combatId: string
  side: CombatSide
  oldFormation: FormationType
  newFormation: FormationType
  commanderName: string
  timestamp: number
}

export interface CombatSurrenderEvent {
  type: 'combat:surrender'
  combatId: string
  surrenderId: string
  surrenderName: string
  acceptedBy?: string
  timestamp: number
}

export interface SiegeCombatPhaseEvent {
  type: 'siege_combat:phase'
  siegeId: string
  phase: 'bombardment' | 'breach' | 'urban_combat' | 'surrender'
  description: string
  wallHp?: number
  gateHp?: number
  timestamp: number
}
