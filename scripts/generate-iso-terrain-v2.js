const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

// Isometric tile dimensions
const ISO_W = 64;  // Diamond width
const ISO_H = 32;  // Diamond height
const COLS = 16;
const ROWS = 14;  // Expanded from 7 to 14
const OUTPUT_W = COLS * ISO_W;  // 1024
const OUTPUT_H = ROWS * ISO_H;  // 448

const OUTPUT = path.join(__dirname, '../packages/client/public/assets/tiles/iso-terrain-sheet.png');
const JSON_OUTPUT = path.join(__dirname, '../packages/client/public/assets/tiles/iso-terrain-tiles.json');

// ═══════════════════════════════════════════════════
// NOISE FUNCTIONS
// ═══════════════════════════════════════════════════

/**
 * Simple hash function for pseudo-random values
 */
function hash(x, y, seed = 0) {
  let n = (x * 374761393 + y * 668265263 + seed * 2147483647);
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296; // 0..1
}

/**
 * Smooth interpolation (cosine)
 */
function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

/**
 * 2D Value Noise with smooth interpolation
 */
function valueNoise(x, y, seed = 0) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;

  const fx = x - x0;
  const fy = y - y0;

  const sx = smoothstep(fx);
  const sy = smoothstep(fy);

  // Sample grid points
  const n00 = hash(x0, y0, seed);
  const n10 = hash(x1, y0, seed);
  const n01 = hash(x0, y1, seed);
  const n11 = hash(x1, y1, seed);

  // Bilinear interpolation
  const nx0 = n00 * (1 - sx) + n10 * sx;
  const nx1 = n01 * (1 - sx) + n11 * sx;

  return nx0 * (1 - sy) + nx1 * sy;
}

/**
 * Multi-octave noise for natural variation
 */
function fbmNoise(x, y, octaves = 3, seed = 0) {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += valueNoise(x * frequency, y * frequency, seed + i) * amplitude;
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return value / maxValue;
}

// ═══════════════════════════════════════════════════
// DIAMOND UTILITIES
// ═══════════════════════════════════════════════════

/**
 * Check if a pixel is inside the diamond shape
 */
function isInsideDiamond(px, py, w = ISO_W, h = ISO_H) {
  const cx = w / 2;
  const cy = h / 2;
  return (Math.abs(px - cx) / cx + Math.abs(py - cy) / cy) <= 1.0;
}

/**
 * Get distance from diamond edge (0 = edge, 1 = center)
 */
function diamondDistance(px, py, w = ISO_W, h = ISO_H) {
  const cx = w / 2;
  const cy = h / 2;
  const dist = Math.abs(px - cx) / cx + Math.abs(py - cy) / cy;
  return Math.max(0, 1 - dist);
}

/**
 * Apply isometric shading (lighter top-left, darker bottom-right)
 */
function applyIsoShading(x, y, baseColor, intensity = 0.15) {
  const cx = ISO_W / 2;
  const cy = ISO_H / 2;

  // Calculate shading factor based on position
  const shadeFactor = ((x - cx) / ISO_W + (y - cy) / ISO_H) * intensity;

  return {
    r: Math.max(0, Math.min(255, baseColor.r * (1 - shadeFactor))),
    g: Math.max(0, Math.min(255, baseColor.g * (1 - shadeFactor))),
    b: Math.max(0, Math.min(255, baseColor.b * (1 - shadeFactor)))
  };
}

/**
 * Blend two colors
 */
function blendColors(c1, c2, t) {
  return {
    r: Math.round(c1.r * (1 - t) + c2.r * t),
    g: Math.round(c1.g * (1 - t) + c2.g * t),
    b: Math.round(c1.b * (1 - t) + c2.b * t)
  };
}

// ═══════════════════════════════════════════════════
// COLOR PALETTES
// ═══════════════════════════════════════════════════

