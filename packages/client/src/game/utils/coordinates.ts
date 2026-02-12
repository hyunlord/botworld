/** Isometric tile dimensions (2:1 diamond ratio) */
export const ISO_TILE_WIDTH = 64
export const ISO_TILE_HEIGHT = 32

/** Legacy square tile size (used by engine for grid logic) */
export const TILE_SIZE = 32

/**
 * Convert world tile coordinates to isometric screen position.
 * Returns the top-left corner of the diamond's bounding box,
 * matching Phaser's tileToWorldXY for isometric tilemaps.
 */
export function worldToScreen(x: number, y: number): { x: number; y: number } {
  return {
    x: (x - y) * (ISO_TILE_WIDTH / 2),
    y: (x + y) * (ISO_TILE_HEIGHT / 2),
  }
}

/** Convert isometric screen position to world tile coordinates */
export function screenToWorld(sx: number, sy: number): { x: number; y: number } {
  const halfW = ISO_TILE_WIDTH / 2
  const halfH = ISO_TILE_HEIGHT / 2
  return {
    x: Math.floor((sx / halfW + sy / halfH) / 2),
    y: Math.floor((sy / halfH - sx / halfW) / 2),
  }
}

/** Isometric depth value for y-sorting sprites (replaces simple y-depth in top-down) */
export function isoDepth(tileX: number, tileY: number): number {
  return tileX + tileY
}
