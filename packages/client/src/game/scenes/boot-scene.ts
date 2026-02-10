import Phaser from 'phaser'

/**
 * Boot scene: loads PNG assets, generates procedural fallbacks
 * for tile variants / decorations / buildings, then starts WorldScene.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  preload(): void {
    // Base tile sprites (12 types)
    const tileTypes = ['grass', 'water', 'deep_water', 'forest', 'dense_forest', 'sand', 'mountain', 'road', 'building', 'farmland', 'snow', 'swamp']
    for (const type of tileTypes) {
      this.load.image(`tile_${type}`, `assets/tiles/tile_${type}.png`)
    }

    // Tile variants (3 per type)
    for (const type of tileTypes) {
      for (let v = 0; v < 3; v++) {
        this.load.image(`tile_${type}_v${v}`, `assets/tiles/variants/tile_${type}_v${v}.png`)
      }
    }

    // Agent sprites (5 characters)
    for (let i = 0; i < 5; i++) {
      this.load.image(`agent_${i}`, `assets/agents/agent_${i}.png`)
    }

    // Resource icons (6 types)
    const resourceTypes = ['wood', 'stone', 'food', 'iron', 'gold', 'herb']
    for (const type of resourceTypes) {
      this.load.image(`resource_${type}`, `assets/resources/resource_${type}.png`)
    }

    // Action icons (5 types)
    const actionTypes = ['gather', 'talk', 'craft', 'rest', 'trade']
    for (const type of actionTypes) {
      this.load.image(`action_${type}`, `assets/actions/action_${type}.png`)
    }

    // POI building sprites (6 types)
    const buildingTypes = ['marketplace', 'tavern', 'workshop', 'library', 'farm', 'mine']
    for (const type of buildingTypes) {
      this.load.image(`building_${type}`, `assets/buildings/building_${type}.png`)
    }

    // Decoration sprites (23 unique)
    const decoNames = [
      'flowers_1', 'flowers_2', 'grass_tuft', 'hay_bale', 'scarecrow',
      'bush_1', 'mushroom_1', 'fallen_log', 'pine_small', 'rock_1',
      'mushroom_2', 'moss_rock', 'fern', 'rock_2', 'rock_3',
      'shell', 'driftwood', 'lily_pad', 'cattail', 'dead_tree',
      'ice_crystal', 'dead_bush', 'cactus', 'dry_bush',
    ]
    for (const name of decoNames) {
      this.load.image(`deco_${name}`, `assets/decorations/deco_${name}.png`)
    }
  }

  create(): void {
    this.generateFallbackTextures()
    this.scene.start('WorldScene')
  }

  /* ───── procedural fallback generation ───── */

  private generateFallbackTextures(): void {
    this.generateResourceIndicator()
    this.generateTileVariants()
    this.generateBuildingFallbacks()
    this.generateDecorationFallbacks()
    this.generateAgentFallbacks()
    this.generateShadowAndRing()
  }

  /** Sparkle indicator for generic resources */
  private generateResourceIndicator(): void {
    const g = this.add.graphics()
    g.fillStyle(0xf1c40f, 0.9)
    g.beginPath()
    g.moveTo(4, 0); g.lineTo(7, 4); g.lineTo(4, 8); g.lineTo(1, 4)
    g.closePath(); g.fillPath()
    g.generateTexture('resource_indicator', 8, 8)
    g.destroy()
  }

  /**
   * For each tile type generate v0/v1/v2 variant textures (if PNG not loaded).
   * Each variant is a colored isometric diamond with subtle visual differences.
   */
  private generateTileVariants(): void {
    const baseColors: Record<string, number> = {
      grass:        0x4a8c3f,
      water:        0x1a6eaa,
      deep_water:   0x0a2a5e,
      forest:       0x2d6b33,
      dense_forest: 0x1a4a2a,
      sand:         0xd4b96a,
      mountain:     0x7a7a7a,
      road:         0x8b7d5e,
      building:     0x8a6a4a,
      farmland:     0x6b8f3f,
      snow:         0xe8e8f0,
      swamp:        0x4a5a3a,
    }

    // Tint offsets for v0/v1/v2
    const offsets = [0x000000, 0x0a0a05, -0x050a05]

    for (const [type, base] of Object.entries(baseColors)) {
      for (let v = 0; v < 3; v++) {
        const key = `tile_${type}_v${v}`
        if (this.textures.exists(key)) continue

        // Also generate plain key for v0 as fallback alias
        const color = this.clampColor(base + offsets[v])
        this.generateDiamondTexture(key, color, 128, 64, v)
      }

      // Ensure plain base key exists (fallback for renderChunk)
      const baseKey = `tile_${type}`
      if (!this.textures.exists(baseKey)) {
        this.generateDiamondTexture(baseKey, base, 128, 64, 0)
      }
    }
  }

  /** POI building fallbacks: larger colored structures on diamond base */
  private generateBuildingFallbacks(): void {
    const buildings: Record<string, { base: number; roof: number }> = {
      marketplace: { base: 0x8a6a4a, roof: 0xc9a84c },
      tavern:      { base: 0x6b4a3a, roof: 0xb85c3a },
      workshop:    { base: 0x5a5a5a, roof: 0x7a8a6a },
      library:     { base: 0x4a5a7a, roof: 0x6a7aaa },
      farm:        { base: 0x6b8f3f, roof: 0xaa8844 },
      mine:        { base: 0x5a4a3a, roof: 0x3a3a3a },
    }

    for (const [type, colors] of Object.entries(buildings)) {
      const key = `building_${type}`
      if (this.textures.exists(key)) continue

      const g = this.add.graphics()
      // Ground diamond
      g.fillStyle(colors.base, 1)
      g.beginPath()
      g.moveTo(64, 8); g.lineTo(120, 32); g.lineTo(64, 56); g.lineTo(8, 32)
      g.closePath(); g.fillPath()

      // Roof / structure
      g.fillStyle(colors.roof, 1)
      g.beginPath()
      g.moveTo(64, 0); g.lineTo(104, 18); g.lineTo(64, 36); g.lineTo(24, 18)
      g.closePath(); g.fillPath()

      // Outline
      g.lineStyle(1, 0x222222, 0.4)
      g.beginPath()
      g.moveTo(64, 0); g.lineTo(104, 18); g.lineTo(64, 36); g.lineTo(24, 18)
      g.closePath(); g.strokePath()

      g.generateTexture(key, 128, 64)
      g.destroy()
    }
  }

  /** Decoration fallbacks: tiny procedural sprites */
  private generateDecorationFallbacks(): void {
    const decos: Record<string, { color: number; shape: 'circle' | 'triangle' | 'rect' | 'cross'; w: number; h: number }> = {
      deco_flowers_1:   { color: 0xe74c8b, shape: 'circle', w: 10, h: 10 },
      deco_flowers_2:   { color: 0xf0e040, shape: 'circle', w: 10, h: 10 },
      deco_grass_tuft:  { color: 0x5aaa40, shape: 'triangle', w: 8, h: 10 },
      deco_hay_bale:    { color: 0xc4a840, shape: 'rect', w: 12, h: 8 },
      deco_scarecrow:   { color: 0x8a6a3a, shape: 'cross', w: 10, h: 14 },
      deco_bush_1:      { color: 0x3a7a2a, shape: 'circle', w: 14, h: 12 },
      deco_mushroom_1:  { color: 0xd04040, shape: 'triangle', w: 8, h: 10 },
      deco_fallen_log:  { color: 0x6a4a2a, shape: 'rect', w: 16, h: 6 },
      deco_pine_small:  { color: 0x2a5a2a, shape: 'triangle', w: 10, h: 16 },
      deco_rock_1:      { color: 0x7a7a7a, shape: 'circle', w: 10, h: 8 },
      deco_mushroom_2:  { color: 0x8a5aaa, shape: 'triangle', w: 8, h: 10 },
      deco_moss_rock:   { color: 0x5a7a5a, shape: 'circle', w: 12, h: 10 },
      deco_fern:        { color: 0x3a8a3a, shape: 'triangle', w: 12, h: 10 },
      deco_rock_2:      { color: 0x8a8a7a, shape: 'circle', w: 12, h: 10 },
      deco_rock_3:      { color: 0x6a6a6a, shape: 'rect', w: 14, h: 8 },
      deco_shell:       { color: 0xeac8a0, shape: 'circle', w: 6, h: 6 },
      deco_driftwood:   { color: 0x9a8a6a, shape: 'rect', w: 14, h: 5 },
      deco_lily_pad:    { color: 0x3a8a4a, shape: 'circle', w: 10, h: 8 },
      deco_cattail:     { color: 0x6a5a3a, shape: 'triangle', w: 4, h: 14 },
      deco_dead_tree:   { color: 0x5a4a3a, shape: 'cross', w: 10, h: 16 },
      deco_ice_crystal: { color: 0xa0d0f0, shape: 'triangle', w: 8, h: 12 },
      deco_dead_bush:   { color: 0x7a6a4a, shape: 'cross', w: 10, h: 10 },
      deco_cactus:      { color: 0x3a7a3a, shape: 'cross', w: 8, h: 14 },
      deco_dry_bush:    { color: 0x8a7a4a, shape: 'circle', w: 10, h: 8 },
    }

    for (const [key, info] of Object.entries(decos)) {
      if (this.textures.exists(key)) continue
      const g = this.add.graphics()
      g.fillStyle(info.color, 0.9)

      const cx = info.w / 2, cy = info.h / 2
      switch (info.shape) {
        case 'circle':
          g.fillEllipse(cx, cy, info.w, info.h)
          break
        case 'triangle':
          g.beginPath()
          g.moveTo(cx, 0); g.lineTo(info.w, info.h); g.lineTo(0, info.h)
          g.closePath(); g.fillPath()
          break
        case 'rect':
          g.fillRect(0, Math.floor(info.h * 0.2), info.w, Math.floor(info.h * 0.6))
          break
        case 'cross':
          g.fillRect(cx - 1, 0, 3, info.h)
          g.fillRect(0, Math.floor(info.h * 0.3), info.w, 3)
          break
      }

      g.generateTexture(key, info.w, info.h)
      g.destroy()
    }
  }

  /** Agent default fallback */
  private generateAgentFallbacks(): void {
    if (this.textures.exists('agent_0') && !this.textures.exists('agent_default')) {
      const source = this.textures.get('agent_0').getSourceImage()
      this.textures.addImage('agent_default', source as HTMLImageElement)
    }
  }

  /** Shadow + selection ring */
  private generateShadowAndRing(): void {
    const sg = this.add.graphics()
    sg.fillStyle(0x000000, 0.15)
    sg.fillEllipse(12, 4, 20, 7)
    sg.generateTexture('agent_shadow', 24, 8)
    sg.destroy()

    const rg = this.add.graphics()
    rg.lineStyle(1.5, 0xf0d060, 0.8)
    rg.strokeEllipse(12, 4, 22, 9)
    rg.generateTexture('selection_ring', 24, 8)
    rg.destroy()
  }

  /* ───── helpers ───── */

  /** Draw an isometric diamond tile with optional variant detail */
  private generateDiamondTexture(key: string, color: number, w: number, h: number, variant: number): void {
    const g = this.add.graphics()
    const hw = w / 2, hh = h / 2

    // Base diamond fill
    g.fillStyle(color, 1)
    g.beginPath()
    g.moveTo(hw, 0); g.lineTo(w, hh); g.lineTo(hw, h); g.lineTo(0, hh)
    g.closePath(); g.fillPath()

    // Variant detail: subtle inner markings
    if (variant === 1) {
      // Slight highlight stripe
      g.fillStyle(0xffffff, 0.08)
      g.beginPath()
      g.moveTo(hw, hh - 6); g.lineTo(hw + 20, hh); g.lineTo(hw, hh + 6); g.lineTo(hw - 20, hh)
      g.closePath(); g.fillPath()
    } else if (variant === 2) {
      // Small dots
      g.fillStyle(0x000000, 0.06)
      g.fillCircle(hw - 15, hh - 2, 3)
      g.fillCircle(hw + 10, hh + 5, 2)
      g.fillCircle(hw + 5, hh - 8, 2)
    }

    g.generateTexture(key, w, h)
    g.destroy()
  }

  /** Clamp color to valid 0x000000–0xffffff range */
  private clampColor(c: number): number {
    return Math.max(0, Math.min(0xffffff, c))
  }
}
