/**
 * Event Visuals — distinct visual presence for each world event type.
 *
 * Replaces the generic pulsing diamond with event-specific rendering:
 * - resource_bloom: Golden sparkles + green ground glow
 * - resource_drought: Brown cracked zone
 * - festival: Colorful banners + firework bursts
 * - market_boom: Gold coin particles
 * - monster_spawn: Red danger zone + skull icon + dark aura
 * - storm_warning: Dark cloud + lightning flashes
 * - hidden_treasure: X mark + golden glitter
 * - new_poi (portal): Purple swirl + light beam + particle vortex
 */

import Phaser from 'phaser'
import type { ActiveWorldEvent, WorldEventType } from '@botworld/shared'
import { ISO_TILE_WIDTH, ISO_TILE_HEIGHT, worldToScreen } from '../utils/coordinates.js'

// ── Configuration ──

const PARTICLE_INTERVAL = 800  // ms between particle bursts
const ZONE_ALPHA = 0.08        // ground zone fill opacity

// ── Types ──

interface EventVisual {
  event: ActiveWorldEvent
  container: Phaser.GameObjects.Container
  zoneGfx: Phaser.GameObjects.Graphics
  lastParticleTime: number
}

// Color palette per event type
const EVENT_COLORS: Record<string, { primary: number; secondary: number; glow: number }> = {
  resource_bloom:   { primary: 0x2ecc71, secondary: 0xFFD700, glow: 0x4ADE80 },
  resource_drought: { primary: 0x8B6914, secondary: 0xA0522D, glow: 0x6B4226 },
  festival:         { primary: 0xF1C40F, secondary: 0xE74C3C, glow: 0xFFD700 },
  market_boom:      { primary: 0xF1C40F, secondary: 0x2ecc71, glow: 0xFFD700 },
  monster_spawn:    { primary: 0xE74C3C, secondary: 0xFF4444, glow: 0xCC2222 },
  storm_warning:    { primary: 0x5B7DB1, secondary: 0xFFFFFF, glow: 0x3B5998 },
  hidden_treasure:  { primary: 0xFFD700, secondary: 0xF1C40F, glow: 0xDAA520 },
  new_poi:          { primary: 0x9B59B6, secondary: 0xBB77DD, glow: 0x8E44AD },
}

// Event type → emoji icon
const EVENT_ICONS: Record<string, string> = {
  resource_bloom:   '\u{1F33F}',   // 🌿
  resource_drought: '\u{1F3DC}\uFE0F', // 🏜️
  festival:         '\u{1F389}',   // 🎉
  market_boom:      '\u{1F4B0}',   // 💰
  monster_spawn:    '\u{1F480}',   // 💀
  storm_warning:    '\u26C8\uFE0F', // ⛈️
  hidden_treasure:  '\u2728',      // ✨
  new_poi:          '\u{1F300}',   // 🌀
}

// ── System ──

export class EventVisuals {
  private scene: Phaser.Scene
  private visuals = new Map<string, EventVisual>()

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /** Called from WorldScene.setWorldEvents() — sync visuals with active events */
  sync(events: ActiveWorldEvent[]): void {
    const currentIds = new Set(events.map(e => e.id))

    // Remove expired
    for (const [id, visual] of this.visuals) {
      if (!currentIds.has(id)) {
        this.removeVisual(visual)
        this.visuals.delete(id)
      }
    }

    // Add new
    for (const event of events) {
      if (!this.visuals.has(event.id)) {
        this.createVisual(event)
      }
    }
  }

  /** Called every frame — animate particles and effects */
  update(): void {
    const now = Date.now()
    for (const [, visual] of this.visuals) {
      if (now - visual.lastParticleTime > PARTICLE_INTERVAL) {
        visual.lastParticleTime = now
        this.spawnParticles(visual)
      }
    }
  }

  destroy(): void {
    for (const [, visual] of this.visuals) {
      this.removeVisual(visual)
    }
    this.visuals.clear()
  }

  // ── Private ──

  private removeVisual(visual: EventVisual): void {
    // Fade out then destroy
    this.scene.tweens.add({
      targets: [visual.container, visual.zoneGfx],
      alpha: 0,
      duration: 500,
      onComplete: () => {
        visual.container.destroy()
        visual.zoneGfx.destroy()
      },
    })
  }

