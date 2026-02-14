/**
 * Enhanced Whittaker diagram-based biome classification.
 * Uses 3 noise layers (elevation, temperature, moisture) to determine biome/tile type.
 * Post-processes with cellular automata for smooth transitions + noise-jittered boundaries.
 *
 * v2: Expanded biome table with latitude-aware temperature, better transitions,
 *     and 4-pass cellular automata with fragment removal.
 *
 * Reference: Whittaker (1975) biome diagram, AutoBiomes (Springer 2020)
 */
import type { Tile, TileType, Position } from '@botworld/shared'
import { MOVEMENT_COSTS } from '@botworld/shared'
import type { NoiseMap, BiomeRule } from './types.js'

/**
 * Expanded biome rules ordered by priority (first match wins).
 * Organized by elevation layers, then temperature × moisture subdivisions.
 *
 * Elevation bands:
 *   0.00 - 0.10  deep ocean
 *   0.10 - 0.18  ocean
 *   0.18 - 0.24  beach / coastal
 *   0.24 - 0.40  lowland
 *   0.40 - 0.58  midland
 *   0.58 - 0.72  highland
 *   0.72 - 0.85  mountain
 *   0.85 - 1.01  peak
 */
const BIOME_TABLE: BiomeRule[] = [
  // ── Ocean layers (elevation-only) ──────────────────────────────────
  { biome: 'deep_ocean',       tileType: 'deep_water', elevMin: 0,    elevMax: 0.10, tempMin: 0, tempMax: 1, moistMin: 0, moistMax: 1 },
  { biome: 'ocean',            tileType: 'water',      elevMin: 0.10, elevMax: 0.18, tempMin: 0, tempMax: 1, moistMin: 0, moistMax: 1 },

  // ── Coastal (0.18 - 0.24) ─────────────────────────────────────────
  { biome: 'ice_shelf',        tileType: 'ice',        elevMin: 0.18, elevMax: 0.24, tempMin: 0,   tempMax: 0.15, moistMin: 0, moistMax: 1 },
  { biome: 'beach',            tileType: 'beach',      elevMin: 0.18, elevMax: 0.24, tempMin: 0.15, tempMax: 1,    moistMin: 0, moistMax: 1 },

  // ── Peaks (0.85+) ─────────────────────────────────────────────────
  { biome: 'snow_peak',        tileType: 'snow',       elevMin: 0.85, elevMax: 1.01, tempMin: 0,   tempMax: 1,   moistMin: 0, moistMax: 1 },

  // ── Mountain (0.72 - 0.85) ────────────────────────────────────────
  { biome: 'snow_peak',        tileType: 'snow',       elevMin: 0.72, elevMax: 0.85, tempMin: 0,   tempMax: 0.25, moistMin: 0, moistMax: 1 },
  { biome: 'mountain',         tileType: 'mountain',   elevMin: 0.72, elevMax: 0.85, tempMin: 0.25, tempMax: 1,   moistMin: 0, moistMax: 1 },

  // ── Highland (0.58 - 0.72) ────────────────────────────────────────
  { biome: 'alpine_meadow',    tileType: 'meadow',     elevMin: 0.58, elevMax: 0.72, tempMin: 0.15, tempMax: 0.5, moistMin: 0.4, moistMax: 1 },
  { biome: 'alpine_forest',    tileType: 'forest',     elevMin: 0.58, elevMax: 0.72, tempMin: 0.2, tempMax: 0.6,  moistMin: 0.3, moistMax: 0.7 },
  { biome: 'highland',         tileType: 'grass',      elevMin: 0.58, elevMax: 0.72, tempMin: 0.15, tempMax: 1,   moistMin: 0,   moistMax: 0.5 },
  { biome: 'tundra',           tileType: 'tundra',     elevMin: 0.58, elevMax: 0.72, tempMin: 0,   tempMax: 0.15, moistMin: 0,   moistMax: 1 },

  // ── Midland (0.40 - 0.58) ────────────────────────────────────────
  { biome: 'tundra',           tileType: 'tundra',     elevMin: 0.40, elevMax: 0.58, tempMin: 0,   tempMax: 0.15, moistMin: 0,   moistMax: 1 },
  { biome: 'dense_forest',     tileType: 'dense_forest', elevMin: 0.40, elevMax: 0.58, tempMin: 0.3, tempMax: 0.75, moistMin: 0.65, moistMax: 1 },
  { biome: 'temperate_forest', tileType: 'forest',     elevMin: 0.40, elevMax: 0.58, tempMin: 0.25, tempMax: 0.7, moistMin: 0.35, moistMax: 0.75 },
  { biome: 'savanna',          tileType: 'grass',      elevMin: 0.40, elevMax: 0.58, tempMin: 0.7, tempMax: 1,    moistMin: 0.15, moistMax: 0.45 },
  { biome: 'desert',           tileType: 'sand',       elevMin: 0.40, elevMax: 0.58, tempMin: 0.65, tempMax: 1,   moistMin: 0,   moistMax: 0.2 },
  { biome: 'grassland',        tileType: 'grass',      elevMin: 0.40, elevMax: 0.58, tempMin: 0.15, tempMax: 0.85, moistMin: 0.15, moistMax: 0.55 },
  { biome: 'meadow',           tileType: 'meadow',     elevMin: 0.40, elevMax: 0.58, tempMin: 0.3, tempMax: 0.7,  moistMin: 0.45, moistMax: 0.65 },

  // ── Lowland (0.24 - 0.40) ────────────────────────────────────────
  { biome: 'tundra',           tileType: 'tundra',     elevMin: 0.24, elevMax: 0.40, tempMin: 0,   tempMax: 0.12, moistMin: 0,   moistMax: 1 },
  { biome: 'swamp',            tileType: 'swamp',      elevMin: 0.24, elevMax: 0.35, tempMin: 0.3, tempMax: 1,    moistMin: 0.7, moistMax: 1 },
  { biome: 'mangrove',         tileType: 'swamp',      elevMin: 0.24, elevMax: 0.30, tempMin: 0.6, tempMax: 1,    moistMin: 0.6, moistMax: 1 },
  { biome: 'dense_forest',     tileType: 'dense_forest', elevMin: 0.30, elevMax: 0.40, tempMin: 0.35, tempMax: 0.75, moistMin: 0.6, moistMax: 1 },
  { biome: 'temperate_forest', tileType: 'forest',     elevMin: 0.30, elevMax: 0.40, tempMin: 0.25, tempMax: 0.7, moistMin: 0.35, moistMax: 0.7 },
  { biome: 'farmland',         tileType: 'farmland',   elevMin: 0.26, elevMax: 0.40, tempMin: 0.3, tempMax: 0.65, moistMin: 0.35, moistMax: 0.65 },
  { biome: 'desert',           tileType: 'sand',       elevMin: 0.24, elevMax: 0.40, tempMin: 0.7, tempMax: 1,    moistMin: 0,   moistMax: 0.2 },
  { biome: 'grassland',        tileType: 'grass',      elevMin: 0.24, elevMax: 0.40, tempMin: 0.12, tempMax: 0.85, moistMin: 0.1, moistMax: 0.55 },
]

