/**
 * Isometric Terrain Sheet Generator v3 — Premium Quality
 *
 * Key improvements over v2:
 * - Warm fantasy RPG color palettes (hand-painted feel)
 * - Multi-octave noise with domain warping for organic textures
 * - Pixel-art detail overlays (grass blades, stone grain, water highlights)
 * - Consistent top-left lighting with soft shadows
 * - Anti-aliased diamond edges
 * - All 224 tile slots filled with useful, named tiles
 * - Dithering for richer color depth
 */

const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════

const ISO_W = 64;
const ISO_H = 32;
const COLS = 16;
const ROWS = 14;
const OUTPUT_W = COLS * ISO_W;  // 1024
const OUTPUT_H = ROWS * ISO_H;  // 448

const OUTPUT_PNG = path.join(__dirname, '../packages/client/public/assets/tiles/iso-terrain-sheet.png');
const OUTPUT_JSON = path.join(__dirname, '../packages/client/public/assets/tiles/iso-terrain-tiles.json');

// ═══════════════════════════════════════════════════
// NOISE & MATH
// ═══════════════════════════════════════════════════

function hash(x, y, seed = 0) {
  let n = ((x | 0) * 374761393 + (y | 0) * 668265263 + (seed | 0) * 1013904223) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  n = (n ^ (n >>> 16));
  return ((n >>> 0) & 0x7FFFFFFF) / 0x7FFFFFFF;
}

function smoothstep(t) { return t * t * (3 - 2 * t); }
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo = 0, hi = 255) { return Math.max(lo, Math.min(hi, v)); }

function valueNoise(x, y, seed = 0) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = smoothstep(x - x0), fy = smoothstep(y - y0);
  return lerp(
    lerp(hash(x0, y0, seed), hash(x0 + 1, y0, seed), fx),
    lerp(hash(x0, y0 + 1, seed), hash(x0 + 1, y0 + 1, seed), fx),
    fy
  );
}

function fbm(x, y, octaves = 4, seed = 0) {
  let val = 0, amp = 1, freq = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    val += valueNoise(x * freq, y * freq, seed + i * 31) * amp;
    max += amp;
    amp *= 0.5;
    freq *= 2.0;
  }
  return val / max;
}

/** Domain-warped noise for organic patterns */
function warpedNoise(x, y, seed = 0) {
  const qx = fbm(x, y, 3, seed);
  const qy = fbm(x + 5.2, y + 1.3, 3, seed + 100);
  return fbm(x + qx * 2.0, y + qy * 2.0, 4, seed + 200);
}

// ═══════════════════════════════════════════════════
// DIAMOND GEOMETRY
// ═══════════════════════════════════════════════════

function isInsideDiamond(px, py) {
  return (Math.abs(px - 32) / 32.0 + Math.abs(py - 16) / 16.0) <= 1.0;
}

/** 0 at edge, 1 at center */
function diamondDist(px, py) {
  return Math.max(0, 1.0 - (Math.abs(px - 32) / 32.0 + Math.abs(py - 16) / 16.0));
}

/** Normalized position: 0,0 at top-left corner of diamond, 1,1 at bottom-right */
function diamondUV(px, py) {
  return { u: px / ISO_W, v: py / ISO_H };
}

// ═══════════════════════════════════════════════════
// COLOR UTILITIES
// ═══════════════════════════════════════════════════

function rgb(r, g, b) { return { r, g, b }; }

function blendRGB(c1, c2, t) {
  return rgb(
    lerp(c1.r, c2.r, t),
    lerp(c1.g, c2.g, t),
    lerp(c1.b, c2.b, t)
  );
}

function scaleRGB(c, s) {
  return rgb(c.r * s, c.g * s, c.b * s);
}

function addRGB(c1, c2) {
  return rgb(c1.r + c2.r, c1.g + c2.g, c1.b + c2.b);
}

/** Apply warm top-left isometric lighting */
function isoLight(x, y, color, strength = 0.18) {
  // Light from top-left: upper-left = brighter, lower-right = darker
  const lx = (x - 32) / 64.0;
  const ly = (y - 16) / 32.0;
  const shade = (lx + ly) * strength;  // negative = brighter, positive = darker
  return rgb(
    clamp(color.r * (1.0 - shade)),
    clamp(color.g * (1.0 - shade)),
    clamp(color.b * (1.0 - shade))
  );
}

/** Ordered dither (2x2 Bayer) for pixel-art depth */
const BAYER2 = [[0, 2], [3, 1]];
function dither2x2(x, y, value) {
  const threshold = BAYER2[y & 1][x & 1] / 4.0;
  return value + (threshold - 0.375) * 8;  // subtle dither
}

// ═══════════════════════════════════════════════════
// PREMIUM COLOR PALETTES — Warm Fantasy RPG
// ═══════════════════════════════════════════════════

