const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

// Isometric tile dimensions
const ISO_W = 64;  // Diamond width
const ISO_H = 32;  // Diamond height
const SRC_TILE = 16;  // Kenney source tile size
const COLS = 16;
const ROWS = 7;
const OUTPUT_W = COLS * ISO_W;  // 1024
const OUTPUT_H = ROWS * ISO_H;  // 224

const TOWN_DIR = path.join(__dirname, 'assets-raw/tiny-town/Tiles');
const DUNGEON_DIR = path.join(__dirname, 'assets-raw/tiny-dungeon/Tiles');
const OUTPUT = path.join(__dirname, '../packages/client/public/assets/tiles/iso-terrain-sheet.png');
const JSON_OUTPUT = path.join(__dirname, '../packages/client/public/assets/tiles/iso-terrain-tiles.json');

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
 * Check if a pixel is inside the diamond shape
 */
function isInsideDiamond(x, y) {
  // Diamond formula: |x - centerX| / halfWidth + |y - centerY| / halfHeight <= 1
  const centerX = ISO_W / 2;  // 32
  const centerY = ISO_H / 2;  // 16
  return Math.abs(x - centerX) / centerX + Math.abs(y - centerY) / centerY <= 1;
}

/**
 * Sample a pixel from the source image using isometric projection
 */
function sampleIsometric(src, dx, dy) {
  // Convert destination pixel to normalized coordinates
  const u = (dx - 32) / 64 + dy / 32;
  const v = dy / 32 - (dx - 32) / 64;

  // Check if within valid source range
  if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
    const srcX = Math.floor(u * (SRC_TILE - 1));
    const srcY = Math.floor(v * (SRC_TILE - 1));
    const srcIdx = (srcY * SRC_TILE + srcX) * 4;

    return {
      r: src.data[srcIdx],
      g: src.data[srcIdx + 1],
      b: src.data[srcIdx + 2],
      a: src.data[srcIdx + 3]
    };
  }

  // Outside texture bounds = transparent
  return { r: 0, g: 0, b: 0, a: 0 };
}

/**
 * Convert a square tile to isometric diamond projection
 */
function makeIsometric(src) {
  const dst = new PNG({ width: ISO_W, height: ISO_H });

  // Initialize to transparent
  for (let i = 0; i < dst.data.length; i += 4) {
    dst.data[i] = 0;
    dst.data[i + 1] = 0;
    dst.data[i + 2] = 0;
    dst.data[i + 3] = 0;
  }

  for (let y = 0; y < ISO_H; y++) {
    for (let x = 0; x < ISO_W; x++) {
      const pixel = sampleIsometric(src, x, y);
      const dstIdx = (y * ISO_W + x) * 4;
      dst.data[dstIdx] = pixel.r;
      dst.data[dstIdx + 1] = pixel.g;
      dst.data[dstIdx + 2] = pixel.b;
      dst.data[dstIdx + 3] = pixel.a;
    }
  }

  return dst;
}

/**
 * Create a solid color diamond tile
 */
function makeSolidDiamond(r, g, b, a = 255) {
  const png = new PNG({ width: ISO_W, height: ISO_H });

  // Initialize to transparent
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0;
    png.data[i + 1] = 0;
    png.data[i + 2] = 0;
    png.data[i + 3] = 0;
  }

  // Fill diamond shape
  for (let y = 0; y < ISO_H; y++) {
    for (let x = 0; x < ISO_W; x++) {
      if (isInsideDiamond(x, y)) {
        const idx = (y * ISO_W + x) * 4;
        png.data[idx] = r;
        png.data[idx + 1] = g;
        png.data[idx + 2] = b;
        png.data[idx + 3] = a;
      }
    }
  }

  return png;
}

/**
 * Set a pixel in a PNG with bounds checking
 */
