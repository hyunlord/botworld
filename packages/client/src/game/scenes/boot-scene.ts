import Phaser from 'phaser'
import { TILE_SIZE, ISO_TILE_WIDTH, ISO_TILE_HEIGHT } from '../utils/coordinates.js'

/**
 * Boot scene: loads PNG assets, generates procedural fallbacks
 * for tile variants / decorations / buildings, then starts WorldScene.
 */
export class BootScene extends Phaser.Scene {
  private assetManifest: any = null

  constructor() {
    super({ key: 'BootScene' })
  }

  preload(): void {
    // Loading screen background
    const { width, height } = this.scale
    const bg = this.add.rectangle(width / 2, height / 2, width, height, 0x0f1423)
    bg.setDepth(0)

    // Title text
    const title = this.add.text(width / 2, height / 2 - 80, 'BOTWORLD', {
      fontSize: '48px',
      fontFamily: '"Press Start 2P", "Courier New", monospace',
      color: '#FFD700',
      stroke: '#000000',
      strokeThickness: 4,
    })
    title.setOrigin(0.5)
    title.setDepth(1)

    // Subtitle
    const subtitle = this.add.text(width / 2, height / 2 - 40, 'A Living World of AI Agents', {
      fontSize: '14px',
      fontFamily: '"Inter", sans-serif',
      color: '#8A9BB8',
    })
    subtitle.setOrigin(0.5)
    subtitle.setDepth(1)

    // Progress bar background
    const barBg = this.add.rectangle(width / 2, height / 2 + 20, 300, 12, 0x1a2235)
    barBg.setStrokeStyle(1, 0x2a3a55)
    barBg.setDepth(1)

    // Progress bar fill
    const barFill = this.add.rectangle(width / 2 - 148, height / 2 + 20, 0, 8, 0xFFD700)
    barFill.setOrigin(0, 0.5)
    barFill.setDepth(2)

    // Progress text
    const progressText = this.add.text(width / 2, height / 2 + 45, 'Loading world...', {
      fontSize: '11px',
      fontFamily: '"Inter", sans-serif',
      color: '#5A6478',
    })
    progressText.setOrigin(0.5)
    progressText.setDepth(1)

    // Loading tips
    const tips = [
      'Click any object in the world to see its history',
      'Follow an agent to see their journey unfold',
      'Every item has a story — check the item card',
      'Agents form relationships, guilds, and even nations',
      'The world has seasons that affect crops and creatures',
      'Watch for world events — legendary battles happen here',
      'Star your favorite agents to track them easily',
      'Use the rankings panel to see who leads the world',
      'Buildings can be besieged during wars',
      'Agents learn skills and craft unique items',
    ]

    const tipText = this.add.text(width / 2, height - 60, `Tip: ${tips[Math.floor(Math.random() * tips.length)]}`, {
      fontSize: '12px',
      fontFamily: '"Inter", sans-serif',
      color: '#6B7A8D',
      fontStyle: 'italic',
      wordWrap: { width: 500 },
      align: 'center',
    })
    tipText.setOrigin(0.5)
    tipText.setDepth(1)

    // Rotate tips every 3 seconds
    let tipIndex = Math.floor(Math.random() * tips.length)
    const tipTimer = this.time.addEvent({
      delay: 3000,
      loop: true,
      callback: () => {
        tipIndex = (tipIndex + 1) % tips.length
        tipText.setText(`Tip: ${tips[tipIndex]}`)
      },
    })

    // Loading animation - pulsing dots after "Loading world"
    let dotCount = 0
    const dotTimer = this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        dotCount = (dotCount + 1) % 4
        const assetName = this.load.totalToLoad > 0
          ? ` (${Math.round((1 - this.load.totalToLoad / Math.max(this.load.totalComplete + this.load.totalToLoad, 1)) * 100)}%)`
          : ''
        progressText.setText('Loading world' + '.'.repeat(dotCount) + assetName)
      },
    })

    // Update progress bar on load progress
    this.load.on('progress', (value: number) => {
      barFill.width = 296 * value
    })

    // Cleanup timers when load completes
    this.load.on('complete', () => {
      tipTimer.destroy()
      dotTimer.destroy()
    })

    // ── Load asset manifest first ──
    this.load.json('asset-manifest', 'assets/asset-manifest.json')
    this.load.once('filecomplete-json-asset-manifest', () => {
      this.assetManifest = this.cache.json.get('asset-manifest')
    })

    // ── Asset loading diagnostics ──
    const loadedAssets: string[] = []
    const failedAssets: string[] = []
    this.load.on('filecomplete', (key: string) => {
      loadedAssets.push(key)
    })
    this.load.on('loaderror', (file: { key: string; url: string }) => {
      failedAssets.push(file.key)
      // Create 1x1 transparent canvas texture to prevent downstream errors
      if (!this.textures.exists(file.key)) {
        const canvas = document.createElement('canvas')
        canvas.width = 1
        canvas.height = 1
        this.textures.addCanvas(file.key, canvas)
      }
    })
    this.load.on('complete', () => {
      const total = loadedAssets.length + failedAssets.length
      console.log(`[BootScene] Assets: ${loadedAssets.length} loaded, ${failedAssets.length} failed (${total} total)`)
      if (failedAssets.length > 0) {
        console.warn('[BootScene] Failed assets:', failedAssets)
      }
    })

    // ── Isometric terrain tilemap spritesheet (primary ground layer) ──
    this.load.spritesheet('iso-terrain-sheet', 'assets/tiles/iso-terrain-sheet.png', {
      frameWidth: ISO_TILE_WIDTH,
      frameHeight: ISO_TILE_HEIGHT,
    })

    // Legacy square terrain sheet (kept for fallback/tooling)
    this.load.spritesheet('terrain-sheet', 'assets/tiles/terrain-sheet.png', {
      frameWidth: TILE_SIZE,
      frameHeight: TILE_SIZE,
    })

    // Legacy tile sprites & variants — no PNG files on disk; procedural fallbacks generated in create()

    // ── New terrain tiles (biome-specific, 20 types) ──
    const newTiles = [
      'grass_plains', 'grass_flowers', 'forest_light', 'forest_dense', 'forest_autumn',
      'mountain_low', 'mountain_high', 'mountain_rocky',
      // water_shallow, water_deep, water_river — no PNGs on disk; procedural fallbacks in create()
      'desert_sand', 'desert_oasis', 'swamp',
      'snow_field', 'snow_forest', 'farmland',
      'road_dirt', 'road_stone', 'beach',
    ]
    for (const name of newTiles) {
      this.loadImageIfExists(`tile_new_${name}`, `assets/tiles/${name}.png`)
    }

    // ── New POI building sprites (15 legacy + 14 new) ──
    const newBuildings = [
      'tavern', 'marketplace', 'blacksmith', 'library', 'temple',
      'farm', 'mine_entrance', 'fishing_hut', 'watchtower', 'guild_hall',
      'inn', 'fountain', 'ruins', 'witch_hut', 'port',
    ]
    for (const name of newBuildings) {
      this.loadImageIfExists(`bldg_${name}`, `assets/buildings/${name}.png`)
    }

    // ── Iso building sprites (bldg_ prefixed files) ──
    const isoBuildings = [
      'bldg_village_house_01', 'bldg_village_house_02', 'bldg_village_house_03', 'bldg_village_house_04',
      'bldg_village_house_large_01', 'bldg_village_house_large_02',
      'bldg_windmill_01', 'bldg_dock_01', 'bldg_bridge_stone_01',
      'bldg_wall_section_01', 'bldg_wall_section_02', 'bldg_wall_section_03', 'bldg_wall_section_04',
      'bldg_gate_01', 'bldg_workshop',
    ]
    for (const name of isoBuildings) {
      this.loadImageIfExists(name, `assets/buildings/${name}.png`)
    }

    // ── Isometric object sprites ──
    const isoObjects = [
      // Trees
      'tree_oak_01', 'tree_oak_02', 'tree_oak_03',
      'tree_pine_01', 'tree_pine_02', 'tree_pine_03',
      'tree_dead_01', 'tree_dead_02',
      'tree_palm_01', 'tree_palm_02',
      'tree_oak_autumn_01', 'tree_oak_autumn_02',
      'tree_pine_snow_01', 'tree_pine_snow_02',
      'tree_willow_01', 'tree_cherry_01', 'tree_giant_01',
      // Bushes & plants
      'bush_green_01', 'bush_green_02', 'bush_green_03',
      'bush_berry_01', 'bush_berry_02',
      'bush_flower_01', 'bush_flower_02', 'bush_flower_03',
      'fern_01', 'fern_02', 'mushroom_01', 'mushroom_02', 'mushroom_03',
      'reed_01', 'reed_02', 'cactus_01', 'cactus_02',
      // Rocks & minerals
      'rock_small_01', 'rock_small_02', 'rock_small_03',
      'rock_large_01', 'rock_large_02',
      'rock_mossy_01', 'rock_mossy_02',
      'ore_iron_01', 'ore_iron_02', 'ore_gold_01', 'ore_gold_02',
      'crystal_01', 'crystal_02',
      // Decorations
      'grass_tuft_01', 'grass_tuft_02', 'grass_tuft_03', 'grass_tuft_04', 'grass_tuft_05',
      'flower_patch_01', 'flower_patch_02', 'flower_patch_03', 'flower_patch_04',
      'pebbles_01', 'pebbles_02', 'pebbles_03',
      'fallen_log_01', 'fallen_log_02',
      'puddle_01', 'puddle_02',
      'sign_post_01', 'sign_post_02',
      'vine_01', 'vine_02',
      'bones_01', 'bones_02',
      'mushroom_ring_01', 'campfire_remains_01',
    ]
    for (const name of isoObjects) {
      this.loadImageIfExists(`obj_${name}`, `assets/objects/${name}.png`)
    }

    // ── New resource objects (17 types) ──
    const newResources = [
      'tree_oak', 'tree_pine', 'tree_palm',
      'rock_small', 'rock_large',
      'bush_berry', 'mushroom',
      'herb_green', 'herb_rare',
      'flower_red', 'flower_blue',
      'wheat', 'vegetable',
      'fish_spot',
      'ore_iron', 'ore_gold', 'ore_crystal',
    ]
    for (const name of newResources) {
      this.loadImageIfExists(`res_${name}`, `assets/resources/${name}.png`)
    }

    // ── New item icons (26 types) ──
    const newItems = [
      'sword', 'axe', 'bow', 'staff', 'dagger',
      'shield', 'helmet', 'armor_leather', 'armor_plate',
      'potion_red', 'potion_blue', 'bread', 'meat', 'fish_cooked',
      'wood', 'stone', 'iron_ingot', 'gold_ingot', 'crystal', 'leather', 'cloth',
      'gem_red', 'gem_blue', 'scroll', 'key', 'map',
    ]
    for (const name of newItems) {
      this.loadImageIfExists(`item_${name}`, `assets/items/${name}.png`)
    }

    // ── Character spritesheets (32x48 frames, 3 cols x 4 rows) ──
    const CHAR_FRAME_W = 32
    const CHAR_FRAME_H = 48

    // 8 race spritesheets
    const races = ['human', 'elf', 'dwarf', 'orc', 'beastkin', 'undead', 'fairy', 'dragonkin']
    for (const race of races) {
      this.loadSpritesheetIfExists(`char_${race}`, `assets/characters/${race}_sprite.png`, {
        frameWidth: CHAR_FRAME_W, frameHeight: CHAR_FRAME_H,
      })
      // Legacy single-frame base (backward compat)
      this.loadImageIfExists(`char_race_${race}`, `assets/characters/${race}_base.png`)
    }

    // 5 NPC spritesheets
    const npcTypes = ['merchant', 'innkeeper', 'guildmaster', 'guard', 'wanderer']
    for (const npc of npcTypes) {
      this.loadSpritesheetIfExists(`char_npc_${npc}`, `assets/characters/npc_${npc}.png`, {
        frameWidth: CHAR_FRAME_W, frameHeight: CHAR_FRAME_H,
      })
    }

    // 4 monster spritesheets
    const monsterSpriteTypes = ['goblin', 'wolf', 'skeleton', 'slime']
    for (const mon of monsterSpriteTypes) {
      this.loadSpritesheetIfExists(`char_monster_${mon}`, `assets/characters/monster_${mon}.png`, {
        frameWidth: CHAR_FRAME_W, frameHeight: CHAR_FRAME_H,
      })
    }

    // ── UI elements ──
    // Minimap POI icons
    const minimapIcons = ['tavern', 'market', 'blacksmith', 'library', 'temple', 'farm', 'mine', 'port']
    for (const name of minimapIcons) {
      this.loadImageIfExists(`minimap_${name}`, `assets/ui/minimap_icons/${name}.png`)
    }

    // Emotion bubble icons
    const emotions = ['happy', 'sad', 'angry', 'surprised', 'scared', 'love', 'thinking', 'sleepy']
    for (const name of emotions) {
      this.loadImageIfExists(`emotion_${name}`, `assets/ui/emotion_bubbles/${name}.png`)
    }

    // Speech bubble frame
    this.loadImageIfExists('speech_bubble_frame', 'assets/ui/speech_bubble.png')

    // Action indicator icons (new set)
    const newActions = ['gathering', 'crafting', 'fighting', 'resting', 'trading', 'walking', 'eating', 'exploring']
    for (const name of newActions) {
      this.loadImageIfExists(`act_${name}`, `assets/ui/action_icons/${name}.png`)
    }

    // ── Legacy assets (backward compatibility) ──

    // Agent sprites (5 characters — legacy fallback)
    for (let i = 0; i < 5; i++) {
      this.loadImageIfExists(`agent_${i}`, `assets/agents/agent_${i}.png`)
    }

    // Character part sprites & racial features — no assets/character/ directory; procedural fallbacks in create()

    // Legacy resource icons (6 types)
    const resourceTypes = ['wood', 'stone', 'food', 'iron', 'gold', 'herb']
    for (const type of resourceTypes) {
      this.loadImageIfExists(`resource_${type}`, `assets/resources/resource_${type}.png`)
    }

    // Legacy action icons (5 types)
    const actionTypes = ['gather', 'talk', 'craft', 'rest', 'trade']
    for (const type of actionTypes) {
      this.loadImageIfExists(`action_${type}`, `assets/actions/action_${type}.png`)
    }

    // Legacy building sprites & decorations — no PNGs on disk; procedural fallbacks in create()
  }

  create(): void {
    this.generateFallbackTextures()
    this.createCharacterAnimations()
    this.scene.start('WorldScene')
  }

  /* ───── procedural fallback generation ───── */

  private generateFallbackTextures(): void {
    this.generateResourceIndicator()
    this.generateTerrainTileset()
    this.generateTileVariantFallbacks()
    this.generateBuildingFallbacks()
    this.generateDecorationFallbacks()
    this.generateAgentFallbacks()
    this.generateCharacterFallbacks()
    this.generateCharacterSheetFallbacks()
    this.generateShadowAndRing()
  }

  /** Generate spritesheet fallbacks for all character types when PNGs not loaded */
  private generateCharacterSheetFallbacks(): void {
    // Race spritesheets
    const raceColors: Record<string, [number, number]> = {
      char_human:    [0x3c64a0, 0xe6be96],
      char_elf:      [0x2d7841, 0xf0dac3],
      char_dwarf:    [0x825a32, 0xdcb48c],
      char_orc:      [0x644628, 0x64a050],
      char_beastkin: [0x506e32, 0xb48c64],
      char_undead:   [0x4b414b, 0x96a59b],
      char_fairy:    [0xa0c88c, 0xf0e1eb],
      char_dragonkin:[0x503228, 0x8c463c],
    }
    for (const [key, [body, head]] of Object.entries(raceColors)) {
      this.generateCharacterSheetFallback(key, body, head)
    }

    // NPC spritesheets
    const npcColors: Record<string, [number, number]> = {
      char_npc_merchant:    [0x966e2d, 0xe1b991],
      char_npc_innkeeper:   [0xb9a591, 0xdaaf8a],
      char_npc_guildmaster: [0x322869, 0xd7b491],
      char_npc_guard:       [0x7d7d87, 0xd2af8c],
      char_npc_wanderer:    [0x5a503c, 0xc8a582],
    }
    for (const [key, [body, head]] of Object.entries(npcColors)) {
      this.generateCharacterSheetFallback(key, body, head)
    }

    // Monster spritesheets
    const monsterColors: Record<string, [number, number]> = {
      char_monster_goblin:   [0x64503c, 0x508c3c],
      char_monster_wolf:     [0x827868, 0x827868],
      char_monster_skeleton: [0xc8c3b9, 0xdcd7c8],
      char_monster_slime:    [0x3cb450, 0x3cb450],
    }
    for (const [key, [body, head]] of Object.entries(monsterColors)) {
      this.generateCharacterSheetFallback(key, body, head)
    }
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
   * Generate a single spritesheet texture ('terrain-tiles') containing all biome
   * types as 32x32 flat squares arranged in a row. Used by the Phaser Tilemap
   * in WorldScene.
   *
   * Index mapping:
   *   0: grass, 1: water, 2: deep_water, 3: river, 4: mountain,
   *   5: forest, 6: dense_forest, 7: sand, 8: snow, 9: swamp,
   *   10: road, 11: building, 12: farmland
   */
  private generateTerrainTileset(): void {
    const TS = TILE_SIZE
    const biomes: { name: string; color: number }[] = [
      { name: 'grass',        color: 0x6b8e23 },
      { name: 'water',        color: 0x2563a0 },
      { name: 'deep_water',   color: 0x1a4070 },
      { name: 'river',        color: 0x3a7cbd },
      { name: 'mountain',     color: 0x808080 },
      { name: 'forest',       color: 0x2d5a1e },
      { name: 'dense_forest', color: 0x1a3a12 },
      { name: 'sand',         color: 0xd4b86a },
      { name: 'snow',         color: 0xdde8f0 },
      { name: 'swamp',        color: 0x4a5a3a },
      { name: 'road',         color: 0x8b7355 },
      { name: 'building',     color: 0xa08060 },
      { name: 'farmland',     color: 0x8b9a4b },
    ]

    const totalWidth = biomes.length * TS
    const g = this.add.graphics()

    for (let i = 0; i < biomes.length; i++) {
      const x = i * TS
      const { color } = biomes[i]

      // Solid fill
      g.fillStyle(color, 1)
      g.fillRect(x, 0, TS, TS)

      // Subtle noise texture: tiny dots at low opacity for visual interest
      const seed = (color * 73856093) >>> 0
      for (let d = 0; d < 12; d++) {
        const s = ((seed + d * 131 + d * d * 17) & 0xFFFF) / 0xFFFF
        const t = ((seed + d * 97 + d * d * 31) & 0xFFFF) / 0xFFFF
        const dx = x + Math.floor(s * (TS - 4)) + 2
        const dy = Math.floor(t * (TS - 4)) + 2
        const isLight = d % 3 === 0
        g.fillStyle(isLight ? 0xffffff : 0x000000, 0.06)
        g.fillCircle(dx, dy, 1)
      }
    }

    g.generateTexture('terrain-tiles', totalWidth, TS)
    g.destroy()
  }

  /**
   * Generate legacy tile_TYPE_vN variant textures as flat 32x32 squares
   * (fallback when PNG not loaded). Also generates plain tile_TYPE keys.
   */
  private generateTileVariantFallbacks(): void {
    const baseColors: Record<string, number> = {
      grass:        0x5a9a4a,
      water:        0x2878b0,
      deep_water:   0x0e3868,
      forest:       0x3a7840,
      dense_forest: 0x1e5428,
      sand:         0xd8c478,
      mountain:     0x8a8888,
      road:         0x9a8b6e,
      building:     0x8a6a4a,
      farmland:     0x6e9440,
      snow:         0xeaecf4,
      swamp:        0x4e5e3e,
      river:        0x3a7cbd,
    }

    const offsets = [0x000000, 0x0a0a05, -0x050a05]
    const TS = TILE_SIZE

    for (const [type, base] of Object.entries(baseColors)) {
      for (let v = 0; v < 3; v++) {
        const key = `tile_${type}_v${v}`
        if (this.textures.exists(key)) continue

        const color = this.clampColor(base + offsets[v])
        this.generateFlatTileTexture(key, color, TS, v)
      }

      // Ensure plain base key exists
      const baseKey = `tile_${type}`
      if (!this.textures.exists(baseKey)) {
        this.generateFlatTileTexture(baseKey, base, TS, 0)
      }
    }

    // Generate new-style tile keys as flat squares if PNG not loaded
    const newTileColors: Record<string, number> = {
      tile_new_grass_plains:  0x6b8e23,
      tile_new_grass_flowers: 0x7a9e33,
      tile_new_forest_light:  0x3a7840,
      tile_new_forest_dense:  0x1e5428,
      tile_new_forest_autumn: 0x8a6a30,
      tile_new_mountain_low:  0x808080,
      tile_new_mountain_high: 0x606060,
      tile_new_mountain_rocky:0x707070,
      tile_new_water_shallow: 0x2878b0,
      tile_new_water_deep:    0x0e3868,
      tile_new_water_river:   0x3a7cbd,
      tile_new_desert_sand:   0xd8c478,
      tile_new_desert_oasis:  0x4a9a6a,
      tile_new_swamp:         0x4e5e3e,
      tile_new_snow_field:    0xdde8f0,
      tile_new_snow_forest:   0x4a7a5a,
      tile_new_farmland:      0x8b9a4b,
      tile_new_road_dirt:     0x9a8b6e,
      tile_new_road_stone:    0x8a8a8a,
      tile_new_beach:         0xd4b86a,
    }

    for (const [key, color] of Object.entries(newTileColors)) {
      if (this.textures.exists(key)) continue
      this.generateFlatTileTexture(key, color, TS, 0)
    }
  }

  /** POI building fallbacks: colored rectangles at 64x64 */
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
      // Base structure
      g.fillStyle(colors.base, 1)
      g.fillRoundedRect(4, 20, 56, 40, 4)
      // Roof
      g.fillStyle(colors.roof, 1)
      g.fillRoundedRect(2, 8, 60, 18, 4)
      // Roof highlight
      g.fillStyle(0xffffff, 0.12)
      g.fillRect(4, 8, 56, 6)
      // Door
      g.fillStyle(0x000000, 0.3)
      g.fillRoundedRect(24, 40, 16, 20, 3)

      g.generateTexture(key, 64, 64)
      g.destroy()
    }

    // New building fallbacks at correct per-building sizes
    const newBuildings: Record<string, { base: number; roof: number; w: number; h: number }> = {
      bldg_tavern:       { base: 0x6b4a3a, roof: 0xb85c3a, w: 96,  h: 64 },
      bldg_marketplace:  { base: 0x8a6a4a, roof: 0xc9a84c, w: 128, h: 96 },
      bldg_blacksmith:   { base: 0x5a5a5a, roof: 0x7a8a6a, w: 64,  h: 64 },
      bldg_library:      { base: 0x4a5a7a, roof: 0x6a7aaa, w: 96,  h: 96 },
      bldg_temple:       { base: 0x8a8aaa, roof: 0xc0c0d0, w: 96,  h: 64 },
      bldg_farm:         { base: 0x6b8f3f, roof: 0xaa8844, w: 128, h: 96 },
      bldg_mine_entrance:{ base: 0x5a4a3a, roof: 0x3a3a3a, w: 64,  h: 64 },
      bldg_fishing_hut:  { base: 0x6a7a8a, roof: 0x4a6a7a, w: 64,  h: 64 },
      bldg_watchtower:   { base: 0x7a6a5a, roof: 0x5a5a5a, w: 64,  h: 64 },
      bldg_guild_hall:   { base: 0x6a5a7a, roof: 0x8a7a9a, w: 96,  h: 96 },
      bldg_inn:          { base: 0x7a5a3a, roof: 0xaa7a4a, w: 96,  h: 64 },
      bldg_fountain:     { base: 0x6a8aaa, roof: 0x4a7a9a, w: 64,  h: 64 },
      bldg_ruins:        { base: 0x6a6a6a, roof: 0x5a5a5a, w: 96,  h: 64 },
      bldg_witch_hut:    { base: 0x3a4a3a, roof: 0x5a3a5a, w: 64,  h: 64 },
      bldg_port:         { base: 0x5a6a7a, roof: 0x3a5a6a, w: 128, h: 64 },
      // New iso buildings
      bldg_village_house_01: { base: 0x8a6a4a, roof: 0xb85c3a, w: 128, h: 120 },
      bldg_village_house_02: { base: 0xe0dcc8, roof: 0x946434, w: 128, h: 120 },
      bldg_village_house_03: { base: 0x8a6a4a, roof: 0x4a5a7a, w: 128, h: 120 },
      bldg_village_house_04: { base: 0x828288, roof: 0xc87832, w: 128, h: 120 },
      bldg_village_house_large_01: { base: 0x8a6a4a, roof: 0xb85c3a, w: 192, h: 140 },
      bldg_village_house_large_02: { base: 0x8a6a4a, roof: 0x946434, w: 192, h: 140 },
      bldg_windmill_01:  { base: 0x828288, roof: 0x946434, w: 128, h: 160 },
      bldg_dock_01:      { base: 0x8a6a4a, roof: 0x6a7a8a, w: 256, h: 120 },
      bldg_bridge_stone_01: { base: 0x828288, roof: 0x828288, w: 128, h: 80 },
      bldg_wall_section_01: { base: 0x828288, roof: 0x6e6e73, w: 96, h: 80 },
      bldg_wall_section_02: { base: 0x828288, roof: 0x6e6e73, w: 96, h: 80 },
      bldg_wall_section_03: { base: 0x828288, roof: 0x6e6e73, w: 96, h: 80 },
      bldg_wall_section_04: { base: 0x828288, roof: 0x6e6e73, w: 96, h: 80 },
      bldg_gate_01:      { base: 0x828288, roof: 0x6e6e73, w: 128, h: 160 },
      bldg_workshop:     { base: 0x8a6a4a, roof: 0x946434, w: 96, h: 96 },
    }

    for (const [key, colors] of Object.entries(newBuildings)) {
      if (this.textures.exists(key)) continue

      const { w, h } = colors
      const g = this.add.graphics()
      // Base structure scaled to building dimensions
      const baseX = Math.round(w * 0.06)
      const baseY = Math.round(h * 0.3)
      const baseW = Math.round(w * 0.88)
      const baseH = Math.round(h * 0.6)
      g.fillStyle(colors.base, 1)
      g.fillRoundedRect(baseX, baseY, baseW, baseH, 4)
      // Roof
      const roofX = Math.round(w * 0.03)
      const roofY = Math.round(h * 0.12)
      const roofW = Math.round(w * 0.94)
      const roofH = Math.round(h * 0.25)
      g.fillStyle(colors.roof, 1)
      g.fillRoundedRect(roofX, roofY, roofW, roofH, 4)
      g.fillStyle(0xffffff, 0.12)
      g.fillRect(roofX + 2, roofY, roofW - 4, Math.round(roofH * 0.35))
      // Door
      const doorW = Math.round(w * 0.16)
      const doorH = Math.round(h * 0.28)
      g.fillStyle(0x000000, 0.3)
      g.fillRoundedRect(Math.round((w - doorW) / 2), baseY + baseH - doorH, doorW, doorH, 3)

      g.generateTexture(key, w, h)
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
      // Additional decorations emitted by world generation
      deco_pebbles:       { color: 0x8a8a7a, shape: 'circle', w: 12, h: 8 },
      deco_bones:         { color: 0xe8e0d0, shape: 'cross', w: 10, h: 10 },
      deco_butterfly:     { color: 0xe0a040, shape: 'circle', w: 6, h: 6 },
      deco_ruins_pillar:  { color: 0x7a7a7a, shape: 'rect', w: 8, h: 16 },
      deco_ruins_stone:   { color: 0x6a6a6a, shape: 'rect', w: 12, h: 8 },
      deco_giant_tree:    { color: 0x2a6a2a, shape: 'triangle', w: 16, h: 20 },
      deco_mushroom_ring: { color: 0xd04040, shape: 'circle', w: 14, h: 14 },
      deco_cave_entrance: { color: 0x2a2a2a, shape: 'rect', w: 14, h: 10 },
      deco_bridge_stone:  { color: 0x8a8a8a, shape: 'rect', w: 16, h: 8 },
      // Non-prefixed decorations from world generation
      tree_roadside:      { color: 0x3a7a3a, shape: 'triangle', w: 10, h: 14 },
      ripple:             { color: 0x5a9ac0, shape: 'circle', w: 10, h: 6 },
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

    // Body silhouettes (grayscale so tint works) with shading
    const bodies: Record<string, (g: Phaser.GameObjects.Graphics) => void> = {
      char_body_slim:     g => {
        g.fillStyle(0xAAAAAA); g.fillRoundedRect(14, 8, 20, 48, 6)
        g.fillStyle(0x888888); g.fillRect(14, 8, 1, 48); g.fillRect(33, 8, 1, 48) // edges
      },
      char_body_average:  g => {
        g.fillStyle(0xAAAAAA); g.fillRoundedRect(12, 6, 24, 50, 7)
        g.fillStyle(0x888888); g.fillRect(12, 6, 1, 50); g.fillRect(35, 6, 1, 50)
      },
      char_body_athletic: g => {
        g.fillStyle(0xAAAAAA); g.fillRoundedRect(11, 6, 26, 50, 6)
        g.fillStyle(0x888888); g.fillRect(11, 6, 1, 50); g.fillRect(36, 6, 1, 50)
      },
      char_body_large:    g => {
        g.fillStyle(0xAAAAAA); g.fillRoundedRect(9, 4, 30, 54, 8)
        g.fillStyle(0x888888); g.fillRect(9, 4, 2, 54); g.fillRect(37, 4, 2, 54)
      },
    }

    // Armor overlays with shading and detail lines
    const armors: Record<string, (g: Phaser.GameObjects.Graphics) => void> = {
      char_armor_casual:    g => {
        g.fillStyle(0x888888); g.fillRoundedRect(14, 18, 20, 28, 4)
        g.fillStyle(0x666666); g.fillRect(14, 18, 1, 28); g.fillRect(33, 18, 1, 28)
      },
      char_armor_leather:   g => {
        g.fillStyle(0x777777); g.fillRoundedRect(13, 16, 22, 30, 5)
        g.fillStyle(0x555555); g.fillRect(13, 16, 1, 30); g.fillRect(34, 16, 1, 30)
        g.fillRect(24, 20, 1, 22) // center seam
      },
      char_armor_chainmail: g => {
        g.fillStyle(0x999999); g.fillRoundedRect(12, 14, 24, 32, 5)
        g.fillStyle(0x777777)
        // Horizontal chain lines
        for (let y = 16; y < 44; y += 3) {
          g.fillRect(13, y, 22, 1)
        }
      },
      char_armor_plate:     g => {
        g.fillStyle(0x666666); g.fillRoundedRect(11, 12, 26, 34, 4)
        g.fillStyle(0x444444)
        // Vertical plate segments
        g.fillRect(11, 12, 1, 34); g.fillRect(36, 12, 1, 34)
        g.fillRect(19, 12, 1, 34); g.fillRect(29, 12, 1, 34)
        // Horizontal plate lines
        g.fillRect(11, 24, 26, 1); g.fillRect(11, 36, 26, 1)
      },
      char_armor_cloth_robe:g => {
        g.fillStyle(0x888888); g.fillRoundedRect(12, 14, 24, 40, 6)
        g.fillStyle(0x666666); g.fillRect(12, 14, 1, 40); g.fillRect(35, 14, 1, 40)
      },
    }

    // Hair shapes with more distinct styles
    const hairs: Record<string, (g: Phaser.GameObjects.Graphics) => void> = {
      char_hair_short_messy:   g => {
        g.fillStyle(0xCCCCCC); g.fillRoundedRect(12, 0, 24, 18, 8)
        g.fillStyle(0xAAAAAA); g.fillRect(12, 0, 1, 16); g.fillRect(35, 0, 1, 16)
      },
      char_hair_long_straight: g => {
        g.fillStyle(0xCCCCCC); g.fillRoundedRect(10, 0, 28, 30, 6)
        g.fillStyle(0xAAAAAA); g.fillRect(10, 4, 1, 26); g.fillRect(37, 4, 1, 26) // edges
      },
      char_hair_braided:       g => {
        g.fillStyle(0xCCCCCC); g.fillRoundedRect(12, 0, 24, 28, 6)
        g.fillStyle(0xAAAAAA)
        // Braid texture
        for (let y = 4; y < 26; y += 4) {
          g.fillRect(20, y, 8, 2)
        }
      },
      char_hair_mohawk:        g => {
        g.fillStyle(0xCCCCCC); g.fillRoundedRect(18, 0, 12, 20, 4)
        g.fillStyle(0xAAAAAA); g.fillRect(18, 0, 1, 20); g.fillRect(29, 0, 1, 20)
      },
      char_hair_ponytail:      g => {
        g.fillStyle(0xCCCCCC); g.fillRoundedRect(12, 0, 24, 22, 8)
        g.fillEllipse(36, 12, 8, 14) // ponytail bump
        g.fillStyle(0xAAAAAA); g.fillRect(12, 0, 1, 20); g.fillRect(35, 0, 1, 20)
      },
      char_hair_bald:          g => {
        g.fillStyle(0xBBBBBB); g.fillEllipse(24, 8, 22, 16)
      },
      char_hair_afro:          g => {
        g.fillStyle(0xCCCCCC); g.fillEllipse(24, 8, 32, 28)
        g.fillStyle(0xAAAAAA)
        // Bumpy outline texture
        for (let i = 0; i < 360; i += 40) {
          const rad = (i * Math.PI) / 180
          const x = 24 + Math.cos(rad) * 14
          const y = 8 + Math.sin(rad) * 12
          g.fillCircle(x, y, 2)
        }
      },
      char_hair_curly:         g => {
        g.fillStyle(0xCCCCCC); g.fillRoundedRect(10, 0, 28, 24, 10)
        g.fillStyle(0xAAAAAA)
        // Curly bumps
        for (let y = 4; y < 22; y += 6) {
          g.fillCircle(12, y, 2); g.fillCircle(36, y, 2)
        }
      },
      char_hair_bob:           g => {
        g.fillStyle(0xCCCCCC); g.fillRoundedRect(10, 0, 28, 22, 8)
        g.fillStyle(0xAAAAAA); g.fillRect(10, 0, 1, 22); g.fillRect(37, 0, 1, 22)
      },
      char_hair_spiky:         g => {
        g.fillStyle(0xCCCCCC)
        // Multiple spikes
        g.beginPath(); g.moveTo(14, 14); g.lineTo(18, 0); g.lineTo(22, 14); g.closePath(); g.fillPath()
        g.beginPath(); g.moveTo(20, 16); g.lineTo(24, 2); g.lineTo(28, 16); g.closePath(); g.fillPath()
        g.beginPath(); g.moveTo(26, 14); g.lineTo(30, 0); g.lineTo(34, 14); g.closePath(); g.fillPath()
        g.fillRoundedRect(12, 8, 24, 10, 4)
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

    // Race+Gender body placeholders (new 14-layer system)
    const raceGenderBodies: Record<string, (g: Phaser.GameObjects.Graphics) => void> = {
      // Human
      char_body_human_male:    g => { g.fillStyle(0xAAAAAA); g.fillRoundedRect(12, 6, 24, 50, 7) },
      char_body_human_female:  g => { g.fillStyle(0xAAAAAA); g.fillRoundedRect(13, 6, 22, 48, 7) },
      // Elf (slimmer)
      char_body_elf_male:      g => { g.fillStyle(0xAAAAAA); g.fillRoundedRect(14, 4, 20, 52, 6) },
      char_body_elf_female:    g => { g.fillStyle(0xAAAAAA); g.fillRoundedRect(15, 4, 18, 50, 6) },
      // Dwarf (shorter, wider)
      char_body_dwarf_male:    g => { g.fillStyle(0xAAAAAA); g.fillRoundedRect(10, 12, 28, 44, 8) },
      char_body_dwarf_female:  g => { g.fillStyle(0xAAAAAA); g.fillRoundedRect(11, 12, 26, 42, 8) },
      // Orc (bigger, muscular)
      char_body_orc_male:      g => { g.fillStyle(0xAAAAAA); g.fillRoundedRect(8, 4, 32, 54, 7) },
      char_body_orc_female:    g => { g.fillStyle(0xAAAAAA); g.fillRoundedRect(10, 4, 28, 52, 7) },
      // Beastkin
      char_body_beastkin_male:   g => { g.fillStyle(0xAAAAAA); g.fillRoundedRect(11, 6, 26, 50, 7) },
      char_body_beastkin_female: g => { g.fillStyle(0xAAAAAA); g.fillRoundedRect(12, 6, 24, 48, 7) },
      // Undead (gaunt)
      char_body_undead_male:   g => { g.fillStyle(0xAAAAAA); g.fillRoundedRect(14, 6, 20, 50, 5) },
      char_body_undead_female: g => { g.fillStyle(0xAAAAAA); g.fillRoundedRect(15, 6, 18, 48, 5) },
      // Fairy (small)
      char_body_fairy_male:    g => { g.fillStyle(0xAAAAAA); g.fillRoundedRect(16, 14, 16, 38, 6) },
      char_body_fairy_female:  g => { g.fillStyle(0xAAAAAA); g.fillRoundedRect(17, 14, 14, 36, 6) },
      // Dragonkin (big, scales)
      char_body_dragonkin_male:   g => { g.fillStyle(0xAAAAAA); g.fillRoundedRect(8, 2, 32, 56, 6) },
      char_body_dragonkin_female: g => { g.fillStyle(0xAAAAAA); g.fillRoundedRect(10, 2, 28, 54, 6) },
    }

    // Pants placeholders
    const pants: Record<string, (g: Phaser.GameObjects.Graphics) => void> = {
      char_pants_cloth_pants:     g => { g.fillStyle(0x999999); g.fillRoundedRect(14, 38, 20, 20, 3) },
      char_pants_leather_pants:   g => { g.fillStyle(0x888888); g.fillRoundedRect(14, 36, 20, 22, 4) },
      char_pants_chain_leggings:  g => { g.fillStyle(0x777777); g.fillRoundedRect(13, 36, 22, 22, 3) },
      char_pants_plate_leggings:  g => { g.fillStyle(0x666666); g.fillRoundedRect(12, 36, 24, 22, 3) },
      char_pants_robe_skirt:      g => { g.fillStyle(0x999999); g.fillRoundedRect(12, 34, 24, 26, 5) },
    }

    // Shoes placeholders
    const shoes: Record<string, (g: Phaser.GameObjects.Graphics) => void> = {
      char_shoes_sandals:       g => { g.fillStyle(0x8B7355); g.fillRoundedRect(14, 56, 20, 6, 2) },
      char_shoes_boots:         g => { g.fillStyle(0x6B4423); g.fillRoundedRect(13, 52, 22, 10, 3) },
      char_shoes_armored_boots: g => { g.fillStyle(0x555555); g.fillRoundedRect(12, 50, 24, 12, 3) },
      char_shoes_mage_shoes:    g => { g.fillStyle(0x4444AA); g.fillRoundedRect(14, 54, 20, 8, 3) },
    }

    // Weapon placeholders
    const weapons: Record<string, (g: Phaser.GameObjects.Graphics) => void> = {
      char_weapon_sword:       g => { g.fillStyle(0xCCCCCC); g.fillRect(22, 2, 4, 30); g.fillStyle(0x8B7355); g.fillRect(18, 30, 12, 4) },
      char_weapon_greatsword:  g => { g.fillStyle(0xCCCCCC); g.fillRect(20, 0, 8, 38); g.fillStyle(0x8B7355); g.fillRect(16, 36, 16, 4) },
      char_weapon_axe:         g => { g.fillStyle(0x8B7355); g.fillRect(22, 8, 4, 30); g.fillStyle(0xAAAAAA); g.beginPath(); g.moveTo(26, 8); g.lineTo(36, 14); g.lineTo(26, 20); g.closePath(); g.fillPath() },
      char_weapon_dagger:      g => { g.fillStyle(0xCCCCCC); g.fillRect(22, 14, 4, 18); g.fillStyle(0x8B7355); g.fillRect(20, 30, 8, 3) },
      char_weapon_spear:       g => { g.fillStyle(0x8B7355); g.fillRect(23, 4, 3, 44); g.fillStyle(0xCCCCCC); g.beginPath(); g.moveTo(20, 4); g.lineTo(24, 0); g.lineTo(28, 4); g.closePath(); g.fillPath() },
      char_weapon_bow:         g => { g.fillStyle(0x8B7355); g.beginPath(); g.arc(24, 24, 16, -1.2, 1.2, false); g.strokePath(); g.lineStyle(1, 0xCCCCCC); g.lineBetween(24, 8, 24, 40) },
      char_weapon_staff:       g => { g.fillStyle(0x8B7355); g.fillRect(22, 0, 4, 48); g.fillStyle(0x6644CC); g.fillCircle(24, 4, 6) },
      char_weapon_wand:        g => { g.fillStyle(0x8B7355); g.fillRect(22, 16, 4, 28); g.fillStyle(0xFFDD44); g.fillCircle(24, 16, 4) },
      char_weapon_hammer:      g => { g.fillStyle(0x8B7355); g.fillRect(22, 10, 4, 30); g.fillStyle(0x888888); g.fillRect(16, 6, 16, 10) },
      char_weapon_mace:        g => { g.fillStyle(0x8B7355); g.fillRect(22, 14, 4, 26); g.fillStyle(0x888888); g.fillCircle(24, 12, 8) },
    }

    // Shield placeholders
    const shields: Record<string, (g: Phaser.GameObjects.Graphics) => void> = {
      char_shield_buckler:      g => { g.fillStyle(0x888888); g.fillCircle(24, 28, 10) },
      char_shield_kite_shield:  g => { g.fillStyle(0x777777); g.beginPath(); g.moveTo(14, 14); g.lineTo(34, 14); g.lineTo(34, 32); g.lineTo(24, 44); g.lineTo(14, 32); g.closePath(); g.fillPath() },
      char_shield_tower_shield: g => { g.fillStyle(0x666666); g.fillRoundedRect(12, 10, 24, 36, 4) },
    }

    // Helmet placeholders
    const helmets: Record<string, (g: Phaser.GameObjects.Graphics) => void> = {
      char_helmet_leather_cap: g => { g.fillStyle(0x8B6544); g.fillRoundedRect(12, 0, 24, 12, 6) },
      char_helmet_chain_coif:  g => { g.fillStyle(0x999999); g.fillRoundedRect(10, 0, 28, 16, 6) },
      char_helmet_iron_helm:   g => { g.fillStyle(0x777777); g.fillRoundedRect(10, 0, 28, 16, 4); g.fillRect(14, 8, 4, 10) },
      char_helmet_full_helm:   g => { g.fillStyle(0x666666); g.fillRoundedRect(8, 0, 32, 20, 6); g.fillStyle(0x333333); g.fillRect(14, 10, 20, 3) },
      char_helmet_crown:       g => { g.fillStyle(0xFFD700); g.fillRoundedRect(12, 0, 24, 10, 2); g.beginPath(); g.moveTo(14, 0); g.lineTo(16, -6); g.lineTo(18, 0); g.moveTo(22, 0); g.lineTo(24, -8); g.lineTo(26, 0); g.moveTo(30, 0); g.lineTo(32, -6); g.lineTo(34, 0); g.closePath(); g.fillPath() },
    }

    // Cloak placeholders
    const cloaks: Record<string, (g: Phaser.GameObjects.Graphics) => void> = {
      char_cloak_short_cloak: g => { g.fillStyle(0x555555); g.fillRoundedRect(10, 10, 28, 30, 6) },
      char_cloak_long_cloak:  g => { g.fillStyle(0x444444); g.fillRoundedRect(8, 8, 32, 46, 8) },
      char_cloak_royal_cloak: g => { g.fillStyle(0x880000); g.fillRoundedRect(6, 6, 36, 50, 8); g.fillStyle(0xFFFFFF); g.fillEllipse(12, 10, 6, 4); g.fillEllipse(36, 10, 6, 4) },
    }

    // Hair split (front/back) placeholders
    const hairBacks: Record<string, (g: Phaser.GameObjects.Graphics) => void> = {
      char_hair_back_long_straight: g => { g.fillStyle(0xCCCCCC); g.fillRoundedRect(10, 4, 28, 36, 6) },
      char_hair_back_long_braided:  g => { g.fillStyle(0xCCCCCC); g.fillRoundedRect(18, 4, 12, 40, 4) },
      char_hair_back_ponytail:      g => { g.fillStyle(0xCCCCCC); g.fillRoundedRect(26, 4, 8, 28, 4) },
      char_hair_back_twin_tails:    g => { g.fillStyle(0xCCCCCC); g.fillRoundedRect(8, 4, 8, 28, 4); g.fillRoundedRect(32, 4, 8, 28, 4) },
      char_hair_back_medium_wavy:   g => { g.fillStyle(0xCCCCCC); g.fillRoundedRect(10, 4, 28, 24, 8) },
    }

    const hairFronts: Record<string, (g: Phaser.GameObjects.Graphics) => void> = {
      char_hair_front_short_crop:     g => { g.fillStyle(0xCCCCCC); g.fillRoundedRect(12, 0, 24, 14, 6) },
      char_hair_front_medium_wavy:    g => { g.fillStyle(0xCCCCCC); g.fillRoundedRect(12, 0, 24, 16, 8) },
      char_hair_front_long_straight:  g => { g.fillStyle(0xCCCCCC); g.fillRoundedRect(10, 0, 28, 14, 6) },
      char_hair_front_long_braided:   g => { g.fillStyle(0xCCCCCC); g.fillRoundedRect(12, 0, 24, 14, 6) },
      char_hair_front_ponytail:       g => { g.fillStyle(0xCCCCCC); g.fillRoundedRect(12, 0, 24, 14, 8) },
      char_hair_front_mohawk:         g => { g.fillStyle(0xCCCCCC); g.fillRoundedRect(18, 0, 12, 20, 4) },
      char_hair_front_curly:          g => { g.fillStyle(0xCCCCCC); g.fillRoundedRect(10, 0, 28, 18, 10) },
      char_hair_front_twin_tails:     g => { g.fillStyle(0xCCCCCC); g.fillRoundedRect(12, 0, 24, 14, 6) },
      char_hair_front_topknot:        g => { g.fillStyle(0xCCCCCC); g.fillCircle(24, 0, 8) },
    }

    // Generate all fallbacks — skip if real PNG was loaded
    const allMaps = [
      bodies, armors, hairs, faces, capes, facialHairs, headgears, accs, markings, racials,
      raceGenderBodies, pants, shoes, weapons, shields, helmets, cloaks, hairBacks, hairFronts,
    ]
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

  /**
   * Create walk animations for all character spritesheets.
   * Frame layout per sheet (3 cols x 4 rows, 32x48 each):
   *   Row 0 (down):  0, 1, 2
   *   Row 1 (left):  3, 4, 5
   *   Row 2 (right): 6, 7, 8
   *   Row 3 (up):    9, 10, 11
   * Walk cycle: walk1 → stand → walk2 → stand (frameRate 5)
   */
  private createCharacterAnimations(): void {
    const allKeys: string[] = []

    // Races
    for (const race of ['human', 'elf', 'dwarf', 'orc', 'beastkin', 'undead', 'fairy', 'dragonkin']) {
      allKeys.push(`char_${race}`)
    }
    // NPCs
    for (const npc of ['merchant', 'innkeeper', 'guildmaster', 'guard', 'wanderer']) {
      allKeys.push(`char_npc_${npc}`)
    }
    // Monsters
    for (const mon of ['goblin', 'wolf', 'skeleton', 'slime']) {
      allKeys.push(`char_monster_${mon}`)
    }

    const dirs: { name: string; row: number }[] = [
      { name: 'down',  row: 0 },
      { name: 'left',  row: 1 },
      { name: 'right', row: 2 },
      { name: 'up',    row: 3 },
    ]

    for (const key of allKeys) {
      if (!this.textures.exists(key)) continue

      for (const dir of dirs) {
        const base = dir.row * 3
        // Walk animation: walk1 → stand → walk2 → stand
        this.anims.create({
          key: `${key}_walk_${dir.name}`,
          frames: [
            { key, frame: base + 0 },
            { key, frame: base + 1 },
            { key, frame: base + 2 },
            { key, frame: base + 1 },
          ],
          frameRate: 5,
          repeat: -1,
        })
        // Idle: single stand frame
        this.anims.create({
          key: `${key}_idle_${dir.name}`,
          frames: [{ key, frame: base + 1 }],
          frameRate: 1,
          repeat: 0,
        })
      }
    }
  }

  /**
   * Generate a spritesheet fallback for a character key.
   * Draws a simple colored humanoid in 12 frames (3x4 grid, 32x48 each).
   */
  private generateCharacterSheetFallback(key: string, bodyColor: number, headColor: number): void {
    if (this.textures.exists(key)) return

    const FW = 32, FH = 48
    const SW = FW * 3, SH = FH * 4
    const g = this.add.graphics()

    // Extract race-specific proportions and features
    const isHuman = key.includes('human')
    const isElf = key.includes('elf')
    const isDwarf = key.includes('dwarf')
    const isOrc = key.includes('orc')
    const isUndead = key.includes('undead')
    const isFairy = key.includes('fairy')
    const isDragonkin = key.includes('dragonkin')
    const isBeastkin = key.includes('beastkin')

    // Race-specific proportions
    const headSize = isFairy ? 4 : isDwarf ? 7 : 6
    const bodyWidth = isDwarf ? 12 : isOrc ? 12 : isDragonkin ? 12 : isElf ? 8 : isFairy ? 6 : 10
    const bodyHeight = isDwarf ? 11 : isElf ? 16 : isFairy ? 10 : 14
    const bodyY = isDwarf ? 20 : isElf ? 17 : isFairy ? 22 : 18
    const legLength = isDwarf ? 8 : isElf ? 12 : isFairy ? 6 : 10
    const shoulderWidth = isOrc ? 14 : isDragonkin ? 14 : isDwarf ? 13 : 10

    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 3; col++) {
        const fx = col * FW
        const fy = row * FH
        const cx = fx + 16
        const walkShift = col === 0 ? -2 : col === 2 ? 2 : 0

        // Shadow
        g.fillStyle(0x000000, 0.2)
        g.fillEllipse(cx, fy + 44, 14, 4)

        // Legs with shading
        const legY = bodyY + bodyHeight
        g.fillStyle(bodyColor, 0.7)
        g.fillRect(cx - 3 + walkShift, fy + legY, 3, legLength)
        g.fillRect(cx + 1 - walkShift, fy + legY, 3, legLength)
        // Boot line at bottom
        const darkerBody = this.darkenColor(bodyColor, 0.3)
        g.fillStyle(darkerBody, 1)
        g.fillRect(cx - 3 + walkShift, fy + legY + legLength - 2, 3, 2)
        g.fillRect(cx + 1 - walkShift, fy + legY + legLength - 2, 3, 2)

        // Body with clothing outline and belt
        g.fillStyle(bodyColor, 1)
        g.fillRoundedRect(cx - bodyWidth / 2, fy + bodyY, bodyWidth, bodyHeight, 2)
        // Shoulders (wider for orcs/dragonkin)
        if (isOrc || isDragonkin) {
          g.fillStyle(bodyColor, 0.9)
          g.fillRoundedRect(cx - shoulderWidth / 2, fy + bodyY, shoulderWidth, 5, 2)
        }
        // Clothing outline (darker edge)
        g.fillStyle(darkerBody, 1)
        g.fillRect(cx - bodyWidth / 2, fy + bodyY, 1, bodyHeight) // left edge
        g.fillRect(cx + bodyWidth / 2 - 1, fy + bodyY, 1, bodyHeight) // right edge
        // Belt line
        const beltY = fy + bodyY + Math.floor(bodyHeight * 0.6)
        g.fillRect(cx - bodyWidth / 2, beltY, bodyWidth, 1)
        // Collar/neckline
        g.fillRect(cx - 3, fy + bodyY, 6, 1)

        // Head
        g.fillStyle(headColor, 1)
        g.fillCircle(cx, fy + 12, headSize)

        // Hair silhouette (simple shape above head)
        const hairColor = this.darkenColor(headColor, 0.4)
        g.fillStyle(hairColor, 1)
        if (isElf) {
          // Long straight hair
          g.fillRoundedRect(cx - 5, fy + 4, 10, 10, 3)
        } else if (isDwarf) {
          // Short crop
          g.fillRoundedRect(cx - 5, fy + 4, 10, 6, 3)
          // Beard (front-facing)
          if (row === 0) {
            g.fillStyle(hairColor, 0.9)
            g.fillRoundedRect(cx - 4, fy + 14, 8, 5, 2)
          }
        } else if (isFairy) {
          // Wild/spiky
          g.beginPath()
          g.moveTo(cx - 4, fy + 8)
          g.lineTo(cx - 2, fy + 2)
          g.lineTo(cx, fy + 8)
          g.lineTo(cx + 2, fy + 2)
          g.lineTo(cx + 4, fy + 8)
          g.closePath()
          g.fillPath()
        } else {
          // Medium hair
          g.fillRoundedRect(cx - 5, fy + 4, 10, 8, 3)
        }

        // Race-specific features
        if (isElf && (row === 1 || row === 2)) {
          // Pointed ears (side views)
          g.fillStyle(headColor, 1)
          const earDir = row === 1 ? -1 : 1
          g.beginPath()
          g.moveTo(cx + earDir * headSize, fy + 10)
          g.lineTo(cx + earDir * (headSize + 3), fy + 8)
          g.lineTo(cx + earDir * (headSize - 1), fy + 12)
          g.closePath()
          g.fillPath()
        }

        if (isOrc && row === 0) {
          // Tusks (front view)
          g.fillStyle(0xf0f0e0, 1)
          g.fillRect(cx - 4, fy + 15, 2, 3)
          g.fillRect(cx + 2, fy + 15, 2, 3)
        }

        if (isUndead) {
          // Ragged edges and transparency
          g.fillStyle(headColor, 0.8)
          g.fillCircle(cx, fy + 12, headSize)
          // Hollow eyes
          g.fillStyle(0x000000, 1)
          if (row === 0) {
            g.fillCircle(cx - 2, fy + 12, 2)
            g.fillCircle(cx + 2, fy + 12, 2)
          }
        }

        if (isFairy && (row === 1 || row === 2)) {
          // Small wings
          g.fillStyle(0xffffff, 0.4)
          const wingDir = row === 1 ? -1 : 1
          g.beginPath()
          g.moveTo(cx + wingDir * 4, fy + 22)
          g.lineTo(cx + wingDir * 8, fy + 20)
          g.lineTo(cx + wingDir * 6, fy + 26)
          g.closePath()
          g.fillPath()
        }

        if (isDragonkin && row === 0) {
          // Small horns
          g.fillStyle(darkerBody, 1)
          g.beginPath()
          g.moveTo(cx - 4, fy + 6)
          g.lineTo(cx - 3, fy + 2)
          g.lineTo(cx - 2, fy + 6)
          g.closePath()
          g.fillPath()
          g.beginPath()
          g.moveTo(cx + 2, fy + 6)
          g.lineTo(cx + 3, fy + 2)
          g.lineTo(cx + 4, fy + 6)
          g.closePath()
          g.fillPath()
        }

        if (isBeastkin && (row === 1 || row === 2)) {
          // Pointy ears (animal-like)
          g.fillStyle(headColor, 1)
          const earDir = row === 1 ? -1 : 1
          g.beginPath()
          g.moveTo(cx + earDir * (headSize - 2), fy + 6)
          g.lineTo(cx + earDir * (headSize + 1), fy + 2)
          g.lineTo(cx + earDir * headSize, fy + 8)
          g.closePath()
          g.fillPath()
        }

        // Eyes (front/side only) - improved positioning
        if (row !== 3 && !isUndead) {
          g.fillStyle(0x000000, 0.8)
          if (row === 0) {
            // Down
            g.fillCircle(cx - 2, fy + 12, 1)
            g.fillCircle(cx + 2, fy + 12, 1)
          } else {
            // Side
            const dir = row === 1 ? -1 : 1
            g.fillCircle(cx + dir * 2, fy + 12, 1)
          }
        }
      }
    }

    g.generateTexture(key, SW, SH)
    g.destroy()
  }

  /* ───── helpers ───── */

  /** Generate a flat 32x32 square tile texture with subtle noise */
  private generateFlatTileTexture(key: string, color: number, size: number, variant: number): void {
    const g = this.add.graphics()

    // Solid fill — no face shading, no edges, no 3D effects
    g.fillStyle(color, 1)
    g.fillRect(0, 0, size, size)

    // Subtle noise dots for visual interest
    const seed = (color + variant * 7919) & 0xFFFF
    for (let i = 0; i < 8 + variant * 3; i++) {
      const s = ((seed + i * 131 + i * i * 17) & 0xFFFF) / 0xFFFF
      const t = ((seed + i * 97 + i * i * 31) & 0xFFFF) / 0xFFFF
      const dx = Math.floor(s * (size - 4)) + 2
      const dy = Math.floor(t * (size - 4)) + 2
      const isLight = i % 3 === 0
      g.fillStyle(isLight ? 0xffffff : 0x000000, 0.05)
      g.fillCircle(dx, dy, 1)
    }

    // Variant-specific subtle patches
    if (variant === 1) {
      g.fillStyle(0xffffff, 0.04)
      g.fillCircle(size * 0.3, size * 0.4, 4)
      g.fillCircle(size * 0.7, size * 0.6, 3)
    } else if (variant === 2) {
      g.fillStyle(0x000000, 0.04)
      g.fillCircle(size * 0.4, size * 0.5, 4)
      g.fillCircle(size * 0.6, size * 0.3, 3)
    }

    g.generateTexture(key, size, size)
    g.destroy()
  }

  /** Clamp color to valid 0x000000-0xffffff range */
  private clampColor(c: number): number {
    return Math.max(0, Math.min(0xffffff, c))
  }

  /** Darken a color by a percentage (0-1) */
  private darkenColor(color: number, amount: number): number {
    const r = (color >> 16) & 0xFF
    const g = (color >> 8) & 0xFF
    const b = color & 0xFF
    const nr = Math.floor(r * (1 - amount))
    const ng = Math.floor(g * (1 - amount))
    const nb = Math.floor(b * (1 - amount))
    return (nr << 16) | (ng << 8) | nb
  }

  /**
   * Check if an asset file exists in the manifest before attempting to load.
   * Returns true if manifest not loaded yet (fail open) or if asset exists.
   */
  private assetExists(path: string): boolean {
    if (!this.assetManifest) return true // Fail open if manifest not loaded yet

    // Normalize path: remove 'assets/' prefix if present
    const normalizedPath = path.startsWith('assets/') ? path.substring(7) : path

    // Check terrain spritesheet
    if (normalizedPath === 'tiles/iso-terrain-sheet.png') return true
    if (normalizedPath === 'tiles/terrain-sheet.png') return true

    // Check buildings
    if (normalizedPath.startsWith('buildings/')) {
      const fileName = normalizedPath.split('/')[1].replace('.png', '')
      const existing = this.assetManifest.buildings?.existing || []
      return existing.includes(fileName)
    }

    // Check objects
    if (normalizedPath.startsWith('objects/')) {
      // Object files use obj_ prefix in the manifest, but the file is just the base name
      const fileName = normalizedPath.split('/')[1].replace('.png', '')
      // All 71 objects exist according to manifest
      return true // Objects directory has all files
    }

    // Check resources
    if (normalizedPath.startsWith('resources/')) {
      const fileName = normalizedPath.split('/')[1].replace('.png', '')
      const existing = this.assetManifest.resources?.existing || []
      return existing.includes(fileName)
    }

    // Check characters
    if (normalizedPath.startsWith('characters/')) {
      // Characters are all procedural fallbacks - they don't exist as PNGs
      return false
    }

    // Check UI
    if (normalizedPath.startsWith('ui/')) {
      if (normalizedPath === 'ui/speech_bubble.png') return true
      // All other UI subdirectories don't have files
      return false
    }

    // Check items, agents, actions, tiles - none of these exist
    if (normalizedPath.startsWith('items/')) return false
    if (normalizedPath.startsWith('agents/')) return false
    if (normalizedPath.startsWith('actions/')) return false
    if (normalizedPath.startsWith('tiles/') && !normalizedPath.includes('terrain-sheet')) return false

    // Default: allow (fail open for unknown paths)
    return true
  }

  /**
   * Conditionally load an image only if it exists in the manifest.
   */
  private loadImageIfExists(key: string, path: string): void {
    if (this.assetExists(path)) {
      this.load.image(key, path)
    }
  }

  /**
   * Conditionally load a spritesheet only if it exists in the manifest.
   */
  private loadSpritesheetIfExists(key: string, path: string, frameConfig: Phaser.Types.Loader.FileTypes.ImageFrameConfig): void {
    if (this.assetExists(path)) {
      this.load.spritesheet(key, path, frameConfig)
    }
  }
}
