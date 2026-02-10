/**
 * Per-chunk world generation.
 * Generates a single 16×16 chunk with terrain, biomes, resources, POIs, variants, and decorations.
 * Reuses noise functions from noise.ts and biome classification from biome-classifier.ts.
 *
 * Key differences from pipeline.ts (fixed map):
 * - No island mask → open world
 * - Temperature via large-scale noise zones (not latitude gradient)
 * - Moisture via elevation-based reduction (not row-sweep rain shadow)
 * - Per-chunk POI placement (~30% chance)
 * - Deterministic: same seed + chunk coords = same output
 */
import { CHUNK_SIZE, MOVEMENT_COSTS } from '@botworld/shared'
import type { Tile, TileType, ChunkData, ChunkPOI, POIType, ResourceType } from '@botworld/shared'
import { SimplexNoise2D, fbm, ridgedFbm, domainWarp, clamp, lerp } from './noise.js'
import { classifyBiome } from './biome-classifier.js'

// --- Cached noise instances (one set per seed) ---

let cachedSeed = -1
let noiseElev: SimplexNoise2D
let noiseWarp: SimplexNoise2D
let noiseTemp: SimplexNoise2D
let noiseMoist: SimplexNoise2D
let noiseRidge: SimplexNoise2D
let noiseVariant: SimplexNoise2D
let noiseDeco: SimplexNoise2D
let noisePoi: SimplexNoise2D
let noiseCluster: SimplexNoise2D

function ensureNoise(seed: number) {
  if (cachedSeed === seed) return
  cachedSeed = seed
  noiseElev = new SimplexNoise2D(seed)
  noiseWarp = new SimplexNoise2D(seed + 100)
  noiseTemp = new SimplexNoise2D(seed + 1000)
  noiseMoist = new SimplexNoise2D(seed + 2000)
  noiseRidge = new SimplexNoise2D(seed + 3000)
  noiseVariant = new SimplexNoise2D(seed + 4000)
  noiseCluster = new SimplexNoise2D(seed + 5000)
  noiseDeco = new SimplexNoise2D(seed + 6000)
  noisePoi = new SimplexNoise2D(seed + 7000)
}

// --- Deterministic hash for per-chunk seeded random ---

function hashChunk(cx: number, cy: number, salt: number): number {
  let h = salt
  h = ((h << 5) + h) ^ (cx * 374761393)
  h = ((h << 5) + h) ^ (cy * 668265263)
  h = (h * 2654435761) >>> 0
  return h
}

function seededRandom(seed: number): () => number {
  let s = seed | 0 || 1
  return () => {
    s = (s * 1103515245 + 12345) & 0x7FFFFFFF
    return s / 0x7FFFFFFF
  }
}

// --- POI data tables (from poi-placement.ts) ---

const POI_BIOME_AFFINITY: Record<string, POIType[]> = {
  grassland:        ['marketplace', 'tavern', 'farm'],
  farmland:         ['farm', 'marketplace'],
  temperate_forest: ['library', 'workshop'],
  alpine_forest:    ['workshop'],
  dense_forest:     ['library'],
  highland:         ['mine', 'workshop'],
  beach:            ['tavern'],
  swamp:            ['library'],
  tundra:           ['mine'],
  desert:           ['marketplace'],
}

const ADJECTIVES = [
  'Silver', 'Old', 'Rusty', 'Golden', 'Hidden',
  'Grand', 'Whispering', 'Iron', 'Mossy', 'Crimson',
  'Ancient', 'Dusty', 'Emerald', 'Lonely', 'Bright',
]

const NOUNS: Record<POIType, string[]> = {
  marketplace: ['Market', 'Bazaar', 'Trading Post', 'Square'],
  tavern:      ['Tankard', 'Inn', 'Alehouse', 'Rest'],
  workshop:    ['Forge', 'Workshop', 'Smithy', 'Anvil'],
  library:     ['Library', 'Archive', 'Sanctum', 'Study'],
  farm:        ['Farm', 'Homestead', 'Ranch', 'Orchard'],
  mine:        ['Mine', 'Quarry', 'Dig', 'Delve'],
}

// --- Decoration tables ---

