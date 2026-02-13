import type {
  WorldLayer,
  LayerPortal,
  AgentLayerState,
  FogOfWarState,
  PortalRequirement,
  SpecialRegionType,
  DungeonRoom,
  DungeonTrap,
} from '@botworld/shared'
import { generateId } from '@botworld/shared'
import type { EventBus } from '../core/event-bus.js'
import type { UndergroundGenerator } from './underground-generator.js'
import type { OceanSystem } from './ocean-system.js'
import { createSpecialRegion } from './special-regions.js'

export class WorldLayerManager {
  private layers = new Map<string, WorldLayer>()
  private agentStates = new Map<string, AgentLayerState>()
  private fogOfWar = new Map<string, FogOfWarState>() // key: "agentId:layerId"
  private surfaceLayerId: string
  private layerTiles = new Map<string, number[][]>()   // layerId -> 2D tile array
  private layerRooms = new Map<string, DungeonRoom[]>() // layerId -> rooms
  private layerTraps = new Map<string, DungeonTrap[]>() // layerId -> traps
  private agentPositions = new Map<string, { x: number; y: number }>() // agentId -> position

  constructor(
    private eventBus: EventBus,
    private undergroundGen: UndergroundGenerator,
    private oceanSystem: OceanSystem,
  ) {
    // Create surface layer
    this.surfaceLayerId = this.createSurfaceLayer()

    // Add ocean layer
    const oceanLayer = this.oceanSystem.getOceanLayer()
    this.layers.set(oceanLayer.id, oceanLayer)

    // Create special regions
    this.initializeSpecialRegions()
  }

  private createSurfaceLayer(): string {
    const surfaceId = generateId('layer_surface')

    const layer: WorldLayer = {
      id: surfaceId,
      name: 'Surface World',
      type: 'surface',
      depth: 0,
      width: 256,
      height: 256,
      ambientLight: 1.0,
      dangerLevel: 2,
      portals: [],
      spawnTable: [],
      resourceTable: [],
      rules: {
        allowCombat: true,
        allowBuilding: true,
        requiresLight: false,
        fogOfWar: false,
        weatherAffected: true,
        timeOfDayAffected: true,
      },
    }

    this.layers.set(surfaceId, layer)
    return surfaceId
  }

  private initializeSpecialRegions(): void {
    const regionTypes: SpecialRegionType[] = [
      'enchanted_forest',
      'dragon_domain',
      'elven_city',
      'cursed_lands',
    ]

    const portalPositions = [
      { x: 50, y: 50 }, // enchanted_forest
      { x: 200, y: 50 }, // dragon_domain
      { x: 50, y: 200 }, // elven_city
      { x: 200, y: 200 }, // cursed_lands
    ]

    for (let i = 0; i < regionTypes.length; i++) {
      const regionType = regionTypes[i]
      const region = createSpecialRegion(regionType)
      region.specialRegion = regionType

      // Add portal from surface to special region
      const requirements: PortalRequirement[] = []

      if (regionType === 'enchanted_forest') {
        requirements.push(
          { type: 'skill_level', skillId: 'arcane', minLevel: 5 },
          { type: 'item', itemId: 'fairy_guide' },
        )
      } else if (regionType === 'dragon_domain') {
        requirements.push(
          { type: 'skill_level', skillId: 'combat', minLevel: 8 },
          { type: 'item', itemId: 'dragon_map' },
        )
      } else if (regionType === 'elven_city') {
        requirements.push(
          { type: 'skill_level', skillId: 'charisma', minLevel: 7 },
          { type: 'race', race: 'elf' },
        )
      }
      // cursed_lands has no requirements

      const surfacePortal: LayerPortal = {
        id: generateId('portal'),
        sourceLayerId: this.surfaceLayerId,
        sourcePosition: portalPositions[i],
        targetLayerId: region.id,
        targetPosition: { x: Math.floor(region.width / 2), y: Math.floor(region.height / 2) },
        portalType: 'magic_portal',
        requirements: requirements.length > 0 ? requirements : undefined,
        discovered: false,
        discoveredBy: [],
      }

      // Portal back to surface
      const returnPortal: LayerPortal = {
        id: generateId('portal'),
        sourceLayerId: region.id,
        sourcePosition: { x: Math.floor(region.width / 2), y: Math.floor(region.height / 2) },
        targetLayerId: this.surfaceLayerId,
        targetPosition: portalPositions[i],
        portalType: 'magic_portal',
        discovered: true,
        discoveredBy: [],
      }

      // Add portals
      const surface = this.layers.get(this.surfaceLayerId)!
      surface.portals.push(surfacePortal)
      region.portals.push(returnPortal)

      // Register region layer
      this.layers.set(region.id, region)
    }
  }

