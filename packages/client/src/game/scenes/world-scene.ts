import Phaser from 'phaser'
import type { Agent, Tile, WorldEvent, WorldClock, ChunkData, CharacterAppearance, Race, CharacterAppearanceMap } from '@botworld/shared'
import { CHUNK_SIZE } from '@botworld/shared'
import { composeCharacterSprite } from '../character/sprite-composer.js'
import { SpriteCache } from '../character/sprite-cache.js'

// Grid spacing for isometric projection
const TILE_W = 128
const TILE_H = 64

// Scale factors
const TILE_SCALE = 1.0
const AGENT_SCALE = 0.6
const RESOURCE_SCALE = 0.35

interface RenderedChunk {
  tileSprites: Phaser.GameObjects.Image[]
  decoSprites: Phaser.GameObjects.Image[]
  resourceSprites: Phaser.GameObjects.Image[]
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
  private ambientOverlay: Phaser.GameObjects.Rectangle | null = null
  private selectionRing: Phaser.GameObjects.Image | null = null

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

    // Ambient overlay for time-of-day tinting
    const { width, height } = this.cameras.main
    this.ambientOverlay = this.add.rectangle(
      width / 2, height / 2,
      width * 3, height * 3,
      0x000000, 0,
    )
      .setScrollFactor(0)
      .setDepth(1500)

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
    const bgColors: Record<string, string> = {
      dawn: '#2a1a3e',
      morning: '#1a1a2e',
      noon: '#1a1a2e',
      afternoon: '#1a1a2e',
      evening: '#1a1a3e',
      night: '#0d0d17',
    }
    this.cameras.main.setBackgroundColor(bgColors[clock.timeOfDay] ?? '#1a1a2e')
    this.updateAmbientOverlay(clock.timeOfDay)
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

    for (let ly = 0; ly < chunk.tiles.length; ly++) {
      for (let lx = 0; lx < chunk.tiles[ly].length; lx++) {
        const tile = chunk.tiles[ly][lx]
        const pos = this.tileToScreen(tile.position.x, tile.position.y)
        const depth = tile.position.x + tile.position.y

        // Texture selection: POI building > variant > base
        let textureKey: string
        if (tile.poiType) {
          textureKey = `building_${tile.poiType}`
          if (!this.textures.exists(textureKey)) textureKey = 'tile_building'
        } else {
          textureKey = `tile_${tile.type}_v${tile.variant ?? 0}`
          if (!this.textures.exists(textureKey)) textureKey = `tile_${tile.type}`
        }

        const sprite = this.add.image(pos.x, pos.y, textureKey)
          .setOrigin(0.5, 0.35)
          .setScale(TILE_SCALE)
          .setDepth(depth)
        tileSprites.push(sprite)

        // Decoration overlay
        if (tile.decoration && this.textures.exists(tile.decoration)) {
          const deco = this.add.image(pos.x, pos.y - 10, tile.decoration)
            .setOrigin(0.5, 0.5)
            .setScale(0.5)
            .setDepth(depth + 0.05)
          decoSprites.push(deco)
        }

        // Resource indicator
        if (tile.resource && tile.resource.amount >= 1) {
          const resKey = `resource_${tile.resource.type}`
          const hasTexture = this.textures.exists(resKey)
          const resSprite = this.add.image(
            pos.x,
            pos.y - TILE_H * 0.4,
            hasTexture ? resKey : 'resource_indicator',
          )
            .setOrigin(0.5, 0.5)
            .setScale(hasTexture ? RESOURCE_SCALE : 0.5)
            .setDepth(depth + 0.1)
            .setAlpha(0.75)
          resourceSprites.push(resSprite)

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

    this.renderedChunks.set(key, { tileSprites, decoSprites, resourceSprites })
  }

  private destroyRenderedChunk(rendered: RenderedChunk): void {
    for (const s of rendered.tileSprites) s.destroy()
    for (const s of rendered.decoSprites) s.destroy()
    for (const s of rendered.resourceSprites) s.destroy()
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

    const nameText = this.add.text(0, -22, agent.name, {
      fontSize: '10px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
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

  private updateAmbientOverlay(timeOfDay: string): void {
    if (!this.ambientOverlay) return

    const tints: Record<string, { color: number; alpha: number }> = {
      dawn: { color: 0xFF8844, alpha: 0.08 },
      morning: { color: 0xFFCC88, alpha: 0.03 },
      noon: { color: 0x000000, alpha: 0 },
      afternoon: { color: 0xFF9944, alpha: 0.04 },
      evening: { color: 0xFF6622, alpha: 0.1 },
      night: { color: 0x0000AA, alpha: 0.15 },
    }
    const tint = tints[timeOfDay] ?? { color: 0x000000, alpha: 0 }
    this.ambientOverlay.setFillStyle(tint.color, tint.alpha)
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

  /** Convert tile coordinates to isometric screen coordinates */
  private tileToScreen(x: number, y: number): { x: number; y: number } {
    return {
      x: (x - y) * (TILE_W / 2),
      y: (x + y) * (TILE_H / 2),
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
