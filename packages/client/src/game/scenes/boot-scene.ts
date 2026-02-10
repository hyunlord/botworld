import Phaser from 'phaser'

const TILE_SIZE = 32

/** Color palette for tile types */
const TILE_COLORS: Record<string, { fill: number; top: number; shadow: number }> = {
  grass: { fill: 0x4a7c59, top: 0x5a9c69, shadow: 0x3a6c49 },
  water: { fill: 0x3498db, top: 0x5dade2, shadow: 0x2980b9 },
  mountain: { fill: 0x7f8c8d, top: 0x95a5a6, shadow: 0x6a7a7b },
  forest: { fill: 0x2d5016, top: 0x3d7026, shadow: 0x1d4006 },
  sand: { fill: 0xf0d9b5, top: 0xf5e6cc, shadow: 0xe0c9a5 },
  road: { fill: 0x8b7355, top: 0x9b8365, shadow: 0x7b6345 },
  building: { fill: 0x8b4513, top: 0xad6833, shadow: 0x6b2503 },
  farmland: { fill: 0xc4a747, top: 0xd4b757, shadow: 0xb49737 },
}

/** Agent color palette */
const AGENT_COLORS = [
  { body: 0xe74c3c, skin: 0xfadbd8, hair: 0x922b21 }, // Aria
  { body: 0x3498db, skin: 0xd6eaf8, hair: 0x1b4f72 }, // Bolt
  { body: 0xf39c12, skin: 0xfdebd0, hair: 0x935116 }, // Cleo
  { body: 0x9b59b6, skin: 0xe8daef, hair: 0x6c3483 }, // Drake
  { body: 0x1abc9c, skin: 0xd1f2eb, hair: 0x0e6655 }, // Echo
]

