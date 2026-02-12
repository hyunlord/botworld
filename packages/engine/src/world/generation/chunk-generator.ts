/**
 * Per-chunk world generation v2.
 * Generates a single 16×16 chunk with terrain, biomes, resources, POIs, variants, and decorations.
 *
 * v2 changes:
 * - Continental shape via radial gradient + 6-octave fBm → natural island/continent form
 * - Latitude-based temperature (north=cold, south=warm) + altitude cooling
 * - Elevation stored per tile (raw 0-1 + discrete level 0-4)
 * - Cliff tile placement at elevation level transitions
 * - Enhanced density clustering: forest dense/sparse/clearing, grassland sparse, desert bare
 * - Biome-specific object distribution with Poisson-like noise clustering
 *
 * Deterministic: same seed + chunk coords = same output.
 */
import { CHUNK_SIZE, MOVEMENT_COSTS } from '@botworld/shared'
import type { Tile, TileType, ChunkData, ChunkPOI, POIType, ResourceType } from '@botworld/shared'
import { SimplexNoise2D, fbm, ridgedFbm, domainWarp, clamp, lerp } from './noise.js'
import { classifyBiome } from './biome-classifier.js'

// --- World shape constants ---

/** World center (in world coordinates). Chunks span around 0,0 with INITIAL_CHUNK_RADIUS=3 → ±48 tiles */
const WORLD_CENTER_X = 0
const WORLD_CENTER_Y = 0
/** Approximate world radius in tiles for radial gradient (soft edge) */
const WORLD_RADIUS = 52
/** How aggressively the radial gradient drops off (1.0=linear, 1.5=smooth, 2.0=steep) */
const RADIAL_POWER = 1.4
/** Latitude extent — how far north/south in tiles temperature gradient spans */
const LATITUDE_EXTENT = 56

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
let noiseDensity: SimplexNoise2D

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
  noiseDensity = new SimplexNoise2D(seed + 8000)
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

// --- POI data tables ---

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
  meadow:           ['farm', 'tavern'],
  savanna:          ['marketplace', 'farm'],
  alpine_meadow:    ['mine'],
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

// --- Weighted tile variant tables ---

const BIOME_VARIANTS: Record<string, [number, number][]> = {
  grassland:        [[0, 0.50], [1, 0.75], [2, 0.90], [3, 1.0]],
  farmland:         [[0, 0.70], [1, 1.0]],
  temperate_forest: [[0, 0.50], [1, 0.80], [2, 1.0]],
  alpine_forest:    [[0, 0.60], [1, 1.0]],
  dense_forest:     [[0, 0.45], [1, 0.75], [2, 1.0]],
  highland:         [[0, 0.55], [1, 0.85], [2, 1.0]],
  beach:            [[0, 0.50], [1, 0.80], [2, 1.0]],
  desert:           [[0, 0.50], [1, 0.80], [2, 1.0]],
  swamp:            [[0, 0.65], [1, 1.0]],
  tundra:           [[0, 0.55], [1, 0.85], [2, 1.0]],
  snow_peak:        [[0, 0.50], [1, 0.80], [2, 1.0]],
  mountain:         [[0, 0.45], [1, 0.75], [2, 1.0]],
  meadow:           [[0, 0.40], [1, 0.70], [2, 1.0]],
  alpine_meadow:    [[0, 0.50], [1, 0.80], [2, 1.0]],
  savanna:          [[0, 0.55], [1, 0.85], [2, 1.0]],
  mangrove:         [[0, 0.60], [1, 1.0]],
  ice_shelf:        [[0, 0.55], [1, 1.0]],
}

function getWeightedVariant(biome: string, coordHash: number): number {
  const weights = BIOME_VARIANTS[biome]
  if (!weights) return 0
  const t = (coordHash >>> 0) / 0xFFFFFFFF
  for (const [variant, cumWeight] of weights) {
    if (t < cumWeight) return variant
  }
  return 0
}

// --- Decoration tables with biome-specific rates ---
// Rates are BASE rates — actual placement also depends on density noise clustering

