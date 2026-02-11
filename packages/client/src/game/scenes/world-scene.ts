import Phaser from 'phaser'
import type { Agent, Tile, WorldEvent, WorldClock, ChunkData, CharacterAppearance, Race, CharacterAppearanceMap, WeatherState, ActiveWorldEvent, Monster } from '@botworld/shared'
import { CHUNK_SIZE } from '@botworld/shared'
import { composeCharacterSprite } from '../character/sprite-composer.js'
import { SpriteCache } from '../character/sprite-cache.js'
import { WeatherEffects } from '../effects/weather-effects.js'
import { DayNightCycle } from '../effects/day-night-cycle.js'

// Grid spacing for isometric projection
const TILE_W = 128
const TILE_H = 64

// Scale factors
const TILE_SCALE = 1.0
const AGENT_SCALE = 0.6
const RESOURCE_SCALE = 0.35
const BUILDING_SCALE = 1.2

interface RenderedChunk {
  tileSprites: Phaser.GameObjects.Image[]
  decoSprites: Phaser.GameObjects.Image[]
  resourceSprites: Phaser.GameObjects.Image[]
  buildingSprites: Phaser.GameObjects.Image[]
}

// ── Biome-aware tile texture mapping ──

/** Map tile type + biome + variant to the best available new texture key */
function resolveTileTexture(tile: Tile, textures: Phaser.Textures.TextureManager): string {
  // Try new biome-specific textures first
  const newKey = getNewTileKey(tile)
  if (newKey && textures.exists(newKey)) return newKey

  // Fallback to legacy variant texture
  const variantKey = `tile_${tile.type}_v${tile.variant ?? 0}`
  if (textures.exists(variantKey)) return variantKey

  // Fallback to legacy base texture
  return `tile_${tile.type}`
}

function getNewTileKey(tile: Tile): string | null {
  const biome = tile.biome ?? ''
  const variant = tile.variant ?? 0

  switch (tile.type) {
    case 'grass':
      if (tile.decoration?.includes('flower') || variant === 2) return 'tile_new_grass_flowers'
      return 'tile_new_grass_plains'
    case 'forest':
      return variant >= 1 ? 'tile_new_forest_dense' : 'tile_new_forest_light'
    case 'dense_forest':
      return biome === 'tundra' ? 'tile_new_snow_forest' : 'tile_new_forest_dense'
    case 'mountain':
      if (variant >= 2) return 'tile_new_mountain_high'
      if (variant === 1) return 'tile_new_mountain_rocky'
      return 'tile_new_mountain_low'
    case 'water':
      return 'tile_new_water_shallow'
    case 'deep_water':
      return 'tile_new_water_deep'
    case 'sand':
      if (biome === 'beach' || biome === 'coast') return 'tile_new_beach'
      return 'tile_new_desert_sand'
    case 'snow':
      return 'tile_new_snow_field'
    case 'swamp':
      return 'tile_new_swamp'
    case 'farmland':
      return 'tile_new_farmland'
    case 'road':
      // Stone roads near POIs, dirt roads elsewhere
      return tile.poiType ? 'tile_new_road_stone' : 'tile_new_road_dirt'
    default:
      return null
  }
}

/** Map POI type to the best available building texture key */
function resolveBuildingTexture(poiType: string, textures: Phaser.Textures.TextureManager): string {
  // New building name mapping
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

  // Fallback to legacy building texture
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

  // Fallback to legacy resource texture
  const legacyKey = `resource_${resourceType}`
  if (textures.exists(legacyKey)) return legacyKey

  return 'resource_indicator'
}

/**
 * Main isometric world scene with chunk-based rendering.
 * Only renders chunks visible in the camera viewport.
 */
export class WorldScene extends Phaser.Scene {
  // Chunk data received from server
  private chunkDataStore = new Map<string, ChunkData>()
  // Currently rendered chunks (viewport-based)
  private renderedChunks = new Map<string, RenderedChunk>()
  // Track which chunk keys are currently visible
  private lastVisibleKeys = new Set<string>()

