/**
 * Mountain ridge generation using ridged multifractal noise.
 * Creates connected mountain chains instead of random isolated peaks.
 * Reference: Musgrove's ridged multifractal (Texturing & Modeling, 1998)
 */
import { SimplexNoise2D, ridgedFbm } from './noise.js'
import type { NoiseMap } from './types.js'

export function generateMountainRidges(
  elevation: NoiseMap,
  width: number,
  height: number,
  seed: number,
): void {
  const ridgeNoise = new SimplexNoise2D(seed + 3000)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x

      // Only apply ridges where elevation is already moderately high
      if (elevation[i] < 0.55) continue

      const ridge = ridgedFbm(ridgeNoise, x * 0.05, y * 0.05, {
        octaves: 4,
        persistence: 0.5,
        lacunarity: 2.1,
        scale: 1.0,
      })

      // Where ridge value is high, boost elevation to create mountain peaks
      if (ridge > 0.6) {
        const boost = 0.70 + (ridge - 0.6) * 0.75
        elevation[i] = Math.max(elevation[i], boost)
      }
    }
  }
}