/**
 * Boot scene: generates isometric tile textures and humanoid agent sprites.
 * Enhanced visuals with depth, shadows, and character details.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  create(): void {
    // Generate tile textures with depth
    for (const [type, colors] of Object.entries(TILE_COLORS)) {
      this.generateTileTexture(`tile_${type}`, colors)
    }

    // Generate humanoid agent sprites
    this.generateAgentTexture('agent_default', AGENT_COLORS[0])
    for (let i = 0; i < AGENT_COLORS.length; i++) {
      this.generateAgentTexture(`agent_${i}`, AGENT_COLORS[i])
    }

    // Generate action indicators
    this.generateActionIndicators()

    // Generate resource indicator
    this.generateResourceTexture()

    // Generate shadow texture
    this.generateShadowTexture()

    this.scene.start('WorldScene')
  }

  private generateTileTexture(key: string, colors: { fill: number; top: number; shadow: number }): void {
    const g = this.add.graphics()
    const w = TILE_SIZE
    const h = TILE_SIZE / 2
    const depth = 4 // Tile thickness

    // Side face (shadow/depth)
    g.fillStyle(colors.shadow, 1)
    g.beginPath()
    g.moveTo(w / 2, h)
    g.lineTo(w, h / 2)
    g.lineTo(w, h / 2 + depth)
    g.lineTo(w / 2, h + depth)
    g.closePath()
    g.fillPath()

    g.fillStyle(colors.shadow, 0.7)
    g.beginPath()
    g.moveTo(0, h / 2)
    g.lineTo(w / 2, h)
    g.lineTo(w / 2, h + depth)
    g.lineTo(0, h / 2 + depth)
    g.closePath()
    g.fillPath()

    // Top face
    g.fillStyle(colors.top, 1)
    g.beginPath()
    g.moveTo(w / 2, 0)
    g.lineTo(w, h / 2)
    g.lineTo(w / 2, h)
    g.lineTo(0, h / 2)
    g.closePath()
    g.fillPath()

    // Subtle grid line
    g.lineStyle(1, 0x000000, 0.15)
    g.beginPath()
    g.moveTo(w / 2, 0)
    g.lineTo(w, h / 2)
    g.lineTo(w / 2, h)
    g.lineTo(0, h / 2)
    g.closePath()
    g.strokePath()

    g.generateTexture(key, w, h + depth)
    g.destroy()
  }

  private generateAgentTexture(key: string, colors: { body: number; skin: number; hair: number }): void {
    const g = this.add.graphics()
    const w = 16
    const h = 24

    // Shadow (ellipse at feet)
    g.fillStyle(0x000000, 0.2)
    g.fillEllipse(w / 2, h - 2, 12, 4)

    // Body (rounded rectangle)
    g.fillStyle(colors.body, 1)
    g.fillRoundedRect(w / 2 - 4, h - 14, 8, 10, 2)

    // Arms
    g.fillStyle(colors.body, 0.9)
    g.fillRoundedRect(w / 2 - 6, h - 12, 3, 7, 1)
    g.fillRoundedRect(w / 2 + 3, h - 12, 3, 7, 1)

    // Head (circle)
    g.fillStyle(colors.skin, 1)
    g.fillCircle(w / 2, h - 17, 4)

    // Hair (top half of head)
    g.fillStyle(colors.hair, 1)
    g.beginPath()
    g.arc(w / 2, h - 17, 4, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(360))
    g.closePath()
    g.fillPath()

    // Eyes
    g.fillStyle(0x2c3e50, 1)
    g.fillCircle(w / 2 - 1.5, h - 17, 0.8)
    g.fillCircle(w / 2 + 1.5, h - 17, 0.8)

    // Legs
    g.fillStyle(0x2c3e50, 1)
    g.fillRect(w / 2 - 3, h - 4, 2, 4)
    g.fillRect(w / 2 + 1, h - 4, 2, 4)

    g.generateTexture(key, w, h)
    g.destroy()
  }

  private generateActionIndicators(): void {
    // Gather indicator (pickaxe)
    this.generateIconTexture('action_gather', (g, cx, cy) => {
      g.fillStyle(0xf1c40f, 1)
      g.fillCircle(cx, cy, 5)
      g.fillStyle(0x8b4513, 1)
      g.fillRect(cx - 1, cy - 3, 2, 6)
    })

    // Talk indicator (speech icon)
    this.generateIconTexture('action_talk', (g, cx, cy) => {
      g.fillStyle(0x3498db, 1)
      g.fillRoundedRect(cx - 5, cy - 4, 10, 7, 2)
      g.fillTriangle(cx - 2, cy + 3, cx + 2, cy + 3, cx, cy + 6)
    })

    // Craft indicator (hammer)
    this.generateIconTexture('action_craft', (g, cx, cy) => {
      g.fillStyle(0xe67e22, 1)
      g.fillCircle(cx, cy, 5)
      g.fillStyle(0x7f8c8d, 1)
      g.fillRect(cx - 1, cy - 3, 2, 4)
    })

    // Rest indicator (zzz)
    this.generateIconTexture('action_rest', (g, cx, cy) => {
      g.fillStyle(0x9b59b6, 0.8)
      g.fillCircle(cx, cy, 5)
    })

    // Trade indicator
    this.generateIconTexture('action_trade', (g, cx, cy) => {
      g.fillStyle(0x2ecc71, 1)
      g.fillCircle(cx, cy, 5)
    })
  }

  private generateIconTexture(key: string, draw: (g: Phaser.GameObjects.Graphics, cx: number, cy: number) => void): void {
    const g = this.add.graphics()
    const size = 12
    draw(g, size / 2, size / 2)
    g.generateTexture(key, size, size)
    g.destroy()
  }

  private generateResourceTexture(): void {
    const g = this.add.graphics()
    // Sparkle/gem shape
    g.fillStyle(0xf1c40f, 0.9)
    g.beginPath()
    g.moveTo(4, 0)
    g.lineTo(7, 4)
    g.lineTo(4, 8)
    g.lineTo(1, 4)
    g.closePath()
    g.fillPath()
    g.fillStyle(0xf7dc6f, 0.6)
    g.fillTriangle(4, 0, 5.5, 4, 4, 4)
    g.generateTexture('resource_indicator', 8, 8)
    g.destroy()
  }

  private generateShadowTexture(): void {
    const g = this.add.graphics()
    g.fillStyle(0x000000, 0.15)
    g.fillEllipse(8, 4, 14, 6)
    g.generateTexture('agent_shadow', 16, 8)
    g.destroy()
  }
}