const BIOME_DECORATIONS: Record<string, string[]> = {
  grassland:        ['deco_flowers_1', 'deco_flowers_2', 'deco_grass_tuft'],
  farmland:         ['deco_hay_bale', 'deco_scarecrow'],
  temperate_forest: ['deco_bush_1', 'deco_mushroom_1', 'deco_fallen_log'],
  alpine_forest:    ['deco_pine_small', 'deco_rock_1'],
  dense_forest:     ['deco_mushroom_2', 'deco_moss_rock', 'deco_fern'],
  highland:         ['deco_rock_2', 'deco_rock_3'],
  beach:            ['deco_shell', 'deco_driftwood'],
  swamp:            ['deco_lily_pad', 'deco_cattail', 'deco_dead_tree'],
  tundra:           ['deco_ice_crystal', 'deco_dead_bush'],
  desert:           ['deco_cactus', 'deco_dry_bush'],
  snow_peak:        ['deco_ice_crystal'],
}

// --- Resource tables (from resource-scatter.ts) ---

interface ResourceDef {
  type: ResourceType
  density: number
  amount: number
  maxAmount: number
  regenRate: number
}

const BIOME_RESOURCES: Record<string, ResourceDef[]> = {
  temperate_forest: [
    { type: 'wood', density: 0.35, amount: 10, maxAmount: 10, regenRate: 0.01 },
    { type: 'herb', density: 0.08, amount: 4, maxAmount: 4, regenRate: 0.008 },
  ],
  alpine_forest: [
    { type: 'wood', density: 0.25, amount: 8, maxAmount: 8, regenRate: 0.008 },
  ],
  dense_forest: [
    { type: 'wood', density: 0.50, amount: 15, maxAmount: 15, regenRate: 0.012 },
    { type: 'herb', density: 0.15, amount: 6, maxAmount: 6, regenRate: 0.01 },
  ],
  grassland: [
    { type: 'food', density: 0.12, amount: 5, maxAmount: 5, regenRate: 0.02 },
    { type: 'herb', density: 0.05, amount: 3, maxAmount: 3, regenRate: 0.008 },
  ],
  farmland: [
    { type: 'food', density: 0.40, amount: 8, maxAmount: 8, regenRate: 0.025 },
  ],
  highland: [
    { type: 'stone', density: 0.25, amount: 10, maxAmount: 10, regenRate: 0.005 },
    { type: 'iron', density: 0.08, amount: 8, maxAmount: 8, regenRate: 0.003 },
  ],
  swamp: [
    { type: 'herb', density: 0.20, amount: 6, maxAmount: 6, regenRate: 0.015 },
    { type: 'food', density: 0.06, amount: 3, maxAmount: 3, regenRate: 0.01 },
  ],
  beach: [
    { type: 'food', density: 0.05, amount: 3, maxAmount: 3, regenRate: 0.015 },
  ],
  tundra: [
    { type: 'stone', density: 0.15, amount: 6, maxAmount: 6, regenRate: 0.004 },
  ],
}

const MOUNTAIN_ADJ_RESOURCES: ResourceDef[] = [
  { type: 'stone', density: 0.30, amount: 12, maxAmount: 12, regenRate: 0.005 },
  { type: 'iron', density: 0.12, amount: 10, maxAmount: 10, regenRate: 0.004 },
  { type: 'gold', density: 0.04, amount: 5, maxAmount: 5, regenRate: 0.002 },
]

// --- Main chunk generation ---

