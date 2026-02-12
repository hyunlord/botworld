import type { Tile, TileType, Position, LandmarkType } from '@botworld/shared'

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

export interface LandmarkDef {
  type: LandmarkType
  name: string
  centerX: number
  centerY: number
  radius: number
}
