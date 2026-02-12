import type { Agent, AgentAction, Memory } from './agent.js'
import type { Position, WorldClock, WeatherState } from './world.js'
import type { Item, MarketOrder } from './item.js'
import type { CharacterAppearance, CharacterClass, Race } from './character.js'
import type { WorldEventType, WorldEventCategory, WorldEventEffect } from './world-event.js'
import type { MonsterType, CombatRound, CombatOutcome } from './combat.js'
import type { RelationshipInteraction, RelationshipTag, RumorType, SecretType, SocialStatus } from './relationship.js'

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
