import type { Tile, Position, ResourceType, ChunkData, LandmarkType, ChunkLandmark } from '@botworld/shared'
import { CHUNK_SIZE, INITIAL_CHUNK_RADIUS, LOAD_DISTANCE_CHUNKS, MOVEMENT_COSTS } from '@botworld/shared'
import { generateChunk, getWorldElevation } from './generation/chunk-generator.js'
import { SimplexNoise2D } from './generation/noise.js'
import type { PointOfInterest } from './generation/types.js'

export type { PointOfInterest }

function chunkKeyStr(cx: number, cy: number): string {
  return `${cx},${cy}`
}

export class TileMap {
  readonly pois: PointOfInterest[] = []
  readonly landmarks: ChunkLandmark[] = []
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

    // Phase 1: Generate all chunks
    for (let cy = -R; cy <= R; cy++) {
      for (let cx = -R; cx <= R; cx++) {
        const chunk = generateChunk(cx, cy, this.seed)
        this.chunks.set(chunkKeyStr(cx, cy), chunk)
        if (chunk.poi) this.registerPOI(chunk)
      }
    }

    // Phase 2: Rivers (gradient descent from mountain sources)
    this.buildInitialRivers()

    // Phase 3: Lake basin detection + beach placement
    this.detectLakesAndBeaches()

    // Phase 4: Landmark generation
    this.generateLandmarks()

    // Phase 5: Road network between POIs
    this.buildInitialRoads()

    const elapsed = Date.now() - t0
    console.log(`[TileMap] Generated ${this.chunks.size} initial chunks in ${elapsed}ms (seed: ${this.seed})`)
    console.log(`[TileMap] POIs: ${this.pois.map(p => `${p.name} (${p.type})`).join(', ')}`)
    console.log(`[TileMap] Landmarks: ${this.landmarks.map(l => `${l.name} (${l.type})`).join(', ')}`)
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

  // --- Public tile API ---

  getTile(x: number, y: number): Tile | null {
    const { cx, cy, lx, ly } = this.worldToChunk(x, y)
    const chunk = this.ensureChunk(cx, cy)
    return chunk.tiles[ly]?.[lx] ?? null
  }

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

  // ===========================================
  // River generation (v2: widening + direction)
  // ===========================================

  private buildInitialRivers(): void {
    const R = INITIAL_CHUNK_RADIUS
    const S = CHUNK_SIZE
    const minW = -R * S
    const maxW = (R + 1) * S
    const worldW = maxW - minW

    // Build elevation map
    const elevation = new Float32Array(worldW * worldW)
    for (let wy = minW; wy < maxW; wy++) {
      for (let wx = minW; wx < maxW; wx++) {
        const lx = wx - minW
        const ly = wy - minW
        elevation[ly * worldW + lx] = getWorldElevation(wx, wy, this.seed)
      }
    }

    // Find river sources: highland tiles (elevation 0.50-0.68)
    const candidates: { wx: number; wy: number; elev: number }[] = []
    for (let wy = minW + 5; wy < maxW - 5; wy++) {
      for (let wx = minW + 5; wx < maxW - 5; wx++) {
        const lx = wx - minW
        const ly = wy - minW
        const elev = elevation[ly * worldW + lx]
        if (elev >= 0.50 && elev <= 0.68) {
          candidates.push({ wx, wy, elev })
        }
      }
    }

    if (candidates.length === 0) return

    // Seeded shuffle
    let rngState = (this.seed + 4000) | 0
    const rng = () => { rngState = (rngState * 1664525 + 1013904223) | 0; return (rngState >>> 0) / 0xFFFFFFFF }
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      const tmp = candidates[i]; candidates[i] = candidates[j]; candidates[j] = tmp
    }

    // Pick 3-5 sources, spaced at least 20 tiles apart
    const sources: { wx: number; wy: number }[] = []
    const targetCount = Math.floor(rng() * 3) + 3
    for (const c of candidates) {
      if (sources.every(s => Math.sqrt((c.wx - s.wx) ** 2 + (c.wy - s.wy) ** 2) >= 20)) {
        sources.push(c)
        if (sources.length >= targetCount) break
      }
    }

