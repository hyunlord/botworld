/**
 * POI placement using Bridson's Poisson Disk Sampling algorithm.
 * O(n) complexity with minimum distance guarantee.
 *
 * Reference: Robert Bridson (2007), "Fast Poisson Disk Sampling in Arbitrary Dimensions"
 */
import type { Tile, Position } from '@botworld/shared'
import type { PointOfInterest } from './types.js'

// Seeded PRNG for deterministic placement
function seededRandom(seed: number): () => number {
  let s = seed | 0 || 1
  return () => {
    s = (s * 1103515245 + 12345) & 0x7FFFFFFF
    return s / 0x7FFFFFFF
  }
}

const POI_TYPES: PointOfInterest['type'][] = [
  'marketplace', 'tavern', 'workshop', 'library', 'farm', 'mine',
]

const POI_BIOME_AFFINITY: Record<string, PointOfInterest['type'][]> = {
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

const NOUNS: Record<PointOfInterest['type'], string[]> = {
  marketplace: ['Market', 'Bazaar', 'Trading Post', 'Square'],
  tavern:      ['Tankard', 'Inn', 'Alehouse', 'Rest'],
  workshop:    ['Forge', 'Workshop', 'Smithy', 'Anvil'],
  library:     ['Library', 'Archive', 'Sanctum', 'Study'],
  farm:        ['Farm', 'Homestead', 'Ranch', 'Orchard'],
  mine:        ['Mine', 'Quarry', 'Dig', 'Delve'],
}

function generateName(type: PointOfInterest['type'], rng: () => number): string {
  const adj = ADJECTIVES[Math.floor(rng() * ADJECTIVES.length)]
  const nouns = NOUNS[type]
  const noun = nouns[Math.floor(rng() * nouns.length)]
  return `${adj} ${noun}`
}

/**
 * Bridson's Poisson Disk Sampling on walkable land tiles.
 */
function poissonDisk(
  tiles: Tile[][],
  width: number,
  height: number,
  minDist: number,
  rng: () => number,
  k: number = 30,
): Position[] {
  const cellSize = minDist / Math.SQRT2
  const gridW = Math.ceil(width / cellSize)
  const gridH = Math.ceil(height / cellSize)
  const grid: number[] = new Array(gridW * gridH).fill(-1)
  const points: Position[] = []
  const active: number[] = []

  function gridIndex(px: number, py: number): number {
    return Math.floor(py / cellSize) * gridW + Math.floor(px / cellSize)
  }

  function isWalkable(x: number, y: number): boolean {
    const ix = Math.floor(x)
    const iy = Math.floor(y)
    if (ix < 0 || ix >= width || iy < 0 || iy >= height) return false
    return tiles[iy][ix].walkable
  }

  function tooClose(px: number, py: number): boolean {
    const gx = Math.floor(px / cellSize)
    const gy = Math.floor(py / cellSize)
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = gx + dx
        const ny = gy + dy
        if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue
        const idx = grid[ny * gridW + nx]
        if (idx === -1) continue
        const p = points[idx]
        const ddx = px - p.x
        const ddy = py - p.y
        if (ddx * ddx + ddy * ddy < minDist * minDist) return true
      }
    }
    return false
  }

  // Find initial point near center on walkable land
  let initial: Position | null = null
  for (let r = 0; r < 20 && !initial; r++) {
    for (let dy = -r; dy <= r && !initial; dy++) {
      for (let dx = -r; dx <= r && !initial; dx++) {
        const x = Math.floor(width / 2) + dx
        const y = Math.floor(height / 2) + dy
        if (isWalkable(x, y)) {
          initial = { x, y }
        }
      }
    }
  }

  if (!initial) return []

  points.push(initial)
  active.push(0)
  grid[gridIndex(initial.x, initial.y)] = 0

  while (active.length > 0) {
    const activeIdx = Math.floor(rng() * active.length)
    const p = points[active[activeIdx]]
    let found = false

    for (let i = 0; i < k; i++) {
      const angle = rng() * Math.PI * 2
      const r = minDist + rng() * minDist
      const cx = p.x + Math.cos(angle) * r
      const cy = p.y + Math.sin(angle) * r

      if (cx < 1 || cx >= width - 1 || cy < 1 || cy >= height - 1) continue
      if (!isWalkable(cx, cy)) continue
      if (tooClose(cx, cy)) continue

      const np: Position = { x: Math.floor(cx), y: Math.floor(cy) }
      const ni = points.length
      points.push(np)
      active.push(ni)
      grid[gridIndex(np.x, np.y)] = ni
      found = true
      break
    }

    if (!found) {
      active.splice(activeIdx, 1)
    }
  }

  return points
}

