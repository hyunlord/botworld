/**
 * EcosystemManager — resource regeneration, animals, and seasonal effects.
 *
 * Resources: tree→stump(50 ticks)→sapling(100 ticks)→mature
 *            ore depleted(200 ticks)→regrowing→mature
 *            herb depleted(20 ticks)→regrowing→mature
 * Animals: spawn in biome-appropriate areas, predator-prey dynamics
 * Seasons: affect gathering, energy, crop growth, market prices
 */

import type {
  WorldClock, AnimalInstance, AnimalType, Season, ResourceRegenEntry, ResourceState,
} from '@botworld/shared'
import { generateId, getSeasonFromDay, getSeasonalModifiers, TICKS_PER_GAME_DAY } from '@botworld/shared'
import type { EventBus } from '../core/event-bus.js'
import type { TileMap } from './tile-map.js'

// ── Resource regen timings ──
const TREE_TO_SAPLING_TICKS = 50
const SAPLING_TO_MATURE_TICKS = 100
const ORE_REGEN_TICKS = 200
const HERB_REGEN_TICKS = 20

// ── Animal config ──
const MAX_ANIMALS = 40
const ANIMAL_SPAWN_INTERVAL = 50 // ticks between spawn checks
const ANIMAL_ROAM_INTERVAL = 10

interface AnimalConfig {
  biomes: string[]
  hostile: boolean
  hp: number
  loot: string[]
  maxPop: number
}

const ANIMAL_CONFIGS: Record<AnimalType, AnimalConfig> = {
  rabbit: { biomes: ['grass', 'meadow', 'forest'], hostile: false, hp: 5, loot: ['meat'], maxPop: 10 },
  deer: { biomes: ['forest', 'meadow', 'grass'], hostile: false, hp: 15, loot: ['meat', 'hide'], maxPop: 8 },
  wolf: { biomes: ['forest', 'dense_forest', 'mountain'], hostile: true, hp: 30, loot: ['hide', 'fang'], maxPop: 5 },
  boar: { biomes: ['forest', 'dense_forest', 'swamp'], hostile: true, hp: 25, loot: ['meat', 'hide'], maxPop: 5 },
  chicken: { biomes: ['farmland'], hostile: false, hp: 3, loot: ['meat', 'egg'], maxPop: 6 },
  cow: { biomes: ['farmland', 'meadow'], hostile: false, hp: 20, loot: ['meat', 'milk', 'hide'], maxPop: 4 },
  fish: { biomes: ['water', 'river'], hostile: false, hp: 2, loot: ['fish'], maxPop: 12 },
  sheep: { biomes: ['farmland', 'meadow'], hostile: false, hp: 15, loot: ['meat', 'wool'], maxPop: 4 },
  butterfly: { biomes: ['grass', 'meadow', 'forest'], hostile: false, hp: 1, loot: [], maxPop: 10 },
  bear: { biomes: ['forest', 'mountain'], hostile: true, hp: 60, loot: ['meat', 'hide', 'claw'], maxPop: 3 },
  eagle: { biomes: ['mountain'], hostile: false, hp: 20, loot: ['feather'], maxPop: 4 },
  horse: { biomes: ['grass', 'meadow'], hostile: false, hp: 30, loot: ['meat', 'hide'], maxPop: 4 },
  giant_spider: { biomes: ['cave', 'dense_forest'], hostile: true, hp: 40, loot: ['spider_silk', 'venom'], maxPop: 5 },
  dire_wolf: { biomes: ['snow', 'mountain'], hostile: true, hp: 70, loot: ['hide', 'fang'], maxPop: 3 },
  griffin: { biomes: ['mountain'], hostile: true, hp: 120, loot: ['feather'], maxPop: 1 },
}

export class EcosystemManager {
  private animals = new Map<string, AnimalInstance>()
  private resourceRegen = new Map<string, ResourceRegenEntry>()
  private currentSeason: Season = 'spring'
  private lastSpawnCheck = 0
  private lastRoamCheck = 0

  constructor(
    private eventBus: EventBus,
    private tileMap: TileMap,
  ) {}

  /** Get current season */
  getSeason(): Season {
    return this.currentSeason
  }

  /** Get all alive animals */
  getAnimals(): AnimalInstance[] {
    return [...this.animals.values()]
  }

  /** Get resource regen entries */
  getResourceRegenEntries(): ResourceRegenEntry[] {
    return [...this.resourceRegen.values()]
  }

