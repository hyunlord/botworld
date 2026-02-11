import type { Agent, AgentAction, Memory } from './agent.js'
import type { Position, WorldClock } from './world.js'
import type { Item, MarketOrder } from './item.js'
import type { CharacterAppearance, Race } from './character.js'

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
