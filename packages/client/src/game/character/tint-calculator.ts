/**
 * Convert a hex color string (#RRGGBB) to a Phaser tint number (0xRRGGBB).
 * Falls back to white (no tint) on invalid input.
 */
export function hexToTint(hex: string): number {
  if (!hex || hex.length < 7 || hex[0] !== '#') {
    return 0xFFFFFF
  }
  const parsed = parseInt(hex.slice(1), 16)
  if (isNaN(parsed)) return 0xFFFFFF
  return parsed
}

/**
 * Darken a tint by a factor (0-1, where 0 = black, 1 = unchanged).
 */
export function darkenTint(tint: number, factor: number): number {
  const f = Math.max(0, Math.min(1, factor))
  const r = Math.floor(((tint >> 16) & 0xFF) * f)
  const g = Math.floor(((tint >> 8) & 0xFF) * f)
  const b = Math.floor((tint & 0xFF) * f)
  return (r << 16) | (g << 8) | b
}