    let totalRiverTiles = 0
    const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]
    const DIR_NAMES = ['NW','W','SW','N','S','NE','E','SE']

    for (const source of sources) {
      let wx = source.wx
      let wy = source.wy
      let width = 1
      let steps = 0
      let uphillStreak = 0
      const visited = new Set<string>()

      while (steps < 400) {
        const key = `${wx},${wy}`
        if (visited.has(key)) break
        visited.add(key)

        const lx = wx - minW
        const ly = wy - minW
        if (lx < 0 || ly < 0 || lx >= worldW || ly >= worldW) break
        const curElev = elevation[ly * worldW + lx]
        if (curElev < 0.20) break // reached ocean

        // Find lowest neighbor for flow direction
        let bestWx = wx, bestWy = wy, bestElev = curElev
        let bestDirIdx = 4 // default S
        for (let d = 0; d < DIRS.length; d++) {
          const nx = wx + DIRS[d][0], ny = wy + DIRS[d][1]
          const nlx = nx - minW, nly = ny - minW
          if (nlx < 0 || nly < 0 || nlx >= worldW || nly >= worldW) continue
          const nElev = elevation[nly * worldW + nlx]
          if (nElev < bestElev) { bestElev = nElev; bestWx = nx; bestWy = ny; bestDirIdx = d }
        }

        const flowDir = DIR_NAMES[bestDirIdx]

        // Apply river tiles with width
        const halfW = Math.floor((width - 1) / 2)
        for (let dy2 = -halfW; dy2 <= halfW; dy2++) {
          for (let dx2 = -halfW; dx2 <= halfW; dx2++) {
            const tile = this.getExistingTile(wx + dx2, wy + dy2)
            if (tile && tile.type !== 'water' && tile.type !== 'deep_water' && tile.type !== 'building') {
              tile.type = 'river'
              tile.walkable = false
              tile.movementCost = 0
              tile.riverDirection = flowDir
              totalRiverTiles++
            }
          }
        }

        steps++
        // Width increases every 20 steps (slower widening for longer rivers)
        if (steps % 20 === 0 && width < 3) width++

        if (bestElev >= curElev) {
          uphillStreak++
          if (uphillStreak >= 2) {
            const d = DIRS[Math.floor(rng() * DIRS.length)]
            bestWx = Math.max(minW, Math.min(maxW - 1, wx + d[0]))
            bestWy = Math.max(minW, Math.min(maxW - 1, wy + d[1]))
            uphillStreak = 0
          }
        } else {
          uphillStreak = 0
        }

        wx = bestWx
        wy = bestWy
      }
    }

    if (totalRiverTiles > 0) {
      console.log(`[TileMap] Rivers: ${sources.length} rivers, ${totalRiverTiles} tiles`)
    }
  }

  // ===========================================
  // Lake detection + beach auto-placement
  // ===========================================

  private detectLakesAndBeaches(): void {
    const R = INITIAL_CHUNK_RADIUS
    const S = CHUNK_SIZE
    const minW = -R * S
    const maxW = (R + 1) * S

    let lakeTiles = 0
    let beachTiles = 0

    // Scan all existing tiles for water bodies
    // Auto-place beach (sand) tiles around coastlines (water adjacent to land)
    for (const chunk of this.chunks.values()) {
      for (let ly = 0; ly < S; ly++) {
        for (let lx = 0; lx < S; lx++) {
          const tile = chunk.tiles[ly][lx]

          // Beach: land tile adjacent to water/deep_water
          if (tile.walkable && tile.type !== 'river' && tile.type !== 'road' && tile.type !== 'building') {
            let adjacentWater = false
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue
                const wx = chunk.cx * S + lx + dx
                const wy = chunk.cy * S + ly + dy
                const neighbor = this.getExistingTile(wx, wy)
                if (neighbor && (neighbor.type === 'water' || neighbor.type === 'deep_water')) {
                  adjacentWater = true
                }
              }
            }

            // Convert coastal land to beach if within 2 tiles of water
            if (adjacentWater && tile.type !== 'beach' && tile.type !== 'sand') {
              const elev = tile.elevation ?? 0.25
              // Only low-elevation land becomes beach
              if (elev < 0.30) {
                tile.type = 'beach'
                tile.biome = 'beach'
                tile.movementCost = MOVEMENT_COSTS['beach'] ?? 1.3
                tile.decoration = undefined
                beachTiles++
              }
            }
          }
        }
      }
    }

    // Lake detection: find interior basins (low elevation surrounded by higher ground)
    // Simple approach: water tiles not on the map edge are lakes
    const edgeCx = [-R, R]
    const edgeCy = [-R, R]
    for (const chunk of this.chunks.values()) {
      const isEdge = edgeCx.includes(chunk.cx) || edgeCy.includes(chunk.cy)
      if (isEdge) continue // edge chunks contain ocean, not lakes

      for (let ly = 0; ly < S; ly++) {
        for (let lx = 0; lx < S; lx++) {
          const tile = chunk.tiles[ly][lx]
          if (tile.type === 'water' || tile.type === 'deep_water') {
            // Interior water body — mark surrounding tiles as marsh/swamp
            lakeTiles++
            // Add reed decorations to adjacent walkable tiles
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue
                const wx = chunk.cx * S + lx + dx
                const wy = chunk.cy * S + ly + dy
                const neighbor = this.getExistingTile(wx, wy)
                if (neighbor && neighbor.walkable && !neighbor.decoration && neighbor.type !== 'road') {
                  // 40% chance of reed/cattail at lake edges
                  const hash = ((wx * 374761393) ^ (wy * 668265263)) >>> 0
                  if ((hash & 0xFF) < 102) { // ~40%
                    neighbor.decoration = (hash & 0x100) ? 'deco_cattail' : 'deco_lily_pad'
                  }
                }
              }
            }
          }
        }
      }
    }

    if (beachTiles > 0 || lakeTiles > 0) {
      console.log(`[TileMap] Coastal: ${beachTiles} beach tiles, ${lakeTiles} interior water tiles`)
    }
  }

  // ===========================================
  // Landmark generation
  // ===========================================

  private generateLandmarks(): void {
    const R = INITIAL_CHUNK_RADIUS
    const S = CHUNK_SIZE
    const minW = -R * S
    const maxW = (R + 1) * S

    let rngState = (this.seed + 8888) | 0
    const rng = () => { rngState = (rngState * 1664525 + 1013904223) | 0; return (rngState >>> 0) / 0xFFFFFFFF }

    // --- Volcano: Find highest mountain area ---
    let volcanoPlaced = false
    {
      let bestX = 0, bestY = 0, bestElev = 0
      for (let wy = minW + 10; wy < maxW - 10; wy += 3) {
        for (let wx = minW + 10; wx < maxW - 10; wx += 3) {
          const elev = getWorldElevation(wx, wy, this.seed)
          if (elev > bestElev) {
            bestElev = elev
            bestX = wx
            bestY = wy
          }
        }
      }
      if (bestElev > 0.75) {
        this.placeLandmark('volcano', 'Dragon\'s Maw', bestX, bestY, 4)
        volcanoPlaced = true
      }
    }

    // --- Ancient Ruins: Find a flat clearing in forest ---
    {
      for (let attempt = 0; attempt < 20; attempt++) {
        const wx = minW + 15 + Math.floor(rng() * (maxW - minW - 30))
        const wy = minW + 15 + Math.floor(rng() * (maxW - minW - 30))
        const tile = this.getExistingTile(wx, wy)
        if (tile && (tile.biome === 'temperate_forest' || tile.biome === 'dense_forest' || tile.biome === 'grassland')) {
          const elev = tile.elevation ?? 0.4
          if (elev > 0.30 && elev < 0.55) {
            this.placeLandmark('ancient_ruins', 'Forgotten Sanctum', wx, wy, 3)
            break
          }
        }
      }
    }

    // --- Giant Tree: Find dense forest area ---
    {
      for (let attempt = 0; attempt < 20; attempt++) {
        const wx = minW + 10 + Math.floor(rng() * (maxW - minW - 20))
        const wy = minW + 10 + Math.floor(rng() * (maxW - minW - 20))
        const tile = this.getExistingTile(wx, wy)
        if (tile && (tile.biome === 'dense_forest' || tile.biome === 'temperate_forest')) {
          this.placeLandmark('giant_tree', 'The World Tree', wx, wy, 2)
          break
        }
      }
    }

    // --- Cave Entrance: Find cliff/mountain edge ---
    {
      for (let attempt = 0; attempt < 30; attempt++) {
        const wx = minW + 10 + Math.floor(rng() * (maxW - minW - 20))
        const wy = minW + 10 + Math.floor(rng() * (maxW - minW - 20))
        const tile = this.getExistingTile(wx, wy)
        if (tile && (tile.type === 'cliff' || (tile.biome === 'highland' && (tile.elevation ?? 0) > 0.55))) {
          this.placeLandmark('cave_entrance', 'Shadow Cavern', wx, wy, 2)
          break
        }
      }
    }

    console.log(`[TileMap] Landmarks placed: ${this.landmarks.length}`)
  }

  private placeLandmark(type: LandmarkType, name: string, cx: number, cy: number, radius: number): void {
    const landmark: ChunkLandmark = { type, name, centerX: cx, centerY: cy, radius }
    this.landmarks.push(landmark)

    // Apply landmark effects to tiles in radius
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue
        const tile = this.getExistingTile(cx + dx, cy + dy)
        if (!tile) continue

        tile.landmark = type

        switch (type) {
          case 'volcano':
            // Center = lava, surrounding = volcanic rock
            if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
              tile.type = 'lava'
              tile.walkable = false
              tile.movementCost = 0
            } else {
              tile.type = 'volcanic'
              tile.walkable = true
              tile.movementCost = MOVEMENT_COSTS['volcanic'] ?? 2.0
              tile.biome = 'volcanic'
            }
            tile.decoration = undefined
            break

          case 'ancient_ruins':
            // Stone floor with ruin decorations
            tile.biome = 'ruins'
            tile.decoration = (dx + dy) % 2 === 0 ? 'deco_ruins_pillar' : 'deco_ruins_stone'
            break

          case 'giant_tree':
            // Center is the tree trunk (2x2), surrounding is magical ground
            if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
              tile.decoration = 'deco_giant_tree'
              tile.biome = 'ancient_forest'
            } else {
              tile.decoration = 'deco_mushroom_ring'
              tile.biome = 'ancient_forest'
            }
            break

          case 'cave_entrance':
            if (dx === 0 && dy === 0) {
              tile.decoration = 'deco_cave_entrance'
              tile.biome = 'cave'
            }
            break
        }
      }
    }
  }

  // ===========================================
  // Road generation (v2: noise deviation + bridges)
  // ===========================================

  private buildInitialRoads(): void {
    if (this.pois.length < 2) return

    const edges = this.buildMST()

    // Extra short connections for redundancy
    const connected = new Set(edges.map(([a, b]) => `${Math.min(a, b)},${Math.max(a, b)}`))
    let extras = 0
    const maxExtras = Math.min(3, Math.floor(this.pois.length / 3))

    for (let i = 0; i < this.pois.length && extras < maxExtras; i++) {
      for (let j = i + 1; j < this.pois.length && extras < maxExtras; j++) {
        const key = `${i},${j}`
        if (connected.has(key)) continue
        const dx = this.pois[i].position.x - this.pois[j].position.x
        const dy = this.pois[i].position.y - this.pois[j].position.y
        if (Math.sqrt(dx * dx + dy * dy) < 45) {
          edges.push([i, j])
          connected.add(key)
          extras++
        }
      }
    }

    let totalRoadTiles = 0
    let bridgeCount = 0

    for (const [ai, bi] of edges) {
      const result = this.buildRoad(this.pois[ai].position, this.pois[bi].position)
      totalRoadTiles += result.roadTiles
      bridgeCount += result.bridges
    }

    if (totalRoadTiles > 0) {
      console.log(`[TileMap] Roads: ${edges.length} routes, ${totalRoadTiles} tiles, ${bridgeCount} bridges`)
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

  private buildRoad(start: Position, goal: Position): { roadTiles: number; bridges: number } {
    const path = this.aStarRoad(start, goal)
    let roadTiles = 0
    let bridges = 0

    for (const pos of path) {
      const tile = this.getExistingTile(pos.x, pos.y)
      if (!tile) continue

      if (tile.type === 'building') continue

      // Bridge over rivers
      if (tile.type === 'river') {
        tile.type = 'road'
        tile.walkable = true
        tile.movementCost = MOVEMENT_COSTS['road'] ?? 0.5
        tile.decoration = 'deco_bridge_stone'
        tile.biome = tile.biome ?? 'road'
        bridges++
        roadTiles++
        continue
      }

      tile.type = 'road'
      tile.walkable = true
      tile.movementCost = MOVEMENT_COSTS['road'] ?? 0.5
      tile.biome = tile.biome ?? 'road'
      tile.decoration = undefined
      roadTiles++
    }

    return { roadTiles, bridges }
  }

  private aStarRoad(start: Position, goal: Position): Position[] {
    interface Node { x: number; y: number; g: number; f: number; parent: Node | null }

    // Noise for path deviation (prevents perfectly straight roads)
    const noiseDeviation = new SimplexNoise2D(this.seed + 9876)

    const open: Node[] = [{
      x: start.x, y: start.y, g: 0,
      f: Math.abs(start.x - goal.x) + Math.abs(start.y - goal.y),
      parent: null,
    }]
    const closed = new Set<string>()
    const maxIter = 6000

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
          let baseCost: number
          if (!tile) {
            baseCost = 3.0
          } else if (tile.type === 'river') {
            baseCost = 8.0 // expensive but possible (bridge)
          } else if (tile.movementCost <= 0) {
            baseCost = 50.0 // very expensive impassable
          } else {
            baseCost = tile.movementCost
          }

          // Add noise deviation to cost (prevents straight-line roads)
          const deviation = noiseDeviation.sample(nx * 0.3, ny * 0.3) * 0.4 + 0.8
          baseCost *= deviation

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