export function placePOIs(
  tiles: Tile[][],
  biomeGrid: string[][],
  width: number,
  height: number,
  seed: number,
): PointOfInterest[] {
  const rng = seededRandom(seed + 5555)
  const minDist = 12

  const points = poissonDisk(tiles, width, height, minDist, rng)
  if (points.length === 0) return []

  const pois: PointOfInterest[] = []
  const usedTypes = new Set<PointOfInterest['type']>()

  // First pass: assign types based on biome affinity with scoring bonuses
  for (const pos of points) {
    const biome = biomeGrid[pos.y]?.[pos.x] ?? 'grassland'
    const affinities = POI_BIOME_AFFINITY[biome] ?? ['marketplace', 'tavern']

    // Find first affinity type that hasn't been used yet (for guaranteed diversity)
    let chosenType: PointOfInterest['type'] | null = null

    // Guarantee required types first
    if (usedTypes.size < POI_TYPES.length) {
      for (const type of affinities) {
        if (!usedTypes.has(type)) {
          chosenType = type
          break
        }
      }
      // If no affinity match available, fill remaining required types
      if (!chosenType) {
        for (const type of POI_TYPES) {
          if (!usedTypes.has(type)) {
            chosenType = type
            break
          }
        }
      }
    }

    // After all types guaranteed, use biome affinity with scoring
    if (!chosenType) {
      const scores = affinities.map(type => {
        let score = 100 // Base score

        // Water proximity bonus for marketplace and tavern
        if (type === 'marketplace' || type === 'tavern') {
          let nearWater = false
          for (let dy = -8; dy <= 8; dy++) {
            for (let dx = -8; dx <= 8; dx++) {
              const nx = pos.x + dx, ny = pos.y + dy
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const tileType = tiles[ny][nx].type
                if (tileType === 'water' || tileType === 'deep_water' || tileType === 'river') {
                  nearWater = true
                  break
                }
              }
            }
            if (nearWater) break
          }
          if (nearWater) score += 50
        }

        // Mountain proximity bonus for mine
        if (type === 'mine') {
          let nearMountain = false
          for (let dy = -5; dy <= 5; dy++) {
            for (let dx = -5; dx <= 5; dx++) {
              const nx = pos.x + dx, ny = pos.y + dy
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                if (tiles[ny][nx].type === 'mountain') {
                  nearMountain = true
                  break
                }
              }
            }
            if (nearMountain) break
          }
          if (nearMountain) score += 50
        }

        // Farm placement bonus for farmland/grassland
        if (type === 'farm') {
          const currentBiome = biomeGrid[pos.y]?.[pos.x]
          if (currentBiome === 'farmland' || currentBiome === 'grassland') {
            score += 30
          }
        }

        return { type, score }
      })

      // Choose type with highest score
      scores.sort((a, b) => b.score - a.score)
      chosenType = scores[0].type
    }

    usedTypes.add(chosenType)

    pois.push({
      name: generateName(chosenType, rng),
      type: chosenType,
      position: pos,
      biome,
    })

    // Convert tile to building
    tiles[pos.y][pos.x].type = 'building'
    tiles[pos.y][pos.x].walkable = true
    tiles[pos.y][pos.x].biome = biome
  }

  // Town clustering: try to place tavern near marketplace
  const marketplaces = pois.filter(p => p.type === 'marketplace')
  for (const market of marketplaces) {
    // Check if there's already a tavern within 4-6 tiles
    const nearbyTavern = pois.some(p => {
      if (p.type !== 'tavern') return false
      const dx = p.position.x - market.position.x
      const dy = p.position.y - market.position.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      return dist >= 4 && dist <= 6
    })

    if (nearbyTavern) continue

    // Try to find a spot 4-6 tiles away for a tavern
    for (let attempts = 0; attempts < 20; attempts++) {
      const angle = rng() * Math.PI * 2
      const dist = 4 + rng() * 2 // 4-6 tiles
      const tx = Math.floor(market.position.x + Math.cos(angle) * dist)
      const ty = Math.floor(market.position.y + Math.sin(angle) * dist)

      if (tx < 1 || tx >= width - 1 || ty < 1 || ty >= height - 1) continue
      if (!tiles[ty][tx].walkable || tiles[ty][tx].type === 'building') continue

      // Check minimum distance from other POIs
      const tooClose = pois.some(p => {
        const dx = p.position.x - tx
        const dy = p.position.y - ty
        return Math.sqrt(dx * dx + dy * dy) < minDist
      })

      if (!tooClose) {
        const biome = biomeGrid[ty]?.[tx] ?? 'grassland'
        pois.push({
          name: generateName('tavern', rng),
          type: 'tavern',
          position: { x: tx, y: ty },
          biome,
        })
        tiles[ty][tx].type = 'building'
        tiles[ty][tx].walkable = true
        tiles[ty][tx].biome = biome
        break
      }
    }
  }

  return pois
}