const PALETTES = {
  grass_lush: [
    { r: 74, g: 140, b: 63 },   // #4a8c3f
    { r: 93, g: 160, b: 73 },   // #5da049
    { r: 61, g: 122, b: 53 }    // #3d7a35
  ],
  grass_dry: [
    { r: 150, g: 140, b: 80 },
    { r: 160, g: 150, b: 90 },
    { r: 140, g: 130, b: 70 }
  ],
  grass_dark: [
    { r: 42, g: 90, b: 32 },    // #2a5a20
    { r: 51, g: 107, b: 40 },   // #336b28
    { r: 35, g: 75, b: 28 }
  ],
  dirt: [
    { r: 139, g: 105, b: 20 },  // #8B6914
    { r: 160, g: 120, b: 40 },  // #A07828
    { r: 107, g: 82, b: 16 }    // #6B5210
  ],
  sand: [
    { r: 212, g: 168, b: 67 },  // #D4A843
    { r: 196, g: 154, b: 60 },  // #C49A3C
    { r: 228, g: 184, b: 83 }   // #E4B853
  ],
  snow: [
    { r: 232, g: 237, b: 243 }, // #E8EDF3
    { r: 208, g: 216, b: 232 }, // #D0D8E8
    { r: 240, g: 244, b: 248 }  // #F0F4F8
  ],
  water_deep: [
    { r: 34, g: 85, b: 170 },   // #2255AA
    { r: 17, g: 68, b: 170 },   // #1144AA
    { r: 51, g: 102, b: 187 }   // #3366BB
  ],
  water_shallow: [
    { r: 68, g: 170, b: 204 },  // #44AACC
    { r: 85, g: 187, b: 221 }   // #55BBDD
  ],
  stone: [
    { r: 128, g: 136, b: 144 }, // #808890
    { r: 144, g: 154, b: 160 }, // #909AA0
    { r: 112, g: 120, b: 128 }  // #707880
  ],
  swamp: [
    { r: 61, g: 90, b: 42 },    // #3D5A2A
    { r: 74, g: 107, b: 48 }    // #4A6B30
  ],
  farmland: [
    { r: 139, g: 114, b: 64 },  // #8B7240
    { r: 160, g: 133, b: 80 }   // #A08550
  ]
};

// ═══════════════════════════════════════════════════
// TILE GENERATION
// ═══════════════════════════════════════════════════

/**
 * Create a new empty PNG with transparent background
 */
function createEmptyTile() {
  const png = new PNG({ width: ISO_W, height: ISO_H });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0;
    png.data[i + 1] = 0;
    png.data[i + 2] = 0;
    png.data[i + 3] = 0;
  }
  return png;
}

/**
 * Set a pixel with anti-aliasing support
 */
function setPixel(png, x, y, r, g, b, a = 255) {
  if (x < 0 || x >= ISO_W || y < 0 || y >= ISO_H) return;
  const idx = (y * ISO_W + x) * 4;
  png.data[idx] = Math.round(r);
  png.data[idx + 1] = Math.round(g);
  png.data[idx + 2] = Math.round(b);
  png.data[idx + 3] = Math.round(a);
}

/**
 * Generate a terrain tile with noise-based texture
 */
function generateTerrainTile(palette, variant = 0, seed = 0) {
  const png = createEmptyTile();
  const baseColor = palette[variant % palette.length];

  for (let y = 0; y < ISO_H; y++) {
    for (let x = 0; x < ISO_W; x++) {
      if (!isInsideDiamond(x, y)) continue;

      // Get noise value for texture
      const noiseScale = 0.2;
      const noise = fbmNoise(x * noiseScale, y * noiseScale, 3, seed + variant);

      // Apply noise variation (±15% brightness)
      const brightness = 0.85 + noise * 0.3;
      let color = {
        r: baseColor.r * brightness,
        g: baseColor.g * brightness,
        b: baseColor.b * brightness
      };

      // Apply isometric shading
      color = applyIsoShading(x, y, color, 0.12);

      // Anti-aliasing at edges
      const edgeDist = diamondDistance(x, y);
      const alpha = edgeDist < 0.05 ? edgeDist * 20 * 255 : 255;

      setPixel(png, x, y, color.r, color.g, color.b, alpha);
    }
  }

  return png;
}

