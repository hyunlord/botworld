/**
 * Movement cost assignment for all tiles based on tile type.
 */
import type { Tile } from '@botworld/shared'
import { MOVEMENT_COSTS } from '@botworld/shared'

export function assignMovementCosts(
  tiles: Tile[][],
  width: number,
  height: number,
): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = tiles[y][x]
      const cost = MOVEMENT_COSTS[tile.type] ?? 1.0
      tile.movementCost = cost
      tile.walkable = cost > 0
    }
  }
}
