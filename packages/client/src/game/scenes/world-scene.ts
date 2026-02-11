import Phaser from 'phaser'
import type { Agent, Tile, WorldEvent, WorldClock, ChunkData, CharacterAppearance, Race, CharacterAppearanceMap, WeatherState, ActiveWorldEvent, Monster } from '@botworld/shared'
import { CHUNK_SIZE } from '@botworld/shared'
import { composeCharacterSprite } from '../character/sprite-composer.js'
import { SpriteCache } from '../character/sprite-cache.js'
import { WeatherEffects } from '../effects/weather-effects.js'
import { DayNightCycle } from '../effects/day-night-cycle.js'
import { soundManager } from '../audio/sound-manager.js'
import { TILE_SIZE, worldToScreen, screenToWorld } from '../utils/coordinates.js'

// Scale factors for sprites placed on the top-down grid
const AGENT_SCALE = 0.6
const RESOURCE_SCALE = 0.35
const BUILDING_SCALE = 1.0


interface RenderedChunk {
  objectSprites: Phaser.GameObjects.GameObject[]
}

// ── Biome-aware tile texture mapping (for object sprites that still use individual textures) ──

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
      return tile.poiType ? 'tile_new_road_stone' : 'tile_new_road_dirt'
    case 'river':
      return 'tile_new_water_river'
    default:
      return null
  }
}

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
 * Renders flat square tiles using a RenderTexture ground layer,
 * with object sprites (resources, buildings, agents) on top.
 */
export class WorldScene extends Phaser.Scene {
  // Chunk data received from server
  private chunkDataStore = new Map<string, ChunkData>()
  // Currently rendered chunks (viewport-based)
  private renderedChunks = new Map<string, RenderedChunk>()
  // Ground layer: RenderTexture for painting tiles
  private groundRT: Phaser.GameObjects.RenderTexture | null = null
  // Track which chunks have been painted to the ground RT
  private paintedChunks = new Set<string>()
  // Ground RT offset: the world-space origin of the RT (in tiles)
  private groundOriginX = -150
  private groundOriginY = -150
  private groundSizeTiles = 300

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
  private selectedAgentId: string | null = null
  private followingAgentId: string | null = null
  private hasCentered = false

  constructor() {
    super({ key: 'WorldScene' })
  }

