#!/usr/bin/env node
/**
 * Isometric Object & Tree Sprite Generator
 *
 * Generates high-quality isometric sprites for:
 * - Trees (oak, pine, palm, dead)
 * - Bushes and plants
 * - Rocks
 * - Resources (with glow effects)
 * - Decorations (grass tufts, flowers, etc.)
 *
 * All sprites sit on 64x32 diamond base tiles with consistent lighting
 * (top-left light source, bottom-right shadows).
 */

import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Output directories
const OBJECTS_DIR = path.join(__dirname, '../packages/client/public/assets/objects');
const RESOURCES_DIR = path.join(__dirname, '../packages/client/public/assets/resources');

// Color palettes
const COLORS = {
  // Tree trunks
  trunk_dark: { r: 90, g: 53, b: 32 },
  trunk_mid: { r: 107, g: 66, b: 38 },
  trunk_light: { r: 139, g: 90, b: 43 },

  // Lush green canopy
  canopy_dark: { r: 45, g: 122, b: 40 },
  canopy_mid: { r: 61, g: 139, b: 55 },
  canopy_light: { r: 74, g: 159, b: 64 },

  // Pine
  pine_dark: { r: 31, g: 74, b: 31 },
  pine_mid: { r: 45, g: 90, b: 40 },
  pine_light: { r: 61, g: 107, b: 48 },

  // Dead wood
  dead_dark: { r: 107, g: 96, b: 80 },
  dead_mid: { r: 139, g: 123, b: 107 },
  dead_light: { r: 160, g: 144, b: 128 },

  // Palm
  palm_trunk: { r: 107, g: 74, b: 53 },
  palm_frond: { r: 45, g: 122, b: 40 },

  // Bush
  bush_dark: { r: 61, g: 122, b: 55 },
  bush_mid: { r: 74, g: 138, b: 63 },
  bush_light: { r: 93, g: 160, b: 73 },

  // Berry bush
  berry: { r: 180, g: 30, b: 60 },

  // Flowers
  flower_yellow: { r: 255, g: 220, b: 60 },
  flower_pink: { r: 255, g: 120, b: 150 },
  flower_red: { r: 230, g: 60, b: 80 },
  flower_purple: { r: 160, g: 80, b: 200 },

  // Rock
  rock_dark: { r: 112, g: 120, b: 128 },
  rock_mid: { r: 128, g: 136, b: 144 },
  rock_light: { r: 144, g: 154, b: 160 },
  moss: { r: 80, g: 130, b: 70 },

  // Resources
  wood_brown: { r: 139, g: 90, b: 43 },
  ore_dark: { r: 60, g: 60, b: 70 },
  ore_metallic: { r: 140, g: 150, b: 160 },
  gold: { r: 218, g: 165, b: 32 },
  gold_bright: { r: 255, g: 215, b: 0 },
  crystal_base: { r: 102, g: 136, b: 221 },
  crystal_bright: { r: 136, g: 153, b: 238 },
  stone_gray: { r: 128, g: 128, b: 128 },
  fiber_tan: { r: 210, g: 180, b: 140 },

  // Generic
  shadow: { r: 0, g: 0, b: 0 },
  white: { r: 255, g: 255, b: 255 },
};

/** Helper: Create PNG with given dimensions */
function createPNG(width, height) {
  return new PNG({ width, height });
}

/** Helper: Set pixel with alpha */
function setPixel(png, x, y, color, alpha = 255) {
  if (x < 0 || x >= png.width || y < 0 || y >= png.height) return;
  const idx = (png.width * y + x) << 2;
  png.data[idx] = color.r;
  png.data[idx + 1] = color.g;
  png.data[idx + 2] = color.b;
  png.data[idx + 3] = alpha;
}

/** Helper: Blend color with lighting factor (0=dark, 1=normal, >1=bright) */
function shade(color, factor) {
  return {
    r: Math.min(255, Math.floor(color.r * factor)),
    g: Math.min(255, Math.floor(color.g * factor)),
    b: Math.min(255, Math.floor(color.b * factor)),
  };
}

/** Helper: Draw filled ellipse */
function fillEllipse(png, cx, cy, rx, ry, color, alpha = 255) {
  for (let y = -ry; y <= ry; y++) {
    for (let x = -rx; x <= rx; x++) {
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) {
        setPixel(png, cx + x, cy + y, color, alpha);
      }
    }
  }
}

/** Helper: Draw shadow ellipse at base */
function drawShadow(png, cx, cy) {
  fillEllipse(png, cx, cy, 18, 6, COLORS.shadow, 40);
}

/** Helper: Draw isometric cylinder (for trunk) */
function drawIsoCylinder(png, cx, cy, radius, height, colorLight, colorDark) {
  // Draw from bottom to top
  for (let h = 0; h < height; h++) {
    const yPos = cy - h;
    // Left side (darker)
    for (let x = -radius; x < 0; x++) {
      const distFromCenter = Math.abs(x) / radius;
      if (distFromCenter <= 1) {
        const shade_factor = 0.7 + (1 - distFromCenter) * 0.2;
        const col = shade(colorDark, shade_factor);
        setPixel(png, cx + x, yPos, col);
      }
    }
    // Right side (lighter)
    for (let x = 0; x <= radius; x++) {
      const distFromCenter = Math.abs(x) / radius;
      if (distFromCenter <= 1) {
        const shade_factor = 0.9 + (1 - distFromCenter) * 0.2;
        const col = shade(colorLight, shade_factor);
        setPixel(png, cx + x, yPos, col);
      }
    }
  }
}

/** Helper: Draw cloud-like canopy */
function drawCanopy(png, cx, cy, width, height, colorDark, colorMid, colorLight) {
  // Main ellipse
  fillEllipse(png, cx, cy, width, height, colorMid);

  // Darker patches for depth
  fillEllipse(png, cx - width / 3, cy + height / 3, width / 3, height / 3, colorDark);
  fillEllipse(png, cx + width / 4, cy + height / 4, width / 4, height / 4, colorDark);

  // Lighter highlights
  fillEllipse(png, cx - width / 4, cy - height / 3, width / 3, height / 3, colorLight, 180);
}

