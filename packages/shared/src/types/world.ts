export interface Position {
  x: number
  y: number
}

export type TileType =
  | 'grass'
  | 'water'
  | 'deep_water'
  | 'mountain'
  | 'forest'
  | 'dense_forest'
  | 'sand'
  | 'snow'
  | 'swamp'
  | 'road'
  | 'building'
  | 'farmland'

export type ResourceType =
  | 'wood'
  | 'stone'
  | 'iron'
  | 'food'
  | 'gold'
  | 'herb'

export interface Tile {
  id: string
  type: TileType
  position: Position
  walkable: boolean
  movementCost: number
  biome?: string
  resource?: {
    type: ResourceType
    amount: number
    maxAmount: number
    regenRate: number
  }
  ownerId?: string
  buildingId?: string
  variant?: number
  decoration?: string
  poiType?: ChunkPOI['type']
}

export interface ChunkCoord {
  cx: number
  cy: number
}

export type POIType = 'marketplace' | 'tavern' | 'workshop' | 'library' | 'farm' | 'mine'

export interface ChunkPOI {
  name: string
  type: POIType
  localX: number
  localY: number
  biome?: string
}

export interface ChunkData {
  cx: number
  cy: number
  tiles: Tile[][]
  poi?: ChunkPOI
  generated: boolean
}

/** @deprecated Use chunks-based state instead */
export interface WorldMap {
  width: number
  height: number
  tiles: Tile[][]
}

export type TimeOfDay = 'dawn' | 'morning' | 'noon' | 'afternoon' | 'evening' | 'night'

export type WeatherType = 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog'

export interface WeatherState {
  current: WeatherType
  /** Tick when the current weather started */
  since: number
  /** Tick when weather will next change */
  nextChange: number
  /** Wind intensity 0-1 (affects particle angle) */
  windIntensity: number
}

/** Gameplay modifiers applied by weather */
export interface WeatherModifiers {
  movementSpeedMultiplier: number
  gatherSpeedMultiplier: number
  energyCostMultiplier: number
  visionRadius: number | null
  outdoorGatheringBlocked: boolean
}

export interface WorldClock {
  tick: number
  day: number
  timeOfDay: TimeOfDay
  /** 0-1 representing position in the day cycle */
  dayProgress: number
}
