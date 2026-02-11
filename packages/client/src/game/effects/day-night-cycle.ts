import Phaser from 'phaser'
import type { TimeOfDay, Position } from '@botworld/shared'

// ── Time-of-day visual configurations ──

interface TimeConfig {
  /** Overlay tint color */
  tint: number
  /** Overlay alpha (0 = no tint, higher = stronger) */
  alpha: number
  /** Background sky color */
  bgColor: string
  /** Whether building lights are on */
  lightsOn: boolean
  /** Star visibility (0-1) */
  starAlpha: number
  /** Agent torch glow radius (0 = off) */
  torchRadius: number
}

const TIME_CONFIGS: Record<TimeOfDay, TimeConfig> = {
  dawn: {
    tint: 0xFFD4A0,
    alpha: 0.12,
    bgColor: '#2a1a2e',
    lightsOn: false,
    starAlpha: 0,
    torchRadius: 0,
  },
  morning: {
    tint: 0xFFF8E8,
    alpha: 0.05,
    bgColor: '#1a2a3e',
    lightsOn: false,
    starAlpha: 0,
    torchRadius: 0,
  },
  noon: {
    tint: 0xFFFFFF,
    alpha: 0.0,
    bgColor: '#1a2a4e',
    lightsOn: false,
    starAlpha: 0,
    torchRadius: 0,
  },
  afternoon: {
    tint: 0xFFF0D0,
    alpha: 0.08,
    bgColor: '#1a2a3e',
    lightsOn: false,
    starAlpha: 0,
    torchRadius: 0,
  },
  evening: {
    tint: 0xFFB060,
    alpha: 0.15,
    bgColor: '#1a1a3e',
    lightsOn: true,
    starAlpha: 0,
    torchRadius: 40,
  },
  night: {
    tint: 0x405080,
    alpha: 0.30,
    bgColor: '#0d0d17',
    lightsOn: true,
    starAlpha: 1,
    torchRadius: 60,
  },
}

// ── Building light source ──

interface LightSource {
  worldX: number
  worldY: number
  glow: Phaser.GameObjects.Graphics
}

// ── DayNightCycle ──

export class DayNightCycle {
  private scene: Phaser.Scene
  private overlay: Phaser.GameObjects.Rectangle
  private currentTime: TimeOfDay = 'dawn'
  private transitioning = false

  // Stars
  private starGraphics: Phaser.GameObjects.Graphics
  private stars: { x: number; y: number; size: number; twinkleSpeed: number; phase: number }[] = []

  // Building lights
  private lightSources: Map<string, LightSource> = new Map()
  private lightOverlay: Phaser.GameObjects.Graphics

  // Agent torches
  private torchGraphics: Phaser.GameObjects.Graphics

  constructor(scene: Phaser.Scene) {
    this.scene = scene

    const cam = scene.cameras.main
    const w = cam.width * 3
    const h = cam.height * 3

    // Main tint overlay (scroll-fixed, above everything except UI)
    this.overlay = scene.add.rectangle(cam.width / 2, cam.height / 2, w, h, 0x000000, 0)
      .setScrollFactor(0)
      .setDepth(1500)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)

    // Star layer (scroll-fixed, behind overlay)
    this.starGraphics = scene.add.graphics()
      .setScrollFactor(0)
      .setDepth(1499)
    this.generateStars(cam.width, cam.height)

    // Light overlay for building glows (world-space, drawn on top of tiles)
    this.lightOverlay = scene.add.graphics()
      .setDepth(800)

