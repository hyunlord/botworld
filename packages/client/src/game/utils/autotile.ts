import type { Tile, TileType } from '@botworld/shared'

/**
 * Autotiling system for smooth biome transitions.
 *
 * Uses 8-directional neighbor bitflags to select the correct
 * transition tile (shores, corners, road directions, cliff edges).
 * Computed once per chunk paint and cached.
 */

// ── Neighbor direction bitflags ──

export const DIR_N  = 1 << 0  // 1
export const DIR_NE = 1 << 1  // 2
export const DIR_E  = 1 << 2  // 4
export const DIR_SE = 1 << 3  // 8
export const DIR_S  = 1 << 4  // 16
export const DIR_SW = 1 << 5  // 32
export const DIR_W  = 1 << 6  // 64
export const DIR_NW = 1 << 7  // 128

// Cardinal-only mask
const CARD = DIR_N | DIR_E | DIR_S | DIR_W

// ── Tile indices from terrain-tiles.json ──

const T = {
  // Grass
  grass_1: 0, grass_2: 1, grass_3: 2, grass_tall: 3,
  dark_grass: 13,
  // Dirt / Sand / Snow
  dirt_1: 4, dirt_2: 5,
  sand_1: 6, sand_2: 7,
  snow_1: 8, snow_2: 9,
  // Special ground
  stone_floor: 10, farmland: 11, swamp: 12, cave_floor: 14,
  // Water
  water_deep: 16, water_shallow: 17,
  water_shore_N: 18, water_shore_S: 19,
  water_shore_E: 20, water_shore_W: 21,
  water_shore_NE: 22, water_shore_NW: 23,
  water_shore_SE: 24, water_shore_SW: 25,
  water_shore_inner_NE: 26, water_shore_inner_NW: 27,
  water_shore_inner_SE: 28, water_shore_inner_SW: 29,
  water_river_H: 30, water_river_V: 31,
  // Roads
  road_dirt_H: 32, road_dirt_V: 33, road_dirt_cross: 34,
  road_dirt_turn_NE: 35, road_dirt_turn_NW: 36,
  road_dirt_turn_SE: 37, road_dirt_turn_SW: 38,
  road_stone_H: 39, road_stone_V: 40, road_stone_cross: 41,
  bridge_H: 42, bridge_V: 43,
  // Cliffs
  cliff_N: 48, cliff_S: 49, cliff_E: 50, cliff_W: 51,
  cliff_NE: 52, cliff_NW: 53, cliff_SE: 54, cliff_SW: 55,
  mountain_top: 56, mountain_snow: 57,
} as const

// ── Tile getter type (cross-chunk aware) ──

export type TileGetter = (x: number, y: number) => Tile | null

// ── Neighbor flag computation ──

/** Offsets for 8 directions in flag-bit order */
const DIR_OFFSETS: readonly [number, number][] = [
  [ 0, -1], // N
  [ 1, -1], // NE
  [ 1,  0], // E
  [ 1,  1], // SE
  [ 0,  1], // S
  [-1,  1], // SW
  [-1,  0], // W
  [-1, -1], // NW
]

/**
 * Compute 8-directional neighbor flags.
 * A bit is SET (1) if the neighbor matches the predicate.
 */
export function getNeighborFlags(
  getTile: TileGetter,
  x: number,
  y: number,
  matchFn: (neighbor: Tile | null) => boolean,
): number {
  let flags = 0
  for (let i = 0; i < 8; i++) {
    const [dx, dy] = DIR_OFFSETS[i]
    if (matchFn(getTile(x + dx, y + dy))) {
      flags |= (1 << i)
    }
  }
  return flags
}

// ── Match predicates ──

const WATER_TYPES: ReadonlySet<TileType> = new Set(['water', 'deep_water', 'river'])

function isWaterType(tile: Tile | null): boolean {
  return tile !== null && WATER_TYPES.has(tile.type)
}

function isRoadType(tile: Tile | null): boolean {
  return tile !== null && tile.type === 'road'
}

function isMountainType(tile: Tile | null): boolean {
  return tile !== null && tile.type === 'mountain'
}

// ── Water autotiling ──

