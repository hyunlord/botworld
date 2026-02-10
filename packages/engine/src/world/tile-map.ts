import type { Tile, Position, ResourceType, ChunkData } from '@botworld/shared'
import { CHUNK_SIZE, INITIAL_CHUNK_RADIUS, LOAD_DISTANCE_CHUNKS, MOVEMENT_COSTS } from '@botworld/shared'
import { generateChunk } from './generation/chunk-generator.js'
import type { PointOfInterest } from './generation/types.js'

export type { PointOfInterest }

function chunkKeyStr(cx: number, cy: number): string {
  return `${cx},${cy}`
}

export class TileMap {
  readonly pois: PointOfInterest[] = []
  readonly seed: number
  private chunks = new Map<string, ChunkData>()

  constructor(seed?: number) {
    this.seed = seed ?? Math.floor(Math.random() * 100000)
    this.generateInitialChunks()
  }

  // --- Chunk lifecycle ---

  private generateInitialChunks(): void {
    const R = INITIAL_CHUNK_RADIUS
    const t0 = Date.now()

    // Phase 1: Generate all chunks without roads
    for (let cy = -R; cy <= R; cy++) {
      for (let cx = -R; cx <= R; cx++) {
        const chunk = generateChunk(cx, cy, this.seed)
        this.chunks.set(chunkKeyStr(cx, cy), chunk)
        if (chunk.poi) this.registerPOI(chunk)
      }
    }

    // Phase 2: Build road network between initial POIs
    this.buildInitialRoads()

    const elapsed = Date.now() - t0
    console.log(`[TileMap] Generated ${this.chunks.size} initial chunks in ${elapsed}ms (seed: ${this.seed})`)
    console.log(`[TileMap] POIs: ${this.pois.map(p => `${p.name} (${p.type})`).join(', ')}`)
  }

  private registerPOI(chunk: ChunkData): void {
    if (!chunk.poi) return
    this.pois.push({
      name: chunk.poi.name,
      type: chunk.poi.type,
      position: {
        x: chunk.cx * CHUNK_SIZE + chunk.poi.localX,
        y: chunk.cy * CHUNK_SIZE + chunk.poi.localY,
      },
      biome: chunk.poi.biome,
    })
  }

  private ensureChunk(cx: number, cy: number): ChunkData {
    const key = chunkKeyStr(cx, cy)
    let chunk = this.chunks.get(key)
    if (!chunk) {
      chunk = generateChunk(cx, cy, this.seed)
      this.chunks.set(key, chunk)
      if (chunk.poi) {
        this.registerPOI(chunk)
        this.connectNewPOI(chunk)
      }
    }
    return chunk
  }