/** Helper: Draw pine triangle layer */
function drawPineLayer(png, cx, cy, width, height, color) {
  for (let y = 0; y < height; y++) {
    const rowWidth = Math.floor((width * (height - y)) / height);
    for (let x = -rowWidth; x <= rowWidth; x++) {
      // Darken towards edges
      const edgeFactor = 1 - Math.abs(x) / rowWidth * 0.3;
      setPixel(png, cx + x, cy + y, shade(color, edgeFactor));
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// TREE GENERATORS
// ═══════════════════════════════════════════════════════════════

function generateOakTree(variant) {
  const png = createPNG(64, 96);
  const cx = 32, cy = 88;

  // Shadow
  drawShadow(png, cx, cy);

  // Trunk (brown isometric cylinder)
  const trunkHeight = 30;
  const trunkRadius = 3 + variant * 0.5;
  drawIsoCylinder(png, cx, cy - 8, trunkRadius, trunkHeight, COLORS.trunk_light, COLORS.trunk_dark);

  // Canopy (large green cloud)
  const canopyY = cy - trunkHeight - 20 + variant * 3;
  const canopyWidth = 20 + variant * 2;
  const canopyHeight = 18 + variant;
  drawCanopy(png, cx, canopyY, canopyWidth, canopyHeight, COLORS.canopy_dark, COLORS.canopy_mid, COLORS.canopy_light);

  return png;
}

function generatePineTree(variant) {
  const png = createPNG(64, 96);
  const cx = 32, cy = 88;

  drawShadow(png, cx, cy);

  // Thin trunk
  drawIsoCylinder(png, cx, cy - 8, 2, 20, COLORS.trunk_light, COLORS.trunk_dark);

  // Multiple triangle layers (pine shape)
  const layers = 4 + variant;
  const baseY = cy - 25;
  for (let i = 0; i < layers; i++) {
    const layerY = baseY - i * 8;
    const layerWidth = 14 - i * 2;
    const layerHeight = 12;
    const darkFactor = 0.8 + i * 0.05; // Lighten towards top
    drawPineLayer(png, cx, layerY, layerWidth, layerHeight, shade(COLORS.pine_mid, darkFactor));
  }

  return png;
}

function generateDeadTree(variant) {
  const png = createPNG(64, 96);
  const cx = 32, cy = 88;

  drawShadow(png, cx, cy);

  // Dead trunk (grey-brown)
  drawIsoCylinder(png, cx, cy - 8, 3, 40, COLORS.dead_light, COLORS.dead_dark);

  // Bare branches (just lines)
  const branchCount = 3 + variant;
  for (let i = 0; i < branchCount; i++) {
    const branchY = cy - 20 - i * 8;
    const direction = i % 2 === 0 ? 1 : -1;
    const branchLength = 6 + Math.floor(Math.random() * 4);

    for (let j = 0; j < branchLength; j++) {
      setPixel(png, cx + direction * j, branchY - j / 2, COLORS.dead_mid);
      setPixel(png, cx + direction * j, branchY - j / 2 - 1, COLORS.dead_dark, 150);
    }
  }

  return png;
}

function generatePalmTree(variant) {
  const png = createPNG(64, 128);
  const cx = 32, cy = 120;

  drawShadow(png, cx, cy);

  // Curved trunk (draw segments)
  const trunkHeight = 50;
  const curveAmount = 4 + variant * 2;
  for (let h = 0; h < trunkHeight; h++) {
    const curve = Math.sin((h / trunkHeight) * Math.PI) * curveAmount;
    const x = cx + curve;
    const y = cy - 8 - h;
    setPixel(png, x - 1, y, COLORS.palm_trunk);
    setPixel(png, x, y, shade(COLORS.palm_trunk, 1.2));
    setPixel(png, x + 1, y, shade(COLORS.palm_trunk, 0.8));
  }

  // Palm fronds (fan shape at top)
  const frondY = cy - trunkHeight - 10;
  const frondCount = 6 + variant;
  for (let i = 0; i < frondCount; i++) {
    const angle = (i / frondCount) * Math.PI * 2;
    const frondLength = 15 + Math.floor(Math.random() * 5);

    for (let j = 0; j < frondLength; j++) {
      const x = cx + Math.cos(angle) * j;
      const y = frondY - Math.sin(angle) * j * 0.3;
      setPixel(png, Math.floor(x), Math.floor(y), COLORS.palm_frond);
      // Wider fronds
      setPixel(png, Math.floor(x) + 1, Math.floor(y), shade(COLORS.palm_frond, 0.9));
      setPixel(png, Math.floor(x) - 1, Math.floor(y), shade(COLORS.palm_frond, 0.9));
    }
  }

  return png;
}

// ═══════════════════════════════════════════════════════════════
// BUSH & PLANT GENERATORS
// ═══════════════════════════════════════════════════════════════

function generateBush(variant, withBerries = false, withFlowers = false) {
  const png = createPNG(64, 48);
  const cx = 32, cy = 40;

  drawShadow(png, cx, cy);

  // Round bush shape
  const bushWidth = 14 + variant * 2;
  const bushHeight = 10 + variant;
  fillEllipse(png, cx, cy - bushHeight, bushWidth, bushHeight, COLORS.bush_mid);

  // Darker base
  fillEllipse(png, cx, cy - bushHeight / 3, bushWidth, bushHeight / 3, COLORS.bush_dark);

  // Lighter top highlights
  fillEllipse(png, cx - 3, cy - bushHeight - 2, bushWidth / 3, bushHeight / 3, COLORS.bush_light, 180);

  if (withBerries) {
    // Add red berry dots
    const berryCount = 4 + variant * 2;
    for (let i = 0; i < berryCount; i++) {
      const angle = (i / berryCount) * Math.PI * 2;
      const dist = bushWidth * 0.6;
      const x = cx + Math.cos(angle) * dist;
      const y = cy - bushHeight + Math.sin(angle) * (bushHeight * 0.5);
      fillEllipse(png, Math.floor(x), Math.floor(y), 2, 2, COLORS.berry);
    }
  }

  if (withFlowers) {
    // Add flower dots
    const flowerCount = 3 + variant;
    const flowerColors = [COLORS.flower_yellow, COLORS.flower_pink, COLORS.flower_red];
    for (let i = 0; i < flowerCount; i++) {
      const angle = (i / flowerCount) * Math.PI * 2;
      const dist = bushWidth * 0.7;
      const x = cx + Math.cos(angle) * dist;
      const y = cy - bushHeight + Math.sin(angle) * (bushHeight * 0.6);
      const color = flowerColors[i % flowerColors.length];
      fillEllipse(png, Math.floor(x), Math.floor(y), 2, 2, color);
    }
  }

  return png;
}

function generateFern(variant) {
  const png = createPNG(64, 48);
  const cx = 32, cy = 40;

  drawShadow(png, cx, cy);

  // Low spreading fronds
  const frondCount = 5 + variant;
  for (let i = 0; i < frondCount; i++) {
    const angle = (i / frondCount) * Math.PI - Math.PI / 2;
    const frondLength = 8 + Math.floor(Math.random() * 4);

    for (let j = 0; j < frondLength; j++) {
      const x = cx + Math.cos(angle) * j * 1.5;
      const y = cy - 2 - j * 0.3;
      setPixel(png, Math.floor(x), Math.floor(y), COLORS.bush_mid);
      // Add leaflets
      if (j > 2 && j % 2 === 0) {
        setPixel(png, Math.floor(x) + 1, Math.floor(y), COLORS.bush_light, 200);
        setPixel(png, Math.floor(x) - 1, Math.floor(y), COLORS.bush_light, 200);
      }
    }
  }

  return png;
}

function generateMushroom(variant) {
  const png = createPNG(64, 48);
  const cx = 32, cy = 40;

  const colors = [
    { cap: { r: 200, g: 60, b: 60 }, spot: COLORS.white }, // Red-white
    { cap: { r: 139, g: 90, b: 60 }, spot: null },         // Brown
    { cap: { r: 138, g: 80, b: 200 }, spot: COLORS.white }, // Purple-white
  ];

  const mushColor = colors[variant % 3];

  // Stem (small cylinder)
  for (let h = 0; h < 6; h++) {
    fillEllipse(png, cx, cy - h, 2, 1, { r: 230, g: 220, b: 200 });
  }

  // Cap (ellipse)
  fillEllipse(png, cx, cy - 8, 5 + variant, 4, mushColor.cap);

  // Spots if applicable
  if (mushColor.spot) {
    fillEllipse(png, cx - 2, cy - 9, 1, 1, mushColor.spot);
    fillEllipse(png, cx + 2, cy - 8, 1, 1, mushColor.spot);
  }

  return png;
}

function generateReed(variant) {
  const png = createPNG(64, 48);
  const cx = 32, cy = 40;

  const stalkCount = 3 + variant;
  for (let i = 0; i < stalkCount; i++) {
    const x = cx - stalkCount + i * 2;
    const height = 14 + Math.floor(Math.random() * 6);

    for (let h = 0; h < height; h++) {
      setPixel(png, x, cy - h, shade(COLORS.bush_mid, 0.9 + h * 0.01));
    }
  }

  return png;
}

function generateCactus(variant) {
  const png = createPNG(64, 48);
  const cx = 32, cy = 40;

  drawShadow(png, cx, cy);

  const cactusColor = { r: 61, g: 122, b: 55 };
  const height = 16 + variant * 2;

  // Main body
  for (let h = 0; h < height; h++) {
    fillEllipse(png, cx, cy - h, 3, 1, cactusColor);
  }

  // Arms
  if (variant > 0) {
    const armY = cy - height / 2;
    for (let h = 0; h < 6; h++) {
      setPixel(png, cx - 4, armY - h, cactusColor);
      setPixel(png, cx + 4, armY - h, cactusColor);
    }
  }

  // Spines (small dots)
  for (let i = 0; i < height; i += 3) {
    setPixel(png, cx - 2, cy - i, COLORS.white, 200);
    setPixel(png, cx + 2, cy - i, COLORS.white, 200);
  }

  return png;
}

// ═══════════════════════════════════════════════════════════════
// ROCK GENERATORS
// ═══════════════════════════════════════════════════════════════

function generateRock(size, variant, withMoss = false) {
  const height = size === 'small' ? 48 : 64;
  const png = createPNG(64, height);
  const cx = 32, cy = height - 8;

  drawShadow(png, cx, cy);

  const rockWidth = size === 'small' ? 10 + variant : 16 + variant * 2;
  const rockHeight = size === 'small' ? 8 + variant : 14 + variant * 2;

  // Main rock body (irregular ellipse with facets)
  fillEllipse(png, cx, cy - rockHeight / 2, rockWidth, rockHeight, COLORS.rock_mid);

  // Darker left side
  for (let y = -rockHeight; y <= 0; y++) {
    for (let x = -rockWidth; x < 0; x++) {
      if ((x * x) / (rockWidth * rockWidth) + (y * y) / (rockHeight * rockHeight) <= 1) {
        setPixel(png, cx + x, cy - rockHeight / 2 + y, COLORS.rock_dark, 200);
      }
    }
  }

  // Lighter top-right highlight
  fillEllipse(png, cx + rockWidth / 3, cy - rockHeight - 2, rockWidth / 3, rockHeight / 3, COLORS.rock_light, 150);

  if (withMoss) {
    // Add green moss patches
    fillEllipse(png, cx - rockWidth / 2, cy - rockHeight / 3, rockWidth / 4, rockHeight / 4, COLORS.moss, 180);
    fillEllipse(png, cx + rockWidth / 3, cy, rockWidth / 5, rockHeight / 5, COLORS.moss, 150);
  }

  return png;
}

// ═══════════════════════════════════════════════════════════════
// RESOURCE GENERATORS
// ═══════════════════════════════════════════════════════════════

function generateWoodStack() {
  const png = createPNG(64, 48);
  const cx = 32, cy = 40;

  drawShadow(png, cx, cy);

  // Stack of logs
  for (let i = 0; i < 3; i++) {
    const logY = cy - i * 4;
    const logWidth = 12 - i;

    // Log cylinder
    for (let x = -logWidth; x <= logWidth; x++) {
      const shade_factor = 0.7 + (logWidth - Math.abs(x)) / logWidth * 0.3;
      setPixel(png, cx + x, logY, shade(COLORS.wood_brown, shade_factor));
      setPixel(png, cx + x, logY - 1, shade(COLORS.wood_brown, shade_factor * 0.9));
      setPixel(png, cx + x, logY - 2, shade(COLORS.wood_brown, shade_factor * 0.8));
    }

    // Ring texture on log ends
    fillEllipse(png, cx - logWidth, logY - 1, 2, 1, shade(COLORS.trunk_dark, 1.2), 180);
    fillEllipse(png, cx + logWidth, logY - 1, 2, 1, shade(COLORS.trunk_dark, 1.2), 180);
  }

  return png;
}

function generateFoodBasket() {
  const png = createPNG(64, 48);
  const cx = 32, cy = 40;

  drawShadow(png, cx, cy);

  // Basket (brown)
  const basketColor = { r: 139, g: 90, b: 60 };
  fillEllipse(png, cx, cy - 3, 10, 4, basketColor);
  for (let h = 0; h < 6; h++) {
    fillEllipse(png, cx, cy - h, 10, 1, shade(basketColor, 0.8));
  }

  // Food items (colorful)
  fillEllipse(png, cx - 4, cy - 8, 3, 3, { r: 200, g: 60, b: 60 }); // Red
  fillEllipse(png, cx + 2, cy - 9, 3, 3, { r: 60, g: 180, b: 60 }); // Green
  fillEllipse(png, cx - 1, cy - 10, 3, 3, { r: 255, g: 200, b: 60 }); // Yellow

  return png;
}

function generateHerbBundle() {
  const png = createPNG(64, 48);
  const cx = 32, cy = 40;

  drawShadow(png, cx, cy);

  // Bundle of herbs (green stalks tied together)
  for (let i = 0; i < 8; i++) {
    const x = cx - 4 + i;
    const height = 10 + Math.floor(Math.random() * 4);

    for (let h = 0; h < height; h++) {
      setPixel(png, x, cy - h, COLORS.bush_mid);
    }

    // Flower top
    if (i % 2 === 0) {
      fillEllipse(png, x, cy - height, 2, 2, COLORS.flower_yellow);
    }
  }

  // Tie (brown string)
  for (let x = -4; x <= 4; x++) {
    setPixel(png, cx + x, cy - 4, { r: 139, g: 90, b: 60 });
  }

  return png;
}

function generateOre(type) {
  const png = createPNG(64, 48);
  const cx = 32, cy = 40;

  drawShadow(png, cx, cy);

  // Dark rock base
  fillEllipse(png, cx, cy - 6, 10, 8, COLORS.ore_dark);

  let glintColor, glowColor;
  if (type === 'iron') {
    glintColor = COLORS.ore_metallic;
    glowColor = { r: 180, g: 190, b: 200 };
  } else if (type === 'gold') {
    glintColor = COLORS.gold;
    glowColor = COLORS.gold_bright;
  } else { // crystal
    glintColor = COLORS.crystal_base;
    glowColor = COLORS.crystal_bright;
  }

  // Metallic/crystal glints
  fillEllipse(png, cx - 3, cy - 8, 3, 3, glintColor, 220);
  fillEllipse(png, cx + 2, cy - 7, 2, 2, glintColor, 200);
  fillEllipse(png, cx, cy - 10, 2, 2, glowColor, 180);

  // Glow effect (larger transparent halo)
  for (let r = 12; r <= 18; r += 2) {
    const alpha = 30 - (r - 12) * 3;
    fillEllipse(png, cx, cy - 6, r, r - 4, glowColor, alpha);
  }

  return png;
}

function generateCrystalFormation() {
  const png = createPNG(64, 48);
  const cx = 32, cy = 40;

  drawShadow(png, cx, cy);

  // Multiple crystal shards
  const crystals = [
    { x: 0, y: -12, w: 3, h: 12 },
    { x: -5, y: -8, w: 2, h: 8 },
    { x: 4, y: -10, w: 2, h: 10 },
  ];

  for (const cryst of crystals) {
    const x = cx + cryst.x;
    const baseY = cy;

    // Crystal shard (tapered)
    for (let h = 0; h < cryst.h; h++) {
      const width = Math.floor(cryst.w * (cryst.h - h) / cryst.h);
      for (let w = -width; w <= width; w++) {
        const alpha = 200 - h * 5;
        setPixel(png, x + w, baseY + cryst.y + h, COLORS.crystal_base, alpha);
      }
    }

    // Highlight edge
    for (let h = 0; h < cryst.h; h++) {
      setPixel(png, x, baseY + cryst.y + h, COLORS.crystal_bright, 220);
    }
  }

  // Glow
  for (let r = 16; r <= 22; r += 2) {
    fillEllipse(png, cx, cy - 8, r, r - 6, COLORS.crystal_bright, 25 - (r - 16) * 2);
  }

  return png;
}

function generateStonepile() {
  const png = createPNG(64, 48);
  const cx = 32, cy = 40;

  drawShadow(png, cx, cy);

  // Pile of stone blocks
  const blocks = [
    { x: -4, y: -4, w: 8, h: 4 },
    { x: 2, y: -8, w: 7, h: 4 },
    { x: -3, y: -12, w: 6, h: 4 },
  ];

  for (const block of blocks) {
    const bx = cx + block.x;
    const by = cy + block.y;

    // Block face (isometric)
    for (let y = 0; y < block.h; y++) {
      for (let x = 0; x < block.w; x++) {
        const shade_factor = 0.7 + x / block.w * 0.3;
        setPixel(png, bx + x, by + y, shade(COLORS.stone_gray, shade_factor));
      }
    }
  }

  return png;
}

function generateFiberBundle() {
  const png = createPNG(64, 48);
  const cx = 32, cy = 40;

  drawShadow(png, cx, cy);

  // Bundle of fibers (tan/brown strands)
  for (let i = 0; i < 10; i++) {
    const x = cx - 5 + i;
    const height = 8 + Math.floor(Math.random() * 4);
    const variance = Math.floor(Math.random() * 2);

    for (let h = 0; h < height; h++) {
      setPixel(png, x + variance, cy - h, COLORS.fiber_tan);
    }
  }

  // Tie
  for (let x = -5; x <= 5; x++) {
    setPixel(png, cx + x, cy - 5, shade(COLORS.fiber_tan, 0.7));
  }

  return png;
}

// ═══════════════════════════════════════════════════════════════
// DECORATION GENERATORS
// ═══════════════════════════════════════════════════════════════

function generateGrassTuft(variant) {
  const png = createPNG(64, 32);
  const cx = 32, cy = 28;

  // Just 3-5 thin green lines
  const bladeCount = 3 + variant % 3;
  for (let i = 0; i < bladeCount; i++) {
    const x = cx - bladeCount / 2 + i;
    const height = 6 + Math.floor(Math.random() * 4);
    const curve = Math.sin(i) * 2;

    for (let h = 0; h < height; h++) {
      setPixel(png, x + Math.floor(curve * h / height), cy - h, COLORS.bush_mid, 180);
    }
  }

  return png;
}

function generateFlowerPatch(variant) {
  const png = createPNG(64, 32);
  const cx = 32, cy = 28;

  const colors = [COLORS.flower_red, COLORS.flower_yellow, COLORS.flower_pink, COLORS.flower_purple];
  const color = colors[variant % 4];

  // Small cluster of flowers
  const flowerCount = 3 + variant % 3;
  for (let i = 0; i < flowerCount; i++) {
    const x = cx - 4 + i * 2;
    const y = cy - 2 - Math.floor(Math.random() * 2);

    // Stem
    setPixel(png, x, y, COLORS.bush_mid);
    setPixel(png, x, y - 1, COLORS.bush_mid);

    // Flower
    fillEllipse(png, x, y - 3, 2, 2, color);
  }

  return png;
}

function generatePebbles(variant) {
  const png = createPNG(64, 32);
  const cx = 32, cy = 28;

  // Scattered small grey dots
  const pebbleCount = 4 + variant * 2;
  for (let i = 0; i < pebbleCount; i++) {
    const x = cx - 8 + Math.floor(Math.random() * 16);
    const y = cy - 2 + Math.floor(Math.random() * 4);

    fillEllipse(png, x, y, 1 + Math.floor(Math.random() * 2), 1, COLORS.rock_mid);
  }

  return png;
}

function generateFallenLog(variant) {
  const png = createPNG(64, 32);
  const cx = 32, cy = 28;

  // Horizontal log
  const logLength = 14 + variant * 2;
  for (let x = -logLength / 2; x <= logLength / 2; x++) {
    setPixel(png, cx + x, cy, COLORS.trunk_dark);
    setPixel(png, cx + x, cy - 1, COLORS.trunk_mid);
    setPixel(png, cx + x, cy - 2, COLORS.trunk_light);
  }

  return png;
}

function generatePuddle(variant) {
  const png = createPNG(64, 32);
  const cx = 32, cy = 28;

  const puddleColor = { r: 100, g: 120, b: 140 };
  const width = 8 + variant * 2;
  const height = 4 + variant;

  fillEllipse(png, cx, cy, width, height, puddleColor, 180);
  // Lighter edge (reflection)
  fillEllipse(png, cx - 2, cy - 1, width / 2, height / 2, { r: 150, g: 170, b: 190 }, 100);

  return png;
}

function generateSignPost(variant) {
  const png = createPNG(64, 48);
  const cx = 32, cy = 40;

  drawShadow(png, cx, cy);

  // Post
  for (let h = 0; h < 14; h++) {
    setPixel(png, cx, cy - h, COLORS.trunk_dark);
    setPixel(png, cx + 1, cy - h, COLORS.trunk_mid);
  }

  // Sign board
  const signColor = variant === 0 ? { r: 139, g: 90, b: 60 } : { r: 200, g: 180, b: 140 };
  for (let y = -16; y <= -12; y++) {
    for (let x = -6; x <= 6; x++) {
      setPixel(png, cx + x, cy + y, signColor);
    }
  }

  return png;
}

// ═══════════════════════════════════════════════════════════════
// ADDITIONAL TREE VARIANTS
// ═══════════════════════════════════════════════════════════════

function generateAutumnOak(variant) {
  const png = createPNG(64, 96);
  const cx = 32, cy = 88;
  drawShadow(png, cx, cy);

  const trunkHeight = 30;
  const trunkRadius = 3 + variant * 0.5;
  drawIsoCylinder(png, cx, cy - 8, trunkRadius, trunkHeight, COLORS.trunk_light, COLORS.trunk_dark);

  // Autumn canopy (orange/red/gold)
  const autumnDark = { r: 180, g: 70, b: 25 };
  const autumnMid = { r: 210, g: 120, b: 35 };
  const autumnLight = { r: 235, g: 170, b: 50 };

  const canopyY = cy - trunkHeight - 20 + variant * 3;
  const canopyWidth = 20 + variant * 2;
  const canopyHeight = 18 + variant;
  drawCanopy(png, cx, canopyY, canopyWidth, canopyHeight, autumnDark, autumnMid, autumnLight);

  // Scattered falling leaves
  for (let i = 0; i < 6; i++) {
    const lx = cx + (i * 7 - 21) % 30;
    const ly = canopyY + canopyHeight + i * 5;
    if (ly < cy && lx >= 0 && lx < 64) {
      const leafColor = i % 2 === 0 ? autumnMid : { r: 200, g: 80, b: 30 };
      setPixel(png, lx, ly, leafColor, 180);
    }
  }
  return png;
}

function generateSnowPine(variant) {
  const png = createPNG(64, 96);
  const cx = 32, cy = 88;
  drawShadow(png, cx, cy);
  drawIsoCylinder(png, cx, cy - 8, 2, 20, COLORS.trunk_light, COLORS.trunk_dark);

  const snowWhite = { r: 230, g: 240, b: 248 };
  const snowShadow = { r: 190, g: 205, b: 220 };

  const layers = 4 + variant;
  const baseY = cy - 25;
  for (let i = 0; i < layers; i++) {
    const layerY = baseY - i * 8;
    const layerWidth = 14 - i * 2;
    const layerHeight = 12;
    const darkFactor = 0.8 + i * 0.05;
    drawPineLayer(png, cx, layerY, layerWidth, layerHeight, shade(COLORS.pine_mid, darkFactor));

    // Snow caps on each layer
    for (let y = 0; y < 3; y++) {
      const rowWidth = Math.floor((layerWidth * (layerHeight - y)) / layerHeight);
      for (let x = -rowWidth; x <= rowWidth; x++) {
        const snowColor = y === 0 ? snowWhite : snowShadow;
        setPixel(png, cx + x, layerY + y, snowColor, 220);
      }
    }
  }
  return png;
}

function generateWillowTree(variant) {
  const png = createPNG(64, 128);
  const cx = 32, cy = 120;
  drawShadow(png, cx, cy);
  drawIsoCylinder(png, cx, cy - 8, 4, 35, COLORS.trunk_light, COLORS.trunk_dark);

  // Willow canopy with drooping branches
  const willowDark = { r: 55, g: 115, b: 50 };
  const willowMid = { r: 75, g: 140, b: 60 };
  const willowLight = { r: 95, g: 165, b: 70 };
  const canopyY = cy - 50;

  fillEllipse(png, cx, canopyY, 22, 12, willowMid);
  fillEllipse(png, cx - 5, canopyY - 4, 10, 6, willowLight, 180);

  // Drooping branches
  for (let i = 0; i < 14; i++) {
    const startAngle = (i / 14) * Math.PI * 2;
    const branchLen = 25 + (i % 3) * 5;
    const startX = cx + Math.cos(startAngle) * 16;
    const startY = canopyY + Math.sin(startAngle) * 8;

    for (let j = 0; j < branchLen; j++) {
      const drift = Math.cos(startAngle) * 0.3;
      const bx = startX + drift * j;
      const by = startY + j * 0.8;
      if (by < cy && bx >= 0 && bx < 64) {
        const col = j < branchLen / 2 ? willowMid : willowDark;
        setPixel(png, Math.floor(bx), Math.floor(by), col, 200);
        setPixel(png, Math.floor(bx) + 1, Math.floor(by), shade(col, 0.8), 150);
      }
    }
  }
  return png;
}

function generateCherryTree(variant) {
  const png = createPNG(64, 96);
  const cx = 32, cy = 88;
  drawShadow(png, cx, cy);
  drawIsoCylinder(png, cx, cy - 8, 3, 30, COLORS.trunk_light, COLORS.trunk_dark);

  // Pink blossom canopy
  const cherryDark = { r: 200, g: 100, b: 130 };
  const cherryMid = { r: 235, g: 150, b: 175 };
  const cherryLight = { r: 255, g: 200, b: 215 };

  const canopyY = cy - 48;
  drawCanopy(png, cx, canopyY, 22, 18, cherryDark, cherryMid, cherryLight);

  // Extra blossom clusters
  fillEllipse(png, cx - 8, canopyY - 5, 6, 4, cherryLight, 200);
  fillEllipse(png, cx + 10, canopyY + 2, 5, 3, cherryLight, 180);

  // Falling petals
  for (let i = 0; i < 8; i++) {
    const px = cx + ((i * 11) % 40) - 20;
    const py = canopyY + 20 + i * 4;
    if (py < cy && px >= 0 && px < 64) {
      setPixel(png, px, py, cherryLight, 160);
    }
  }
  return png;
}

function generateGiantTree(variant) {
  const png = createPNG(128, 160); // 2x2 tile footprint
  const cx = 64, cy = 150;

  // Large shadow
  fillEllipse(png, cx, cy, 36, 12, COLORS.shadow, 40);

  // Thick trunk with roots
  drawIsoCylinder(png, cx, cy - 10, 8, 60, COLORS.trunk_light, COLORS.trunk_dark);
  // Root bumps
  for (let i = 0; i < 5; i++) {
    const rx = cx + (i * 7 - 14);
    fillEllipse(png, rx, cy - 5, 4, 3, shade(COLORS.trunk_dark, 0.9));
  }

  // Massive canopy
  const canopyY = cy - 80;
  fillEllipse(png, cx, canopyY, 45, 35, COLORS.canopy_mid);
  fillEllipse(png, cx - 10, canopyY + 10, 20, 15, COLORS.canopy_dark);
  fillEllipse(png, cx + 12, canopyY + 8, 18, 12, COLORS.canopy_dark);
  fillEllipse(png, cx - 8, canopyY - 12, 20, 14, COLORS.canopy_light, 180);
  fillEllipse(png, cx + 5, canopyY - 8, 15, 10, COLORS.canopy_light, 160);

  return png;
}

// ═══════════════════════════════════════════════════════════════
// ADDITIONAL MINERALS & OBJECTS
// ═══════════════════════════════════════════════════════════════

function generateOreObject(type, variant) {
  const png = createPNG(64, 64);
  const cx = 32, cy = 52;
  drawShadow(png, cx, cy);

  const rockBase = { r: 90, g: 88, b: 82 };
  const rockLight = { r: 120, g: 118, b: 110 };

  // Rock base
  fillEllipse(png, cx, cy - 10, 14, 8, rockBase);
  fillEllipse(png, cx - 3, cy - 14, 8, 5, rockLight, 200);

  // Ore veins/patches
  const oreColor = type === 'iron'
    ? { r: 150, g: 160, b: 175 }
    : { r: 218, g: 175, b: 42 };
  const oreGlow = type === 'iron'
    ? { r: 180, g: 190, b: 210 }
    : { r: 255, g: 220, b: 60 };

  const spots = 5 + variant * 2;
  for (let i = 0; i < spots; i++) {
    const ox = cx + ((i * 7 + variant * 3) % 20) - 10;
    const oy = cy - 10 + ((i * 5) % 12) - 6;
    fillEllipse(png, ox, oy, 2, 1, oreColor);
    setPixel(png, ox, oy - 1, oreGlow, 200); // highlight
  }
  return png;
}

function generateCrystalObject(variant) {
  const png = createPNG(64, 64);
  const cx = 32, cy = 52;
  drawShadow(png, cx, cy);

  const crystalColors = [
    { base: { r: 80, g: 120, b: 200 }, bright: { r: 140, g: 180, b: 255 }, glow: { r: 180, g: 210, b: 255 } },
    { base: { r: 120, g: 60, b: 180 }, bright: { r: 180, g: 120, b: 240 }, glow: { r: 210, g: 170, b: 255 } },
  ];
  const pal = crystalColors[variant % 2];

  // Stone base
  fillEllipse(png, cx, cy - 4, 12, 5, { r: 100, g: 96, b: 90 });

  // Crystal spires
  const spires = [
    { x: cx - 4, h: 22, w: 3 },
    { x: cx + 2, h: 28, w: 4 },
    { x: cx + 8, h: 18, w: 3 },
    { x: cx - 8, h: 15, w: 2 },
  ];
  for (const spire of spires) {
    for (let y = 0; y < spire.h; y++) {
      const t = y / spire.h;
      const width = Math.floor(spire.w * (1 - t * 0.7));
      for (let x = -width; x <= width; x++) {
        const col = x < 0 ? pal.base : pal.bright;
        setPixel(png, spire.x + x, cy - 8 - y, col, 230);
      }
    }
    // Tip glow
    setPixel(png, spire.x, cy - 8 - spire.h, pal.glow, 255);
    setPixel(png, spire.x, cy - 8 - spire.h + 1, pal.glow, 200);
  }
  return png;
}

function generateBones(variant) {
  const png = createPNG(64, 48);
  const cx = 32, cy = 40;

  const boneWhite = { r: 230, g: 225, b: 210 };
  const boneShadow = { r: 180, g: 172, b: 155 };

  // Scattered bone pieces
  const bonePositions = variant === 0
    ? [[cx - 8, cy - 4], [cx + 5, cy - 2], [cx - 2, cy - 8], [cx + 10, cy - 6]]
    : [[cx - 10, cy - 3], [cx + 3, cy - 6], [cx + 8, cy - 2], [cx - 4, cy - 10], [cx + 12, cy - 8]];

  for (const [bx, by] of bonePositions) {
    // Small bone segment (horizontal or diagonal)
    for (let i = 0; i < 5; i++) {
      setPixel(png, bx + i, by, boneWhite);
      setPixel(png, bx + i, by + 1, boneShadow, 200);
    }
    // Knobs at ends
    setPixel(png, bx - 1, by - 1, boneWhite, 200);
    setPixel(png, bx + 5, by - 1, boneWhite, 200);
  }

  // Optional skull for variant 1
  if (variant === 1) {
    fillEllipse(png, cx, cy - 12, 4, 3, boneWhite);
    setPixel(png, cx - 1, cy - 13, boneShadow);
    setPixel(png, cx + 1, cy - 13, boneShadow);
  }
  return png;
}

function generateMushroomRing() {
  const png = createPNG(64, 48);
  const cx = 32, cy = 36;

  const capColors = [
    { r: 200, g: 60, b: 60 },
    { r: 180, g: 140, b: 50 },
    { r: 160, g: 70, b: 180 },
  ];
  const stemColor = { r: 220, g: 210, b: 190 };

  // Ring of 7 small mushrooms
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2;
    const mx = cx + Math.cos(angle) * 14;
    const my = cy + Math.sin(angle) * 5; // compressed for iso
    const cap = capColors[i % 3];

    // Stem
    setPixel(png, Math.floor(mx), Math.floor(my), stemColor);
    setPixel(png, Math.floor(mx), Math.floor(my) - 1, stemColor);
    // Cap
    fillEllipse(png, Math.floor(mx), Math.floor(my) - 3, 2, 1, cap);
    setPixel(png, Math.floor(mx), Math.floor(my) - 4, shade(cap, 1.2), 200);
  }
  return png;
}

function generateCampfireRemains() {
  const png = createPNG(64, 48);
  const cx = 32, cy = 40;

  const charcoal = { r: 40, g: 38, b: 35 };
  const ash = { r: 120, g: 115, b: 108 };
  const ember = { r: 200, g: 80, b: 20 };

  // Ash circle base
  fillEllipse(png, cx, cy - 4, 10, 4, ash, 180);
  fillEllipse(png, cx, cy - 4, 7, 3, charcoal);

  // Charred log pieces
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + 0.3;
    const lx = cx + Math.cos(angle) * 6;
    const ly = cy - 4 + Math.sin(angle) * 2;
    for (let j = 0; j < 4; j++) {
      setPixel(png, Math.floor(lx + Math.cos(angle) * j), Math.floor(ly + Math.sin(angle) * j * 0.3),
        charcoal);
    }
  }

  // Faint ember glow
  setPixel(png, cx, cy - 5, ember, 160);
  setPixel(png, cx + 1, cy - 4, ember, 120);
  setPixel(png, cx - 1, cy - 4, ember, 100);

  // Stone ring
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const sx = cx + Math.cos(angle) * 11;
    const sy = cy - 4 + Math.sin(angle) * 4;
    setPixel(png, Math.floor(sx), Math.floor(sy), { r: 130, g: 128, b: 122 });
  }
  return png;
}

