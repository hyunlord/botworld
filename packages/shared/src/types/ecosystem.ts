// ──────────────────────────────────────────────
// Ecosystem — resource regeneration, animals, seasons
// ──────────────────────────────────────────────

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export type ResourceState = 'mature' | 'stump' | 'sapling' | 'depleted' | 'regrowing'

export type AnimalType = 'rabbit' | 'deer' | 'wolf' | 'boar' | 'chicken' | 'cow' | 'fish'

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
