import Phaser from 'phaser'
import type { ShadowConfig } from './day-night-cycle.js'

/**
 * Renders time-of-day-aware elliptical shadows under objects and characters.
 * Shadow direction and length change smoothly based on time of day config
 * from DayNightCycle.getShadowConfig().
 */

interface ShadowEntry {
  /** Unique key for deduplication */
  key: string
  /** World-space screen X */
  screenX: number
  /** World-space screen Y (bottom of sprite) */
  screenY: number
  /** Base shadow width (depends on object size) */
  width: number
  /** Base shadow height (half of width for ellipse) */
  height: number
  /** Iso depth for ordering */
  depth: number
}

export class ShadowSystem {
  private scene: Phaser.Scene
  private graphics: Phaser.GameObjects.Graphics
  private currentConfig: ShadowConfig = { angle: 0, scale: 0.5, alpha: 0.25 }
  private targetConfig: ShadowConfig = { angle: 0, scale: 0.5, alpha: 0.25 }
  private lerpSpeed = 0.03 // Smooth interpolation per frame

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    // World-space graphics, just above ground tiles but below objects
    this.graphics = scene.add.graphics()
      .setDepth(0.5)
  }

  /** Update shadow config target (call when time-of-day changes) */
  setConfig(config: ShadowConfig): void {
    this.targetConfig = config
  }

  /** Called every frame — interpolates toward target config */
  update(): void {
    // Smooth lerp toward target
    this.currentConfig.angle += (this.targetConfig.angle - this.currentConfig.angle) * this.lerpSpeed
    this.currentConfig.scale += (this.targetConfig.scale - this.currentConfig.scale) * this.lerpSpeed
    this.currentConfig.alpha += (this.targetConfig.alpha - this.currentConfig.alpha) * this.lerpSpeed
  }

  /**
   * Draw shadows for a batch of objects/buildings.
   * Call once per frame after update(), passing all visible shadow-casting objects.
   */
  draw(entries: ShadowEntry[]): void {
    this.graphics.clear()

    const { angle, scale, alpha } = this.currentConfig
    if (alpha < 0.01) return

    // Shadow offset from angle
    const offsetX = Math.sin(angle) * 8 * scale
    const offsetY = 4 * scale

    this.graphics.fillStyle(0x000000, alpha)

    for (const entry of entries) {
      const sx = entry.screenX + offsetX
      const sy = entry.screenY + offsetY
      const w = entry.width * (0.6 + scale * 0.4)
      const h = entry.height * (0.3 + scale * 0.2)

      // Draw ellipse using arc
      this.graphics.beginPath()
      this.graphics.arc(sx, sy, w / 2, 0, Math.PI * 2, false, 0.02)
      // Scale Y to make ellipse
      // Since Graphics doesn't have native ellipse fill, use multiple overlapping circles
      this.graphics.closePath()
    }

    // More efficient: draw all shadows as scaled ellipses
    this.graphics.clear()
    for (const entry of entries) {
      const sx = entry.screenX + offsetX
      const sy = entry.screenY + offsetY
      const hw = (entry.width * (0.6 + scale * 0.4)) / 2
      const hh = (entry.height * (0.3 + scale * 0.2)) / 2

      // Approximate ellipse with 3 overlapping circles (fast, looks good at small sizes)
      this.graphics.fillStyle(0x000000, alpha * 0.5)
      this.graphics.fillEllipse(sx, sy, hw * 2, hh * 2)
    }
  }

  /**
   * Draw a single dynamic shadow (for agents that move frequently).
   * Uses the same config but called per-agent.
   */
  drawAgentShadow(screenX: number, screenY: number, depth: number): void {
    const { angle, scale, alpha } = this.currentConfig
    if (alpha < 0.01) return

    const offsetX = Math.sin(angle) * 6 * scale
    const offsetY = 3 * scale
    const w = 20 * (0.6 + scale * 0.3)
    const h = 10 * (0.4 + scale * 0.2)

    this.graphics.fillStyle(0x000000, alpha * 0.6)
    this.graphics.fillEllipse(screenX + offsetX, screenY + offsetY + 12, w, h)
  }

  destroy(): void {
    this.graphics.destroy()
  }
}
