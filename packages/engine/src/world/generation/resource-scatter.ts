/**
 * Biome-based resource scattering with noise clustering.
 * Resources cluster naturally using a separate noise layer.
 */
import type { Tile, ResourceType } from '@botworld/shared'
import { SimplexNoise2D, fbm } from './noise.js'

interface ResourceDef {
  type: ResourceType
  density: number
  amount: number
  maxAmount: number
  regenRate: number
}

const BIOME_RESOURCES: Record<string, ResourceDef[]> = {
  temperate_forest: [
    { type: 'wood', density: 0.21, amount: 10, maxAmount: 10, regenRate: 0.01 },
    { type: 'herb', density: 0.05, amount: 4, maxAmount: 4, regenRate: 0.008 },
  ],
  alpine_forest: [
    { type: 'wood', density: 0.15, amount: 8, maxAmount: 8, regenRate: 0.008 },
  ],
  dense_forest: [
    { type: 'wood', density: 0.30, amount: 15, maxAmount: 15, regenRate: 0.012 },
    { type: 'herb', density: 0.09, amount: 6, maxAmount: 6, regenRate: 0.01 },
  ],
  grassland: [
    { type: 'food', density: 0.07, amount: 5, maxAmount: 5, regenRate: 0.02 },
    { type: 'herb', density: 0.03, amount: 3, maxAmount: 3, regenRate: 0.008 },
  ],
  farmland: [
    { type: 'food', density: 0.24, amount: 8, maxAmount: 8, regenRate: 0.025 },
  ],
  highland: [
    { type: 'stone', density: 0.15, amount: 10, maxAmount: 10, regenRate: 0.005 },
    { type: 'iron', density: 0.05, amount: 8, maxAmount: 8, regenRate: 0.003 },
  ],
  swamp: [
    { type: 'herb', density: 0.12, amount: 6, maxAmount: 6, regenRate: 0.015 },
    { type: 'food', density: 0.04, amount: 3, maxAmount: 3, regenRate: 0.01 },
  ],
  beach: [
    { type: 'food', density: 0.03, amount: 3, maxAmount: 3, regenRate: 0.015 },
  ],
  tundra: [
    { type: 'stone', density: 0.09, amount: 6, maxAmount: 6, regenRate: 0.004 },
  ],
}

// Resources for tiles adjacent to mountains
const MOUNTAIN_ADJ_RESOURCES: ResourceDef[] = [
  { type: 'stone', density: 0.18, amount: 12, maxAmount: 12, regenRate: 0.005 },
  { type: 'iron', density: 0.07, amount: 10, maxAmount: 10, regenRate: 0.004 },
  { type: 'gold', density: 0.024, amount: 5, maxAmount: 5, regenRate: 0.002 },
]

// Seeded PRNG
function seededRandom(seed: number): () => number {
  let s = seed | 0 || 1
  return () => {
    s = (s * 1103515245 + 12345) & 0x7FFFFFFF
    return s / 0x7FFFFFFF
  }
}

export function scatterResources(
  tiles: Tile[][],
  biomeGrid: string[][],
  width: number,
  height: number,
  seed: number,
  pois?: { position: { x: number; y: number } }[],
): void {
  const rng = seededRandom(seed + 9999)
  const clusterNoise = new SimplexNoise2D(seed + 5000)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = tiles[y][x]
      if (!tile.walkable || tile.resource || tile.type === 'road' || tile.type === 'building') continue

      // POI exclusion zone (radius 3)
      if (pois) {
        let nearPOI = false
        for (const poi of pois) {
          const dx = x - poi.position.x
          const dy = y - poi.position.y
          if (dx * dx + dy * dy <= 9) { // radius 3
            nearPOI = true
            break
          }
        }
        if (nearPOI) continue
      }

      // Road exclusion (check cardinal neighbors)
      let nearRoad = false
      const cardinalDirs = [{ dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }]
      for (const { dx, dy } of cardinalDirs) {
        const nx = x + dx, ny = y + dy
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          if (tiles[ny][nx].type === 'road') {
            nearRoad = true
            break
          }
        }
      }
      if (nearRoad) continue

      const biome = biomeGrid[y]?.[x] ?? 'grassland'

      // Check if adjacent to mountain for mountain-adjacent resources
      let nearMountain = false
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          const nx = x + dx, ny = y + dy
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            if (tiles[ny][nx].type === 'mountain') {
              nearMountain = true
            }
          }
        }
      }

      const resources = nearMountain ? MOUNTAIN_ADJ_RESOURCES : (BIOME_RESOURCES[biome] ?? [])

      // Cluster noise - only place resources where cluster noise is high enough
      const cluster = fbm(clusterNoise, x * 0.06, y * 0.06, { octaves: 3, scale: 1.0 })

      for (const res of resources) {
        if (tile.resource) break // Only one resource per tile
        if (cluster < 0.55) continue // Clustering threshold (raised from 0.4)
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
