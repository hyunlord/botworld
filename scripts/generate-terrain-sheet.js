const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const TILE = 32;
const SRC_TILE = 16;
const COLS = 16;
const ROWS = 7;
const OUTPUT_W = COLS * TILE; // 512
const OUTPUT_H = ROWS * TILE; // 224

const TOWN_DIR = path.join(__dirname, 'assets-raw/tiny-town/Tiles');
const DUNGEON_DIR = path.join(__dirname, 'assets-raw/tiny-dungeon/Tiles');
const OUTPUT = path.join(__dirname, '../packages/client/public/assets/tiles/terrain-sheet.png');
const JSON_OUTPUT = path.join(__dirname, '../packages/client/public/assets/tiles/terrain-tiles.json');

// Statistics
let stats = { kenney: 0, placeholder: 0, transparent: 0 };

/**
 * Read a 16x16 PNG tile
 */
function readTile(filePath) {
  const data = fs.readFileSync(filePath);
  return PNG.sync.read(data);
}

/**
 * Nearest-neighbor 2x upscale (16x16 → 32x32)
 */
function scale2x(src) {
  const dst = new PNG({ width: TILE, height: TILE });
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const srcX = Math.floor(x / 2);
      const srcY = Math.floor(y / 2);
      const srcIdx = (srcY * SRC_TILE + srcX) * 4;
      const dstIdx = (y * TILE + x) * 4;
      dst.data[dstIdx] = src.data[srcIdx];
      dst.data[dstIdx + 1] = src.data[srcIdx + 1];
      dst.data[dstIdx + 2] = src.data[srcIdx + 2];
      dst.data[dstIdx + 3] = src.data[srcIdx + 3];
    }
  }
  return dst;
}

/**
 * Draw a filled circle centered in the tile
 */
function drawCircle(png, r, g, b, a) {
  const centerX = TILE / 2;
  const centerY = TILE / 2;
  const radius = 8;

  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const distSq = dx * dx + dy * dy;

      if (distSq <= radius * radius) {
        const idx = (y * TILE + x) * 4;
        png.data[idx] = r;
        png.data[idx + 1] = g;
        png.data[idx + 2] = b;
        png.data[idx + 3] = a;
      }
    }
  }
}

/**
 * Draw a filled triangle (tree shape) centered in the tile
 */
function drawTriangle(png, r, g, b, a) {
  const centerX = TILE / 2;
  const topY = 8;
  const bottomY = 24;
  const width = 16;

  for (let y = topY; y <= bottomY; y++) {
    const progress = (y - topY) / (bottomY - topY);
    const halfWidth = (progress * width) / 2;
    const startX = Math.floor(centerX - halfWidth);
    const endX = Math.ceil(centerX + halfWidth);

    for (let x = startX; x <= endX; x++) {
      if (x >= 0 && x < TILE) {
        const idx = (y * TILE + x) * 4;
        png.data[idx] = r;
        png.data[idx + 1] = g;
        png.data[idx + 2] = b;
        png.data[idx + 3] = a;
      }
    }
  }
}

/**
 * Draw a filled rectangle centered in the tile
 */
function drawRectangle(png, r, g, b, a) {
  const startX = 8;
  const endX = 24;
  const startY = 8;
  const endY = 24;

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const idx = (y * TILE + x) * 4;
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    }
  }
}

/**
 * Create a placeholder tile with shape based on row type
 */
function makePlaceholder(r, g, b, a = 255, shape = 'solid') {
  const png = new PNG({ width: TILE, height: TILE });

  // Initialize to transparent
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0;
    png.data[i + 1] = 0;
    png.data[i + 2] = 0;
    png.data[i + 3] = 0;
  }

  if (shape === 'solid') {
    // Fill entire tile
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const idx = (y * TILE + x) * 4;
        png.data[idx] = r;
        png.data[idx + 1] = g;
        png.data[idx + 2] = b;
        png.data[idx + 3] = a;
      }
    }
  } else if (shape === 'triangle') {
    drawTriangle(png, r, g, b, a);
  } else if (shape === 'circle') {
    drawCircle(png, r, g, b, a);
  } else if (shape === 'rectangle') {
    drawRectangle(png, r, g, b, a);
  }

  return png;
}