  private createVisual(event: ActiveWorldEvent): void {
    const pos = worldToScreen(event.position.x, event.position.y)
    const cx = pos.x + ISO_TILE_WIDTH / 2
    const cy = pos.y + ISO_TILE_HEIGHT / 2
    const colors = EVENT_COLORS[event.type] ?? EVENT_COLORS.resource_bloom

    // 1. Ground zone circle (shows the event's radius)
    const zoneGfx = this.scene.add.graphics().setDepth(0)
    const zoneRadius = event.radius * (ISO_TILE_WIDTH / 2)
    zoneGfx.fillStyle(colors.primary, ZONE_ALPHA)
    zoneGfx.fillCircle(cx, cy, zoneRadius)
    zoneGfx.lineStyle(1.5, colors.primary, 0.25)
    zoneGfx.strokeCircle(cx, cy, zoneRadius)

    // Pulse the zone
    this.scene.tweens.add({
      targets: zoneGfx,
      alpha: { from: 0.6, to: 1 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // 2. Central visual (event-type-specific)
    const container = this.scene.add.container(cx, cy).setDepth(900)

    // Build the event-specific visual
    switch (event.type) {
      case 'new_poi':
        this.buildPortalVisual(container, colors)
        break
      case 'monster_spawn':
        this.buildDangerVisual(container, colors)
        break
      case 'festival':
        this.buildFestivalVisual(container, colors)
        break
      case 'hidden_treasure':
        this.buildTreasureVisual(container, colors)
        break
      case 'resource_bloom':
        this.buildBloomVisual(container, colors)
        break
      case 'storm_warning':
        this.buildStormVisual(container, colors)
        break
      default:
        this.buildDefaultVisual(container, event.type, colors)
        break
    }

    // 3. Event title label
    const label = this.scene.add.text(0, 28, event.title, {
      fontSize: '9px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
    }).setOrigin(0.5, 0)
    container.add(label)

    // Fade in
    container.setAlpha(0)
    this.scene.tweens.add({
      targets: container,
      alpha: 1,
      duration: 600,
      ease: 'Quad.easeOut',
    })

    this.visuals.set(event.id, {
      event,
      container,
      zoneGfx,
      lastParticleTime: Date.now(),
    })
  }

  // ── Event-type-specific builders ──

  /** Portal: purple swirl + light beam */
  private buildPortalVisual(
    container: Phaser.GameObjects.Container,
    colors: { primary: number; secondary: number; glow: number },
  ): void {
    // Light beam (vertical pillar)
    const beam = this.scene.add.graphics()
    beam.fillStyle(colors.secondary, 0.15)
    beam.fillRect(-4, -60, 8, 60)
    beam.fillStyle(colors.primary, 0.3)
    beam.fillRect(-2, -60, 4, 60)
    container.add(beam)

    // Outer glow ring
    const glow = this.scene.add.graphics()
    glow.fillStyle(colors.primary, 0.2)
    glow.fillCircle(0, 0, 22)
    container.add(glow)

    // Swirl icon
    const icon = this.scene.add.text(0, 0, '\u{1F300}', { fontSize: '24px' })
      .setOrigin(0.5, 0.5)
    container.add(icon)

    // Rotation animation on glow
    this.scene.tweens.add({
      targets: glow,
      angle: 360,
      duration: 4000,
      repeat: -1,
    })

    // Pulsing scale on icon
    this.scene.tweens.add({
      targets: icon,
      scaleX: { from: 0.9, to: 1.1 },
      scaleY: { from: 0.9, to: 1.1 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // Beam shimmer
    this.scene.tweens.add({
      targets: beam,
      alpha: { from: 0.5, to: 1 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  /** Monster spawn: red danger zone + skull */
  private buildDangerVisual(
    container: Phaser.GameObjects.Container,
    colors: { primary: number; secondary: number; glow: number },
  ): void {
    // Dark aura
    const aura = this.scene.add.graphics()
    aura.fillStyle(colors.glow, 0.15)
    aura.fillCircle(0, 0, 20)
    container.add(aura)

    // Danger ring
    const ring = this.scene.add.graphics()
    ring.lineStyle(2.5, colors.primary, 0.7)
    ring.strokeCircle(0, 0, 18)
    container.add(ring)

    // Skull icon
    const icon = this.scene.add.text(0, -2, '\u{1F480}', { fontSize: '22px' })
      .setOrigin(0.5, 0.5)
    container.add(icon)

    // Warning text
    const warn = this.scene.add.text(0, 16, '\u26A0\uFE0F DANGER', {
      fontSize: '7px',
      fontFamily: 'Arial, sans-serif',
      color: '#FF4444',
      stroke: '#000000',
      strokeThickness: 2,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0)
    container.add(warn)

    // Pulsing danger ring
    this.scene.tweens.add({
      targets: ring,
      scaleX: { from: 0.9, to: 1.15 },
      scaleY: { from: 0.9, to: 1.15 },
      alpha: { from: 0.8, to: 0.3 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // Slow bobble on skull
    this.scene.tweens.add({
      targets: icon,
      y: icon.y - 3,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  /** Festival: party decorations + banner */
  private buildFestivalVisual(
    container: Phaser.GameObjects.Container,
    colors: { primary: number; secondary: number; glow: number },
  ): void {
    // Warm glow
    const glow = this.scene.add.graphics()
    glow.fillStyle(colors.primary, 0.12)
    glow.fillCircle(0, 0, 24)
    container.add(glow)

    // Party icon
    const icon = this.scene.add.text(0, -2, '\u{1F389}', { fontSize: '22px' })
      .setOrigin(0.5, 0.5)
    container.add(icon)

    // Banner flags (three colored triangles)
    const flags = this.scene.add.graphics()
    const flagColors = [0xE74C3C, 0xF1C40F, 0x2ECC71, 0x3498DB]
    for (let i = 0; i < 4; i++) {
      const fx = -18 + i * 12
      flags.fillStyle(flagColors[i], 0.8)
      flags.fillTriangle(fx, -20, fx + 5, -20, fx + 2.5, -12)
    }
    // String
    flags.lineStyle(1, 0xFFFFFF, 0.5)
    flags.beginPath()
    flags.moveTo(-18, -20)
    flags.lineTo(18, -20)
    flags.strokePath()
    container.add(flags)

    // Gentle bounce on icon
    this.scene.tweens.add({
      targets: icon,
      y: icon.y - 2,
      angle: { from: -5, to: 5 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  /** Hidden treasure: X mark + golden sparkle */
  private buildTreasureVisual(
    container: Phaser.GameObjects.Container,
    colors: { primary: number; secondary: number; glow: number },
  ): void {
    // Golden glow
    const glow = this.scene.add.graphics()
    glow.fillStyle(colors.primary, 0.15)
    glow.fillCircle(0, 0, 18)
    container.add(glow)

    // X mark (two crossed lines)
    const xMark = this.scene.add.graphics()
    xMark.lineStyle(3, colors.primary, 0.9)
    xMark.beginPath()
    xMark.moveTo(-10, -10)
    xMark.lineTo(10, 10)
    xMark.strokePath()
    xMark.beginPath()
    xMark.moveTo(10, -10)
    xMark.lineTo(-10, 10)
    xMark.strokePath()
    container.add(xMark)

    // Sparkle icon on top
    const icon = this.scene.add.text(0, -16, '\u2728', { fontSize: '14px' })
      .setOrigin(0.5, 0.5)
    container.add(icon)

    // Pulsing glow
    this.scene.tweens.add({
      targets: glow,
      alpha: { from: 0.5, to: 1 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // Float sparkle
    this.scene.tweens.add({
      targets: icon,
      y: icon.y - 4,
      alpha: { from: 0.7, to: 1 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  /** Resource bloom: green growth + golden sparkles */
  private buildBloomVisual(
    container: Phaser.GameObjects.Container,
    colors: { primary: number; secondary: number; glow: number },
  ): void {
    // Green aura
    const glow = this.scene.add.graphics()
    glow.fillStyle(colors.glow, 0.15)
    glow.fillCircle(0, 0, 20)
    container.add(glow)

    // Growth icon
    const icon = this.scene.add.text(0, -2, '\u{1F33F}', { fontSize: '22px' })
      .setOrigin(0.5, 0.5)
    container.add(icon)

    // Golden sparkle ring
    for (let i = 0; i < 3; i++) {
      const angle = (Math.PI * 2 * i) / 3
      const sparkle = this.scene.add.text(
        Math.cos(angle) * 14,
        Math.sin(angle) * 14,
        '\u2728', { fontSize: '8px' },
      ).setOrigin(0.5, 0.5)
      container.add(sparkle)

      this.scene.tweens.add({
        targets: sparkle,
        alpha: { from: 0.3, to: 1 },
        duration: 800 + i * 200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }

    // Gentle grow/shrink on icon
    this.scene.tweens.add({
      targets: icon,
      scaleX: { from: 0.9, to: 1.1 },
      scaleY: { from: 0.9, to: 1.1 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  /** Storm warning: dark cloud + lightning */
  private buildStormVisual(
    container: Phaser.GameObjects.Container,
    colors: { primary: number; secondary: number; glow: number },
  ): void {
    // Dark overlay
    const dark = this.scene.add.graphics()
    dark.fillStyle(0x222244, 0.2)
    dark.fillCircle(0, 0, 22)
    container.add(dark)

    // Storm icon
    const icon = this.scene.add.text(0, -4, '\u26C8\uFE0F', { fontSize: '22px' })
      .setOrigin(0.5, 0.5)
    container.add(icon)

    // Lightning bolt emoji
    const bolt = this.scene.add.text(8, 6, '\u26A1', { fontSize: '12px' })
      .setOrigin(0.5, 0.5).setAlpha(0)
    container.add(bolt)

    // Periodic lightning flash
    this.scene.tweens.add({
      targets: bolt,
      alpha: { from: 0, to: 1 },
      duration: 100,
      yoyo: true,
      repeat: -1,
      repeatDelay: 2500,
    })

    // Shake the cloud slightly
    this.scene.tweens.add({
      targets: icon,
      x: { from: -2, to: 2 },
      duration: 300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  /** Default: category-colored icon + ring */
  private buildDefaultVisual(
    container: Phaser.GameObjects.Container,
    eventType: string,
    colors: { primary: number; secondary: number; glow: number },
  ): void {
    const ring = this.scene.add.graphics()
    ring.fillStyle(colors.primary, 0.2)
    ring.fillCircle(0, 0, 18)
    ring.lineStyle(2, colors.primary, 0.6)
    ring.strokeCircle(0, 0, 18)
    container.add(ring)

    const emoji = EVENT_ICONS[eventType] ?? '\u2753'  // ❓
    const icon = this.scene.add.text(0, -2, emoji, { fontSize: '20px' })
      .setOrigin(0.5, 0.5)
    container.add(icon)

    this.scene.tweens.add({
      targets: container,
      scaleX: { from: 0.9, to: 1.1 },
      scaleY: { from: 0.9, to: 1.1 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  // ── Ambient particles ──

  private spawnParticles(visual: EventVisual): void {
    const { event, container } = visual
    const colors = EVENT_COLORS[event.type] ?? EVENT_COLORS.resource_bloom

    switch (event.type) {
      case 'new_poi':
        this.spawnPortalParticles(container, colors)
        break
      case 'monster_spawn':
        this.spawnDangerParticles(container, colors)
        break
      case 'festival':
        this.spawnFestivalParticles(container, colors)
        break
      case 'hidden_treasure':
        this.spawnSparkleParticles(container, colors)
        break
      case 'resource_bloom':
        this.spawnBloomParticles(container, colors)
        break
      default:
        this.spawnGenericParticles(container, colors)
        break
    }
  }

  /** Purple swirling particles for portal */
  private spawnPortalParticles(
    container: Phaser.GameObjects.Container,
    colors: { primary: number; secondary: number },
  ): void {
    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2
      const dist = 8 + Math.random() * 12
      const p = this.scene.add.circle(
        container.x + Math.cos(angle) * dist,
        container.y + Math.sin(angle) * dist,
        Phaser.Math.Between(1, 3),
        colors.secondary, 0.7,
      ).setDepth(899)

      this.scene.tweens.add({
        targets: p,
        x: container.x + Math.cos(angle + 1.5) * 4,
        y: container.y + Math.sin(angle + 1.5) * 4 - 15,
        alpha: 0,
        scale: 0.2,
        duration: 1000 + Math.random() * 500,
        onComplete: () => p.destroy(),
      })
    }
  }

  /** Red ember particles for danger */
  private spawnDangerParticles(
    container: Phaser.GameObjects.Container,
    colors: { primary: number; secondary: number },
  ): void {
    for (let i = 0; i < 2; i++) {
      const p = this.scene.add.circle(
        container.x + Phaser.Math.Between(-15, 15),
        container.y + Phaser.Math.Between(-5, 5),
        Phaser.Math.Between(1, 2),
        colors.secondary, 0.6,
      ).setDepth(899)

      this.scene.tweens.add({
        targets: p,
        y: p.y - 20,
        alpha: 0,
        duration: 800 + Math.random() * 400,
        onComplete: () => p.destroy(),
      })
    }
  }

  /** Colorful confetti for festival */
  private spawnFestivalParticles(
    container: Phaser.GameObjects.Container,
    _colors: { primary: number; secondary: number },
  ): void {
    const confettiColors = [0xE74C3C, 0xF1C40F, 0x2ECC71, 0x3498DB, 0x9B59B6]
    for (let i = 0; i < 2; i++) {
      const color = confettiColors[Math.floor(Math.random() * confettiColors.length)]
      const p = this.scene.add.rectangle(
        container.x + Phaser.Math.Between(-12, 12),
        container.y - 15,
        Phaser.Math.Between(2, 4),
        Phaser.Math.Between(2, 4),
        color, 0.8,
      ).setDepth(899).setRotation(Math.random() * Math.PI)

      this.scene.tweens.add({
        targets: p,
        y: p.y + 30,
        x: p.x + Phaser.Math.Between(-8, 8),
        alpha: 0,
        angle: p.angle + Phaser.Math.Between(90, 270),
        duration: 1200,
        ease: 'Quad.easeIn',
        onComplete: () => p.destroy(),
      })
    }
  }

  /** Golden sparkle for treasure */
  private spawnSparkleParticles(
    container: Phaser.GameObjects.Container,
    colors: { primary: number; secondary: number },
  ): void {
    const p = this.scene.add.circle(
      container.x + Phaser.Math.Between(-10, 10),
      container.y + Phaser.Math.Between(-10, 10),
      Phaser.Math.Between(1, 2),
      colors.primary, 0.9,
    ).setDepth(899)

    this.scene.tweens.add({
      targets: p,
      y: p.y - 12,
      alpha: 0,
      scale: 0,
      duration: 600,
      ease: 'Quad.easeOut',
      onComplete: () => p.destroy(),
    })
  }

  /** Green life particles for bloom */
  private spawnBloomParticles(
    container: Phaser.GameObjects.Container,
    colors: { primary: number; secondary: number },
  ): void {
    for (let i = 0; i < 2; i++) {
      const p = this.scene.add.circle(
        container.x + Phaser.Math.Between(-16, 16),
        container.y + Phaser.Math.Between(-4, 8),
        Phaser.Math.Between(1, 2),
        colors.primary, 0.5,
      ).setDepth(899)

      this.scene.tweens.add({
        targets: p,
        y: p.y - 18,
        alpha: 0,
        duration: 1000 + Math.random() * 400,
        onComplete: () => p.destroy(),
      })
    }
  }

  /** Generic ambient particles */
  private spawnGenericParticles(
    container: Phaser.GameObjects.Container,
    colors: { primary: number; secondary: number },
  ): void {
    const p = this.scene.add.circle(
      container.x + Phaser.Math.Between(-12, 12),
      container.y + Phaser.Math.Between(-6, 6),
      Phaser.Math.Between(1, 2),
      colors.primary, 0.5,
    ).setDepth(899)

    this.scene.tweens.add({
      targets: p,
      y: p.y - 15,
      alpha: 0,
      duration: 800,
      onComplete: () => p.destroy(),
    })
  }
}