  create(): void {
    this.cameras.main.setZoom(1.5)
    this.cameras.main.setRoundPixels(true)
    this.cameras.main.setBackgroundColor('#1a2e1a')

    // Create the ground RenderTexture — covers a generous area for chunk rendering
    const rtPixelSize = this.groundSizeTiles * TILE_SIZE
    const rtOriginPx = this.groundOriginX * TILE_SIZE
    const rtOriginPyPx = this.groundOriginY * TILE_SIZE
    this.groundRT = this.add.renderTexture(rtOriginPx, rtOriginPyPx, rtPixelSize, rtPixelSize)
    this.groundRT.setOrigin(0, 0)
    this.groundRT.setDepth(-1)

    // Day-night cycle (tint overlay, stars, building lights, agent torches)
    this.dayNightCycle = new DayNightCycle(this)

    // Weather visual effects layer
    this.weatherEffects = new WeatherEffects(this)

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
      cam.setZoom(Phaser.Math.Clamp(newZoom, 0.5, 4))
    })

    // Drag to pan
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) {
        this.followingAgentId = null  // Stop following on manual pan
        const cam = this.cameras.main
        cam.scrollX -= (pointer.x - pointer.prevPosition.x) / cam.zoom
        cam.scrollY -= (pointer.y - pointer.prevPosition.y) / cam.zoom
      }
    })
  }

  update(_time: number, _delta: number): void {
    // Camera follow mode
    if (this.followingAgentId) {
      const agent = this.agents.find(a => a.id === this.followingAgentId)
      if (agent) {
        const pos = worldToScreen(agent.position.x, agent.position.y)
        const cam = this.cameras.main
        const targetX = pos.x + TILE_SIZE / 2 - cam.width / (2 * cam.zoom)
        const targetY = pos.y + TILE_SIZE / 2 - cam.height / (2 * cam.zoom)
        cam.scrollX += (targetX - cam.scrollX) * 0.08
        cam.scrollY += (targetY - cam.scrollY) * 0.08
      } else {
        this.followingAgentId = null
      }
    }

    this.updateVisibleChunks()
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
      this.cameras.main.centerOn(centerScreen.x, centerScreen.y)
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
      scrollX: targetScreen.x + TILE_SIZE / 2 - cam.width / 2,
      scrollY: targetScreen.y + TILE_SIZE / 2 - cam.height / 2,
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
      const screenX = pos.x + TILE_SIZE / 2
      const screenY = pos.y + TILE_SIZE / 2 - 8

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
      const pos = worldToScreen(agents[0].position.x, agents[0].position.y)
      this.cameras.main.centerOn(pos.x + TILE_SIZE / 2, pos.y + TILE_SIZE / 2)
    }
  }

  updateClock(clock: WorldClock): void {
    this.dayNightCycle?.update(clock.timeOfDay, clock.dayProgress)
    soundManager.onTimeChange(clock.timeOfDay)

    // Update agent torch positions
    if (this.dayNightCycle && this.agents.length > 0) {
      const torchPositions = this.agents.map(a => {
        const pos = worldToScreen(a.position.x, a.position.y)
        return { screenX: pos.x + TILE_SIZE / 2, screenY: pos.y + TILE_SIZE / 2 - 8 }
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
          const pos = worldToScreen(event.to.x, event.to.y)
          this.tweens.add({
            targets: container,
            x: pos.x + TILE_SIZE / 2,
            y: pos.y + TILE_SIZE / 2 - 8,
            duration: 500,
            ease: 'Linear',
          })
        }
        // Footstep SFX for selected agent only
        if (event.agentId === this.selectedAgentId) {
          const tile = this.getTileAt(event.to.x, event.to.y)
          if (tile) soundManager.playFootstep(tile.type)
        }
        break
      }
      case 'resource:gathered': {
        const gatherPos = worldToScreen(event.position.x, event.position.y)
        this.showGatherEffect(gatherPos.x + TILE_SIZE / 2, gatherPos.y + TILE_SIZE / 2, event.resourceType)
        soundManager.playGather(event.resourceType)
        break
      }
      case 'item:crafted': {
        const crafter = this.agents.find(a => a.id === event.agentId)
        if (crafter) {
          const pos = worldToScreen(crafter.position.x, crafter.position.y)
          this.showCraftEffect(pos.x + TILE_SIZE / 2, pos.y + TILE_SIZE / 2 - 8, event.item.name)
        }
        break
      }
      case 'trade:completed': {
        const buyer = this.agents.find(a => a.id === event.buyerId)
        if (buyer) {
          const pos = worldToScreen(buyer.position.x, buyer.position.y)
          this.showTradeEffect(pos.x + TILE_SIZE / 2, pos.y + TILE_SIZE / 2 - 8)
        }
        break
      }
      case 'agent:action': {
        const actor = this.agents.find(a => a.id === event.agentId)
        if (actor && event.action.type === 'rest') {
          const pos = worldToScreen(actor.position.x, actor.position.y)
          this.showRestEffect(pos.x + TILE_SIZE / 2, pos.y + TILE_SIZE / 2 - 8)
        }
        break
      }
      case 'combat:started': {
        this.showCombatEffect(event.position.x, event.position.y)
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
    const pos = worldToScreen(event.position.x, event.position.y)
    const container = this.add.container(pos.x + TILE_SIZE / 2, pos.y)
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
              screenX: pos.x + TILE_SIZE / 2,
              screenY: pos.y,
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
    const topLeft = screenToWorld(wv.left, wv.top)
    const bottomRight = screenToWorld(wv.right, wv.bottom)

    // Bounding box in tile space with margin
    const margin = CHUNK_SIZE * 2
    const minTX = topLeft.x - margin
    const maxTX = bottomRight.x + margin
    const minTY = topLeft.y - margin
    const maxTY = bottomRight.y + margin

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

    // Paint ground tiles onto the RenderTexture (if not already painted)
    if (!this.paintedChunks.has(key) && this.groundRT) {
      this.paintChunkTiles(chunk)
      this.paintedChunks.add(key)
    }

    // Create object sprites (resources, decorations, buildings) on top
    for (let ly = 0; ly < chunk.tiles.length; ly++) {
      for (let lx = 0; lx < chunk.tiles[ly].length; lx++) {
        const tile = chunk.tiles[ly][lx]
        const pos = worldToScreen(tile.position.x, tile.position.y)
        const centerX = pos.x + TILE_SIZE / 2
        const centerY = pos.y + TILE_SIZE / 2

        // Coordinate-based hash for tile diversity
        const hash = ((tile.position.x * 73856093) ^ (tile.position.y * 19349663)) >>> 0

        // POI building overlay
        if (tile.poiType) {
          const bldgKey = resolveBuildingTexture(tile.poiType, this.textures)
          const bldgSprite = this.add.image(centerX, pos.y + TILE_SIZE, bldgKey)
            .setOrigin(0.5, 1.0)
            .setScale(BUILDING_SCALE)
            .setDepth(tile.position.y + 0.3)
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
            .setDepth(tile.position.y + 0.05)
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
            .setDepth(tile.position.y + 0.1)
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

  /** Paint a chunk's ground tiles onto the RenderTexture */
  private paintChunkTiles(chunk: ChunkData): void {
    if (!this.groundRT) return

    const rtOriginPx = this.groundOriginX * TILE_SIZE
    const rtOriginPy = this.groundOriginY * TILE_SIZE

    for (let ly = 0; ly < chunk.tiles.length; ly++) {
      for (let lx = 0; lx < chunk.tiles[ly].length; lx++) {
        const tile = chunk.tiles[ly][lx]

        // Screen position of this tile relative to the RT origin
        const drawX = tile.position.x * TILE_SIZE - rtOriginPx
        const drawY = tile.position.y * TILE_SIZE - rtOriginPy

        // Skip tiles outside the RT bounds
        if (drawX < 0 || drawY < 0 ||
            drawX + TILE_SIZE > this.groundSizeTiles * TILE_SIZE ||
            drawY + TILE_SIZE > this.groundSizeTiles * TILE_SIZE) {
          continue
        }

        // Draw the per-tile flat texture (generated in boot-scene as 32x32 squares)
        const tileTexKey = this.resolveFlatTileTexture(tile)
        if (this.textures.exists(tileTexKey)) {
          this.groundRT.draw(tileTexKey, drawX, drawY)
        }
      }
    }
  }

  /** Resolve the best flat tile texture key for a tile */
  private resolveFlatTileTexture(tile: Tile): string {
    const newKey = getNewTileKey(tile)
    if (newKey && this.textures.exists(newKey)) return newKey

    const variantKey = `tile_${tile.type}_v${tile.variant ?? 0}`
    if (this.textures.exists(variantKey)) return variantKey

    return `tile_${tile.type}`
  }

  private destroyRenderedChunk(rendered: RenderedChunk): void {
    for (const s of rendered.objectSprites) s.destroy()
  }

  // --- Agent rendering ---

  private createAgentSprite(agent: Agent, screenPos: { x: number; y: number }): void {
    const shadow = this.add.image(0, 6, 'agent_shadow')
      .setScale(0.7)
      .setAlpha(0.3)

    const charData = this.characterAppearances[agent.id]
    let spriteOrGroup: Phaser.GameObjects.Image | Phaser.GameObjects.Container

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

    const container = this.add.container(
      screenPos.x,
      screenPos.y,
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

  /** Recompose an agent's layered sprite at runtime */
  private recomposeAgentSprite(agentId: string): void {
    const container = this.agentSprites.get(agentId)
    if (!container || !container.list || container.list.length < 2) return

    const charData = this.characterAppearances[agentId]
    if (!charData) return

    const oldVisual = container.list[1] as Phaser.GameObjects.GameObject
    if (oldVisual) oldVisual.destroy()
    this.spriteCache.remove(agentId)

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

    const text = this.add.text(x, y - 25, 'Trade!', {
      fontSize: '10px',
      fontFamily: 'Arial, sans-serif',
      color: '#2ecc71',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(3000)

    this.tweens.add({
      targets: text,
      y: text.y - 20,
      alpha: 0,
      duration: 1000,
      onComplete: () => text.destroy(),
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

    const glow = this.add.circle(x, y, 5, 0xF1C40F, 0.8).setDepth(3000)
    this.tweens.add({
      targets: glow,
      scale: 4,
      alpha: 0,
      duration: 800,
      ease: 'Quad.easeOut',
      onComplete: () => glow.destroy(),
    })

    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8
      const sparkle = this.add.rectangle(
        x, y, 2, 6, 0xFFD700, 1,
      ).setDepth(3000).setRotation(angle)

      this.tweens.add({
        targets: sparkle,
        x: x + Math.cos(angle) * 25,
        y: y + Math.sin(angle) * 25,
        alpha: 0,
        duration: 600,
        ease: 'Quad.easeOut',
        onComplete: () => sparkle.destroy(),
      })
    }

    const text = this.add.text(x, y - 30, `Level ${newLevel}!`, {
      fontSize: '14px',
      fontFamily: 'Arial, sans-serif',
      color: '#FFD700',
      stroke: '#000000',
      strokeThickness: 4,
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(3001)

    this.tweens.add({
      targets: text,
      y: text.y - 35,
      alpha: 0,
      duration: 2000,
      ease: 'Quad.easeOut',
      onComplete: () => text.destroy(),
    })
  }

  /** Navigate camera to a tile position (used by minimap) */
  centerOnTile(tileX: number, tileY: number): void {
    const pos = worldToScreen(tileX, tileY)
    this.cameras.main.centerOn(pos.x + TILE_SIZE / 2, pos.y + TILE_SIZE / 2)
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
      const screenX = pos.x + TILE_SIZE / 2
      const screenY = pos.y + TILE_SIZE / 2 - 8
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
        container.setDepth(490 + monster.position.y)

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

    const body = this.add.graphics()
    const size = 10 + monster.level * 1.5
    body.fillStyle(color, 1)
    body.fillRoundedRect(-size / 2, -size, size, size, 3)
    body.fillStyle(0xFF0000, 0.9)
    body.fillCircle(-size * 0.2, -size * 0.7, 2)
    body.fillCircle(size * 0.2, -size * 0.7, 2)

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
    container.setDepth(490 + monster.position.y)

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
      pos.x + TILE_SIZE / 2 + Phaser.Math.Between(-10, 10),
      pos.y + TILE_SIZE / 2 - 20,
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
    const cx = pos.x + TILE_SIZE / 2
    const cy = pos.y + TILE_SIZE / 2

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