  /**
   * Generate underground layers for a mine entrance position
   */
  generateUnderground(entrancePos: { x: number; y: number }): void {
    const result = this.undergroundGen.generateUnderground(entrancePos)

    // Register all underground layers
    this.layers.set(result.mine.id, result.mine)
    this.layers.set(result.cavern.id, result.cavern)
    this.layers.set(result.ruins.id, result.ruins)

    // Store tile/room/trap data
    for (const [id, tileData] of result.tiles) {
      this.layerTiles.set(id, tileData)
    }
    for (const [id, roomData] of result.rooms) {
      this.layerRooms.set(id, roomData)
    }
    for (const [id, trapData] of result.traps) {
      this.layerTraps.set(id, trapData)
    }

    // Add portal from surface to mine
    const mineEntrance: LayerPortal = {
      id: generateId('portal'),
      sourceLayerId: this.surfaceLayerId,
      sourcePosition: entrancePos,
      targetLayerId: result.mine.id,
      targetPosition: { x: 15, y: 15 },
      portalType: 'mine_entrance',
      discovered: true,
      discoveredBy: [],
    }

    const surface = this.layers.get(this.surfaceLayerId)!
    surface.portals.push(mineEntrance)
  }

  /**
   * Get a layer by ID
   */
  getLayer(layerId: string): WorldLayer | undefined {
    return this.layers.get(layerId)
  }

  /**
   * Get all layers
   */
  getAllLayers(): WorldLayer[] {
    return Array.from(this.layers.values())
  }

  /**
   * Get layer tiles
   */
  getLayerTiles(layerId: string): number[][] | undefined {
    return this.layerTiles.get(layerId)
  }

  /**
   * Get layer rooms
   */
  getLayerRooms(layerId: string): DungeonRoom[] {
    return this.layerRooms.get(layerId) ?? []
  }

  /**
   * Get layer traps
   */
  getLayerTraps(layerId: string): DungeonTrap[] {
    return this.layerTraps.get(layerId) ?? []
  }

  /**
   * Get detailed layer info including tiles, rooms, traps, and agents
   */
  getLayerDetail(layerId: string): {
    layer: WorldLayer
    tiles: number[][] | undefined
    rooms: DungeonRoom[]
    traps: DungeonTrap[]
    agents: string[]
  } | undefined {
    const layer = this.layers.get(layerId)
    if (!layer) return undefined
    return {
      layer,
      tiles: this.layerTiles.get(layerId),
      rooms: this.layerRooms.get(layerId) ?? [],
      traps: this.layerTraps.get(layerId) ?? [],
      agents: this.getAgentsInLayer(layerId),
    }
  }

  /**
   * Get the surface layer ID
   */
  getSurfaceLayerId(): string {
    return this.surfaceLayerId
  }

  /**
   * Get agent's current layer
   */
  getAgentLayer(agentId: string): string {
    return this.agentStates.get(agentId)?.currentLayerId ?? this.surfaceLayerId
  }

  /**
   * Initialize agent layer state (call when agent spawns)
   */
  initializeAgent(agentId: string): void {
    if (!this.agentStates.has(agentId)) {
      this.agentStates.set(agentId, {
        agentId,
        currentLayerId: this.surfaceLayerId,
        exploredTiles: {},
        discoveredPortals: [],
      })
    }
  }

