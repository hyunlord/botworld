/**
 * Whittaker diagram-based biome classification.
 * Uses 3 noise layers (elevation, temperature, moisture) to determine biome/tile type.
 * Post-processes with cellular automata for smooth transitions.
 *
 * Reference: Whittaker (1975) biome diagram, AutoBiomes (Springer 2020)
 */
import type { Tile, TileType, Position } from '@botworld/shared'
import type { NoiseMap, BiomeRule } from './types.js'

// Biome rules ordered by priority (first match wins)
const BIOME_TABLE: BiomeRule[] = [
  // Ocean layers (elevation-only)
  { biome: 'deep_ocean',       tileType: 'deep_water',   elevMin: 0, elevMax: 0.12, tempMin: 0, tempMax: 1, moistMin: 0, moistMax: 1 },
  { biome: 'ocean',            tileType: 'water',        elevMin: 0.12, elevMax: 0.20, tempMin: 0, tempMax: 1, moistMin: 0, moistMax: 1 },
  { biome: 'beach',            tileType: 'sand',         elevMin: 0.20, elevMax: 0.25, tempMin: 0, tempMax: 1, moistMin: 0, moistMax: 1 },

  // Peaks (elevation-dominant)
  { biome: 'snow_peak',        tileType: 'snow',         elevMin: 0.85, elevMax: 1.01, tempMin: 0, tempMax: 1, moistMin: 0, moistMax: 1 },
  { biome: 'snow_peak',        tileType: 'snow',         elevMin: 0.68, elevMax: 0.85, tempMin: 0, tempMax: 0.3, moistMin: 0, moistMax: 1 },
  { biome: 'mountain',         tileType: 'mountain',     elevMin: 0.70, elevMax: 0.85, tempMin: 0.3, tempMax: 1, moistMin: 0, moistMax: 1 },

  // Highland (0.55 - 0.70)
  { biome: 'highland',         tileType: 'grass',        elevMin: 0.55, elevMax: 0.70, tempMin: 0.15, tempMax: 1, moistMin: 0, moistMax: 0.5 },
  { biome: 'alpine_forest',    tileType: 'forest',       elevMin: 0.55, elevMax: 0.70, tempMin: 0.1, tempMax: 0.7, moistMin: 0.3, moistMax: 1 },

  // Low-mid elevation biomes
  { biome: 'swamp',            tileType: 'swamp',        elevMin: 0.25, elevMax: 0.35, tempMin: 0.3, tempMax: 1, moistMin: 0.7, moistMax: 1 },
  { biome: 'dense_forest',     tileType: 'dense_forest', elevMin: 0.35, elevMax: 0.55, tempMin: 0.3, tempMax: 0.8, moistMin: 0.65, moistMax: 1 },
  { biome: 'temperate_forest', tileType: 'forest',       elevMin: 0.30, elevMax: 0.55, tempMin: 0.25, tempMax: 0.7, moistMin: 0.4, moistMax: 0.8 },
  { biome: 'desert',           tileType: 'sand',         elevMin: 0.25, elevMax: 0.50, tempMin: 0.6, tempMax: 1, moistMin: 0, moistMax: 0.2 },
  { biome: 'farmland',         tileType: 'farmland',     elevMin: 0.25, elevMax: 0.40, tempMin: 0.3, tempMax: 0.7, moistMin: 0.4, moistMax: 0.7 },
  { biome: 'grassland',        tileType: 'grass',        elevMin: 0.25, elevMax: 0.55, tempMin: 0.15, tempMax: 0.85, moistMin: 0.15, moistMax: 0.65 },
  { biome: 'tundra',           tileType: 'grass',        elevMin: 0.25, elevMax: 0.60, tempMin: 0, tempMax: 0.2, moistMin: 0, moistMax: 0.5 },
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
        walkable: rule.tileType !== 'water' && rule.tileType !== 'deep_water' && rule.tileType !== 'mountain',
        movementCost: 1.0,
        biome: rule.biome,
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
 * Cellular automata smoothing - remove isolated single-tile biomes.
 * If 6+ of 8 neighbors differ, change to the most common neighbor type.
 */
export function smoothBiomes(
  tiles: Tile[][],
  width: number,
  height: number,
): void {
  const changes: { x: number; y: number; type: TileType; biome: string; walkable: boolean }[] = []

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const current = tiles[y][x]
      // Don't smooth water/deep_water/road/building
      if (current.type === 'water' || current.type === 'deep_water' ||
          current.type === 'road' || current.type === 'building') continue

      const counts = new Map<TileType, number>()
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          const n = tiles[y + dy][x + dx]
          counts.set(n.type, (counts.get(n.type) ?? 0) + 1)
        }
      }

      // Check if 6+ neighbors are different
      const sameCount = counts.get(current.type) ?? 0
      if (sameCount <= 2) {
        // Find most common neighbor type (excluding water/mountain)
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
          const neighborBiome = tiles[y + (maxType === tiles[y - 1][x].type ? -1 : 1)]?.[x]?.biome ?? current.biome
          changes.push({
            x, y,
            type: maxType,
            biome: neighborBiome ?? 'grassland',
            walkable: true, // water/deep_water/mountain excluded from maxType in loop above
          })
        }
      }
    }
  }

  // Apply changes
  for (const c of changes) {
    tiles[c.y][c.x].type = c.type
    tiles[c.y][c.x].biome = c.biome
    tiles[c.y][c.x].walkable = c.walkable
  }
}
