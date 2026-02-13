/**
 * BuildingManager — construction, upgrades, damage, and storage.
 *
 * Buildings have levels, rooms, furniture, and workers. They can be
 * constructed, upgraded, damaged, repaired, and demolished. Custom
 * buildings can be designed by bots via the BuildingDesignRequest API.
 */

import type {
  Building, BuildingType, BuildingState, BuildingCategory,
  Room, Furniture, FurnitureType, FurnitureQuality, RoomPurpose, RoomSize,
  ConstructionCost, BuildingDesignRequest, BuildingDesignResponse,
  WorldClock, Agent,
} from '@botworld/shared'
import { generateId } from '@botworld/shared'
import type { EventBus } from '../core/event-bus.js'

// Placeholder functions until building-data.ts is created
function getBuildingDefinition(type: BuildingType) {
  // Will be implemented in building-data.ts
  return null as any
}

function getConstructionCost(type: BuildingType, level: number): ConstructionCost {
  return { wood: 50, stone: 30 }
}

function getConstructionTime(type: BuildingType, level: number): number {
  return 100
}

const BUILDING_DEFINITIONS = {} as any

const BASE_CONSTRUCTION_RATE = 1.0 // Progress per tick
const WORKER_BONUS = 0.5 // Bonus per worker
const CLEANLINESS_DECAY_RATE = 0.1 // Per tick for occupied buildings

