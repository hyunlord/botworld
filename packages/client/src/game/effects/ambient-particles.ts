import Phaser from 'phaser'
import type { TimeOfDay } from '@botworld/shared'

/**
 * Biome-aware ambient particle system.
 * Spawns subtle environmental particles based on the dominant biome
 * in the viewport: butterflies, falling leaves, fireflies, dust, chimney smoke.
 * These make the world feel "alive" without being consciously noticed.
 */

type BiomeParticleType =
  | 'butterfly'    // grassland/meadow
  | 'dandelion'    // grassland
  | 'leaf_fall'    // forest
  | 'firefly'      // waterside (evening/night only)
  | 'dust'         // mountain/desert
  | 'sand_drift'   // desert
  | 'smoke'        // village/buildings
  | 'snow_drift'   // snow/tundra
  | 'pollen'       // meadow/farmland

interface AmbientParticle {
  type: BiomeParticleType
  sprite: Phaser.GameObjects.Graphics | Phaser.GameObjects.Ellipse
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  phase: number
}

// Biome → which particle types to spawn
const BIOME_PARTICLES: Record<string, BiomeParticleType[]> = {
  grassland: ['butterfly', 'dandelion'],
  meadow: ['butterfly', 'pollen'],
  savanna: ['dust', 'dandelion'],
  temperate_forest: ['leaf_fall'],
  dense_forest: ['leaf_fall'],
  alpine_forest: ['leaf_fall'],
  forest: ['leaf_fall'],
  desert: ['dust', 'sand_drift'],
  mountain: ['dust'],
  highland: ['dust'],
  alpine_meadow: ['pollen'],
  snow_peak: ['snow_drift'],
  tundra: ['snow_drift'],
  ice_shelf: ['snow_drift'],
  swamp: ['firefly'],
  mangrove: ['firefly'],
  beach: ['dust'],
  farmland: ['pollen', 'butterfly'],
  // Water-adjacent biomes get fireflies at night
  ocean: [],
  deep_ocean: [],
}

// Particle visual configs
const PARTICLE_CONFIG: Record<BiomeParticleType, {
  color: number
  size: number
  alpha: number
  speed: number
  lifespan: number
  sway: number
  nightOnly?: boolean
}> = {
  butterfly: { color: 0xFFDD44, size: 3, alpha: 0.7, speed: 0.3, lifespan: 500, sway: 2.0 },
  dandelion: { color: 0xFFFFF0, size: 2, alpha: 0.5, speed: 0.15, lifespan: 600, sway: 1.5 },
  leaf_fall: { color: 0x88AA44, size: 3, alpha: 0.6, speed: 0.2, lifespan: 400, sway: 1.8 },
  firefly: { color: 0xFFFF66, size: 2, alpha: 0.8, speed: 0.1, lifespan: 300, sway: 1.0, nightOnly: true },
  dust: { color: 0xCCBB99, size: 1.5, alpha: 0.3, speed: 0.4, lifespan: 350, sway: 0.5 },
  sand_drift: { color: 0xDDCC88, size: 1, alpha: 0.25, speed: 0.6, lifespan: 250, sway: 0.3 },
  smoke: { color: 0x999999, size: 4, alpha: 0.15, speed: 0.08, lifespan: 500, sway: 0.4 },
  snow_drift: { color: 0xFFFFFF, size: 2, alpha: 0.5, speed: 0.12, lifespan: 400, sway: 1.2 },
  pollen: { color: 0xFFFF88, size: 1.5, alpha: 0.35, speed: 0.1, lifespan: 500, sway: 0.8 },
}

const MAX_PARTICLES = 12
const SPAWN_INTERVAL = 40 // frames between spawn attempts

