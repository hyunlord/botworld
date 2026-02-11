/**
 * River generation using gradient descent from mountain edges.
 * Creates natural-looking rivers that flow downhill to the ocean.
 * Generates moisture bonus zones around rivers for biome classification.
 */
import type { NoiseMap } from './types.js'
import type { Tile } from '@botworld/shared'

export interface RiverSegment {
  x: number
  y: number
  width: number // 1-3 tiles wide, widens downstream
}

export interface RiverResult {
  rivers: RiverSegment[][]  // array of river paths
  moistureBonus: Float32Array  // extra moisture near rivers (width × height)
}

/**
 * Simple seeded random number generator
 */
function seededRandom(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s * 1664525 + 1013904223) | 0
    return ((s >>> 0) / 0xFFFFFFFF)
  }
}

/**
 * Find potential river source points in mountain edges (elevation 0.55-0.70)
 */
function findRiverSources(
  elevation: NoiseMap,
  width: number,
  height: number,
  seed: number,
): { x: number; y: number }[] {
  const rng = seededRandom(seed + 3000)
  const candidates: { x: number; y: number }[] = []

  // Find all mountain edge tiles
  for (let y = 5; y < height - 5; y++) {
    for (let x = 5; x < width - 5; x++) {
      const i = y * width + x
      const elev = elevation[i]
      if (elev >= 0.55 && elev <= 0.70) {
        candidates.push({ x, y })
      }
    }
  }

  if (candidates.length === 0) return []

  // Pick 2-4 source points spaced apart (at least 15 tiles between sources)
  const sources: { x: number; y: number }[] = []
  const targetCount = Math.floor(rng() * 3) + 2 // 2-4 sources
  const minDistance = 15

  // Shuffle candidates
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const temp = candidates[i]
    candidates[i] = candidates[j]
    candidates[j] = temp
  }

  for (const candidate of candidates) {
    // Check if far enough from existing sources
    let tooClose = false
    for (const source of sources) {
      const dx = candidate.x - source.x
      const dy = candidate.y - source.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < minDistance) {
        tooClose = true
        break
      }
    }

    if (!tooClose) {
      sources.push(candidate)
      if (sources.length >= targetCount) break
    }
  }

  return sources
}

/**
 * Trace a river path from source to ocean using gradient descent
 */
function traceRiver(
  startX: number,
  startY: number,
  elevation: NoiseMap,
  width: number,
  height: number,
  rng: () => number,
): RiverSegment[] {
  const path: RiverSegment[] = []
  let x = startX
  let y = startY
  let width_tiles = 1
  let steps = 0
  let uphillStreak = 0
  const maxSteps = 500
  const visited = new Set<string>()

  while (steps < maxSteps) {
    const key = `${x},${y}`
    if (visited.has(key)) break // Prevent loops
    visited.add(key)

    path.push({ x, y, width: width_tiles })

    // Check if reached water or edge
    const i = y * width + x
    const currentElev = elevation[i]
    if (currentElev < 0.25 || x <= 0 || y <= 0 || x >= width - 1 || y >= height - 1) {
      break // Reached ocean or map edge
    }

    // Widen river every 15 steps (max width 3)
    steps++
    if (steps % 15 === 0 && width_tiles < 3) {
      width_tiles++
    }

    // Find lowest neighbor (8-directional)
    let bestX = x
    let bestY = y
    let bestElev = currentElev

    const neighbors = [
      { dx: -1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
      { dx: -1, dy: -1 }, { dx: -1, dy: 1 }, { dx: 1, dy: -1 }, { dx: 1, dy: 1 },
    ]

    for (const { dx, dy } of neighbors) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue

      const ni = ny * width + nx
      const nElev = elevation[ni]

      if (nElev < bestElev) {
        bestElev = nElev
        bestX = nx
        bestY = ny
      }
    }

    // Check if going uphill
    if (bestElev >= currentElev) {
      uphillStreak++
      // If stuck in local minimum for 2+ steps, force random direction for 3 steps
      if (uphillStreak >= 2) {
        const randomDir = neighbors[Math.floor(rng() * neighbors.length)]
        bestX = x + randomDir.dx
        bestY = y + randomDir.dy
        // Clamp to bounds
        bestX = Math.max(0, Math.min(width - 1, bestX))
        bestY = Math.max(0, Math.min(height - 1, bestY))
        uphillStreak = 0 // Reset after forcing
      }
    } else {
      uphillStreak = 0
    }

    // Move to next position
    x = bestX
    y = bestY

    // Safety check - if no movement, break
    if (x === startX && y === startY && steps > 1) break
  }

  return path
}

/**
 * Apply moisture bonus around rivers
 */
function applyMoistureBonus(
  rivers: RiverSegment[][],
  width: number,
  height: number,
): Float32Array {
  const moistureBonus = new Float32Array(width * height)

  for (const river of rivers) {
    for (const segment of river) {
      const radius = segment.width * 2

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const tx = segment.x + dx
          const ty = segment.y + dy
          if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue

          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist <= radius) {
            const i = ty * width + tx
            // Linear falloff: 0.15 at center, 0 at radius
            const bonus = 0.15 * (1 - dist / radius)
            moistureBonus[i] = Math.max(moistureBonus[i], bonus)
          }
        }
      }
    }
  }

  return moistureBonus
}

/**
 * Apply river tiles to the tile grid
 */
function applyRiverTiles(
  rivers: RiverSegment[][],
  tiles: Tile[][],
  width: number,
  height: number,
): void {
  for (const river of rivers) {
    for (const segment of river) {
      // Apply river to all tiles in segment width
      for (let dy = -Math.floor((segment.width - 1) / 2); dy <= Math.floor(segment.width / 2); dy++) {
        for (let dx = -Math.floor((segment.width - 1) / 2); dx <= Math.floor(segment.width / 2); dx++) {
          const tx = segment.x + dx
          const ty = segment.y + dy
          if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue

          const tile = tiles[ty][tx]
          tile.type = 'river'
          tile.walkable = false
          tile.movementCost = 0
        }
      }
    }
  }
}

/**
 * Main river generation function
 */
export function generateRivers(
  width: number,
  height: number,
  elevation: NoiseMap,
  tiles: Tile[][],
  seed: number,
): RiverResult {
  const rng = seededRandom(seed + 4000)

  // Find river sources
  const sources = findRiverSources(elevation, width, height, seed)

  // Trace rivers from each source
  const rivers: RiverSegment[][] = []
  for (const source of sources) {
    const path = traceRiver(source.x, source.y, elevation, width, height, rng)
    if (path.length > 5) { // Only keep rivers with at least 5 segments
      rivers.push(path)
    }
  }

  // Generate moisture bonus
  const moistureBonus = applyMoistureBonus(rivers, width, height)

  // Apply river tiles
  applyRiverTiles(rivers, tiles, width, height)

  return { rivers, moistureBonus }
}
