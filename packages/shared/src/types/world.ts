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
}

export interface WorldMap {
  width: number
  height: number
  tiles: Tile[][]
}

export type TimeOfDay = 'dawn' | 'morning' | 'noon' | 'afternoon' | 'evening' | 'night'

export interface WorldClock {
  tick: number
  day: number
  timeOfDay: TimeOfDay
  /** 0-1 representing position in the day cycle */
  dayProgress: number
}
