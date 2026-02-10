import type { Tile, Position, ResourceType } from '@botworld/shared'
import { DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT } from '@botworld/shared'
import { generateWorld } from './generation/pipeline.js'
import type { PointOfInterest } from './generation/types.js'

export type { PointOfInterest }

export class TileMap {
  readonly width: number
  readonly height: number
  readonly pois: PointOfInterest[] = []
  private tiles: Tile[][]
  private seed: number

  constructor(width = DEFAULT_MAP_WIDTH, height = DEFAULT_MAP_HEIGHT, seed?: number) {
    this.width = width
    this.height = height
    this.seed = seed ?? Math.floor(Math.random() * 100000)

    const result = generateWorld(this.width, this.height, this.seed)
    this.tiles = result.tiles
    this.pois.push(...result.pois)
  }

  getTile(x: number, y: number): Tile | null {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null
    return this.tiles[y][x]
  }

  isWalkable(x: number, y: number): boolean {
    const tile = this.getTile(x, y)
    return tile !== null && tile.walkable
  }

  getNeighbors(pos: Position): Position[] {
    const dirs = [
      { x: 0, y: -1 }, { x: 0, y: 1 },
      { x: -1, y: 0 }, { x: 1, y: 0 },
      { x: -1, y: -1 }, { x: 1, y: -1 },
      { x: -1, y: 1 }, { x: 1, y: 1 },
    ]
    return dirs
      .map(d => ({ x: pos.x + d.x, y: pos.y + d.y }))
      .filter(p => this.isWalkable(p.x, p.y))
  }

  harvestResource(x: number, y: number, amount: number): { type: ResourceType; harvested: number } | null {
    const tile = this.getTile(x, y)
    if (!tile?.resource || tile.resource.amount < 1) return null

    const harvested = Math.round(Math.min(amount, tile.resource.amount))
    tile.resource.amount -= harvested
    return { type: tile.resource.type, harvested }
  }

  tickResources(): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const tile = this.tiles[y][x]
        if (tile.resource && tile.resource.amount < tile.resource.maxAmount) {
          tile.resource.amount = Math.min(
            tile.resource.maxAmount,
            tile.resource.amount + tile.resource.regenRate,
          )
        }
      }
    }
  }

  getSerializable() {
    return {
      width: this.width,
      height: this.height,
      tiles: this.tiles,
    }
  }
}