const BIOME_DECO_RATE: Record<string, number> = {
  grassland: 0.06,
  farmland: 0.05,
  temperate_forest: 0.18,
  alpine_forest: 0.12,
  dense_forest: 0.22,
  highland: 0.07,
  beach: 0.08,
  swamp: 0.14,
  tundra: 0.04,
  desert: 0.04,
  snow_peak: 0.03,
  river: 0.05,
  meadow: 0.10,
  alpine_meadow: 0.08,
  savanna: 0.05,
  mangrove: 0.12,
}

const BIOME_DECORATIONS: Record<string, string[]> = {
  grassland:        ['deco_flowers_1', 'deco_flowers_2', 'deco_grass_tuft', 'deco_pebbles'],
  farmland:         ['deco_hay_bale', 'deco_scarecrow'],
  temperate_forest: ['deco_bush_1', 'deco_mushroom_1', 'deco_fallen_log', 'deco_fern'],
  alpine_forest:    ['deco_pine_small', 'deco_rock_1'],
  dense_forest:     ['deco_mushroom_2', 'deco_moss_rock', 'deco_fern', 'deco_fallen_log'],
  highland:         ['deco_rock_2', 'deco_rock_3', 'deco_pebbles'],
  beach:            ['deco_shell', 'deco_driftwood', 'deco_pebbles'],
  swamp:            ['deco_lily_pad', 'deco_cattail', 'deco_dead_tree'],
  tundra:           ['deco_ice_crystal', 'deco_dead_bush', 'deco_rock_1'],
  desert:           ['deco_cactus', 'deco_dry_bush', 'deco_bones'],
  snow_peak:        ['deco_ice_crystal'],
  river:            ['ripple'],
  meadow:           ['deco_flowers_1', 'deco_flowers_2', 'deco_grass_tuft', 'deco_butterfly'],
  alpine_meadow:    ['deco_flowers_2', 'deco_rock_1', 'deco_grass_tuft'],
  savanna:          ['deco_dry_bush', 'deco_grass_tuft', 'deco_bones'],
  mangrove:         ['deco_cattail', 'deco_lily_pad', 'deco_moss_rock'],
}

// --- Resource tables ---

interface ResourceDef {
  type: ResourceType
  density: number
  amount: number
  maxAmount: number
  regenRate: number
}

const BIOME_RESOURCES: Record<string, ResourceDef[]> = {
  temperate_forest: [
    { type: 'wood', density: 0.10, amount: 10, maxAmount: 10, regenRate: 0.01 },
    { type: 'herb', density: 0.025, amount: 4, maxAmount: 4, regenRate: 0.008 },
  ],
  alpine_forest: [
    { type: 'wood', density: 0.075, amount: 8, maxAmount: 8, regenRate: 0.008 },
  ],
  dense_forest: [
    { type: 'wood', density: 0.15, amount: 15, maxAmount: 15, regenRate: 0.012 },
    { type: 'herb', density: 0.045, amount: 6, maxAmount: 6, regenRate: 0.01 },
  ],
  grassland: [
    { type: 'food', density: 0.035, amount: 5, maxAmount: 5, regenRate: 0.02 },
    { type: 'herb', density: 0.015, amount: 3, maxAmount: 3, regenRate: 0.008 },
  ],
  meadow: [
    { type: 'food', density: 0.04, amount: 5, maxAmount: 5, regenRate: 0.02 },
    { type: 'herb', density: 0.03, amount: 4, maxAmount: 4, regenRate: 0.01 },
  ],
  farmland: [
    { type: 'food', density: 0.12, amount: 8, maxAmount: 8, regenRate: 0.025 },
  ],
  highland: [
    { type: 'stone', density: 0.075, amount: 10, maxAmount: 10, regenRate: 0.005 },
    { type: 'iron', density: 0.025, amount: 8, maxAmount: 8, regenRate: 0.003 },
  ],
  swamp: [
    { type: 'herb', density: 0.06, amount: 6, maxAmount: 6, regenRate: 0.015 },
    { type: 'food', density: 0.02, amount: 3, maxAmount: 3, regenRate: 0.01 },
  ],
  beach: [
    { type: 'food', density: 0.015, amount: 3, maxAmount: 3, regenRate: 0.015 },
  ],
  tundra: [
    { type: 'stone', density: 0.045, amount: 6, maxAmount: 6, regenRate: 0.004 },
  ],
  savanna: [
    { type: 'food', density: 0.025, amount: 4, maxAmount: 4, regenRate: 0.015 },
  ],
  desert: [
    { type: 'stone', density: 0.02, amount: 4, maxAmount: 4, regenRate: 0.003 },
  ],
}