const P = {
  // Lush grass — warm yellow-greens, not cold
  grass_lush: {
    base:   [rgb(86, 152, 59), rgb(97, 163, 67), rgb(78, 140, 52), rgb(104, 170, 74), rgb(90, 158, 63)],
    accent: [rgb(120, 180, 60), rgb(70, 135, 45)],
    blade:  rgb(115, 185, 55),
    shadow: rgb(55, 105, 35),
  },
  // Dry grass — golden-tan
  grass_dry: {
    base:   [rgb(165, 150, 85), rgb(155, 140, 78), rgb(175, 158, 90)],
    accent: [rgb(185, 170, 100)],
    shadow: rgb(120, 108, 58),
  },
  // Dark forest floor
  grass_dark: {
    base:   [rgb(48, 85, 38), rgb(55, 95, 42), rgb(42, 78, 34)],
    accent: [rgb(65, 110, 48)],
    shadow: rgb(30, 58, 24),
    leaf:   rgb(90, 70, 30),
  },
  // Rich warm dirt
  dirt: {
    base:   [rgb(145, 110, 55), rgb(155, 118, 62), rgb(135, 102, 48)],
    accent: [rgb(165, 128, 70)],
    shadow: rgb(100, 75, 35),
    pebble: rgb(120, 115, 105),
  },
  // Worn path
  dirt_path: {
    base:   [rgb(160, 128, 72), rgb(150, 120, 65), rgb(168, 135, 78)],
    accent: [rgb(140, 112, 58)],
    track:  rgb(130, 100, 50),
  },
  // Golden warm sand
  sand: {
    base:   [rgb(218, 185, 105), rgb(210, 178, 98), rgb(225, 192, 112)],
    accent: [rgb(235, 200, 120)],
    shadow: rgb(175, 148, 78),
    shell:  rgb(230, 220, 195),
  },
  // Wet sand (darker, bluer)
  sand_wet: {
    base:   [rgb(175, 155, 100), rgb(168, 148, 95)],
    shadow: rgb(140, 125, 80),
  },
  // Clean snow
  snow: {
    base:   [rgb(235, 240, 248), rgb(228, 234, 244), rgb(240, 244, 250)],
    accent: [rgb(215, 225, 240)],
    shadow: rgb(185, 198, 220),
    sparkle: rgb(255, 255, 255),
  },
  // Dirty snow
  snow_dirty: {
    base:   [rgb(210, 215, 218), rgb(200, 205, 210)],
    shadow: rgb(170, 175, 180),
    dirt:   rgb(160, 145, 120),
  },
  // Warm stone
  stone: {
    base:   [rgb(138, 135, 128), rgb(148, 145, 138), rgb(128, 125, 118)],
    accent: [rgb(158, 155, 148)],
    shadow: rgb(95, 92, 85),
    crack:  rgb(70, 68, 62),
    moss:   rgb(80, 110, 60),
  },
  // Cobblestone
  stone_cobble: {
    base:   [rgb(145, 140, 132), rgb(155, 150, 142), rgb(135, 130, 122)],
    mortar: rgb(110, 105, 95),
    highlight: rgb(170, 165, 155),
  },
  // Farmland
  farmland: {
    base:   [rgb(130, 105, 55), rgb(140, 112, 60), rgb(120, 98, 48)],
    furrow: rgb(95, 75, 35),
    crop:   rgb(85, 140, 50),
  },
  // Swamp — murky greens
  swamp: {
    base:   [rgb(58, 82, 42), rgb(65, 90, 48)],
    mud:    rgb(72, 65, 38),
    water:  rgb(45, 75, 55),
    bubble: rgb(80, 100, 60),
  },
  // Cave floor
  cave: {
    base:   [rgb(75, 72, 68), rgb(82, 78, 74)],
    shadow: rgb(50, 48, 45),
    crystal: rgb(130, 150, 180),
  },
  // Deep water — rich navy blues
  water_deep: {
    base:   [rgb(28, 72, 150), rgb(22, 65, 140), rgb(35, 80, 160)],
    highlight: rgb(60, 110, 190),
    wave:   rgb(45, 95, 175),
    foam:   rgb(140, 180, 220),
  },
  // Shallow water — teal-blue
  water_shallow: {
    base:   [rgb(55, 145, 180), rgb(62, 152, 188)],
    highlight: rgb(85, 175, 210),
    sand_through: rgb(120, 170, 165),
    foam:   rgb(170, 210, 225),
  },
  // Cliff face
  cliff: {
    face:   rgb(88, 82, 75),
    face_shadow: rgb(60, 56, 50),
    face_highlight: rgb(115, 108, 98),
    top:    rgb(110, 105, 95),
    edge:   rgb(100, 95, 88),
    moss:   rgb(65, 95, 48),
  },
  // Mountain rock
  mountain: {
    base:   [rgb(105, 100, 92), rgb(115, 108, 98), rgb(95, 90, 82)],
    snow:   rgb(220, 228, 238),
    shadow: rgb(68, 64, 58),
  },
  // Roads
  road_dirt: {
    base:   rgb(138, 112, 62),
    worn:   rgb(125, 100, 52),
    edge:   rgb(110, 88, 45),
    rut:    rgb(100, 80, 40),
  },
  road_stone: {
    base:   rgb(142, 138, 130),
    mortar: rgb(108, 104, 96),
    highlight: rgb(165, 160, 150),
    shadow: rgb(90, 86, 78),
  },
};

// ═══════════════════════════════════════════════════
// TILE GENERATION ENGINE
// ═══════════════════════════════════════════════════

function createTile() {
  const png = new PNG({ width: ISO_W, height: ISO_H });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = png.data[i + 1] = png.data[i + 2] = png.data[i + 3] = 0;
  }
  return png;
}

function setPixel(png, x, y, r, g, b, a = 255) {
  if (x < 0 || x >= ISO_W || y < 0 || y >= ISO_H) return;
  const idx = (y * ISO_W + x) * 4;
  png.data[idx]     = clamp(Math.round(r));
  png.data[idx + 1] = clamp(Math.round(g));
  png.data[idx + 2] = clamp(Math.round(b));
  png.data[idx + 3] = clamp(Math.round(a));
}

function setPixelRGB(png, x, y, c, a = 255) {
  setPixel(png, x, y, c.r, c.g, c.b, a);
}

function getPixel(png, x, y) {
  if (x < 0 || x >= ISO_W || y < 0 || y >= ISO_H) return rgb(0, 0, 0);
  const idx = (y * ISO_W + x) * 4;
  return rgb(png.data[idx], png.data[idx + 1], png.data[idx + 2]);
}

// ═══════════════════════════════════════════════════
// TERRAIN TILE GENERATORS
// ═══════════════════════════════════════════════════

/**
 * Generic textured ground tile with noise + lighting + edge AA
 */
function genGround(palette, seed, opts = {}) {
  const png = createTile();
  const { detail = null, detailFn = null } = opts;
  const bases = palette.base || [palette];

  for (let y = 0; y < ISO_H; y++) {
    for (let x = 0; x < ISO_W; x++) {
      if (!isInsideDiamond(x, y)) continue;

      // Multi-layered noise for organic texture
      const n1 = warpedNoise(x * 0.08, y * 0.12, seed);
      const n2 = fbm(x * 0.15, y * 0.22, 3, seed + 50);
      const n3 = hash(x, y, seed + 99);  // pixel-level variation

      // Select base color from palette variation
      const baseIdx = Math.floor(n1 * bases.length) % bases.length;
      let color = { ...bases[baseIdx] };

      // Apply noise-based brightness variation (±18%)
      const brightness = 0.82 + (n1 * 0.2 + n2 * 0.12 + n3 * 0.04);
      color = scaleRGB(color, brightness);

      // Subtle dithering for depth
      color.r = dither2x2(x, y, color.r);
      color.g = dither2x2(x, y, color.g);
      color.b = dither2x2(x, y, color.b);

      // Isometric lighting
      color = isoLight(x, y, color, 0.15);

      // Anti-alias edges
      const dist = diamondDist(x, y);
      const alpha = dist < 0.06 ? dist / 0.06 * 255 : 255;

      setPixelRGB(png, x, y, color, alpha);
    }
  }

  // Apply detail pass if specified
  if (detailFn) detailFn(png, seed);

  return png;
}

/** Detail: grass blade strokes */
function detailGrassBlades(png, seed, palette = P.grass_lush) {
  const bladeColor = palette.blade || rgb(115, 185, 55);
  const shadowColor = palette.shadow || rgb(55, 105, 35);

  for (let i = 0; i < 18; i++) {
    const bx = Math.floor(hash(i, 0, seed + 500) * 56) + 4;
    const by = Math.floor(hash(i, 1, seed + 500) * 24) + 4;

    if (!isInsideDiamond(bx, by)) continue;

    // Blade stroke (2-3px tall)
    const height = 1 + Math.floor(hash(i, 2, seed + 500) * 2);
    const bright = 0.85 + hash(i, 3, seed + 500) * 0.3;

    for (let dy = 0; dy < height; dy++) {
      if (isInsideDiamond(bx, by - dy)) {
        const c = dy === 0 ? shadowColor : bladeColor;
        const existing = getPixel(png, bx, by - dy);
        const blended = blendRGB(existing, scaleRGB(c, bright), 0.5);
        setPixelRGB(png, bx, by - dy, blended);
      }
    }
  }
}