  /** Ensure chunks exist around a world position. Returns newly generated chunk keys. */
  ensureChunksAround(worldX: number, worldY: number, radius = LOAD_DISTANCE_CHUNKS): string[] {
    const centerCx = Math.floor(worldX / CHUNK_SIZE)
    const centerCy = Math.floor(worldY / CHUNK_SIZE)
    const newKeys: string[] = []

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const cx = centerCx + dx
        const cy = centerCy + dy
        const key = chunkKeyStr(cx, cy)
        if (!this.chunks.has(key)) {
          this.ensureChunk(cx, cy)
          newKeys.push(key)
        }
      }
    }

    return newKeys
  }

  // --- Coordinate helpers ---

  private worldToChunk(x: number, y: number) {
    const cx = Math.floor(x / CHUNK_SIZE)
    const cy = Math.floor(y / CHUNK_SIZE)
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    const ly = ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
    return { cx, cy, lx, ly }
  }

  // --- Public tile API (preserving existing interface) ---

  getTile(x: number, y: number): Tile | null {
    const { cx, cy, lx, ly } = this.worldToChunk(x, y)
    const chunk = this.ensureChunk(cx, cy)
    return chunk.tiles[ly]?.[lx] ?? null
  }

  /** Get tile only from already-generated chunks (no lazy generation). Used for road building. */
  private getExistingTile(x: number, y: number): Tile | null {
    const { cx, cy, lx, ly } = this.worldToChunk(x, y)
    const chunk = this.chunks.get(chunkKeyStr(cx, cy))
    if (!chunk) return null
    return chunk.tiles[ly]?.[lx] ?? null
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
    for (const chunk of this.chunks.values()) {
      for (const row of chunk.tiles) {
        for (const tile of row) {
          if (tile.resource && tile.resource.amount < tile.resource.maxAmount) {
            tile.resource.amount = Math.min(
              tile.resource.maxAmount,
              tile.resource.amount + tile.resource.regenRate,
            )
          }
        }
      }
    }
  }

  // --- Serialization ---

  getSerializableChunks(keys?: string[]): Record<string, ChunkData> {
    const result: Record<string, ChunkData> = {}
    if (keys) {
      for (const key of keys) {
        const chunk = this.chunks.get(key)
        if (chunk) result[key] = chunk
      }
    } else {
      for (const [key, chunk] of this.chunks) {
        result[key] = chunk
      }
    }
    return result
  }

  getSerializable() {
    return { chunks: this.getSerializableChunks() }
  }

  // --- Road generation ---

  private buildInitialRoads(): void {
    if (this.pois.length < 2) return

    const edges = this.buildMST()

    // Add a few extra short connections for redundancy
    const connected = new Set(edges.map(([a, b]) => `${Math.min(a, b)},${Math.max(a, b)}`))
    let extras = 0
    const maxExtras = Math.min(2, Math.floor(this.pois.length / 3))

    for (let i = 0; i < this.pois.length && extras < maxExtras; i++) {
      for (let j = i + 1; j < this.pois.length && extras < maxExtras; j++) {
        const key = `${i},${j}`
        if (connected.has(key)) continue
        const dx = this.pois[i].position.x - this.pois[j].position.x
        const dy = this.pois[i].position.y - this.pois[j].position.y
        if (Math.sqrt(dx * dx + dy * dy) < 40) {
          edges.push([i, j])
          connected.add(key)
          extras++
        }
      }
    }

    for (const [ai, bi] of edges) {
      this.buildRoad(this.pois[ai].position, this.pois[bi].position)
    }
  }

  private buildMST(): [number, number][] {
    const n = this.pois.length
    if (n < 2) return []

    const inMST = new Set<number>([0])
    const edges: [number, number][] = []

    while (inMST.size < n) {
      let bestDist = Infinity
      let bestFrom = -1
      let bestTo = -1

      for (const from of inMST) {
        for (let to = 0; to < n; to++) {
          if (inMST.has(to)) continue
          const dx = this.pois[from].position.x - this.pois[to].position.x
          const dy = this.pois[from].position.y - this.pois[to].position.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < bestDist) {
            bestDist = dist
            bestFrom = from
            bestTo = to
          }
        }
      }

      if (bestTo === -1) break
      inMST.add(bestTo)
      edges.push([bestFrom, bestTo])
    }

    return edges
  }

  private connectNewPOI(chunk: ChunkData): void {
    if (!chunk.poi) return
    const poiWx = chunk.cx * CHUNK_SIZE + chunk.poi.localX
    const poiWy = chunk.cy * CHUNK_SIZE + chunk.poi.localY

    // Find nearby POIs in already-generated neighboring chunks
    const nearbyPois: Position[] = []
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        if (dx === 0 && dy === 0) continue
        const neighbor = this.chunks.get(chunkKeyStr(chunk.cx + dx, chunk.cy + dy))
        if (neighbor?.poi) {
          nearbyPois.push({
            x: (chunk.cx + dx) * CHUNK_SIZE + neighbor.poi.localX,
            y: (chunk.cy + dy) * CHUNK_SIZE + neighbor.poi.localY,
          })
        }
      }
    }

    nearbyPois.sort((a, b) => {
      const da = Math.abs(a.x - poiWx) + Math.abs(a.y - poiWy)
      const db = Math.abs(b.x - poiWx) + Math.abs(b.y - poiWy)
      return da - db
    })

    for (const target of nearbyPois.slice(0, 2)) {
      this.buildRoad({ x: poiWx, y: poiWy }, target)
    }
  }

  private buildRoad(start: Position, goal: Position): void {
    const path = this.aStarRoad(start, goal)
    for (const pos of path) {
      const tile = this.getExistingTile(pos.x, pos.y)
      if (tile && tile.type !== 'building') {
        tile.type = 'road'
        tile.walkable = true
        tile.movementCost = MOVEMENT_COSTS['road'] ?? 0.5
        tile.biome = tile.biome ?? 'road'
      }
    }
  }

  private aStarRoad(start: Position, goal: Position): Position[] {
    interface Node { x: number; y: number; g: number; f: number; parent: Node | null }

    const open: Node[] = [{
      x: start.x, y: start.y, g: 0,
      f: Math.abs(start.x - goal.x) + Math.abs(start.y - goal.y),
      parent: null,
    }]
    const closed = new Set<string>()
    const maxIter = 5000

    let iter = 0
    while (open.length > 0 && iter++ < maxIter) {
      let bestIdx = 0
      for (let i = 1; i < open.length; i++) {
        if (open[i].f < open[bestIdx].f) bestIdx = i
      }
      const current = open[bestIdx]
      open.splice(bestIdx, 1)

      if (current.x === goal.x && current.y === goal.y) {
        const path: Position[] = []
        let node: Node | null = current
        while (node) {
          path.unshift({ x: node.x, y: node.y })
          node = node.parent
        }
        return path
      }

      const key = `${current.x},${current.y}`
      if (closed.has(key)) continue
      closed.add(key)

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          const nx = current.x + dx
          const ny = current.y + dy
          if (closed.has(`${nx},${ny}`)) continue

          const tile = this.getExistingTile(nx, ny)
          const baseCost = tile
            ? (tile.movementCost <= 0 ? 50.0 : tile.movementCost)
            : 3.0

          const isDiag = dx !== 0 && dy !== 0
          const g = current.g + (isDiag ? 1.414 : 1.0) * baseCost
          const h = Math.abs(nx - goal.x) + Math.abs(ny - goal.y)

          open.push({ x: nx, y: ny, g, f: g + h, parent: current })
        }
      }
    }

    return []
  }
}
