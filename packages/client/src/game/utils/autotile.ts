import type { Tile, TileType } from '@botworld/shared'

/**
 * Autotiling system for smooth biome transitions.
 *
 * Uses 8-directional neighbor bitflags to select the correct
 * transition tile (shores, corners, road directions, cliff edges).
 * Computed once per chunk paint and cached.
 *
 * Tile indices match iso-terrain-tiles.json (v3 spritesheet: 14 rows × 16 cols = 224 tiles)
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

// ── Tile indices from iso-terrain-tiles.json (v3 spritesheet) ──

const T = {
  // Row 0: Grass variants (0-15)
  grass_lush_01: 0, grass_lush_02: 1, grass_lush_03: 2, grass_lush_04: 3, grass_lush_05: 4,
  grass_dry_01: 5, grass_dry_02: 6, grass_dry_03: 7,
  grass_dark_01: 8, grass_dark_02: 9, grass_dark_03: 10,
  dirt_01: 11, dirt_02: 12, dirt_03: 13,
  dirt_path_01: 14, dirt_path_02: 15,

  // Row 1: Sand, snow, stone (16-31)
  sand_01: 16, sand_02: 17, sand_03: 18,
  sand_wet_01: 19, sand_wet_02: 20,
  snow_01: 21, snow_02: 22, snow_03: 23,
  snow_dirty_01: 24, snow_dirty_02: 25,
  stone_01: 26, stone_02: 27, stone_03: 28,
  stone_cobble_01: 29, stone_cobble_02: 30, stone_cobble_03: 31,

  // Row 2: Farmland, swamp, cave, water deep/shallow (32-47)
  farmland_01: 32, farmland_02: 33, farmland_03: 34,
  swamp_01: 35, swamp_02: 36,
  cave_01: 37, cave_02: 38,
  water_deep_01: 39, water_deep_02: 40, water_deep_03: 41,
  water_shallow_01: 42, water_shallow_02: 43, water_shallow_03: 44,
  water_shore_N: 45, water_shore_S: 46, water_shore_E: 47,

  // Row 3: Water shores, rivers (48-63)
  water_shore_W: 48,
  water_shore_NE: 49, water_shore_NW: 50, water_shore_SE: 51, water_shore_SW: 52,
  water_shore_inner_NE: 53, water_shore_inner_NW: 54, water_shore_inner_SE: 55, water_shore_inner_SW: 56,
  water_river_H: 57, water_river_V: 58,
  water_river_turn_NE: 59, water_river_turn_NW: 60, water_river_turn_SE: 61, water_river_turn_SW: 62,
  water_river_cross: 63,

  // Row 4: Roads (64-79)
  road_dirt_H: 64, road_dirt_V: 65, road_dirt_cross: 66,
  road_dirt_turn_NE: 67, road_dirt_turn_NW: 68, road_dirt_turn_SE: 69, road_dirt_turn_SW: 70,
  road_stone_H: 71, road_stone_V: 72, road_stone_cross: 73,
  road_stone_turn_NE: 74, road_stone_turn_NW: 75, road_stone_turn_SE: 76, road_stone_turn_SW: 77,
  road_stone_end_N: 78, road_stone_end_S: 79,

  // Row 5: Cliffs, mountains (80-95)
  cliff_face_N: 80, cliff_face_S: 81, cliff_face_E: 82, cliff_face_W: 83,
  cliff_top_01: 84, cliff_top_02: 85, cliff_top_03: 86,
  cliff_edge_N: 87, cliff_edge_S: 88, cliff_edge_E: 89, cliff_edge_W: 90,
  mountain_rock_01: 91, mountain_rock_02: 92, mountain_rock_03: 93,

  // Row 7+: Road T-junctions, ends (120-133)
  road_dirt_T_N: 121, road_dirt_T_S: 122, road_dirt_T_E: 123,
  road_dirt_end_N: 124, road_dirt_end_S: 125, road_dirt_end_E: 126, road_dirt_end_W: 127,
  road_stone_T_N: 128, road_stone_T_S: 129, road_stone_T_E: 130, road_stone_T_W: 131,

  // Row 9+: Extended terrain types (144+)
  forest_floor_01: 144, forest_floor_02: 145, forest_floor_03: 146,
  beach_shell_01: 147, beach_shell_02: 148,
  gravel_01: 151, gravel_02: 152, gravel_03: 153,
  lava_rock_01: 154, lava_rock_02: 155,
  ice_01: 164, ice_02: 165, ice_03: 166,

  // Row 11+: Cliff corners, mountain snow, special (173+)
  cliff_corner_NE: 173, cliff_corner_NW: 174, cliff_corner_SE: 175, cliff_corner_SW: 176,
  mountain_snow_01: 177, mountain_snow_02: 178, mountain_snow_03: 179,
  volcanic_01: 180, volcanic_02: 181,
  bridge_stone_01: 182, bridge_stone_02: 183,
  ruins_floor_01: 184, ruins_floor_02: 185, ruins_floor_03: 186,
  magic_ground_01: 187, magic_ground_02: 188,
  meadow_01: 189, meadow_02: 190, meadow_03: 191,
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
  return tile !== null && (tile.type === 'mountain' || tile.type === 'cliff')
}

// ── Variant picker ──

function pickVariant(base: number, count: number, variant: number): number {
  return base + (variant % count)
}

// ── Water autotiling ──

function getWaterAutoTile(flags: number, tileType: TileType): number {
  const n = flags & DIR_N
  const e = flags & DIR_E
  const s = flags & DIR_S
  const w = flags & DIR_W

  const landN = !n
  const landE = !e
  const landS = !s
  const landW = !w

  const landCardinals = (landN ? 1 : 0) + (landE ? 1 : 0) + (landS ? 1 : 0) + (landW ? 1 : 0)

  // Peninsula or isolated water → shallow
  if (landCardinals >= 3) return T.water_shallow_01

  // Two adjacent cardinal sides are land → outer corner
  if (landCardinals === 2) {
    if (landN && landE) return T.water_shore_NE
    if (landN && landW) return T.water_shore_NW
    if (landS && landE) return T.water_shore_SE
    if (landS && landW) return T.water_shore_SW
    // Two opposite sides → narrow channel
    if (landN && landS) return T.water_shore_N
    if (landE && landW) return T.water_shore_E
  }

  // One cardinal side is land → edge shore
  if (landCardinals === 1) {
    if (landN) return T.water_shore_N
    if (landE) return T.water_shore_E
    if (landS) return T.water_shore_S
    if (landW) return T.water_shore_W
  }

  // All 4 cardinal neighbors are water → check diagonals for inner corners
  const ne = flags & DIR_NE
  const nw = flags & DIR_NW
  const se = flags & DIR_SE
  const sw = flags & DIR_SW

  if (!ne) return T.water_shore_inner_NE
  if (!nw) return T.water_shore_inner_NW
  if (!se) return T.water_shore_inner_SE
  if (!sw) return T.water_shore_inner_SW

  // Fully surrounded by water
  return tileType === 'deep_water' ? T.water_deep_01 : T.water_shallow_01
}

// ── River autotiling ──

function getRiverAutoTile(flags: number): number {
  const n = !!(flags & DIR_N)
  const e = !!(flags & DIR_E)
  const s = !!(flags & DIR_S)
  const w = !!(flags & DIR_W)

  const connections = (n ? 1 : 0) + (e ? 1 : 0) + (s ? 1 : 0) + (w ? 1 : 0)

  // Cross (3+ connections)
  if (connections >= 3) return T.water_river_cross

  // Turns (2 adjacent connections)
  if (n && e && !s && !w) return T.water_river_turn_NE
  if (n && w && !s && !e) return T.water_river_turn_NW
  if (s && e && !n && !w) return T.water_river_turn_SE
  if (s && w && !n && !e) return T.water_river_turn_SW

  // Straight
  const hasNS = (n || s)
  const hasEW = (e || w)
  if (hasNS && !hasEW) return T.water_river_V
  if (hasEW && !hasNS) return T.water_river_H

  // Both or neither → default horizontal
  return T.water_river_H
}

// ── Road autotiling ──

function getRoadAutoTile(flags: number, isStone: boolean): number {
  const n = !!(flags & DIR_N)
  const e = !!(flags & DIR_E)
  const s = !!(flags & DIR_S)
  const w = !!(flags & DIR_W)

  const connections = (n ? 1 : 0) + (e ? 1 : 0) + (s ? 1 : 0) + (w ? 1 : 0)

  if (isStone) {
    // 4-way cross
    if (connections >= 4) return T.road_stone_cross
    // T-junctions
    if (connections === 3) {
      if (!n) return T.road_stone_T_S
      if (!s) return T.road_stone_T_N
      if (!e) return T.road_stone_T_W
      return T.road_stone_T_E
    }
    // Turns
    if (n && e && !s && !w) return T.road_stone_turn_NE
    if (n && w && !s && !e) return T.road_stone_turn_NW
    if (s && e && !n && !w) return T.road_stone_turn_SE
    if (s && w && !n && !e) return T.road_stone_turn_SW
    // Straight
    if (n && s) return T.road_stone_V
    if (e && w) return T.road_stone_H
    if (n || s) return T.road_stone_V
    return T.road_stone_H
  }

  // Dirt roads
  if (connections >= 4) return T.road_dirt_cross
  // T-junctions
  if (connections === 3) {
    if (!n) return T.road_dirt_T_S
    if (!s) return T.road_dirt_T_N
    if (!e) return T.road_dirt_T_E  // missing W junction, use E
    return T.road_dirt_T_E
  }
  // Straight
  if (n && s && !e && !w) return T.road_dirt_V
  if (e && w && !n && !s) return T.road_dirt_H
  // L-turns
  if (n && e && !s && !w) return T.road_dirt_turn_NE
  if (n && w && !s && !e) return T.road_dirt_turn_NW
  if (s && e && !n && !w) return T.road_dirt_turn_SE
  if (s && w && !n && !e) return T.road_dirt_turn_SW
  // Dead-ends
  if (connections === 1) {
    if (n) return T.road_dirt_end_N
    if (s) return T.road_dirt_end_S
    if (e) return T.road_dirt_end_E
    return T.road_dirt_end_W
  }
  if (n || s) return T.road_dirt_V
  if (e || w) return T.road_dirt_H
  return T.road_dirt_cross
}

// ── Cliff / Mountain autotiling ──

function getCliffAutoTile(flags: number, variant: number, biome: string): number {
  const n = flags & DIR_N
  const e = flags & DIR_E
  const s = flags & DIR_S
  const w = flags & DIR_W

  const landN = !n
  const landE = !e
  const landS = !s
  const landW = !w

  const landCardinals = (landN ? 1 : 0) + (landE ? 1 : 0) + (landS ? 1 : 0) + (landW ? 1 : 0)

  // Interior mountain (fully surrounded)
  if (landCardinals === 0) {
    if (biome === 'snow_peak') return pickVariant(T.mountain_snow_01, 3, variant)
    return pickVariant(T.mountain_rock_01, 3, variant)
  }

  // Corner cliffs (2 adjacent sides exposed)
  if (landCardinals >= 2) {
    if (landN && landE) return T.cliff_corner_NE
    if (landN && landW) return T.cliff_corner_NW
    if (landS && landE) return T.cliff_corner_SE
    if (landS && landW) return T.cliff_corner_SW
  }

  // Edge cliffs (cliff face visible from one direction)
  if (landN) return T.cliff_face_N
  if (landS) return T.cliff_face_S
  if (landE) return T.cliff_face_E
  if (landW) return T.cliff_face_W

  return pickVariant(T.cliff_top_01, 3, variant)
}

// ── Bridge detection ──

function getBridgeTile(getTile: TileGetter, x: number, y: number): number | null {
  const tileN = getTile(x, y - 1)
  const tileS = getTile(x, y + 1)
  const tileE = getTile(x + 1, y)
  const tileW = getTile(x - 1, y)

  const waterN = isWaterType(tileN)
  const waterS = isWaterType(tileS)
  const waterE = isWaterType(tileE)
  const waterW = isWaterType(tileW)

  // Bridge over E-W water (road goes N-S)
  if (waterE && waterW) return T.bridge_stone_02
  // Bridge over N-S water (road goes E-W)
  if (waterN && waterS) return T.bridge_stone_01

  return null
}

// ── Main entry point ──

/**
 * Get the autotile-aware ground tile index for a tile.
 * Uses v3 spritesheet indices from iso-terrain-tiles.json.
 * Handles ALL tile types including autotiled transitions.
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
    // ── Autotiled types (neighbor-aware) ──

    case 'water':
    case 'deep_water': {
      const flags = getNeighborFlags(getTile, x, y, isWaterType)
      return getWaterAutoTile(flags, tile.type)
    }

    case 'river': {
      const flags = getNeighborFlags(getTile, x, y, isWaterType)
      return getRiverAutoTile(flags)
    }

    case 'road': {
      const bridgeTile = getBridgeTile(getTile, x, y)
      if (bridgeTile !== null) return bridgeTile
      const isStone = !!tile.poiType
      const flags = getNeighborFlags(getTile, x, y, isRoadType)
      return getRoadAutoTile(flags, isStone)
    }

    case 'mountain': {
      const flags = getNeighborFlags(getTile, x, y, isMountainType)
      return getCliffAutoTile(flags, variant, biome)
    }

    // ── Non-autotiled types (variant-based) ──

    case 'grass':
      if (tile.decoration?.includes('flower')) return pickVariant(T.meadow_01, 3, variant)
      if (biome === 'savanna' || biome === 'highland') return pickVariant(T.grass_dry_01, 3, variant)
      if (biome === 'dry' || biome === 'plains_edge') return pickVariant(T.grass_dry_01, 3, variant)
      return pickVariant(T.grass_lush_01, 5, variant)

    case 'meadow':
      return pickVariant(T.meadow_01, 3, variant)

    case 'forest':
      return pickVariant(T.forest_floor_01, 3, variant)

    case 'dense_forest':
      return pickVariant(T.grass_dark_01, 3, variant)

    case 'sand':
      if (biome === 'beach' || biome === 'coast') return pickVariant(T.sand_wet_01, 2, variant)
      return pickVariant(T.sand_01, 3, variant)

    case 'beach':
      return variant % 4 === 0
        ? pickVariant(T.beach_shell_01, 2, variant)
        : pickVariant(T.sand_wet_01, 2, variant)

    case 'snow':
      if (biome === 'dirty' || biome === 'road') return pickVariant(T.snow_dirty_01, 2, variant)
      return pickVariant(T.snow_01, 3, variant)

    case 'ice':
      return pickVariant(T.ice_01, 3, variant)

    case 'tundra':
      return pickVariant(T.gravel_01, 3, variant)

    case 'cliff':
      return pickVariant(T.cliff_top_01, 3, variant)

    case 'lava':
      return pickVariant(T.lava_rock_01, 2, variant)

    case 'volcanic':
      return pickVariant(T.volcanic_01, 2, variant)

    case 'swamp':
      return pickVariant(T.swamp_01, 2, variant)

    case 'farmland':
      return pickVariant(T.farmland_01, 3, variant)

    default:
      return pickVariant(T.grass_lush_01, 5, variant)
  }
}