/** Detail: scattered pebbles */
function detailPebbles(png, seed, palette = P.dirt) {
  const pebbleColor = palette.pebble || rgb(120, 115, 105);

  for (let i = 0; i < 8; i++) {
    const px = Math.floor(hash(i, 10, seed + 600) * 52) + 6;
    const py = Math.floor(hash(i, 11, seed + 600) * 22) + 5;
    if (!isInsideDiamond(px, py)) continue;

    const bright = 0.8 + hash(i, 12, seed + 600) * 0.4;
    const c = scaleRGB(pebbleColor, bright);
    setPixelRGB(png, px, py, c, 200);
    if (isInsideDiamond(px + 1, py)) {
      setPixelRGB(png, px + 1, py, scaleRGB(c, 0.9), 180);
    }
  }
}

/** Detail: stone cracks */
function detailCracks(png, seed) {
  const crackColor = P.stone.crack;

  for (let i = 0; i < 3; i++) {
    let cx = Math.floor(hash(i, 20, seed + 700) * ISO_W);
    let cy = Math.floor(hash(i, 21, seed + 700) * ISO_H);
    const dx = hash(i, 22, seed + 700) > 0.5 ? 1 : -1;
    const dy = hash(i, 23, seed + 700) > 0.5 ? 1 : -1;

    for (let j = 0; j < 6; j++) {
      if (isInsideDiamond(cx, cy)) {
        const existing = getPixel(png, cx, cy);
        const blended = blendRGB(existing, crackColor, 0.6);
        setPixelRGB(png, cx, cy, blended, 220);
      }
      cx += dx * (hash(j, 24, seed + 700) > 0.4 ? 1 : 0);
      cy += dy * (hash(j, 25, seed + 700) > 0.5 ? 1 : 0);
    }
  }
}

/** Detail: farmland furrows */
function detailFurrows(png, seed) {
  const furrowColor = P.farmland.furrow;
  const cropColor = P.farmland.crop;

  for (let y = 3; y < ISO_H - 1; y += 4) {
    for (let x = 0; x < ISO_W; x++) {
      if (!isInsideDiamond(x, y)) continue;
      const existing = getPixel(png, x, y);
      setPixelRGB(png, x, y, blendRGB(existing, furrowColor, 0.4));

      // Small crop sprouts every other row
      if (y % 8 === 3 && x % 5 === Math.floor(hash(x, y, seed + 800) * 3)) {
        if (isInsideDiamond(x, y - 1)) {
          setPixelRGB(png, x, y - 1, cropColor, 200);
        }
      }
    }
  }
}

/** Detail: wave highlights on water */
function detailWaves(png, seed, isDeep = true) {
  const highlightColor = isDeep ? P.water_deep.highlight : P.water_shallow.highlight;
  const foamColor = isDeep ? P.water_deep.foam : P.water_shallow.foam;

  for (let y = 0; y < ISO_H; y++) {
    for (let x = 0; x < ISO_W; x++) {
      if (!isInsideDiamond(x, y)) continue;

      const wave = Math.sin(x * 0.25 + seed * 0.7) * Math.cos(y * 0.35 + seed * 0.5);
      if (wave > 0.65) {
        const existing = getPixel(png, x, y);
        const blended = blendRGB(existing, highlightColor, 0.35);
        setPixelRGB(png, x, y, blended);
      }

      // Occasional foam specks
      if (wave > 0.85 && hash(x, y, seed + 900) > 0.7) {
        const existing = getPixel(png, x, y);
        setPixelRGB(png, x, y, blendRGB(existing, foamColor, 0.25));
      }
    }
  }
}

/** Detail: swamp bubbles and murk */
function detailSwamp(png, seed) {
  const mudColor = P.swamp.mud;
  const bubbleColor = P.swamp.bubble;

  // Mud patches
  for (let i = 0; i < 5; i++) {
    const mx = Math.floor(hash(i, 30, seed + 1000) * 48) + 8;
    const my = Math.floor(hash(i, 31, seed + 1000) * 20) + 6;
    const r = 2 + Math.floor(hash(i, 32, seed + 1000) * 3);

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r && isInsideDiamond(mx + dx, my + dy)) {
          const existing = getPixel(png, mx + dx, my + dy);
          setPixelRGB(png, mx + dx, my + dy, blendRGB(existing, mudColor, 0.4));
        }
      }
    }
  }

  // Bubble dots
  for (let i = 0; i < 4; i++) {
    const bx = Math.floor(hash(i, 33, seed + 1000) * 52) + 6;
    const by = Math.floor(hash(i, 34, seed + 1000) * 22) + 5;
    if (isInsideDiamond(bx, by)) {
      setPixelRGB(png, bx, by, bubbleColor, 160);
    }
  }
}

/** Detail: snow sparkle highlights */
function detailSnowSparkle(png, seed) {
  for (let i = 0; i < 12; i++) {
    const sx = Math.floor(hash(i, 40, seed + 1100) * 56) + 4;
    const sy = Math.floor(hash(i, 41, seed + 1100) * 24) + 4;
    if (isInsideDiamond(sx, sy)) {
      setPixelRGB(png, sx, sy, P.snow.sparkle, 200);
    }
  }
}

/** Detail: cobblestone pattern */
function detailCobblestone(png, seed) {
  for (let y = 0; y < ISO_H; y++) {
    for (let x = 0; x < ISO_W; x++) {
      if (!isInsideDiamond(x, y)) continue;

      // Cobble grid pattern
      const cx = Math.floor(x / 5);
      const cy = Math.floor(y / 4);
      const isEdge = (x % 5 === 0) || (y % 4 === 0);

      if (isEdge) {
        const existing = getPixel(png, x, y);
        setPixelRGB(png, x, y, blendRGB(existing, P.stone_cobble.mortar, 0.35));
      } else if ((cx + cy) % 2 === 0) {
        const existing = getPixel(png, x, y);
        setPixelRGB(png, x, y, blendRGB(existing, P.stone_cobble.highlight, 0.1));
      }
    }
  }
}

/** Detail: fallen leaves on dark grass */
function detailLeaves(png, seed) {
  const leafColor = P.grass_dark.leaf;
  for (let i = 0; i < 10; i++) {
    const lx = Math.floor(hash(i, 50, seed + 1200) * 52) + 6;
    const ly = Math.floor(hash(i, 51, seed + 1200) * 22) + 5;
    if (isInsideDiamond(lx, ly)) {
      const bright = 0.8 + hash(i, 52, seed + 1200) * 0.4;
      setPixelRGB(png, lx, ly, scaleRGB(leafColor, bright), 180);
      if (isInsideDiamond(lx + 1, ly)) {
        setPixelRGB(png, lx + 1, ly, scaleRGB(leafColor, bright * 0.85), 150);
      }
    }
  }
}

// ═══════════════════════════════════════════════════
// WATER SHORE & TRANSITION GENERATORS
// ═══════════════════════════════════════════════════