function generateVine(variant) {
  const png = createPNG(64, 64);
  const cx = 32;

  const vineDark = { r: 50, g: 100, b: 40 };
  const vineMid = { r: 70, g: 130, b: 55 };
  const vineLight = { r: 90, g: 155, b: 65 };

  // Multiple hanging vine strands
  const strands = 4 + variant;
  for (let i = 0; i < strands; i++) {
    const startX = 8 + (i * 48 / strands);
    const length = 30 + (i * 7) % 20;
    const sway = (i % 2 === 0 ? 1 : -1) * 3;

    for (let j = 0; j < length; j++) {
      const vx = startX + Math.sin(j * 0.3) * sway;
      const vy = 4 + j;
      if (vy < 64 && vx >= 0 && vx < 64) {
        const col = j < length * 0.3 ? vineDark : j < length * 0.7 ? vineMid : vineLight;
        setPixel(png, Math.floor(vx), vy, col, 220);
        // Occasional leaf
        if (j % 5 === 0 && j > 3) {
          setPixel(png, Math.floor(vx) + 1, vy, vineLight, 180);
          setPixel(png, Math.floor(vx) - 1, vy + 1, vineMid, 160);
        }
      }
    }
  }
  return png;
}

// ═══════════════════════════════════════════════════════════════
// MAIN GENERATION
// ═══════════════════════════════════════════════════════════════