const MOUNTAIN_ADJ_RESOURCES: ResourceDef[] = [
  { type: 'stone', density: 0.09, amount: 12, maxAmount: 12, regenRate: 0.005 },
  { type: 'iron', density: 0.035, amount: 10, maxAmount: 10, regenRate: 0.004 },
  { type: 'gold', density: 0.012, amount: 5, maxAmount: 5, regenRate: 0.002 },
]

// --- Elevation level classification ---

/** Classify raw elevation (0-1) into discrete level (0-4) */
function getElevationLevel(elev: number): number {
  if (elev < 0.18) return 0    // water
  if (elev < 0.40) return 1    // lowland
  if (elev < 0.58) return 2    // midland
  if (elev < 0.72) return 3    // highland
  return 4                      // peak
}

// --- Continental shape ---

/**
 * Compute radial gradient for continental shape.
 * Center is high (1.0), edges fall off to 0.0.
 * Uses WORLD_CENTER + WORLD_RADIUS + RADIAL_POWER.
 */
function radialGradient(wx: number, wy: number): number {
  const dx = wx - WORLD_CENTER_X
  const dy = wy - WORLD_CENTER_Y
  const dist = Math.sqrt(dx * dx + dy * dy) / WORLD_RADIUS
  return clamp(1.0 - Math.pow(dist, RADIAL_POWER), 0, 1)
}

/**
 * Latitude-based base temperature.
 * North (negative Y) = cold, South (positive Y) = warm.
 * Returns 0-1 range.
 */
function latitudeTemperature(wy: number): number {
  // Map from [-LATITUDE_EXTENT, +LATITUDE_EXTENT] to [0.05, 0.95]
  const t = (wy - WORLD_CENTER_Y + LATITUDE_EXTENT) / (2 * LATITUDE_EXTENT)
  return clamp(t * 0.9 + 0.05, 0.05, 0.95)
}

// --- Elevation sampling (reusable for cross-chunk features like rivers) ---

/** Sample world elevation at a given world coordinate. Deterministic for a given seed. */
export function getWorldElevation(wx: number, wy: number, seed: number): number {
  ensureNoise(seed)

  // Base fBm terrain
  const raw = fbm(noiseElev, wx * 0.03, wy * 0.03, {
    octaves: 6, persistence: 0.5, lacunarity: 2.0, scale: 1.0,
  })

  // Domain warping for organic shapes
  const warp = domainWarp(noiseWarp, wx, wy, { strength: 4.0, scale: 0.02 })
  const warped = fbm(noiseElev, (wx + warp.x) * 0.03, (wy + warp.y) * 0.03, {
    octaves: 6, persistence: 0.5, lacunarity: 2.0, scale: 1.0,
  })

  // Blend raw + warped
  let elev = Math.pow(lerp(raw, warped, 0.45), 1.2)

  // Continental shape: multiply by radial gradient
  const gradient = radialGradient(wx, wy)
  elev *= gradient

  // Mountain ridges for high areas
  if (elev > 0.50) {
    const ridge = ridgedFbm(noiseRidge, wx * 0.045, wy * 0.045, {
      octaves: 4, persistence: 0.5, lacunarity: 2.1, scale: 1.0,
    })
    if (ridge > 0.55) {
      elev = Math.max(elev, 0.65 + (ridge - 0.55) * 0.8)
    }
  }

  return clamp(elev, 0, 1)
}

// --- Density noise for clustering objects ---

/**
 * Per-biome density multiplier based on noise.
 * Creates zones of dense/sparse/clearing within each biome.
 * Returns 0-1 where 0 = completely bare, 1 = maximum density.
 */
