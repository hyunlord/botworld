import Phaser from 'phaser'

interface AuraConfig {
  tint: number
  speed: { min: number; max: number }
  scale: { start: number; end: number }
  alpha: { start: number; end: number }
  lifespan: number
  frequency: number
  quantity: number
  blendMode: Phaser.BlendModes
}

const AURA_CONFIGS: Record<string, AuraConfig> = {
  fire: {
    tint: 0xFF4400,
    speed: { min: 10, max: 30 },
    scale: { start: 0.3, end: 0 },
    alpha: { start: 0.6, end: 0 },
    lifespan: 800,
    frequency: 80,
    quantity: 2,
    blendMode: Phaser.BlendModes.ADD,
  },
  ice: {
    tint: 0x88CCFF,
    speed: { min: 5, max: 15 },
    scale: { start: 0.2, end: 0.1 },
    alpha: { start: 0.5, end: 0 },
    lifespan: 1200,
    frequency: 120,
    quantity: 1,
    blendMode: Phaser.BlendModes.ADD,
  },
  nature: {
    tint: 0x44DD44,
    speed: { min: 5, max: 20 },
    scale: { start: 0.2, end: 0 },
    alpha: { start: 0.4, end: 0 },
    lifespan: 1500,
    frequency: 150,
    quantity: 1,
    blendMode: Phaser.BlendModes.ADD,
  },
  shadow: {
    tint: 0x440066,
    speed: { min: 5, max: 15 },
    scale: { start: 0.3, end: 0.1 },
    alpha: { start: 0.5, end: 0 },
    lifespan: 1000,
    frequency: 100,
    quantity: 2,
    blendMode: Phaser.BlendModes.MULTIPLY,
  },
  holy: {
    tint: 0xFFDD88,
    speed: { min: 8, max: 25 },
    scale: { start: 0.25, end: 0 },
    alpha: { start: 0.5, end: 0 },
    lifespan: 1000,
    frequency: 100,
    quantity: 2,
    blendMode: Phaser.BlendModes.ADD,
  },
  arcane: {
    tint: 0xCC44FF,
    speed: { min: 10, max: 30 },
    scale: { start: 0.2, end: 0.15 },
    alpha: { start: 0.6, end: 0 },
    lifespan: 900,
    frequency: 70,
    quantity: 2,
    blendMode: Phaser.BlendModes.ADD,
  },
}

/** Ensure a generic circle particle texture exists */
function ensureAuraParticle(scene: Phaser.Scene): string {
  const key = 'aura_particle_generic'
  if (scene.textures.exists(key)) return key

  const g = scene.add.graphics()
  g.fillStyle(0xFFFFFF, 1)
  g.fillCircle(4, 4, 4)
  g.generateTexture(key, 8, 8)
  g.destroy()
  return key
}

/**
 * Create an aura particle effect attached to a character container.
 */
export function createAuraEffect(
  scene: Phaser.Scene,
  auraType: string,
  parent: Phaser.GameObjects.Container,
): Phaser.GameObjects.Particles.ParticleEmitter | undefined {
  const cfg = AURA_CONFIGS[auraType]
  if (!cfg) return undefined

  const textureKey = `char_aura_${auraType}`
  const particleKey = scene.textures.exists(textureKey) ? textureKey : ensureAuraParticle(scene)

  const emitter = scene.add.particles(0, 0, particleKey, {
    speed: cfg.speed,
    scale: cfg.scale,
    alpha: cfg.alpha,
    lifespan: cfg.lifespan,
    frequency: cfg.frequency,
    quantity: cfg.quantity,
    blendMode: cfg.blendMode,
    tint: cfg.tint,
    emitZone: new Phaser.GameObjects.Particles.Zones.RandomZone(
      new Phaser.Geom.Circle(0, 0, 12) as unknown as Phaser.Types.GameObjects.Particles.RandomZoneSource,
    ),
  })

  parent.add(emitter)
  return emitter
}