export class BuildingManager {
  private buildings = new Map<string, Building>()
  private eventBus: EventBus
  private lastConstructionTick = 0

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus
  }

  /** Create a new building in 'construction' state */
  createBuilding(
    type: BuildingType,
    name: string,
    position: { x: number; y: number },
    builderId: string,
    tick: number,
    options?: {
      settlementId?: string
      ownerId?: string
      guildId?: string
      style?: string
    },
  ): Building {
    // Validate type exists in definitions (or is 'custom')
    const definition = getBuildingDefinition(type)
    if (!definition && type !== 'custom') {
      throw new Error(`Unknown building type: ${type}`)
    }

    // Get level 1 config
    const level1 = definition?.levels[0]
    if (!level1 && type !== 'custom') {
      throw new Error(`No level 1 config for building type: ${type}`)
    }

    // Create rooms from level 1 definition
    const rooms: Room[] = level1 ? level1.rooms.map((roomDef: any) => ({
      id: generateId(),
      name: roomDef.name,
      size: roomDef.size,
      purpose: roomDef.purpose,
      furniture: roomDef.defaultFurniture.map((fType: FurnitureType) => ({
        type: fType,
        quality: 'basic' as FurnitureQuality,
      })),
      cleanliness: 100,
    })) : []

    const building: Building = {
      id: generateId(),
      name,
      type,
      ownerId: options?.ownerId,
      settlementId: options?.settlementId,
      guildId: options?.guildId,
      x: position.x,
      y: position.y,
      sizeX: level1?.sizeX ?? 2,
      sizeY: level1?.sizeY ?? 2,
      level: 1,
      hp: 0, // Starts at 0 during construction
      maxHp: level1?.maxHp ?? 100,
      defenseRating: level1?.defenseRating ?? 0,
      state: 'construction',
      rooms,
      storage: [],
      workers: [],
      visitors: [],
      upgrades: [],
      production: undefined,
      builtBy: builderId,
      builtAt: tick,
      materialsUsed: level1 ? level1.upgradeCost : { wood: 10, stone: 5 },
      constructionProgress: 0,
      history: [{ tick, event: 'construction_started' }],
      style: options?.style,
    }

    this.buildings.set(building.id, building)

    this.eventBus.emit({
      type: 'building:construction_started',
      buildingId: building.id,
      buildingName: building.name,
      buildingType: building.type,
      builderId,
      position: { x: position.x, y: position.y },
      timestamp: tick,
    })

    return building
  }

  /** Create a custom building designed by a bot */
  createCustomBuilding(
    request: BuildingDesignRequest,
    builderId: string,
    tick: number,
  ): Building {
    // Validate size (max 4x4)
    if (request.size.x > 4 || request.size.y > 4 || request.size.x < 1 || request.size.y < 1) {
      throw new Error('Custom building size must be between 1x1 and 4x4')
    }

    // Create rooms from request
    const rooms: Room[] = request.rooms.map(roomReq => ({
      id: generateId(),
      name: roomReq.name,
      size: 'medium' as RoomSize, // Default for custom buildings
      purpose: roomReq.purpose,
      furniture: roomReq.furniture.map(fType => ({
        type: fType,
        quality: 'basic' as FurnitureQuality,
      })),
      cleanliness: 100,
    }))

    // Calculate cost: base per tile + per room + per furniture
    const baseCost = {
      wood: request.size.x * request.size.y * 5,
      stone: request.size.x * request.size.y * 3,
    }
    const roomCost = request.rooms.length * 10 // 10 wood per room
    const furnitureCost = request.rooms.reduce((sum, r) => sum + r.furniture.length * 5, 0)

    const totalCost: ConstructionCost = {
      wood: baseCost.wood + roomCost + furnitureCost,
      stone: baseCost.stone,
    }

    // Calculate construction time
    const constructionTicks = Math.floor((request.size.x * request.size.y * 50) + (request.rooms.length * 20))

    const building: Building = {
      id: generateId(),
      name: request.name,
      type: 'custom',
      subtype: request.description,
      x: request.location.x,
      y: request.location.y,
      sizeX: request.size.x,
      sizeY: request.size.y,
      level: 1,
      hp: 0,
      maxHp: 50 + (request.size.x * request.size.y * 10),
      defenseRating: 0,
      state: 'construction',
      rooms,
      storage: [],
      workers: [],
      visitors: [],
      upgrades: [],
      builtBy: builderId,
      builtAt: tick,
      materialsUsed: totalCost,
      constructionProgress: 0,
      history: [{ tick, event: 'custom_construction_started' }],
      customDescription: request.description,
    }

    this.buildings.set(building.id, building)

    this.eventBus.emit({
      type: 'building:construction_started',
      buildingId: building.id,
      buildingName: building.name,
      buildingType: 'custom',
      builderId,
      position: { x: request.location.x, y: request.location.y },
      timestamp: tick,
    })

    return building
  }

  /** Estimate cost for a custom building without creating it */
  estimateCustomBuildingCost(request: BuildingDesignRequest): BuildingDesignResponse {
    const errors: string[] = []

    // Validate size
    if (request.size.x > 4 || request.size.y > 4 || request.size.x < 1 || request.size.y < 1) {
      errors.push('Building size must be between 1x1 and 4x4')
    }

    // Validate room count
    if (request.rooms.length === 0) {
      errors.push('Building must have at least one room')
    }

    // Calculate costs
    const baseCost = {
      wood: request.size.x * request.size.y * 5,
      stone: request.size.x * request.size.y * 3,
    }
    const roomCost = request.rooms.length * 10
    const furnitureCost = request.rooms.reduce((sum, r) => sum + r.furniture.length * 5, 0)

    const totalCost: ConstructionCost = {
      wood: baseCost.wood + roomCost + furnitureCost,
      stone: baseCost.stone,
    }

    const constructionTicks = Math.floor((request.size.x * request.size.y * 50) + (request.rooms.length * 20))

    return {
      estimatedCost: totalCost,
      estimatedTicks: constructionTicks,
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    }
  }

  /** Upgrade a building to the next level */
  upgradeBuilding(buildingId: string, tick: number): boolean {
    const building = this.buildings.get(buildingId)
    if (!building) return false

    // Check if can upgrade
    if (!this.canUpgrade(buildingId)) return false

    const definition = getBuildingDefinition(building.type)
    if (!definition) return false

    const nextLevel = building.level + 1
    const levelConfig = definition.levels[nextLevel - 1]
    if (!levelConfig) return false

    // Set to construction state temporarily
    building.state = 'construction'
    building.constructionProgress = 0
    building.level = nextLevel

    // Update building properties
    building.sizeX = levelConfig.sizeX
    building.sizeY = levelConfig.sizeY
    building.maxHp = levelConfig.maxHp
    building.defenseRating = levelConfig.defenseRating

    // Add new rooms from level config
    for (const roomDef of levelConfig.rooms as any[]) {
      // Check if room already exists
      const existingRoom = building.rooms.find(r => r.name === roomDef.name)
      if (!existingRoom) {
        building.rooms.push({
          id: generateId(),
          name: roomDef.name,
          size: roomDef.size,
          purpose: roomDef.purpose,
          furniture: roomDef.defaultFurniture.map((fType: FurnitureType) => ({
            type: fType,
            quality: 'basic' as FurnitureQuality,
          })),
          cleanliness: 100,
        })
      }
    }

    building.history.push({ tick, event: `upgraded_to_level_${nextLevel}` })

    this.eventBus.emit({
      type: 'building:upgraded',
      buildingId: building.id,
      buildingName: building.name,
      buildingType: building.type,
      oldLevel: nextLevel - 1,
      newLevel: nextLevel,
      timestamp: tick,
    })

    return true
  }

  /** Apply damage to a building */
  damageBuilding(
    buildingId: string,
    damage: number,
    source: string,
    tick?: number,
  ): boolean {
    tick = tick ?? Date.now()
    const building = this.buildings.get(buildingId)
    if (!building) return false

    const oldHp = building.hp
    building.hp = Math.max(0, building.hp - damage)

    // Update state based on HP
    if (building.hp <= 0) {
      building.state = 'destroyed'
      building.history.push({ tick, event: `destroyed_by_${source}` })

      this.eventBus.emit({
        type: 'building:destroyed',
        buildingId: building.id,
        buildingName: building.name,
        buildingType: building.type,
        destroyedBy: source,
        position: { x: building.x, y: building.y },
        timestamp: tick,
      })
    } else if (building.hp < building.maxHp * 0.25) {
      building.state = 'damaged'
      building.history.push({ tick, event: `critically_damaged_by_${source}` })
    } else if (building.hp < building.maxHp * 0.75) {
      building.state = 'damaged'
      building.history.push({ tick, event: `damaged_by_${source}` })
    }

    this.eventBus.emit({
      type: 'building:damaged',
      buildingId: building.id,
      buildingName: building.name,
      damage,
      currentHp: building.hp,
      maxHp: building.maxHp,
      source,
      timestamp: tick,
    })

    return true
  }

  /** Repair a damaged building */
  repairBuilding(
    buildingId: string,
    repairerId: string,
    amount: number,
    tick: number,
  ): boolean {
    const building = this.buildings.get(buildingId)
    if (!building) return false

    const oldHp = building.hp
    building.hp = Math.min(building.maxHp, building.hp + amount)

    // Update state if fully repaired
    if (building.state === 'damaged' && building.hp > building.maxHp * 0.75) {
      building.state = 'active'
      building.history.push({ tick, event: `repaired_by_${repairerId}` })
    }

    this.eventBus.emit({
      type: 'building:repaired',
      buildingId: building.id,
      buildingName: building.name,
      repairedBy: repairerId,
      hpRestored: amount,
      timestamp: tick,
    })

    return true
  }

  /** Rebuild a destroyed building at 50% cost */
  rebuildBuilding(buildingId: string, rebuilderId: string, tick: number): boolean {
    const building = this.buildings.get(buildingId)
    if (!building || building.state !== 'destroyed') return false

    // Get construction cost and halve it
    const definition = getBuildingDefinition(building.type)
    if (!definition) return false

    const levelConfig = definition.levels[building.level - 1]
    if (!levelConfig) return false

    const rebuildCost: ConstructionCost = {}
    for (const [key, value] of Object.entries(levelConfig.upgradeCost) as [string, number | undefined][]) {
      if (value !== undefined) {
        rebuildCost[key as keyof ConstructionCost] = Math.floor(value * 0.5)
      }
    }

    building.state = 'construction'
    building.hp = 0
    building.constructionProgress = 0
    building.materialsUsed = rebuildCost
    building.history.push({ tick, event: `rebuild_started_by_${rebuilderId}` })

    this.eventBus.emit({
      type: 'building:construction_started',
      buildingId: building.id,
      buildingName: building.name,
      buildingType: building.type,
      builderId: rebuilderId,
      position: { x: building.x, y: building.y },
      timestamp: tick,
    })

    return true
  }

  /** Demolish a building entirely */
  demolishBuilding(buildingId: string): boolean {
    const building = this.buildings.get(buildingId)
    if (!building) return false

    this.buildings.delete(buildingId)
    return true
  }

  /** Destroy a building (for siege-system compatibility) */
  destroyBuilding(buildingId: string, destroyedBy: string): void {
    const building = this.buildings.get(buildingId)
    if (!building) return

    building.state = 'destroyed'
    building.hp = 0

    this.eventBus.emit({
      type: 'building:destroyed',
      buildingId: building.id,
      buildingName: building.name,
      buildingType: building.type,
      destroyedBy,
      position: { x: building.x, y: building.y },
      timestamp: Date.now(),
    })
  }

  /** Add a worker to a building */
  addWorker(buildingId: string, agentId: string): boolean {
    const building = this.buildings.get(buildingId)
    if (!building) return false
    if (building.workers.includes(agentId)) return false

    building.workers.push(agentId)
    return true
  }

  /** Remove a worker from a building */
  removeWorker(buildingId: string, agentId: string): boolean {
    const building = this.buildings.get(buildingId)
    if (!building) return false

    building.workers = building.workers.filter(id => id !== agentId)
    return true
  }

  /** Add a visitor to a building */
  addVisitor(buildingId: string, agentId: string): boolean {
    const building = this.buildings.get(buildingId)
    if (!building) return false
    if (building.visitors.includes(agentId)) return false

    building.visitors.push(agentId)
    return true
  }

  /** Remove a visitor from a building */
  removeVisitor(buildingId: string, agentId: string): boolean {
    const building = this.buildings.get(buildingId)
    if (!building) return false

    building.visitors = building.visitors.filter(id => id !== agentId)
    return true
  }

  /** Add items to building storage */
  addToStorage(buildingId: string, itemId: string, name: string, quantity: number): boolean {
    const building = this.buildings.get(buildingId)
    if (!building) return false

    const existing = building.storage.find(item => item.itemId === itemId)
    if (existing) {
      existing.quantity += quantity
    } else {
      building.storage.push({ itemId, name, quantity })
    }

    return true
  }

  /** Remove items from building storage */
  removeFromStorage(buildingId: string, itemId: string, quantity: number): boolean {
    const building = this.buildings.get(buildingId)
    if (!building) return false

    const existing = building.storage.find(item => item.itemId === itemId)
    if (!existing || existing.quantity < quantity) return false

    existing.quantity -= quantity
    if (existing.quantity <= 0) {
      building.storage = building.storage.filter(item => item.itemId !== itemId)
    }

    return true
  }

  /** Process construction progress and production */
  tick(clock: WorldClock): void {
    for (const building of this.buildings.values()) {
      // Process construction
      if (building.state === 'construction') {
        const definition = getBuildingDefinition(building.type)
        const levelConfig = definition?.levels[building.level - 1]
        const constructionTicks = levelConfig?.constructionTicks ?? 100

        // Calculate progress rate
        const workerBonus = 1 + (building.workers.length * WORKER_BONUS)
        const progressPerTick = (100 / constructionTicks) * workerBonus

        building.constructionProgress = Math.min(100, (building.constructionProgress ?? 0) + progressPerTick)

        // Complete construction
        if (building.constructionProgress >= 100) {
          building.state = 'active'
          building.hp = building.maxHp
          building.constructionProgress = undefined
          building.history.push({ tick: clock.tick, event: 'construction_completed' })

          this.eventBus.emit({
            type: 'building:construction_completed',
            buildingId: building.id,
            buildingName: building.name,
            buildingType: building.type,
            position: { x: building.x, y: building.y },
            timestamp: clock.tick,
          })
        }
      }

      // Process production
      if (building.production && building.state === 'active') {
        const workerBonus = 1 + (building.workers.length * WORKER_BONUS * 0.5)
        building.production.progress = Math.min(100, building.production.progress + (1 * workerBonus))

        if (building.production.progress >= 100) {
          // Production complete
          if (building.production.outputItem) {
            this.addToStorage(building.id, generateId(), building.production.outputItem, 1)
          }
          building.production.progress = 0
        }
      }

      // Decay cleanliness for occupied buildings
      if (building.visitors.length > 0) {
        for (const room of building.rooms) {
          room.cleanliness = Math.max(0, room.cleanliness - CLEANLINESS_DECAY_RATE)
        }
      }
    }
  }

  /** Get building by ID */
  getBuilding(id: string): Building | undefined {
    return this.buildings.get(id)
  }

  /** Get buildings at a position */
  getBuildingsAt(x: number, y: number): Building[] {
    const results: Building[] = []
    for (const building of this.buildings.values()) {
      // Check if position is within building bounds
      if (x >= building.x && x < building.x + building.sizeX &&
          y >= building.y && y < building.y + building.sizeY) {
        results.push(building)
      }
    }
    return results
  }

  /** Get buildings in a settlement */
  getBuildingsInSettlement(settlementId: string): Building[] {
    return [...this.buildings.values()].filter(b => b.settlementId === settlementId)
  }

  /** Get buildings owned by an agent */
  getBuildingsByOwner(ownerId: string): Building[] {
    return [...this.buildings.values()].filter(b => b.ownerId === ownerId)
  }

  /** Get buildings by type */
  getBuildingsByType(type: BuildingType): Building[] {
    return [...this.buildings.values()].filter(b => b.type === type)
  }

  /** Get all buildings */
  getAllBuildings(): Building[] {
    return [...this.buildings.values()]
  }

  /** Get building functionality based on type, level, and rooms */
  getBuildingFunctionality(buildingId: string): Record<string, number | boolean | string> | null {
    const building = this.buildings.get(buildingId)
    if (!building) return null

    const functionality: Record<string, number | boolean | string> = {}

    // Type-specific functionality
    switch (building.type) {
      case 'blacksmith':
        functionality.canCraft = true
        functionality.canEnchant = building.level >= 3
        functionality.maxTemperature = 800 + (building.level * 100)
        functionality.craftSpeedBonus = (building.level - 1) * 0.1
        break
      case 'library':
        functionality.canResearch = true
        functionality.bookCapacity = building.level * 100
        functionality.researchBonus = building.level * 0.05
        break
      case 'warehouse':
        functionality.storageCapacity = building.level * 500
        break
      case 'tavern':
        functionality.canServeFood = true
        functionality.canProvideRooms = building.level >= 2
        functionality.capacityGuests = building.level * 20
        break
      case 'temple':
        functionality.canBless = true
        functionality.canHeal = building.level >= 2
        functionality.blessingPower = building.level * 10
        break
      case 'workshop':
        functionality.canCraft = true
        functionality.craftSpeedBonus = building.level * 0.15
        break
      case 'alchemy_lab':
        functionality.canBrewPotions = true
        functionality.canTransmute = building.level >= 3
        functionality.potionQuality = building.level
        break
      default:
        functionality.level = building.level
    }

    // Room-based functionality
    const forgeRoom = building.rooms.find(r => r.purpose === 'forge')
    if (forgeRoom) {
      const masterAnvil = forgeRoom.furniture.find(f => f.type === 'anvil' && f.quality === 'masterwork')
      if (masterAnvil) {
        functionality.hasasterAnvil = true
      }
    }

    return functionality
  }

  /** Format building state for LLM context */
  formatForLLM(buildingId: string): string {
    const building = this.buildings.get(buildingId)
    if (!building) return ''

    let line = `[Current Location: ${building.name}]`
    if (building.level > 1) {
      line += ` (Lv${building.level})`
    }
    line += '\n'

    // State
    line += `  State: ${building.state}`
    if (building.state === 'construction' && building.constructionProgress !== undefined) {
      line += ` (${Math.floor(building.constructionProgress)}% complete)`
    }
    if (building.state === 'damaged') {
      const healthPercent = Math.floor((building.hp / building.maxHp) * 100)
      line += ` (${healthPercent}% HP)`
    }
    line += '\n'

    // Facilities (rooms and furniture)
    if (building.rooms.length > 0) {
      line += `  Facilities: `
      const facilities = building.rooms.map(room => {
        const furnitureList = room.furniture.map(f => {
          const qualityStr = f.quality !== 'basic' ? ` (${f.quality})` : ''
          return `${f.type}${qualityStr}`
        }).join(', ')
        return `${room.name} (${furnitureList})`
      }).join(' | ')
      line += facilities + '\n'
    }

    // Storage
    if (building.storage.length > 0) {
      line += `  Storage: `
      const storageStr = building.storage
        .map(item => `${item.name}×${item.quantity}`)
        .join(', ')
      line += storageStr + '\n'
    }

    // Workers and visitors
    if (building.workers.length > 0 || building.visitors.length > 0) {
      line += `  Workers: ${building.workers.length} active`
      if (building.visitors.length > 0) {
        line += ` | Visitors: ${building.visitors.length}`
      }
      line += '\n'
    }

    // Production
    if (building.production) {
      line += `  Production: ${building.production.recipe ?? 'in progress'} (${Math.floor(building.production.progress)}%)\n`
    }

    return line
  }

  /** Get health status */
  getHealthStatus(buildingId: string): 'pristine' | 'good' | 'damaged' | 'critical' | 'destroyed' {
    const building = this.buildings.get(buildingId)
    if (!building) return 'destroyed'

    if (building.hp <= 0) return 'destroyed'
    if (building.hp <= building.maxHp * 0.25) return 'critical'
    if (building.hp <= building.maxHp * 0.5) return 'damaged'
    if (building.hp <= building.maxHp * 0.75) return 'good'
    return 'pristine'
  }

  /** Check if building can be upgraded */
  canUpgrade(buildingId: string): boolean {
    const building = this.buildings.get(buildingId)
    if (!building) return false
    if (building.state !== 'active') return false

    const definition = getBuildingDefinition(building.type)
    if (!definition) return false

    return building.level < definition.maxLevel
  }

  /** Get buildings within radius of a position */
  getBuildingsNear(x: number, y: number, radius: number): Building[] {
    const results: Building[] = []
    for (const building of this.buildings.values()) {
      const dx = building.x - x
      const dy = building.y - y
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance <= radius) {
        results.push(building)
      }
    }
    return results
  }
}