/**
 * For a WATER tile, pick the correct shore/corner/deep tile
 * based on which neighbors are also water.
 *
 * Convention: a bit is SET if the neighbor IS water.
 * Shore tiles are used where the water meets land.
 */
function getWaterAutoTile(flags: number, tileType: TileType): number {
  const n = flags & DIR_N
  const e = flags & DIR_E
  const s = flags & DIR_S
  const w = flags & DIR_W

  // Count how many cardinal neighbors are NOT water (= land)
  const landN = !n
  const landE = !e
  const landS = !s
  const landW = !w

  const landCardinals = (landN ? 1 : 0) + (landE ? 1 : 0) + (landS ? 1 : 0) + (landW ? 1 : 0)

  // Peninsula or isolated water (3-4 cardinal sides are land) → shallow
  if (landCardinals >= 3) return T.water_shallow

  // Two adjacent cardinal sides are land → outer corner
  if (landCardinals === 2) {
    if (landN && landE) return T.water_shore_NE
    if (landN && landW) return T.water_shore_NW
    if (landS && landE) return T.water_shore_SE
    if (landS && landW) return T.water_shore_SW
    // Two opposite sides are land (N+S or E+W) → strait, use shallow
    if (landN && landS) return T.water_shore_N // narrow N-S channel
    if (landE && landW) return T.water_shore_E // narrow E-W channel
  }

  // One cardinal side is land → edge shore
  if (landCardinals === 1) {
    if (landN) return T.water_shore_N
    if (landE) return T.water_shore_E
    if (landS) return T.water_shore_S
    if (landW) return T.water_shore_W
  }

  // All 4 cardinal neighbors are water → check diagonals for inner corners
  // Inner corner = land peeking from a diagonal while all cardinals are water
  const ne = flags & DIR_NE
  const nw = flags & DIR_NW
  const se = flags & DIR_SE
  const sw = flags & DIR_SW

  // Pick first inner corner found (prioritize one if multiple exist)
  if (!ne) return T.water_shore_inner_NE
  if (!nw) return T.water_shore_inner_NW
  if (!se) return T.water_shore_inner_SE
  if (!sw) return T.water_shore_inner_SW

  // Fully surrounded by water
  return tileType === 'deep_water' ? T.water_deep : T.water_shallow
}

// ── River autotiling ──

/**
 * For a RIVER tile, check neighbor rivers to pick H vs V direction.
 */
function getRiverAutoTile(flags: number): number {
  const n = flags & DIR_N
  const e = flags & DIR_E
  const s = flags & DIR_S
  const w = flags & DIR_W

  // Check which cardinal directions have water/river neighbors
  const hasNS = (n || s)
  const hasEW = (e || w)

  if (hasNS && !hasEW) return T.water_river_V
  if (hasEW && !hasNS) return T.water_river_H
  // Both or neither → default to horizontal
  return T.water_river_H
}

// ── Road autotiling ──

/**
 * For a ROAD tile, pick H/V/cross/turn based on adjacent roads.
 */
function getRoadAutoTile(flags: number, isStone: boolean): number {
  const n = !!(flags & DIR_N)
  const e = !!(flags & DIR_E)
  const s = !!(flags & DIR_S)
  const w = !!(flags & DIR_W)

  const connections = (n ? 1 : 0) + (e ? 1 : 0) + (s ? 1 : 0) + (w ? 1 : 0)

  if (isStone) {
    // Stone roads: H, V, cross only
    if (connections >= 3) return T.road_stone_cross
    if (n && s) return T.road_stone_V
    if (e && w) return T.road_stone_H
    if (n || s) return T.road_stone_V
    return T.road_stone_H
  }

  // Dirt roads: H, V, cross, and 4 turns
  if (connections >= 3) return T.road_dirt_cross

  // Straight roads
  if (n && s && !e && !w) return T.road_dirt_V
  if (e && w && !n && !s) return T.road_dirt_H

  // L-turns (exactly 2 adjacent cardinal connections)
  if (n && e && !s && !w) return T.road_dirt_turn_NE
  if (n && w && !s && !e) return T.road_dirt_turn_NW
  if (s && e && !n && !w) return T.road_dirt_turn_SE
  if (s && w && !n && !e) return T.road_dirt_turn_SW

  // Dead-ends or isolated
  if (n || s) return T.road_dirt_V
  if (e || w) return T.road_dirt_H

  // Isolated road tile
  return T.road_dirt_cross
}

