/**
 * Island mask generation using distance falloff + coastal noise.
 * Reference: Brash & Plucky (2025) - Procedural Island Generation
 */
import { SimplexNoise2D, fbm, clamp, lerp } from './noise.js'
import type { NoiseMap } from './types.js'

export function applyIslandMask(
  elevation: NoiseMap,
  width: number,
  height: number,
  seed: number,
): void {
  const coastNoise = new SimplexNoise2D(seed + 7777)
  const cx = width / 2
  const cy = height / 2

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x

      // Normalized distance from center [0, ~1.41]
      const dx = (x - cx) / cx
      const dy = (y - cy) / cy
      const d = Math.sqrt(dx * dx + dy * dy)

      // High-frequency coastal noise for irregular edges
      const coastal = fbm(coastNoise, x * 0.08, y * 0.08, {
        octaves: 3,
        persistence: 0.5,
        scale: 1.0,
      }) * 0.15

      // Blend noise elevation with distance falloff
      // mix_factor 0.4: balance between noise influence and circular shape
      const island = lerp(elevation[i], 1.0 - d, 0.4) + coastal

      // Hard cutoff at map edges
      if (d > 0.95) {
        elevation[i] = 0
      } else {
        elevation[i] = clamp(island, 0, 1)
      }
    }
  }
}
