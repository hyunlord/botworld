import type { Position } from '@botworld/shared'
import type { TileMap } from './tile-map.js'

interface Node {
  pos: Position
  g: number // cost from start
  h: number // heuristic to goal
  f: number // g + h
  parent: Node | null
}

function heuristic(a: Position, b: Position): number {
  // Chebyshev distance (allows diagonal movement)
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

function posKey(pos: Position): string {
  return `${pos.x},${pos.y}`
}

/**
 * A* pathfinding on the tile map.
 * Returns array of positions from start (exclusive) to goal (inclusive),
 * or empty array if no path found.
 */
export function findPath(map: TileMap, start: Position, goal: Position, maxSteps = 200): Position[] {
  if (!map.isWalkable(goal.x, goal.y)) return []
  if (start.x === goal.x && start.y === goal.y) return []

  const openSet = new Map<string, Node>()
  const closedSet = new Set<string>()

  const startNode: Node = {
    pos: start,
    g: 0,
    h: heuristic(start, goal),
    f: heuristic(start, goal),
    parent: null,
  }
  openSet.set(posKey(start), startNode)

  let steps = 0
  while (openSet.size > 0 && steps < maxSteps) {
    steps++

    // Find node with lowest f score
    let current: Node | null = null
    for (const node of openSet.values()) {
      if (!current || node.f < current.f) {
        current = node
      }
    }
    if (!current) break

    // Reached goal
    if (current.pos.x === goal.x && current.pos.y === goal.y) {
      return reconstructPath(current)
    }

    openSet.delete(posKey(current.pos))
    closedSet.add(posKey(current.pos))

    // Expand neighbors
    for (const neighborPos of map.getNeighbors(current.pos)) {
      const key = posKey(neighborPos)
      if (closedSet.has(key)) continue

      // Diagonal movement costs more
      const isDiag = neighborPos.x !== current.pos.x && neighborPos.y !== current.pos.y
      const moveCost = isDiag ? 1.414 : 1
      const tentativeG = current.g + moveCost

      const existing = openSet.get(key)
      if (existing && tentativeG >= existing.g) continue

      const node: Node = {
        pos: neighborPos,
        g: tentativeG,
        h: heuristic(neighborPos, goal),
        f: tentativeG + heuristic(neighborPos, goal),
        parent: current,
      }
      openSet.set(key, node)
    }
  }

  return [] // No path found
}

function reconstructPath(node: Node): Position[] {
  const path: Position[] = []
  let current: Node | null = node
  while (current?.parent) {
    path.unshift(current.pos)
    current = current.parent
  }
  return path
}