function getDensityMultiplier(wx: number, wy: number, biome: string): number {
  // Large-scale density clusters
  const d1 = fbm(noiseDensity, wx * 0.04, wy * 0.04, { octaves: 3, scale: 1.0 })
  // Small-scale variation
  const d2 = noiseDensity.sample(wx * 0.12, wy * 0.12) * 0.5 + 0.5

  const base = d1 * 0.7 + d2 * 0.3

  // Per-biome density profiles
  switch (biome) {
    case 'dense_forest':
      // Dense zones (70-90%) with occasional clearings (0%)
      if (base < 0.15) return 0          // clearing
      if (base < 0.35) return 0.3        // sparse
      return 0.7 + base * 0.3            // dense
    case 'temperate_forest':
    case 'alpine_forest':
      if (base < 0.2) return 0.05        // small clearing
      if (base < 0.45) return 0.25       // sparse
      return 0.5 + base * 0.4            // moderate-dense
    case 'grassland':
    case 'savanna':
      // Mostly empty (5-15%) with occasional lone tree
      return base < 0.7 ? 0.05 : base * 0.3
    case 'meadow':
    case 'alpine_meadow':
      // Light density, flower patches
      return base < 0.4 ? 0.08 : base * 0.35
    case 'desert':
      // Very sparse (3-8%), cactus clusters
      return base < 0.8 ? 0.03 : base * 0.15
    case 'tundra':
      // Sparse rocky (5-10%)
      return base < 0.6 ? 0.04 : base * 0.2
    case 'highland':
    case 'mountain':
      // Rocky (40-60% rocks at high elev)
      return 0.3 + base * 0.35
    case 'snow_peak':
      return base < 0.7 ? 0.02 : 0.1
    case 'swamp':
    case 'mangrove':
      // Moderate density, organic
      return 0.15 + base * 0.4
    case 'beach':
      // Light decorations
      return base < 0.5 ? 0.05 : base * 0.2
    default:
      return base * 0.3
  }
}

// --- Main chunk generation ---

export function generateChunk(cx: number, cy: number, seed: number): ChunkData {
  ensureNoise(seed)
  const S = CHUNK_SIZE

  const tiles: Tile[][] = []
  const biomeGrid: string[][] = []

  for (let ly = 0; ly < S; ly++) {
    const row: Tile[] = []
    const biomeRow: string[] = []

    for (let lx = 0; lx < S; lx++) {
      const wx = cx * S + lx
      const wy = cy * S + ly

      // --- Elevation with continental shape ---
      const elev = getWorldElevation(wx, wy, seed)
      const elevLevel = getElevationLevel(elev)

      // --- Temperature: latitude gradient + noise perturbation + altitude cooling ---
      const latTemp = latitudeTemperature(wy)
      const tempNoise = fbm(noiseTemp, wx * 0.015, wy * 0.015, {
        octaves: 4, persistence: 0.45, scale: 1.0,
      })
      const altCooling = Math.max(0, (elev - 0.45) * 0.7)
      // Blend: 60% latitude, 30% noise, then subtract altitude cooling
      const temp = clamp(latTemp * 0.6 + tempNoise * 0.4 - altCooling, 0, 1)

      // --- Moisture: noise + elevation-based reduction ---
      const moistNoise = fbm(noiseMoist, wx * 0.04, wy * 0.04, {
        octaves: 5, persistence: 0.5, scale: 1.0,
      })
      const moistReduction = Math.max(0, (elev - 0.60) * 0.5)
      const moist = clamp(moistNoise - moistReduction, 0, 1)

      // --- Biome classification ---
      const rule = classifyBiome(elev, temp, moist)

      // Weighted variant
      const coordHash = ((wx * 374761393) ^ (wy * 668265263)) >>> 0
      const variant = getWeightedVariant(rule.biome, coordHash)

      // --- Decoration with density clustering ---
      let decoration: string | undefined
      const density = getDensityMultiplier(wx, wy, rule.biome)
      const baseDecoRate = BIOME_DECO_RATE[rule.biome] ?? 0
      const effectiveDecoRate = baseDecoRate * density

      if (effectiveDecoRate > 0) {
        // Spatial clustering via noise
        const decoNoise = noiseDeco.sample(wx * 0.15, wy * 0.15)
        if (decoNoise > 0.2) {
          const decoChance = ((coordHash >>> 16) & 0xFFFF) / 0xFFFF
          if (decoChance < effectiveDecoRate) {
            const decos = BIOME_DECORATIONS[rule.biome]
            if (decos && decos.length > 0) {
              const decoIdx = Math.abs(Math.floor((decoNoise * 1000) % decos.length))
              decoration = decos[decoIdx]
            }
          }
        }
      }

      // --- Tile assembly ---
      let tileType = rule.tileType
      let walkable = false
      let cost = MOVEMENT_COSTS[rule.tileType] ?? 1.0

      if (rule.tileType === 'river') {
        walkable = false
        cost = 0
        const riverDecoNoise = noiseDeco.sample(wx * 0.15, wy * 0.15)
        if (riverDecoNoise > 0.7) decoration = 'ripple'
      } else {
        walkable = cost > 0
      }

      const tile: Tile = {
        id: `tile_${wx}_${wy}`,
        type: tileType,
        position: { x: wx, y: wy },
        walkable,
        movementCost: cost,
        biome: rule.biome,
        elevation: elev,
        elevationLevel: elevLevel,
        variant,
        decoration,
      }

      row.push(tile)
      biomeRow.push(rule.biome)
    }

    tiles.push(row)
    biomeGrid.push(biomeRow)
  }

  // Step 2: Cellular automata smoothing (inner area only)
  smoothChunkTiles(tiles, S)

  // Step 3: Place cliff tiles at elevation transitions
  placeCliffTiles(tiles, S, cx, cy, seed)

  // Step 4: POI placement attempt (before resources so clear zone can be enforced)
  const poi = tryPlacePOI(tiles, biomeGrid, cx, cy, seed)

  // Step 4b: Clear decorations within POI clear zone (3-tile radius)
  if (poi) {
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const ny = poi.localY + dy
        const nx = poi.localX + dx
        if (nx >= 0 && nx < S && ny >= 0 && ny < S) {
          tiles[ny][nx].decoration = undefined
        }
      }
    }
  }

  // Step 5: Resource scattering (respects POI clear zone, density clustering)
  scatterChunkResources(tiles, biomeGrid, cx, cy, seed, poi)

  return { cx, cy, tiles, poi, generated: true }
}

