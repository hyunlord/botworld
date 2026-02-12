import Phaser from 'phaser'
import type { Agent, Tile, WorldEvent, WorldClock, ChunkData, CharacterAppearance, Race, CharacterAppearanceMap, WeatherState, ActiveWorldEvent, Monster, EmotionState } from '@botworld/shared'
import { CHUNK_SIZE } from '@botworld/shared'
import { composeCharacterSprite } from '../character/sprite-composer.js'
import { SpriteCache } from '../character/sprite-cache.js'
import { WeatherEffects } from '../effects/weather-effects.js'
import { DayNightCycle } from '../effects/day-night-cycle.js'
import { ShadowSystem } from '../effects/shadow-system.js'
import { WaterAnimation } from '../effects/water-animation.js'
import { AmbientParticles } from '../effects/ambient-particles.js'
import { PostProcessing } from '../effects/post-processing.js'
import { soundManager } from '../audio/sound-manager.js'
import { InteractionEffects } from '../systems/interaction-effects.js'
import { EventVisuals } from '../systems/event-visuals.js'
import { TILE_SIZE, ISO_TILE_WIDTH, ISO_TILE_HEIGHT, worldToScreen, screenToWorld, isoDepth } from '../utils/coordinates.js'
import { getAutoTileIndex } from '../utils/autotile.js'

// Scale factors for sprites placed on the top-down grid
const AGENT_SCALE = 0.6
const RESOURCE_SCALE = 0.35
const BUILDING_SCALE = 1.0

// Building pixel dimensions (must match generate-building-sprites.js output)
const BUILDING_SIZES: Record<string, { w: number; h: number }> = {
  tavern:        { w: 96,  h: 64 },
  marketplace:   { w: 128, h: 96 },
  blacksmith:    { w: 64,  h: 64 },
  workshop:      { w: 64,  h: 64 },
  library:       { w: 96,  h: 96 },
  temple:        { w: 96,  h: 64 },
  farm:          { w: 128, h: 96 },
  mine:          { w: 64,  h: 64 },
  mine_entrance: { w: 64,  h: 64 },
  inn:           { w: 96,  h: 64 },
  watchtower:    { w: 64,  h: 64 },
  guild_hall:    { w: 96,  h: 96 },
  fountain:      { w: 64,  h: 64 },
  ruins:         { w: 96,  h: 64 },
  port:          { w: 128, h: 64 },
  fishing_hut:   { w: 64,  h: 64 },
  witch_hut:     { w: 64,  h: 64 },
}


interface RenderedChunk {
  objectSprites: Phaser.GameObjects.GameObject[]
}

// ── Ground tile index mapping (iso-terrain-sheet.png v3 spritesheet) ──
// Tile indices match generate-iso-terrain-v3.js output → iso-terrain-tiles.json

// v3 tile index constants for readability
const T = {
  // Row 0: Grass & dirt (0-15)
  grass_lush_01: 0, grass_lush_02: 1, grass_lush_03: 2, grass_lush_04: 3, grass_lush_05: 4,
  grass_dry_01: 5, grass_dry_02: 6, grass_dry_03: 7,
  grass_dark_01: 8, grass_dark_02: 9, grass_dark_03: 10,
  dirt_01: 11, dirt_02: 12, dirt_03: 13,
  dirt_path_01: 14, dirt_path_02: 15,
  // Row 1: Sand, snow, stone (16-31)
  sand_01: 16, sand_02: 17, sand_03: 18,
  sand_wet_01: 19, sand_wet_02: 20,
  snow_01: 21, snow_02: 22, snow_03: 23,
  snow_dirty_01: 24, snow_dirty_02: 25,
  stone_01: 26, stone_02: 27, stone_03: 28,
  stone_cobble_01: 29, stone_cobble_02: 30, stone_cobble_03: 31,
  // Row 2: Farmland, swamp, cave, water (32-47)
  farmland_01: 32, farmland_02: 33, farmland_03: 34,
  swamp_01: 35, swamp_02: 36,
  cave_01: 37, cave_02: 38,
  water_deep_01: 39, water_deep_02: 40, water_deep_03: 41,
  water_shallow_01: 42, water_shallow_02: 43, water_shallow_03: 44,
  water_shore_N: 45, water_shore_S: 46, water_shore_E: 47,
  // Row 3: Water shores, rivers (48-63)
  water_shore_W: 48,
  water_shore_NE: 49, water_shore_NW: 50, water_shore_SE: 51, water_shore_SW: 52,
  water_shore_inner_NE: 53, water_shore_inner_NW: 54, water_shore_inner_SE: 55, water_shore_inner_SW: 56,
  water_river_H: 57, water_river_V: 58,
  water_river_turn_NE: 59, water_river_turn_NW: 60, water_river_turn_SE: 61, water_river_turn_SW: 62,
  water_river_cross: 63,
  // Row 4: Roads (64-79)
  road_dirt_H: 64, road_dirt_V: 65, road_dirt_cross: 66,
  road_dirt_turn_NE: 67, road_dirt_turn_NW: 68, road_dirt_turn_SE: 69, road_dirt_turn_SW: 70,
  road_stone_H: 71, road_stone_V: 72, road_stone_cross: 73,
  road_stone_turn_NE: 74, road_stone_turn_NW: 75, road_stone_turn_SE: 76, road_stone_turn_SW: 77,
  road_stone_end_N: 78, road_stone_end_S: 79,
  // Row 5: Cliffs, mountains (80-95)
  cliff_face_N: 80, cliff_face_S: 81, cliff_face_E: 82, cliff_face_W: 83,
  cliff_top_01: 84, cliff_top_02: 85, cliff_top_03: 86,
  cliff_edge_N: 87, cliff_edge_S: 88, cliff_edge_E: 89, cliff_edge_W: 90,
  mountain_rock_01: 91, mountain_rock_02: 92, mountain_rock_03: 93,
  // Row 9+: Extended terrain types
  forest_floor_01: 144, forest_floor_02: 145, forest_floor_03: 146,
  beach_shell_01: 147, beach_shell_02: 148,
  gravel_01: 151, gravel_02: 152, gravel_03: 153,
  lava_rock_01: 154, lava_rock_02: 155,
  ice_01: 164, ice_02: 165, ice_03: 166,
  mountain_snow_01: 177, mountain_snow_02: 178, mountain_snow_03: 179,
  volcanic_01: 180, volcanic_02: 181,
  bridge_stone_01: 182, bridge_stone_02: 183,
  ruins_floor_01: 184, ruins_floor_02: 185, ruins_floor_03: 186,
  magic_ground_01: 187, magic_ground_02: 188,
  meadow_01: 189, meadow_02: 190, meadow_03: 191,
} as const

/** Pick a variant index from an array based on tile variant/hash */
function pickVariant(base: number, count: number, variant: number): number {
  return base + (variant % count)
}

function getGroundTileIndex(tile: Tile): number {
  const variant = tile.variant ?? 0
  const biome = tile.biome ?? ''

  switch (tile.type) {
    case 'grass':
      if (tile.decoration?.includes('flower')) return pickVariant(T.meadow_01, 3, variant)
      if (biome === 'savanna' || biome === 'highland') return pickVariant(T.grass_dry_01, 3, variant)
      if (biome === 'dry' || biome === 'plains_edge') return pickVariant(T.grass_dry_01, 3, variant)
      return pickVariant(T.grass_lush_01, 5, variant)
    case 'meadow':
      return pickVariant(T.meadow_01, 3, variant)
    case 'forest':
    case 'dense_forest':
      return pickVariant(T.forest_floor_01, 3, variant)
    case 'water':
      return pickVariant(T.water_shallow_01, 3, variant)
    case 'deep_water':
      return pickVariant(T.water_deep_01, 3, variant)
    case 'river':
      return T.water_river_H
    case 'sand':
      if (biome === 'beach' || biome === 'coast') return pickVariant(T.sand_wet_01, 2, variant)
      return pickVariant(T.sand_01, 3, variant)
    case 'beach':
      return variant % 4 === 0
        ? pickVariant(T.beach_shell_01, 2, variant)
        : pickVariant(T.sand_wet_01, 2, variant)
    case 'mountain':
      if (biome === 'snow_peak') return pickVariant(T.mountain_snow_01, 3, variant)
      return pickVariant(T.mountain_rock_01, 3, variant)
    case 'cliff':
      return pickVariant(T.cliff_top_01, 3, variant)
    case 'snow':
      if (biome === 'dirty' || biome === 'road') return pickVariant(T.snow_dirty_01, 2, variant)
      return pickVariant(T.snow_01, 3, variant)
    case 'ice':
      return pickVariant(T.ice_01, 3, variant)
    case 'tundra':
      return pickVariant(T.gravel_01, 3, variant)
    case 'lava':
      return pickVariant(T.lava_rock_01, 2, variant)
    case 'volcanic':
      return pickVariant(T.volcanic_01, 2, variant)
    case 'swamp':
      return pickVariant(T.swamp_01, 2, variant)
    case 'farmland':
      return pickVariant(T.farmland_01, 3, variant)
    case 'road':
      return tile.poiType ? T.road_stone_H : T.road_dirt_H
    default:
      return pickVariant(T.grass_lush_01, 5, variant)  // grass fallback
  }
}

// ── Object/building texture resolution (for sprites on top of tilemap) ──

/** Map POI type to the best available building texture key */
function resolveBuildingTexture(poiType: string, textures: Phaser.Textures.TextureManager): string {
  const poiToBldg: Record<string, string> = {
    marketplace: 'bldg_marketplace',
    tavern: 'bldg_tavern',
    workshop: 'bldg_blacksmith',
    library: 'bldg_library',
    farm: 'bldg_farm',
    mine: 'bldg_mine_entrance',
    temple: 'bldg_temple',
    fishing_hut: 'bldg_fishing_hut',
    watchtower: 'bldg_watchtower',
    guild_hall: 'bldg_guild_hall',
    inn: 'bldg_inn',
    fountain: 'bldg_fountain',
    ruins: 'bldg_ruins',
    witch_hut: 'bldg_witch_hut',
    port: 'bldg_port',
  }

  const newKey = poiToBldg[poiType]
  if (newKey && textures.exists(newKey)) return newKey

  const legacyKey = `building_${poiType}`
  if (textures.exists(legacyKey)) return legacyKey

  return 'tile_building'
}

