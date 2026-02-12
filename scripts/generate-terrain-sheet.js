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
let stats = { kenney: 0, placeholder: 0, transparent: 0, procedural: 0 };

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
 * Set a pixel in a PNG with bounds checking
 */
function setPixel(png, x, y, r, g, b, a = 255) {
  if (x < 0 || x >= TILE || y < 0 || y >= TILE) return;
  const idx = (y * TILE + x) * 4;
  png.data[idx] = r;
  png.data[idx + 1] = g;
  png.data[idx + 2] = b;
  png.data[idx + 3] = a;
}

/**
 * Fill a rectangular region
 */
function fillRect(png, x1, y1, x2, y2, r, g, b, a = 255) {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      setPixel(png, x, y, r, g, b, a);
    }
  }
}

/**
 * Create water corner tile (outer or inner corners)
 * @param {boolean} isInner - true for inner corners, false for outer
 * @param {string} corner - 'NE', 'NW', 'SE', 'SW'
 */
function makeWaterCorner(isInner, corner) {
  const png = new PNG({ width: TILE, height: TILE });

  // Initialize to transparent
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0;
    png.data[i + 1] = 0;
    png.data[i + 2] = 0;
    png.data[i + 3] = 0;
  }

  // Colors
  const grass = { r: 109, g: 170, b: 44 };
  const waterDeep = { r: 37, g: 99, b: 160 };
  const waterShallow = { r: 58, g: 124, b: 189 };
  const shore = { r: 85, g: 139, b: 139 };

  if (isInner) {
    // Inner corner: mostly water with grass peeking in from corner
    fillRect(png, 0, 0, 31, 31, waterShallow.r, waterShallow.g, waterShallow.b);

    // Add some deep water variation
    for (let y = 8; y < 24; y++) {
      for (let x = 8; x < 24; x++) {
        if ((x + y) % 3 === 0) {
          setPixel(png, x, y, waterDeep.r, waterDeep.g, waterDeep.b);
        }
      }
    }

    // Grass corner peek
    const grassSize = 10;
    if (corner === 'NE') {
      fillRect(png, 32 - grassSize, 0, 31, grassSize - 1, grass.r, grass.g, grass.b);
      fillRect(png, 32 - grassSize - 2, grassSize - 2, 31, grassSize, shore.r, shore.g, shore.b);
    } else if (corner === 'NW') {
      fillRect(png, 0, 0, grassSize - 1, grassSize - 1, grass.r, grass.g, grass.b);
      fillRect(png, 0, grassSize - 2, grassSize + 2, grassSize, shore.r, shore.g, shore.b);
    } else if (corner === 'SE') {
      fillRect(png, 32 - grassSize, 32 - grassSize, 31, 31, grass.r, grass.g, grass.b);
      fillRect(png, 32 - grassSize - 2, 32 - grassSize - 2, 31, 32 - grassSize, shore.r, shore.g, shore.b);
    } else if (corner === 'SW') {
      fillRect(png, 0, 32 - grassSize, grassSize - 1, 31, grass.r, grass.g, grass.b);
      fillRect(png, 0, 32 - grassSize - 2, grassSize + 2, 32 - grassSize, shore.r, shore.g, shore.b);
    }
  } else {
    // Outer corner: mostly grass with water filling the corner quadrant
    fillRect(png, 0, 0, 31, 31, grass.r, grass.g, grass.b);

    // Add grass variation
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        if ((x * 3 + y * 7) % 13 === 0) {
          setPixel(png, x, y, grass.r - 10, grass.g - 15, grass.b - 5);
        }
      }
    }

    // Water quadrant
    if (corner === 'NE') {
      fillRect(png, 16, 0, 31, 15, waterShallow.r, waterShallow.g, waterShallow.b);
      fillRect(png, 14, 0, 15, 15, shore.r, shore.g, shore.b);
    } else if (corner === 'NW') {
      fillRect(png, 0, 0, 15, 15, waterShallow.r, waterShallow.g, waterShallow.b);
      fillRect(png, 16, 0, 17, 15, shore.r, shore.g, shore.b);
    } else if (corner === 'SE') {
      fillRect(png, 16, 16, 31, 31, waterShallow.r, waterShallow.g, waterShallow.b);
      fillRect(png, 14, 16, 15, 31, shore.r, shore.g, shore.b);
    } else if (corner === 'SW') {
      fillRect(png, 0, 16, 15, 31, waterShallow.r, waterShallow.g, waterShallow.b);
      fillRect(png, 16, 16, 17, 31, shore.r, shore.g, shore.b);
    }
  }

  return png;
}

