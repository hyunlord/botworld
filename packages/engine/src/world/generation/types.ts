import type { Tile, TileType, Position } from '@botworld/shared'

export type NoiseMap = Float32Array

export interface BiomeRule {
  biome: string
  tileType: TileType
  elevMin: number
  elevMax: number
  tempMin: number
  tempMax: number
  moistMin: number
  moistMax: number
}

export interface GenerationResult {
  tiles: Tile[][]
  pois: PointOfInterest[]
}

export interface PointOfInterest {
  name: string
  type: 'marketplace' | 'tavern' | 'workshop' | 'library' | 'farm' | 'mine'
  position: Position
  biome?: string
}