/**
 * Copy 32x32 tile data into output PNG at grid position
 */
function placeTile(output, tile, col, row) {
  const offX = col * TILE;
  const offY = row * TILE;
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const srcIdx = (y * TILE + x) * 4;
      const dstIdx = ((offY + y) * OUTPUT_W + (offX + x)) * 4;
      output.data[dstIdx] = tile.data[srcIdx];
      output.data[dstIdx + 1] = tile.data[srcIdx + 1];
      output.data[dstIdx + 2] = tile.data[srcIdx + 2];
      output.data[dstIdx + 3] = tile.data[srcIdx + 3];
    }
  }
}

/**
 * Load a Kenney Tiny Town tile by number and upscale
 */
function loadTown(n) {
  try {
    const file = path.join(TOWN_DIR, `tile_${String(n).padStart(4, '0')}.png`);
    stats.kenney++;
    return scale2x(readTile(file));
  } catch (err) {
    console.warn(`Warning: Could not load town tile ${n}, using placeholder`);
    stats.placeholder++;
    return makePlaceholder(128, 128, 128);
  }
}

/**
 * Load a Kenney Tiny Dungeon tile by number and upscale
 */
function loadDungeon(n) {
  try {
    const file = path.join(DUNGEON_DIR, `tile_${String(n).padStart(4, '0')}.png`);
    stats.kenney++;
    return scale2x(readTile(file));
  } catch (err) {
    console.warn(`Warning: Could not load dungeon tile ${n}, using placeholder`);
    stats.placeholder++;
    return makePlaceholder(128, 128, 128);
  }
}

// Tile definitions
const ROW0 = [
  { src: 'town', n: 0 },    // 0: grass_1
  { src: 'town', n: 1 },    // 1: grass_2
  { src: 'town', n: 2 },    // 2: grass_3 (flowers)
  { src: 'town', n: 13 },   // 3: grass_tall (dark grass)
  { src: 'town', n: 24 },   // 4: dirt_1
  { src: 'town', n: 25 },   // 5: dirt_2
  { src: 'town', n: 36 },   // 6: sand_1
  { src: 'town', n: 37 },   // 7: sand_2 (Kenney sand variant)
  { src: 'town', n: 96 },   // 8: snow_1
  { src: 'town', n: 97 },   // 9: snow_2
  { src: 'town', n: 48 },   // 10: stone_floor (cobblestone)
  { src: 'town', n: 12 },   // 11: farmland (Kenney light ground)
  { src: 'placeholder', r: 74, g: 90, b: 58 },   // 12: swamp (placeholder)
  { src: 'town', n: 13 },   // 13: dark_grass (reuse dark grass)
  { src: 'dungeon', n: 48 }, // 14: cave_floor (Kenney dungeon floor)
  { src: 'transparent' },    // 15: reserved
];

const ROW1 = [
  { src: 'town', n: 26 },   // 16: water_deep (use darkest water tile)
  { src: 'town', n: 27 },   // 17: water_shallow
  { src: 'town', n: 28 },   // 18: water_shore_N
  { src: 'town', n: 29 },   // 19: water_shore_S
  { src: 'town', n: 30 },   // 20: water_shore_E
  { src: 'town', n: 31 },   // 21: water_shore_W
  { src: 'placeholder', r: 37, g: 99, b: 160 },  // 22: water_shore_NE (placeholder)
  { src: 'placeholder', r: 37, g: 99, b: 160 },  // 23: water_shore_NW
  { src: 'placeholder', r: 37, g: 99, b: 160 },  // 24: water_shore_SE
  { src: 'placeholder', r: 37, g: 99, b: 160 },  // 25: water_shore_SW
  { src: 'placeholder', r: 30, g: 80, b: 140 },  // 26: water_shore_inner_NE
  { src: 'placeholder', r: 30, g: 80, b: 140 },  // 27: water_shore_inner_NW
  { src: 'placeholder', r: 30, g: 80, b: 140 },  // 28: water_shore_inner_SE
  { src: 'placeholder', r: 30, g: 80, b: 140 },  // 29: water_shore_inner_SW
  { src: 'placeholder', r: 58, g: 124, b: 189 }, // 30: water_river_H
  { src: 'placeholder', r: 58, g: 124, b: 189 }, // 31: water_river_V
];

