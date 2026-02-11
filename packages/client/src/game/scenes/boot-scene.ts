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

    // Agent sprites (5 characters — legacy fallback)
    for (let i = 0; i < 5; i++) {
      this.load.image(`agent_${i}`, `assets/agents/agent_${i}.png`)
    }

    // Character part sprites (layered rendering system)
    const charParts: Record<string, string[]> = {
      body:        ['slim', 'average', 'athletic', 'large'],
      armor:       ['casual', 'leather', 'chainmail', 'plate', 'cloth_robe'],
      cape:        ['short', 'long'],
      hair:        ['short_messy', 'long_straight', 'braided', 'mohawk', 'ponytail', 'bald', 'afro', 'curly', 'bob', 'spiky'],
      face:        ['round', 'oval', 'square', 'heart', 'long'],
      facialhair:  ['stubble', 'beard', 'mustache', 'goatee'],
      headgear:    ['hood', 'crown', 'circlet', 'helmet', 'wizard_hat', 'bandana'],
      acc:         ['scarf', 'necklace', 'monocle', 'earring', 'gloves', 'belt_pouch', 'glasses', 'eyepatch'],
      marking:     ['scar_left_eye', 'freckles', 'tattoo_arm', 'birthmark', 'war_paint'],
    }
    for (const [category, variants] of Object.entries(charParts)) {
      for (const v of variants) {
        this.load.image(`char_${category}_${v}`, `assets/character/${category}/char_${category}_${v}.png`)
      }
    }

    // Racial feature sprites
    const racialParts: Record<string, string[]> = {
      ear:  ['pointed', 'long_pointed', 'animal'],
      horn: ['small', 'curved', 'dragon'],
      tail: ['fox', 'cat', 'dragon', 'demon'],
      wing: ['fairy', 'bat', 'feathered'],
    }
    for (const [part, variants] of Object.entries(racialParts)) {
      for (const v of variants) {
        this.load.image(`char_racial_${part}_${v}`, `assets/character/racial/char_racial_${part}_${v}.png`)
      }
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
    this.generateCharacterFallbacks()
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

  /**
   * Procedural grayscale character part textures (48x64).
   * Real PNGs override these when present via preload().
   */
  private generateCharacterFallbacks(): void {
    const W = 48, H = 64

    // Body silhouettes (grayscale so tint works)
    const bodies: Record<string, (g: Phaser.GameObjects.Graphics) => void> = {
      char_body_slim:     g => { g.fillStyle(0xAAAAAA); g.fillRoundedRect(14, 8, 20, 48, 6) },
      char_body_average:  g => { g.fillStyle(0xAAAAAA); g.fillRoundedRect(12, 6, 24, 50, 7) },
      char_body_athletic: g => { g.fillStyle(0xAAAAAA); g.fillRoundedRect(11, 6, 26, 50, 6) },
      char_body_large:    g => { g.fillStyle(0xAAAAAA); g.fillRoundedRect(9, 4, 30, 54, 8) },
    }

    // Armor overlays
    const armors: Record<string, (g: Phaser.GameObjects.Graphics) => void> = {
      char_armor_casual:    g => { g.fillStyle(0x888888); g.fillRoundedRect(14, 18, 20, 28, 4) },
      char_armor_leather:   g => { g.fillStyle(0x777777); g.fillRoundedRect(13, 16, 22, 30, 5) },
      char_armor_chainmail: g => { g.fillStyle(0x999999); g.fillRoundedRect(12, 14, 24, 32, 5) },
      char_armor_plate:     g => { g.fillStyle(0x666666); g.fillRoundedRect(11, 12, 26, 34, 4) },
      char_armor_cloth_robe:g => { g.fillStyle(0x888888); g.fillRoundedRect(12, 14, 24, 40, 6) },
    }

    // Hair shapes
    const hairs: Record<string, (g: Phaser.GameObjects.Graphics) => void> = {
      char_hair_short_messy:   g => { g.fillStyle(0xCCCCCC); g.fillRoundedRect(12, 0, 24, 18, 8) },
      char_hair_long_straight: g => { g.fillStyle(0xCCCCCC); g.fillRoundedRect(10, 0, 28, 30, 6) },
      char_hair_braided:       g => { g.fillStyle(0xCCCCCC); g.fillRoundedRect(12, 0, 24, 28, 6) },
      char_hair_mohawk:        g => { g.fillStyle(0xCCCCCC); g.fillRoundedRect(18, 0, 12, 20, 4) },
      char_hair_ponytail:      g => { g.fillStyle(0xCCCCCC); g.fillRoundedRect(12, 0, 24, 22, 8) },
      char_hair_bald:          g => { g.fillStyle(0xBBBBBB); g.fillEllipse(24, 8, 22, 16) },
      char_hair_afro:          g => { g.fillStyle(0xCCCCCC); g.fillEllipse(24, 8, 32, 28) },
      char_hair_curly:         g => { g.fillStyle(0xCCCCCC); g.fillRoundedRect(10, 0, 28, 24, 10) },
      char_hair_bob:           g => { g.fillStyle(0xCCCCCC); g.fillRoundedRect(10, 0, 28, 22, 8) },
      char_hair_spiky:         g => {
        g.fillStyle(0xCCCCCC)
        g.beginPath(); g.moveTo(14, 16); g.lineTo(24, 0); g.lineTo(34, 16); g.closePath(); g.fillPath()
        g.fillRoundedRect(12, 8, 24, 12, 4)
      },
    }

    // Face shapes
    const faces: Record<string, (g: Phaser.GameObjects.Graphics) => void> = {
      char_face_round:   g => { g.fillStyle(0xBBBBBB); g.fillEllipse(24, 10, 20, 20) },
      char_face_oval:    g => { g.fillStyle(0xBBBBBB); g.fillEllipse(24, 11, 18, 22) },
      char_face_square:  g => { g.fillStyle(0xBBBBBB); g.fillRoundedRect(14, 2, 20, 20, 3) },
      char_face_heart:   g => { g.fillStyle(0xBBBBBB); g.fillEllipse(24, 8, 20, 18); g.beginPath(); g.moveTo(16, 14); g.lineTo(24, 22); g.lineTo(32, 14); g.closePath(); g.fillPath() },
      char_face_long:    g => { g.fillStyle(0xBBBBBB); g.fillEllipse(24, 12, 16, 24) },
    }

    // Capes
    const capes: Record<string, (g: Phaser.GameObjects.Graphics) => void> = {
      char_cape_short: g => { g.fillStyle(0x999999); g.beginPath(); g.moveTo(14, 16); g.lineTo(34, 16); g.lineTo(36, 40); g.lineTo(12, 40); g.closePath(); g.fillPath() },
      char_cape_long:  g => { g.fillStyle(0x999999); g.beginPath(); g.moveTo(14, 14); g.lineTo(34, 14); g.lineTo(38, 56); g.lineTo(10, 56); g.closePath(); g.fillPath() },
    }

    // Facial hair
    const facialHairs: Record<string, (g: Phaser.GameObjects.Graphics) => void> = {
      char_facialhair_stubble:  g => { g.fillStyle(0xAAAAAA, 0.5); g.fillRoundedRect(18, 16, 12, 8, 3) },
      char_facialhair_beard:    g => { g.fillStyle(0xAAAAAA); g.fillRoundedRect(16, 14, 16, 14, 5) },
      char_facialhair_mustache: g => { g.fillStyle(0xAAAAAA); g.fillRoundedRect(18, 14, 12, 5, 2) },
      char_facialhair_goatee:   g => { g.fillStyle(0xAAAAAA); g.fillRoundedRect(20, 16, 8, 10, 3) },
    }

    // Headgear
    const headgears: Record<string, (g: Phaser.GameObjects.Graphics) => void> = {
      char_headgear_hood:       g => { g.fillStyle(0x888888); g.fillRoundedRect(10, 0, 28, 16, 8) },
      char_headgear_crown:      g => { g.fillStyle(0xDDDD88); g.fillRect(14, 0, 20, 8); g.fillRect(16, 0, 3, 4); g.fillRect(22, 0, 3, 4); g.fillRect(28, 0, 3, 4) },
      char_headgear_circlet:    g => { g.fillStyle(0xCCCC88); g.fillRoundedRect(12, 2, 24, 4, 2) },
      char_headgear_helmet:     g => { g.fillStyle(0x777777); g.fillRoundedRect(10, 0, 28, 18, 6) },
      char_headgear_wizard_hat: g => { g.fillStyle(0x888888); g.beginPath(); g.moveTo(24, 0); g.lineTo(38, 14); g.lineTo(10, 14); g.closePath(); g.fillPath(); g.fillRect(8, 12, 32, 4) },
      char_headgear_bandana:    g => { g.fillStyle(0x999999); g.fillRoundedRect(10, 4, 28, 8, 4) },
    }

    // Accessories
    const accs: Record<string, (g: Phaser.GameObjects.Graphics) => void> = {
      char_acc_scarf:      g => { g.fillStyle(0xBBBBBB); g.fillRoundedRect(14, 18, 20, 6, 2) },
      char_acc_necklace:   g => { g.fillStyle(0xDDDD88); g.fillEllipse(24, 20, 12, 4) },
      char_acc_monocle:    g => { g.lineStyle(1, 0xDDDD88); g.strokeCircle(30, 8, 4) },
      char_acc_earring:    g => { g.fillStyle(0xDDDD88); g.fillCircle(10, 10, 2) },
      char_acc_gloves:     g => { g.fillStyle(0x999999); g.fillRoundedRect(6, 36, 8, 8, 2); g.fillRoundedRect(34, 36, 8, 8, 2) },
      char_acc_belt_pouch: g => { g.fillStyle(0x888888); g.fillRoundedRect(28, 36, 10, 8, 2) },
      char_acc_glasses:    g => { g.lineStyle(1, 0xBBBBBB); g.strokeCircle(19, 8, 4); g.strokeCircle(29, 8, 4); g.lineBetween(23, 8, 25, 8) },
      char_acc_eyepatch:   g => { g.fillStyle(0x333333); g.fillCircle(18, 8, 5) },
    }

    // Markings
    const markings: Record<string, (g: Phaser.GameObjects.Graphics) => void> = {
      char_marking_scar_left_eye: g => { g.lineStyle(2, 0xCCCCCC, 0.7); g.lineBetween(16, 4, 20, 16) },
      char_marking_freckles:      g => { g.fillStyle(0xBBBBBB, 0.6); for (const [px, py] of [[18,8],[22,6],[26,8],[20,12],[24,11]]) g.fillCircle(px, py, 1) },
      char_marking_tattoo_arm:    g => { g.lineStyle(2, 0xBBBBBB, 0.6); g.lineBetween(8, 24, 8, 40); g.lineBetween(40, 24, 40, 40) },
      char_marking_birthmark:     g => { g.fillStyle(0xBBBBBB, 0.5); g.fillEllipse(30, 12, 6, 5) },
      char_marking_war_paint:     g => { g.lineStyle(2, 0xCCCCCC, 0.6); g.lineBetween(14, 8, 22, 8); g.lineBetween(26, 8, 34, 8) },
    }

    // Racial features
    const racials: Record<string, (g: Phaser.GameObjects.Graphics) => void> = {
      char_racial_ear_pointed:      g => { g.fillStyle(0xBBBBBB); g.beginPath(); g.moveTo(6, 12); g.lineTo(2, 2); g.lineTo(12, 8); g.closePath(); g.fillPath(); g.beginPath(); g.moveTo(42, 12); g.lineTo(46, 2); g.lineTo(36, 8); g.closePath(); g.fillPath() },
      char_racial_ear_long_pointed: g => { g.fillStyle(0xBBBBBB); g.beginPath(); g.moveTo(6, 14); g.lineTo(0, 0); g.lineTo(14, 8); g.closePath(); g.fillPath(); g.beginPath(); g.moveTo(42, 14); g.lineTo(48, 0); g.lineTo(34, 8); g.closePath(); g.fillPath() },
      char_racial_ear_animal:       g => { g.fillStyle(0xBBBBBB); g.fillEllipse(12, 2, 8, 10); g.fillEllipse(36, 2, 8, 10) },
      char_racial_horn_small:       g => { g.fillStyle(0xAAAAAA); g.beginPath(); g.moveTo(16, 6); g.lineTo(14, 0); g.lineTo(18, 4); g.closePath(); g.fillPath(); g.beginPath(); g.moveTo(32, 6); g.lineTo(34, 0); g.lineTo(30, 4); g.closePath(); g.fillPath() },
      char_racial_horn_curved:      g => { g.fillStyle(0xAAAAAA); g.beginPath(); g.moveTo(14, 8); g.lineTo(8, 0); g.lineTo(18, 4); g.closePath(); g.fillPath(); g.beginPath(); g.moveTo(34, 8); g.lineTo(40, 0); g.lineTo(30, 4); g.closePath(); g.fillPath() },
      char_racial_horn_dragon:      g => { g.fillStyle(0x999999); g.beginPath(); g.moveTo(14, 10); g.lineTo(6, 0); g.lineTo(20, 6); g.closePath(); g.fillPath(); g.beginPath(); g.moveTo(34, 10); g.lineTo(42, 0); g.lineTo(28, 6); g.closePath(); g.fillPath() },
      char_racial_tail_fox:         g => { g.fillStyle(0xBBBBBB); g.fillEllipse(40, 52, 14, 8) },
      char_racial_tail_cat:         g => { g.fillStyle(0xBBBBBB); g.lineStyle(3, 0xBBBBBB); g.lineBetween(36, 50, 44, 56) },
      char_racial_tail_dragon:      g => { g.fillStyle(0x999999); g.beginPath(); g.moveTo(34, 48); g.lineTo(46, 56); g.lineTo(34, 54); g.closePath(); g.fillPath() },
      char_racial_tail_demon:       g => { g.lineStyle(2, 0xAAAAAA); g.lineBetween(34, 48, 44, 52); g.fillStyle(0xAAAAAA); g.beginPath(); g.moveTo(42, 50); g.lineTo(46, 48); g.lineTo(46, 54); g.closePath(); g.fillPath() },
      char_racial_wing_fairy:       g => { g.fillStyle(0xBBBBBB, 0.5); g.fillEllipse(6, 24, 12, 20); g.fillEllipse(42, 24, 12, 20) },
      char_racial_wing_bat:         g => { g.fillStyle(0x999999, 0.6); g.beginPath(); g.moveTo(12, 16); g.lineTo(0, 24); g.lineTo(0, 36); g.lineTo(12, 30); g.closePath(); g.fillPath(); g.beginPath(); g.moveTo(36, 16); g.lineTo(48, 24); g.lineTo(48, 36); g.lineTo(36, 30); g.closePath(); g.fillPath() },
      char_racial_wing_feathered:   g => { g.fillStyle(0xCCCCCC, 0.6); g.fillEllipse(4, 26, 10, 24); g.fillEllipse(44, 26, 10, 24) },
    }

    // Generate all fallbacks — skip if real PNG was loaded
    const allMaps = [bodies, armors, hairs, faces, capes, facialHairs, headgears, accs, markings, racials]
    for (const map of allMaps) {
      for (const [key, drawFn] of Object.entries(map)) {
        if (this.textures.exists(key)) continue
        const g = this.add.graphics()
        drawFn(g)
        g.generateTexture(key, W, H)
        g.destroy()
      }
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