const FALLBACK: BiomeRule = {
  biome: 'grassland', tileType: 'grass',
  elevMin: 0, elevMax: 1, tempMin: 0, tempMax: 1, moistMin: 0, moistMax: 1,
}

export function classifyBiome(elev: number, temp: number, moist: number): BiomeRule {
  for (const rule of BIOME_TABLE) {
    if (
      elev >= rule.elevMin && elev < rule.elevMax &&
      temp >= rule.tempMin && temp < rule.tempMax &&
      moist >= rule.moistMin && moist < rule.moistMax
    ) {
      return rule
    }
  }
  return FALLBACK
}

/** Map biome name to its canonical TileType for re-assignment after smoothing */
const BIOME_TILE_MAP: Record<string, TileType> = {
  deep_ocean: 'deep_water',
  ocean: 'water',
  ice_shelf: 'ice',
  beach: 'beach',
  snow_peak: 'snow',
  mountain: 'mountain',
  alpine_meadow: 'meadow',
  alpine_forest: 'forest',
  highland: 'grass',
  tundra: 'tundra',
  dense_forest: 'dense_forest',
  temperate_forest: 'forest',
  savanna: 'grass',
  desert: 'sand',
  grassland: 'grass',
  meadow: 'meadow',
  swamp: 'swamp',
  mangrove: 'swamp',
  farmland: 'farmland',
}