/**
 * Add detail elements to a tile
 */
function addGrassDetails(png, seed = 0) {
  // Add tiny flower/weed dots
  for (let i = 0; i < 8; i++) {
    const x = Math.floor(hash(i, 0, seed) * (ISO_W - 8)) + 4;
    const y = Math.floor(hash(i, 1, seed) * (ISO_H - 4)) + 2;

    if (isInsideDiamond(x, y)) {
      const colors = [
        { r: 220, g: 220, b: 100 }, // yellow
        { r: 255, g: 200, b: 200 }, // pink
        { r: 200, g: 255, b: 200 }  // light green
      ];
      const color = colors[i % colors.length];
      setPixel(png, x, y, color.r, color.g, color.b, 180);
    }
  }
  return png;
}

/**
 * Add pebbles to dirt/sand tiles
 */
function addPebbles(png, count = 6, seed = 0) {
  for (let i = 0; i < count; i++) {
    const x = Math.floor(hash(i, 2, seed) * (ISO_W - 6)) + 3;
    const y = Math.floor(hash(i, 3, seed) * (ISO_H - 3)) + 1;

    if (isInsideDiamond(x, y)) {
      const gray = 100 + hash(i, 4, seed) * 60;
      setPixel(png, x, y, gray, gray, gray, 160);
      if (isInsideDiamond(x + 1, y)) {
        setPixel(png, x + 1, y, gray * 0.9, gray * 0.9, gray * 0.9, 160);
      }
    }
  }
  return png;
}

/**
 * Add wave pattern to water
 */
function addWavePattern(png, seed = 0) {
  for (let y = 0; y < ISO_H; y++) {
    for (let x = 0; x < ISO_W; x++) {
      if (!isInsideDiamond(x, y)) continue;

      const waveNoise = Math.sin(x * 0.3 + seed) * Math.cos(y * 0.4 + seed);
      if (waveNoise > 0.7) {
        const idx = (y * ISO_W + x) * 4;
        const current = {
          r: png.data[idx],
          g: png.data[idx + 1],
          b: png.data[idx + 2]
        };

        const highlight = {
          r: Math.min(255, current.r * 1.2),
          g: Math.min(255, current.g * 1.2),
          b: Math.min(255, current.b * 1.2)
        };

        setPixel(png, x, y, highlight.r, highlight.g, highlight.b);
      }
    }
  }
  return png;
}

/**
 * Add cracks to stone
 */
function addCracks(png, seed = 0) {
  const numCracks = 3;
  for (let i = 0; i < numCracks; i++) {
    let x = Math.floor(hash(i, 5, seed) * ISO_W);
    let y = Math.floor(hash(i, 6, seed) * ISO_H);

    const dx = hash(i, 7, seed) > 0.5 ? 1 : -1;
    const dy = hash(i, 8, seed) > 0.5 ? 1 : -1;

    for (let j = 0; j < 8; j++) {
      if (isInsideDiamond(x, y)) {
        setPixel(png, x, y, 50, 50, 55, 180);
      }
      x += dx * (hash(j, 9, seed) > 0.5 ? 1 : 0);
      y += dy * (hash(j, 10, seed) > 0.5 ? 1 : 0);
    }
  }
  return png;
}

/**
 * Add furrow lines to farmland
 */
function addFurrows(png) {
  const furrowSpacing = 4;
  for (let y = furrowSpacing; y < ISO_H; y += furrowSpacing) {
    for (let x = 0; x < ISO_W; x++) {
      if (isInsideDiamond(x, y)) {
        const idx = (y * ISO_W + x) * 4;
        png.data[idx] *= 0.85;
        png.data[idx + 1] *= 0.85;
        png.data[idx + 2] *= 0.85;
      }
    }
  }
  return png;
}

/**
 * Generate water shore tile
 */
