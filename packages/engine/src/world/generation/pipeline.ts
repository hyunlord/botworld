/**
 * World generation pipeline orchestrator.
 * 9-stage pipeline producing a complete tile map with POIs.
 *
 * Stages:
 * 1. Noise layers (elevation, temperature, moisture)
 * 2. Island mask
 * 3. Mountain ridges
 * 4. Biome classification + smoothing
 * 5. POI placement (Poisson disk)
 * 6. Road network (iterative A*)
 * 7. Resource scattering
 * 8. Movement cost assignment
 * 9. BFS accessibility validation
 */
import { SimplexNoise2D, fbm, domainWarp, clamp, lerp } from './noise.js'
import { applyIslandMask } from './island-mask.js'
import { generateMountainRidges } from './mountain-generator.js'
import { classifyBiomes, smoothBiomes } from './biome-classifier.js'
import { placePOIs } from './poi-placement.js'
import { generateRoads } from './road-generator.js'
import { scatterResources } from './resource-scatter.js'
import { assignMovementCosts } from './movement-cost.js'
import { validateAccessibility } from './accessibility-validator.js'
import type { NoiseMap, GenerationResult } from './types.js'

// --- Stage 1: Noise Layer Generation ---

function generateElevationMap(
  width: number,
  height: number,
  seed: number,
): NoiseMap {
  const elevation = new Float32Array(width * height)
  const noiseElev = new SimplexNoise2D(seed)
  const noiseWarp = new SimplexNoise2D(seed + 100)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x

      // Raw elevation
      const raw = fbm(noiseElev, x * 0.035, y * 0.035, {
        octaves: 6,
        persistence: 0.5,
        lacunarity: 2.0,
        scale: 1.0,
      })

      // Domain-warped elevation for organic shapes
      const warp = domainWarp(noiseWarp, x, y, { strength: 3.0, scale: 0.025 })
      const warped = fbm(noiseElev, (x + warp.x) * 0.035, (y + warp.y) * 0.035, {
        octaves: 6,
        persistence: 0.5,
        lacunarity: 2.0,
        scale: 1.0,
      })

      // Blend raw and warped
      const blended = lerp(raw, warped, 0.4)

      // Elevation redistribution: flatter valleys, steeper peaks
      elevation[i] = Math.pow(blended, 1.3)
    }
  }

  return elevation
}

function generateTemperatureMap(
  width: number,
  height: number,
  seed: number,
  elevation: NoiseMap,
): NoiseMap {
  const temperature = new Float32Array(width * height)
  const noiseTemp = new SimplexNoise2D(seed + 1000)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x

      // Latitude gradient: warm at bottom (south), cool at top (north)
      const latGradient = 1.0 - (y / height)

      // Noise component
      const noise = fbm(noiseTemp, x * 0.04, y * 0.04, {
        octaves: 4,
        persistence: 0.5,
        scale: 1.0,
      })

      // Altitude cooling: higher = colder
      const altCooling = Math.max(0, (elevation[i] - 0.5) * 0.6)

      // Blend latitude gradient with noise
      temperature[i] = clamp(lerp(latGradient, noise, 0.35) - altCooling, 0, 1)
    }
  }

  return temperature
}

function generateMoistureMap(
  width: number,
  height: number,
  seed: number,
  elevation: NoiseMap,
): NoiseMap {
  const moisture = new Float32Array(width * height)
  const noiseMoist = new SimplexNoise2D(seed + 2000)

  // Generate base moisture
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      moisture[i] = fbm(noiseMoist, x * 0.045, y * 0.045, {
        octaves: 5,
        persistence: 0.5,
        scale: 1.0,
      })
    }
  }

  // Rain shadow effect: prevailing wind from west (left)
  // Mountains block moisture, creating dry areas downwind
  for (let y = 0; y < height; y++) {
    let shadow = 0
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      if (elevation[i] > 0.65) {
        shadow += 0.1 // Mountain accumulates shadow
      } else {
        shadow = Math.max(0, shadow - 0.02) // Shadow decays after mountains
      }
      moisture[i] = clamp(moisture[i] - shadow, 0, 1)
    }
  }

  return moisture
}

// --- Main Pipeline ---

export function generateWorld(
  width: number,
  height: number,
  seed: number,
): GenerationResult {
  const t0 = Date.now()

  // Stage 1: Noise layers
  const elevation = generateElevationMap(width, height, seed)
  const temperature = generateTemperatureMap(width, height, seed, elevation)
  const moisture = generateMoistureMap(width, height, seed, elevation)

  // Stage 2: Island mask
  applyIslandMask(elevation, width, height, seed)

  // Stage 3: Mountain ridges
  generateMountainRidges(elevation, width, height, seed)

  // Stage 4: Biome classification + smoothing
  const { tiles, biomeGrid } = classifyBiomes(elevation, temperature, moisture, width, height, seed)
  smoothBiomes(tiles, width, height)

  // Stage 5: POI placement
  const pois = placePOIs(tiles, biomeGrid, width, height, seed)

  // Stage 6: Road network
  generateRoads(tiles, pois, width, height)

  // Stage 7: Resource scattering
  scatterResources(tiles, biomeGrid, width, height, seed)

  // Stage 8: Movement costs
  assignMovementCosts(tiles, width, height)

  // Stage 9: Accessibility validation
  const accessibility = validateAccessibility(tiles, pois, width, height)

  const elapsed = Date.now() - t0
  console.log(`[WorldGen] Generated ${width}x${height} world in ${elapsed}ms (seed: ${seed})`)
  console.log(`[WorldGen] POIs: ${pois.map(p => `${p.name} (${p.type})`).join(', ')}`)
  console.log(`[WorldGen] Accessibility: ${accessibility.reachable}/${accessibility.total} walkable tiles reachable`)

  return { tiles, pois }
}