const ROW2 = [
  { src: 'town', n: 49 },   // 32: road_dirt_H (stone path variant)
  { src: 'town', n: 49 },   // 33: road_dirt_V (rotated conceptually, same tile)
  { src: 'town', n: 48 },   // 34: road_dirt_cross
  { src: 'town', n: 48 },   // 35: road_dirt_turn_NE (Kenney cobblestone)
  { src: 'town', n: 48 },   // 36: road_dirt_turn_NW (Kenney cobblestone)
  { src: 'town', n: 48 },   // 37: road_dirt_turn_SE (Kenney cobblestone)
  { src: 'town', n: 48 },   // 38: road_dirt_turn_SW (Kenney cobblestone)
  { src: 'town', n: 48 },   // 39: road_stone_H
  { src: 'town', n: 48 },   // 40: road_stone_V
  { src: 'town', n: 48 },   // 41: road_stone_cross
  { src: 'town', n: 44 },   // 42: bridge_H (Kenney wood fence horizontal)
  { src: 'town', n: 47 },   // 43: bridge_V (Kenney wood fence vertical)
  { src: 'transparent' },    // 44
  { src: 'transparent' },    // 45
  { src: 'transparent' },    // 46
  { src: 'transparent' },    // 47
];

const ROW3 = [
  { src: 'dungeon', n: 36 },  // 48: cliff_N (Kenney stone wall)
  { src: 'dungeon', n: 37 },  // 49: cliff_S (Kenney stone wall variant)
  { src: 'dungeon', n: 38 },  // 50: cliff_E (Kenney stone wall variant)
  { src: 'dungeon', n: 39 },  // 51: cliff_W (Kenney stone wall variant)
  { src: 'dungeon', n: 40 },  // 52: cliff_NE (Kenney dark stone wall)
  { src: 'dungeon', n: 40 },  // 53: cliff_NW (Kenney dark stone wall)
  { src: 'dungeon', n: 36 },  // 54: cliff_SE (Kenney stone wall)
  { src: 'dungeon', n: 37 },  // 55: cliff_SW (Kenney stone wall variant)
  { src: 'town', n: 50 },   // 56: mountain_top (use stone variant)
  { src: 'town', n: 96 },   // 57: mountain_snow (use snow tile)
  { src: 'transparent' },    // 58-63
  { src: 'transparent' },
  { src: 'transparent' },
  { src: 'transparent' },
  { src: 'transparent' },
  { src: 'transparent' },
];

const ROW4 = [
  { src: 'town', n: 4 },    // 64: tree_oak_1 (round green tree top)
  { src: 'town', n: 5 },    // 65: tree_oak_2
  { src: 'town', n: 6 },    // 66: tree_pine_1 (dark pointed tree)
  { src: 'town', n: 7 },    // 67: tree_pine_2
  { src: 'town', n: 8 },    // 68: tree_palm (or big green tree)
  { src: 'town', n: 18 },   // 69: tree_dead (use a full tree, best available)
  { src: 'town', n: 9 },    // 70: tree_autumn (autumn tree top)
  { src: 'town', n: 10 },   // 71: tree_snow (autumn variant / will tint later)
  { src: 'town', n: 20 },   // 72: tree_large_TL
  { src: 'town', n: 21 },   // 73: tree_large_TR
  { src: 'town', n: 22 },   // 74: tree_large_BL
  { src: 'town', n: 23 },   // 75: tree_large_BR
  { src: 'town', n: 16 },   // 76: bush_green (Kenney green bush)
  { src: 'town', n: 17 },   // 77: bush_berry (Kenney orange/autumn bush)
  { src: 'town', n: 19 },   // 78: bush_flower (Kenney bush with dots)
  { src: 'town', n: 11 },   // 79: stump (Kenney brown tree stump)
];