function savePNG(png, filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const buffer = PNG.sync.write(png);
  fs.writeFileSync(filePath, buffer);
  console.log(`✓ ${path.basename(filePath)}`);
}

function main() {
  console.log('🎨 Generating isometric object sprites...\n');

  // Create output directories
  fs.mkdirSync(OBJECTS_DIR, { recursive: true });
  fs.mkdirSync(RESOURCES_DIR, { recursive: true });

  console.log('Trees:');
  for (let i = 1; i <= 3; i++) {
    savePNG(generateOakTree(i), path.join(OBJECTS_DIR, `tree_oak_0${i}.png`));
  }
  for (let i = 1; i <= 3; i++) {
    savePNG(generatePineTree(i), path.join(OBJECTS_DIR, `tree_pine_0${i}.png`));
  }
  for (let i = 1; i <= 2; i++) {
    savePNG(generateDeadTree(i), path.join(OBJECTS_DIR, `tree_dead_0${i}.png`));
  }
  for (let i = 1; i <= 2; i++) {
    savePNG(generatePalmTree(i), path.join(OBJECTS_DIR, `tree_palm_0${i}.png`));
  }

  console.log('\nBushes & Plants:');
  for (let i = 1; i <= 3; i++) {
    savePNG(generateBush(i), path.join(OBJECTS_DIR, `bush_green_0${i}.png`));
  }
  for (let i = 1; i <= 2; i++) {
    savePNG(generateBush(i, true), path.join(OBJECTS_DIR, `bush_berry_0${i}.png`));
  }
  for (let i = 1; i <= 2; i++) {
    savePNG(generateBush(i, false, true), path.join(OBJECTS_DIR, `bush_flower_0${i}.png`));
  }
  for (let i = 1; i <= 2; i++) {
    savePNG(generateFern(i), path.join(OBJECTS_DIR, `fern_0${i}.png`));
  }
  for (let i = 1; i <= 3; i++) {
    savePNG(generateMushroom(i - 1), path.join(OBJECTS_DIR, `mushroom_0${i}.png`));
  }
  for (let i = 1; i <= 2; i++) {
    savePNG(generateReed(i), path.join(OBJECTS_DIR, `reed_0${i}.png`));
  }
  for (let i = 1; i <= 2; i++) {
    savePNG(generateCactus(i), path.join(OBJECTS_DIR, `cactus_0${i}.png`));
  }

  console.log('\nRocks:');
  for (let i = 1; i <= 3; i++) {
    savePNG(generateRock('small', i), path.join(OBJECTS_DIR, `rock_small_0${i}.png`));
  }
  for (let i = 1; i <= 2; i++) {
    savePNG(generateRock('large', i), path.join(OBJECTS_DIR, `rock_large_0${i}.png`));
  }
  for (let i = 1; i <= 2; i++) {
    savePNG(generateRock('small', i, true), path.join(OBJECTS_DIR, `rock_mossy_0${i}.png`));
  }

  console.log('\nResources:');
  savePNG(generateWoodStack(), path.join(RESOURCES_DIR, 'res_wood.png'));
  savePNG(generateFoodBasket(), path.join(RESOURCES_DIR, 'res_food.png'));
  savePNG(generateHerbBundle(), path.join(RESOURCES_DIR, 'res_herb.png'));
  savePNG(generateOre('iron'), path.join(RESOURCES_DIR, 'res_ore.png'));
  savePNG(generateOre('gold'), path.join(RESOURCES_DIR, 'res_gold.png'));
  savePNG(generateCrystalFormation(), path.join(RESOURCES_DIR, 'res_crystal.png'));
  savePNG(generateStonepile(), path.join(RESOURCES_DIR, 'res_stone.png'));
  savePNG(generateFiberBundle(), path.join(RESOURCES_DIR, 'res_fiber.png'));

  console.log('\nDecorations:');
  for (let i = 1; i <= 5; i++) {
    savePNG(generateGrassTuft(i), path.join(OBJECTS_DIR, `grass_tuft_0${i}.png`));
  }
  for (let i = 1; i <= 4; i++) {
    savePNG(generateFlowerPatch(i), path.join(OBJECTS_DIR, `flower_patch_0${i}.png`));
  }
  for (let i = 1; i <= 3; i++) {
    savePNG(generatePebbles(i), path.join(OBJECTS_DIR, `pebbles_0${i}.png`));
  }
  for (let i = 1; i <= 2; i++) {
    savePNG(generateFallenLog(i), path.join(OBJECTS_DIR, `fallen_log_0${i}.png`));
  }
  for (let i = 1; i <= 2; i++) {
    savePNG(generatePuddle(i), path.join(OBJECTS_DIR, `puddle_0${i}.png`));
  }
  for (let i = 1; i <= 2; i++) {
    savePNG(generateSignPost(i - 1), path.join(OBJECTS_DIR, `sign_post_0${i}.png`));
  }

  console.log('\nNew Tree Variants:');
  for (let i = 1; i <= 2; i++) {
    savePNG(generateAutumnOak(i), path.join(OBJECTS_DIR, `tree_oak_autumn_0${i}.png`));
  }
  for (let i = 1; i <= 2; i++) {
    savePNG(generateSnowPine(i), path.join(OBJECTS_DIR, `tree_pine_snow_0${i}.png`));
  }
  savePNG(generateWillowTree(1), path.join(OBJECTS_DIR, 'tree_willow_01.png'));
  savePNG(generateCherryTree(1), path.join(OBJECTS_DIR, 'tree_cherry_01.png'));
  savePNG(generateGiantTree(1), path.join(OBJECTS_DIR, 'tree_giant_01.png'));

  console.log('\nMinerals:');
  for (let i = 1; i <= 2; i++) {
    savePNG(generateOreObject('iron', i), path.join(OBJECTS_DIR, `ore_iron_0${i}.png`));
  }
  for (let i = 1; i <= 2; i++) {
    savePNG(generateOreObject('gold', i), path.join(OBJECTS_DIR, `ore_gold_0${i}.png`));
  }
  for (let i = 1; i <= 2; i++) {
    savePNG(generateCrystalObject(i), path.join(OBJECTS_DIR, `crystal_0${i}.png`));
  }

  console.log('\nAdditional Decorations:');
  savePNG(generateBush(3, false, true), path.join(OBJECTS_DIR, 'bush_flower_03.png'));
  for (let i = 1; i <= 2; i++) {
    savePNG(generateVine(i), path.join(OBJECTS_DIR, `vine_0${i}.png`));
  }
  for (let i = 1; i <= 2; i++) {
    savePNG(generateBones(i - 1), path.join(OBJECTS_DIR, `bones_0${i}.png`));
  }
  savePNG(generateMushroomRing(), path.join(OBJECTS_DIR, 'mushroom_ring_01.png'));
  savePNG(generateCampfireRemains(), path.join(OBJECTS_DIR, 'campfire_remains_01.png'));

  console.log('\n✅ All isometric object sprites generated!');
  console.log(`📁 Objects: ${OBJECTS_DIR}`);
  console.log(`📁 Resources: ${RESOURCES_DIR}`);
}

main();