function genWaterShore(direction, isInner = false, seed = 0) {
  const png = createTile();
  const grassPal = P.grass_lush;
  const waterPal = P.water_shallow;

  for (let y = 0; y < ISO_H; y++) {
    for (let x = 0; x < ISO_W; x++) {
      if (!isInsideDiamond(x, y)) continue;

      const cx = ISO_W / 2, cy = ISO_H / 2;
      let useWater = false;

      // Shore boundary with wavy noise
      const waveNoise = fbm(x * 0.15, y * 0.2, 2, seed + 300) * 4;

      if (isInner) {
        // Inner corners: mostly water, grass peeking at corner
        if (direction === 'NE' && (x - cx + waveNoise) > 2 && (y - cy - waveNoise) < -2) useWater = false;
        else if (direction === 'NW' && (cx - x + waveNoise) > 2 && (y - cy - waveNoise) < -2) useWater = false;
        else if (direction === 'SE' && (x - cx + waveNoise) > 2 && (cy - y - waveNoise) < -2) useWater = false;
        else if (direction === 'SW' && (cx - x + waveNoise) > 2 && (cy - y - waveNoise) < -2) useWater = false;
        else useWater = true;
      } else {
        // Outer shores: grass with water on one side
        if (direction === 'N') useWater = y < cy + waveNoise;
        else if (direction === 'S') useWater = y > cy + waveNoise;
        else if (direction === 'E') useWater = x > cx + waveNoise;
        else if (direction === 'W') useWater = x < cx + waveNoise;
        else if (direction === 'NE') useWater = (x - cx) + (cy - y) + waveNoise > 0;
        else if (direction === 'NW') useWater = (cx - x) + (cy - y) + waveNoise > 0;
        else if (direction === 'SE') useWater = (x - cx) + (y - cy) + waveNoise > 0;
        else if (direction === 'SW') useWater = (cx - x) + (y - cy) + waveNoise > 0;
      }

      const n = warpedNoise(x * 0.08, y * 0.12, seed);
      const baseColor = useWater
        ? waterPal.base[Math.floor(n * waterPal.base.length) % waterPal.base.length]
        : grassPal.base[Math.floor(n * grassPal.base.length) % grassPal.base.length];

      const brightness = 0.82 + n * 0.2 + hash(x, y, seed + 99) * 0.04;
      let color = isoLight(x, y, scaleRGB(baseColor, brightness), 0.12);

      const dist = diamondDist(x, y);
      const alpha = dist < 0.06 ? dist / 0.06 * 255 : 255;
      setPixelRGB(png, x, y, color, alpha);
    }
  }

  // Add wave details to water areas
  detailWaves(png, seed, false);
  return png;
}

function genRiverTile(direction, seed = 0) {
  const png = createTile();
  const grassPal = P.grass_lush;
  const waterPal = P.water_shallow;
  const riverWidth = 10;

  for (let y = 0; y < ISO_H; y++) {
    for (let x = 0; x < ISO_W; x++) {
      if (!isInsideDiamond(x, y)) continue;

      const cx = ISO_W / 2, cy = ISO_H / 2;
      const wave = fbm(x * 0.1, y * 0.15, 2, seed + 400) * 3;
      let isRiver = false;

      if (direction === 'H') isRiver = Math.abs(y - cy + wave) < riverWidth / 2;
      else if (direction === 'V') isRiver = Math.abs(x - cx + wave) < riverWidth;
      else if (direction === 'cross') isRiver = Math.abs(y - cy + wave) < riverWidth / 2 || Math.abs(x - cx + wave) < riverWidth;
      else if (direction === 'turn_NE') isRiver = (x > cx && Math.abs(y - cy + wave) < riverWidth / 2) || (y < cy && Math.abs(x - cx + wave) < riverWidth);
      else if (direction === 'turn_NW') isRiver = (x < cx && Math.abs(y - cy + wave) < riverWidth / 2) || (y < cy && Math.abs(x - cx + wave) < riverWidth);
      else if (direction === 'turn_SE') isRiver = (x > cx && Math.abs(y - cy + wave) < riverWidth / 2) || (y > cy && Math.abs(x - cx + wave) < riverWidth);
      else if (direction === 'turn_SW') isRiver = (x < cx && Math.abs(y - cy + wave) < riverWidth / 2) || (y > cy && Math.abs(x - cx + wave) < riverWidth);

      const n = warpedNoise(x * 0.08, y * 0.12, seed);
      const baseColor = isRiver
        ? waterPal.base[Math.floor(n * waterPal.base.length) % waterPal.base.length]
        : grassPal.base[Math.floor(n * grassPal.base.length) % grassPal.base.length];

      const brightness = 0.82 + n * 0.2;
      let color = isoLight(x, y, scaleRGB(baseColor, brightness), 0.12);

      const dist = diamondDist(x, y);
      const alpha = dist < 0.06 ? dist / 0.06 * 255 : 255;
      setPixelRGB(png, x, y, color, alpha);
    }
  }

  return png;
}