/**
 * Create river tile (horizontal or vertical)
 * @param {boolean} horizontal - true for horizontal, false for vertical
 */
function makeRiverTile(horizontal) {
  const png = new PNG({ width: TILE, height: TILE });

  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0;
    png.data[i + 1] = 0;
    png.data[i + 2] = 0;
    png.data[i + 3] = 0;
  }

  const grass = { r: 109, g: 170, b: 44 };
  const waterShallow = { r: 58, g: 124, b: 189 };
  const shore = { r: 85, g: 139, b: 139 };

  if (horizontal) {
    // Grass on top and bottom
    fillRect(png, 0, 0, 31, 9, grass.r, grass.g, grass.b);
    fillRect(png, 0, 22, 31, 31, grass.r, grass.g, grass.b);
    // Shore lines
    fillRect(png, 0, 10, 31, 11, shore.r, shore.g, shore.b);
    fillRect(png, 0, 20, 31, 21, shore.r, shore.g, shore.b);
    // Water in middle
    fillRect(png, 0, 12, 31, 19, waterShallow.r, waterShallow.g, waterShallow.b);
  } else {
    // Grass on left and right
    fillRect(png, 0, 0, 9, 31, grass.r, grass.g, grass.b);
    fillRect(png, 22, 0, 31, 31, grass.r, grass.g, grass.b);
    // Shore lines
    fillRect(png, 10, 0, 11, 31, shore.r, shore.g, shore.b);
    fillRect(png, 20, 0, 21, 31, shore.r, shore.g, shore.b);
    // Water in middle
    fillRect(png, 12, 0, 19, 31, waterShallow.r, waterShallow.g, waterShallow.b);
  }

  return png;
}

/**
 * Create swamp tile
 */
function makeSwampTile() {
  const png = new PNG({ width: TILE, height: TILE });

  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0;
    png.data[i + 1] = 0;
    png.data[i + 2] = 0;
    png.data[i + 3] = 0;
  }

  const mudBase = { r: 60, g: 75, b: 40 };
  const mudDark = { r: 45, g: 55, b: 30 };
  const puddle = { r: 50, g: 80, b: 50, a: 180 };

  // Base mud color
  fillRect(png, 0, 0, 31, 31, mudBase.r, mudBase.g, mudBase.b);

  // Random dark spots
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const noise = (x * 7 + y * 13) % 17;
      if (noise < 5) {
        setPixel(png, x, y, mudDark.r, mudDark.g, mudDark.b);
      }
    }
  }

  // Small puddles
  const puddles = [[8, 6], [22, 14], [14, 24], [26, 8]];
  puddles.forEach(([px, py]) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (Math.abs(dx) + Math.abs(dy) <= 1) {
          setPixel(png, px + dx, py + dy, puddle.r, puddle.g, puddle.b, puddle.a);
        }
      }
    }
  });

  return png;
}

/**
 * Create rock tile
 * @param {string} size - 'small' or 'large'
 * @param {string} variant - 'normal', 'mossy', 'iron', 'gold'
 */
