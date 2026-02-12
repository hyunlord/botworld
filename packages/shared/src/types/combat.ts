import type { Position } from './world.js'
import type { Item } from './item.js'

// ── Monster Types ──

export type MonsterType =
  | 'slime' | 'rat' | 'bat' | 'skeleton' | 'zombie'
  | 'goblin' | 'goblin_shaman' | 'goblin_chief'
  | 'orc_warrior' | 'orc_berserker'
  | 'bandit' | 'bandit_leader'
  | 'harpy' | 'troll' | 'ghost' | 'wraith'
  | 'ogre' | 'wyvern' | 'basilisk' | 'minotaur' | 'lich'
  | 'dragon_whelp' | 'dragon' | 'ancient_golem'
  | 'world_serpent' | 'demon_lord'

export interface LootEntry {
  itemType: string
  chance: number // 0-1
  quantityMin: number
  quantityMax: number
}

export interface Monster {
  id: string
  type: MonsterType
  name: string
  level: number
  hp: number
  maxHp: number
  attack: number
  defense: number
  position: Position
  loot: LootEntry[]
  aggroRadius: number
  respawnTicks: number
  isDead: boolean
  deathTick: number | null
}

// ── Combat State ──

export type CombatOutcome = 'victory' | 'defeat' | 'fled'

export interface CombatRound {
  round: number
  agentDamage: number
  monsterDamage: number
  agentHp: number
  monsterHp: number
  description: string
}

export interface CombatState {
  id: string
  agentId: string
  monsterId: string
  monsterType: MonsterType
  monsterName: string
  rounds: CombatRound[]
  outcome: CombatOutcome | null
  lootDropped: Item[]
  startedAt: number
}

// ── Monster Templates ──

export interface MonsterTemplate {
  type: MonsterType
  name: string
  baseHp: number
  baseAttack: number
  baseDefense: number
  aggroRadius: number
  respawnTicks: number
  loot: LootEntry[]
  /** Min level to spawn */
  minLevel: number
  /** Spawn weight (higher = more common) */
  weight: number
}