  /** Kill an animal (e.g. from hunting) */
  killAnimal(animalId: string, killerId: string | null): string[] {
    const animal = this.animals.get(animalId)
    if (!animal) return []

    const config = ANIMAL_CONFIGS[animal.type]
    const loot = [...config.loot]

    this.animals.delete(animalId)

    this.eventBus.emit({
      type: 'animal:died',
      animalId: animal.id,
      animalType: animal.type,
      killedBy: killerId,
      loot,
      timestamp: 0, // will be set by caller with clock.tick
    })

    return loot
  }

  /** Called when a resource tile is fully gathered — start regen timer */
  onResourceDepleted(x: number, y: number, resourceType: string, tick: number): void {
    const key = `${x},${y}`

    let nextTransitionTicks: number
    let initialState: ResourceState

    if (resourceType === 'wood') {
      nextTransitionTicks = TREE_TO_SAPLING_TICKS
      initialState = 'stump'
    } else if (resourceType === 'stone' || resourceType === 'iron' || resourceType === 'gold') {
      nextTransitionTicks = ORE_REGEN_TICKS
      initialState = 'depleted'
    } else if (resourceType === 'herb') {
      nextTransitionTicks = HERB_REGEN_TICKS
      initialState = 'depleted'
    } else {
      nextTransitionTicks = 100
      initialState = 'depleted'
    }

    this.resourceRegen.set(key, {
      key,
      originalType: resourceType,
      currentState: initialState,
      stateChangedAt: tick,
      nextTransitionAt: tick + nextTransitionTicks,
    })

    this.eventBus.emit({
      type: 'resource:state_changed',
      tileKey: key,
      oldState: 'mature',
      newState: initialState,
      timestamp: tick,
    })
  }

  /** Main tick — process resource regen, animal spawning, season changes */
  tick(clock: WorldClock): void {
    // Check season change
    const newSeason = getSeasonFromDay(clock.day)
    if (newSeason !== this.currentSeason) {
      const oldSeason = this.currentSeason
      this.currentSeason = newSeason
      this.eventBus.emit({
        type: 'season:changed',
        oldSeason,
        newSeason,
        day: clock.day,
        timestamp: clock.tick,
      })
      console.log(`[Ecosystem] Season changed: ${oldSeason} → ${newSeason}`)
    }

    // Process resource regeneration
    this.tickResourceRegen(clock)

    // Animal spawning
    if (clock.tick - this.lastSpawnCheck >= ANIMAL_SPAWN_INTERVAL) {
      this.lastSpawnCheck = clock.tick
      this.tickAnimalSpawning(clock)
    }

    // Animal roaming
    if (clock.tick - this.lastRoamCheck >= ANIMAL_ROAM_INTERVAL) {
      this.lastRoamCheck = clock.tick
      this.tickAnimalRoaming()
    }
  }

  /** Format seasonal info for LLM context */
  formatForLLM(): string {
    const mods = getSeasonalModifiers(this.currentSeason)
    const lines = [`[Season] ${this.currentSeason}`]

    if (mods.gatheringMultiplier !== 1.0) {
      lines.push(`  Gathering: ${mods.gatheringMultiplier > 1 ? '+' : ''}${Math.round((mods.gatheringMultiplier - 1) * 100)}%`)
    }
    if (mods.energyCostMultiplier !== 1.0) {
      lines.push(`  Energy cost: ${mods.energyCostMultiplier > 1 ? '+' : ''}${Math.round((mods.energyCostMultiplier - 1) * 100)}%`)
    }
    if (mods.cropGrowthMultiplier === 0) {
      lines.push(`  Crops: growth halted`)
    } else if (mods.cropGrowthMultiplier !== 1.0) {
      lines.push(`  Crop growth: ${mods.cropGrowthMultiplier > 1 ? '+' : ''}${Math.round((mods.cropGrowthMultiplier - 1) * 100)}%`)
    }
    if (!mods.herbAvailable) {
      lines.push(`  Herbs: unavailable this season`)
    }
    if (mods.foodPriceMultiplier > 1.2) {
      lines.push(`  Food prices: high demand (+${Math.round((mods.foodPriceMultiplier - 1) * 100)}%)`)
    }

    // Nearby animals summary
    const animalCounts = new Map<AnimalType, number>()
    for (const animal of this.animals.values()) {
      animalCounts.set(animal.type, (animalCounts.get(animal.type) ?? 0) + 1)
    }
    if (animalCounts.size > 0) {
      const parts: string[] = []
      for (const [type, count] of animalCounts) {
        parts.push(`${type}: ${count}`)
      }
      lines.push(`  Wildlife: ${parts.join(', ')}`)
    }

    return lines.join('\n')
  }