// --- Cliff tile placement ---

/**
 * Scan for tiles where elevation level changes by 1+ from neighbors.
 * Place 'cliff' tiles at the lower side of the transition.
 */
function placeCliffTiles(tiles: Tile[][], size: number, cx: number, cy: number, seed: number): void {
  const changes: { lx: number; ly: number }[] = []

  for (let ly = 0; ly < size; ly++) {
    for (let lx = 0; lx < size; lx++) {
      const tile = tiles[ly][lx]
      if (!tile.elevationLevel || tile.type === 'water' || tile.type === 'deep_water') continue

      // Check if any neighbor has elevation level >= current + 2
      let maxNeighborLevel = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          const nx = lx + dx, ny = ly + dy
          if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue
          const nLevel = tiles[ny][nx].elevationLevel ?? 0
          if (nLevel > maxNeighborLevel) maxNeighborLevel = nLevel
        }
      }

      // Place cliff at the lower tile when there's a 2+ level jump
      if (maxNeighborLevel >= (tile.elevationLevel ?? 0) + 2) {
        changes.push({ lx, ly })
      }
    }
  }

  for (const { lx, ly } of changes) {
    const tile = tiles[ly][lx]
    // Only convert land tiles to cliff (not water, not buildings)
    if (tile.type !== 'water' && tile.type !== 'deep_water' && tile.type !== 'building' && tile.type !== 'road') {
      tile.type = 'cliff'
      tile.walkable = false
      tile.movementCost = 0
      tile.decoration = undefined
    }
  }
}

// --- Cellular automata smoothing ---