function setPixel(png, x, y, r, g, b, a = 255) {
  if (x < 0 || x >= ISO_W || y < 0 || y >= ISO_H) return;
  const idx = (y * ISO_W + x) * 4;
  png.data[idx] = r;
  png.data[idx + 1] = g;
  png.data[idx + 2] = b;
  png.data[idx + 3] = a;
}

/**
 * Fill a rectangular region in diamond bounds
 */
function fillDiamondRect(png, x1, y1, x2, y2, r, g, b, a = 255) {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      if (isInsideDiamond(x, y)) {
        setPixel(png, x, y, r, g, b, a);
      }
    }
  }
}

/**
 * Create isometric water corner tile
 */
function makeIsoWaterCorner(isInner, corner) {
  const png = new PNG({ width: ISO_W, height: ISO_H });

  // Initialize to transparent
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0;
    png.data[i + 1] = 0;
    png.data[i + 2] = 0;
    png.data[i + 3] = 0;
  }

  const grass = { r: 109, g: 170, b: 44 };
  const waterDeep = { r: 37, g: 99, b: 160 };
  const waterShallow = { r: 58, g: 124, b: 189 };
  const shore = { r: 85, g: 139, b: 139 };

  if (isInner) {
    // Fill with water
    fillDiamondRect(png, 0, 0, ISO_W - 1, ISO_H - 1, waterShallow.r, waterShallow.g, waterShallow.b);

    // Add deep water variation
    for (let y = 8; y < 24; y++) {
      for (let x = 16; x < 48; x++) {
        if (isInsideDiamond(x, y) && (x + y) % 3 === 0) {
          setPixel(png, x, y, waterDeep.r, waterDeep.g, waterDeep.b);
        }
      }
    }

    // Grass corner peek (adjusted for isometric)
    const grassSize = 10;
    if (corner === 'NE') {
      fillDiamondRect(png, ISO_W - grassSize * 2, 0, ISO_W - 1, grassSize - 1, grass.r, grass.g, grass.b);
    } else if (corner === 'NW') {
      fillDiamondRect(png, 0, 0, grassSize * 2 - 1, grassSize - 1, grass.r, grass.g, grass.b);
    } else if (corner === 'SE') {
      fillDiamondRect(png, ISO_W - grassSize * 2, ISO_H - grassSize, ISO_W - 1, ISO_H - 1, grass.r, grass.g, grass.b);
    } else if (corner === 'SW') {
      fillDiamondRect(png, 0, ISO_H - grassSize, grassSize * 2 - 1, ISO_H - 1, grass.r, grass.g, grass.b);
    }
  } else {
    // Fill with grass
    fillDiamondRect(png, 0, 0, ISO_W - 1, ISO_H - 1, grass.r, grass.g, grass.b);

    // Water quadrant (adjusted for isometric diamond)
    if (corner === 'NE') {
      fillDiamondRect(png, ISO_W / 2, 0, ISO_W - 1, ISO_H / 2, waterShallow.r, waterShallow.g, waterShallow.b);
    } else if (corner === 'NW') {
      fillDiamondRect(png, 0, 0, ISO_W / 2 - 1, ISO_H / 2, waterShallow.r, waterShallow.g, waterShallow.b);
    } else if (corner === 'SE') {
      fillDiamondRect(png, ISO_W / 2, ISO_H / 2, ISO_W - 1, ISO_H - 1, waterShallow.r, waterShallow.g, waterShallow.b);
    } else if (corner === 'SW') {
      fillDiamondRect(png, 0, ISO_H / 2, ISO_W / 2 - 1, ISO_H - 1, waterShallow.r, waterShallow.g, waterShallow.b);
    }
  }

  return png;
}

/**
 * Create isometric river tile
 */