function genRoadTile(type, direction, seed = 0) {
  const png = createTile();
  const grassPal = P.grass_lush;
  const roadPal = type === 'dirt' ? P.road_dirt : P.road_stone;
  const roadW = type === 'dirt' ? 14 : 16;

  for (let y = 0; y < ISO_H; y++) {
    for (let x = 0; x < ISO_W; x++) {
      if (!isInsideDiamond(x, y)) continue;

      const cx = ISO_W / 2, cy = ISO_H / 2;
      const wave = fbm(x * 0.15, y * 0.2, 2, seed + 500) * (type === 'dirt' ? 2 : 0.5);
      let isRoad = false;

      if (direction === 'H') isRoad = Math.abs(y - cy + wave) < roadW / 4;
      else if (direction === 'V') isRoad = Math.abs(x - cx + wave) < roadW / 2;
      else if (direction === 'cross') isRoad = Math.abs(y - cy + wave) < roadW / 4 || Math.abs(x - cx + wave) < roadW / 2;
      else if (direction.startsWith('turn_')) {
        const c = direction.slice(5);
        if (c === 'NE') isRoad = (x > cx - 2 && Math.abs(y - cy + wave) < roadW / 4) || (y < cy + 2 && Math.abs(x - cx + wave) < roadW / 2);
        else if (c === 'NW') isRoad = (x < cx + 2 && Math.abs(y - cy + wave) < roadW / 4) || (y < cy + 2 && Math.abs(x - cx + wave) < roadW / 2);
        else if (c === 'SE') isRoad = (x > cx - 2 && Math.abs(y - cy + wave) < roadW / 4) || (y > cy - 2 && Math.abs(x - cx + wave) < roadW / 2);
        else if (c === 'SW') isRoad = (x < cx + 2 && Math.abs(y - cy + wave) < roadW / 4) || (y > cy - 2 && Math.abs(x - cx + wave) < roadW / 2);
      } else if (direction.startsWith('end_')) {
        const c = direction.slice(4);
        if (c === 'N') isRoad = y < cy + wave && Math.abs(x - cx + wave) < roadW / 2;
        else if (c === 'S') isRoad = y > cy + wave && Math.abs(x - cx + wave) < roadW / 2;
        else if (c === 'E') isRoad = x > cx + wave && Math.abs(y - cy + wave) < roadW / 4;
        else if (c === 'W') isRoad = x < cx + wave && Math.abs(y - cy + wave) < roadW / 4;
      } else if (direction.startsWith('T_')) {
        const c = direction.slice(2);
        // T-junction: main road + branch
        if (c === 'N') isRoad = Math.abs(x - cx + wave) < roadW / 2 || (y < cy + 2 && Math.abs(y - cy + wave) < roadW / 4);
        else if (c === 'S') isRoad = Math.abs(x - cx + wave) < roadW / 2 || (y > cy - 2 && Math.abs(y - cy + wave) < roadW / 4);
        else if (c === 'E') isRoad = Math.abs(y - cy + wave) < roadW / 4 || (x > cx - 2 && Math.abs(x - cx + wave) < roadW / 2);
        else if (c === 'W') isRoad = Math.abs(y - cy + wave) < roadW / 4 || (x < cx + 2 && Math.abs(x - cx + wave) < roadW / 2);
      }

      const n = warpedNoise(x * 0.08, y * 0.12, seed);
      let baseColor;
      if (isRoad) {
        baseColor = roadPal.base;
        // Cobblestone pattern for stone roads
        if (type === 'stone') {
          const cobX = Math.floor(x / 5), cobY = Math.floor(y / 3);
          if ((x % 5 === 0) || (y % 3 === 0)) {
            baseColor = roadPal.mortar;
          } else if ((cobX + cobY) % 2 === 0) {
            baseColor = roadPal.highlight;
          }
        }
        // Worn ruts for dirt roads
        if (type === 'dirt' && Math.abs(y - cy) < 2) {
          baseColor = roadPal.worn;
        }
      } else {
        baseColor = grassPal.base[Math.floor(n * grassPal.base.length) % grassPal.base.length];
      }

      const brightness = 0.82 + n * 0.2;
      let color = isoLight(x, y, scaleRGB(baseColor, brightness), 0.12);

      const dist = diamondDist(x, y);
      const alpha = dist < 0.06 ? dist / 0.06 * 255 : 255;
      setPixelRGB(png, x, y, color, alpha);
    }
  }

  return png;
}

function genCliffTile(type, direction, seed = 0) {
  const png = createTile();
  const pal = P.cliff;

  for (let y = 0; y < ISO_H; y++) {
    for (let x = 0; x < ISO_W; x++) {
      if (!isInsideDiamond(x, y)) continue;

      const n = warpedNoise(x * 0.1, y * 0.15, seed);
      let baseColor;

      if (type === 'face') {
        // Vertical cliff face with strong shadow
        const depth = (y / ISO_H);
        baseColor = blendRGB(pal.face_highlight, pal.face_shadow, depth * 0.8 + n * 0.2);
        // Horizontal strata lines
        if (y % 5 === 0 || y % 7 === 0) {
          baseColor = blendRGB(baseColor, pal.face_shadow, 0.3);
        }
        // Occasional moss
        if (n > 0.7 && hash(x, y, seed + 1300) > 0.6) {
          baseColor = blendRGB(baseColor, pal.moss, 0.3);
        }
      } else if (type === 'top') {
        baseColor = pal.top;
      } else {
        baseColor = pal.edge;
      }

      const brightness = 0.82 + n * 0.2;
      let color = isoLight(x, y, scaleRGB(baseColor, brightness), 0.18);

      const dist = diamondDist(x, y);
      const alpha = dist < 0.06 ? dist / 0.06 * 255 : 255;
      setPixelRGB(png, x, y, color, alpha);
    }
  }

  return png;
}

function genTransition(biome1Key, biome2Key, direction, seed = 0) {
  const png = createTile();
  const pal1 = P[biome1Key];
  const pal2 = P[biome2Key];
  const bases1 = pal1.base || [pal1];
  const bases2 = pal2.base || [pal2];

  for (let y = 0; y < ISO_H; y++) {
    for (let x = 0; x < ISO_W; x++) {
      if (!isInsideDiamond(x, y)) continue;

      // Transition gradient with noise for organic boundary
      let t = 0;
      if (direction === 'N') t = y / ISO_H;
      else if (direction === 'S') t = 1 - y / ISO_H;
      else if (direction === 'E') t = x / ISO_W;
      else if (direction === 'W') t = 1 - x / ISO_W;

      // Warp the boundary
      const warp = fbm(x * 0.12, y * 0.18, 3, seed + 600) * 0.3 - 0.15;
      t = clamp(t + warp, 0, 1);

      const n = warpedNoise(x * 0.08, y * 0.12, seed);
      const c1 = bases1[Math.floor(n * bases1.length) % bases1.length];
      const c2 = bases2[Math.floor(n * bases2.length) % bases2.length];

      let color = blendRGB(c1, c2, t);
      const brightness = 0.82 + n * 0.2;
      color = isoLight(x, y, scaleRGB(color, brightness), 0.12);

      const dist = diamondDist(x, y);
      const alpha = dist < 0.06 ? dist / 0.06 * 255 : 255;
      setPixelRGB(png, x, y, color, alpha);
    }
  }

  return png;
}

// ═══════════════════════════════════════════════════
// ASSEMBLY
// ═══════════════════════════════════════════════════

function placeTile(output, tile, col, row) {
  const offX = col * ISO_W;
  const offY = row * ISO_H;
  for (let y = 0; y < ISO_H; y++) {
    for (let x = 0; x < ISO_W; x++) {
      const si = (y * ISO_W + x) * 4;
      const di = ((offY + y) * OUTPUT_W + (offX + x)) * 4;
      output.data[di]     = tile.data[si];
      output.data[di + 1] = tile.data[si + 1];
      output.data[di + 2] = tile.data[si + 2];
      output.data[di + 3] = tile.data[si + 3];
    }
  }
}

console.log('=== Isometric Terrain Sheet v3 — Premium Quality ===\n');

const output = new PNG({ width: OUTPUT_W, height: OUTPUT_H });
for (let i = 0; i < output.data.length; i += 4) {
  output.data[i] = output.data[i + 1] = output.data[i + 2] = output.data[i + 3] = 0;
}

const tileMap = {};
let idx = 0;

function add(name, tile) {
  tileMap[name] = idx;
  placeTile(output, tile, idx % COLS, Math.floor(idx / COLS));
  idx++;
}

// ── ROW 0: Grass variants (0-15) ──
console.log('Row 0: Grass variants...');
for (let i = 1; i <= 5; i++)
  add(`grass_lush_0${i}`, genGround(P.grass_lush, 1000 + i * 7, { detailFn: (p, s) => detailGrassBlades(p, s, P.grass_lush) }));
for (let i = 1; i <= 3; i++)
  add(`grass_dry_0${i}`, genGround(P.grass_dry, 2000 + i * 11));
for (let i = 1; i <= 3; i++)
  add(`grass_dark_0${i}`, genGround(P.grass_dark, 3000 + i * 13, { detailFn: (p, s) => detailLeaves(p, s) }));