function smoothChunkTiles(tiles: Tile[][], size: number): void {
  const PROTECTED: Set<TileType> = new Set([
    'water', 'deep_water', 'river', 'road', 'building', 'cliff', 'lava', 'ice',
  ])

  const changes: { lx: number; ly: number; type: TileType; biome: string }[] = []

  for (let ly = 1; ly < size - 1; ly++) {
    for (let lx = 1; lx < size - 1; lx++) {
      const current = tiles[ly][lx]
      if (PROTECTED.has(current.type)) continue

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
          if (PROTECTED.has(type)) continue
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
  poi?: ChunkPOI,
): void {
  const S = CHUNK_SIZE
  const rng = seededRandom(hashChunk(cx, cy, seed + 9999))

  const POI_CLEAR_RADIUS = 3
  const ROAD_BUFFER = 1

  for (let ly = 0; ly < S; ly++) {
    for (let lx = 0; lx < S; lx++) {
      const tile = tiles[ly][lx]
      if (!tile.walkable || tile.resource || tile.type === 'road' || tile.type === 'building') continue

      const wx = cx * S + lx
      const wy = cy * S + ly
      const biome = biomeGrid[ly]?.[lx] ?? 'grassland'

      // POI clear zone
      if (poi) {
        const dx = Math.abs(lx - poi.localX)
        const dy = Math.abs(ly - poi.localY)
        if (dx <= POI_CLEAR_RADIUS && dy <= POI_CLEAR_RADIUS) continue
      }

      // Road buffer
      let nearRoad = false
      for (let dy = -ROAD_BUFFER; dy <= ROAD_BUFFER && !nearRoad; dy++) {
        for (let dx = -ROAD_BUFFER; dx <= ROAD_BUFFER && !nearRoad; dx++) {
          if (dx === 0 && dy === 0) continue
          const nx = lx + dx, ny = ly + dy
          if (nx >= 0 && nx < S && ny >= 0 && ny < S) {
            if (tiles[ny][nx].type === 'road') nearRoad = true
          }
        }
      }
      if (nearRoad) continue

      // Density-based resource placement
      const density = getDensityMultiplier(wx, wy, biome)
      if (density < 0.05) continue // too sparse for resources

      // Mountain adjacency bonus
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
        if (cluster < 0.60) continue // clustering threshold
        const effectiveDensity = res.density * (0.5 + density * 0.5)
        if (rng() < effectiveDensity) {
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

  // ~30% of chunks get a POI
  const poiVal = noisePoi.sample(cx * 0.8, cy * 0.8)
  if (poiVal < 0.2) return undefined

  // Don't place POI on water/cliff-dominated chunks
  let walkableCount = 0
  for (let ly = 4; ly < S - 4; ly++) {
    for (let lx = 4; lx < S - 4; lx++) {
      if (tiles[ly][lx].walkable) walkableCount++
    }
  }
  if (walkableCount < 20) return undefined

  // Find walkable position near chunk center
  const center = Math.floor(S / 2)
  let bestPos: { lx: number; ly: number } | null = null

  for (let r = 0; r <= 4 && !bestPos; r++) {
    for (let dy = -r; dy <= r && !bestPos; dy++) {
      for (let dx = -r; dx <= r && !bestPos; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue
        const lx = center + dx
        const ly = center + dy
        if (lx < 2 || lx >= S - 2 || ly < 2 || ly >= S - 2) continue
        if (tiles[ly][lx].walkable) {
          bestPos = { lx, ly }
        }
      }
    }
  }

  if (!bestPos) return undefined

  const biome = biomeGrid[bestPos.ly][bestPos.lx] ?? 'grassland'
  const rng = seededRandom(hashChunk(cx, cy, seed + 5555))

  const affinities = POI_BIOME_AFFINITY[biome] ?? ['marketplace', 'tavern']
  const poiType = affinities[Math.floor(rng() * affinities.length)]

  const adj = ADJECTIVES[Math.floor(rng() * ADJECTIVES.length)]
  const nouns = NOUNS[poiType]
  const noun = nouns[Math.floor(rng() * nouns.length)]

  tiles[bestPos.ly][bestPos.lx].type = 'building'
  tiles[bestPos.ly][bestPos.lx].walkable = true
  tiles[bestPos.ly][bestPos.lx].poiType = poiType
  tiles[bestPos.ly][bestPos.lx].movementCost = MOVEMENT_COSTS['building'] ?? 1.0

  return { name: `${adj} ${noun}`, type: poiType, localX: bestPos.lx, localY: bestPos.ly, biome }
}