function makeIsoRiverTile(horizontal) {
  const png = new PNG({ width: ISO_W, height: ISO_H });

  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0;
    png.data[i + 1] = 0;
    png.data[i + 2] = 0;
    png.data[i + 3] = 0;
  }

  const grass = { r: 109, g: 170, b: 44 };
  const waterShallow = { r: 58, g: 124, b: 189 };

  if (horizontal) {
    // Horizontal river in diamond space
    fillDiamondRect(png, 0, 0, ISO_W - 1, ISO_H / 3, grass.r, grass.g, grass.b);
    fillDiamondRect(png, 0, ISO_H / 3, ISO_W - 1, 2 * ISO_H / 3, waterShallow.r, waterShallow.g, waterShallow.b);
    fillDiamondRect(png, 0, 2 * ISO_H / 3, ISO_W - 1, ISO_H - 1, grass.r, grass.g, grass.b);
  } else {
    // Vertical river in diamond space
    fillDiamondRect(png, 0, 0, ISO_W / 3, ISO_H - 1, grass.r, grass.g, grass.b);
    fillDiamondRect(png, ISO_W / 3, 0, 2 * ISO_W / 3, ISO_H - 1, waterShallow.r, waterShallow.g, waterShallow.b);
    fillDiamondRect(png, 2 * ISO_W / 3, 0, ISO_W - 1, ISO_H - 1, grass.r, grass.g, grass.b);
  }

  return png;
}

/**
 * Create isometric swamp tile
 */
function makeIsoSwampTile() {
  const png = new PNG({ width: ISO_W, height: ISO_H });

  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0;
    png.data[i + 1] = 0;
    png.data[i + 2] = 0;
    png.data[i + 3] = 0;
  }

  const mudBase = { r: 60, g: 75, b: 40 };
  const mudDark = { r: 45, g: 55, b: 30 };

  fillDiamondRect(png, 0, 0, ISO_W - 1, ISO_H - 1, mudBase.r, mudBase.g, mudBase.b);

  // Random dark spots
  for (let y = 0; y < ISO_H; y++) {
    for (let x = 0; x < ISO_W; x++) {
      if (isInsideDiamond(x, y)) {
        const noise = (x * 7 + y * 13) % 17;
        if (noise < 5) {
          setPixel(png, x, y, mudDark.r, mudDark.g, mudDark.b);
        }
      }
    }
  }

  return png;
}

/**
 * Create isometric rock tile
 */
function makeIsoRockTile(size, variant) {
  const png = new PNG({ width: ISO_W, height: ISO_H });

  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0;
    png.data[i + 1] = 0;
    png.data[i + 2] = 0;
    png.data[i + 3] = 0;
  }

  const centerX = ISO_W / 2;
  const centerY = ISO_H / 2;
  const radiusX = size === 'small' ? 8 : 14;
  const radiusY = size === 'small' ? 4 : 7;

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
  for (let y = 0; y < ISO_H; y++) {
    for (let x = 0; x < ISO_W; x++) {
      const dx = (x - centerX) / radiusX;
      const dy = (y - centerY) / radiusY;
      const dist = dx * dx + dy * dy;

      if (dist <= 1 && isInsideDiamond(x, y)) {
        if (dx < -0.3 && dy < -0.3) {
          setPixel(png, x, y, highlightColor.r, highlightColor.g, highlightColor.b, 200);
        } else if (dx > 0.3 && dy > 0.3) {
          setPixel(png, x, y, shadowColor.r, shadowColor.g, shadowColor.b, 200);
        } else {
          setPixel(png, x, y, baseColor.r, baseColor.g, baseColor.b, 200);
        }
      }
    }
  }

  return png;
}

/**
 * Create isometric flower tile
 */
