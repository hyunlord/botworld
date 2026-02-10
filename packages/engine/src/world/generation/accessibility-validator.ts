/**
 * BFS-based accessibility validation.
 * Ensures all POIs are reachable from the first POI.
 * Bridges disconnected areas with road tiles if needed.
 */
import type { Tile, Position } from '@botworld/shared'
import type { PointOfInterest } from './types.js'

function posKey(x: number, y: number): string {
  return `${x},${y}`
}

/**
 * BFS flood fill from a starting position.
 * Returns set of all reachable walkable position keys.
 */
function bfsFloodFill(
  tiles: Tile[][],
  start: Position,
  width: number,
  height: number,
): Set<string> {
  const visited = new Set<string>()
  const queue: Position[] = [start]
  visited.add(posKey(start.x, start.y))

  while (queue.length > 0) {
    const pos = queue.shift()!
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue
        const nx = pos.x + dx
        const ny = pos.y + dy
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
        const key = posKey(nx, ny)
        if (visited.has(key)) continue
        if (!tiles[ny][nx].walkable) continue
        visited.add(key)
        queue.push({ x: nx, y: ny })
      }
    }
  }

  return visited
}

/**
 * Force a straight-line path from start to goal by converting tiles to road.
 * Uses Bresenham-like line drawing.
 */
function forcePath(
  tiles: Tile[][],
  start: Position,
  goal: Position,
  width: number,
  height: number,
): void {
  let x = start.x
  let y = start.y
  const dx = Math.abs(goal.x - x)
  const dy = Math.abs(goal.y - y)
  const sx = x < goal.x ? 1 : -1
  const sy = y < goal.y ? 1 : -1
  let err = dx - dy

  const maxSteps = width + height // Safety limit
  let steps = 0

  while (steps++ < maxSteps) {
    if (x >= 0 && x < width && y >= 0 && y < height) {
      const tile = tiles[y][x]
      if (!tile.walkable) {
        tile.type = 'road'
        tile.walkable = true
        tile.movementCost = 0.5
        tile.biome = 'road'
      }
    }

    if (x === goal.x && y === goal.y) break

    const e2 = 2 * err
    if (e2 > -dy) { err -= dy; x += sx }
    if (e2 < dx) { err += dx; y += sy }
  }
}

export function validateAccessibility(
  tiles: Tile[][],
  pois: PointOfInterest[],
  width: number,
  height: number,
): { reachable: number; total: number } {
  if (pois.length === 0) return { reachable: 0, total: 0 }

  const start = pois[0].position
  const visited = bfsFloodFill(tiles, start, width, height)

  // Check all POIs are reachable
  for (let i = 1; i < pois.length; i++) {
    const poi = pois[i]
    const key = posKey(poi.position.x, poi.position.y)
    if (!visited.has(key)) {
      // Force a road path to this POI
      forcePath(tiles, start, poi.position, width, height)
    }
  }

  // Re-check after bridging
  const finalVisited = bfsFloodFill(tiles, start, width, height)

  // Count walkable tiles
  let totalWalkable = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (tiles[y][x].walkable) totalWalkable++
    }
  }

  return { reachable: finalVisited.size, total: totalWalkable }
}