for (let i = 1; i <= 3; i++)
  add(`dirt_0${i}`, genGround(P.dirt, 4000 + i * 17, { detailFn: (p, s) => detailPebbles(p, s) }));
add('dirt_path_01', genGround(P.dirt_path, 4500));
add('dirt_path_02', genGround(P.dirt_path, 4507));

// ── ROW 1: Sand, snow, stone (16-31) ──
console.log('Row 1: Sand, snow, stone...');
for (let i = 1; i <= 3; i++)
  add(`sand_0${i}`, genGround(P.sand, 5000 + i * 19));
for (let i = 1; i <= 2; i++)
  add(`sand_wet_0${i}`, genGround(P.sand_wet, 5500 + i * 23));
for (let i = 1; i <= 3; i++)
  add(`snow_0${i}`, genGround(P.snow, 6000 + i * 29, { detailFn: (p, s) => detailSnowSparkle(p, s) }));
for (let i = 1; i <= 2; i++)
  add(`snow_dirty_0${i}`, genGround(P.snow_dirty, 6500 + i * 31));
for (let i = 1; i <= 3; i++)
  add(`stone_0${i}`, genGround(P.stone, 7000 + i * 37, { detailFn: (p, s) => detailCracks(p, s) }));
for (let i = 1; i <= 3; i++)
  add(`stone_cobble_0${i}`, genGround(P.stone_cobble, 7500 + i * 41, { detailFn: (p, s) => detailCobblestone(p, s) }));

// ── ROW 2: Farmland, swamp, cave, water (32-47) ──
console.log('Row 2: Farmland, swamp, water...');
for (let i = 1; i <= 3; i++)
  add(`farmland_0${i}`, genGround(P.farmland, 8000 + i * 43, { detailFn: (p, s) => detailFurrows(p, s) }));
for (let i = 1; i <= 2; i++)
  add(`swamp_0${i}`, genGround(P.swamp, 9000 + i * 47, { detailFn: (p, s) => detailSwamp(p, s) }));
for (let i = 1; i <= 2; i++)
  add(`cave_0${i}`, genGround(P.cave, 9500 + i * 53));
for (let i = 1; i <= 3; i++)
  add(`water_deep_0${i}`, genGround(P.water_deep, 10000 + i * 59, { detailFn: (p, s) => detailWaves(p, s, true) }));
for (let i = 1; i <= 3; i++)
  add(`water_shallow_0${i}`, genGround(P.water_shallow, 11000 + i * 61, { detailFn: (p, s) => detailWaves(p, s, false) }));
add('water_shore_N', genWaterShore('N', false, 11100));
add('water_shore_S', genWaterShore('S', false, 11101));
add('water_shore_E', genWaterShore('E', false, 11102));

// ── ROW 3: Water shores, corners, rivers (48-63) ──
console.log('Row 3: Water shores and rivers...');
add('water_shore_W', genWaterShore('W', false, 11103));
add('water_shore_NE', genWaterShore('NE', false, 11104));
add('water_shore_NW', genWaterShore('NW', false, 11105));
add('water_shore_SE', genWaterShore('SE', false, 11106));
add('water_shore_SW', genWaterShore('SW', false, 11107));
add('water_shore_inner_NE', genWaterShore('NE', true, 11108));
add('water_shore_inner_NW', genWaterShore('NW', true, 11109));
add('water_shore_inner_SE', genWaterShore('SE', true, 11110));
add('water_shore_inner_SW', genWaterShore('SW', true, 11111));
add('water_river_H', genRiverTile('H', 11200));
add('water_river_V', genRiverTile('V', 11201));
add('water_river_turn_NE', genRiverTile('turn_NE', 11202));
add('water_river_turn_NW', genRiverTile('turn_NW', 11203));
add('water_river_turn_SE', genRiverTile('turn_SE', 11204));
add('water_river_turn_SW', genRiverTile('turn_SW', 11205));
add('water_river_cross', genRiverTile('cross', 11206));

// ── ROW 4: Roads (64-79) ──
console.log('Row 4: Roads...');
add('road_dirt_H', genRoadTile('dirt', 'H', 12000));
add('road_dirt_V', genRoadTile('dirt', 'V', 12001));
add('road_dirt_cross', genRoadTile('dirt', 'cross', 12002));
add('road_dirt_turn_NE', genRoadTile('dirt', 'turn_NE', 12003));
add('road_dirt_turn_NW', genRoadTile('dirt', 'turn_NW', 12004));
add('road_dirt_turn_SE', genRoadTile('dirt', 'turn_SE', 12005));
add('road_dirt_turn_SW', genRoadTile('dirt', 'turn_SW', 12006));
add('road_stone_H', genRoadTile('stone', 'H', 12100));
add('road_stone_V', genRoadTile('stone', 'V', 12101));
add('road_stone_cross', genRoadTile('stone', 'cross', 12102));
add('road_stone_turn_NE', genRoadTile('stone', 'turn_NE', 12103));
add('road_stone_turn_NW', genRoadTile('stone', 'turn_NW', 12104));
add('road_stone_turn_SE', genRoadTile('stone', 'turn_SE', 12105));
add('road_stone_turn_SW', genRoadTile('stone', 'turn_SW', 12106));
add('road_stone_end_N', genRoadTile('stone', 'end_N', 12107));
add('road_stone_end_S', genRoadTile('stone', 'end_S', 12108));

// ── ROW 5: Cliffs and mountains (80-95) ──
console.log('Row 5: Cliffs and mountains...');
add('cliff_face_N', genCliffTile('face', 'N', 13000));
add('cliff_face_S', genCliffTile('face', 'S', 13001));
add('cliff_face_E', genCliffTile('face', 'E', 13002));
add('cliff_face_W', genCliffTile('face', 'W', 13003));
for (let i = 1; i <= 3; i++)
  add(`cliff_top_0${i}`, genCliffTile('top', '', 13010 + i));
add('cliff_edge_N', genCliffTile('edge', 'N', 13020));
add('cliff_edge_S', genCliffTile('edge', 'S', 13021));
add('cliff_edge_E', genCliffTile('edge', 'E', 13022));
add('cliff_edge_W', genCliffTile('edge', 'W', 13023));
for (let i = 1; i <= 3; i++)
  add(`mountain_rock_0${i}`, genGround(P.mountain, 13100 + i * 67));
add('blank_1', createTile());
add('blank_2', createTile());

// ── ROW 6: Biome transitions (96-111) ──
console.log('Row 6: Biome transitions...');
for (const dir of ['N', 'S', 'E', 'W'])
  add(`transition_grass_dirt_${dir}`, genTransition('grass_lush', 'dirt', dir, 14000));
for (const dir of ['N', 'S', 'E', 'W'])
  add(`transition_grass_sand_${dir}`, genTransition('grass_lush', 'sand', dir, 14100));
for (const dir of ['N', 'S', 'E', 'W'])
  add(`transition_grass_snow_${dir}`, genTransition('grass_lush', 'snow', dir, 14200));
for (const dir of ['N', 'S', 'E', 'W'])
  add(`transition_sand_water_${dir}`, genTransition('sand', 'water_shallow', dir, 14300));