  /**
   * Transition agent through a portal
   */
  transitionAgent(
    agentId: string,
    portalId: string,
    tick: number,
  ): { success: boolean; reason?: string } {
    const state = this.agentStates.get(agentId)
    if (!state) {
      return { success: false, reason: 'Agent not initialized' }
    }

    // Find portal in current layer
    const currentLayer = this.layers.get(state.currentLayerId)
    if (!currentLayer) {
      return { success: false, reason: 'Current layer not found' }
    }

    const portal = currentLayer.portals.find((p) => p.id === portalId)
    if (!portal) {
      return { success: false, reason: 'Portal not found in current layer' }
    }

    // Check if portal is discovered
    if (!portal.discovered && !portal.discoveredBy.includes(agentId)) {
      return { success: false, reason: 'Portal not yet discovered' }
    }

    // Check requirements
    if (portal.requirements) {
      const reqCheck = this.checkRequirements(agentId, portal.requirements)
      if (!reqCheck.met) {
        return { success: false, reason: reqCheck.reason }
      }
    }

    const fromLayerId = state.currentLayerId
    const toLayerId = portal.targetLayerId

    // Check if target layer was never visited
    const firstVisit = !state.exploredTiles[toLayerId]

    // Update agent state
    state.currentLayerId = toLayerId
    if (!state.exploredTiles[toLayerId]) {
      state.exploredTiles[toLayerId] = []
    }

    // Emit transition event
    this.eventBus.emit({
      type: 'layer:transition',
      agentId,
      fromLayerId,
      toLayerId,
      portalId,
      timestamp: tick,
    })

    // If first visit, emit discovered event
    if (firstVisit) {
      const targetLayer = this.layers.get(toLayerId)
      if (targetLayer) {
        this.eventBus.emit({
          type: 'layer:discovered',
          agentId,
          layerId: toLayerId,
          layerName: targetLayer.name,
          layerType: targetLayer.type,
          timestamp: tick,
        })
      }
    }

    // Update fog of war at arrival position
    this.updateFogOfWar(agentId, portal.targetPosition, 5)

    return { success: true }
  }

  /**
   * Check if agent meets portal requirements
   */
  private checkRequirements(
    agentId: string,
    requirements: PortalRequirement[],
  ): { met: boolean; reason?: string } {
    // For now, only implement skill_level checks
    // Other requirement types (item, quest, race) return true as placeholder
    for (const req of requirements) {
      if (req.type === 'skill_level') {
        // TODO: Integrate with agent skill system
        // For now, assume requirement is met
        // In real implementation, would check agent.skills[req.skillId!] >= req.minLevel!
        continue
      }
      // Placeholder: other requirement types always pass
    }

    return { met: true }
  }

  /**
   * Discover a portal (make it visible)
   */
  discoverPortal(agentId: string, portalId: string, tick: number): boolean {
    // Find the portal in any layer
    for (const layer of this.layers.values()) {
      const portal = layer.portals.find((p) => p.id === portalId)
      if (portal) {
        if (portal.discoveredBy.includes(agentId)) {
          return false // Already discovered by this agent
        }

        portal.discoveredBy.push(agentId)
        portal.discovered = true

        const state = this.agentStates.get(agentId)
        if (state) {
          state.discoveredPortals.push(portalId)
        }

        this.eventBus.emit({
          type: 'portal:discovered',
          agentId,
          portalId,
          portalType: portal.portalType,
          layerId: layer.id,
          timestamp: tick,
        })

        return true
      }
    }

    return false
  }

  /**
   * Update fog of war for an agent (reveal tiles around their position)
   */
  updateFogOfWar(agentId: string, position: { x: number; y: number }, visionRange: number): void {
    const state = this.agentStates.get(agentId)
    if (!state) {
      return
    }

    const layerId = state.currentLayerId
    const key = `${agentId}:${layerId}`

    let fogState = this.fogOfWar.get(key)
    if (!fogState) {
      fogState = {
        layerId,
        agentId,
        revealedTiles: [],
        visionRange,
      }
      this.fogOfWar.set(key, fogState)
    }

    // Reveal tiles within visionRange (Manhattan distance)
    for (let dy = -visionRange; dy <= visionRange; dy++) {
      for (let dx = -visionRange; dx <= visionRange; dx++) {
        const distance = Math.abs(dx) + Math.abs(dy)
        if (distance <= visionRange) {
          const tileKey = `${position.x + dx},${position.y + dy}`
          if (!fogState.revealedTiles.includes(tileKey)) {
            fogState.revealedTiles.push(tileKey)
          }
        }
      }
    }
  }