function generateWaterShoreTile(direction, isInner = false) {
  const png = createEmptyTile();
  const grass = PALETTES.grass_lush[0];
  const water = PALETTES.water_shallow[0];

  for (let y = 0; y < ISO_H; y++) {
    for (let x = 0; x < ISO_W; x++) {
      if (!isInsideDiamond(x, y)) continue;

      let useWater = false;
      const cx = ISO_W / 2;
      const cy = ISO_H / 2;

      if (isInner) {
        // Inner corners - water everywhere except corner
        if (direction === 'NE' && x > cx && y < cy) useWater = false;
        else if (direction === 'NW' && x < cx && y < cy) useWater = false;
        else if (direction === 'SE' && x > cx && y > cy) useWater = false;
        else if (direction === 'SW' && x < cx && y > cy) useWater = false;
        else useWater = true;
      } else {
        // Outer shores - water on one side
        if (direction === 'N' && y < cy) useWater = true;
        else if (direction === 'S' && y > cy) useWater = true;
        else if (direction === 'E' && x > cx) useWater = true;
        else if (direction === 'W' && x < cx) useWater = true;
        else if (direction === 'NE' && (x - cx + y - cy) > 0) useWater = true;
        else if (direction === 'NW' && (cx - x + y - cy) > 0) useWater = true;
        else if (direction === 'SE' && (x - cx + cy - y) > 0) useWater = true;
        else if (direction === 'SW' && (cx - x + cy - y) > 0) useWater = true;
      }

      // Add wavy boundary
      const waveOffset = Math.sin(x * 0.3) * Math.cos(y * 0.4) * 2;

      const color = useWater ? water : grass;
      const noise = fbmNoise(x * 0.2, y * 0.2, 2, 100);
      const brightness = 0.85 + noise * 0.3;

      let finalColor = {
        r: color.r * brightness,
        g: color.g * brightness,
        b: color.b * brightness
      };

      finalColor = applyIsoShading(x, y, finalColor, 0.12);
      const edgeDist = diamondDistance(x, y);
      const alpha = edgeDist < 0.05 ? edgeDist * 20 * 255 : 255;

      setPixel(png, x, y, finalColor.r, finalColor.g, finalColor.b, alpha);
    }
  }

  return png;
}

/**
 * Generate road tile
 */
function generateRoadTile(type, direction) {
  const png = createEmptyTile();
  const ground = PALETTES.grass_lush[0];
  const roadDirt = { r: 120, g: 95, b: 50 };
  const roadStone = PALETTES.stone[0];
  const roadColor = type === 'dirt' ? roadDirt : roadStone;

  const roadWidth = 16;

  for (let y = 0; y < ISO_H; y++) {
    for (let x = 0; x < ISO_W; x++) {
      if (!isInsideDiamond(x, y)) continue;

      const cx = ISO_W / 2;
      const cy = ISO_H / 2;
      let isRoad = false;

      if (direction === 'H') {
        isRoad = Math.abs(y - cy) < roadWidth / 4;
      } else if (direction === 'V') {
        isRoad = Math.abs(x - cx) < roadWidth / 2;
      } else if (direction === 'cross') {
        isRoad = Math.abs(y - cy) < roadWidth / 4 || Math.abs(x - cx) < roadWidth / 2;
      } else if (direction.startsWith('turn_')) {
        const corner = direction.split('_')[1];
        if (corner === 'NE') isRoad = (x > cx && Math.abs(y - cy) < roadWidth / 4) || (y < cy && Math.abs(x - cx) < roadWidth / 2);
        else if (corner === 'NW') isRoad = (x < cx && Math.abs(y - cy) < roadWidth / 4) || (y < cy && Math.abs(x - cx) < roadWidth / 2);
        else if (corner === 'SE') isRoad = (x > cx && Math.abs(y - cy) < roadWidth / 4) || (y > cy && Math.abs(x - cx) < roadWidth / 2);
        else if (corner === 'SW') isRoad = (x < cx && Math.abs(y - cy) < roadWidth / 4) || (y > cy && Math.abs(x - cx) < roadWidth / 2);
      } else if (direction.startsWith('end_')) {
        const endDir = direction.split('_')[1];
        if (endDir === 'N') isRoad = y < cy && Math.abs(x - cx) < roadWidth / 2;
        else if (endDir === 'S') isRoad = y > cy && Math.abs(x - cx) < roadWidth / 2;
      }

      const color = isRoad ? roadColor : ground;
      const noise = fbmNoise(x * 0.2, y * 0.2, 2, 200);
      const brightness = 0.85 + noise * 0.3;

      let finalColor = {
        r: color.r * brightness,
        g: color.g * brightness,
        b: color.b * brightness
      };

      // Cobblestone pattern for stone roads
      if (isRoad && type === 'stone') {
        const cobble = Math.floor(x / 4) + Math.floor(y / 3);
        if (cobble % 2 === 0) {
          finalColor.r *= 0.95;
          finalColor.g *= 0.95;
          finalColor.b *= 0.95;
        }
      }

      finalColor = applyIsoShading(x, y, finalColor, 0.12);
      const edgeDist = diamondDistance(x, y);
      const alpha = edgeDist < 0.05 ? edgeDist * 20 * 255 : 255;

      setPixel(png, x, y, finalColor.r, finalColor.g, finalColor.b, alpha);
    }
  }

  return png;
}