function makeRockTile(size, variant) {
  const png = new PNG({ width: TILE, height: TILE });

  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0;
    png.data[i + 1] = 0;
    png.data[i + 2] = 0;
    png.data[i + 3] = 0;
  }

  const centerX = 16;
  const centerY = 16;
  const radiusX = size === 'small' ? 4 : 7;
  const radiusY = size === 'small' ? 3 : 5;

  let baseColor, highlightColor, shadowColor;

  if (variant === 'mossy') {
    baseColor = { r: 100, g: 120, b: 90 };
    highlightColor = { r: 120, g: 140, b: 100 };
    shadowColor = { r: 70, g: 85, b: 65 };
  } else if (variant === 'iron') {
    baseColor = { r: 70, g: 70, b: 80 };
    highlightColor = { r: 140, g: 140, b: 160 };
    shadowColor = { r: 40, g: 40, b: 50 };
  } else if (variant === 'gold') {
    baseColor = { r: 130, g: 130, b: 130 };
    highlightColor = { r: 212, g: 168, b: 32 };
    shadowColor = { r: 90, g: 90, b: 90 };
  } else {
    baseColor = { r: 130, g: 130, b: 130 };
    highlightColor = { r: 160, g: 160, b: 160 };
    shadowColor = { r: 90, g: 90, b: 90 };
  }

  // Draw ellipse
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const dx = (x - centerX) / radiusX;
      const dy = (y - centerY) / radiusY;
      const dist = dx * dx + dy * dy;

      if (dist <= 1) {
        // Inside rock
        if (dx < -0.3 && dy < -0.3) {
          setPixel(png, x, y, highlightColor.r, highlightColor.g, highlightColor.b, 200);
        } else if (dx > 0.3 && dy > 0.3) {
          setPixel(png, x, y, shadowColor.r, shadowColor.g, shadowColor.b, 200);
        } else {
          setPixel(png, x, y, baseColor.r, baseColor.g, baseColor.b, 200);
        }

        // Gold/iron specks
        if (variant === 'gold' && (x * 11 + y * 7) % 23 === 0) {
          setPixel(png, x, y, highlightColor.r, highlightColor.g, highlightColor.b, 220);
        } else if (variant === 'iron' && (x * 13 + y * 5) % 19 === 0) {
          setPixel(png, x, y, highlightColor.r, highlightColor.g, highlightColor.b, 220);
        }
      }
    }
  }

  return png;
}

/**
 * Create flower tile
 * @param {number} r - red value
 * @param {number} g - green value
 * @param {number} b - blue value
 */
function makeFlowerTile(r, g, b) {
  const png = new PNG({ width: TILE, height: TILE });

  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0;
    png.data[i + 1] = 0;
    png.data[i + 2] = 0;
    png.data[i + 3] = 0;
  }

  const stem = { r: 60, g: 120, b: 40 };
  const flowers = [[10, 8], [20, 12], [15, 18]];

  flowers.forEach(([fx, fy]) => {
    // Flower (3x3)
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (Math.abs(dx) + Math.abs(dy) <= 1) {
          setPixel(png, fx + dx, fy + dy, r, g, b, 200);
        }
      }
    }
    // Stem
    setPixel(png, fx, fy + 2, stem.r, stem.g, stem.b, 200);
  });

  return png;
}

/**
 * Create fish spot tile (water ripple)
 */
function makeFishSpotTile() {
  const png = new PNG({ width: TILE, height: TILE });

  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0;
    png.data[i + 1] = 0;
    png.data[i + 2] = 0;
    png.data[i + 3] = 0;
  }

  const ripple = { r: 120, g: 160, b: 200, a: 128 };
  const centerX = 16;
  const centerY = 16;

  // Concentric ripples
  [4, 6, 8].forEach(radius => {
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
      const x = Math.round(centerX + Math.cos(angle) * radius);
      const y = Math.round(centerY + Math.sin(angle) * radius);
      setPixel(png, x, y, ripple.r, ripple.g, ripple.b, ripple.a);
    }
  });

  return png;
}

/**
 * Create pebbles tile
 */
