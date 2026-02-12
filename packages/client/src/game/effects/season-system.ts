import Phaser from 'phaser'

/**
 * Season cycle system.
 * Each season lasts 7 game days. Transitions happen over 1 game day (gradual blend).
 *
 * Visual effects per season:
 * - Spring: brighter greens, flower particles, fresh feel
 * - Summer: deep saturated greens, vivid colors, heat shimmer hint
 * - Autumn: orange/brown tints on trees, falling leaf particles, warm golden tone
 * - Winter: blue-white tint, bare trees, snow particles, cold atmosphere
 */

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

interface SeasonConfig {
  /** Tint applied to tree/vegetation sprites */
  treeTint: number
  /** Tint applied to grass ground tiles */
  grassTint: number
  /** Ambient color shift (multiplied into scene) */
  ambientTint: number
  /** Particle type emphasis */
  particleBoost: string[]
  /** Overall saturation modifier (1=normal) */
  saturation: number
}

const SEASON_CONFIGS: Record<Season, SeasonConfig> = {
  spring: {
    treeTint: 0x88DD66,      // Bright, fresh green
    grassTint: 0x99EE77,     // Lush bright green
    ambientTint: 0xFFFFFF,   // Neutral
    particleBoost: ['butterfly', 'pollen', 'dandelion'],
    saturation: 1.05,
  },
  summer: {
    treeTint: 0x44AA33,      // Deep, saturated green
    grassTint: 0x66BB44,     // Rich green
    ambientTint: 0xFFFFF0,   // Slight warm
    particleBoost: ['butterfly', 'dust'],
    saturation: 1.1,
  },
  autumn: {
    treeTint: 0xCC8833,      // Orange-brown
    grassTint: 0xBBAA55,     // Yellowed grass
    ambientTint: 0xFFEED0,   // Golden warm
    particleBoost: ['leaf_fall'],
    saturation: 0.95,
  },
  winter: {
    treeTint: 0x889999,      // Bare/grey
    grassTint: 0xAABBCC,     // Frost-tinged
    ambientTint: 0xDDDDFF,   // Cold blue
    particleBoost: ['snow_drift'],
    saturation: 0.85,
  },
}

const SEASON_ORDER: Season[] = ['spring', 'summer', 'autumn', 'winter']
const DAYS_PER_SEASON = 7

export class SeasonSystem {
  private currentSeason: Season = 'summer'
  private currentDay = 0
  private transitionProgress = 1.0 // 1.0 = fully in current season
  private currentConfig: SeasonConfig = { ...SEASON_CONFIGS.summer }
  private targetConfig: SeasonConfig = SEASON_CONFIGS.summer
  private lerpSpeed = 0.008

  /** Tracked tree sprites for tinting */
  private treeSprites: Set<Phaser.GameObjects.Sprite | Phaser.GameObjects.Image> = new Set()

  constructor() {
    // Default to summer
    this.currentConfig = { ...SEASON_CONFIGS.summer }
  }

  /** Update game day (called when day advances in the world clock) */
  setGameDay(day: number): void {
    this.currentDay = day
    const seasonIndex = Math.floor((day % (DAYS_PER_SEASON * 4)) / DAYS_PER_SEASON)
    const newSeason = SEASON_ORDER[seasonIndex]

    if (newSeason !== this.currentSeason) {
      this.currentSeason = newSeason
      this.targetConfig = SEASON_CONFIGS[newSeason]
      this.transitionProgress = 0
    }
  }

  /** Called every frame to interpolate season transition */
  update(): void {
    if (this.transitionProgress >= 1.0) return

    this.transitionProgress = Math.min(1.0, this.transitionProgress + this.lerpSpeed)

    // Lerp configs
    this.currentConfig.treeTint = lerpColor(this.currentConfig.treeTint, this.targetConfig.treeTint, this.lerpSpeed)
    this.currentConfig.grassTint = lerpColor(this.currentConfig.grassTint, this.targetConfig.grassTint, this.lerpSpeed)
    this.currentConfig.ambientTint = lerpColor(this.currentConfig.ambientTint, this.targetConfig.ambientTint, this.lerpSpeed)
    this.currentConfig.saturation += (this.targetConfig.saturation - this.currentConfig.saturation) * this.lerpSpeed

    // Apply tints to tracked tree sprites
    this.applyTreeTints()
  }

  /** Register a tree/vegetation sprite for seasonal tinting */
  registerTree(sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image): void {
    this.treeSprites.add(sprite)
    sprite.setTint(this.currentConfig.treeTint)
  }

  /** Unregister a tree sprite (e.g., when chunk unloaded) */
  unregisterTree(sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image): void {
    this.treeSprites.delete(sprite)
  }

  /** Get current tree tint color */
  getTreeTint(): number {
    return this.currentConfig.treeTint
  }

  /** Get current grass tint color */
  getGrassTint(): number {
    return this.currentConfig.grassTint
  }

  /** Get current ambient tint */
  getAmbientTint(): number {
    return this.currentConfig.ambientTint
  }

  /** Get particle types that should be boosted this season */
  getBoostedParticles(): string[] {
    return this.targetConfig.particleBoost
  }

  /** Get current season */
  getCurrentSeason(): Season {
    return this.currentSeason
  }

  /** Check if it's a snowy season */
  isWinter(): boolean {
    return this.currentSeason === 'winter'
  }

  private applyTreeTints(): void {
    const tint = this.currentConfig.treeTint
    for (const sprite of this.treeSprites) {
      if (sprite.active) {
        sprite.setTint(tint)
      } else {
        // Clean up destroyed sprites
        this.treeSprites.delete(sprite)
      }
    }
  }

  destroy(): void {
    this.treeSprites.clear()
  }
}

// ── Color lerp utility ──

function lerpColor(current: number, target: number, t: number): number {
  const cr = (current >> 16) & 0xFF
  const cg = (current >> 8) & 0xFF
  const cb = current & 0xFF

  const tr = (target >> 16) & 0xFF
  const tg = (target >> 8) & 0xFF
  const tb = target & 0xFF

  const r = Math.round(cr + (tr - cr) * t)
  const g = Math.round(cg + (tg - cg) * t)
  const b = Math.round(cb + (tb - cb) * t)

  return (r << 16) | (g << 8) | b
}