  // Agent rendering
  private agentSprites = new Map<string, Phaser.GameObjects.Container>()
  private actionIndicators = new Map<string, Phaser.GameObjects.Image>()
  private speechBubbles = new Map<string, { container: Phaser.GameObjects.Container; timer: number }>()
  private monsterSprites = new Map<string, Phaser.GameObjects.Container>()
  private dayNightCycle: DayNightCycle | null = null
  private selectionRing: Phaser.GameObjects.Image | null = null
  private weatherEffects: WeatherEffects | null = null
  private eventMarkers = new Map<string, Phaser.GameObjects.Container>()

  // Character appearance (layered sprite) data
  private characterAppearances: CharacterAppearanceMap = {}
  private spriteCache = new SpriteCache()

  private agents: Agent[] = []
  private clock: WorldClock | null = null
  private selectedAgentId: string | null = null
  private hasCentered = false

  constructor() {
    super({ key: 'WorldScene' })
  }

  create(): void {
    this.cameras.main.setZoom(0.5)

    // Day-night cycle (tint overlay, stars, building lights, agent torches)
    this.dayNightCycle = new DayNightCycle(this)

    // Weather visual effects layer
    this.weatherEffects = new WeatherEffects(this)

    // Scroll wheel zoom
    this.input.on('wheel', (
      _pointer: Phaser.Input.Pointer,
      _over: Phaser.GameObjects.GameObject[],
      _dx: number,
      dy: number,
    ) => {
      const cam = this.cameras.main
      const zoomDelta = -dy * 0.002 * cam.zoom
      cam.setZoom(Phaser.Math.Clamp(cam.zoom + zoomDelta, 0.3, 3))
    })

    // Drag to pan
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) {
        const cam = this.cameras.main
        cam.scrollX -= (pointer.x - pointer.prevPosition.x) / cam.zoom
        cam.scrollY -= (pointer.y - pointer.prevPosition.y) / cam.zoom
      }
    })
  }

  update(_time: number, _delta: number): void {
    this.updateVisibleChunks()
  }

  // --- Chunk data management ---

  addChunks(chunks: Record<string, ChunkData>): void {
    for (const [key, chunk] of Object.entries(chunks)) {
      this.chunkDataStore.set(key, chunk)
    }

    // Center camera on first data load
    if (!this.hasCentered && this.chunkDataStore.size > 0) {
      this.hasCentered = true
      // Center on origin (0,0) in tile space
      const centerScreen = this.tileToScreen(0, 0)
      this.cameras.main.centerOn(centerScreen.x, centerScreen.y)
    }
  }

  /** Receive full character appearance map (on connect) */
  setCharacterAppearances(map: CharacterAppearanceMap): void {
    this.characterAppearances = map
    // Recompose any agents whose hash changed
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
      const screenPos = this.tileToScreen(agent.position.x, agent.position.y)

      if (!this.agentSprites.has(agent.id)) {
        this.createAgentSprite(agent, screenPos)
      } else {
        const container = this.agentSprites.get(agent.id)!
        this.tweens.add({
          targets: container,
          x: screenPos.x,
          y: screenPos.y - TILE_H * 0.4,
          duration: 300,
          ease: 'Linear',
        })
      }

      this.updateActionIndicator(agent)
    }

    // Remove sprites for agents that no longer exist
    for (const [id, sprite] of this.agentSprites) {
      if (!agents.find(a => a.id === id)) {
        sprite.destroy()
        this.agentSprites.delete(id)
        this.actionIndicators.get(id)?.destroy()
        this.actionIndicators.delete(id)
        this.spriteCache.remove(id)
      }
    }

    this.updateSelectionRing()

    // Center on first agent if we haven't centered yet
    if (!this.hasCentered && agents.length > 0) {
      this.hasCentered = true
      const pos = this.tileToScreen(agents[0].position.x, agents[0].position.y)
      this.cameras.main.centerOn(pos.x, pos.y)
    }
  }

  updateClock(clock: WorldClock): void {
    this.clock = clock
    this.dayNightCycle?.update(clock.timeOfDay, clock.dayProgress)

    // Update agent torch positions
    if (this.dayNightCycle && this.agents.length > 0) {
      const torchPositions = this.agents.map(a => {
        const pos = this.tileToScreen(a.position.x, a.position.y)
        return { screenX: pos.x, screenY: pos.y - TILE_H * 0.4 }
      })
      this.dayNightCycle.drawAgentTorches(torchPositions)
    }
  }

  setWeather(weather: WeatherState): void {
    this.weatherEffects?.setWeather(weather)
  }

  showSpeechBubble(agentId: string, message: string): void {
    const existing = this.speechBubbles.get(agentId)
    if (existing) {
      existing.container.destroy()
    }

    const agentContainer = this.agentSprites.get(agentId)
    if (!agentContainer) return

    const isPlan = message.startsWith('[Plan]')
    const bgColor = isPlan ? '#2d5016' : '#333333'
    const displayMsg = isPlan ? message.slice(7).trim() : message

    const text = this.add.text(0, -44, displayMsg.slice(0, 80), {
      fontSize: '10px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      backgroundColor: bgColor + 'dd',
      padding: { x: 6, y: 3 },
      wordWrap: { width: 180 },
    }).setOrigin(0.5, 1)

    const pointer = this.add.graphics()
    pointer.fillStyle(isPlan ? 0x2d5016 : 0x333333, 0.87)
    pointer.fillTriangle(-4, -1, 4, -1, 0, 4)

    const container = this.add.container(agentContainer.x, agentContainer.y - 10, [text, pointer])
    container.setDepth(2000)
    container.setAlpha(0)

    this.tweens.add({
      targets: container,
      alpha: 1,
      duration: 200,
    })

    this.speechBubbles.set(agentId, {
      container,
      timer: this.time.now + 6000,
    })

    this.time.delayedCall(6000, () => {
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
        break
      case 'agent:moved': {
        const container = this.agentSprites.get(event.agentId)
        if (container) {
          const pos = this.tileToScreen(event.to.x, event.to.y)
          this.tweens.add({
            targets: container,
            x: pos.x,
            y: pos.y - TILE_H * 0.4,
            duration: 500,
            ease: 'Linear',
          })
        }
        break
      }
      case 'resource:gathered': {
        const gatherPos = this.tileToScreen(event.position.x, event.position.y)
        this.showGatherEffect(gatherPos.x, gatherPos.y, event.resourceType)
        break
      }
    }
  }

  getSelectedAgentId(): string | null {
    return this.selectedAgentId
  }

  // ── World event markers ──

  setWorldEvents(events: ActiveWorldEvent[]): void {
    const currentIds = new Set(events.map(e => e.id))

    // Remove expired markers
    for (const [id, container] of this.eventMarkers) {
      if (!currentIds.has(id)) {
        container.destroy()
        this.eventMarkers.delete(id)
      }
    }

    // Add/update markers
    for (const event of events) {
      if (!this.eventMarkers.has(event.id)) {
        this.createEventMarker(event)
      }
    }
  }

  private createEventMarker(event: ActiveWorldEvent): void {
    const pos = this.tileToScreen(event.position.x, event.position.y)
    const container = this.add.container(pos.x, pos.y - TILE_H * 0.5)
    container.setDepth(900)

    const CATEGORY_COLORS: Record<string, number> = {
      resource: 0x2ecc71,
      social: 0xf1c40f,
      danger: 0xe74c3c,
      discovery: 0x9b59b6,
    }
    const color = CATEGORY_COLORS[event.category] ?? 0x888888

    // Pulsing circle
    const circle = this.add.graphics()
    circle.fillStyle(color, 0.3)
    circle.fillCircle(0, 0, 16)
    circle.lineStyle(2, color, 0.8)
    circle.strokeCircle(0, 0, 16)
    container.add(circle)

    // Inner diamond icon
    const diamond = this.add.graphics()
    diamond.fillStyle(color, 0.9)
    diamond.fillTriangle(0, -8, 6, 0, 0, 8)
    diamond.fillTriangle(0, -8, -6, 0, 0, 8)
    container.add(diamond)

    // Pulse animation
    this.tweens.add({
      targets: container,
      scaleX: { from: 0.8, to: 1.2 },
      scaleY: { from: 0.8, to: 1.2 },
      alpha: { from: 0.6, to: 1 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    this.eventMarkers.set(event.id, container)
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

    this.lastVisibleKeys = visibleKeys

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
            const pos = this.tileToScreen(tile.position.x, tile.position.y)
            buildings.push({
              key: `${tile.position.x},${tile.position.y}`,
              screenX: pos.x,
              screenY: pos.y - TILE_H * 0.6,
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

    // Convert camera viewport corners to tile coordinates
    const corners = [
      this.screenToTile(wv.left, wv.top),
      this.screenToTile(wv.right, wv.top),
      this.screenToTile(wv.left, wv.bottom),
      this.screenToTile(wv.right, wv.bottom),
    ]

    // Bounding box in tile space with margin
    const margin = CHUNK_SIZE * 2
    const minTX = Math.min(corners[0].x, corners[1].x, corners[2].x, corners[3].x) - margin
    const maxTX = Math.max(corners[0].x, corners[1].x, corners[2].x, corners[3].x) + margin
    const minTY = Math.min(corners[0].y, corners[1].y, corners[2].y, corners[3].y) - margin
    const maxTY = Math.max(corners[0].y, corners[1].y, corners[2].y, corners[3].y) + margin

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

  private renderChunk(key: string, chunk: ChunkData): void {
    const tileSprites: Phaser.GameObjects.Image[] = []
    const decoSprites: Phaser.GameObjects.Image[] = []
    const resourceSprites: Phaser.GameObjects.Image[] = []
    const buildingSprites: Phaser.GameObjects.Image[] = []

    for (let ly = 0; ly < chunk.tiles.length; ly++) {
      for (let lx = 0; lx < chunk.tiles[ly].length; lx++) {
        const tile = chunk.tiles[ly][lx]
        const pos = this.tileToScreen(tile.position.x, tile.position.y)
        const depth = tile.position.x + tile.position.y

        // Biome-aware tile texture selection (new assets with legacy fallback)
        const textureKey = resolveTileTexture(tile, this.textures)

        const sprite = this.add.image(pos.x, pos.y, textureKey)
          .setOrigin(0.5, 0.35)
          .setScale(TILE_SCALE)
          .setDepth(depth)

        // Water wave animation: gentle oscillation on water tiles
        if (tile.type === 'water' || tile.type === 'deep_water') {
          this.tweens.add({
            targets: sprite,
            y: sprite.y + 1.5,
            duration: 2000 + Math.random() * 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: Math.random() * 1000,
          })
          sprite.setAlpha(0.92)
        }

        tileSprites.push(sprite)

        // POI building overlay (rendered above the ground tile)
        if (tile.poiType) {
          const bldgKey = resolveBuildingTexture(tile.poiType, this.textures)
          const bldgSprite = this.add.image(pos.x, pos.y - TILE_H * 0.6, bldgKey)
            .setOrigin(0.5, 0.7)
            .setScale(BUILDING_SCALE)
            .setDepth(depth + 0.3)
          buildingSprites.push(bldgSprite)

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
          const deco = this.add.image(pos.x, pos.y - 10, tile.decoration)
            .setOrigin(0.5, 0.5)
            .setScale(0.5)
            .setDepth(depth + 0.05)
          decoSprites.push(deco)
        }

        // Resource overlay with biome-aware sprites
        if (tile.resource && tile.resource.amount >= 1) {
          const biome = tile.biome ?? ''
          const resKey = resolveResourceTexture(tile.resource.type, biome, this.textures)
          const isNewAsset = resKey.startsWith('res_')
          const isIndicator = resKey === 'resource_indicator'
          const scale = isIndicator ? 0.5 : isNewAsset ? RESOURCE_SCALE * 1.2 : RESOURCE_SCALE

          const resSprite = this.add.image(
            pos.x,
            pos.y - TILE_H * 0.4,
            resKey,
          )
            .setOrigin(0.5, 0.5)
            .setScale(scale)
            .setDepth(depth + 0.1)
            .setAlpha(0.85)
          resourceSprites.push(resSprite)

          // Vegetation sway for trees/bushes, bob for ores/minerals
          const isVegetation = ['wood', 'food', 'herb'].includes(tile.resource.type)
          if (isVegetation) {
            // Wind sway effect on vegetation
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
            // Gentle bob for minerals/ores
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

    this.renderedChunks.set(key, { tileSprites, decoSprites, resourceSprites, buildingSprites })
  }

  private destroyRenderedChunk(rendered: RenderedChunk): void {
    for (const s of rendered.tileSprites) s.destroy()
    for (const s of rendered.decoSprites) s.destroy()
    for (const s of rendered.resourceSprites) s.destroy()
    for (const s of rendered.buildingSprites) s.destroy()
  }

  // --- Agent rendering ---

  private createAgentSprite(agent: Agent, screenPos: { x: number; y: number }): void {
    const shadow = this.add.image(0, 6, 'agent_shadow')
      .setScale(0.7)
      .setAlpha(0.3)

    const charData = this.characterAppearances[agent.id]
    let spriteOrGroup: Phaser.GameObjects.Image | Phaser.GameObjects.Container

    if (charData) {
      // Layered character sprite
      const { bodyGroup, auraEmitter } = composeCharacterSprite(this, charData.appearance, charData.race)
      bodyGroup.setScale(AGENT_SCALE)
      this.spriteCache.set(agent.id, charData.spriteHash, { bodyGroup, auraEmitter })
      spriteOrGroup = bodyGroup

      // Breathing animation on the body group
      this.tweens.add({
        targets: bodyGroup,
        scaleY: AGENT_SCALE * 1.015,
        duration: 1200 + Math.random() * 400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    } else {
      // Legacy single-image fallback
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

    const isNpc = agent.isNpc === true
    const displayName = isNpc ? `[NPC] ${agent.name}` : agent.name
    const nameColor = isNpc ? '#f0c040' : '#ffffff'

    const nameText = this.add.text(0, -22, displayName, {
      fontSize: '10px',
      fontFamily: 'Arial, sans-serif',
      color: nameColor,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 1)

    const actionText = this.add.text(0, 10, '', {
      fontSize: '8px',
      fontFamily: 'Arial, sans-serif',
      color: '#aabbcc',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 0)

    // Container structure: [0: shadow, 1: sprite/bodyGroup, 2: nameText, 3: actionText]
    const container = this.add.container(
      screenPos.x,
      screenPos.y - TILE_H * 0.4,
      [shadow, spriteOrGroup, nameText, actionText],
    )
    container.setDepth(500 + agent.position.y)
    container.setSize(30, 40)
    container.setInteractive()

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
    })

    this.agentSprites.set(agent.id, container)
  }

  /** Recompose an agent's layered sprite at runtime (e.g. after appearance change) */
  private recomposeAgentSprite(agentId: string): void {
    const container = this.agentSprites.get(agentId)
    if (!container || !container.list || container.list.length < 2) return

    const charData = this.characterAppearances[agentId]
    if (!charData) return

    // Destroy old sprite/group at index 1
    const oldVisual = container.list[1] as Phaser.GameObjects.GameObject
    if (oldVisual) oldVisual.destroy()
    this.spriteCache.remove(agentId)

    // Create new layered sprite
    const { bodyGroup, auraEmitter } = composeCharacterSprite(this, charData.appearance, charData.race)
    bodyGroup.setScale(AGENT_SCALE)
    this.spriteCache.set(agentId, charData.spriteHash, { bodyGroup, auraEmitter })

    // Insert at index 1 (after shadow, before nameText)
    container.addAt(bodyGroup, 1)

    // Breathing animation
    this.tweens.add({
      targets: bodyGroup,
      scaleY: AGENT_SCALE * 1.015,
      duration: 1200 + Math.random() * 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  private updateActionIndicator(agent: Agent): void {
    const container = this.agentSprites.get(agent.id)
    if (!container || !container.list) return

    const actionText = container.list[3] as Phaser.GameObjects.Text | undefined
    if (actionText && 'setText' in actionText) {
      const actionType = agent.currentAction?.type ?? 'idle'
      const display = actionType === 'idle' ? '' : actionType
      actionText.setText(display)
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

  /** Navigate camera to a tile position (used by minimap) */
  centerOnTile(tileX: number, tileY: number): void {
    const pos = this.tileToScreen(tileX, tileY)
    this.cameras.main.centerOn(pos.x, pos.y)
  }

  /** Convert tile coordinates to isometric screen coordinates */
  private tileToScreen(x: number, y: number): { x: number; y: number } {
    return {
      x: (x - y) * (TILE_W / 2),
      y: (x + y) * (TILE_H / 2),
    }
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
      const screenPos = this.tileToScreen(monster.position.x, monster.position.y)
      const color = WorldScene.MONSTER_COLORS[monster.type] ?? 0xFF4444

      if (!this.monsterSprites.has(monster.id)) {
        this.createMonsterSprite(monster, screenPos, color)
      } else {
        const container = this.monsterSprites.get(monster.id)!
        // Smooth movement
        this.tweens.add({
          targets: container,
          x: screenPos.x,
          y: screenPos.y - TILE_H * 0.4,
          duration: 400,
          ease: 'Quad.easeOut',
        })
        container.setDepth(490 + monster.position.y)

        // Update HP bar
        this.updateMonsterHpBar(container, monster)
      }
    }
  }

  private createMonsterSprite(
    monster: Monster,
    screenPos: { x: number; y: number },
    color: number,
  ): void {
    // Shadow
    const shadow = this.add.ellipse(0, 8, 20, 8, 0x000000, 0.3)

    // Monster body (simple diamond shape)
    const body = this.add.graphics()
    const size = 10 + monster.level * 1.5
    body.fillStyle(color, 1)
    body.fillRoundedRect(-size / 2, -size, size, size, 3)
    // Eyes
    body.fillStyle(0xFF0000, 0.9)
    body.fillCircle(-size * 0.2, -size * 0.7, 2)
    body.fillCircle(size * 0.2, -size * 0.7, 2)

    // Name label
    const nameText = this.add.text(0, -size - 14, monster.name, {
      fontSize: '8px',
      fontFamily: 'Arial, sans-serif',
      color: '#ff6666',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 1)

    // HP bar background
    const hpBarBg = this.add.rectangle(0, -size - 4, 28, 4, 0x333333)
      .setOrigin(0.5, 0.5)

    // HP bar fill
    const hpRatio = monster.hp / monster.maxHp
    const hpBarFill = this.add.rectangle(
      -14 + (28 * hpRatio) / 2, -size - 4,
      28 * hpRatio, 4,
      hpRatio > 0.5 ? 0x44CC44 : hpRatio > 0.25 ? 0xCCAA00 : 0xCC2222,
    ).setOrigin(0.5, 0.5)

    const container = this.add.container(
      screenPos.x,
      screenPos.y - TILE_H * 0.4,
      [shadow, body, nameText, hpBarBg, hpBarFill],
    )
    container.setDepth(490 + monster.position.y)

    // Idle bounce animation
    this.tweens.add({
      targets: body,
      y: body.y - 2,
      duration: 800 + Math.random() * 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    this.monsterSprites.set(monster.id, container)
  }

  private updateMonsterHpBar(container: Phaser.GameObjects.Container, monster: Monster): void {
    // HP bar fill is at index 4
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
    const screenPos = this.tileToScreen(worldX, worldY)
    const color = isAgentDamage ? '#ff4444' : '#ffaa00'
    const prefix = isAgentDamage ? '-' : '-'

    const text = this.add.text(
      screenPos.x + Phaser.Math.Between(-10, 10),
      screenPos.y - TILE_H * 0.4 - 20,
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
    const screenPos = this.tileToScreen(worldX, worldY)

    // Flash ring
    const ring = this.add.circle(screenPos.x, screenPos.y - TILE_H * 0.3, 8, 0xFF4444, 0.6)
      .setDepth(3000)

    this.tweens.add({
      targets: ring,
      scale: 3,
      alpha: 0,
      duration: 500,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    })

    // Slash lines
    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2
      const dist = 5 + Math.random() * 10
      const spark = this.add.rectangle(
        screenPos.x + Math.cos(angle) * dist,
        screenPos.y - TILE_H * 0.3 + Math.sin(angle) * dist,
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

  /** Convert screen coordinates to tile coordinates (inverse isometric) */
  private screenToTile(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX / (TILE_W / 2) + screenY / (TILE_H / 2)) / 2,
      y: (screenY / (TILE_H / 2) - screenX / (TILE_W / 2)) / 2,
    }
  }
}