function makePebblesTile() {
  const png = new PNG({ width: TILE, height: TILE });

  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0;
    png.data[i + 1] = 0;
    png.data[i + 2] = 0;
    png.data[i + 3] = 0;
  }

  const pebblePositions = [[8, 10], [18, 8], [12, 20], [24, 16], [14, 14], [22, 24]];
  const grays = [
    { r: 120, g: 120, b: 120 },
    { r: 140, g: 140, b: 140 },
    { r: 100, g: 100, b: 100 }
  ];

  pebblePositions.forEach(([px, py], i) => {
    const color = grays[i % grays.length];
    // 2x2 pebble
    setPixel(png, px, py, color.r, color.g, color.b, 180);
    setPixel(png, px + 1, py, color.r, color.g, color.b, 180);
    setPixel(png, px, py + 1, color.r, color.g, color.b, 180);
    setPixel(png, px + 1, py + 1, color.r, color.g, color.b, 180);
  });

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
  { src: 'procedural', fn: 'makeSwampTile' },   // 12: swamp
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
  { src: 'procedural', fn: 'makeWaterCorner', args: [false, 'NE'] },  // 22: water_shore_NE
  { src: 'procedural', fn: 'makeWaterCorner', args: [false, 'NW'] },  // 23: water_shore_NW
  { src: 'procedural', fn: 'makeWaterCorner', args: [false, 'SE'] },  // 24: water_shore_SE
  { src: 'procedural', fn: 'makeWaterCorner', args: [false, 'SW'] },  // 25: water_shore_SW
  { src: 'procedural', fn: 'makeWaterCorner', args: [true, 'NE'] },   // 26: water_shore_inner_NE
  { src: 'procedural', fn: 'makeWaterCorner', args: [true, 'NW'] },   // 27: water_shore_inner_NW
  { src: 'procedural', fn: 'makeWaterCorner', args: [true, 'SE'] },   // 28: water_shore_inner_SE
  { src: 'procedural', fn: 'makeWaterCorner', args: [true, 'SW'] },   // 29: water_shore_inner_SW
  { src: 'procedural', fn: 'makeRiverTile', args: [true] },   // 30: water_river_H
  { src: 'procedural', fn: 'makeRiverTile', args: [false] },  // 31: water_river_V
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
  { src: 'procedural', fn: 'makeRockTile', args: ['small', 'normal'] },  // 80: rock_small
  { src: 'procedural', fn: 'makeRockTile', args: ['large', 'normal'] },  // 81: rock_large
  { src: 'procedural', fn: 'makeRockTile', args: ['large', 'mossy'] },   // 82: rock_mossy
  { src: 'procedural', fn: 'makeRockTile', args: ['large', 'iron'] },    // 83: ore_iron
  { src: 'procedural', fn: 'makeRockTile', args: ['large', 'gold'] },    // 84: ore_gold
  { src: 'dungeon', n: 56 },  // 85: ore_crystal (Kenney blue gem)
  { src: 'dungeon', n: 123 }, // 86: mushroom_1 (Kenney brown mushroom)
  { src: 'dungeon', n: 124 }, // 87: mushroom_2 (Kenney dark mushroom)
  { src: 'dungeon', n: 108 }, // 88: herb_green (Kenney green creature/plant)
  { src: 'dungeon', n: 114 }, // 89: herb_rare (Kenney green potion/herb)
  { src: 'procedural', fn: 'makeFlowerTile', args: [208, 64, 64] },      // 90: flower_red
  { src: 'procedural', fn: 'makeFlowerTile', args: [64, 64, 208] },      // 91: flower_blue
  { src: 'procedural', fn: 'makeFlowerTile', args: [208, 208, 64] },     // 92: flower_yellow
  { src: 'town', n: 34 },     // 93: wheat (Kenney pumpkin/crop)
  { src: 'town', n: 35 },     // 94: vegetable (Kenney brown vegetable)
  { src: 'procedural', fn: 'makeFishSpotTile' },                         // 95: fish_spot
];

const ROW6 = [
  { src: 'town', n: 43 },     // 96: grass_tuft (Kenney flower/grass patch)
  { src: 'procedural', fn: 'makePebblesTile' },  // 97: pebbles
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
    } else if (def.src === 'procedural') {
      // Call procedural generation function
      const fnName = def.fn;
      const args = def.args || [];

      if (fnName === 'makeWaterCorner') {
        tile = makeWaterCorner(...args);
      } else if (fnName === 'makeRiverTile') {
        tile = makeRiverTile(...args);
      } else if (fnName === 'makeSwampTile') {
        tile = makeSwampTile();
      } else if (fnName === 'makeRockTile') {
        tile = makeRockTile(...args);
      } else if (fnName === 'makeFlowerTile') {
        tile = makeFlowerTile(...args);
      } else if (fnName === 'makeFishSpotTile') {
        tile = makeFishSpotTile();
      } else if (fnName === 'makePebblesTile') {
        tile = makePebblesTile();
      } else {
        console.warn(`Unknown procedural function: ${fnName}`);
        tile = makePlaceholder(255, 0, 255); // Magenta for errors
      }
      stats.procedural++;
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
console.log(`  Procedural tiles: ${stats.procedural}`);
console.log(`  Placeholder tiles: ${stats.placeholder}`);
console.log(`  Transparent tiles: ${stats.transparent}`);
console.log(`  Total: ${stats.kenney + stats.procedural + stats.placeholder + stats.transparent}\n`);

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
