/**
 * Road network generation using iterative A* with cost reduction.
 * Creates natural trunk roads by reducing cost along found paths.
 *
 * Reference: Martin Devans (2015), "Procedural Generation For Dummies: Roads"
 */
import type { Tile, Position } from '@botworld/shared'
import { MOVEMENT_COSTS } from '@botworld/shared'
import type { PointOfInterest } from './types.js'

interface AStarNode {
  x: number
  y: number
  g: number
  f: number
  parent: AStarNode | null
}

function posKey(x: number, y: number): string {
  return `${x},${y}`
}

function heuristic(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by)
}

/**
 * A* on a cost grid (not tiles) - allows roads through expensive terrain.
 */
function aStarOnCostGrid(
  costGrid: Float32Array,
  width: number,
  height: number,
  start: Position,
  goal: Position,
): Position[] {
  const openSet: AStarNode[] = [{ x: start.x, y: start.y, g: 0, f: heuristic(start.x, start.y, goal.x, goal.y), parent: null }]
  const closed = new Set<string>()
  const maxIter = width * height * 2

  let iter = 0
  while (openSet.length > 0 && iter++ < maxIter) {
    // Find node with lowest f
    let bestIdx = 0
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[bestIdx].f) bestIdx = i
    }
    const current = openSet[bestIdx]
    openSet.splice(bestIdx, 1)

    if (current.x === goal.x && current.y === goal.y) {
      // Reconstruct path
      const path: Position[] = []
      let node: AStarNode | null = current
      while (node) {
        path.unshift({ x: node.x, y: node.y })
        node = node.parent
      }
      return path
    }

    const key = posKey(current.x, current.y)
    if (closed.has(key)) continue
    closed.add(key)

    // 8-directional neighbors
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue
        const nx = current.x + dx
        const ny = current.y + dy
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue

        const nKey = posKey(nx, ny)
        if (closed.has(nKey)) continue

        const cost = costGrid[ny * width + nx]
        if (cost <= 0 || cost > 100) continue // Skip truly impassable (but allow expensive)

        const isDiag = dx !== 0 && dy !== 0
        const moveCost = (isDiag ? 1.414 : 1.0) * cost
        const g = current.g + moveCost
        const f = g + heuristic(nx, ny, goal.x, goal.y)

        openSet.push({ x: nx, y: ny, g, f, parent: current })
      }
    }
  }

  return [] // No path found
}

/**
 * Build minimum spanning tree of POIs using Prim's algorithm.
 * Returns list of edges (pairs of POI indices).
 */
function buildMST(pois: PointOfInterest[]): [number, number][] {
  if (pois.length < 2) return []

  const n = pois.length
  const inMST = new Set<number>([0])
  const edges: [number, number][] = []

  while (inMST.size < n) {
    let bestDist = Infinity
    let bestFrom = -1
    let bestTo = -1

    for (const from of inMST) {
      for (let to = 0; to < n; to++) {
        if (inMST.has(to)) continue
        const dx = pois[from].position.x - pois[to].position.x
        const dy = pois[from].position.y - pois[to].position.y
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

export function generateRoads(
  tiles: Tile[][],
  pois: PointOfInterest[],
  width: number,
  height: number,
): void {
  if (pois.length < 2) return

  // Build cost grid - use high but finite cost for impassable terrain
  // so roads can cut through mountains if needed
  const costGrid = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = tiles[y][x]
      const baseCost = MOVEMENT_COSTS[tile.type] ?? 1.0
      // Make impassable terrain very expensive but not impossible for roads
      costGrid[y * width + x] = baseCost <= 0 ? 50.0 : baseCost
    }
  }

  // MST edges + 1-2 extra connections for redundancy
  const edges = buildMST(pois)

  // Add 1-2 extra edges between closest non-connected pairs
  const connected = new Set(edges.map(([a, b]) => `${Math.min(a, b)},${Math.max(a, b)}`))
  let extras = 0
  const maxExtras = Math.min(2, Math.floor(pois.length / 3))

  for (let i = 0; i < pois.length && extras < maxExtras; i++) {
    for (let j = i + 1; j < pois.length && extras < maxExtras; j++) {
      const key = `${i},${j}`
      if (connected.has(key)) continue
      const dx = pois[i].position.x - pois[j].position.x
      const dy = pois[i].position.y - pois[j].position.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 25) { // Only add short extra connections
        edges.push([i, j])
        connected.add(key)
        extras++
      }
    }
  }

  // Generate roads along each edge
  for (const [ai, bi] of edges) {
    const path = aStarOnCostGrid(costGrid, width, height, pois[ai].position, pois[bi].position)

    for (const pos of path) {
      const tile = tiles[pos.y][pos.x]
      if (tile.type !== 'building') {
        tile.type = 'road'
        tile.walkable = true
        tile.biome = tile.biome ?? 'road'
      }
      // Reduce cost for future paths - creates natural trunk roads
      costGrid[pos.y * width + pos.x] *= 0.3
    }
  }
}
