import Phaser from 'phaser'
import type { Agent, Tile, WorldEvent, WorldClock } from '@botworld/shared'

const TILE_W = 32
const TILE_H = 16

const ACTION_ICONS: Record<string, string> = {
  gather: 'action_gather',
  talk: 'action_talk',
  craft: 'action_craft',
  rest: 'action_rest',
  trade: 'action_trade',
}

/**
 * Main isometric world scene.
 * Renders tiles and agents in 2.5D isometric projection.
 */
export class WorldScene extends Phaser.Scene {
  private tileSprites: Phaser.GameObjects.Image[][] = []
  private agentSprites = new Map<string, Phaser.GameObjects.Container>()
  private actionIndicators = new Map<string, Phaser.GameObjects.Image>()
  private speechBubbles = new Map<string, { container: Phaser.GameObjects.Container; timer: number }>()

  private worldData: { width: number; height: number; tiles: Tile[][] } | null = null
  private agents: Agent[] = []
  private clock: WorldClock | null = null
  private selectedAgentId: string | null = null

  constructor() {
    super({ key: 'WorldScene' })
  }

  create(): void {
    // Camera setup
    this.cameras.main.setZoom(2)
    this.input.on('wheel', (_p: unknown, _gx: unknown, _gy: unknown, _gz: unknown, deltaY: number) => {
      const cam = this.cameras.main
      cam.setZoom(Phaser.Math.Clamp(cam.zoom + (deltaY > 0 ? -0.1 : 0.1), 0.5, 4))
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
    const centerX = (data.width / 2) * TILE_W / 2
    const centerY = (data.height / 2) * TILE_H / 2
    this.cameras.main.centerOn(centerX, centerY)
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
          y: screenPos.y - 12,
          duration: 300,
          ease: 'Linear',
        })
      }

      // Update action indicator
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
  }

  showSpeechBubble(agentId: string, message: string): void {
    const existing = this.speechBubbles.get(agentId)
    if (existing) {
      existing.container.destroy()
    }

    const sprite = this.agentSprites.get(agentId)
    if (!sprite) return

    // Styled speech bubble
    const isPlan = message.startsWith('[Plan]')
    const bgColor = isPlan ? '#2d5016' : '#333333'
    const displayMsg = isPlan ? message.slice(7).trim() : message

    const text = this.add.text(0, -28, displayMsg.slice(0, 80), {
      fontSize: '7px',
      color: '#ffffff',
      backgroundColor: bgColor + 'dd',
      padding: { x: 4, y: 3 },
      wordWrap: { width: 140 },
    }).setOrigin(0.5, 1)

    // Small triangle pointer
    const pointer = this.add.graphics()
    pointer.fillStyle(isPlan ? 0x2d5016 : 0x333333, 0.87)
    pointer.fillTriangle(-3, -1, 3, -1, 0, 3)

    const container = this.add.container(sprite.x, sprite.y - 4, [text, pointer])
    container.setDepth(2000)

    this.speechBubbles.set(agentId, {
      container,
      timer: this.time.now + 6000,
    })

    this.time.delayedCall(6000, () => {
      const bubble = this.speechBubbles.get(agentId)
      if (bubble) {
        bubble.container.destroy()
        this.speechBubbles.delete(agentId)
      }
    })
  }

  handleEvent(event: WorldEvent): void {
    switch (event.type) {
      case 'agent:spoke':
        this.showSpeechBubble(event.agentId, event.message)
        break
      case 'agent:moved': {
        const sprite = this.agentSprites.get(event.agentId)
        if (sprite) {
          const pos = this.tileToScreen(event.to.x, event.to.y)
          this.tweens.add({
            targets: sprite,
            x: pos.x,
            y: pos.y - 12,
            duration: 500,
            ease: 'Linear',
          })
        }
        break
      }
      case 'resource:gathered': {
        // Sparkle effect at gather position
        const gatherPos = this.tileToScreen(event.position.x, event.position.y)
        this.showGatherEffect(gatherPos.x, gatherPos.y)
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

    for (let y = 0; y < this.worldData.height; y++) {
      const row: Phaser.GameObjects.Image[] = []
      for (let x = 0; x < this.worldData.width; x++) {
        const tile = this.worldData.tiles[y][x]
        const pos = this.tileToScreen(x, y)
        const textureKey = `tile_${tile.type}`

        const sprite = this.add.image(pos.x, pos.y, textureKey)
          .setOrigin(0.5, 0.5)
          .setDepth(y)

        if (tile.resource && tile.resource.amount > 0) {
          this.add.image(pos.x, pos.y - 4, 'resource_indicator')
            .setOrigin(0.5, 0.5)
            .setDepth(y + 0.1)
        }

        row.push(sprite)
      }
      this.tileSprites.push(row)
    }
  }

  private createAgentSprite(agent: Agent, screenPos: { x: number; y: number }): void {
    const index = this.agents.indexOf(agent)
    const textureKey = `agent_${index >= 0 && index < 5 ? index : 'default'}`

    const sprite = this.add.image(0, 0, textureKey).setOrigin(0.5, 1)

    const nameText = this.add.text(0, -24, agent.name, {
      fontSize: '7px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 1)

    // Action text (shows current action type)
    const actionText = this.add.text(0, 4, '', {
      fontSize: '6px',
      color: '#aabbcc',
      stroke: '#000000',
      strokeThickness: 1,
    }).setOrigin(0.5, 0)

    const container = this.add.container(screenPos.x, screenPos.y - 12, [sprite, nameText, actionText])
    container.setDepth(500 + agent.position.y)
    container.setSize(16, 24)
    container.setInteractive()

    container.on('pointerdown', () => {
      this.selectedAgentId = agent.id
      this.events.emit('agent:selected', agent.id)

      // Selection highlight effect
      this.tweens.add({
        targets: sprite,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 100,
        yoyo: true,
      })
    })

    this.agentSprites.set(agent.id, container)
  }

  private updateActionIndicator(agent: Agent): void {
    const container = this.agentSprites.get(agent.id)
    if (!container || !container.list) return

    // Update the action text (third child in container)
    const actionText = container.list[2] as Phaser.GameObjects.Text | undefined
    if (actionText && 'setText' in actionText) {
      const actionType = agent.currentAction?.type ?? 'idle'
      const display = actionType === 'idle' ? '' : actionType
      actionText.setText(display)
    }
  }

  private showGatherEffect(x: number, y: number): void {
    // Simple sparkle particles
    for (let i = 0; i < 3; i++) {
      const sparkle = this.add.image(
        x + Phaser.Math.Between(-6, 6),
        y + Phaser.Math.Between(-8, 0),
        'resource_indicator',
      ).setDepth(3000).setScale(0.5).setAlpha(1)

      this.tweens.add({
        targets: sparkle,
        y: sparkle.y - 10,
        alpha: 0,
        scale: 0,
        duration: 600 + i * 100,
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