/** Map resource type + biome to the best resource overlay sprite */
function resolveResourceTexture(resourceType: string, biome: string, textures: Phaser.Textures.TextureManager): string {
  const biomeResourceMap: Record<string, Record<string, string>> = {
    wood: {
      desert: 'res_tree_palm',
      beach: 'res_tree_palm',
      tundra: 'res_tree_pine',
      snow: 'res_tree_pine',
      _default: 'res_tree_oak',
    },
    stone: { _default: 'res_rock_large' },
    food: { _default: 'res_bush_berry' },
    herb: { _default: 'res_herb_green' },
    iron: { _default: 'res_ore_iron' },
    gold: { _default: 'res_ore_gold' },
  }

  const mapping = biomeResourceMap[resourceType]
  if (mapping) {
    const key = mapping[biome] ?? mapping['_default']
    if (key && textures.exists(key)) return key
  }

  const legacyKey = `resource_${resourceType}`
  if (textures.exists(legacyKey)) return legacyKey

  return 'resource_indicator'
}

/**
 * Main top-down world scene with chunk-based rendering.
 * Renders flat square tiles using a Phaser Tilemap ground layer,
 * with object sprites (resources, buildings, agents) on top.
 */
export class WorldScene extends Phaser.Scene {
  // Chunk data received from server
  private chunkDataStore = new Map<string, ChunkData>()
  // Currently rendered chunks (viewport-based)
  private renderedChunks = new Map<string, RenderedChunk>()
  // Phaser Tilemap for ground rendering
  private tilemap: Phaser.Tilemaps.Tilemap | null = null
  private groundLayer: Phaser.Tilemaps.TilemapLayer | null = null
  private paintedChunks = new Set<string>()
  // Tilemap origin in world tile coords and size
  private tmOriginX = -150
  private tmOriginY = -150
  private tmSize = 300

  // Agent rendering
  private agentSprites = new Map<string, Phaser.GameObjects.Container>()
  private agentDirections = new Map<string, string>()  // agentId → 'down'|'left'|'right'|'up'
  private agentMoving = new Map<string, boolean>()      // agentId → currently walking
  private actionIndicators = new Map<string, Phaser.GameObjects.Image>()
  private agentEmotionIcons = new Map<string, Phaser.GameObjects.Image>()  // agentId → emotion icon
  private agentActionIcons = new Map<string, Phaser.GameObjects.Image>()   // agentId → action icon
  private speechBubbles = new Map<string, { container: Phaser.GameObjects.Container; timer: number }>()
  private monsterSprites = new Map<string, Phaser.GameObjects.Container>()
  private dayNightCycle: DayNightCycle | null = null
  private selectionRing: Phaser.GameObjects.Image | null = null
  private weatherEffects: WeatherEffects | null = null
  private interactionEffects: InteractionEffects | null = null
  private eventVisuals: EventVisuals | null = null
  private shadowSystem: ShadowSystem | null = null
  private waterAnimation: WaterAnimation | null = null
  private ambientParticles: AmbientParticles | null = null
  private postProcessing: PostProcessing | null = null

  // Hover interaction state
  private hoveredAgentId: string | null = null
  private hoverTooltip: Phaser.GameObjects.Container | null = null
  // Zoom tier for LOD visibility (0=far, 1=normal, 2=close)
  private currentZoomTier = 1

  // Character appearance (layered sprite) data
  private characterAppearances: CharacterAppearanceMap = {}
  private spriteCache = new SpriteCache()

  private agents: Agent[] = []
  private selectedAgentId: string | null = null
  private followingAgentId: string | null = null
  private hasCentered = false

  // WASD + arrow key camera controls
  private keys!: {
    W: Phaser.Input.Keyboard.Key
    A: Phaser.Input.Keyboard.Key
    S: Phaser.Input.Keyboard.Key
    D: Phaser.Input.Keyboard.Key
    UP: Phaser.Input.Keyboard.Key
    DOWN: Phaser.Input.Keyboard.Key
    LEFT: Phaser.Input.Keyboard.Key
    RIGHT: Phaser.Input.Keyboard.Key
  }

  constructor() {
    super({ key: 'WorldScene' })
  }

  create(): void {
    this.cameras.main.setZoom(1.0)
    this.cameras.main.setRoundPixels(true)
    this.cameras.main.setBackgroundColor('#1a2e1a')

    // Create isometric Phaser Tilemap for ground layer
    const mapData = new Phaser.Tilemaps.MapData({
      name: 'iso-world',
      width: this.tmSize,
      height: this.tmSize,
      tileWidth: ISO_TILE_WIDTH,
      tileHeight: ISO_TILE_HEIGHT,
      orientation: Phaser.Tilemaps.Orientation.ISOMETRIC,
      format: Phaser.Tilemaps.Formats.ARRAY_2D,
    })
    this.tilemap = new Phaser.Tilemaps.Tilemap(this, mapData)
    const tileset = this.tilemap.addTilesetImage('iso-terrain', 'iso-terrain-sheet', ISO_TILE_WIDTH, ISO_TILE_HEIGHT, 0, 0, 0)!
    // Position layer so tile (0,0) of tilemap maps to world tile tmOrigin
    const layerX = (this.tmOriginX - this.tmOriginY) * (ISO_TILE_WIDTH / 2)
    const layerY = (this.tmOriginX + this.tmOriginY) * (ISO_TILE_HEIGHT / 2)
    this.groundLayer = this.tilemap.createBlankLayer(
      'ground', tileset,
      layerX, layerY,
    )!
    this.groundLayer.setDepth(-1)

    // Day-night cycle (tint overlay, stars, building lights, agent torches)
    this.dayNightCycle = new DayNightCycle(this)

    // Weather visual effects layer
    this.weatherEffects = new WeatherEffects(this)

    // Interaction visual effects (conversation lines, combat zones, emotions, dust, paths)
    this.interactionEffects = new InteractionEffects(this)

    // World event visual effects (type-specific markers, zones, particles)
    this.eventVisuals = new EventVisuals(this)

    // Atmosphere effects
    this.shadowSystem = new ShadowSystem(this)
    this.waterAnimation = new WaterAnimation(this)
    this.ambientParticles = new AmbientParticles(this)
    this.postProcessing = new PostProcessing(this)

    // Initialize audio on first user interaction (Web Audio requirement)
    this.input.once('pointerdown', () => {
      soundManager.init()
    })

    // Scroll wheel zoom
    this.input.on('wheel', (
      _pointer: Phaser.Input.Pointer,
      _over: Phaser.GameObjects.GameObject[],
      _dx: number,
      dy: number,
    ) => {
      const cam = this.cameras.main
      const newZoom = cam.zoom - dy * 0.001
      cam.setZoom(Phaser.Math.Clamp(newZoom, 0.3, 2.5))
    })

    // WASD + arrow key camera controls
    this.keys = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      UP: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      DOWN: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      LEFT: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      RIGHT: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
    }