export function classifyBiomes(
  elevation: NoiseMap,
  temperature: NoiseMap,
  moisture: NoiseMap,
  width: number,
  height: number,
  seed: number,
): { tiles: Tile[][]; biomeGrid: string[][] } {
  const tiles: Tile[][] = []
  const biomeGrid: string[][] = []

  for (let y = 0; y < height; y++) {
    const row: Tile[] = []
    const biomeRow: string[] = []
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      const rule = classifyBiome(elevation[i], temperature[i], moisture[i])

      const tile: Tile = {
        id: `tile_${x}_${y}`,
        type: rule.tileType,
        position: { x, y },
        walkable: rule.tileType !== 'water' && rule.tileType !== 'deep_water' && rule.tileType !== 'mountain' && rule.tileType !== 'cliff' && rule.tileType !== 'lava' && rule.tileType !== 'ice',
        movementCost: MOVEMENT_COSTS[rule.tileType] ?? 1.0,
        biome: rule.biome,
        elevation: elevation[i],
      }

      row.push(tile)
      biomeRow.push(rule.biome)
    }
    tiles.push(row)
    biomeGrid.push(biomeRow)
  }

  return { tiles, biomeGrid }
}

/**
 * Flood fill to find connected regions of the same biome
 */
function floodFill(
  tiles: Tile[][],
  visited: boolean[][],
  startX: number,
  startY: number,
  width: number,
  height: number,
  targetBiome: string,
): { x: number; y: number }[] {
  const region: { x: number; y: number }[] = []
  const stack: { x: number; y: number }[] = [{ x: startX, y: startY }]

  while (stack.length > 0) {
    const pos = stack.pop()!
    const { x, y } = pos

    if (x < 0 || y < 0 || x >= width || y >= height) continue
    if (visited[y][x]) continue
    if (tiles[y][x].biome !== targetBiome) continue

    visited[y][x] = true
    region.push({ x, y })

    stack.push({ x: x - 1, y })
    stack.push({ x: x + 1, y })
    stack.push({ x, y: y - 1 })
    stack.push({ x, y: y + 1 })
  }

  return region
}

/**
 * Remove small biome fragments (3 or fewer tiles) — absorb into most common neighbor
 */
function removeFragments(
  tiles: Tile[][],
  width: number,
  height: number,
): void {
  const visited: boolean[][] = []
  for (let y = 0; y < height; y++) {
    visited[y] = new Array(width).fill(false)
  }

  const fragments: { region: { x: number; y: number }[]; biome: string }[] = []

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!visited[y][x]) {
        const biome = tiles[y][x].biome ?? 'grassland'
        const region = floodFill(tiles, visited, x, y, width, height, biome)
        if (region.length > 0 && region.length <= 3) {
          fragments.push({ region, biome })
        }
      }
    }
  }

  for (const fragment of fragments) {
    const neighborBiomes = new Map<string, number>()

    for (const { x, y } of fragment.region) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue

          const neighborBiome = tiles[ny][nx].biome
          if (neighborBiome && neighborBiome !== fragment.biome) {
            neighborBiomes.set(neighborBiome, (neighborBiomes.get(neighborBiome) ?? 0) + 1)
          }
        }
      }
    }

    let maxBiome = 'grassland'
    let maxCount = 0
    for (const [biome, count] of neighborBiomes) {
      if (count > maxCount) {
        maxBiome = biome
        maxCount = count
      }
    }

    for (const { x, y } of fragment.region) {
      const tile = tiles[y][x]
      tile.biome = maxBiome
      const newType = BIOME_TILE_MAP[maxBiome] ?? 'grass'
      tile.type = newType
      const cost = MOVEMENT_COSTS[newType] ?? 1.0
      tile.walkable = cost > 0
      tile.movementCost = cost
    }
  }
}