export class AmbientParticles {
  private scene: Phaser.Scene
  private particles: AmbientParticle[] = []
  private graphics: Phaser.GameObjects.Graphics
  private frameCount = 0
  private currentBiomes: string[] = []
  private currentTime: TimeOfDay = 'noon'
  private windX = 0.2 // Gentle default wind

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.graphics = scene.add.graphics()
      .setDepth(1200) // Above world objects, below UI overlays
      .setScrollFactor(0)
  }

  /** Update the dominant biomes visible in the viewport */
  setBiomes(biomes: string[]): void {
    this.currentBiomes = biomes
  }

  /** Update time of day (affects which particles spawn) */
  setTimeOfDay(time: TimeOfDay): void {
    this.currentTime = time
  }

  /** Update wind direction (from weather) */
  setWind(intensity: number): void {
    this.windX = 0.1 + intensity * 0.5
  }

  /** Called every frame */
  update(): void {
    this.frameCount++

    // Spawn new particles periodically
    if (this.frameCount % SPAWN_INTERVAL === 0 && this.particles.length < MAX_PARTICLES) {
      this.trySpawn()
    }

    // Update and render
    this.graphics.clear()
    const cam = this.scene.cameras.main
    const toRemove: number[] = []

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i]
      p.life++

      if (p.life >= p.maxLife) {
        toRemove.push(i)
        continue
      }

      // Movement with sway
      const cfg = PARTICLE_CONFIG[p.type]
      const sway = Math.sin(p.life * 0.03 + p.phase) * cfg.sway
      p.x += p.vx + sway * 0.3 + this.windX
      p.y += p.vy

      // Fade in/out
      const lifeRatio = p.life / p.maxLife
      let alpha = cfg.alpha
      if (lifeRatio < 0.15) {
        alpha *= lifeRatio / 0.15 // Fade in
      } else if (lifeRatio > 0.8) {
        alpha *= (1 - lifeRatio) / 0.2 // Fade out
      }

      // Firefly glow pulse
      if (p.type === 'firefly') {
        alpha *= 0.4 + 0.6 * Math.abs(Math.sin(p.life * 0.08 + p.phase))
      }

      // Draw particle
      this.graphics.fillStyle(cfg.color, alpha)
      this.graphics.fillCircle(p.x, p.y, cfg.size)

      // Firefly: extra glow ring
      if (p.type === 'firefly') {
        this.graphics.fillStyle(cfg.color, alpha * 0.2)
        this.graphics.fillCircle(p.x, p.y, cfg.size * 3)
      }
    }

    // Remove expired particles (reverse order)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.particles.splice(toRemove[i], 1)
    }
  }

  private trySpawn(): void {
    if (this.currentBiomes.length === 0) return

    // Pick a random biome from visible set
    const biome = this.currentBiomes[Math.floor(Math.random() * this.currentBiomes.length)]
    const types = BIOME_PARTICLES[biome]
    if (!types || types.length === 0) return

    // Pick a random particle type
    const type = types[Math.floor(Math.random() * types.length)]
    const cfg = PARTICLE_CONFIG[type]

    // Night-only check
    if (cfg.nightOnly) {
      if (this.currentTime !== 'evening' && this.currentTime !== 'night') return
    }

    // Spawn in viewport
    const cam = this.scene.cameras.main
    const x = Math.random() * cam.width
    let y: number
    let vx: number
    let vy: number

    switch (type) {
      case 'leaf_fall':
      case 'snow_drift':
      case 'dandelion':
      case 'pollen':
        // Fall from top
        y = -10
        vx = (Math.random() - 0.3) * cfg.speed
        vy = cfg.speed * (1 + Math.random())
        break
      case 'smoke':
        // Rise from bottom
        y = cam.height + 10
        vx = (Math.random() - 0.5) * cfg.speed * 0.5
        vy = -cfg.speed * (1 + Math.random() * 0.5)
        break
      case 'dust':
      case 'sand_drift':
        // Blow horizontally
        y = cam.height * 0.3 + Math.random() * cam.height * 0.5
        vx = cfg.speed * (1 + Math.random())
        vy = (Math.random() - 0.5) * cfg.speed * 0.3
        break
      default:
        // Random motion (butterfly, firefly)
        y = cam.height * 0.2 + Math.random() * cam.height * 0.6
        vx = (Math.random() - 0.5) * cfg.speed
        vy = (Math.random() - 0.5) * cfg.speed
        break
    }

    this.particles.push({
      type,
      sprite: null as any, // Using graphics-based rendering instead
      x,
      y,
      vx,
      vy,
      life: 0,
      maxLife: cfg.lifespan + Math.floor(Math.random() * 100),
      phase: Math.random() * Math.PI * 2,
    })
  }

  /** Add chimney smoke for a building position (screen-space) */
  addSmoke(screenX: number, screenY: number): void {
    if (this.particles.length >= MAX_PARTICLES) return
    if (this.currentTime === 'night' || this.currentTime === 'evening') {
      // Smoke is more visible at night
      this.particles.push({
        type: 'smoke',
        sprite: null as any,
        x: screenX,
        y: screenY - 20,
        vx: this.windX * 0.3,
        vy: -0.15,
        life: 0,
        maxLife: 400 + Math.floor(Math.random() * 200),
        phase: Math.random() * Math.PI * 2,
      })
    }
  }

  destroy(): void {
    this.graphics.destroy()
    this.particles = []
  }
}
