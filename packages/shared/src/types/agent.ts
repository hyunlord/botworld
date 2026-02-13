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
  | 'melee'
  | 'ranged'
  | 'defense'
  | 'tactics'
  | 'smithing'
  | 'woodworking'
  | 'alchemy'
  | 'enchanting'
  | 'tailoring'
  | 'fire'
  | 'ice'
  | 'heal'
  | 'summon'
  | 'arcane'
  | 'dark'
  | 'charisma'
  | 'deception'
  | 'navigation'
  | 'hunting'
  | 'stealth'
  | 'lore'

export type OrgRank = 'leader' | 'officer' | 'member' | 'recruit'

export type NpcRole = 'merchant' | 'innkeeper' | 'guild_master' | 'wanderer' | 'guard' | 'blacksmith' | 'scholar' | 'farmer' | 'priest'

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
  | 'attack'
  | 'flee'
  | 'build'
  | 'give'
  | 'cast'
  | 'meditate'
  | 'teach'
  | 'learn'

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
  attack: number
  defense: number
  mana: number
  maxMana: number
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
  equipment?: Record<string, string>  // slot → itemId (e.g. weapon, armor, shield)
  unconsciousUntil?: number           // tick when agent revives from knockout
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