export function generateChunk(cx: number, cy: number, seed: number): ChunkData {
  ensureNoise(seed)
  const S = CHUNK_SIZE

  // Step 1: Generate tiles with noise layers
  const tiles: Tile[][] = []
  const biomeGrid: string[][] = []

  for (let ly = 0; ly < S; ly++) {
    const row: Tile[] = []
    const biomeRow: string[] = []

    for (let lx = 0; lx < S; lx++) {
      const wx = cx * S + lx
      const wy = cy * S + ly

      // Elevation (fbm + domain warp, same params as pipeline.ts)
      const raw = fbm(noiseElev, wx * 0.035, wy * 0.035, {
        octaves: 6, persistence: 0.5, lacunarity: 2.0, scale: 1.0,
      })
      const warp = domainWarp(noiseWarp, wx, wy, { strength: 3.0, scale: 0.025 })
      const warped = fbm(noiseElev, (wx + warp.x) * 0.035, (wy + warp.y) * 0.035, {
        octaves: 6, persistence: 0.5, lacunarity: 2.0, scale: 1.0,
      })
      let elev = Math.pow(lerp(raw, warped, 0.4), 1.3)

      // Mountain ridges (ridgedFbm for high elevation areas)
      if (elev > 0.55) {
        const ridge = ridgedFbm(noiseRidge, wx * 0.05, wy * 0.05, {
          octaves: 4, persistence: 0.5, lacunarity: 2.1, scale: 1.0,
        })
        if (ridge > 0.6) {
          elev = Math.max(elev, 0.70 + (ridge - 0.6) * 0.75)
        }
      }

      // Temperature: large-scale noise zone (replaces latitude gradient)
      const tempNoise = fbm(noiseTemp, wx * 0.012, wy * 0.012, {
        octaves: 4, persistence: 0.5, scale: 1.0,
      })
      const altCooling = Math.max(0, (elev - 0.5) * 0.6)
      const temp = clamp(tempNoise - altCooling, 0, 1)

      // Moisture: noise + elevation-based reduction (replaces rain shadow)
      const moistNoise = fbm(noiseMoist, wx * 0.045, wy * 0.045, {
        octaves: 5, persistence: 0.5, scale: 1.0,
      })
      const moistReduction = Math.max(0, (elev - 0.65) * 0.5)
      const moist = clamp(moistNoise - moistReduction, 0, 1)

      // Biome classification
      const rule = classifyBiome(elev, temp, moist)

      // Variant (0/1/2) from noise
      const varNoise = noiseVariant.sample(wx * 0.2, wy * 0.2)
      const variant = varNoise < -0.33 ? 0 : varNoise < 0.33 ? 1 : 2

      // Decoration (biome-specific, noise-gated ~35%)
      let decoration: string | undefined
      const decoNoise = noiseDeco.sample(wx * 0.15, wy * 0.15)
      if (decoNoise > 0.3) {
        const decos = BIOME_DECORATIONS[rule.biome]
        if (decos && decos.length > 0) {
          const decoIdx = Math.abs(Math.floor((decoNoise * 1000) % decos.length))
          decoration = decos[decoIdx]
        }
      }

      const cost = MOVEMENT_COSTS[rule.tileType] ?? 1.0
      const tile: Tile = {
        id: `tile_${wx}_${wy}`,
        type: rule.tileType,
        position: { x: wx, y: wy },
        walkable: cost > 0,
        movementCost: cost,
        biome: rule.biome,
        variant,
        decoration,
      }

      row.push(tile)
      biomeRow.push(rule.biome)
    }

    tiles.push(row)
    biomeGrid.push(biomeRow)
  }

  // Step 2: Cellular automata smoothing (inner area only to avoid boundary artifacts)
  smoothChunkTiles(tiles, S)

  // Step 3: Resource scattering
  scatterChunkResources(tiles, biomeGrid, cx, cy, seed)

  // Step 4: POI placement attempt
  const poi = tryPlacePOI(tiles, biomeGrid, cx, cy, seed)

  return { cx, cy, tiles, poi, generated: true }
}

// --- Cellular automata smoothing ---

function smoothChunkTiles(tiles: Tile[][], size: number): void {
  const changes: { lx: number; ly: number; type: TileType; biome: string }[] = []

  for (let ly = 1; ly < size - 1; ly++) {
    for (let lx = 1; lx < size - 1; lx++) {
      const current = tiles[ly][lx]
      if (current.type === 'water' || current.type === 'deep_water' ||
          current.type === 'road' || current.type === 'building') continue

      const counts = new Map<TileType, number>()
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          const n = tiles[ly + dy][lx + dx]
          counts.set(n.type, (counts.get(n.type) ?? 0) + 1)
        }
      }

      const sameCount = counts.get(current.type) ?? 0
      if (sameCount <= 2) {
        let maxType: TileType = current.type
        let maxCount = 0
        for (const [type, count] of counts) {
          if (type === 'water' || type === 'deep_water' || type === 'mountain') continue
          if (count > maxCount) {
            maxType = type
            maxCount = count
          }
        }
        if (maxType !== current.type) {
          const neighborBiome = tiles[ly + (maxType === tiles[ly - 1][lx].type ? -1 : 1)]?.[lx]?.biome ?? current.biome
          changes.push({ lx, ly, type: maxType, biome: neighborBiome ?? 'grassland' })
        }
      }
    }
  }

  for (const c of changes) {
    const cost = MOVEMENT_COSTS[c.type] ?? 1.0
    tiles[c.ly][c.lx].type = c.type
    tiles[c.ly][c.lx].biome = c.biome
    tiles[c.ly][c.lx].walkable = cost > 0
    tiles[c.ly][c.lx].movementCost = cost
  }
}