function makeIsoFlowerTile(r, g, b) {
  const png = new PNG({ width: ISO_W, height: ISO_H });

  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0;
    png.data[i + 1] = 0;
    png.data[i + 2] = 0;
    png.data[i + 3] = 0;
  }

  const stem = { r: 60, g: 120, b: 40 };
  const flowers = [[20, 8], [40, 12], [30, 20]];

  flowers.forEach(([fx, fy]) => {
    // Flower (3x3)
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx) + Math.abs(dy) <= 2 && isInsideDiamond(fx + dx, fy + dy)) {
          setPixel(png, fx + dx, fy + dy, r, g, b, 200);
        }
      }
    }
    // Stem
    if (isInsideDiamond(fx, fy + 2)) {
      setPixel(png, fx, fy + 2, stem.r, stem.g, stem.b, 200);
    }
  });

  return png;
}

/**
 * Create isometric fish spot tile
 */
function makeIsoFishSpotTile() {
  const png = new PNG({ width: ISO_W, height: ISO_H });

  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0;
    png.data[i + 1] = 0;
    png.data[i + 2] = 0;
    png.data[i + 3] = 0;
  }

  const ripple = { r: 120, g: 160, b: 200, a: 128 };
  const centerX = ISO_W / 2;
  const centerY = ISO_H / 2;

  // Concentric ripples
  [6, 10, 14].forEach(radius => {
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
      const x = Math.round(centerX + Math.cos(angle) * radius);
      const y = Math.round(centerY + Math.sin(angle) * radius * 0.5);  // Squash for isometric
      if (isInsideDiamond(x, y)) {
        setPixel(png, x, y, ripple.r, ripple.g, ripple.b, ripple.a);
      }
    }
  });

  return png;
}

/**
 * Create isometric pebbles tile
 */
function makeIsoPebblesTile() {
  const png = new PNG({ width: ISO_W, height: ISO_H });

  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0;
    png.data[i + 1] = 0;
    png.data[i + 2] = 0;
    png.data[i + 3] = 0;
  }

  const pebblePositions = [[16, 10], [36, 8], [24, 20], [48, 16], [28, 14], [44, 24]];
  const grays = [
    { r: 120, g: 120, b: 120 },
    { r: 140, g: 140, b: 140 },
    { r: 100, g: 100, b: 100 }
  ];

  pebblePositions.forEach(([px, py], i) => {
    const color = grays[i % grays.length];
    // 2x2 pebble
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        if (isInsideDiamond(px + dx, py + dy)) {
          setPixel(png, px + dx, py + dy, color.r, color.g, color.b, 180);
        }
      }
    }
  });

  return png;
}

/**
 * Copy isometric tile data into output PNG at grid position
 */
function placeTile(output, tile, col, row) {
  const offX = col * ISO_W;
  const offY = row * ISO_H;
  for (let y = 0; y < ISO_H; y++) {
    for (let x = 0; x < ISO_W; x++) {
      const srcIdx = (y * ISO_W + x) * 4;
      const dstIdx = ((offY + y) * OUTPUT_W + (offX + x)) * 4;
      output.data[dstIdx] = tile.data[srcIdx];
      output.data[dstIdx + 1] = tile.data[srcIdx + 1];
      output.data[dstIdx + 2] = tile.data[srcIdx + 2];
      output.data[dstIdx + 3] = tile.data[srcIdx + 3];
    }
  }
}

/**
 * Load a Kenney Tiny Town tile and convert to isometric
 */
function loadTown(n) {
  try {
    const file = path.join(TOWN_DIR, `tile_${String(n).padStart(4, '0')}.png`);
    stats.kenney++;
    return makeIsometric(readTile(file));
  } catch (err) {
    console.warn(`Warning: Could not load town tile ${n}, using placeholder`);
    stats.placeholder++;
    return makeSolidDiamond(128, 128, 128);
  }
}

/**
 * Load a Kenney Tiny Dungeon tile and convert to isometric
 */
function loadDungeon(n) {
  try {
    const file = path.join(DUNGEON_DIR, `tile_${String(n).padStart(4, '0')}.png`);
    stats.kenney++;
    return makeIsometric(readTile(file));
  } catch (err) {
    console.warn(`Warning: Could not load dungeon tile ${n}, using placeholder`);
    stats.placeholder++;
    return makeSolidDiamond(128, 128, 128);
  }
}

