// ──────────────────────────────────────────────
// Ecosystem — resource regeneration, animals, seasons
// ──────────────────────────────────────────────

import type { LootEntry } from './combat.js'

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export type ResourceState = 'mature' | 'stump' | 'sapling' | 'depleted' | 'regrowing'

export type AnimalType =
  | 'rabbit' | 'chicken' | 'cow' | 'sheep' | 'fish' | 'butterfly'
  | 'deer' | 'boar' | 'bear' | 'eagle' | 'horse' | 'wolf'
  | 'giant_spider' | 'dire_wolf' | 'griffin'

export interface AnimalInstance {
  id: string
  type: AnimalType
  position: { x: number; y: number }
  hp: number
  maxHp: number
  hostile: boolean
  spawnedAt: number
}

export interface SeasonalModifiers {
  cropGrowthMultiplier: number
  gatheringMultiplier: number
  energyCostMultiplier: number
  herbAvailable: boolean
  foodPriceMultiplier: number
  /** Visual hint for client */
  visualOverlay: string
}

export interface ResourceRegenEntry {
  /** Tile key "x,y" */
  key: string
  originalType: string
  currentState: ResourceState
  stateChangedAt: number
  /** Tick when next state transition occurs */
  nextTransitionAt: number
}

export function getSeasonFromDay(day: number): Season {
  // 1 season = 7 game days, 4 seasons = 28 day cycle
  const seasonIndex = Math.floor((day % 28) / 7)
  const seasons: Season[] = ['spring', 'summer', 'autumn', 'winter']
  return seasons[seasonIndex]
}

export function getSeasonalModifiers(season: Season): SeasonalModifiers {
  switch (season) {
    case 'spring':
      return {
        cropGrowthMultiplier: 2.0,
        gatheringMultiplier: 1.0,
        energyCostMultiplier: 1.0,
        herbAvailable: true,
        foodPriceMultiplier: 0.9,
        visualOverlay: 'spring_bloom',
      }
    case 'summer':
      return {
        cropGrowthMultiplier: 1.0,
        gatheringMultiplier: 1.5,
        energyCostMultiplier: 1.1,
        herbAvailable: true,
        foodPriceMultiplier: 0.8,
        visualOverlay: 'summer_heat',
      }
    case 'autumn':
      return {
        cropGrowthMultiplier: 0.5,
        gatheringMultiplier: 1.0,
        energyCostMultiplier: 1.0,
        herbAvailable: true,
        foodPriceMultiplier: 0.7,
        visualOverlay: 'autumn_leaves',
      }
    case 'winter':
      return {
        cropGrowthMultiplier: 0,
        gatheringMultiplier: 0.5,
        energyCostMultiplier: 1.3,
        herbAvailable: false,
        foodPriceMultiplier: 1.8,
        visualOverlay: 'winter_snow',
      }
  }
}

// ── Creature Unified Types ──

export type CreatureType = 'animal' | 'monster' | 'beast' | 'undead' | 'demon' | 'dragon' | 'elemental'
export type CreatureBehavior = 'passive' | 'neutral' | 'territorial' | 'aggressive' | 'predator' | 'boss'
export type CreatureState = 'roaming' | 'hunting' | 'resting' | 'guarding' | 'fleeing' | 'dead'
export type CreatureTier = 1 | 2 | 3 | 4 | 5
export type ActiveTime = 'day' | 'night' | 'both'

export interface Creature {
  id: string
  templateId: string
  name: string
  customName?: string
  tier: CreatureTier
  creatureType: CreatureType
  behavior: CreatureBehavior
  position: { x: number; y: number }
  hp: number
  maxHp: number
  attack: number
  defense: number
  speed: number
  stats: {
    strength: number
    agility: number
    intelligence: number
    perception: number
  }
  lootTable: LootEntry[]
  habitat: string[]
  activeTime: ActiveTime
  packId?: string
  denId?: string
  respawnTick?: number
  state: CreatureState
  lastActionTick: number
  // Animal-specific
  isAnimal: boolean
  canBeTamed?: boolean
  produces?: { item: string; interval: number; lastProduced: number }
  // Monster-specific
  abilities?: string[]
  weaknesses?: string[]
  immunities?: string[]
}

// ── Pack Types ──

export interface Pack {
  id: string
  packType: 'wolf_pack' | 'goblin_tribe' | 'orc_warband' | 'bandit_gang'
  leaderId: string
  memberIds: string[]
  territoryCenter: { x: number; y: number }
  territoryRadius: number
  morale: number  // 0-100
  state: 'idle' | 'hunting' | 'patrolling' | 'raiding' | 'fleeing' | 'resting'
  targetId?: string
  lastActionTick: number
}

// ── Den Types ──

export type DenType =
  | 'goblin_camp' | 'wolf_den' | 'bandit_hideout' | 'spider_nest'
  | 'orc_fortress' | 'undead_crypt' | 'dragon_lair' | 'ancient_ruins_dungeon'

export interface DenRoom {
  id: string
  name: string
  floor: number
  connections: string[]  // room IDs
  creatures: string[]    // creature IDs
  loot: { itemType: string; quantity: number }[]
  traps: { type: string; damage: number; disarmDifficulty: number }[]
  isBossRoom: boolean
  isCleared: boolean
}

export interface Den {
  id: string
  denType: DenType
  name: string
  position: { x: number; y: number }
  tier: CreatureTier
  rooms: DenRoom[]
  bossId?: string
  creatureIds: string[]
  discovered: boolean
  cleared: boolean
  respawnTimer: number
  respawnAt?: number
  lastClearedAt?: number
}

// ── Biome Spawn Config ──

export interface BiomeSpawnEntry {
  templateId: string
  weight: number
  minTier: CreatureTier
  maxTier: CreatureTier
  timeRestriction?: ActiveTime
}

export type BiomeSpawnTable = Record<string, BiomeSpawnEntry[]>
