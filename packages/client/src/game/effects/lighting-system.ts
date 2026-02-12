import Phaser from 'phaser'
import type { TimeOfDay } from '@botworld/shared'

/**
 * Dynamic lighting using RenderTexture + ERASE blend mode.
 *
 * Each frame:
 * 1. Fill RT with ambient darkness color
 * 2. ERASE light circles at each light source position (light punches through darkness)
 * 3. Display RT with MULTIPLY blend mode over the scene
 *
 * This creates dramatic night scenes where only light sources illuminate the world.
 */

// ── Light source types ──

export type LightType = 'window' | 'campfire' | 'torch' | 'lantern' | 'crystal' | 'magic'

export interface LightSource {
  id: string
  worldX: number
  worldY: number
  type: LightType
  radius: number
  color: number
  /** Intensity 0-1 */
  intensity: number
  /** Whether this light flickers */
  flicker: boolean
  /** Only active at certain times */
  activeTime?: 'evening_night' | 'night_only' | 'always'
}

// ── Ambient configs per time of day ──

interface AmbientConfig {
  /** Fill color for darkness overlay */
  color: number
  /** Fill alpha (0=full bright, 1=full dark) */
  alpha: number
  /** Whether lights should be active */
  lightsActive: boolean
}

// NOTE: DayNightCycle already provides base ambient darkness via its own MULTIPLY overlay.
// This system ONLY adds the light-punching-through-darkness effect at evening/night.
// Daytime alphas must be 0 to avoid double-darkening.
const AMBIENT_CONFIGS: Record<TimeOfDay, AmbientConfig> = {
  dawn:      { color: 0x000000, alpha: 0.0, lightsActive: false },
  morning:   { color: 0x000000, alpha: 0.0, lightsActive: false },
  noon:      { color: 0x000000, alpha: 0.0, lightsActive: false },
  afternoon: { color: 0x000000, alpha: 0.0, lightsActive: false },
  evening:   { color: 0x181018, alpha: 0.04, lightsActive: true },
  night:     { color: 0x080818, alpha: 0.12, lightsActive: true },
}

// ── Light type defaults ──

const LIGHT_DEFAULTS: Record<LightType, { radius: number; color: number; flicker: boolean; activeTime: string }> = {
  window:   { radius: 40,  color: 0xFFBB55, flicker: false, activeTime: 'evening_night' },
  campfire: { radius: 60,  color: 0xFFAA33, flicker: true,  activeTime: 'always' },
  torch:    { radius: 50,  color: 0xFFCC44, flicker: true,  activeTime: 'evening_night' },
  lantern:  { radius: 30,  color: 0xFFDD88, flicker: false, activeTime: 'night_only' },
  crystal:  { radius: 35,  color: 0x8866FF, flicker: false, activeTime: 'always' },
  magic:    { radius: 80,  color: 0xFFFFFF, flicker: false, activeTime: 'always' },
}

const LIGHT_GRADIENT_KEY = '__light_gradient__'
const LIGHT_GRADIENT_SIZE = 128

