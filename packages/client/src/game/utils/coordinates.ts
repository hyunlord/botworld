/** Tile size in pixels for top-down square grid */
export const TILE_SIZE = 32

/** Convert world tile coordinates to screen pixel coordinates (top-left of tile) */
export function worldToScreen(x: number, y: number): { x: number; y: number } {
  return { x: x * TILE_SIZE, y: y * TILE_SIZE }
}

/** Convert screen pixel coordinates to world tile coordinates */
export function screenToWorld(sx: number, sy: number): { x: number; y: number } {
  return { x: Math.floor(sx / TILE_SIZE), y: Math.floor(sy / TILE_SIZE) }
}