const ROW5 = [
  { src: 'placeholder', r: 128, g: 128, b: 128, a: 200, shape: 'circle' }, // 80: rock_small
  { src: 'placeholder', r: 112, g: 112, b: 112, a: 200, shape: 'circle' }, // 81: rock_large
  { src: 'placeholder', r: 100, g: 120, b: 90, a: 200, shape: 'circle' },  // 82: rock_mossy
  { src: 'placeholder', r: 96, g: 96, b: 112, a: 200, shape: 'circle' },   // 83: ore_iron
  { src: 'placeholder', r: 212, g: 168, b: 32, a: 200, shape: 'circle' },  // 84: ore_gold
  { src: 'dungeon', n: 56 },  // 85: ore_crystal (Kenney blue gem)
  { src: 'dungeon', n: 123 }, // 86: mushroom_1 (Kenney brown mushroom)
  { src: 'dungeon', n: 124 }, // 87: mushroom_2 (Kenney dark mushroom)
  { src: 'dungeon', n: 108 }, // 88: herb_green (Kenney green creature/plant)
  { src: 'dungeon', n: 114 }, // 89: herb_rare (Kenney green potion/herb)
  { src: 'placeholder', r: 208, g: 64, b: 64, a: 200, shape: 'circle' },   // 90: flower_red
  { src: 'placeholder', r: 64, g: 64, b: 208, a: 200, shape: 'circle' },   // 91: flower_blue
  { src: 'placeholder', r: 208, g: 208, b: 64, a: 200, shape: 'circle' },  // 92: flower_yellow
  { src: 'town', n: 34 },     // 93: wheat (Kenney pumpkin/crop)
  { src: 'town', n: 35 },     // 94: vegetable (Kenney brown vegetable)
  { src: 'placeholder', r: 10, g: 32, b: 64, a: 128, shape: 'circle' },    // 95: fish_spot
];

const ROW6 = [
  { src: 'town', n: 43 },     // 96: grass_tuft (Kenney flower/grass patch)
  { src: 'placeholder', r: 140, g: 140, b: 140, a: 180, shape: 'rectangle' },  // 97: pebbles
  { src: 'town', n: 33 },     // 98: fallen_leaf (Kenney autumn tree/leaf)
  { src: 'town', n: 109 },    // 99: puddle (Kenney ice/water surface)
  { src: 'dungeon', n: 121 }, // 100: bones (Kenney skull)
  { src: 'town', n: 115 },    // 101: sign_post (Kenney signpost/mailbox)
  { src: 'town', n: 44 },     // 102: fence_H (Kenney wood fence horizontal)
  { src: 'town', n: 47 },     // 103: fence_V (Kenney wood fence vertical)
  { src: 'town', n: 125 },    // 104: well (Kenney gray well/box)
  { src: 'town', n: 3 },      // 105: campfire (Kenney flame/fire)
  { src: 'town', n: 130 },    // 106: barrel (Kenney brown barrel)
  { src: 'town', n: 131 },    // 107: crate (Kenney brown crate)
  { src: 'town', n: 116 },    // 108: lantern (Kenney lamp/lantern)
  { src: 'dungeon', n: 44 },  // 109: gravestone (Kenney skull marker)
  { src: 'town', n: 15 },     // 110: flag (Kenney torch/pole)
  { src: 'transparent' },     // 111: reserved
];

// Main assembly
console.log('Starting terrain sheet generation...\n');

const output = new PNG({ width: OUTPUT_W, height: OUTPUT_H, fill: true });

// Initialize all pixels to transparent
for (let i = 0; i < output.data.length; i += 4) {
  output.data[i] = 0;
  output.data[i + 1] = 0;
  output.data[i + 2] = 0;
  output.data[i + 3] = 0;
}

const allRows = [ROW0, ROW1, ROW2, ROW3, ROW4, ROW5, ROW6];