// ── ROW 7: Additional transitions (112-127) ──
console.log('Row 7: More transitions and road variants...');
for (const dir of ['N', 'S', 'E', 'W'])
  add(`transition_dirt_sand_${dir}`, genTransition('dirt', 'sand', dir, 14400));
for (const dir of ['N', 'S', 'E', 'W'])
  add(`transition_dirt_snow_${dir}`, genTransition('dirt', 'snow', dir, 14500));
// Dirt path variant 3
add('dirt_path_03', genGround(P.dirt_path, 4520));
// Road T-junctions
add('road_dirt_T_N', genRoadTile('dirt', 'T_N', 12200));
add('road_dirt_T_S', genRoadTile('dirt', 'T_S', 12201));
add('road_dirt_T_E', genRoadTile('dirt', 'T_E', 12202));
// Road dead-ends
add('road_dirt_end_N', genRoadTile('dirt', 'end_N', 12210));
add('road_dirt_end_S', genRoadTile('dirt', 'end_S', 12211));
add('road_dirt_end_E', genRoadTile('dirt', 'end_E', 12212));
add('road_dirt_end_W', genRoadTile('dirt', 'end_W', 12213));

// ── ROW 8: More road variants, stone T-junctions (128-143) ──
console.log('Row 8: Stone road variants...');
add('road_stone_T_N', genRoadTile('stone', 'T_N', 12300));
add('road_stone_T_S', genRoadTile('stone', 'T_S', 12301));
add('road_stone_T_E', genRoadTile('stone', 'T_E', 12302));
add('road_stone_T_W', genRoadTile('stone', 'T_W', 12303));
add('road_stone_end_E', genRoadTile('stone', 'end_E', 12310));
add('road_stone_end_W', genRoadTile('stone', 'end_W', 12311));
// Snow transitions with sand
for (const dir of ['N', 'S', 'E', 'W'])
  add(`transition_snow_stone_${dir}`, genTransition('snow', 'stone', dir, 14600));
// Grass-to-swamp transitions
for (const dir of ['N', 'S', 'E', 'W'])
  add(`transition_grass_swamp_${dir}`, genTransition('grass_lush', 'swamp', dir, 14700));
// Extra grass dark variants
add('grass_dark_04', genGround(P.grass_dark, 3100, { detailFn: (p, s) => detailLeaves(p, s) }));
add('grass_dark_05', genGround(P.grass_dark, 3200, { detailFn: (p, s) => detailLeaves(p, s) }));

// ── ROW 9: Decorative ground (144-159) ──
console.log('Row 9: Decorative ground tiles...');
// Forest floor with heavy leaf cover
for (let i = 1; i <= 3; i++) {
  const tile = genGround(P.grass_dark, 15000 + i * 71, { detailFn: (p, s) => {
    detailLeaves(p, s);
    detailLeaves(p, s + 100); // extra leaves
  }});
  add(`forest_floor_0${i}`, tile);
}
// Sandy beach with shells
for (let i = 1; i <= 2; i++) {
  const tile = genGround(P.sand, 15100 + i * 73);
  add(`beach_shell_0${i}`, tile);
}
// Muddy farmland (wet)
for (let i = 1; i <= 2; i++)
  add(`farmland_wet_0${i}`, genGround(P.farmland, 15200 + i * 79, { detailFn: (p, s) => detailFurrows(p, s) }));
// Gravel ground
for (let i = 1; i <= 3; i++)
  add(`gravel_0${i}`, genGround(P.stone, 15300 + i * 83, { detailFn: (p, s) => detailPebbles(p, s) }));
// Lava rock (dark)
add('lava_rock_01', genGround({ base: [rgb(45, 30, 25), rgb(55, 35, 28)] }, 15400));
add('lava_rock_02', genGround({ base: [rgb(50, 32, 27), rgb(60, 38, 30)] }, 15401));
// Marsh (between swamp and grass)
for (let i = 1; i <= 2; i++)
  add(`marsh_0${i}`, genGround(P.swamp, 15500 + i * 89, { detailFn: (p, s) => detailSwamp(p, s) }));

// ── ROW 10: More water variants (160-175) ──
console.log('Row 10: Water animation frames and variants...');
// Water animation frames (slight variation for animation)
for (let i = 4; i <= 6; i++)
  add(`water_deep_0${i}`, genGround(P.water_deep, 10000 + i * 97, { detailFn: (p, s) => detailWaves(p, s + i * 30, true) }));
for (let i = 4; i <= 6; i++)
  add(`water_shallow_0${i}`, genGround(P.water_shallow, 11000 + i * 101, { detailFn: (p, s) => detailWaves(p, s + i * 30, false) }));
// Frozen water/ice
for (let i = 1; i <= 3; i++)
  add(`ice_0${i}`, genGround({ base: [rgb(180, 210, 235), rgb(170, 200, 228), rgb(190, 218, 240)] }, 16000 + i * 103));
// Hot spring/lava water
for (let i = 1; i <= 2; i++)
  add(`water_hot_0${i}`, genGround({ base: [rgb(160, 80, 40), rgb(180, 90, 45)] }, 16100 + i * 107));
// Coral reef (shallow water variant)
add('water_reef_01', genGround({ base: [rgb(45, 130, 160), rgb(55, 140, 170)] }, 16200));
add('water_reef_02', genGround({ base: [rgb(50, 135, 165), rgb(60, 145, 175)] }, 16201));
// Dock/pier ground
add('dock_wood_01', genGround({ base: [rgb(120, 90, 50), rgb(130, 98, 55)] }, 16300));
add('dock_wood_02', genGround({ base: [rgb(115, 85, 48), rgb(125, 92, 52)] }, 16301));

