import type { Tile, TileType, Position, ResourceType } from '@botworld/shared'
import { DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT, generateId } from '@botworld/shared'

export interface PointOfInterest {
  name: string
  type: 'marketplace' | 'tavern' | 'workshop' | 'library' | 'farm' | 'mine'
  position: Position
}

export class TileMap {
  readonly width: number
  readonly height: number
  readonly pois: PointOfInterest[] = []
  private tiles: Tile[][]
  private seed: number

  constructor(width = DEFAULT_MAP_WIDTH, height = DEFAULT_MAP_HEIGHT) {
    this.width = width
    this.height = height
    this.seed = Math.floor(Math.random() * 100000)
    this.tiles = this.generateMap()
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
    if (!tile?.resource || tile.resource.amount <= 0) return null

    const harvested = Math.min(amount, tile.resource.amount)
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

  /** Simple hash-based value noise (deterministic, no deps) */
  private noise2d(x: number, y: number, scale: number): number {
    const nx = x / scale
    const ny = y / scale
    const ix = Math.floor(nx)
    const iy = Math.floor(ny)
    const fx = nx - ix
    const fy = ny - iy

    const n00 = this.hash(ix, iy)
    const n10 = this.hash(ix + 1, iy)
    const n01 = this.hash(ix, iy + 1)
    const n11 = this.hash(ix + 1, iy + 1)

    // Smoothstep interpolation
    const sx = fx * fx * (3 - 2 * fx)
    const sy = fy * fy * (3 - 2 * fy)

    const n0 = n00 + (n10 - n00) * sx
    const n1 = n01 + (n11 - n01) * sx
    return n0 + (n1 - n0) * sy
  }

  private hash(x: number, y: number): number {
    let h = this.seed + x * 374761393 + y * 668265263
    h = (h ^ (h >> 13)) * 1274126177
    h = h ^ (h >> 16)
    return (h & 0x7fffffff) / 0x7fffffff
  }

  private generateMap(): Tile[][] {
    const tiles: Tile[][] = []
    const cx = this.width / 2
    const cy = this.height / 2

    for (let y = 0; y < this.height; y++) {
      const row: Tile[] = []
      for (let x = 0; x < this.width; x++) {
        row.push(this.generateTile(x, y, cx, cy))
      }
      tiles.push(row)
    }

    // Place named locations
    this.placePOIs(tiles, cx, cy)

    // Post-process: sand near water, stone near mountains
    this.addTransitionTiles(tiles)

    return tiles
  }

  private generateTile(x: number, y: number, cx: number, cy: number): Tile {
    const type = this.pickTileType(x, y, cx, cy)
    const tile: Tile = {
      id: generateId('tile'),
      type,
      position: { x, y },
      walkable: type !== 'water' && type !== 'mountain',
    }

    if (type === 'forest') {
      tile.resource = { type: 'wood', amount: 10, maxAmount: 10, regenRate: 0.01 }
    } else if (type === 'farmland') {
      tile.resource = { type: 'food', amount: 5, maxAmount: 5, regenRate: 0.02 }
    }

    return tile
  }

  private pickTileType(x: number, y: number, cx: number, cy: number): TileType {
    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)

    // Multi-octave noise for terrain variety
    const elevation = this.noise2d(x, y, 8) * 0.6
      + this.noise2d(x, y, 4) * 0.3
      + this.noise2d(x, y, 2) * 0.1

    const moisture = this.noise2d(x + 100, y + 100, 6) * 0.7
      + this.noise2d(x + 100, y + 100, 3) * 0.3

    // Town center
    if (dist < 3) {
      const townNoise = this.noise2d(x + 50, y + 50, 2)
      if (townNoise < 0.35) return 'road'
      if (townNoise < 0.5) return 'building'
      return 'grass'
    }

    // Roads leading out of town (cardinal directions)
    if (dist < 6 && (Math.abs(x - cx) < 1 || Math.abs(y - cy) < 1) && this.noise2d(x, y, 1.5) > 0.4) {
      return 'road'
    }

    // Farmland ring
    if (dist >= 4 && dist < 8 && moisture > 0.5) {
      return 'farmland'
    }

    // Water (low elevation + high moisture, away from center)
    if (elevation < 0.25 && moisture > 0.6 && dist > 6) {
      return 'water'
    }

    // Mountains (high elevation, far from center)
    if (elevation > 0.7 && dist > 8) {
      return 'mountain'
    }

    // Forest (medium-high moisture, medium elevation)
    if (moisture > 0.45 && elevation > 0.35 && elevation < 0.7 && dist > 5) {
      return 'forest'
    }

    // Sand near water-prone areas
    if (elevation < 0.3 && moisture > 0.5 && dist > 5) {
      return 'sand'
    }

    return 'grass'
  }

  private placePOIs(tiles: Tile[][], cx: number, cy: number): void {
    const poiDefs: { name: string; type: PointOfInterest['type']; dx: number; dy: number }[] = [
      { name: 'Town Market', type: 'marketplace', dx: 1, dy: -1 },
      { name: 'The Rusty Tankard', type: 'tavern', dx: -2, dy: 0 },
      { name: 'Blacksmith Workshop', type: 'workshop', dx: 2, dy: 1 },
      { name: 'Village Library', type: 'library', dx: 0, dy: -2 },
      { name: 'South Farm', type: 'farm', dx: -1, dy: 3 },
      { name: 'Mountain Mine', type: 'mine', dx: 5, dy: -5 },
    ]

    for (const def of poiDefs) {
      const px = Math.round(cx + def.dx)
      const py = Math.round(cy + def.dy)
      if (px >= 0 && px < this.width && py >= 0 && py < this.height) {
        tiles[py][px].type = 'building'
        tiles[py][px].walkable = true
        this.pois.push({ name: def.name, type: def.type, position: { x: px, y: py } })

        if (def.type === 'mine') {
          tiles[py][px].resource = { type: 'iron', amount: 15, maxAmount: 15, regenRate: 0.005 }
        }
      }
    }
  }

  private addTransitionTiles(tiles: Tile[][]): void {
    // Sand adjacent to water (beach effect)
    const sandPositions: Position[] = []
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (tiles[y][x].type !== 'water') continue
        for (const d of [{ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }]) {
          const nx = x + d.x
          const ny = y + d.y
          if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
            const neighbor = tiles[ny][nx]
            if (neighbor.type === 'grass' && !neighbor.resource) {
              sandPositions.push({ x: nx, y: ny })
            }
          }
        }
      }
    }
    for (const pos of sandPositions) {
      tiles[pos.y][pos.x].type = 'sand'
    }

    // Stone resources near mountains
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (tiles[y][x].type !== 'mountain') continue
        for (const d of [{ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }]) {
          const nx = x + d.x
          const ny = y + d.y
          if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
            const neighbor = tiles[ny][nx]
            if (neighbor.walkable && !neighbor.resource && this.hash(nx * 7, ny * 13) < 0.3) {
              neighbor.resource = { type: 'stone', amount: 8, maxAmount: 8, regenRate: 0.005 }
            }
          }
        }
      }
    }
  }
}