  /**
   * Update agent position (for trap checking and fog of war)
   */
  updateAgentPosition(agentId: string, position: { x: number; y: number }): void {
    this.agentPositions.set(agentId, position)

    const state = this.agentStates.get(agentId)
    if (!state) return

    const layer = this.layers.get(state.currentLayerId)
    if (!layer) return

    // Update fog of war
    const visionRange = 5 // default underground vision
    this.updateFogOfWar(agentId, position, visionRange)

    // Check traps
    const traps = this.layerTraps.get(state.currentLayerId)
    if (traps) {
      for (const trap of traps) {
        if (trap.disarmed) continue
        if (trap.position.x === position.x && trap.position.y === position.y) {
          // Trap triggered!
          this.eventBus.emit({
            type: 'trap:triggered',
            agentId,
            trapId: trap.id,
            trapType: trap.type,
            damage: trap.damage,
            layerId: state.currentLayerId,
            timestamp: Date.now(),
          })
          trap.disarmed = true // one-time trigger
        }
      }
    }

    // Check room entry
    const rooms = this.layerRooms.get(state.currentLayerId)
    if (rooms) {
      for (const room of rooms) {
        if (position.x >= room.x && position.x < room.x + room.width &&
            position.y >= room.y && position.y < room.y + room.height) {
          // Check if first time entering this room
          const roomKey = `${state.currentLayerId}:${room.id}`
          if (!state.exploredTiles[roomKey]) {
            state.exploredTiles[roomKey] = ['entered']
            this.eventBus.emit({
              type: 'dungeon:room_entered',
              agentId,
              roomId: room.id,
              roomType: room.type,
              layerId: state.currentLayerId,
              timestamp: Date.now(),
            })
          }
        }
      }
    }
  }

  /**
   * Get agent position
   */
  getAgentPosition(agentId: string): { x: number; y: number } | undefined {
    return this.agentPositions.get(agentId)
  }

  /**
   * Get fog of war state for agent in a layer
   */
  getFogOfWar(agentId: string, layerId: string): FogOfWarState | undefined {
    return this.fogOfWar.get(`${agentId}:${layerId}`)
  }

  /**
   * Get all portals for a layer
   */
  getLayerPortals(layerId: string): LayerPortal[] {
    const layer = this.layers.get(layerId)
    return layer?.portals ?? []
  }

  /**
   * Get agents in a specific layer
   */
  getAgentsInLayer(layerId: string): string[] {
    const agentIds: string[] = []
    for (const [agentId, state] of this.agentStates.entries()) {
      if (state.currentLayerId === layerId) {
        agentIds.push(agentId)
      }
    }
    return agentIds
  }

  /**
   * Tick - process layer-specific effects per tick
   */
  tick(tick: number): void {
    for (const [agentId, state] of this.agentStates.entries()) {
      const layer = this.layers.get(state.currentLayerId)
      if (!layer) continue

      // Process traps for agents in underground layers
      if (layer.type === 'mine' || layer.type === 'cavern' || layer.type === 'ancient_ruins') {
        this.processTraps(agentId, state.currentLayerId, tick)
      }

      // Apply special region effects
      if (layer.specialRegion === 'cursed_lands' && tick % 10 === 0) {
        this.eventBus.emit({
          type: 'trap:triggered',
          agentId,
          trapId: 'cursed_lands_damage',
          trapType: 'environmental',
          damage: 5,
          layerId: state.currentLayerId,
          timestamp: tick,
        })
      } else if (layer.specialRegion === 'dragon_domain' && tick % 5 === 0) {
        this.eventBus.emit({
          type: 'trap:triggered',
          agentId,
          trapId: 'volcanic_damage',
          trapType: 'environmental',
          damage: 3,
          layerId: state.currentLayerId,
          timestamp: tick,
        })
      }
      // enchanted_forest and elven_city have passive bonuses, handled elsewhere
    }
  }

