import Phaser from 'phaser'
import type { WeatherType, WeatherState } from '@botworld/shared'

/**
 * Client-side weather visual effects using Phaser particle system and overlays.
 * Manages rain, storm, snow, fog, and cloudy effects with smooth transitions.
 */
export class WeatherEffects {
  private scene: Phaser.Scene
  private currentWeather: WeatherType = 'clear'

  // Particle textures (generated procedurally)
  private rainKey = 'weather_rain_drop'
  private snowKey = 'weather_snow_dot'

  // Active effects
  private rainEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null
  private snowEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null
  private fogOverlay: Phaser.GameObjects.Rectangle | null = null
  private cloudShadow: Phaser.GameObjects.Ellipse | null = null
  private weatherTintOverlay: Phaser.GameObjects.Rectangle | null = null
  private lightningTimer: Phaser.Time.TimerEvent | null = null
  private lightningFlash: Phaser.GameObjects.Rectangle | null = null
  private cloudTween: Phaser.Tweens.Tween | null = null

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.createTextures()
    this.createOverlays()
  }

  /** Generate procedural particle textures */
  private createTextures(): void {
    // Rain drop: thin blue line
    if (!this.scene.textures.exists(this.rainKey)) {
      const rainGfx = this.scene.add.graphics()
      rainGfx.lineStyle(1.5, 0x88aadd, 0.6)
      rainGfx.lineBetween(0, 0, 2, 8)
      rainGfx.generateTexture(this.rainKey, 4, 10)
      rainGfx.destroy()
    }

    // Snow dot: small white circle
    if (!this.scene.textures.exists(this.snowKey)) {
      const snowGfx = this.scene.add.graphics()
      snowGfx.fillStyle(0xffffff, 0.9)
      snowGfx.fillCircle(3, 3, 3)
      snowGfx.generateTexture(this.snowKey, 6, 6)
      snowGfx.destroy()
    }
  }

  /** Create persistent overlay elements */
  private createOverlays(): void {
    const { width, height } = this.scene.cameras.main

    // Weather tint overlay (cloudy darkening, etc.)
    this.weatherTintOverlay = this.scene.add.rectangle(
      width / 2, height / 2,
      width * 3, height * 3,
      0x000000, 0,
    )
      .setScrollFactor(0)
      .setDepth(1400)

    // Fog overlay
    this.fogOverlay = this.scene.add.rectangle(
      width / 2, height / 2,
      width * 3, height * 3,
      0xcccccc, 0,
    )
      .setScrollFactor(0)
      .setDepth(1450)

    // Lightning flash
    this.lightningFlash = this.scene.add.rectangle(
      width / 2, height / 2,
      width * 3, height * 3,
      0xffffff, 0,
    )
      .setScrollFactor(0)
      .setDepth(1600)

    // Cloud shadow (ellipse that moves across the map)
    this.cloudShadow = this.scene.add.ellipse(0, 0, 300, 150, 0x000000, 0)
      .setDepth(5)
  }

  /** Update weather visuals to match server state */
  setWeather(state: WeatherState): void {
    if (state.current === this.currentWeather) return
    this.transitionTo(state.current, state.windIntensity)
  }

  /** Transition from current weather to new weather */
  private transitionTo(weather: WeatherType, windIntensity: number): void {
    // Clean up all current effects
    this.clearAllEffects()
    this.currentWeather = weather

    switch (weather) {
      case 'clear':
        this.applyClear()
        break
      case 'cloudy':
        this.applyCloudy()
        break
      case 'rain':
        this.applyRain(windIntensity)
        break
      case 'storm':
        this.applyStorm(windIntensity)
        break
      case 'snow':
        this.applySnow(windIntensity)
        break
      case 'fog':
        this.applyFog()
        break
    }
  }

  private clearAllEffects(): void {
    // Stop particle emitters
    if (this.rainEmitter) {
      this.rainEmitter.stop()
      this.rainEmitter.destroy()
      this.rainEmitter = null
    }
    if (this.snowEmitter) {
      this.snowEmitter.stop()
      this.snowEmitter.destroy()
      this.snowEmitter = null
    }

    // Reset overlays
    if (this.fogOverlay) {
      this.scene.tweens.add({
        targets: this.fogOverlay,
        fillAlpha: 0,
        duration: 1000,
      })
    }
    if (this.weatherTintOverlay) {
      this.scene.tweens.add({
        targets: this.weatherTintOverlay,
        fillAlpha: 0,
        duration: 1000,
      })
    }

    // Stop lightning
    if (this.lightningTimer) {
      this.lightningTimer.destroy()
      this.lightningTimer = null
    }
    if (this.lightningFlash) {
      this.lightningFlash.setAlpha(0)
    }

    // Stop cloud shadow
    if (this.cloudTween) {
      this.cloudTween.stop()
      this.cloudTween = null
    }
    if (this.cloudShadow) {
      this.cloudShadow.setAlpha(0)
    }
  }

  // ── Weather type implementations ──

  private applyClear(): void {
    // No effects, bright lighting — just ensure overlays are transparent
  }

  private applyCloudy(): void {
    // Slight darkening tint
    if (this.weatherTintOverlay) {
      this.scene.tweens.add({
        targets: this.weatherTintOverlay,
        fillAlpha: 0.08,
        duration: 2000,
      })
      this.weatherTintOverlay.setFillStyle(0x404040, 0)
    }

    // Moving cloud shadow
    if (this.cloudShadow) {
      this.cloudShadow.setAlpha(0.12)
      const cam = this.scene.cameras.main
      this.cloudShadow.setPosition(cam.scrollX - 200, cam.scrollY + 100)

      this.cloudTween = this.scene.tweens.add({
        targets: this.cloudShadow,
        x: this.cloudShadow.x + 800,
        y: this.cloudShadow.y + 200,
        duration: 30000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }
  }

  private applyRain(windIntensity: number): void {
    const cam = this.scene.cameras.main
    const windAngle = windIntensity * 15 // degrees of slant

    this.rainEmitter = this.scene.add.particles(0, 0, this.rainKey, {
      x: { min: -cam.width * 0.5, max: cam.width * 1.5 },
      y: -20,
      lifespan: 800,
      speedY: { min: 300, max: 450 },
      speedX: { min: windAngle * 5, max: windAngle * 15 },
      scale: { start: 0.8, end: 0.4 },
      alpha: { start: 0.5, end: 0.1 },
      quantity: 3,
      frequency: 30,
    })
      .setScrollFactor(0)
      .setDepth(1550)

    // Slight tint
    if (this.weatherTintOverlay) {
      this.weatherTintOverlay.setFillStyle(0x223344, 0)
      this.scene.tweens.add({
        targets: this.weatherTintOverlay,
        fillAlpha: 0.06,
        duration: 2000,
      })
    }
  }

  private applyStorm(windIntensity: number): void {
    // Heavier rain
    const cam = this.scene.cameras.main
    const windAngle = windIntensity * 25

    this.rainEmitter = this.scene.add.particles(0, 0, this.rainKey, {
      x: { min: -cam.width * 0.5, max: cam.width * 1.5 },
      y: -20,
      lifespan: 600,
      speedY: { min: 450, max: 650 },
      speedX: { min: windAngle * 8, max: windAngle * 20 },
      scale: { start: 1.0, end: 0.5 },
      alpha: { start: 0.7, end: 0.15 },
      quantity: 6,
      frequency: 20,
    })
      .setScrollFactor(0)
      .setDepth(1550)

    // Darker tint
    if (this.weatherTintOverlay) {
      this.weatherTintOverlay.setFillStyle(0x111122, 0)
      this.scene.tweens.add({
        targets: this.weatherTintOverlay,
        fillAlpha: 0.15,
        duration: 1500,
      })
    }

    // Lightning flashes at random intervals
    this.lightningTimer = this.scene.time.addEvent({
      delay: 3000 + Math.random() * 7000,
      callback: () => this.triggerLightning(),
      loop: true,
    })
  }

  private triggerLightning(): void {
    if (!this.lightningFlash) return

    // Bright flash
    this.lightningFlash.setAlpha(0.6)
    this.scene.tweens.add({
      targets: this.lightningFlash,
      alpha: 0,
      duration: 150,
      ease: 'Quad.easeOut',
      onComplete: () => {
        // Second smaller flash after brief pause
        this.scene.time.delayedCall(80, () => {
          if (!this.lightningFlash) return
          this.lightningFlash.setAlpha(0.3)
          this.scene.tweens.add({
            targets: this.lightningFlash,
            alpha: 0,
            duration: 200,
            ease: 'Quad.easeOut',
          })
        })
      },
    })

    // Randomize next lightning interval by resetting the timer
    if (this.lightningTimer) {
      this.lightningTimer.reset({
        delay: 3000 + Math.random() * 7000,
        callback: () => this.triggerLightning(),
        loop: true,
      })
    }
  }

  private applySnow(windIntensity: number): void {
    const cam = this.scene.cameras.main
    const windDrift = windIntensity * 10

    this.snowEmitter = this.scene.add.particles(0, 0, this.snowKey, {
      x: { min: -cam.width * 0.3, max: cam.width * 1.3 },
      y: -10,
      lifespan: 3000,
      speedY: { min: 40, max: 80 },
      speedX: { min: -windDrift, max: windDrift * 3 },
      scale: { start: 0.6, end: 0.2 },
      alpha: { start: 0.8, end: 0.2 },
      quantity: 2,
      frequency: 60,
      rotate: { min: 0, max: 360 },
    })
      .setScrollFactor(0)
      .setDepth(1550)

    // Cool white tint
    if (this.weatherTintOverlay) {
      this.weatherTintOverlay.setFillStyle(0xc0d0e8, 0)
      this.scene.tweens.add({
        targets: this.weatherTintOverlay,
        fillAlpha: 0.06,
        duration: 2000,
      })
    }
  }

  private applyFog(): void {
    // Fog overlay fades in
    if (this.fogOverlay) {
      this.fogOverlay.setFillStyle(0xcccccc, 0)
      this.scene.tweens.add({
        targets: this.fogOverlay,
        fillAlpha: 0.25,
        duration: 3000,
        ease: 'Sine.easeInOut',
      })

      // Gentle breathing/pulsing of fog density
      this.scene.tweens.add({
        targets: this.fogOverlay,
        fillAlpha: { from: 0.2, to: 0.3 },
        duration: 4000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: 3000,
      })
    }
  }

  /** Clean up when scene shuts down */
  destroy(): void {
    this.clearAllEffects()
    this.weatherTintOverlay?.destroy()
    this.fogOverlay?.destroy()
    this.lightningFlash?.destroy()
    this.cloudShadow?.destroy()
  }
}
