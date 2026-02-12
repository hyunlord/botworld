import Phaser from 'phaser'
import type { TimeOfDay } from '@botworld/shared'

/**
 * Post-processing effects using Phaser camera postFX.
 * Adds vignette, bloom, and time-of-day color grading for cinematic atmosphere.
 * Gracefully degrades if WebGL postFX is not available.
 */

interface ColorGradeConfig {
  /** Vignette strength (0=none, 1=strong) */
  vignetteStrength: number
  /** Bloom intensity */
  bloomStrength: number
  /** Color shift (tint applied to bloom) */
  bloomColor: number
}

const TIME_COLOR_GRADES: Record<TimeOfDay, ColorGradeConfig> = {
  dawn: {
    vignetteStrength: 0.2,
    bloomStrength: 0.5,
    bloomColor: 0xFFD4A0,
  },
  morning: {
    vignetteStrength: 0.15,
    bloomStrength: 0.3,
    bloomColor: 0xFFF8E8,
  },
  noon: {
    vignetteStrength: 0.1,
    bloomStrength: 0.2,
    bloomColor: 0xFFFFFF,
  },
  afternoon: {
    vignetteStrength: 0.15,
    bloomStrength: 0.4,
    bloomColor: 0xFFF0D0,
  },
  evening: {
    vignetteStrength: 0.3,
    bloomStrength: 0.7,
    bloomColor: 0xFFB060,
  },
  night: {
    vignetteStrength: 0.4,
    bloomStrength: 0.3,
    bloomColor: 0x405080,
  },
}

export class PostProcessing {
  private scene: Phaser.Scene
  private hasPostFX = false
  private vignetteFX: any = null
  private bloomFX: any = null
  private currentTime: TimeOfDay = 'noon'
  private targetConfig: ColorGradeConfig = TIME_COLOR_GRADES.noon
  private currentVignetteStrength = 0.2
  private currentBloomStrength = 0.3
  private lerpSpeed = 0.02

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.tryInitPostFX()
  }

  private tryInitPostFX(): void {
    const cam = this.scene.cameras.main

    // Check if postFX is available (WebGL renderer only)
    try {
      if (cam.postFX) {
        // Vignette: subtle edge darkening
        this.vignetteFX = cam.postFX.addVignette(0.5, 0.5, 0.3, 0.2)

        // Bloom: glow on bright areas
        this.bloomFX = cam.postFX.addBloom(0xffffff, 1, 1, 0.3, 1.2)

        this.hasPostFX = true
      }
    } catch {
      // Canvas renderer — no postFX support, gracefully degrade
      this.hasPostFX = false
    }
  }

  /** Update time of day to transition color grading */
  setTimeOfDay(time: TimeOfDay): void {
    if (time === this.currentTime) return
    this.currentTime = time
    this.targetConfig = TIME_COLOR_GRADES[time]
  }

  /** Called every frame — smoothly interpolates postFX parameters */
  update(): void {
    if (!this.hasPostFX) return

    // Lerp vignette
    this.currentVignetteStrength += (this.targetConfig.vignetteStrength - this.currentVignetteStrength) * this.lerpSpeed
    if (this.vignetteFX) {
      this.vignetteFX.strength = this.currentVignetteStrength
    }

    // Lerp bloom
    this.currentBloomStrength += (this.targetConfig.bloomStrength - this.currentBloomStrength) * this.lerpSpeed
    if (this.bloomFX) {
      this.bloomFX.strength = this.currentBloomStrength
    }
  }

  /** Check if post-processing is active */
  isActive(): boolean {
    return this.hasPostFX
  }

  destroy(): void {
    if (this.hasPostFX) {
      const cam = this.scene.cameras.main
      if (cam.postFX) {
        cam.postFX.clear()
      }
    }
  }
}