  /** Record predation event (predator killed prey) */
  onPredation(
    predatorTemplateId: string,
    preyTemplateId: string,
    position: { x: number; y: number },
    tick: number,
  ): void {
    // Stub implementation - can be extended with predator-prey tracking
    // Log the predation event for ecosystem balance tracking
    console.log(`[Ecosystem] Predation: ${predatorTemplateId} killed ${preyTemplateId} at (${position.x}, ${position.y})`)
  }

  // ── Private ──

  private tickResourceRegen(clock: WorldClock): void {
    const toRemove: string[] = []

    for (const [key, entry] of this.resourceRegen) {
      if (clock.tick < entry.nextTransitionAt) continue

      const oldState = entry.currentState

      if (entry.originalType === 'wood') {
        if (entry.currentState === 'stump') {
          entry.currentState = 'sapling'
          entry.stateChangedAt = clock.tick
          entry.nextTransitionAt = clock.tick + SAPLING_TO_MATURE_TICKS
        } else if (entry.currentState === 'sapling') {
          entry.currentState = 'mature'
          entry.stateChangedAt = clock.tick
          // Restore the resource on the tile
          this.restoreResource(key, entry.originalType)
          toRemove.push(key)
        }
      } else {
        // Ore, herb, food: depleted → mature
        entry.currentState = 'mature'
        entry.stateChangedAt = clock.tick
        this.restoreResource(key, entry.originalType)
        toRemove.push(key)
      }

      if (oldState !== entry.currentState) {
        this.eventBus.emit({
          type: 'resource:state_changed',
          tileKey: key,
          oldState,
          newState: entry.currentState,
          timestamp: clock.tick,
        })
      }
    }

    for (const key of toRemove) {
      this.resourceRegen.delete(key)
    }
  }

  private restoreResource(key: string, resourceType: string): void {
    const [xStr, yStr] = key.split(',')
    const x = parseInt(xStr, 10)
    const y = parseInt(yStr, 10)
    const tile = this.tileMap.getTile(x, y)
    if (tile && tile.resource) {
      tile.resource.amount = tile.resource.maxAmount
    }
  }

  private tickAnimalSpawning(clock: WorldClock): void {
    if (this.animals.size >= MAX_ANIMALS) return

    // Winter: reduce spawn rate
    const season = this.currentSeason
    if (season === 'winter' && Math.random() > 0.3) return

    // Pick a random animal type to try spawning
    const types = Object.keys(ANIMAL_CONFIGS) as AnimalType[]
    const type = types[Math.floor(Math.random() * types.length)]
    const config = ANIMAL_CONFIGS[type]

    // Check population cap for this type
    let currentPop = 0
    for (const a of this.animals.values()) {
      if (a.type === type) currentPop++
    }
    if (currentPop >= config.maxPop) return

    // Find a valid spawn position in appropriate biome
    const chunks = this.tileMap.getSerializableChunks()
    const chunkKeys = Object.keys(chunks)
    if (chunkKeys.length === 0) return

    const randomChunkKey = chunkKeys[Math.floor(Math.random() * chunkKeys.length)]
    const chunk = chunks[randomChunkKey]
    if (!chunk?.tiles) return

    // Search for a matching biome tile in the chunk
    for (let attempts = 0; attempts < 5; attempts++) {
      const ty = Math.floor(Math.random() * chunk.tiles.length)
      const tx = Math.floor(Math.random() * (chunk.tiles[ty]?.length ?? 0))
      const tile = chunk.tiles[ty]?.[tx]
      if (!tile) continue

      const tileType = tile.type
      if (config.biomes.includes(tileType) && tile.walkable) {
        const animal: AnimalInstance = {
          id: generateId(),
          type,
          position: { x: tile.position.x, y: tile.position.y },
          hp: config.hp,
          maxHp: config.hp,
          hostile: config.hostile,
          spawnedAt: clock.tick,
        }

        this.animals.set(animal.id, animal)

        this.eventBus.emit({
          type: 'animal:spawned',
          animalId: animal.id,
          animalType: type,
          position: animal.position,
          timestamp: clock.tick,
        })
        break
      }
    }
  }

  private tickAnimalRoaming(): void {
    for (const animal of this.animals.values()) {
      // Animals roam randomly within 2 tiles
      if (Math.random() > 0.3) continue

      const dx = Math.floor(Math.random() * 3) - 1
      const dy = Math.floor(Math.random() * 3) - 1
      const newX = animal.position.x + dx
      const newY = animal.position.y + dy

      if (this.tileMap.isWalkable(newX, newY)) {
        animal.position = { x: newX, y: newY }
      }
    }
  }
}
