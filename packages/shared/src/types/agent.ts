import type { EmotionState, PersonalityTraits, Relationship } from './emotion.js'
import type { AgentLLMConfig } from './llm.js'
import type { Position } from './world.js'
import type { Item } from './item.js'

export type SkillType =
  | 'gathering'
  | 'crafting'
  | 'combat'
  | 'diplomacy'
  | 'leadership'
  | 'trading'
  | 'farming'
  | 'cooking'

export type OrgRank = 'leader' | 'officer' | 'member' | 'recruit'

export type NpcRole = 'merchant' | 'innkeeper' | 'guild_master' | 'wanderer' | 'guard'

export type ActionType =
  | 'idle'
  | 'move'
  | 'gather'
  | 'craft'
  | 'trade'
  | 'talk'
  | 'speak'
  | 'rest'
  | 'eat'
  | 'quest'
  | 'explore'

export interface AgentAction {
  type: ActionType
  targetPosition?: Position
  targetAgentId?: string
  targetItemId?: string
  data?: Record<string, unknown>
  startedAt: number
  duration: number
}

export interface AgentStats {
  hp: number
  maxHp: number
  energy: number
  maxEnergy: number
  hunger: number
  maxHunger: number
}

export interface Memory {
  id: string
  agentId: string
  description: string
  importance: number
  timestamp: number
  type: 'observation' | 'reflection' | 'plan'
  relatedAgents: string[]
}

export interface Agent {
  id: string
  name: string
  position: Position
  stats: AgentStats
  level: number
  xp: number
  skills: Record<SkillType, number>
  inventory: Item[]
  memories: Memory[]
  relationships: Record<string, Relationship>
  personality: PersonalityTraits
  currentMood: EmotionState
  organizationId?: string
  rank?: OrgRank
  llmConfig?: AgentLLMConfig
  currentAction: AgentAction | null
  bio: string
  isNpc?: boolean
  npcRole?: NpcRole
}

export interface Organization {
  id: string
  name: string
  leaderId: string
  members: { agentId: string; rank: OrgRank }[]
  treasury: number
  territory: string[]
  rules: string[]
  createdAt: number
}
