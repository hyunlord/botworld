import Phaser from 'phaser'
import type { Agent, Tile, WorldEvent, WorldClock } from '@botworld/shared'

// Grid spacing must match rendered tile top-face size
const TILE_W = 128
const TILE_H = 64

// Scale factors for resized images (tiles 128x128, agents 64x96, icons 48x48)
const TILE_SCALE = 1.0
const AGENT_SCALE = 0.6
const RESOURCE_SCALE = 0.35

/**
 * Main isometric world scene.
 * Renders AI-generated tile sprites and agent characters in 2.5D projection.
 */
export class WorldScene extends Phaser.Scene {
  private tileSprites: Phaser.GameObjects.Image[][] = []
  private resourceSprites: Phaser.GameObjects.Image[] = []
  private agentSprites = new Map<string, Phaser.GameObjects.Container>()
  private actionIndicators = new Map<string, Phaser.GameObjects.Image>()
  private speechBubbles = new Map<string, { container: Phaser.GameObjects.Container; timer: number }>()
  private ambientOverlay: Phaser.GameObjects.Rectangle | null = null
  private selectionRing: Phaser.GameObjects.Image | null = null

  private worldData: { width: number; height: number; tiles: Tile[][] } | null = null
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

    // Scroll wheel zoom - proportional to deltaY for smooth trackpad support
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

  setWorldData(data: { width: number; height: number; tiles: Tile[][] }): void {
    this.worldData = data
    this.renderTiles()

    // Only center camera on first load
    if (!this.hasCentered) {
      this.hasCentered = true
      const centerX = (data.width / 2) * TILE_W / 2
      const centerY = (data.height / 2) * TILE_H / 2
      this.cameras.main.centerOn(centerX, centerY)
    }
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
      }
    }

    this.updateSelectionRing()
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

  private renderTiles(): void {
    if (!this.worldData) return

    for (const row of this.tileSprites) {
      for (const sprite of row) sprite.destroy()
    }
    this.tileSprites = []
    for (const rs of this.resourceSprites) rs.destroy()
    this.resourceSprites = []

    for (let y = 0; y < this.worldData.height; y++) {
      const row: Phaser.GameObjects.Image[] = []
      for (let x = 0; x < this.worldData.width; x++) {
        const tile = this.worldData.tiles[y][x]
        const pos = this.tileToScreen(x, y)
        const textureKey = `tile_${tile.type}`

        const sprite = this.add.image(pos.x, pos.y, textureKey)
          .setOrigin(0.5, 0.35)
          .setScale(TILE_SCALE)
          .setDepth(x + y)

        // Resource indicator with type-specific icon
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
            .setDepth(x + y + 0.1)
            .setAlpha(0.75)
          this.resourceSprites.push(resSprite)

          // Gentle floating animation
          this.tweens.add({
            targets: resSprite,
            y: resSprite.y - 2,
            duration: 1500 + Math.random() * 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          })
        }

        row.push(sprite)
      }
      this.tileSprites.push(row)
    }
  }

  private createAgentSprite(agent: Agent, screenPos: { x: number; y: number }): void {
    const index = this.agents.indexOf(agent)
    const textureKey = `agent_${index >= 0 && index < 5 ? index : 'default'}`

    // Shadow beneath agent
    const shadow = this.add.image(0, 6, 'agent_shadow')
      .setScale(0.7)
      .setAlpha(0.3)

    // Agent character sprite
    const sprite = this.add.image(0, 0, textureKey)
      .setOrigin(0.5, 0.7)
      .setScale(AGENT_SCALE)

    // Subtle breathing animation
    this.tweens.add({
      targets: sprite,
      scaleY: AGENT_SCALE * 1.015,
      duration: 1200 + Math.random() * 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // Name label
    const nameText = this.add.text(0, -22, agent.name, {
      fontSize: '10px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 1)

    // Current action text
    const actionText = this.add.text(0, 10, '', {
      fontSize: '8px',
      fontFamily: 'Arial, sans-serif',
      color: '#aabbcc',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 0)

    const container = this.add.container(
      screenPos.x,
      screenPos.y - TILE_H * 0.4,
      [shadow, sprite, nameText, actionText],
    )
    container.setDepth(500 + agent.position.y)
    container.setSize(30, 40)
    container.setInteractive()

    container.on('pointerdown', () => {
      this.selectedAgentId = agent.id
      this.events.emit('agent:selected', agent.id)
      this.updateSelectionRing()

      // Selection pop animation
      this.tweens.add({
        targets: sprite,
        scaleX: AGENT_SCALE * 1.15,
        scaleY: AGENT_SCALE * 1.15,
        duration: 100,
        yoyo: true,
      })
    })

    this.agentSprites.set(agent.id, container)
  }

  private updateActionIndicator(agent: Agent): void {
    const container = this.agentSprites.get(agent.id)
    if (!container || !container.list) return

    // Action text is the 4th child: [shadow, sprite, nameText, actionText]
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
    // Flash ring
    const flash = this.add.circle(x, y, 14, 0xFFFFAA, 0.5)
      .setDepth(3000)
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 2.5,
      duration: 400,
      onComplete: () => flash.destroy(),
    })

    // Floating resource icons
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
}