// --- Resource scattering ---

function scatterChunkResources(
  tiles: Tile[][], biomeGrid: string[][],
  cx: number, cy: number, seed: number,
): void {
  const S = CHUNK_SIZE
  const rng = seededRandom(hashChunk(cx, cy, seed + 9999))

  for (let ly = 0; ly < S; ly++) {
    for (let lx = 0; lx < S; lx++) {
      const tile = tiles[ly][lx]
      if (!tile.walkable || tile.resource || tile.type === 'road' || tile.type === 'building') continue

      const wx = cx * S + lx
      const wy = cy * S + ly
      const biome = biomeGrid[ly]?.[lx] ?? 'grassland'

      // Check if adjacent to mountain (within chunk only)
      let nearMountain = false
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          const nx = lx + dx, ny = ly + dy
          if (nx >= 0 && nx < S && ny >= 0 && ny < S) {
            if (tiles[ny][nx].type === 'mountain') nearMountain = true
          }
        }
      }

      const resources = nearMountain ? MOUNTAIN_ADJ_RESOURCES : (BIOME_RESOURCES[biome] ?? [])
      const cluster = fbm(noiseCluster, wx * 0.06, wy * 0.06, { octaves: 3, scale: 1.0 })

      for (const res of resources) {
        if (tile.resource) break
        if (cluster < 0.4) continue
        if (rng() < res.density) {
          tile.resource = {
            type: res.type,
            amount: res.amount,
            maxAmount: res.maxAmount,
            regenRate: res.regenRate,
          }
        }
      }
    }
  }
}

// --- POI placement ---

function tryPlacePOI(
  tiles: Tile[][], biomeGrid: string[][],
  cx: number, cy: number, seed: number,
): ChunkPOI | undefined {
  const S = CHUNK_SIZE

  // Deterministic decision: ~30% of chunks get a POI
  const poiVal = noisePoi.sample(cx * 0.8, cy * 0.8)
  if (poiVal < 0.2) return undefined

  // Find walkable position near chunk center
  const center = Math.floor(S / 2)
  let bestPos: { lx: number; ly: number } | null = null

  for (let r = 0; r <= 4 && !bestPos; r++) {
    for (let dy = -r; dy <= r && !bestPos; dy++) {
      for (let dx = -r; dx <= r && !bestPos; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue
        const lx = center + dx
        const ly = center + dy
        if (lx < 1 || lx >= S - 1 || ly < 1 || ly >= S - 1) continue
        if (tiles[ly][lx].walkable) {
          bestPos = { lx, ly }
        }
      }
    }
  }

  if (!bestPos) return undefined

  const biome = biomeGrid[bestPos.ly][bestPos.lx] ?? 'grassland'
  const rng = seededRandom(hashChunk(cx, cy, seed + 5555))

  // Choose POI type based on biome affinity
  const affinities = POI_BIOME_AFFINITY[biome] ?? ['marketplace', 'tavern']
  const poiType = affinities[Math.floor(rng() * affinities.length)]

  // Generate name
  const adj = ADJECTIVES[Math.floor(rng() * ADJECTIVES.length)]
  const nouns = NOUNS[poiType]
  const noun = nouns[Math.floor(rng() * nouns.length)]

  // Convert tile to building
  tiles[bestPos.ly][bestPos.lx].type = 'building'
  tiles[bestPos.ly][bestPos.lx].walkable = true
  tiles[bestPos.ly][bestPos.lx].poiType = poiType
  tiles[bestPos.ly][bestPos.lx].movementCost = MOVEMENT_COSTS['building'] ?? 1.0

  return { name: `${adj} ${noun}`, type: poiType, localX: bestPos.lx, localY: bestPos.ly, biome }
}
