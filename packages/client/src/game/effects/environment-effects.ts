import Phaser from 'phaser'
import { ensureEffectTextures } from './combat-effects.js'

// ── Environment Effect Functions ──

/** Campfire flame loop */
export function createCampfire(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Particles.ParticleEmitter {
  ensureEffectTextures(scene)
  const emitter = scene.add.particles(x, y, 'fx_particle', {
    speed: { min: 5, max: 25 },
    angle: { min: 250, max: 290 },
    scale: { start: 0.5, end: 0 },
    alpha: { start: 0.8, end: 0 },
    lifespan: 600,
    frequency: 50,
    quantity: 2,
    tint: [0xFF4400, 0xFF8800, 0xFFCC00],
    blendMode: Phaser.BlendModes.ADD,
  })
  return emitter
}

/** Torch flame (smaller than campfire) */
export function createTorch(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Particles.ParticleEmitter {
  ensureEffectTextures(scene)
  return scene.add.particles(x, y, 'fx_particle', {
    speed: { min: 3, max: 15 },
    angle: { min: 255, max: 285 },
    scale: { start: 0.3, end: 0 },
    alpha: { start: 0.7, end: 0 },
    lifespan: 400,
    frequency: 70,
    quantity: 1,
    tint: [0xFF6600, 0xFFAA00],
    blendMode: Phaser.BlendModes.ADD,
  })
}

/** Smoke rising (chimney, campfire aftermath) */
export function createSmoke(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Particles.ParticleEmitter {
  ensureEffectTextures(scene)
  return scene.add.particles(x, y, 'fx_particle', {
    speed: { min: 3, max: 10 },
    angle: { min: 260, max: 280 },
    scale: { start: 0.4, end: 1.0 },
    alpha: { start: 0.3, end: 0 },
    lifespan: 2000,
    frequency: 200,
    quantity: 1,
    tint: 0x888888,
  })
}

/** Water splash (footstep in shallow water) */
export function playWaterSplash(scene: Phaser.Scene, x: number, y: number): void {
  ensureEffectTextures(scene)
  const emitter = scene.add.particles(x, y, 'fx_particle', {
    speed: { min: 15, max: 40 },
    angle: { min: 220, max: 320 },
    scale: { start: 0.3, end: 0 },
    alpha: { start: 0.6, end: 0 },
    lifespan: 400,
    quantity: 6,
    tint: 0x6688CC,
    emitting: false,
  })
  emitter.explode(6)
  scene.time.delayedCall(500, () => emitter.destroy())
}

/** Sparkle effect (masterwork items, treasure, level up) */
export function playSparkle(scene: Phaser.Scene, x: number, y: number, duration: number = 1000): void {
  ensureEffectTextures(scene)
  const emitter = scene.add.particles(x, y, 'fx_sparkle', {
    speed: { min: 5, max: 20 },
    scale: { start: 0.3, end: 0 },
    alpha: { start: 0.8, end: 0 },
    lifespan: 500,
    frequency: 100,
    quantity: 1,
    tint: [0xFFDD44, 0xFFFFFF],
    blendMode: Phaser.BlendModes.ADD,
  })
  scene.time.delayedCall(duration, () => { emitter.stop(); scene.time.delayedCall(600, () => emitter.destroy()) })
}

/** Dust puff (movement, construction) */
export function playDustPuff(scene: Phaser.Scene, x: number, y: number): void {
  ensureEffectTextures(scene)
  const emitter = scene.add.particles(x, y + 4, 'fx_particle', {
    speed: { min: 5, max: 20 },
    scale: { start: 0.3, end: 0.1 },
    alpha: { start: 0.4, end: 0 },
    lifespan: 400,
    quantity: 3,
    tint: 0xCCBB99,
    emitting: false,
  })
  emitter.explode(3)
  scene.time.delayedCall(500, () => emitter.destroy())
}

/** Firefly glow (night ambiance) */
export function createFireflies(scene: Phaser.Scene, x: number, y: number, width: number, height: number): Phaser.GameObjects.Particles.ParticleEmitter {
  ensureEffectTextures(scene)
  const emitter = scene.add.particles(x, y, 'fx_particle', {
    speed: { min: 3, max: 8 },
    scale: { start: 0.2, end: 0.1 },
    alpha: { start: 0.6, end: 0 },
    lifespan: 3000,
    frequency: 500,
    quantity: 1,
    tint: 0xFFEE44,
    blendMode: Phaser.BlendModes.ADD,
    emitZone: new Phaser.GameObjects.Particles.Zones.RandomZone(
      new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height) as unknown as Phaser.Types.GameObjects.Particles.RandomZoneSource,
    ),
  } as Phaser.Types.GameObjects.Particles.ParticleEmitterConfig)

  // Add pulsing effect via emitter callback (simple approach with fixed repeat count)
  emitter.onParticleEmit((particle: Phaser.GameObjects.Particles.Particle) => {
    scene.tweens.add({
      targets: particle,
      alpha: { from: 0.6, to: 0.1 },
      duration: 1500,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
    })
  })

  return emitter
}