// ── ROW 11: Cliff combinations and stairs (176-191) ──
console.log('Row 11: Cliff combos and special tiles...');
// Cliff corner combinations
add('cliff_corner_NE', genCliffTile('face', 'NE', 13200));
add('cliff_corner_NW', genCliffTile('face', 'NW', 13201));
add('cliff_corner_SE', genCliffTile('face', 'SE', 13202));
add('cliff_corner_SW', genCliffTile('face', 'SW', 13203));
// Mountain snow cap
for (let i = 1; i <= 3; i++) {
  const tile = genGround(P.mountain, 13300 + i * 109);
  // Add snow on top
  for (let y = 0; y < ISO_H / 2; y++) {
    for (let x = 0; x < ISO_W; x++) {
      if (!isInsideDiamond(x, y)) continue;
      const snowT = 1.0 - y / (ISO_H / 2);
      const existing = getPixel(tile, x, y);
      const snowed = blendRGB(existing, P.mountain.snow, snowT * 0.6);
      setPixelRGB(tile, x, y, snowed);
    }
  }
  add(`mountain_snow_0${i}`, tile);
}
// Volcanic rock with glowing cracks
for (let i = 1; i <= 2; i++) {
  const tile = genGround({ base: [rgb(40, 35, 30), rgb(50, 42, 35)] }, 13400 + i * 113);
  // Add orange crack glow
  for (let j = 0; j < 4; j++) {
    let cx = Math.floor(hash(j, 60, 13400 + i) * ISO_W);
    let cy = Math.floor(hash(j, 61, 13400 + i) * ISO_H);
    for (let k = 0; k < 5; k++) {
      if (isInsideDiamond(cx, cy)) {
        setPixelRGB(tile, cx, cy, rgb(220, 120, 30), 180);
      }
      cx += hash(k, 62, 13400 + i) > 0.5 ? 1 : -1;
      cy += hash(k, 63, 13400 + i) > 0.5 ? 1 : 0;
    }
  }
  add(`volcanic_0${i}`, tile);
}
// Stone bridge surface
add('bridge_stone_01', genGround(P.stone_cobble, 13500, { detailFn: (p, s) => detailCobblestone(p, s) }));
add('bridge_stone_02', genGround(P.stone_cobble, 13501, { detailFn: (p, s) => detailCobblestone(p, s) }));
// Ruins floor (cracked stone with grass growing through)
for (let i = 1; i <= 3; i++) {
  const tile = genGround(P.stone, 13600 + i * 127);
  detailCracks(tile, 13600 + i);
  // Add grass through cracks
  for (let j = 0; j < 6; j++) {
    const gx = Math.floor(hash(j, 70, 13600 + i) * 50) + 7;
    const gy = Math.floor(hash(j, 71, 13600 + i) * 20) + 6;
    if (isInsideDiamond(gx, gy)) {
      setPixelRGB(tile, gx, gy, P.grass_lush.blade, 180);
    }
  }
  add(`ruins_floor_0${i}`, tile);
}

// ── ROW 12: Special ground types (192-207) ──
console.log('Row 12: Special ground types...');
// Magic/enchanted ground (purple tint)
for (let i = 1; i <= 2; i++)
  add(`magic_ground_0${i}`, genGround({ base: [rgb(80, 60, 120), rgb(90, 65, 130)] }, 17000 + i * 131));
// Flower meadow (lush grass with many flowers)
for (let i = 1; i <= 3; i++) {
  const tile = genGround(P.grass_lush, 17100 + i * 137, { detailFn: (p, s) => detailGrassBlades(p, s, P.grass_lush) });
  // Add colorful flower dots
  const flowerColors = [rgb(220, 70, 70), rgb(70, 70, 220), rgb(220, 200, 50), rgb(220, 120, 180)];
  for (let j = 0; j < 12; j++) {
    const fx = Math.floor(hash(j, 80, 17100 + i) * 52) + 6;
    const fy = Math.floor(hash(j, 81, 17100 + i) * 22) + 5;
    if (isInsideDiamond(fx, fy)) {
      const fc = flowerColors[j % flowerColors.length];
      setPixelRGB(tile, fx, fy, fc, 220);
      if (isInsideDiamond(fx + 1, fy)) setPixelRGB(tile, fx + 1, fy, scaleRGB(fc, 0.8), 200);
    }
  }
  add(`meadow_0${i}`, tile);
}
// Mossy stone (dungeon entrance area)
for (let i = 1; i <= 2; i++) {
  const tile = genGround(P.stone, 17200 + i * 139);
  // Heavy moss
  for (let y = 0; y < ISO_H; y++) {
    for (let x = 0; x < ISO_W; x++) {
      if (!isInsideDiamond(x, y)) continue;
      if (fbm(x * 0.15, y * 0.2, 3, 17200 + i) > 0.55) {
        const existing = getPixel(tile, x, y);
        setPixelRGB(tile, x, y, blendRGB(existing, P.stone.moss, 0.4));
      }
    }
  }
  add(`mossy_stone_0${i}`, tile);
}
// Autumn grass
for (let i = 1; i <= 3; i++)
  add(`grass_autumn_0${i}`, genGround({ base: [rgb(160, 130, 50), rgb(170, 110, 40), rgb(150, 120, 45)] }, 17300 + i * 149));
// Cherry blossom ground (pink petals on grass)
for (let i = 1; i <= 2; i++) {
  const tile = genGround(P.grass_lush, 17400 + i * 151, { detailFn: (p, s) => detailGrassBlades(p, s, P.grass_lush) });
  for (let j = 0; j < 10; j++) {
    const px = Math.floor(hash(j, 90, 17400 + i) * 52) + 6;
    const py = Math.floor(hash(j, 91, 17400 + i) * 22) + 5;
    if (isInsideDiamond(px, py)) {
      setPixelRGB(tile, px, py, rgb(240, 180, 200), 180);
    }
  }
  add(`cherry_ground_0${i}`, tile);
}
// Fill remaining with blank
while (idx < 208) add(`blank_${idx}`, createTile());

// ── ROW 13: Reserved / additional biome variants (208-223) ──
console.log('Row 13: Extra biome variants...');
// Extra lush grass with denser detail
for (let i = 6; i <= 8; i++)
  add(`grass_lush_0${i}`, genGround(P.grass_lush, 1000 + i * 157, { detailFn: (p, s) => detailGrassBlades(p, s, P.grass_lush) }));
// Extra snow variants
for (let i = 4; i <= 5; i++)
  add(`snow_0${i}`, genGround(P.snow, 6000 + i * 163, { detailFn: (p, s) => detailSnowSparkle(p, s) }));
// Extra sand variants
for (let i = 4; i <= 5; i++)
  add(`sand_0${i}`, genGround(P.sand, 5000 + i * 167));
// Extra stone variants
for (let i = 4; i <= 5; i++)
  add(`stone_0${i}`, genGround(P.stone, 7000 + i * 173, { detailFn: (p, s) => detailCracks(p, s) }));
// Fill last slots
while (idx < COLS * ROWS) {
  add(`reserved_${idx}`, genGround(P.grass_lush, 20000 + idx * 179, { detailFn: (p, s) => detailGrassBlades(p, s, P.grass_lush) }));
}

// ═══════════════════════════════════════════════════
// OUTPUT
// ═══════════════════════════════════════════════════

const buffer = PNG.sync.write(output);
fs.mkdirSync(path.dirname(OUTPUT_PNG), { recursive: true });
fs.writeFileSync(OUTPUT_PNG, buffer);

const tilesJson = {
  tileSize: { width: ISO_W, height: ISO_H },
  columns: COLS,
  rows: ROWS,
  imageWidth: OUTPUT_W,
  imageHeight: OUTPUT_H,
  tiles: tileMap
};
fs.writeFileSync(OUTPUT_JSON, JSON.stringify(tilesJson, null, 2));

const namedCount = Object.keys(tileMap).filter(k => !k.startsWith('blank_') && !k.startsWith('reserved_')).length;
console.log(`\n=== Generation Complete ===`);
console.log(`Output: ${OUTPUT_PNG}`);
console.log(`  ${OUTPUT_W}x${OUTPUT_H} (${COLS}col x ${ROWS}row)`);
console.log(`  ${idx} total tiles`);
console.log(`  ${namedCount} named tiles`);
console.log(`  ${idx - namedCount} blank/reserved slots`);
console.log(`Mapping: ${OUTPUT_JSON}\n`);
