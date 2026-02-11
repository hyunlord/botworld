/**
 * World generation pipeline orchestrator.
 * 11-stage pipeline producing a complete tile map with POIs.
 *
 * Stages:
 * 1. Noise layers (elevation, temperature, moisture)
 * 2. Island mask
 * 3. Mountain ridges
 * 4. River generation (uses elevation, modifies moisture)
 * 5. Biome classification + smoothing
 * 6. River tile application
 * 7. POI placement (Poisson disk)
 * 8. Road network (iterative A*)
 * 9. Resource scattering
 * 10. Movement cost assignment
 * 11. BFS accessibility validation
 */
import { SimplexNoise2D, fbm, domainWarp, clamp, lerp } from './noise.js'
import { applyIslandMask } from './island-mask.js'
import { generateMountainRidges } from './mountain-generator.js'
import { generateRivers } from './river-generator.js'
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
  let moisture = generateMoistureMap(width, height, seed, elevation)

  // Stage 2: Island mask
  applyIslandMask(elevation, width, height, seed)

  // Stage 3: Mountain ridges
  generateMountainRidges(elevation, width, height, seed)

  // Stage 4: Biome classification (temporary tiles for river generation)
  const { tiles, biomeGrid } = classifyBiomes(elevation, temperature, moisture, width, height, seed)

  // Stage 5: River generation
  const riverResult = generateRivers(width, height, elevation, tiles, seed)

  // Merge river moisture bonus into moisture map
  for (let i = 0; i < moisture.length; i++) {
    moisture[i] = clamp(moisture[i] + riverResult.moistureBonus[i], 0, 1)
  }

  // Stage 6: Re-classify biomes with updated moisture (but keep tiles array)
  // We need to update the biome classification for non-river tiles only
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      const tile = tiles[y][x]

      // Skip river tiles - they're already set
      if (tile.type === 'river') continue

      // Re-classify with updated moisture
      const elev = elevation[i]
      const temp = temperature[i]
      const moist = moisture[i]

      // Simple re-classification (could import classifyBiome but keeping it inline for clarity)
      // This is a simplified version - the full BIOME_TABLE logic is in biome-classifier.ts
      if (tile.type !== 'water' && tile.type !== 'deep_water' && tile.type !== 'mountain') {
        // Update biome based on moisture change (simplified logic)
        // The smoothBiomes call below will handle most edge cases
        const oldMoisture = moisture[i] - riverResult.moistureBonus[i]
        if (riverResult.moistureBonus[i] > 0.05 && oldMoisture < 0.4 && moist >= 0.4) {
          // Moisture increased significantly - might shift biome
          if (tile.biome === 'grassland' || tile.biome === 'farmland') {
            tile.biome = 'temperate_forest'
            tile.type = 'forest'
          } else if (tile.biome === 'desert' && moist >= 0.3) {
            tile.biome = 'grassland'
            tile.type = 'grass'
          }
        }
      }
    }
  }

  // Stage 7: Biome smoothing (now with rivers included)
  smoothBiomes(tiles, width, height)

  // Stage 8: POI placement
  const pois = placePOIs(tiles, biomeGrid, width, height, seed)

  // Stage 9: Road network
  generateRoads(tiles, pois, width, height, seed)

  // Stage 10: Resource scattering
  scatterResources(tiles, biomeGrid, width, height, seed, pois)

  // Stage 11: Movement costs
  assignMovementCosts(tiles, width, height)

  // Stage 12: Accessibility validation
  const accessibility = validateAccessibility(tiles, pois, width, height)

  const elapsed = Date.now() - t0
  console.log(`[WorldGen] Generated ${width}x${height} world in ${elapsed}ms (seed: ${seed})`)
  console.log(`[WorldGen] Rivers: ${riverResult.rivers.length} rivers generated`)
  console.log(`[WorldGen] POIs: ${pois.map(p => `${p.name} (${p.type})`).join(', ')}`)
  console.log(`[WorldGen] Accessibility: ${accessibility.reachable}/${accessibility.total} walkable tiles reachable`)

  return { tiles, pois }
}