// Tile definitions (same as square version)
const ROW0 = [
  { src: 'town', n: 0 },
  { src: 'town', n: 1 },
  { src: 'town', n: 2 },
  { src: 'town', n: 13 },
  { src: 'town', n: 24 },
  { src: 'town', n: 25 },
  { src: 'town', n: 36 },
  { src: 'town', n: 37 },
  { src: 'town', n: 96 },
  { src: 'town', n: 97 },
  { src: 'town', n: 48 },
  { src: 'town', n: 12 },
  { src: 'procedural', fn: 'makeIsoSwampTile' },
  { src: 'town', n: 13 },
  { src: 'dungeon', n: 48 },
  { src: 'transparent' },
];

const ROW1 = [
  { src: 'town', n: 26 },
  { src: 'town', n: 27 },
  { src: 'town', n: 28 },
  { src: 'town', n: 29 },
  { src: 'town', n: 30 },
  { src: 'town', n: 31 },
  { src: 'procedural', fn: 'makeIsoWaterCorner', args: [false, 'NE'] },
  { src: 'procedural', fn: 'makeIsoWaterCorner', args: [false, 'NW'] },
  { src: 'procedural', fn: 'makeIsoWaterCorner', args: [false, 'SE'] },
  { src: 'procedural', fn: 'makeIsoWaterCorner', args: [false, 'SW'] },
  { src: 'procedural', fn: 'makeIsoWaterCorner', args: [true, 'NE'] },
  { src: 'procedural', fn: 'makeIsoWaterCorner', args: [true, 'NW'] },
  { src: 'procedural', fn: 'makeIsoWaterCorner', args: [true, 'SE'] },
  { src: 'procedural', fn: 'makeIsoWaterCorner', args: [true, 'SW'] },
  { src: 'procedural', fn: 'makeIsoRiverTile', args: [true] },
  { src: 'procedural', fn: 'makeIsoRiverTile', args: [false] },
];

const ROW2 = [
  { src: 'town', n: 49 },
  { src: 'town', n: 49 },
  { src: 'town', n: 48 },
  { src: 'town', n: 48 },
  { src: 'town', n: 48 },
  { src: 'town', n: 48 },
  { src: 'town', n: 48 },
  { src: 'town', n: 48 },
  { src: 'town', n: 48 },
  { src: 'town', n: 48 },
  { src: 'town', n: 44 },
  { src: 'town', n: 47 },
  { src: 'transparent' },
  { src: 'transparent' },
  { src: 'transparent' },
  { src: 'transparent' },
];

const ROW3 = [
  { src: 'dungeon', n: 36 },
  { src: 'dungeon', n: 37 },
  { src: 'dungeon', n: 38 },
  { src: 'dungeon', n: 39 },
  { src: 'dungeon', n: 40 },
  { src: 'dungeon', n: 40 },
  { src: 'dungeon', n: 36 },
  { src: 'dungeon', n: 37 },
  { src: 'town', n: 50 },
  { src: 'town', n: 96 },
  { src: 'transparent' },
  { src: 'transparent' },
  { src: 'transparent' },
  { src: 'transparent' },
  { src: 'transparent' },
  { src: 'transparent' },
];

const ROW4 = [
  { src: 'town', n: 4 },
  { src: 'town', n: 5 },
  { src: 'town', n: 6 },
  { src: 'town', n: 7 },
  { src: 'town', n: 8 },
  { src: 'town', n: 18 },
  { src: 'town', n: 9 },
  { src: 'town', n: 10 },
  { src: 'town', n: 20 },
  { src: 'town', n: 21 },
  { src: 'town', n: 22 },
  { src: 'town', n: 23 },
  { src: 'town', n: 16 },
  { src: 'town', n: 17 },
  { src: 'town', n: 19 },
  { src: 'town', n: 11 },
];