export class LightingSystem {
  private scene: Phaser.Scene
  private rt: Phaser.GameObjects.RenderTexture | null = null
  private rtImage: Phaser.GameObjects.Image | null = null
  private lightStamp: Phaser.GameObjects.Image | null = null
  private lightSources: Map<string, LightSource> = new Map()
  private currentTime: TimeOfDay = 'noon'
  private targetConfig: AmbientConfig = AMBIENT_CONFIGS.noon
  private currentAlpha = 0
  private lerpSpeed = 0.015 // Smooth transition
  private frameCount = 0
  private enabled = true

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.createLightGradient()
    this.createRenderTexture()
  }

  /** Generate a radial gradient texture for light circles */
  private createLightGradient(): void {
    if (this.scene.textures.exists(LIGHT_GRADIENT_KEY)) return

    const size = LIGHT_GRADIENT_SIZE
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!

    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)')
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)')
    gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.3)')
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0.0)')

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)

    this.scene.textures.addCanvas(LIGHT_GRADIENT_KEY, canvas)
  }

  /** Create the RenderTexture and its display image */
  private createRenderTexture(): void {
    const cam = this.scene.cameras.main
    const w = cam.width
    const h = cam.height

    this.rt = this.scene.add.renderTexture(0, 0, w, h)
      .setVisible(false) // We render via an Image instead

    this.rtImage = this.scene.add.image(cam.width / 2, cam.height / 2, this.rt.texture)
      .setScrollFactor(0)
      .setDepth(1500)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
      .setOrigin(0.5)

    // Reusable stamp image for scaled light erasing
    this.lightStamp = this.scene.add.image(0, 0, LIGHT_GRADIENT_KEY)
      .setVisible(false)
  }

  /** Update time of day */
  setTimeOfDay(time: TimeOfDay): void {
    if (time === this.currentTime) return
    this.currentTime = time
    this.targetConfig = AMBIENT_CONFIGS[time]
  }

  /** Add or update a light source */
  addLight(id: string, worldX: number, worldY: number, type: LightType, intensity = 1.0): void {
    const defaults = LIGHT_DEFAULTS[type]
    this.lightSources.set(id, {
      id,
      worldX,
      worldY,
      type,
      radius: defaults.radius,
      color: defaults.color,
      intensity,
      flicker: defaults.flicker,
      activeTime: defaults.activeTime as LightSource['activeTime'],
    })
  }

  /** Remove a light source */
  removeLight(id: string): void {
    this.lightSources.delete(id)
  }

  /** Update light position (for moving lights like lanterns) */
  updateLightPosition(id: string, worldX: number, worldY: number): void {
    const light = this.lightSources.get(id)
    if (light) {
      light.worldX = worldX
      light.worldY = worldY
    }
  }

  /** Clear all lights (e.g., when chunks reload) */
  clearLights(): void {
    this.lightSources.clear()
  }

  /** Called every frame */
  update(): void {
    if (!this.rt || !this.rtImage || !this.enabled) return

    this.frameCount++

    // Lerp alpha toward target
    this.currentAlpha += (this.targetConfig.alpha - this.currentAlpha) * this.lerpSpeed

    // Skip rendering if barely visible (daytime optimization)
    if (this.currentAlpha < 0.02) {
      this.rtImage.setAlpha(0)
      return
    }

    this.rtImage.setAlpha(1)

    const cam = this.scene.cameras.main

    // Resize RT if camera changed
    if (this.rt.width !== cam.width || this.rt.height !== cam.height) {
      this.rt.resize(cam.width, cam.height)
      this.rtImage.setPosition(cam.width / 2, cam.height / 2)
    }

    // Step 1: Fill with ambient darkness
    this.rt.fill(
      (this.targetConfig.color >> 16) & 0xFF,
      (this.targetConfig.color >> 8) & 0xFF,
      this.targetConfig.color & 0xFF,
      this.currentAlpha,
    )

    // Step 2: Erase light circles (light punches through darkness)
    if (this.targetConfig.lightsActive || this.currentAlpha > 0.15) {
      for (const light of this.lightSources.values()) {
        if (!this.isLightActive(light)) continue

        // Convert world position to screen position
        const screenX = light.worldX - cam.scrollX
        const screenY = light.worldY - cam.scrollY

        // Skip lights outside viewport (with margin)
        if (screenX < -light.radius || screenX > cam.width + light.radius ||
            screenY < -light.radius || screenY > cam.height + light.radius) {
          continue
        }

        // Flicker effect
        let intensity = light.intensity
        if (light.flicker) {
          const flicker = 0.85 + 0.15 * Math.sin(this.frameCount * 0.15 + light.worldX * 0.1)
          intensity *= flicker
        }

        // Scale the gradient texture to match light radius
        const scale = (light.radius * 2) / LIGHT_GRADIENT_SIZE

        if (this.lightStamp) {
          this.lightStamp.setScale(scale)
          this.lightStamp.setAlpha(intensity)
          this.rt.erase(this.lightStamp, screenX - light.radius, screenY - light.radius)
        }
      }
    }
  }

  /** Check if a light should be active at the current time */
  private isLightActive(light: LightSource): boolean {
    switch (light.activeTime) {
      case 'always':
        return true
      case 'evening_night':
        return this.currentTime === 'evening' || this.currentTime === 'night'
      case 'night_only':
        return this.currentTime === 'night'
      default:
        return this.targetConfig.lightsActive
    }
  }

  /** Enable/disable the lighting system */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (this.rtImage) {
      this.rtImage.setVisible(enabled)
    }
  }

  destroy(): void {
    this.rt?.destroy()
    this.rtImage?.destroy()
    this.lightStamp?.destroy()
    this.lightSources.clear()
  }
}
