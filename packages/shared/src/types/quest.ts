import type { Position } from './world.js'

export type QuestType =
  | 'gather'
  | 'deliver'
  | 'explore'
  | 'craft'
  | 'social'
  | 'trade'
  | 'hunt'
  | 'escort'

export type QuestDifficulty = 'easy' | 'medium' | 'hard'

export type QuestStatus = 'available' | 'active' | 'completed' | 'failed' | 'expired'

export interface QuestObjective {
  id: string
  type: QuestType
  description: string
  /** e.g. resource type, item name, or agent count */
  target: string
  /** Required amount (e.g. 5 wood, 3 conversations) */
  required: number
  /** Current progress */
  current: number
  /** Target position for explore/deliver quests */
  targetPosition?: Position
}

export interface QuestReward {
  xp: number
  gold?: number
  items?: { name: string; type: string; quantity: number }[]
  skillPoints?: { skill: string; amount: number }
}

export interface Quest {
  id: string
  type: QuestType
  title: string
  /** Description the bot can read and understand */
  description: string
  objectives: QuestObjective[]
  rewards: QuestReward
  difficulty: QuestDifficulty
  /** Time limit in game ticks (undefined = unlimited) */
  timeLimit?: number
  /** Minimum agent level to accept */
  requiredLevel?: number
  /** NPC id who gives this quest */
  giver: string
  /** Tick when quest was created */
  createdAt: number
}

export interface ActiveQuest {
  quest: Quest
  agentId: string
  status: QuestStatus
  acceptedAt: number
  completedAt?: number
  /** Per-objective progress */
  objectives: QuestObjective[]
}