// ── Cliff / Mountain autotiling ──

/**
 * For a MOUNTAIN tile, pick the correct cliff edge/corner
 * based on which neighbors are also mountains.
 * A bit is SET if the neighbor IS a mountain.
 */
function getCliffAutoTile(flags: number, variant: number): number {
  const n = flags & DIR_N
  const e = flags & DIR_E
  const s = flags & DIR_S
  const w = flags & DIR_W

  const landN = !n
  const landE = !e
  const landS = !s
  const landW = !w

  const landCardinals = (landN ? 1 : 0) + (landE ? 1 : 0) + (landS ? 1 : 0) + (landW ? 1 : 0)

  // Interior mountain
  if (landCardinals === 0) {
    return variant >= 2 ? T.mountain_top : T.mountain_snow
  }

  // Corner cliffs (2 adjacent sides exposed)
  if (landCardinals >= 2) {
    if (landN && landE) return T.cliff_NE
    if (landN && landW) return T.cliff_NW
    if (landS && landE) return T.cliff_SE
    if (landS && landW) return T.cliff_SW
  }

  // Edge cliffs
  if (landN) return T.cliff_N
  if (landS) return T.cliff_S
  if (landE) return T.cliff_E
  if (landW) return T.cliff_W

  return T.stone_floor
}

// ── Bridge detection ──

function getBridgeTile(getTile: TileGetter, x: number, y: number): number | null {
  // A road tile over water becomes a bridge
  const tileN = getTile(x, y - 1)
  const tileS = getTile(x, y + 1)
  const tileE = getTile(x + 1, y)
  const tileW = getTile(x - 1, y)

  const waterN = isWaterType(tileN)
  const waterS = isWaterType(tileS)
  const waterE = isWaterType(tileE)
  const waterW = isWaterType(tileW)

  // Bridge over E-W water (road goes N-S)
  if (waterE && waterW) return T.bridge_V
  // Bridge over N-S water (road goes E-W)
  if (waterN && waterS) return T.bridge_H

  return null
}

// ── Main entry point ──

/**
 * Get the autotile-aware ground tile index for a tile.
 * Falls back to basic tile mapping for types without autotile support.
 */
export function getAutoTileIndex(
  tile: Tile,
  getTile: TileGetter,
): number {
  const x = tile.position.x
  const y = tile.position.y
  const variant = tile.variant ?? 0
  const biome = tile.biome ?? ''

  switch (tile.type) {
    case 'water':
    case 'deep_water': {
      const flags = getNeighborFlags(getTile, x, y, isWaterType)
      return getWaterAutoTile(flags, tile.type)
    }

    case 'river': {
      // Rivers check water+river neighbors for direction
      const flags = getNeighborFlags(getTile, x, y, isWaterType)
      return getRiverAutoTile(flags)
    }

    case 'road': {
      // Check if this road is a bridge
      const bridgeTile = getBridgeTile(getTile, x, y)
      if (bridgeTile !== null) return bridgeTile

      const isStone = !!tile.poiType
      const flags = getNeighborFlags(getTile, x, y, isRoadType)
      return getRoadAutoTile(flags, isStone)
    }

    case 'mountain': {
      const flags = getNeighborFlags(getTile, x, y, isMountainType)
      return getCliffAutoTile(flags, variant)
    }

    // ── Non-autotiled types (same as original getGroundTileIndex) ──

    case 'grass':
      if (tile.decoration?.includes('flower') || variant === 2) return T.grass_3
      return variant >= 1 ? T.grass_2 : T.grass_1

    case 'forest':
    case 'dense_forest':
      return T.dark_grass

    case 'sand':
      if (biome === 'beach' || biome === 'coast') return T.sand_1
      return variant >= 1 ? T.sand_2 : T.sand_1

    case 'snow':
      return variant >= 1 ? T.snow_2 : T.snow_1

    case 'swamp':
      return T.swamp

    case 'farmland':
      return T.farmland

    default:
      return T.grass_1
  }
}