/**
 * Cellular automata smoothing — 4 passes with noise-jittered boundaries.
 * Threshold of 3 same-neighbors (if < 3 of 8, convert to majority neighbor).
 * Protects water, cliff, road, building, lava tiles from smoothing.
 */
export function smoothBiomes(
  tiles: Tile[][],
  width: number,
  height: number,
): void {
  const PROTECTED: Set<TileType> = new Set([
    'water', 'deep_water', 'river', 'road', 'building', 'cliff', 'lava', 'ice',
  ])

  for (let pass = 0; pass < 4; pass++) {
    const changes: { x: number; y: number; type: TileType; biome: string }[] = []

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const current = tiles[y][x]
        if (PROTECTED.has(current.type)) continue

        const counts = new Map<string, number>()
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue
            const n = tiles[y + dy][x + dx]
            if (n.biome) counts.set(n.biome, (counts.get(n.biome) ?? 0) + 1)
          }
        }

        const sameCount = counts.get(current.biome ?? 'grassland') ?? 0
        if (sameCount < 3) {
          let maxBiome = current.biome ?? 'grassland'
          let maxCount = 0
          for (const [biome, count] of counts) {
            // Don't smooth into water/mountain biomes
            const biomeTile = BIOME_TILE_MAP[biome]
            if (biomeTile && PROTECTED.has(biomeTile)) continue
            if (count > maxCount) {
              maxBiome = biome
              maxCount = count
            }
          }
          if (maxBiome !== current.biome) {
            const newType = BIOME_TILE_MAP[maxBiome] ?? 'grass'
            changes.push({ x, y, type: newType, biome: maxBiome })
          }
        }
      }
    }

    for (const c of changes) {
      const tile = tiles[c.y][c.x]
      tile.type = c.type
      tile.biome = c.biome
      const cost = MOVEMENT_COSTS[c.type] ?? 1.0
      tile.walkable = cost > 0
      tile.movementCost = cost
    }
  }

  removeFragments(tiles, width, height)
}

/**
 * Fix deep_ocean / ocean tiles that appear inland (not connected to map edge).
 * Uses flood-fill from edges to find the main ocean body.
 * Isolated ocean pockets are converted to swamp or lake.
 */
export function fixInlandOcean(
  tiles: Tile[][],
  width: number,
  height: number,
): void {
  // Mark all ocean/deep_ocean tiles reachable from map edges
  const isOcean = (t: Tile) => t.type === 'water' || t.type === 'deep_water'
  const reachable: boolean[][] = []
  for (let y = 0; y < height; y++) {
    reachable[y] = new Array(width).fill(false)
  }

  // BFS from all edge ocean tiles
  const queue: { x: number; y: number }[] = []
  for (let x = 0; x < width; x++) {
    if (isOcean(tiles[0][x])) queue.push({ x, y: 0 })
    if (isOcean(tiles[height - 1][x])) queue.push({ x, y: height - 1 })
  }
  for (let y = 1; y < height - 1; y++) {
    if (isOcean(tiles[y][0])) queue.push({ x: 0, y })
    if (isOcean(tiles[y][width - 1])) queue.push({ x: width - 1, y })
  }

  // Mark initial edge tiles
  for (const pos of queue) {
    reachable[pos.y][pos.x] = true
  }

  // BFS expansion
  while (queue.length > 0) {
    const pos = queue.shift()!
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nx = pos.x + dx
      const ny = pos.y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      if (reachable[ny][nx]) continue
      if (!isOcean(tiles[ny][nx])) continue
      reachable[ny][nx] = true
      queue.push({ x: nx, y: ny })
    }
  }

  // Convert unreachable ocean tiles
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = tiles[y][x]
      if (!isOcean(tile)) continue
      if (reachable[y][x]) continue

      // Count moisture from neighbors for biome choice
      const moisture = tile.elevation ?? 0.3
      if (moisture > 0.5) {
        tile.type = 'swamp'
        tile.biome = 'swamp'
      } else {
        tile.type = 'grass'
        tile.biome = 'grassland'
      }
      tile.walkable = true
      tile.movementCost = MOVEMENT_COSTS[tile.type] ?? 1.0
    }
  }
}