    // Drag to pan
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) {
        if (this.followingAgentId) {
          this.followingAgentId = null
          this.events.emit('follow:stopped')
        }
        const cam = this.cameras.main
        cam.scrollX -= (pointer.x - pointer.prevPosition.x) / cam.zoom
        cam.scrollY -= (pointer.y - pointer.prevPosition.y) / cam.zoom
      }
    })
  }

  update(_time: number, delta: number): void {
    // Camera follow mode
    if (this.followingAgentId) {
      const agent = this.agents.find(a => a.id === this.followingAgentId)
      if (agent) {
        const pos = worldToScreen(agent.position.x, agent.position.y)
        const cam = this.cameras.main
        const targetX = pos.x + ISO_TILE_WIDTH / 2 - cam.width / (2 * cam.zoom)
        const targetY = pos.y + ISO_TILE_HEIGHT / 2 - cam.height / (2 * cam.zoom)
        cam.scrollX += (targetX - cam.scrollX) * 0.08
        cam.scrollY += (targetY - cam.scrollY) * 0.08
      } else {
        this.followingAgentId = null
      }
    }

    // WASD / Arrow key camera movement
    if (!this.followingAgentId) {
      const cam = this.cameras.main
      const scrollSpeed = 400 / cam.zoom * (delta / 1000)
      let dx = 0
      let dy = 0

      if (this.keys.A.isDown || this.keys.LEFT.isDown) dx -= scrollSpeed
      if (this.keys.D.isDown || this.keys.RIGHT.isDown) dx += scrollSpeed
      if (this.keys.W.isDown || this.keys.UP.isDown) dy -= scrollSpeed
      if (this.keys.S.isDown || this.keys.DOWN.isDown) dy += scrollSpeed

      // Edge scrolling — move camera when mouse is within 20px of viewport edge
      const pointer = this.input.activePointer
      const edgeMargin = 20
      if (pointer.x < edgeMargin) dx -= scrollSpeed * 0.7
      if (pointer.x > cam.width - edgeMargin) dx += scrollSpeed * 0.7
      if (pointer.y < edgeMargin) dy -= scrollSpeed * 0.7
      if (pointer.y > cam.height - edgeMargin) dy += scrollSpeed * 0.7

      if (dx !== 0 || dy !== 0) {
        cam.scrollX += dx
        cam.scrollY += dy
      }
    }

    // Update hover tooltip position to follow agent
    if (this.hoverTooltip && this.hoveredAgentId) {
      const hoverContainer = this.agentSprites.get(this.hoveredAgentId)
      if (hoverContainer) {
        this.hoverTooltip.setPosition(hoverContainer.x, hoverContainer.y + 22)
      }
    }

    // Zoom-based LOD visibility
    this.updateZoomVisibility()

    this.updateVisibleChunks()

    // Update interaction effects (conversation lines, combat zones, emotions, dust, paths)
    this.interactionEffects?.update(this.agents, this.agentSprites, this.selectedAgentId)

    // Update world event ambient particles
    this.eventVisuals?.update()

    // Atmosphere effects updates
    if (this.shadowSystem) {
      if (this.dayNightCycle) {
        this.shadowSystem.setConfig(this.dayNightCycle.getShadowConfig())
      }
      this.shadowSystem.update()

      // Draw agent shadows
      for (const [, container] of this.agentSprites) {
        this.shadowSystem.drawAgentShadow(container.x, container.y, container.depth)
      }
    }

    if (this.waterAnimation) {
      const cam = this.cameras.main
      const updates = this.waterAnimation.update(this.groundLayer, cam)
      // Apply water tile shimmer to tilemap
      if (this.groundLayer && updates.length > 0) {
        for (const u of updates) {
          const tmX = u.tileX - this.tmOriginX
          const tmY = u.tileY - this.tmOriginY
          if (tmX >= 0 && tmX < this.tmSize && tmY >= 0 && tmY < this.tmSize) {
            this.groundLayer.putTileAt(u.index, tmX, tmY)
          }
        }
      }
    }

    this.ambientParticles?.update()
    this.postProcessing?.update()
  }

  // --- Chunk data management ---

  addChunks(chunks: Record<string, ChunkData>): void {
    for (const [key, chunk] of Object.entries(chunks)) {
      this.chunkDataStore.set(key, chunk)
    }

    // Center camera on first data load with cinematic intro
    if (!this.hasCentered && this.chunkDataStore.size > 0) {
      this.hasCentered = true
      const centerScreen = worldToScreen(0, 0)
      this.cameras.main.centerOn(centerScreen.x + ISO_TILE_WIDTH / 2, centerScreen.y + ISO_TILE_HEIGHT / 2)
      this.time.delayedCall(300, () => this.playCameraIntro())
    }
  }

  private playCameraIntro(): void {
    const cam = this.cameras.main

    // Find the most active area (cluster of agents)
    let targetX = 0, targetY = 0
    if (this.agents.length > 0) {
      let sumX = 0, sumY = 0
      for (const a of this.agents) {
        sumX += a.position.x
        sumY += a.position.y
      }
      targetX = sumX / this.agents.length
      targetY = sumY / this.agents.length
    }

    const targetScreen = worldToScreen(targetX, targetY)

    // Pan to active area + zoom in over 1.5s
    this.tweens.add({
      targets: cam,
      scrollX: targetScreen.x + ISO_TILE_WIDTH / 2 - cam.width / 2,
      scrollY: targetScreen.y + ISO_TILE_HEIGHT / 2 - cam.height / 2,
      zoom: 1.5,
      duration: 1500,
      ease: 'Cubic.easeInOut',
    })
  }

  /** Receive full character appearance map (on connect) */
  setCharacterAppearances(map: CharacterAppearanceMap): void {
    this.characterAppearances = map
    for (const [agentId, data] of Object.entries(map)) {
      if (this.spriteCache.needsRecompose(agentId, data.spriteHash)) {
        this.recomposeAgentSprite(agentId)
      }
    }
  }

  /** Update a single agent's appearance (live change) */
  updateCharacterAppearance(agentId: string, appearance: CharacterAppearance, race: Race, spriteHash: string): void {
    this.characterAppearances[agentId] = { appearance, race, spriteHash }
    this.recomposeAgentSprite(agentId)
  }

  updateAgents(agents: Agent[]): void {
    this.agents = agents

    for (const agent of agents) {
      const pos = worldToScreen(agent.position.x, agent.position.y)
      const screenX = pos.x + ISO_TILE_WIDTH / 2
      const screenY = pos.y + ISO_TILE_HEIGHT / 2 - 8

      if (!this.agentSprites.has(agent.id)) {
        this.createAgentSprite(agent, { x: screenX, y: screenY })
      } else {
        const container = this.agentSprites.get(agent.id)!
        this.tweens.add({
          targets: container,
          x: screenX,
          y: screenY,
          duration: 300,
          ease: 'Linear',
        })
      }

      this.updateActionIndicator(agent)
    }

    // Remove sprites for agents that no longer exist
    for (const [id, sprite] of this.agentSprites) {
      if (!agents.find(a => a.id === id)) {
        if (id === this.hoveredAgentId) this.handleAgentHoverEnd(id)
        sprite.destroy()
        this.agentSprites.delete(id)
        this.agentDirections.delete(id)
        this.agentMoving.delete(id)
        this.actionIndicators.get(id)?.destroy()
        this.actionIndicators.delete(id)
        this.agentEmotionIcons.get(id)?.destroy()
        this.agentEmotionIcons.delete(id)
        this.agentActionIcons.get(id)?.destroy()
        this.agentActionIcons.delete(id)
        this.spriteCache.remove(id)
      }
    }

    this.updateSelectionRing()

    // Center on first agent if we haven't centered yet
    if (!this.hasCentered && agents.length > 0) {
      this.hasCentered = true
      const pos = worldToScreen(agents[0].position.x, agents[0].position.y)
      this.cameras.main.centerOn(pos.x + ISO_TILE_WIDTH / 2, pos.y + ISO_TILE_HEIGHT / 2)
    }
  }

  updateClock(clock: WorldClock): void {
    this.dayNightCycle?.update(clock.timeOfDay, clock.dayProgress)
    soundManager.onTimeChange(clock.timeOfDay)

    // Update agent torch positions
    if (this.dayNightCycle && this.agents.length > 0) {
      const torchPositions = this.agents.map(a => {
        const pos = worldToScreen(a.position.x, a.position.y)
        return { screenX: pos.x + ISO_TILE_WIDTH / 2, screenY: pos.y + ISO_TILE_HEIGHT / 2 - 8 }
      })
      this.dayNightCycle.drawAgentTorches(torchPositions)
    }

    // Propagate time-of-day to atmosphere systems
    this.ambientParticles?.setTimeOfDay(clock.timeOfDay)
    this.postProcessing?.setTimeOfDay(clock.timeOfDay)
  }

  setWeather(weather: WeatherState): void {
    this.weatherEffects?.setWeather(weather)
    this.ambientParticles?.setWind(weather.windIntensity)
  }

  showSpeechBubble(agentId: string, message: string): void {
    const existing = this.speechBubbles.get(agentId)
    if (existing) {
      existing.container.destroy()
    }

    const agentContainer = this.agentSprites.get(agentId)
    if (!agentContainer) return

    const isPlan = message.startsWith('[Plan]')
    const displayMsg = isPlan ? message.slice(7).trim() : message
    const truncated = displayMsg.length > 30 ? displayMsg.slice(0, 30) + '...' : displayMsg

    const text = this.add.text(0, 0, truncated, {
      fontSize: '9px',
      fontFamily: 'Arial, sans-serif',
      color: isPlan ? '#ccffcc' : '#222222',
      wordWrap: { width: 120 },
    }).setOrigin(0.5, 0.5)

    const bounds = text.getBounds()
    const padX = 8
    const padY = 5
    const bg = this.add.graphics()
    if (isPlan) {
      bg.fillStyle(0x2d5016, 0.9)
    } else {
      bg.fillStyle(0xffffff, 0.95)
    }
    bg.fillRoundedRect(
      -bounds.width / 2 - padX, -bounds.height / 2 - padY,
      bounds.width + padX * 2, bounds.height + padY * 2,
      6,
    )
    bg.lineStyle(1, isPlan ? 0x4a8a2a : 0xcccccc, 0.6)
    bg.strokeRoundedRect(
      -bounds.width / 2 - padX, -bounds.height / 2 - padY,
      bounds.width + padX * 2, bounds.height + padY * 2,
      6,
    )

    // Tail pointer
    const pointer = this.add.graphics()
    pointer.fillStyle(isPlan ? 0x2d5016 : 0xffffff, 0.95)
    const tailY = bounds.height / 2 + padY
    pointer.fillTriangle(-4, tailY - 1, 4, tailY - 1, 0, tailY + 5)

    const bubbleContainer = this.add.container(0, -bounds.height / 2 - padY - 8, [bg, pointer, text])

    const container = this.add.container(agentContainer.x, agentContainer.y - 24, [bubbleContainer])
    container.setDepth(2000)
    container.setAlpha(0)

    this.tweens.add({
      targets: container,
      alpha: 1,
      duration: 200,
    })

    this.speechBubbles.set(agentId, {
      container,
      timer: this.time.now + 3000,
    })

    this.time.delayedCall(3000, () => {
      const bubble = this.speechBubbles.get(agentId)
      if (bubble) {
        this.tweens.add({
          targets: bubble.container,
          alpha: 0,
          duration: 300,
          onComplete: () => {
            bubble.container.destroy()
            this.speechBubbles.delete(agentId)
          },
        })
      }
    })
  }

  handleEvent(event: WorldEvent): void {
    switch (event.type) {
      case 'agent:spoke':
        this.showSpeechBubble(event.agentId, event.message)
        this.interactionEffects?.onSpoke(event.agentId, event.targetAgentId, event.message)
        break
      case 'agent:moved': {
        const container = this.agentSprites.get(event.agentId)
        if (container) {
          // Compute and store facing direction
          const dir = WorldScene.getMovementDirection(event.from, event.to)
          this.agentDirections.set(event.agentId, dir)

          // Start walk animation
          this.setAgentAnimation(event.agentId, true)

          const pos = worldToScreen(event.to.x, event.to.y)
          this.tweens.add({
            targets: container,
            x: pos.x + ISO_TILE_WIDTH / 2,
            y: pos.y + ISO_TILE_HEIGHT / 2 - 8,
            duration: 500,
            ease: 'Linear',
            onComplete: () => {
              // Switch to idle when movement tween finishes
              this.setAgentAnimation(event.agentId, false)
            },
          })
        }
        // Footstep SFX for selected agent only
        if (event.agentId === this.selectedAgentId) {
          const tile = this.getTileAt(event.to.x, event.to.y)
          if (tile) soundManager.playFootstep(tile.type)
        }
        // Movement dust particles
        this.interactionEffects?.onMoved(event.from)
        break
      }
      case 'resource:gathered': {
        const gatherPos = worldToScreen(event.position.x, event.position.y)
        this.showGatherEffect(gatherPos.x + ISO_TILE_WIDTH / 2, gatherPos.y + ISO_TILE_HEIGHT / 2, event.resourceType)
        soundManager.playGather(event.resourceType)
        break
      }
      case 'item:crafted': {
        const crafter = this.agents.find(a => a.id === event.agentId)
        if (crafter) {
          const pos = worldToScreen(crafter.position.x, crafter.position.y)
          this.showCraftEffect(pos.x + ISO_TILE_WIDTH / 2, pos.y + ISO_TILE_HEIGHT / 2 - 8, event.item.name)
        }
        break
      }
      case 'trade:completed': {
        const buyer = this.agents.find(a => a.id === event.buyerId)
        if (buyer) {
          const pos = worldToScreen(buyer.position.x, buyer.position.y)
          this.showTradeEffect(pos.x + ISO_TILE_WIDTH / 2, pos.y + ISO_TILE_HEIGHT / 2 - 8)
        }
        break
      }
      case 'agent:action': {
        const actor = this.agents.find(a => a.id === event.agentId)
        if (actor && event.action.type === 'rest') {
          const pos = worldToScreen(actor.position.x, actor.position.y)
          this.showRestEffect(pos.x + ISO_TILE_WIDTH / 2, pos.y + ISO_TILE_HEIGHT / 2 - 8)
        }
        break
      }
      case 'combat:started': {
        this.showCombatEffect(event.position.x, event.position.y)
        this.interactionEffects?.onCombatStarted(event.combatId, event.agentId, event.monsterId, event.position)
        break
      }
      case 'combat:ended': {
        this.interactionEffects?.onCombatEnded(event.combatId)
        break
      }
      case 'combat:round': {
        const fighter = this.agents.find(a => a.id === event.agentId)
        if (fighter) {
          this.showCombatEffect(fighter.position.x, fighter.position.y)
          if (event.round.agentDamage > 0) {
            this.showDamagePopup(fighter.position.x, fighter.position.y, event.round.agentDamage, true)
          }
          if (event.round.monsterDamage > 0) {
            this.showDamagePopup(fighter.position.x, fighter.position.y, event.round.monsterDamage, false)
          }
        }
        break
      }
    }
  }

  getSelectedAgentId(): string | null {
    return this.selectedAgentId
  }

  followAgent(agentId: string): void {
    this.followingAgentId = agentId
    this.selectedAgentId = agentId
    this.events.emit('agent:selected', agentId)
    this.updateSelectionRing()
  }

  unfollowAgent(): void {
    this.followingAgentId = null
  }

  isFollowing(): boolean {
    return this.followingAgentId !== null
  }

  // ── World event markers ──

  setWorldEvents(events: ActiveWorldEvent[]): void {
    // Delegate to EventVisuals system for type-specific rendering
    this.eventVisuals?.sync(events)
  }

  // --- Viewport-based chunk rendering ---

  private updateVisibleChunks(): void {
    const visibleKeys = this.getVisibleChunkKeys()

    // Render newly visible chunks
    for (const key of visibleKeys) {
      if (!this.renderedChunks.has(key) && this.chunkDataStore.has(key)) {
        this.renderChunk(key, this.chunkDataStore.get(key)!)
      }
    }

    // Remove chunks that are no longer visible
    for (const [key, rendered] of this.renderedChunks) {
      if (!visibleKeys.has(key)) {
        this.destroyRenderedChunk(rendered)
        this.renderedChunks.delete(key)
      }
    }

    // Update building lights for day-night cycle
    this.updateBuildingLights()
  }

  private updateBuildingLights(): void {
    if (!this.dayNightCycle) return

    const buildings: { key: string; screenX: number; screenY: number }[] = []
    for (const [chunkKey, chunk] of this.chunkDataStore) {
      if (!this.renderedChunks.has(chunkKey)) continue
      for (const row of chunk.tiles) {
        for (const tile of row) {
          if (tile.poiType) {
            const pos = worldToScreen(tile.position.x, tile.position.y)
            buildings.push({
              key: `${tile.position.x},${tile.position.y}`,
              screenX: pos.x + ISO_TILE_WIDTH / 2,
              screenY: pos.y + ISO_TILE_HEIGHT / 2,
            })
          }
        }
      }
    }

    this.dayNightCycle.setBuildingLights(buildings)
  }

  private getVisibleChunkKeys(): Set<string> {
    const cam = this.cameras.main
    const wv = cam.worldView

    // Convert all 4 camera viewport corners to tile coordinates.
    // In isometric projection, tile_x and tile_y extremes come from different corners:
    //   min tile_x → top-left,  max tile_x → bottom-right
    //   min tile_y → top-right, max tile_y → bottom-left
    const tl = screenToWorld(wv.left, wv.top)
    const tr = screenToWorld(wv.right, wv.top)
    const bl = screenToWorld(wv.left, wv.bottom)
    const br = screenToWorld(wv.right, wv.bottom)

    // Bounding box in tile space with margin
    const margin = CHUNK_SIZE * 2
    const minTX = Math.min(tl.x, tr.x, bl.x, br.x) - margin
    const maxTX = Math.max(tl.x, tr.x, bl.x, br.x) + margin
    const minTY = Math.min(tl.y, tr.y, bl.y, br.y) - margin
    const maxTY = Math.max(tl.y, tr.y, bl.y, br.y) + margin

    // Convert to chunk coords
    const minCX = Math.floor(minTX / CHUNK_SIZE)
    const maxCX = Math.floor(maxTX / CHUNK_SIZE)
    const minCY = Math.floor(minTY / CHUNK_SIZE)
    const maxCY = Math.floor(maxTY / CHUNK_SIZE)

    const keys = new Set<string>()
    for (let cy = minCY; cy <= maxCY; cy++) {
      for (let cx = minCX; cx <= maxCX; cx++) {
        keys.add(`${cx},${cy}`)
      }
    }
    return keys
  }

  /** Paint tiles from a chunk onto the ground RenderTexture and create object sprites */
  private renderChunk(key: string, chunk: ChunkData): void {
    const objectSprites: Phaser.GameObjects.GameObject[] = []

    // Place ground tiles into the Phaser Tilemap (if not already placed)
    if (!this.paintedChunks.has(key) && this.groundLayer) {
      this.paintChunkToTilemap(chunk)
      this.paintedChunks.add(key)
      // Repaint borders of already-painted adjacent chunks for correct autotiling
      this.repaintAdjacentBorders(chunk)
    }

    // Register water tiles for animation
    this.waterAnimation?.addChunkWater(chunk.tiles)

    // Collect biomes for ambient particles
    if (this.ambientParticles) {
      const biomeSet = new Set<string>()
      for (const row of chunk.tiles) {
        for (const tile of row) {
          if (tile.biome) biomeSet.add(tile.biome)
        }
      }
      this.ambientParticles.setBiomes([...biomeSet])
    }

    // Create object sprites (resources, decorations, buildings) on top
    for (let ly = 0; ly < chunk.tiles.length; ly++) {
      for (let lx = 0; lx < chunk.tiles[ly].length; lx++) {
        const tile = chunk.tiles[ly][lx]
        const pos = worldToScreen(tile.position.x, tile.position.y)
        const centerX = pos.x + ISO_TILE_WIDTH / 2
        const centerY = pos.y + ISO_TILE_HEIGHT / 2

        // Coordinate-based hash for tile diversity
        const hash = ((tile.position.x * 73856093) ^ (tile.position.y * 19349663)) >>> 0

        // POI building overlay
        if (tile.poiType) {
          const bldgKey = resolveBuildingTexture(tile.poiType, this.textures)
          // Center building on diamond, anchor at bottom-center
          const bldgSprite = this.add.image(centerX, centerY + ISO_TILE_HEIGHT / 2, bldgKey)
            .setOrigin(0.5, 1.0)
            .setScale(BUILDING_SCALE)
            .setDepth(isoDepth(tile.position.x, tile.position.y) + 0.3)
          objectSprites.push(bldgSprite)

          // Tavern warm light flicker
          if (tile.poiType === 'tavern') {
            this.tweens.add({
              targets: bldgSprite,
              alpha: { from: 1.0, to: 0.88 },
              duration: 400 + Math.random() * 300,
              yoyo: true,
              repeat: -1,
              ease: 'Sine.easeInOut',
            })
          }
        }

        // Decoration overlay
        if (tile.decoration && this.textures.exists(tile.decoration)) {
          const jitterX = ((hash % 5) - 2)
          const jitterY = (((hash >> 8) % 5) - 2)

          const deco = this.add.image(centerX + jitterX, centerY - 4 + jitterY, tile.decoration)
            .setOrigin(0.5, 0.5)
            .setScale(0.5)
            .setDepth(isoDepth(tile.position.x, tile.position.y) + 0.05)
            .setFlipX((hash % 3) === 0)
          objectSprites.push(deco)
        }

        // Resource overlay with biome-aware sprites
        if (tile.resource && tile.resource.amount >= 1) {
          const biome = tile.biome ?? ''
          const resKey = resolveResourceTexture(tile.resource.type, biome, this.textures)
          const isNewAsset = resKey.startsWith('res_')
          const isIndicator = resKey === 'resource_indicator'
          const scale = isIndicator ? 0.5 : isNewAsset ? RESOURCE_SCALE * 1.2 : RESOURCE_SCALE

          const jitterX = ((hash % 5) - 2)
          const jitterY = (((hash >> 8) % 5) - 2)

          const resSprite = this.add.image(
            centerX + jitterX,
            centerY - 4 + jitterY,
            resKey,
          )
            .setOrigin(0.5, 0.5)
            .setScale(scale)
            .setDepth(isoDepth(tile.position.x, tile.position.y) + 0.1)
            .setAlpha(0.85)
            .setFlipX((hash % 3) === 0)
          objectSprites.push(resSprite)

          // Vegetation sway for trees/bushes, bob for ores/minerals
          const isVegetation = ['wood', 'food', 'herb'].includes(tile.resource.type)
          if (isVegetation) {
            this.tweens.add({
              targets: resSprite,
              x: resSprite.x + 1,
              y: resSprite.y - 1.5,
              duration: 2200 + Math.random() * 800,
              yoyo: true,
              repeat: -1,
              ease: 'Sine.easeInOut',
              delay: Math.random() * 1500,
            })
          } else {
            this.tweens.add({
              targets: resSprite,
              y: resSprite.y - 2,
              duration: 1500 + Math.random() * 500,
              yoyo: true,
              repeat: -1,
              ease: 'Sine.easeInOut',
            })
          }
        }
      }
    }

    this.renderedChunks.set(key, { objectSprites })
  }

  /** Place a chunk's ground tiles into the Phaser Tilemap layer (autotile-aware) */
  private paintChunkToTilemap(chunk: ChunkData): void {
    if (!this.groundLayer) return

    // Bind getTileAt for cross-chunk neighbor lookups
    const tileGetter = (x: number, y: number) => this.getTileAt(x, y)

    for (let ly = 0; ly < chunk.tiles.length; ly++) {
      for (let lx = 0; lx < chunk.tiles[ly].length; lx++) {
        const tile = chunk.tiles[ly][lx]
        const localX = tile.position.x - this.tmOriginX
        const localY = tile.position.y - this.tmOriginY

        // Skip tiles outside the tilemap bounds
        if (localX < 0 || localY < 0 || localX >= this.tmSize || localY >= this.tmSize) continue

        const tileIndex = getAutoTileIndex(tile, tileGetter)
        this.groundLayer.putTileAt(tileIndex, localX, localY)
      }
    }
  }

  /**
   * Repaint border tiles of adjacent chunks that may need autotile updates
   * when a new chunk is loaded (their edge tiles now have new neighbors).
   */
  private repaintAdjacentBorders(chunk: ChunkData): void {
    if (!this.groundLayer) return

    const tileGetter = (x: number, y: number) => this.getTileAt(x, y)
    const cx = chunk.cx
    const cy = chunk.cy

    // For each adjacent chunk that's already painted, repaint its border row/col
    const adjacents: [number, number, 'row' | 'col', number][] = [
      [cx, cy - 1, 'row', CHUNK_SIZE - 1], // chunk above → repaint its bottom row
      [cx, cy + 1, 'row', 0],              // chunk below → repaint its top row
      [cx - 1, cy, 'col', CHUNK_SIZE - 1], // chunk left → repaint its right col
      [cx + 1, cy, 'col', 0],              // chunk right → repaint its left col
    ]

    for (const [acx, acy, axis, localIdx] of adjacents) {
      const key = `${acx},${acy}`
      if (!this.paintedChunks.has(key)) continue
      const adjChunk = this.chunkDataStore.get(key)
      if (!adjChunk) continue

      if (axis === 'row') {
        // Repaint one row of the adjacent chunk
        const row = adjChunk.tiles[localIdx]
        if (!row) continue
        for (let i = 0; i < row.length; i++) {
          const tile = row[i]
          const lx = tile.position.x - this.tmOriginX
          const ly = tile.position.y - this.tmOriginY
          if (lx < 0 || ly < 0 || lx >= this.tmSize || ly >= this.tmSize) continue
          this.groundLayer.putTileAt(getAutoTileIndex(tile, tileGetter), lx, ly)
        }
      } else {
        // Repaint one column of the adjacent chunk
        for (let r = 0; r < adjChunk.tiles.length; r++) {
          const tile = adjChunk.tiles[r]?.[localIdx]
          if (!tile) continue
          const lx = tile.position.x - this.tmOriginX
          const ly = tile.position.y - this.tmOriginY
          if (lx < 0 || ly < 0 || lx >= this.tmSize || ly >= this.tmSize) continue
          this.groundLayer.putTileAt(getAutoTileIndex(tile, tileGetter), lx, ly)
        }
      }
    }
  }

  private destroyRenderedChunk(rendered: RenderedChunk): void {
    for (const s of rendered.objectSprites) s.destroy()
  }

  // --- Agent rendering ---

  /** Map NpcRole to spritesheet key suffix */
  private static NPC_ROLE_TO_KEY: Record<string, string> = {
    merchant: 'merchant',
    innkeeper: 'innkeeper',
    guild_master: 'guildmaster',
    guard: 'guard',
    wanderer: 'wanderer',
  }

  /** Determine which spritesheet key to use for an agent */
  private resolveAgentSpriteKey(agent: Agent): string | null {
    // NPC → use NPC spritesheet
    if (agent.isNpc && agent.npcRole) {
      const suffix = WorldScene.NPC_ROLE_TO_KEY[agent.npcRole] ?? 'wanderer'
      const key = `char_npc_${suffix}`
      if (this.textures.exists(key)) return key
    }

    // Check race from character appearances
    const charData = this.characterAppearances[agent.id]
    if (charData) {
      const key = `char_${charData.race}`
      if (this.textures.exists(key)) return key
    }

    // Fallback to human
    if (this.textures.exists('char_human')) return 'char_human'
    return null
  }

  /** Compute facing direction from movement vector */
  private static getMovementDirection(from: { x: number; y: number }, to: { x: number; y: number }): string {
    const dx = to.x - from.x
    const dy = to.y - from.y
    if (dx === 0 && dy === 0) return 'down'
    if (Math.abs(dy) >= Math.abs(dx)) {
      return dy > 0 ? 'down' : 'up'
    }
    return dx > 0 ? 'right' : 'left'
  }

  /** Play walk or idle animation on an agent's sprite */
  private setAgentAnimation(agentId: string, walking: boolean): void {
    const container = this.agentSprites.get(agentId)
    if (!container || !container.list || container.list.length < 2) return

    const visual = container.list[1]
    if (!(visual instanceof Phaser.GameObjects.Sprite)) return

    const dir = this.agentDirections.get(agentId) ?? 'down'
    const sheetKey = (visual as Phaser.GameObjects.Sprite).texture.key
    const animKey = walking ? `${sheetKey}_walk_${dir}` : `${sheetKey}_idle_${dir}`

    if (this.anims.exists(animKey) && visual.anims.currentAnim?.key !== animKey) {
      visual.play(animKey)
    }
    this.agentMoving.set(agentId, walking)
  }

  private createAgentSprite(agent: Agent, screenPos: { x: number; y: number }): void {
    const shadow = this.add.image(0, 6, 'agent_shadow')
      .setScale(0.7)
      .setAlpha(0.3)

    // Default direction
    this.agentDirections.set(agent.id, 'down')
    this.agentMoving.set(agent.id, false)

    let spriteOrGroup: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image | Phaser.GameObjects.Container

    // Try animated spritesheet first
    const sheetKey = this.resolveAgentSpriteKey(agent)
    if (sheetKey) {
      const sprite = this.add.sprite(0, 0, sheetKey, 1) // frame 1 = stand facing down
        .setOrigin(0.5, 0.8)
        .setScale(AGENT_SCALE)
      spriteOrGroup = sprite

      // Start idle animation facing down
      const idleAnim = `${sheetKey}_idle_down`
      if (this.anims.exists(idleAnim)) {
        sprite.play(idleAnim)
      }
    } else {
      // Fallback: layered composition or legacy sprite
      const charData = this.characterAppearances[agent.id]
      if (charData) {
        const { bodyGroup, auraEmitter } = composeCharacterSprite(this, charData.appearance, charData.race)
        bodyGroup.setScale(AGENT_SCALE)
        this.spriteCache.set(agent.id, charData.spriteHash, { bodyGroup, auraEmitter })
        spriteOrGroup = bodyGroup

        this.tweens.add({
          targets: bodyGroup,
          scaleY: AGENT_SCALE * 1.015,
          duration: 1200 + Math.random() * 400,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
      } else {
        const index = this.agents.indexOf(agent)
        const textureKey = `agent_${index >= 0 && index < 5 ? index : 'default'}`
        const sprite = this.add.image(0, 0, textureKey)
          .setOrigin(0.5, 0.7)
          .setScale(AGENT_SCALE)
        spriteOrGroup = sprite

        this.tweens.add({
          targets: sprite,
          scaleY: AGENT_SCALE * 1.015,
          duration: 1200 + Math.random() * 400,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
      }
    }

    const isNpc = agent.isNpc === true
    const displayName = isNpc ? `[NPC] ${agent.name}` : agent.name
    const nameColor = isNpc ? '#FFD700' : '#ffffff'

    const nameText = this.add.text(0, -22, displayName, {
      fontSize: '10px',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold',
      color: nameColor,
      stroke: '#000000',
      strokeThickness: 2,
      backgroundColor: '#00000099',
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5, 1)

    // Level badge (small circle to the right of name)
    const badgeX = nameText.width / 2 + 8
    const badgeY = -26
    const lvlBadge = this.add.graphics()
    lvlBadge.fillStyle(isNpc ? 0xFFD700 : 0x4488FF, 0.85)
    lvlBadge.fillCircle(badgeX, badgeY, 7)
    lvlBadge.lineStyle(1, 0x000000, 0.5)
    lvlBadge.strokeCircle(badgeX, badgeY, 7)

    const lvlText = this.add.text(badgeX, badgeY, `${agent.level}`, {
      fontSize: '7px',
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 1,
    }).setOrigin(0.5, 0.5)

    const actionText = this.add.text(0, 10, '', {
      fontSize: '8px',
      fontFamily: 'Arial, sans-serif',
      color: '#aabbcc',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 0)

    // Emotion icon (top-left of agent, initially hidden)
    const emotionIcon = this.add.image(-8, -28, 'emotion_happy')
      .setOrigin(0.5, 0.5)
      .setScale(0.5)
      .setAlpha(0)
      .setDepth(1)
    this.agentEmotionIcons.set(agent.id, emotionIcon)

    // Action icon (top-right of agent, initially hidden)
    const actionIcon = this.add.image(8, -28, 'act_walking')
      .setOrigin(0.5, 0.5)
      .setScale(0.5)
      .setAlpha(0)
      .setDepth(1)
    this.agentActionIcons.set(agent.id, actionIcon)

    const container = this.add.container(
      screenPos.x,
      screenPos.y,
      [shadow, spriteOrGroup, nameText, actionText, emotionIcon, actionIcon, lvlBadge, lvlText],
    )
    container.setDepth(500 + isoDepth(agent.position.x, agent.position.y))
    container.setSize(30, 40)
    container.setInteractive()

    container.on('pointerover', () => {
      this.handleAgentHover(agent.id)
    })

    container.on('pointerout', () => {
      this.handleAgentHoverEnd(agent.id)
    })

    container.on('pointerdown', () => {
      this.selectedAgentId = agent.id
      this.events.emit('agent:selected', agent.id)
      this.updateSelectionRing()

      this.tweens.add({
        targets: spriteOrGroup,
        scaleX: AGENT_SCALE * 1.15,
        scaleY: AGENT_SCALE * 1.15,
        duration: 100,
        yoyo: true,
      })

      // Smooth camera pan if agent is off-center
      this.panCameraToAgent(agent.id)
    })

    this.agentSprites.set(agent.id, container)
  }

  /** Recompose an agent's visual at runtime (called when appearance changes) */
  private recomposeAgentSprite(agentId: string): void {
    const container = this.agentSprites.get(agentId)
    if (!container || !container.list || container.list.length < 2) return

    const charData = this.characterAppearances[agentId]
    if (!charData) return

    const oldVisual = container.list[1] as Phaser.GameObjects.GameObject
    if (oldVisual) oldVisual.destroy()
    this.spriteCache.remove(agentId)

    // Try spritesheet first
    const sheetKey = `char_${charData.race}`
    if (this.textures.exists(sheetKey)) {
      const dir = this.agentDirections.get(agentId) ?? 'down'
      const sprite = this.add.sprite(0, 0, sheetKey, 1)
        .setOrigin(0.5, 0.8)
        .setScale(AGENT_SCALE)
      container.addAt(sprite, 1)

      const idleAnim = `${sheetKey}_idle_${dir}`
      if (this.anims.exists(idleAnim)) {
        sprite.play(idleAnim)
      }
    } else {
      // Fallback to layered composition
      const { bodyGroup, auraEmitter } = composeCharacterSprite(this, charData.appearance, charData.race)
      bodyGroup.setScale(AGENT_SCALE)
      this.spriteCache.set(agentId, charData.spriteHash, { bodyGroup, auraEmitter })
      container.addAt(bodyGroup, 1)

      this.tweens.add({
        targets: bodyGroup,
        scaleY: AGENT_SCALE * 1.015,
        duration: 1200 + Math.random() * 400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }
  }

  private updateActionIndicator(agent: Agent): void {
    const container = this.agentSprites.get(agent.id)
    if (!container || !container.list) return

    // Update action text (keep as small subtitle)
    const actionText = container.list[3] as Phaser.GameObjects.Text | undefined
    const actionType = agent.currentAction?.type ?? 'idle'

    if (actionText && 'setText' in actionText) {
      const display = actionType === 'idle' ? '' : actionType
      actionText.setText(display)
    }

    // Update action icon
    const actionIcon = this.agentActionIcons.get(agent.id)
    if (actionIcon) {
      const actionToTexture: Record<string, string> = {
        gather: 'act_gathering',
        mine: 'act_gathering',
        chop: 'act_gathering',
        attack: 'act_fighting',
        flee: 'act_fighting',
        craft: 'act_crafting',
        eat: 'act_eating',
        rest: 'act_resting',
        trade: 'act_trading',
        move: 'act_walking',
        explore: 'act_exploring',
        quest: 'act_exploring',
      }

      const textureKey = actionToTexture[actionType]
      if (textureKey && this.textures.exists(textureKey)) {
        actionIcon.setTexture(textureKey)
        actionIcon.setAlpha(0.85)

        // Small bounce when action changes
        if (actionIcon.alpha === 0) {
          this.tweens.add({
            targets: actionIcon,
            scaleY: { from: 0.3, to: 0.5 },
            scaleX: { from: 0.3, to: 0.5 },
            duration: 200,
            ease: 'Back.easeOut',
          })
        }
      } else {
        actionIcon.setAlpha(0)
      }
    }

    // Update emotion icon based on current mood
    this.updateEmotionIcon(agent.id, agent.currentMood)
  }

  /** Update emotion icon based on agent's dominant emotion */
  private updateEmotionIcon(agentId: string, mood: EmotionState): void {
    const icon = this.agentEmotionIcons.get(agentId)
    if (!icon) return

    // Find the dominant emotion (highest intensity)
    const emotions = Object.entries(mood) as [string, number][]
    const dominant = emotions.reduce((max, [name, value]) =>
      value > max.value ? { name, value } : max,
      { name: 'joy', value: 0 }
    )

    // Only show if emotion intensity is significant (> 0.3)
    if (dominant.value < 0.3) {
      icon.setAlpha(0)
      return
    }

    // Map mood to emotion texture
    const moodToTexture: Record<string, string> = {
      joy: 'emotion_happy',
      trust: 'emotion_happy',
      fear: 'emotion_scared',
      surprise: 'emotion_surprised',
      sadness: 'emotion_sad',
      disgust: 'emotion_angry',
      anger: 'emotion_angry',
      anticipation: 'emotion_thinking',
    }

    const textureKey = moodToTexture[dominant.name] || 'emotion_thinking'
    if (this.textures.exists(textureKey)) {
      const wasHidden = icon.alpha === 0
      icon.setTexture(textureKey)
      icon.setAlpha(0.9)

      // Small pop-in animation when emotion first appears
      if (wasHidden) {
        this.tweens.add({
          targets: icon,
          scaleY: { from: 0.3, to: 0.5 },
          scaleX: { from: 0.3, to: 0.5 },
          duration: 200,
          ease: 'Back.easeOut',
        })
      }

      // Fade out after 5 seconds
      this.time.delayedCall(5000, () => {
        if (icon.active) {
          this.tweens.add({
            targets: icon,
            alpha: 0,
            duration: 500,
          })
        }
      })
    }
  }

  private updateSelectionRing(): void {
    if (this.selectionRing) {
      this.selectionRing.destroy()
      this.selectionRing = null
    }

    if (!this.selectedAgentId) return
    const container = this.agentSprites.get(this.selectedAgentId)
    if (!container) return

    this.selectionRing = this.add.image(container.x, container.y + 6, 'selection_ring')
      .setDepth(container.depth - 0.1)
      .setScale(0.8)

    this.tweens.add({
      targets: this.selectionRing,
      alpha: { from: 1, to: 0.4 },
      scale: { from: 0.8, to: 0.95 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  // ── Hover interaction ──

  private handleAgentHover(agentId: string): void {
    if (this.hoveredAgentId === agentId) return
    if (this.hoveredAgentId) this.handleAgentHoverEnd(this.hoveredAgentId)

    this.hoveredAgentId = agentId
    this.input.setDefaultCursor('pointer')

    const container = this.agentSprites.get(agentId)
    if (!container) return

    // Glow effect on visual sprite (Sprite/Image with preFX support)
    const visual = container.list[1]
    if (visual && 'preFX' in visual && (visual as Phaser.GameObjects.Sprite).preFX) {
      try {
        const fx = (visual as Phaser.GameObjects.Sprite).preFX!.addGlow(0xffd700, 4, 0, false, 0.1, 16)
        container.setData('_hoverFx', fx)
      } catch { /* Canvas renderer fallback - no preFX */ }
    }

    // Expand name label (make more prominent on hover)
    const nameText = container.list[2] as Phaser.GameObjects.Text
    if (nameText?.setFontSize) {
      container.setData('_origFontSize', nameText.style.fontSize)
      nameText.setFontSize('12px')
      nameText.setBackgroundColor('#000000cc')
    }

    // Show action tooltip below agent
    const agent = this.agents.find(a => a.id === agentId)
    if (agent) {
      this.showHoverTooltip(agent, container)
    }
  }

  private handleAgentHoverEnd(agentId: string): void {
    if (this.hoveredAgentId !== agentId) return
    this.hoveredAgentId = null
    this.input.setDefaultCursor('default')

    const container = this.agentSprites.get(agentId)
    if (!container) return

    // Remove glow
    const fx = container.getData('_hoverFx')
    if (fx) {
      const visual = container.list[1]
      if (visual && 'preFX' in visual && (visual as Phaser.GameObjects.Sprite).preFX) {
        try { (visual as Phaser.GameObjects.Sprite).preFX!.remove(fx) } catch { /* noop */ }
      }
      container.setData('_hoverFx', null)
    }

    // Reset name label
    const nameText = container.list[2] as Phaser.GameObjects.Text
    if (nameText?.setFontSize) {
      nameText.setFontSize(container.getData('_origFontSize') || '10px')
      nameText.setBackgroundColor('#00000099')
    }

    this.hideHoverTooltip()
  }

  private static HOVER_ACTION_LABELS: Record<string, string> = {
    gather: '\u26CF\uFE0F Gathering...',
    mine: '\u26CF\uFE0F Mining...',
    chop: '\uD83E\uDE93 Chopping...',
    craft: '\uD83D\uDD28 Crafting...',
    trade: '\uD83E\uDD1D Trading...',
    rest: '\uD83D\uDCA4 Resting...',
    eat: '\uD83C\uDF7D\uFE0F Eating...',
    move: '\uD83D\uDEB6 Walking...',
    explore: '\uD83E\uDDED Exploring...',
    quest: '\u2757 On a quest...',
    attack: '\u2694\uFE0F Fighting!',
    flee: '\uD83C\uDFC3 Fleeing!',
    speak: '\uD83D\uDCAC Talking...',
    talk: '\uD83D\uDCAC Talking...',
  }

  private showHoverTooltip(agent: Agent, container: Phaser.GameObjects.Container): void {
    this.hideHoverTooltip()

    const actionType = agent.currentAction?.type ?? 'idle'
    if (actionType === 'idle') return

    const label = WorldScene.HOVER_ACTION_LABELS[actionType] ?? actionType

    const text = this.add.text(0, 0, label, {
      fontSize: '10px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
    }).setOrigin(0.5, 0.5)

    const bounds = text.getBounds()
    const bg = this.add.graphics()
    bg.fillStyle(0x000000, 0.75)
    bg.fillRoundedRect(
      -bounds.width / 2 - 6, -bounds.height / 2 - 3,
      bounds.width + 12, bounds.height + 6,
      4,
    )

    this.hoverTooltip = this.add.container(
      container.x,
      container.y + 22,
      [bg, text],
    )
    this.hoverTooltip.setDepth(3000)
    this.hoverTooltip.setAlpha(0)

    this.tweens.add({
      targets: this.hoverTooltip,
      alpha: 1,
      duration: 150,
    })
  }

  private hideHoverTooltip(): void {
    if (this.hoverTooltip) {
      this.hoverTooltip.destroy()
      this.hoverTooltip = null
    }
  }

  /** Smoothly pan camera to an agent if it's not near the center of the viewport */
  private panCameraToAgent(agentId: string): void {
    const container = this.agentSprites.get(agentId)
    if (!container) return

    const cam = this.cameras.main
    const wv = cam.worldView
    const marginX = wv.width * 0.3
    const marginY = wv.height * 0.3

    const inCenter = container.x > wv.left + marginX
      && container.x < wv.right - marginX
      && container.y > wv.top + marginY
      && container.y < wv.bottom - marginY

    if (!inCenter) {
      const targetX = container.x - cam.width / (2 * cam.zoom)
      const targetY = container.y - cam.height / (2 * cam.zoom)

      this.tweens.add({
        targets: cam,
        scrollX: targetX,
        scrollY: targetY,
        duration: 400,
        ease: 'Cubic.easeOut',
      })
    }
  }

  // ── Zoom-based LOD ──

  private updateZoomVisibility(): void {
    const zoom = this.cameras.main.zoom
    const newTier = zoom < 0.8 ? 0 : zoom < 1.5 ? 1 : 2

    if (newTier === this.currentZoomTier) return
    this.currentZoomTier = newTier

    const showLabels = newTier >= 1
    const showIcons = newTier >= 1

    for (const [agentId, container] of this.agentSprites) {
      if (!container.list || container.list.length < 6) continue

      // Index 2: nameText, 3: actionText, 4: emotionIcon, 5: actionIcon, 6: lvlBadge, 7: lvlText
      const nameText = container.list[2] as Phaser.GameObjects.Text
      const actionText = container.list[3] as Phaser.GameObjects.Text
      const emotionIcon = container.list[4] as Phaser.GameObjects.Image
      const actionIcon = container.list[5] as Phaser.GameObjects.Image
      const lvlBadge = container.list[6] as Phaser.GameObjects.Graphics | undefined
      const lvlTextObj = container.list[7] as Phaser.GameObjects.Text | undefined

      nameText.setVisible(showLabels)
      actionText.setVisible(showLabels)
      emotionIcon.setVisible(showIcons)
      actionIcon.setVisible(showIcons)
      lvlBadge?.setVisible(showLabels)
      lvlTextObj?.setVisible(showLabels)

      // At far zoom, reduce agent sprite to a small dot
      const visual = container.list[1] as Phaser.GameObjects.Sprite | Phaser.GameObjects.Image | Phaser.GameObjects.Container
      if (newTier === 0) {
        visual.setVisible(false)
        // Show a colored dot instead
        let dot = container.getData('_zoomDot') as Phaser.GameObjects.Arc | null
        if (!dot) {
          const agent = this.agents.find(a => a.id === agentId)
          const dotColor = agent?.isNpc ? 0xFFD700 : 0xffffff
          dot = this.add.circle(0, 0, 3, dotColor, 0.9)
          container.add(dot)
          container.setData('_zoomDot', dot)
        }
        dot.setVisible(true)
      } else {
        visual.setVisible(true)
        const dot = container.getData('_zoomDot') as Phaser.GameObjects.Arc | null
        if (dot) dot.setVisible(false)
      }
    }

    // Also apply to speech bubbles
    for (const [, bubble] of this.speechBubbles) {
      bubble.container.setVisible(newTier >= 1)
    }
  }

  /** Get the name of the agent currently being followed (for React UI) */
  getFollowingAgentName(): string | null {
    if (!this.followingAgentId) return null
    const agent = this.agents.find(a => a.id === this.followingAgentId)
    return agent?.name ?? null
  }

  private showGatherEffect(x: number, y: number, resourceType?: string): void {
    const flash = this.add.circle(x, y, 14, 0xFFFFAA, 0.5)
      .setDepth(3000)
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 2.5,
      duration: 400,
      onComplete: () => flash.destroy(),
    })

    const texKey = resourceType && this.textures.exists(`resource_${resourceType}`)
      ? `resource_${resourceType}`
      : 'resource_indicator'
    const iconScale = texKey === 'resource_indicator' ? 0.5 : RESOURCE_SCALE * 0.8

    for (let i = 0; i < 3; i++) {
      const sparkle = this.add.image(
        x + Phaser.Math.Between(-10, 10),
        y + Phaser.Math.Between(-12, 0),
        texKey,
      ).setDepth(3000).setScale(iconScale).setAlpha(1)

      this.tweens.add({
        targets: sparkle,
        y: sparkle.y - 18,
        alpha: 0,
        scale: 0,
        duration: 700 + i * 120,
        ease: 'Quad.easeOut',
        onComplete: () => sparkle.destroy(),
      })
    }
  }

  private showCraftEffect(x: number, y: number, itemName: string): void {
    for (let i = 0; i < 5; i++) {
      const angle = (Math.PI * 2 * i) / 5
      const spark = this.add.rectangle(
        x + Math.cos(angle) * 4, y + Math.sin(angle) * 4,
        3, 3, 0xF1C40F, 1,
      ).setDepth(3000)

      this.tweens.add({
        targets: spark,
        x: spark.x + Math.cos(angle) * 20,
        y: spark.y + Math.sin(angle) * 20 - 10,
        alpha: 0,
        scale: 0.2,
        duration: 500 + i * 60,
        onComplete: () => spark.destroy(),
      })
    }

    const label = this.add.text(x, y - 20, `+ ${itemName}`, {
      fontSize: '11px',
      fontFamily: 'Arial, sans-serif',
      color: '#f1c40f',
      stroke: '#000000',
      strokeThickness: 3,
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(3000)

    this.tweens.add({
      targets: label,
      y: label.y - 25,
      alpha: 0,
      duration: 1200,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy(),
    })
  }

  private showTradeEffect(x: number, y: number): void {
    // 🤝 handshake icon with pop-in
    const handshake = this.add.text(x, y - 10, '\u{1F91D}', {
      fontSize: '18px',
    }).setOrigin(0.5).setDepth(3001).setScale(0.3).setAlpha(0)

    this.tweens.add({
      targets: handshake,
      alpha: 1,
      scale: 1,
      duration: 300,
      ease: 'Back.easeOut',
    })
    this.tweens.add({
      targets: handshake,
      y: handshake.y - 20,
      alpha: 0,
      duration: 1000,
      delay: 400,
      ease: 'Quad.easeOut',
      onComplete: () => handshake.destroy(),
    })

    // Gold coin sparkles
    for (let i = 0; i < 4; i++) {
      const coin = this.add.circle(
        x + Phaser.Math.Between(-8, 8),
        y + Phaser.Math.Between(-5, 5),
        3, 0xF1C40F, 1,
      ).setDepth(3000)

      this.tweens.add({
        targets: coin,
        y: coin.y - 20 - i * 5,
        x: coin.x + Phaser.Math.Between(-15, 15),
        alpha: 0,
        duration: 600 + i * 100,
        ease: 'Quad.easeOut',
        onComplete: () => coin.destroy(),
      })
    }

    // ✅ success check with delay
    const check = this.add.text(x, y - 30, '\u2705', {
      fontSize: '14px',
    }).setOrigin(0.5).setDepth(3001).setAlpha(0).setScale(0.5)

    this.tweens.add({
      targets: check,
      alpha: 1,
      scale: 1,
      duration: 250,
      delay: 300,
      ease: 'Back.easeOut',
    })
    this.tweens.add({
      targets: check,
      y: check.y - 15,
      alpha: 0,
      duration: 800,
      delay: 700,
      ease: 'Quad.easeOut',
      onComplete: () => check.destroy(),
    })
  }

  private showRestEffect(x: number, y: number): void {
    const letters = ['z', 'Z', 'z']
    for (let i = 0; i < 3; i++) {
      this.time.delayedCall(i * 400, () => {
        const zzz = this.add.text(
          x + 8 + i * 4, y - 10,
          letters[i],
          {
            fontSize: `${10 + i * 2}px`,
            fontFamily: 'Arial, sans-serif',
            color: '#9b9ecf',
            stroke: '#000000',
            strokeThickness: 2,
          },
        ).setOrigin(0.5).setDepth(3000).setAlpha(0)

        this.tweens.add({
          targets: zzz,
          y: zzz.y - 25 - i * 8,
          x: zzz.x + 5,
          alpha: { from: 0, to: 0.8 },
          duration: 500,
          yoyo: true,
          hold: 300,
          onComplete: () => zzz.destroy(),
        })
      })
    }
  }

  showLevelUpEffect(agentId: string, newLevel: number): void {
    const container = this.agentSprites.get(agentId)
    if (!container) return

    const x = container.x
    const y = container.y

    // Golden light pillar rising from agent
    const pillar = this.add.graphics().setDepth(2999)
    pillar.fillStyle(0xFFD700, 0.25)
    pillar.fillRect(x - 8, y - 80, 16, 80)
    pillar.fillStyle(0xFFFFAA, 0.4)
    pillar.fillRect(x - 3, y - 80, 6, 80)
    this.tweens.add({
      targets: pillar,
      alpha: 0,
      duration: 1500,
      delay: 500,
      ease: 'Quad.easeIn',
      onComplete: () => pillar.destroy(),
    })

    // Expanding glow ring
    const glow = this.add.circle(x, y, 5, 0xF1C40F, 0.8).setDepth(3000)
    this.tweens.add({
      targets: glow,
      scale: 4,
      alpha: 0,
      duration: 800,
      ease: 'Quad.easeOut',
      onComplete: () => glow.destroy(),
    })

    // Radial sparkle burst
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12
      const sparkle = this.add.rectangle(
        x, y, 2, 6, 0xFFD700, 1,
      ).setDepth(3000).setRotation(angle)

      this.tweens.add({
        targets: sparkle,
        x: x + Math.cos(angle) * 30,
        y: y + Math.sin(angle) * 30,
        alpha: 0,
        duration: 600 + i * 30,
        ease: 'Quad.easeOut',
        onComplete: () => sparkle.destroy(),
      })
    }

    // "LEVEL UP!" text with scale pop-in
    const text = this.add.text(x, y - 35, 'LEVEL UP!', {
      fontSize: '13px',
      fontFamily: 'Arial, sans-serif',
      color: '#FFD700',
      stroke: '#000000',
      strokeThickness: 4,
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(3001).setScale(0.3)

    this.tweens.add({
      targets: text,
      scale: 1,
      duration: 300,
      ease: 'Back.easeOut',
    })
    this.tweens.add({
      targets: text,
      y: text.y - 30,
      alpha: 0,
      duration: 2000,
      delay: 500,
      ease: 'Quad.easeOut',
      onComplete: () => text.destroy(),
    })

    // Level number below
    const lvlText = this.add.text(x, y - 20, `Lv.${newLevel}`, {
      fontSize: '10px',
      fontFamily: 'Arial, sans-serif',
      color: '#FFFACD',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(3001).setAlpha(0)

    this.tweens.add({
      targets: lvlText,
      alpha: 1,
      duration: 300,
      delay: 300,
    })
    this.tweens.add({
      targets: lvlText,
      y: lvlText.y - 25,
      alpha: 0,
      duration: 1500,
      delay: 800,
      ease: 'Quad.easeOut',
      onComplete: () => lvlText.destroy(),
    })
  }

  /** Navigate camera to a tile position (used by minimap) */
  centerOnTile(tileX: number, tileY: number): void {
    const pos = worldToScreen(tileX, tileY)
    this.cameras.main.centerOn(pos.x + ISO_TILE_WIDTH / 2, pos.y + ISO_TILE_HEIGHT / 2)
  }

  // ── Monster rendering ──

  private static MONSTER_COLORS: Record<string, number> = {
    slime: 0x44CC44,
    goblin: 0x88AA44,
    wolf: 0x888888,
    skeleton: 0xCCCCBB,
    bandit: 0xAA6644,
    troll: 0x558844,
    ghost: 0x8888DD,
    dragon_whelp: 0xCC4444,
  }

  updateMonsters(monsters: Monster[]): void {
    const currentIds = new Set(monsters.map(m => m.id))

    // Remove sprites for dead/removed monsters
    for (const [id, sprite] of this.monsterSprites) {
      if (!currentIds.has(id)) {
        sprite.destroy()
        this.monsterSprites.delete(id)
      }
    }

    for (const monster of monsters) {
      const pos = worldToScreen(monster.position.x, monster.position.y)
      const screenX = pos.x + ISO_TILE_WIDTH / 2
      const screenY = pos.y + ISO_TILE_HEIGHT / 2 - 8
      const color = WorldScene.MONSTER_COLORS[monster.type] ?? 0xFF4444

      if (!this.monsterSprites.has(monster.id)) {
        this.createMonsterSprite(monster, { x: screenX, y: screenY }, color)
      } else {
        const container = this.monsterSprites.get(monster.id)!
        this.tweens.add({
          targets: container,
          x: screenX,
          y: screenY,
          duration: 400,
          ease: 'Quad.easeOut',
        })
        container.setDepth(490 + isoDepth(monster.position.x, monster.position.y))

        this.updateMonsterHpBar(container, monster)
      }
    }
  }

  private createMonsterSprite(
    monster: Monster,
    screenPos: { x: number; y: number },
    color: number,
  ): void {
    const shadow = this.add.ellipse(0, 8, 20, 8, 0x000000, 0.3)

    // Try spritesheet for known monster types
    const sheetKey = `char_monster_${monster.type}`
    let body: Phaser.GameObjects.GameObject

    if (this.textures.exists(sheetKey)) {
      const sprite = this.add.sprite(0, 0, sheetKey, 1) // stand frame facing down
        .setOrigin(0.5, 0.8)
        .setScale(AGENT_SCALE)
      body = sprite

      // Play idle animation
      const idleAnim = `${sheetKey}_idle_down`
      if (this.anims.exists(idleAnim)) {
        sprite.play(idleAnim)
      }
    } else {
      // Fallback: procedural graphics
      const gfx = this.add.graphics()
      const size = 10 + monster.level * 1.5
      gfx.fillStyle(color, 1)
      gfx.fillRoundedRect(-size / 2, -size, size, size, 3)
      gfx.fillStyle(0xFF0000, 0.9)
      gfx.fillCircle(-size * 0.2, -size * 0.7, 2)
      gfx.fillCircle(size * 0.2, -size * 0.7, 2)
      body = gfx

      this.tweens.add({
        targets: gfx,
        y: gfx.y - 2,
        duration: 800 + Math.random() * 400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }

    const size = 10 + monster.level * 1.5
    const nameText = this.add.text(0, -size - 14, monster.name, {
      fontSize: '8px',
      fontFamily: 'Arial, sans-serif',
      color: '#ff6666',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 1)

    const hpBarBg = this.add.rectangle(0, -size - 4, 28, 4, 0x333333)
      .setOrigin(0.5, 0.5)

    const hpRatio = monster.hp / monster.maxHp
    const hpBarFill = this.add.rectangle(
      -14 + (28 * hpRatio) / 2, -size - 4,
      28 * hpRatio, 4,
      hpRatio > 0.5 ? 0x44CC44 : hpRatio > 0.25 ? 0xCCAA00 : 0xCC2222,
    ).setOrigin(0.5, 0.5)

    const container = this.add.container(
      screenPos.x,
      screenPos.y,
      [shadow, body, nameText, hpBarBg, hpBarFill],
    )
    container.setDepth(490 + isoDepth(monster.position.x, monster.position.y))

    this.monsterSprites.set(monster.id, container)
  }

  private updateMonsterHpBar(container: Phaser.GameObjects.Container, monster: Monster): void {
    const hpBarFill = container.list[4] as Phaser.GameObjects.Rectangle | undefined
    if (!hpBarFill) return

    const hpRatio = monster.hp / monster.maxHp
    hpBarFill.width = 28 * hpRatio
    hpBarFill.x = -14 + (28 * hpRatio) / 2
    hpBarFill.setFillStyle(
      hpRatio > 0.5 ? 0x44CC44 : hpRatio > 0.25 ? 0xCCAA00 : 0xCC2222,
    )
  }

  showDamagePopup(worldX: number, worldY: number, damage: number, isAgentDamage: boolean): void {
    const pos = worldToScreen(worldX, worldY)
    const color = isAgentDamage ? '#ff4444' : '#ffaa00'
    const prefix = '-'

    const text = this.add.text(
      pos.x + ISO_TILE_WIDTH / 2 + Phaser.Math.Between(-10, 10),
      pos.y + ISO_TILE_HEIGHT / 2 - 20,
      `${prefix}${damage}`,
      {
        fontSize: '14px',
        fontFamily: 'Arial, sans-serif',
        color,
        stroke: '#000000',
        strokeThickness: 3,
        fontStyle: 'bold',
      },
    ).setOrigin(0.5).setDepth(3000)

    this.tweens.add({
      targets: text,
      y: text.y - 30,
      alpha: 0,
      duration: 800,
      ease: 'Quad.easeOut',
      onComplete: () => text.destroy(),
    })
  }

  showCombatEffect(worldX: number, worldY: number): void {
    const pos = worldToScreen(worldX, worldY)
    const cx = pos.x + ISO_TILE_WIDTH / 2
    const cy = pos.y + ISO_TILE_HEIGHT / 2

    const ring = this.add.circle(cx, cy, 8, 0xFF4444, 0.6)
      .setDepth(3000)

    this.tweens.add({
      targets: ring,
      scale: 3,
      alpha: 0,
      duration: 500,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    })

    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2
      const dist = 5 + Math.random() * 10
      const spark = this.add.rectangle(
        cx + Math.cos(angle) * dist,
        cy + Math.sin(angle) * dist,
        2, 8, 0xFFFFFF, 0.8,
      ).setDepth(3000).setRotation(angle)

      this.tweens.add({
        targets: spark,
        x: spark.x + Math.cos(angle) * 15,
        y: spark.y + Math.sin(angle) * 15,
        alpha: 0,
        duration: 300 + i * 80,
        onComplete: () => spark.destroy(),
      })
    }
  }

  /** Look up a tile from chunkDataStore by world coordinates */
  private getTileAt(x: number, y: number): Tile | null {
    const cx = Math.floor(x / CHUNK_SIZE)
    const cy = Math.floor(y / CHUNK_SIZE)
    const chunk = this.chunkDataStore.get(`${cx},${cy}`)
    if (!chunk) return null
    const lx = x - cx * CHUNK_SIZE
    const ly = y - cy * CHUNK_SIZE
    if (ly < 0 || ly >= chunk.tiles.length || lx < 0 || lx >= chunk.tiles[ly].length) return null
    return chunk.tiles[ly][lx]
  }
}