const ROW5 = [
  { src: 'procedural', fn: 'makeIsoRockTile', args: ['small', 'normal'] },
  { src: 'procedural', fn: 'makeIsoRockTile', args: ['large', 'normal'] },
  { src: 'procedural', fn: 'makeIsoRockTile', args: ['large', 'mossy'] },
  { src: 'procedural', fn: 'makeIsoRockTile', args: ['large', 'iron'] },
  { src: 'procedural', fn: 'makeIsoRockTile', args: ['large', 'gold'] },
  { src: 'dungeon', n: 56 },
  { src: 'dungeon', n: 123 },
  { src: 'dungeon', n: 124 },
  { src: 'dungeon', n: 108 },
  { src: 'dungeon', n: 114 },
  { src: 'procedural', fn: 'makeIsoFlowerTile', args: [208, 64, 64] },
  { src: 'procedural', fn: 'makeIsoFlowerTile', args: [64, 64, 208] },
  { src: 'procedural', fn: 'makeIsoFlowerTile', args: [208, 208, 64] },
  { src: 'town', n: 34 },
  { src: 'town', n: 35 },
  { src: 'procedural', fn: 'makeIsoFishSpotTile' },
];

const ROW6 = [
  { src: 'town', n: 43 },
  { src: 'procedural', fn: 'makeIsoPebblesTile' },
  { src: 'town', n: 33 },
  { src: 'town', n: 109 },
  { src: 'dungeon', n: 121 },
  { src: 'town', n: 115 },
  { src: 'town', n: 44 },
  { src: 'town', n: 47 },
  { src: 'town', n: 125 },
  { src: 'town', n: 3 },
  { src: 'town', n: 130 },
  { src: 'town', n: 131 },
  { src: 'town', n: 116 },
  { src: 'dungeon', n: 44 },
  { src: 'town', n: 15 },
  { src: 'transparent' },
];

// Main assembly
console.log('Starting isometric terrain sheet generation...\n');

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
      tile = makeSolidDiamond(0, 0, 0, 0);
      stats.transparent++;
    } else if (def.src === 'procedural') {
      const fnName = def.fn;
      const args = def.args || [];

      if (fnName === 'makeIsoWaterCorner') {
        tile = makeIsoWaterCorner(...args);
      } else if (fnName === 'makeIsoRiverTile') {
        tile = makeIsoRiverTile(...args);
      } else if (fnName === 'makeIsoSwampTile') {
        tile = makeIsoSwampTile();
      } else if (fnName === 'makeIsoRockTile') {
        tile = makeIsoRockTile(...args);
      } else if (fnName === 'makeIsoFlowerTile') {
        tile = makeIsoFlowerTile(...args);
      } else if (fnName === 'makeIsoFishSpotTile') {
        tile = makeIsoFishSpotTile();
      } else if (fnName === 'makeIsoPebblesTile') {
        tile = makeIsoPebblesTile();
      } else {
        console.warn(`Unknown procedural function: ${fnName}`);
        tile = makeSolidDiamond(255, 0, 255);
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

console.log(`\nIsometric terrain sheet written: ${OUTPUT}`);
console.log(`Dimensions: ${OUTPUT_W}x${OUTPUT_H} (${COLS} cols x ${ROWS} rows, ${ISO_W}x${ISO_H} tiles)\n`);
console.log('Statistics:');
console.log(`  Kenney tiles: ${stats.kenney}`);
console.log(`  Procedural tiles: ${stats.procedural}`);
console.log(`  Placeholder tiles: ${stats.placeholder}`);
console.log(`  Transparent tiles: ${stats.transparent}`);
console.log(`  Total: ${stats.kenney + stats.procedural + stats.placeholder + stats.transparent}\n`);

// Generate JSON mapping
const tilesJson = {
  tileSize: { width: 64, height: 32 },
  columns: 16,
  rows: 7,
  imageWidth: 1024,
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