for (let row = 0; row < ROWS; row++) {
  const rowDef = allRows[row];
  for (let col = 0; col < COLS; col++) {
    const def = rowDef[col];
    let tile;

    if (def.src === 'town') {
      tile = loadTown(def.n);
    } else if (def.src === 'dungeon') {
      tile = loadDungeon(def.n);
    } else if (def.src === 'transparent') {
      tile = makePlaceholder(0, 0, 0, 0);
      stats.transparent++;
    } else if (def.src === 'placeholder') {
      tile = makePlaceholder(def.r, def.g, def.b, def.a || 255, def.shape || 'solid');
      stats.placeholder++;
    }

    placeTile(output, tile, col, row);
  }
}

// Write output PNG
const buffer = PNG.sync.write(output);
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, buffer);

console.log(`\nTerrain sheet written: ${OUTPUT}`);
console.log(`Dimensions: ${OUTPUT_W}x${OUTPUT_H} (${COLS} cols x ${ROWS} rows, ${TILE}x${TILE} tiles)\n`);
console.log('Statistics:');
console.log(`  Kenney tiles: ${stats.kenney}`);
console.log(`  Placeholder tiles: ${stats.placeholder}`);
console.log(`  Transparent tiles: ${stats.transparent}`);
console.log(`  Total: ${stats.kenney + stats.placeholder + stats.transparent}\n`);

// Generate JSON mapping
const tilesJson = {
  tileSize: 32,
  columns: 16,
  rows: 7,
  imageWidth: 512,
  imageHeight: 224,
  tiles: {
    grass_1: 0, grass_2: 1, grass_3: 2, grass_tall: 3,
    dirt_1: 4, dirt_2: 5, sand_1: 6, sand_2: 7,
    snow_1: 8, snow_2: 9, stone_floor: 10, farmland: 11,
    swamp: 12, dark_grass: 13, cave_floor: 14,
    water_deep: 16, water_shallow: 17,
    water_shore_N: 18, water_shore_S: 19, water_shore_E: 20, water_shore_W: 21,
    water_shore_NE: 22, water_shore_NW: 23, water_shore_SE: 24, water_shore_SW: 25,
    water_shore_inner_NE: 26, water_shore_inner_NW: 27, water_shore_inner_SE: 28, water_shore_inner_SW: 29,
    water_river_H: 30, water_river_V: 31,
    road_dirt_H: 32, road_dirt_V: 33, road_dirt_cross: 34,
    road_dirt_turn_NE: 35, road_dirt_turn_NW: 36, road_dirt_turn_SE: 37, road_dirt_turn_SW: 38,
    road_stone_H: 39, road_stone_V: 40, road_stone_cross: 41,
    bridge_H: 42, bridge_V: 43,
    cliff_N: 48, cliff_S: 49, cliff_E: 50, cliff_W: 51,
    cliff_NE: 52, cliff_NW: 53, cliff_SE: 54, cliff_SW: 55,
    mountain_top: 56, mountain_snow: 57,
    tree_oak_1: 64, tree_oak_2: 65, tree_pine_1: 66, tree_pine_2: 67,
    tree_palm: 68, tree_dead: 69, tree_autumn: 70, tree_snow: 71,
    tree_large_TL: 72, tree_large_TR: 73, tree_large_BL: 74, tree_large_BR: 75,
    bush_green: 76, bush_berry: 77, bush_flower: 78, stump: 79,
    rock_small: 80, rock_large: 81, rock_mossy: 82,
    ore_iron: 83, ore_gold: 84, ore_crystal: 85,
    mushroom_1: 86, mushroom_2: 87, herb_green: 88, herb_rare: 89,
    flower_red: 90, flower_blue: 91, flower_yellow: 92,
    wheat: 93, vegetable: 94, fish_spot: 95,
    grass_tuft: 96, pebbles: 97, fallen_leaf: 98, puddle: 99,
    bones: 100, sign_post: 101, fence_H: 102, fence_V: 103,
    well: 104, campfire: 105, barrel: 106, crate: 107,
    lantern: 108, gravestone: 109, flag: 110
  }
};

fs.writeFileSync(JSON_OUTPUT, JSON.stringify(tilesJson, null, 2));
console.log(`Tile mapping written: ${JSON_OUTPUT}\n`);

console.log('Done!');