/**
 * Generate cliff tile
 */
function generateCliffTile(type, direction) {
  const png = createEmptyTile();
  const cliffColor = { r: 90, g: 85, b: 80 };
  const topColor = PALETTES.stone[1];

  for (let y = 0; y < ISO_H; y++) {
    for (let x = 0; x < ISO_W; x++) {
      if (!isInsideDiamond(x, y)) continue;

      let color = cliffColor;

      if (type === 'top') {
        color = topColor;
      } else if (type === 'face') {
        // Vertical wall effect
        color = {
          r: cliffColor.r * 0.7,
          g: cliffColor.g * 0.7,
          b: cliffColor.b * 0.7
        };
      }

      const noise = fbmNoise(x * 0.3, y * 0.3, 3, 300);
      const brightness = 0.8 + noise * 0.4;

      let finalColor = {
        r: color.r * brightness,
        g: color.g * brightness,
        b: color.b * brightness
      };

      finalColor = applyIsoShading(x, y, finalColor, 0.15);
      const edgeDist = diamondDistance(x, y);
      const alpha = edgeDist < 0.05 ? edgeDist * 20 * 255 : 255;

      setPixel(png, x, y, finalColor.r, finalColor.g, finalColor.b, alpha);
    }
  }

  return png;
}

/**
 * Generate transition tile between two biomes
 */
function generateTransitionTile(biome1, biome2, direction) {
  const png = createEmptyTile();
  const palette1 = PALETTES[biome1];
  const palette2 = PALETTES[biome2];
  const color1 = palette1[0];
  const color2 = palette2[0];

  for (let y = 0; y < ISO_H; y++) {
    for (let x = 0; x < ISO_W; x++) {
      if (!isInsideDiamond(x, y)) continue;

      let t = 0;
      const cx = ISO_W / 2;
      const cy = ISO_H / 2;

      if (direction === 'N') t = y / ISO_H;
      else if (direction === 'S') t = 1 - y / ISO_H;
      else if (direction === 'E') t = x / ISO_W;
      else if (direction === 'W') t = 1 - x / ISO_W;

      const noise = fbmNoise(x * 0.2, y * 0.2, 2, 400);
      t = Math.max(0, Math.min(1, t + noise * 0.2 - 0.1));

      let color = blendColors(color1, color2, t);
      color = applyIsoShading(x, y, color, 0.12);

      const edgeDist = diamondDistance(x, y);
      const alpha = edgeDist < 0.05 ? edgeDist * 20 * 255 : 255;

      setPixel(png, x, y, color.r, color.g, color.b, alpha);
    }
  }

  return png;
}

// ═══════════════════════════════════════════════════
// TILE ASSEMBLY
// ═══════════════════════════════════════════════════