    // Torch graphics for agent glows (world-space)
    this.torchGraphics = scene.add.graphics()
      .setDepth(850)
  }

  /** Call each frame or on clock update with the current timeOfDay and dayProgress */
  update(timeOfDay: TimeOfDay, dayProgress: number): void {
    if (timeOfDay !== this.currentTime && !this.transitioning) {
      this.transitionTo(timeOfDay)
    }

    // Animate stars
    this.updateStars(dayProgress)
  }

  /** Set building light positions (call when chunks change) */
  setBuildingLights(buildings: { key: string; screenX: number; screenY: number }[]): void {
    // Remove old lights that are no longer in view
    const newKeys = new Set(buildings.map(b => b.key))
    for (const [key, src] of this.lightSources) {
      if (!newKeys.has(key)) {
        src.glow.destroy()
        this.lightSources.delete(key)
      }
    }

    // Add new lights
    for (const b of buildings) {
      if (!this.lightSources.has(b.key)) {
        const glow = this.scene.add.graphics()
          .setDepth(799)
          .setAlpha(0)
        this.lightSources.set(b.key, {
          worldX: b.screenX,
          worldY: b.screenY,
          glow,
        })
      } else {
        const src = this.lightSources.get(b.key)!
        src.worldX = b.screenX
        src.worldY = b.screenY
      }
    }

    this.drawBuildingLights()
  }

  /** Draw agent torch glows (call each tick with agent screen positions) */
  drawAgentTorches(agents: { screenX: number; screenY: number }[]): void {
    this.torchGraphics.clear()

    const config = TIME_CONFIGS[this.currentTime]
    if (config.torchRadius <= 0) return

    for (const agent of agents) {
      const radius = config.torchRadius
      // Warm glow gradient (multiple concentric circles)
      this.torchGraphics.fillStyle(0xFFAA44, 0.06)
      this.torchGraphics.fillCircle(agent.screenX, agent.screenY, radius)
      this.torchGraphics.fillStyle(0xFFCC66, 0.08)
      this.torchGraphics.fillCircle(agent.screenX, agent.screenY, radius * 0.6)
      this.torchGraphics.fillStyle(0xFFDD88, 0.10)
      this.torchGraphics.fillCircle(agent.screenX, agent.screenY, radius * 0.3)
    }
  }

  /** Get the existing overlay (so world-scene doesn't create a duplicate) */
  getOverlay(): Phaser.GameObjects.Rectangle {
    return this.overlay
  }

  // ── Private ──

  private transitionTo(timeOfDay: TimeOfDay): void {
    this.transitioning = true
    const config = TIME_CONFIGS[timeOfDay]
    const prevTime = this.currentTime
    this.currentTime = timeOfDay

    // Smooth tint transition
    const tempObj = { alpha: this.overlay.alpha }
    this.scene.tweens.add({
      targets: tempObj,
      alpha: config.alpha,
      duration: 2000,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        this.overlay.setFillStyle(config.tint, tempObj.alpha)
      },
      onComplete: () => {
        this.transitioning = false
      },
    })

    // Background color transition
    this.scene.cameras.main.setBackgroundColor(config.bgColor)

    // Building lights toggle
    this.toggleBuildingLights(config.lightsOn)

    // Star fade
    this.scene.tweens.add({
      targets: this.starGraphics,
      alpha: config.starAlpha,
      duration: 3000,
      ease: 'Sine.easeInOut',
    })
  }

  private generateStars(viewW: number, viewH: number): void {
    const count = 120
    this.stars = []
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: Math.random() * viewW,
        y: Math.random() * viewH,
        size: 0.5 + Math.random() * 1.5,
        twinkleSpeed: 0.5 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2,
      })
    }
    this.starGraphics.setAlpha(0)
  }

  private updateStars(dayProgress: number): void {
    if (this.starGraphics.alpha < 0.01) return

    this.starGraphics.clear()
    const time = dayProgress * Math.PI * 2 * 10 // Cycle multiple times for twinkle speed

    for (const star of this.stars) {
      const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(time * star.twinkleSpeed + star.phase))
      this.starGraphics.fillStyle(0xFFFFFF, twinkle)
      this.starGraphics.fillCircle(star.x, star.y, star.size)
    }
  }

  private drawBuildingLights(): void {
    const config = TIME_CONFIGS[this.currentTime]

    for (const [, src] of this.lightSources) {
      src.glow.clear()

      if (!config.lightsOn) continue

      const radius = 80
      // Warm building glow
      src.glow.fillStyle(0xFFBB55, 0.04)
      src.glow.fillCircle(src.worldX, src.worldY, radius)
      src.glow.fillStyle(0xFFCC77, 0.06)
      src.glow.fillCircle(src.worldX, src.worldY, radius * 0.6)
      src.glow.fillStyle(0xFFDD99, 0.08)
      src.glow.fillCircle(src.worldX, src.worldY, radius * 0.3)
      // Window light (small bright center)
      src.glow.fillStyle(0xFFEEAA, 0.15)
      src.glow.fillCircle(src.worldX, src.worldY - 10, radius * 0.12)
    }
  }

  private toggleBuildingLights(on: boolean): void {
    for (const [, src] of this.lightSources) {
      this.scene.tweens.add({
        targets: src.glow,
        alpha: on ? 1 : 0,
        duration: 2000,
        ease: 'Sine.easeInOut',
      })
    }
    if (on) this.drawBuildingLights()
  }

  destroy(): void {
    this.overlay.destroy()
    this.starGraphics.destroy()
    this.lightOverlay.destroy()
    this.torchGraphics.destroy()
    for (const [, src] of this.lightSources) {
      src.glow.destroy()
    }
    this.lightSources.clear()
  }
}