  /**
   * Process traps for an agent in underground layer
   */
  private processTraps(agentId: string, layerId: string, tick: number): void {
    const traps = this.layerTraps.get(layerId)
    if (!traps) return

    const position = this.agentPositions.get(agentId)
    if (!position) return

    // Check if agent is on a trap tile
    for (const trap of traps) {
      if (trap.disarmed) continue
      if (trap.position.x === position.x && trap.position.y === position.y) {
        // Trap already triggered by updateAgentPosition
        // This is just a safety check for ticks
        continue
      }
    }
  }

  /**
   * Handle agent knockout in underground - return to surface
   */
  handleUndergroundKnockout(agentId: string, tick: number): { returnToSurface: boolean; surfacePosition?: { x: number; y: number } } {
    const state = this.agentStates.get(agentId)
    if (!state || state.currentLayerId === this.surfaceLayerId) {
      return { returnToSurface: false }
    }

    // Agent knocked out in underground - return to surface
    const fromLayerId = state.currentLayerId
    state.currentLayerId = this.surfaceLayerId

    // Find the surface entrance position (from the mine entrance portal)
    const surface = this.layers.get(this.surfaceLayerId)!
    const minePortal = surface.portals.find(p => p.portalType === 'mine_entrance')
    const surfacePos = minePortal?.sourcePosition ?? { x: 8, y: 8 }

    this.eventBus.emit({
      type: 'layer:transition',
      agentId,
      fromLayerId,
      toLayerId: this.surfaceLayerId,
      portalId: 'knockout_revival',
      timestamp: tick,
    })

    return { returnToSurface: true, surfacePosition: surfacePos }
  }

  /**
   * Format layer info for LLM context
   */
  formatForLLM(agentId: string): string {
    const state = this.agentStates.get(agentId)
    if (!state) {
      return 'Agent layer state not initialized.'
    }

    const currentLayer = this.layers.get(state.currentLayerId)
    if (!currentLayer) {
      return 'Current layer not found.'
    }

    let context = `=== CURRENT LAYER ===\n`
    context += `Name: ${currentLayer.name}\n`
    context += `Type: ${currentLayer.type}\n`
    context += `Depth: ${currentLayer.depth}\n`
    context += `Size: ${currentLayer.width}x${currentLayer.height}\n`
    context += `Ambient light: ${currentLayer.ambientLight * 100}%\n`
    context += `Danger level: ${currentLayer.dangerLevel}/10\n`

    if (currentLayer.rules.specialEffects) {
      context += `Special effects: ${currentLayer.rules.specialEffects.join(', ')}\n`
    }

    // Nearby portals
    const discoveredPortals = currentLayer.portals.filter(
      (p) => p.discovered || p.discoveredBy.includes(agentId),
    )

    if (discoveredPortals.length > 0) {
      context += `\nNEARBY PORTALS:\n`
      for (const portal of discoveredPortals) {
        const targetLayer = this.layers.get(portal.targetLayerId)
        const targetName = targetLayer?.name ?? 'Unknown'
        context += `- ${portal.portalType} at (${portal.sourcePosition.x}, ${portal.sourcePosition.y}) → ${targetName}\n`

        if (portal.requirements && portal.requirements.length > 0) {
          context += `  Requirements: `
          const reqStrings = portal.requirements.map((req) => {
            if (req.type === 'skill_level') {
              return `${req.skillId} level ${req.minLevel}`
            } else if (req.type === 'item') {
              return `item: ${req.itemId}`
            } else if (req.type === 'race') {
              return `race: ${req.race}`
            }
            return req.type
          })
          context += reqStrings.join(' OR ') + '\n'
        }
      }
    }

    // Explored layers
    const exploredCount = Object.keys(state.exploredTiles).length
    context += `\nEXPLORED LAYERS: ${exploredCount}\n`

    return context
  }

  /**
   * Get state for serialization/API response
   */
  getState(): {
    layers: { id: string; name: string; type: string; depth: number; agentCount: number }[]
    totalPortals: number
  } {
    const layers = Array.from(this.layers.values()).map((layer) => ({
      id: layer.id,
      name: layer.name,
      type: layer.type,
      depth: layer.depth,
      agentCount: this.getAgentsInLayer(layer.id).length,
    }))

    const totalPortals = Array.from(this.layers.values()).reduce(
      (sum, layer) => sum + layer.portals.length,
      0,
    )

    return { layers, totalPortals }
  }
}