/**
 * Copy tile data into output PNG at grid position
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

// ═══════════════════════════════════════════════════
// TILE DEFINITIONS
// ═══════════════════════════════════════════════════

console.log('Starting enhanced isometric terrain generation...\n');

const output = new PNG({ width: OUTPUT_W, height: OUTPUT_H });

// Initialize to transparent
for (let i = 0; i < output.data.length; i += 4) {
  output.data[i] = 0;
  output.data[i + 1] = 0;
  output.data[i + 2] = 0;
  output.data[i + 3] = 0;
}

const tileMap = {};
let tileIndex = 0;

// Helper to add tile
function addTile(name, tile) {
  tileMap[name] = tileIndex;
  const col = tileIndex % COLS;
  const row = Math.floor(tileIndex / COLS);
  placeTile(output, tile, col, row);
  tileIndex++;
}

// ROW 0: Grass variants and dirt
console.log('Generating Row 0: Grass and dirt...');
for (let i = 1; i <= 5; i++) {
  const tile = generateTerrainTile(PALETTES.grass_lush, i - 1, 1000 + i);
  addGrassDetails(tile, 1000 + i);
  addTile(`grass_lush_0${i}`, tile);
}
for (let i = 1; i <= 3; i++) {
  const tile = generateTerrainTile(PALETTES.grass_dry, i - 1, 2000 + i);
  addTile(`grass_dry_0${i}`, tile);
}
for (let i = 1; i <= 3; i++) {
  const tile = generateTerrainTile(PALETTES.grass_dark, i - 1, 3000 + i);
  addTile(`grass_dark_0${i}`, tile);
}
for (let i = 1; i <= 3; i++) {
  const tile = generateTerrainTile(PALETTES.dirt, i - 1, 4000 + i);
  addPebbles(tile, 5, 4000 + i);
  addTile(`dirt_0${i}`, tile);
}
for (let i = 1; i <= 2; i++) {
  const tile = generateTerrainTile(PALETTES.dirt, i - 1, 4500 + i);
  addTile(`dirt_path_0${i}`, tile);
}

// ROW 1: Sand, snow, stone
console.log('Generating Row 1: Sand, snow, stone...');
for (let i = 1; i <= 3; i++) {
  const tile = generateTerrainTile(PALETTES.sand, i - 1, 5000 + i);
  addPebbles(tile, 4, 5000 + i);
  addTile(`sand_0${i}`, tile);
}
for (let i = 1; i <= 2; i++) {
  const tile = generateTerrainTile(PALETTES.sand, i - 1, 5500 + i);
  addTile(`sand_wet_0${i}`, tile);
}
for (let i = 1; i <= 3; i++) {
  const tile = generateTerrainTile(PALETTES.snow, i - 1, 6000 + i);
  addTile(`snow_0${i}`, tile);
}
for (let i = 1; i <= 2; i++) {
  const tile = generateTerrainTile(PALETTES.snow, i - 1, 6500 + i);
  addPebbles(tile, 3, 6500 + i);
  addTile(`snow_dirty_0${i}`, tile);
}
for (let i = 1; i <= 3; i++) {
  const tile = generateTerrainTile(PALETTES.stone, i - 1, 7000 + i);
  addCracks(tile, 7000 + i);
  addTile(`stone_0${i}`, tile);
}
for (let i = 1; i <= 3; i++) {
  const tile = generateTerrainTile(PALETTES.stone, i - 1, 7500 + i);
  addTile(`stone_cobble_0${i}`, tile);
}

// ROW 2: Farmland, swamp, cave, water
console.log('Generating Row 2: Farmland, swamp, water...');
for (let i = 1; i <= 3; i++) {
  const tile = generateTerrainTile(PALETTES.farmland, i - 1, 8000 + i);
  addFurrows(tile);
  addTile(`farmland_0${i}`, tile);
}
for (let i = 1; i <= 2; i++) {
  const tile = generateTerrainTile(PALETTES.swamp, i - 1, 9000 + i);
  addTile(`swamp_0${i}`, tile);
}
for (let i = 1; i <= 2; i++) {
  const tile = generateTerrainTile(PALETTES.stone, 0, 9500 + i);
  addTile(`cave_0${i}`, tile);
}
for (let i = 1; i <= 3; i++) {
  const tile = generateTerrainTile(PALETTES.water_deep, i - 1, 10000 + i);
  addWavePattern(tile, 10000 + i);
  addTile(`water_deep_0${i}`, tile);
}
for (let i = 1; i <= 3; i++) {
  const tile = generateTerrainTile(PALETTES.water_shallow, i % 2, 11000 + i);
  addWavePattern(tile, 11000 + i);
  addTile(`water_shallow_0${i}`, tile);
}
addTile('water_shore_N', generateWaterShoreTile('N'));
addTile('water_shore_S', generateWaterShoreTile('S'));
addTile('water_shore_E', generateWaterShoreTile('E'));

// ROW 3: Water shores continued, river
console.log('Generating Row 3: Water shores and rivers...');
addTile('water_shore_W', generateWaterShoreTile('W'));
addTile('water_shore_NE', generateWaterShoreTile('NE'));
addTile('water_shore_NW', generateWaterShoreTile('NW'));
addTile('water_shore_SE', generateWaterShoreTile('SE'));
addTile('water_shore_SW', generateWaterShoreTile('SW'));
addTile('water_shore_inner_NE', generateWaterShoreTile('NE', true));
addTile('water_shore_inner_NW', generateWaterShoreTile('NW', true));
addTile('water_shore_inner_SE', generateWaterShoreTile('SE', true));
addTile('water_shore_inner_SW', generateWaterShoreTile('SW', true));
addTile('water_river_H', generateWaterShoreTile('N')); // Simplified river
addTile('water_river_V', generateWaterShoreTile('W')); // Simplified river
addTile('water_river_turn_NE', generateWaterShoreTile('NE'));
addTile('water_river_turn_NW', generateWaterShoreTile('NW'));
addTile('water_river_turn_SE', generateWaterShoreTile('SE'));
addTile('water_river_turn_SW', generateWaterShoreTile('SW'));
addTile('water_river_cross', generateWaterShoreTile('N'));
addTile('blank_0', createEmptyTile());

// ROW 4: Dirt roads
console.log('Generating Row 4: Dirt roads...');
addTile('road_dirt_H', generateRoadTile('dirt', 'H'));
addTile('road_dirt_V', generateRoadTile('dirt', 'V'));
addTile('road_dirt_cross', generateRoadTile('dirt', 'cross'));
addTile('road_dirt_turn_NE', generateRoadTile('dirt', 'turn_NE'));
addTile('road_dirt_turn_NW', generateRoadTile('dirt', 'turn_NW'));
addTile('road_dirt_turn_SE', generateRoadTile('dirt', 'turn_SE'));
addTile('road_dirt_turn_SW', generateRoadTile('dirt', 'turn_SW'));
addTile('road_stone_H', generateRoadTile('stone', 'H'));
addTile('road_stone_V', generateRoadTile('stone', 'V'));
addTile('road_stone_cross', generateRoadTile('stone', 'cross'));
addTile('road_stone_turn_NE', generateRoadTile('stone', 'turn_NE'));
addTile('road_stone_turn_NW', generateRoadTile('stone', 'turn_NW'));
addTile('road_stone_turn_SE', generateRoadTile('stone', 'turn_SE'));
addTile('road_stone_turn_SW', generateRoadTile('stone', 'turn_SW'));
addTile('road_stone_end_N', generateRoadTile('stone', 'end_N'));
addTile('road_stone_end_S', generateRoadTile('stone', 'end_S'));

// ROW 5: Cliffs and mountains
console.log('Generating Row 5: Cliffs...');
addTile('cliff_face_N', generateCliffTile('face', 'N'));
addTile('cliff_face_S', generateCliffTile('face', 'S'));
addTile('cliff_face_E', generateCliffTile('face', 'E'));
addTile('cliff_face_W', generateCliffTile('face', 'W'));
for (let i = 1; i <= 3; i++) {
  addTile(`cliff_top_0${i}`, generateCliffTile('top', 'none'));
}
addTile('cliff_edge_N', generateCliffTile('edge', 'N'));
addTile('cliff_edge_S', generateCliffTile('edge', 'S'));
addTile('cliff_edge_E', generateCliffTile('edge', 'E'));
addTile('cliff_edge_W', generateCliffTile('edge', 'W'));
for (let i = 1; i <= 3; i++) {
  const tile = generateTerrainTile(PALETTES.stone, i - 1, 12000 + i);
  addTile(`mountain_rock_0${i}`, tile);
}
for (let i = 0; i < 3; i++) {
  addTile(`blank_${i + 1}`, createEmptyTile());
}

// ROW 6: Transitions grass-dirt
console.log('Generating Row 6: Transitions grass-dirt...');
addTile('transition_grass_dirt_N', generateTransitionTile('grass_lush', 'dirt', 'N'));
addTile('transition_grass_dirt_S', generateTransitionTile('grass_lush', 'dirt', 'S'));
addTile('transition_grass_dirt_E', generateTransitionTile('grass_lush', 'dirt', 'E'));
addTile('transition_grass_dirt_W', generateTransitionTile('grass_lush', 'dirt', 'W'));
addTile('transition_grass_sand_N', generateTransitionTile('grass_lush', 'sand', 'N'));
addTile('transition_grass_sand_S', generateTransitionTile('grass_lush', 'sand', 'S'));
addTile('transition_grass_sand_E', generateTransitionTile('grass_lush', 'sand', 'E'));
addTile('transition_grass_sand_W', generateTransitionTile('grass_lush', 'sand', 'W'));
addTile('transition_grass_snow_N', generateTransitionTile('grass_lush', 'snow', 'N'));
addTile('transition_grass_snow_S', generateTransitionTile('grass_lush', 'snow', 'S'));
addTile('transition_grass_snow_E', generateTransitionTile('grass_lush', 'snow', 'E'));
addTile('transition_grass_snow_W', generateTransitionTile('grass_lush', 'snow', 'W'));
addTile('transition_sand_water_N', generateTransitionTile('sand', 'water_shallow', 'N'));
addTile('transition_sand_water_S', generateTransitionTile('sand', 'water_shallow', 'S'));
addTile('transition_sand_water_E', generateTransitionTile('sand', 'water_shallow', 'E'));
addTile('transition_sand_water_W', generateTransitionTile('sand', 'water_shallow', 'W'));

// ROWS 7-13: Fill remaining with variants and decorations
console.log('Generating Rows 7-13: Additional variants...');
while (tileIndex < COLS * ROWS) {
  const variant = tileIndex % 5;
  const tile = generateTerrainTile(PALETTES.grass_lush, variant, 20000 + tileIndex);
  if (tileIndex % 3 === 0) addGrassDetails(tile, 20000 + tileIndex);
  addTile(`extra_${tileIndex}`, tile);
}

// ═══════════════════════════════════════════════════
// OUTPUT
// ═══════════════════════════════════════════════════

// Write PNG
const buffer = PNG.sync.write(output);
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, buffer);

console.log(`\n✓ Isometric terrain sheet written: ${OUTPUT}`);
console.log(`  Dimensions: ${OUTPUT_W}x${OUTPUT_H} (${COLS} cols × ${ROWS} rows)`);
console.log(`  Tile size: ${ISO_W}x${ISO_H} pixels`);
console.log(`  Total tiles: ${tileIndex}`);

// Write JSON
const tilesJson = {
  tileSize: { width: ISO_W, height: ISO_H },
  columns: COLS,
  rows: ROWS,
  imageWidth: OUTPUT_W,
  imageHeight: OUTPUT_H,
  tiles: tileMap
};

fs.writeFileSync(JSON_OUTPUT, JSON.stringify(tilesJson, null, 2));
console.log(`✓ Tile mapping written: ${JSON_OUTPUT}`);
console.log(`  ${Object.keys(tileMap).length} named tiles\n`);

console.log('Done! 🎨\n');
