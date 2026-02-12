/**
 * generate-building-sprites.js
 *
 * Generates top-down pixel art building sprites for Botworld POIs.
 * Uses pngjs to draw procedural pixel art matching the Kenney Tiny Town aesthetic.
 * Each building has a unique size, color scheme, and architectural detail.
 *
 * Usage: node scripts/generate-building-sprites.js
 */

const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '../packages/client/public/assets/buildings');

// ── Kenney Tiny Town inspired color palette ──
const PAL = {
  // Woods
  wood_dark:    { r: 107, g: 74, b: 58 },
  wood_med:     { r: 138, g: 106, b: 74 },
  wood_light:   { r: 170, g: 136, b: 96 },
  wood_plank:   { r: 155, g: 120, b: 80 },
  // Stone
  stone_dark:   { r: 100, g: 100, b: 108 },
  stone_med:    { r: 130, g: 130, b: 138 },
  stone_light:  { r: 160, g: 160, b: 168 },
  stone_brick:  { r: 145, g: 140, b: 130 },
  // Roofs
  roof_red:     { r: 184, g: 92, b: 58 },
  roof_brown:   { r: 148, g: 100, b: 60 },
  roof_blue:    { r: 74, g: 90, b: 122 },
  roof_green:   { r: 80, g: 120, b: 70 },
  roof_dark:    { r: 90, g: 60, b: 40 },
  // Accents
  window_glow:  { r: 240, g: 200, b: 100 },
  window_frame: { r: 60, g: 45, b: 35 },
  window_blue:  { r: 100, g: 150, b: 200 },
  door_dark:    { r: 70, g: 50, b: 35 },
  door_med:     { r: 100, g: 70, b: 45 },
  // Environment
  grass:        { r: 90, g: 140, b: 50 },
  grass_dark:   { r: 70, g: 110, b: 40 },
  dirt:         { r: 150, g: 120, b: 80 },
  water:        { r: 70, g: 130, b: 180 },
  water_light:  { r: 120, g: 170, b: 210 },
  // Special
  gold:         { r: 220, g: 180, b: 50 },
  fire:         { r: 230, g: 140, b: 40 },
  shadow:       { r: 40, g: 35, b: 30 },
  white:        { r: 220, g: 220, b: 225 },
  black:        { r: 30, g: 25, b: 20 },
  moss:         { r: 60, g: 100, b: 45 },
  tent_red:     { r: 190, g: 60, b: 50 },
  tent_blue:    { r: 50, g: 80, b: 150 },
  tent_yellow:  { r: 210, g: 180, b: 50 },
  tent_green:   { r: 60, g: 130, b: 60 },
  iron:         { r: 100, g: 100, b: 110 },
  flag_red:     { r: 200, g: 50, b: 40 },
  flag_blue:    { r: 50, g: 70, b: 160 },
  stained1:     { r: 180, g: 60, b: 60 },
  stained2:     { r: 60, g: 60, b: 180 },
  stained3:     { r: 60, g: 180, b: 60 },
  rail:         { r: 80, g: 75, b: 70 },
  vine:         { r: 50, g: 90, b: 35 },
  rope:         { r: 160, g: 130, b: 80 },
};

// ── Drawing primitives ──

function createPNG(w, h) {
  const png = new PNG({ width: w, height: h });
  // Initialize transparent
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0;
    png.data[i + 1] = 0;
    png.data[i + 2] = 0;
    png.data[i + 3] = 0;
  }
  return png;
}

function setPixel(png, x, y, color, alpha = 255) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || x >= png.width || y < 0 || y >= png.height) return;
  const idx = (y * png.width + x) * 4;
  if (alpha < 255 && png.data[idx + 3] > 0) {
    // Alpha blend
    const a = alpha / 255;
    const ia = 1 - a;
    png.data[idx]     = Math.round(color.r * a + png.data[idx] * ia);
    png.data[idx + 1] = Math.round(color.g * a + png.data[idx + 1] * ia);
    png.data[idx + 2] = Math.round(color.b * a + png.data[idx + 2] * ia);
    png.data[idx + 3] = Math.min(255, png.data[idx + 3] + alpha);
  } else {
    png.data[idx]     = color.r;
    png.data[idx + 1] = color.g;
    png.data[idx + 2] = color.b;
    png.data[idx + 3] = alpha;
  }
}

function fillRect(png, x, y, w, h, color, alpha = 255) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      setPixel(png, x + dx, y + dy, color, alpha);
    }
  }
}

function fillEllipse(png, cx, cy, rx, ry, color, alpha = 255) {
  for (let dy = -ry; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) {
        setPixel(png, cx + dx, cy + dy, color, alpha);
      }
    }
  }
}

function drawLine(png, x0, y0, x1, y1, color, alpha = 255) {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (true) {
    setPixel(png, x0, y0, color, alpha);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx)  { err += dx; y0 += sy; }
  }
}

function strokeRect(png, x, y, w, h, color, alpha = 255) {
  for (let dx = 0; dx < w; dx++) {
    setPixel(png, x + dx, y, color, alpha);
    setPixel(png, x + dx, y + h - 1, color, alpha);
  }
  for (let dy = 0; dy < h; dy++) {
    setPixel(png, x, y + dy, color, alpha);
    setPixel(png, x + w - 1, y + dy, color, alpha);
  }
}

/** Darken a color by a factor (0-1) */
function darken(color, factor) {
  return {
    r: Math.round(color.r * (1 - factor)),
    g: Math.round(color.g * (1 - factor)),
    b: Math.round(color.b * (1 - factor)),
  };
}

/** Lighten a color by a factor (0-1) */
function lighten(color, factor) {
  return {
    r: Math.min(255, Math.round(color.r + (255 - color.r) * factor)),
    g: Math.min(255, Math.round(color.g + (255 - color.g) * factor)),
    b: Math.min(255, Math.round(color.b + (255 - color.b) * factor)),
  };
}

/** Add bottom shadow to a building shape */
function addShadow(png, x, y, w, h) {
  // South shadow (right-bottom)
  for (let dx = 2; dx < w + 3; dx++) {
    for (let dy = 0; dy < 3; dy++) {
      setPixel(png, x + dx, y + h + dy, PAL.shadow, 60 - dy * 20);
    }
  }
  // East shadow
  for (let dy = 2; dy < h + 2; dy++) {
    for (let dx = 0; dx < 2; dx++) {
      setPixel(png, x + w + dx, y + dy, PAL.shadow, 50 - dx * 20);
    }
  }
}

/** Draw a top-down window (small bright square) */
function drawWindow(png, x, y, glowing = true) {
  fillRect(png, x, y, 4, 4, PAL.window_frame);
  if (glowing) {
    fillRect(png, x + 1, y + 1, 2, 2, PAL.window_glow);
  } else {
    fillRect(png, x + 1, y + 1, 2, 2, PAL.window_blue);
  }
}

/** Draw a top-down door */
function drawDoor(png, x, y) {
  fillRect(png, x, y, 6, 8, PAL.door_dark);
  fillRect(png, x + 1, y + 1, 4, 6, PAL.door_med);
  setPixel(png, x + 4, y + 4, PAL.gold); // doorknob
}

// ── Building generators ──

function generateTavern() {
  // 96x64 (3x2 tiles)
  const png = createPNG(96, 64);

  // Main building body (wood)
  fillRect(png, 8, 10, 56, 40, PAL.wood_med);
  fillRect(png, 9, 11, 54, 38, PAL.wood_light);
  // Plank lines
  for (let dy = 0; dy < 38; dy += 6) {
    fillRect(png, 9, 11 + dy, 54, 1, PAL.wood_dark, 80);
  }

  // Roof (red, top-down view = darker band at top)
  fillRect(png, 5, 4, 64, 10, PAL.roof_red);
  fillRect(png, 5, 4, 64, 2, lighten(PAL.roof_red, 0.2));
  fillRect(png, 5, 12, 64, 2, darken(PAL.roof_red, 0.15));

  // Windows (warm glow)
  drawWindow(png, 14, 22, true);
  drawWindow(png, 28, 22, true);
  drawWindow(png, 42, 22, true);
  drawWindow(png, 52, 22, true);

  // Door
  drawDoor(png, 34, 40);

  // Sign hanging from front
  fillRect(png, 72, 16, 2, 12, PAL.wood_dark);
  fillRect(png, 68, 28, 10, 8, PAL.wood_plank);
  strokeRect(png, 68, 28, 10, 8, PAL.wood_dark);

  // Terrace (wooden deck extension on left)
  fillRect(png, 8, 50, 30, 10, PAL.wood_plank);
  strokeRect(png, 8, 50, 30, 10, PAL.wood_dark, 120);
  // Terrace railing posts
  for (let dx = 0; dx < 30; dx += 8) {
    setPixel(png, 8 + dx, 50, PAL.wood_dark);
    setPixel(png, 8 + dx, 59, PAL.wood_dark);
  }

  // Chimney
  fillRect(png, 55, 2, 6, 6, PAL.stone_med);
  fillRect(png, 55, 2, 6, 2, darken(PAL.stone_med, 0.1));
  // Smoke
  setPixel(png, 57, 0, PAL.white, 100);
  setPixel(png, 58, 1, PAL.white, 60);

  addShadow(png, 5, 4, 64, 46);

  return png;
}

function generateMarketplace() {
  // 128x96 (4x3 tiles)
  const png = createPNG(128, 96);

  // Ground area (dirt plaza)
  fillRect(png, 4, 10, 120, 80, PAL.dirt);
  fillRect(png, 4, 10, 120, 80, lighten(PAL.dirt, 0.05));

  // Stall 1 (red tent)
  fillRect(png, 8, 14, 28, 24, PAL.tent_red);
  fillRect(png, 8, 14, 28, 4, lighten(PAL.tent_red, 0.2));
  fillRect(png, 8, 34, 28, 4, darken(PAL.tent_red, 0.15));
  // Support pole
  setPixel(png, 22, 26, PAL.wood_dark);
  // Goods
  fillRect(png, 12, 22, 4, 4, PAL.gold, 200);
  fillRect(png, 20, 24, 4, 3, PAL.wood_plank, 200);
  fillRect(png, 28, 22, 3, 3, PAL.tent_green, 200);

  // Stall 2 (blue tent)
  fillRect(png, 48, 14, 30, 24, PAL.tent_blue);
  fillRect(png, 48, 14, 30, 4, lighten(PAL.tent_blue, 0.2));
  fillRect(png, 48, 34, 30, 4, darken(PAL.tent_blue, 0.15));
  setPixel(png, 63, 26, PAL.wood_dark);
  fillRect(png, 52, 22, 3, 3, PAL.iron, 200);
  fillRect(png, 58, 24, 5, 3, PAL.wood_med, 200);
  fillRect(png, 68, 22, 3, 4, PAL.stained1, 200);

  // Stall 3 (yellow tent)
  fillRect(png, 90, 14, 28, 24, PAL.tent_yellow);
  fillRect(png, 90, 14, 28, 4, lighten(PAL.tent_yellow, 0.2));
  fillRect(png, 90, 34, 28, 4, darken(PAL.tent_yellow, 0.15));
  setPixel(png, 104, 26, PAL.wood_dark);
  fillRect(png, 94, 24, 4, 3, PAL.roof_green, 200);
  fillRect(png, 102, 22, 3, 4, PAL.fire, 200);
  fillRect(png, 110, 24, 4, 3, PAL.gold, 200);

  // Stall 4 (green tent, bottom row)
  fillRect(png, 20, 50, 32, 24, PAL.tent_green);
  fillRect(png, 20, 50, 32, 4, lighten(PAL.tent_green, 0.2));
  fillRect(png, 20, 70, 32, 4, darken(PAL.tent_green, 0.15));
  setPixel(png, 36, 62, PAL.wood_dark);
  fillRect(png, 24, 58, 5, 4, PAL.wood_med, 200);
  fillRect(png, 34, 60, 4, 3, PAL.tent_red, 200);
  fillRect(png, 42, 58, 3, 4, PAL.water_light, 200);

  // Center well / barrel area
  fillRect(png, 68, 56, 10, 10, PAL.stone_med);
  strokeRect(png, 68, 56, 10, 10, PAL.stone_dark);
  fillEllipse(png, 73, 61, 3, 3, PAL.water, 180);

  // Barrels and crates
  fillEllipse(png, 92, 62, 4, 4, PAL.wood_dark);
  fillEllipse(png, 92, 62, 3, 3, PAL.wood_med);
  fillRect(png, 100, 56, 8, 8, PAL.wood_plank);
  strokeRect(png, 100, 56, 8, 8, PAL.wood_dark, 160);

  // Path markings
  for (let dx = 0; dx < 120; dx += 12) {
    setPixel(png, 4 + dx, 46, darken(PAL.dirt, 0.1), 80);
    setPixel(png, 4 + dx + 1, 46, darken(PAL.dirt, 0.1), 80);
  }

  addShadow(png, 4, 10, 120, 80);

  return png;
}

function generateBlacksmith() {
  // 64x64 (2x2 tiles)
  const png = createPNG(64, 64);

  // Stone building
  fillRect(png, 8, 12, 40, 36, PAL.stone_brick);
  fillRect(png, 9, 13, 38, 34, PAL.stone_med);
  // Stone brick pattern
  for (let dy = 0; dy < 34; dy += 6) {
    fillRect(png, 9, 13 + dy, 38, 1, PAL.stone_dark, 60);
    for (let dx = (dy % 12 === 0 ? 0 : 8); dx < 38; dx += 16) {
      setPixel(png, 9 + dx, 13 + dy + 3, PAL.stone_dark, 60);
      if (dy + 3 < 34) fillRect(png, 9 + dx, 13 + dy + 3, 1, 3, PAL.stone_dark, 40);
    }
  }

  // Roof
  fillRect(png, 5, 6, 48, 10, PAL.stone_dark);
  fillRect(png, 5, 6, 48, 2, PAL.stone_light);

  // Big chimney with smoke
  fillRect(png, 36, 0, 10, 12, PAL.stone_dark);
  fillRect(png, 37, 1, 8, 10, darken(PAL.stone_dark, 0.1));
  // Smoke particles
  setPixel(png, 40, 0, PAL.white, 120);
  setPixel(png, 41, 0, PAL.white, 80);
  setPixel(png, 39, 0, PAL.white, 60);

  // Forge glow (through chimney)
  fillRect(png, 38, 8, 6, 3, PAL.fire, 140);

  // Anvil (outside, on the right)
  fillRect(png, 50, 34, 8, 4, PAL.iron);
  fillRect(png, 52, 32, 4, 2, PAL.iron);
  fillRect(png, 49, 38, 10, 2, darken(PAL.iron, 0.2));

  // Window
  drawWindow(png, 16, 24, true);

  // Door
  fillRect(png, 24, 36, 6, 10, PAL.door_dark);
  fillRect(png, 25, 37, 4, 8, PAL.door_med);
  setPixel(png, 28, 41, PAL.gold);

  // Weapon rack (left side)
  fillRect(png, 4, 28, 2, 16, PAL.wood_dark);
  setPixel(png, 3, 30, PAL.iron);
  setPixel(png, 3, 34, PAL.iron);
  setPixel(png, 3, 38, PAL.iron);

  addShadow(png, 5, 6, 48, 42);

  return png;
}

function generateLibrary() {
  // 96x96 (3x3 tiles)
  const png = createPNG(96, 96);

  // Large stone building
  fillRect(png, 10, 20, 68, 60, PAL.stone_med);
  fillRect(png, 11, 21, 66, 58, PAL.stone_light);
  // Brick pattern
  for (let dy = 0; dy < 58; dy += 8) {
    fillRect(png, 11, 21 + dy, 66, 1, PAL.stone_dark, 50);
  }

  // Dome roof (ellipse at top)
  fillEllipse(png, 44, 18, 38, 16, PAL.roof_blue);
  fillEllipse(png, 44, 14, 34, 12, lighten(PAL.roof_blue, 0.15));
  // Dome highlight
  fillEllipse(png, 38, 12, 10, 4, lighten(PAL.roof_blue, 0.3), 120);

  // Columns (front, bottom)
  for (let dx = 0; dx < 4; dx++) {
    const cx = 16 + dx * 18;
    fillRect(png, cx, 62, 4, 18, PAL.stone_light);
    fillRect(png, cx - 1, 62, 6, 2, PAL.stone_med);
    fillRect(png, cx - 1, 78, 6, 2, PAL.stone_med);
  }

  // Stained glass windows
  fillRect(png, 18, 30, 8, 12, PAL.window_frame);
  fillRect(png, 19, 31, 6, 10, PAL.stained1);
  fillRect(png, 19, 31, 3, 10, PAL.stained2);
  fillRect(png, 19, 36, 6, 1, PAL.window_frame);

  fillRect(png, 38, 30, 8, 12, PAL.window_frame);
  fillRect(png, 39, 31, 6, 10, PAL.stained3);
  fillRect(png, 39, 31, 3, 10, PAL.stained1);
  fillRect(png, 39, 36, 6, 1, PAL.window_frame);

  fillRect(png, 58, 30, 8, 12, PAL.window_frame);
  fillRect(png, 59, 31, 6, 10, PAL.stained2);
  fillRect(png, 59, 31, 3, 10, PAL.stained3);
  fillRect(png, 59, 36, 6, 1, PAL.window_frame);

  // Main entrance
  fillRect(png, 36, 68, 12, 12, PAL.door_dark);
  fillRect(png, 37, 69, 10, 10, PAL.door_med);
  fillRect(png, 42, 69, 1, 10, PAL.door_dark); // double door split
  setPixel(png, 40, 74, PAL.gold);
  setPixel(png, 44, 74, PAL.gold);

  // Steps
  fillRect(png, 32, 80, 20, 4, PAL.stone_med);
  fillRect(png, 30, 84, 24, 3, PAL.stone_light);
  fillRect(png, 28, 87, 28, 3, lighten(PAL.stone_light, 0.1));

  // Small dome ornament on top
  fillEllipse(png, 44, 4, 4, 4, PAL.gold, 200);

  addShadow(png, 10, 6, 68, 74);

  return png;
}

function generateTemple() {
  // 96x64 (3x2 tiles)
  const png = createPNG(96, 64);

  // Main stone body
  fillRect(png, 12, 14, 60, 34, PAL.stone_light);
  fillRect(png, 13, 15, 58, 32, lighten(PAL.stone_light, 0.1));

  // Roof/peak
  fillRect(png, 8, 6, 70, 12, PAL.white);
  fillRect(png, 8, 6, 70, 3, lighten(PAL.white, 0.1));
  fillRect(png, 8, 15, 70, 2, darken(PAL.white, 0.1));

  // Central spire
  fillRect(png, 38, 0, 10, 10, PAL.stone_light);
  fillRect(png, 40, 0, 6, 3, PAL.gold);
  setPixel(png, 43, 0, lighten(PAL.gold, 0.3));

  // Side spires
  fillRect(png, 14, 4, 6, 8, PAL.stone_med);
  fillRect(png, 15, 2, 4, 4, PAL.stone_light);
  fillRect(png, 66, 4, 6, 8, PAL.stone_med);
  fillRect(png, 67, 2, 4, 4, PAL.stone_light);

  // Columns
  for (let dx = 0; dx < 3; dx++) {
    const cx = 20 + dx * 16;
    fillRect(png, cx, 30, 3, 16, PAL.stone_light);
    fillRect(png, cx - 1, 30, 5, 2, PAL.stone_med);
    fillRect(png, cx - 1, 44, 5, 2, PAL.stone_med);
  }

  // Entrance with stairs
  fillRect(png, 36, 38, 10, 10, PAL.door_dark);
  fillRect(png, 37, 39, 8, 8, darken(PAL.door_dark, 0.2));
  // Steps
  fillRect(png, 30, 48, 24, 4, PAL.stone_med);
  fillRect(png, 28, 52, 28, 4, PAL.stone_light);
  fillRect(png, 26, 56, 32, 4, lighten(PAL.stone_light, 0.1));

  // Stained glass (center)
  fillRect(png, 38, 20, 8, 10, PAL.window_frame);
  fillRect(png, 39, 21, 6, 8, PAL.stained1);
  fillRect(png, 42, 21, 3, 8, PAL.gold, 150);

  addShadow(png, 8, 2, 70, 54);

  return png;
}

function generateFarm() {
  // 128x96 (4x3 tiles)
  const png = createPNG(128, 96);

  // Fields (crops in rows)
  fillRect(png, 4, 40, 120, 52, darken(PAL.dirt, 0.05));
  // Crop rows
  for (let row = 0; row < 5; row++) {
    const y = 46 + row * 10;
    for (let col = 0; col < 14; col++) {
      const x = 8 + col * 8;
      const isGreen = (row + col) % 3 !== 0;
      if (isGreen) {
        fillRect(png, x, y, 4, 6, PAL.grass);
        setPixel(png, x + 1, y - 1, PAL.grass_dark, 180);
        setPixel(png, x + 2, y, lighten(PAL.grass, 0.2), 180);
      } else {
        fillRect(png, x, y + 1, 4, 4, PAL.gold, 180);
        setPixel(png, x + 1, y, darken(PAL.gold, 0.2), 180);
      }
    }
  }

  // Farmhouse (top-left)
  fillRect(png, 8, 8, 40, 28, PAL.wood_light);
  fillRect(png, 9, 9, 38, 26, PAL.wood_plank);
  // Plank lines
  for (let dy = 0; dy < 26; dy += 5) {
    fillRect(png, 9, 9 + dy, 38, 1, PAL.wood_dark, 60);
  }
  // Farmhouse roof
  fillRect(png, 4, 2, 48, 10, PAL.roof_brown);
  fillRect(png, 4, 2, 48, 2, lighten(PAL.roof_brown, 0.2));

  // Farmhouse window + door
  drawWindow(png, 16, 18, true);
  drawWindow(png, 30, 18, true);
  fillRect(png, 22, 26, 6, 8, PAL.door_dark);
  fillRect(png, 23, 27, 4, 6, PAL.door_med);

  // Fence around fields
  for (let dx = 0; dx < 120; dx += 4) {
    setPixel(png, 4 + dx, 40, PAL.wood_dark);
    setPixel(png, 4 + dx, 92, PAL.wood_dark);
  }
  for (let dy = 0; dy < 52; dy += 4) {
    setPixel(png, 4, 40 + dy, PAL.wood_dark);
    setPixel(png, 123, 40 + dy, PAL.wood_dark);
  }
  // Fence posts
  for (let dx = 0; dx < 120; dx += 16) {
    fillRect(png, 4 + dx, 38, 2, 4, PAL.wood_dark);
    fillRect(png, 4 + dx, 91, 2, 4, PAL.wood_dark);
  }

  // Hay bale near house
  fillEllipse(png, 60, 14, 6, 5, PAL.gold);
  fillEllipse(png, 60, 14, 5, 4, lighten(PAL.gold, 0.15));

  // Scarecrow
  fillRect(png, 80, 10, 2, 14, PAL.wood_dark);
  fillRect(png, 74, 14, 14, 2, PAL.wood_dark);
  fillEllipse(png, 81, 8, 3, 3, PAL.dirt);

  addShadow(png, 4, 2, 120, 92);

  return png;
}

function generateMineEntrance() {
  // 64x64 (2x2 tiles)
  const png = createPNG(64, 64);

  // Mountain/rock face
  fillRect(png, 4, 4, 56, 36, PAL.stone_dark);
  fillRect(png, 6, 6, 52, 32, PAL.stone_med);
  // Rock texture
  for (let i = 0; i < 12; i++) {
    const rx = 8 + (i * 17 + i * i * 7) % 46;
    const ry = 8 + (i * 13 + i * i * 3) % 26;
    fillRect(png, rx, ry, 3, 2, PAL.stone_dark, 80);
  }

  // Cave entrance (dark arch)
  fillEllipse(png, 30, 26, 14, 12, PAL.black);
  fillRect(png, 16, 26, 28, 14, PAL.black);
  // Arch frame (stone)
  for (let angle = 0; angle < Math.PI; angle += 0.15) {
    const x = 30 - Math.cos(angle) * 15;
    const y = 26 - Math.sin(angle) * 13;
    setPixel(png, Math.round(x), Math.round(y), PAL.stone_light);
  }
  // Support beams
  fillRect(png, 16, 18, 2, 22, PAL.wood_dark);
  fillRect(png, 42, 18, 2, 22, PAL.wood_dark);
  fillRect(png, 16, 16, 30, 3, PAL.wood_dark);

  // Rails coming out
  fillRect(png, 22, 40, 2, 20, PAL.rail);
  fillRect(png, 36, 40, 2, 20, PAL.rail);
  // Rail ties
  for (let dy = 0; dy < 18; dy += 4) {
    fillRect(png, 20, 42 + dy, 20, 2, PAL.wood_dark, 120);
  }

  // Mine cart (small)
  fillRect(png, 24, 44, 12, 8, PAL.iron);
  fillRect(png, 25, 45, 10, 6, darken(PAL.iron, 0.15));
  // Ore in cart
  fillRect(png, 26, 43, 4, 3, PAL.stone_light, 200);
  fillRect(png, 31, 44, 3, 2, PAL.gold, 200);

  // Lantern
  setPixel(png, 14, 20, PAL.fire, 200);
  setPixel(png, 13, 20, PAL.window_glow, 120);

  addShadow(png, 4, 4, 56, 56);

  return png;
}

function generateInn() {
  // 96x64 (3x2 tiles)
  const png = createPNG(96, 64);

  // 2-story building
  fillRect(png, 10, 8, 56, 44, PAL.wood_med);
  fillRect(png, 11, 9, 54, 42, PAL.wood_light);
  // Plank lines (horizontal siding)
  for (let dy = 0; dy < 42; dy += 5) {
    fillRect(png, 11, 9 + dy, 54, 1, PAL.wood_dark, 60);
  }

  // Floor separator (between stories)
  fillRect(png, 10, 28, 56, 2, PAL.wood_dark, 120);

  // Warm roof
  fillRect(png, 6, 2, 64, 10, PAL.roof_red);
  fillRect(png, 6, 2, 64, 2, lighten(PAL.roof_red, 0.2));
  fillRect(png, 6, 10, 64, 2, darken(PAL.roof_red, 0.1));

  // 2nd floor windows
  drawWindow(png, 16, 14, true);
  drawWindow(png, 30, 14, true);
  drawWindow(png, 44, 14, true);

  // 1st floor windows
  drawWindow(png, 16, 34, true);
  drawWindow(png, 44, 34, true);

  // Main door
  drawDoor(png, 30, 40);

  // Sign (hanging)
  fillRect(png, 68, 12, 2, 10, PAL.wood_dark);
  fillRect(png, 64, 22, 10, 8, PAL.wood_plank);
  strokeRect(png, 64, 22, 10, 8, PAL.wood_dark, 160);
  // Moon/star on sign
  setPixel(png, 68, 25, PAL.gold);
  setPixel(png, 67, 26, PAL.gold);

  // Small garden (bottom right)
  fillRect(png, 70, 44, 18, 14, PAL.grass_dark);
  // Flowers in garden
  setPixel(png, 74, 48, PAL.tent_red, 200);
  setPixel(png, 78, 50, PAL.tent_yellow, 200);
  setPixel(png, 82, 47, PAL.tent_blue, 200);
  setPixel(png, 76, 52, PAL.stained3, 200);
  // Garden border
  strokeRect(png, 70, 44, 18, 14, PAL.wood_dark, 100);

  // Chimney
  fillRect(png, 52, 0, 6, 5, PAL.stone_med);
  setPixel(png, 54, 0, PAL.white, 80);

  addShadow(png, 6, 2, 64, 52);

  return png;
}

function generateWatchtower() {
  // 64x64 (2x2 tiles)
  const png = createPNG(64, 64);

  // Tower base (circular top-down view)
  fillEllipse(png, 32, 34, 18, 18, PAL.stone_dark);
  fillEllipse(png, 32, 34, 16, 16, PAL.stone_med);
  fillEllipse(png, 32, 34, 14, 14, PAL.stone_light);

  // Tower inner ring (wall thickness)
  fillEllipse(png, 32, 34, 11, 11, PAL.stone_dark, 120);
  fillEllipse(png, 32, 34, 9, 9, darken(PAL.stone_med, 0.2));

  // Conical roof (top-down looks like circles)
  fillEllipse(png, 32, 30, 20, 20, PAL.roof_brown);
  fillEllipse(png, 32, 30, 18, 18, lighten(PAL.roof_brown, 0.1));
  // Roof highlight (shows cone shape)
  fillEllipse(png, 28, 26, 6, 6, lighten(PAL.roof_brown, 0.25), 150);
  // Center point
  fillEllipse(png, 32, 30, 3, 3, darken(PAL.roof_brown, 0.15));

  // Battlements (crenellations around edge)
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
    const bx = 32 + Math.cos(angle) * 22;
    const by = 34 + Math.sin(angle) * 22;
    fillRect(png, Math.round(bx) - 2, Math.round(by) - 2, 4, 4, PAL.stone_light);
    strokeRect(png, Math.round(bx) - 2, Math.round(by) - 2, 4, 4, PAL.stone_dark, 120);
  }

  // Flag on top
  fillRect(png, 32, 6, 2, 20, PAL.wood_dark);
  fillRect(png, 34, 6, 10, 6, PAL.flag_red);
  fillRect(png, 34, 6, 10, 2, lighten(PAL.flag_red, 0.2));
  // Flag wave
  setPixel(png, 43, 8, lighten(PAL.flag_red, 0.1));

  addShadow(png, 12, 14, 40, 42);

  return png;
}

function generateGuildHall() {
  // 96x96 (3x3 tiles)
  const png = createPNG(96, 96);

  // Large wooden building
  fillRect(png, 8, 16, 72, 60, PAL.wood_med);
  fillRect(png, 9, 17, 70, 58, PAL.wood_light);
  // Plank pattern
  for (let dy = 0; dy < 58; dy += 6) {
    fillRect(png, 9, 17 + dy, 70, 1, PAL.wood_dark, 70);
  }
  // Vertical beam accents
  fillRect(png, 9, 17, 2, 58, PAL.wood_dark, 100);
  fillRect(png, 44, 17, 2, 58, PAL.wood_dark, 100);
  fillRect(png, 77, 17, 2, 58, PAL.wood_dark, 100);

  // Grand roof
  fillRect(png, 4, 8, 80, 12, PAL.roof_brown);
  fillRect(png, 4, 8, 80, 3, lighten(PAL.roof_brown, 0.2));
  fillRect(png, 4, 17, 80, 2, darken(PAL.roof_brown, 0.15));
  // Roof ridge
  fillRect(png, 24, 6, 40, 4, darken(PAL.roof_brown, 0.1));

  // Multiple windows (2 rows)
  for (let row = 0; row < 2; row++) {
    const wy = 26 + row * 22;
    drawWindow(png, 16, wy, true);
    drawWindow(png, 30, wy, true);
    drawWindow(png, 52, wy, true);
    drawWindow(png, 66, wy, true);
  }

  // Grand double doors
  fillRect(png, 36, 60, 16, 16, PAL.door_dark);
  fillRect(png, 37, 61, 14, 14, PAL.door_med);
  fillRect(png, 44, 61, 1, 14, PAL.door_dark);
  setPixel(png, 42, 68, PAL.gold);
  setPixel(png, 46, 68, PAL.gold);

  // Guild emblem (above door)
  fillEllipse(png, 44, 54, 5, 5, PAL.gold);
  fillEllipse(png, 44, 54, 3, 3, PAL.roof_brown);

  // Flags on roof
  fillRect(png, 14, 0, 2, 10, PAL.wood_dark);
  fillRect(png, 16, 0, 8, 5, PAL.flag_red);
  fillRect(png, 16, 0, 8, 2, lighten(PAL.flag_red, 0.2));

  fillRect(png, 70, 0, 2, 10, PAL.wood_dark);
  fillRect(png, 72, 0, 8, 5, PAL.flag_blue);
  fillRect(png, 72, 0, 8, 2, lighten(PAL.flag_blue, 0.2));

  // Stone plaza in front
  fillRect(png, 20, 76, 48, 14, PAL.stone_light, 120);

  addShadow(png, 4, 6, 80, 70);

  return png;
}

function generateFountain() {
  // 64x64 (2x2 tiles)
  const png = createPNG(64, 64);

  // Stone floor (circular plaza)
  fillEllipse(png, 32, 32, 28, 28, PAL.stone_light, 160);

  // Outer basin ring
  fillEllipse(png, 32, 32, 22, 22, PAL.stone_med);
  fillEllipse(png, 32, 32, 20, 20, PAL.stone_light);
  // Water pool
  fillEllipse(png, 32, 32, 18, 18, PAL.water);
  fillEllipse(png, 32, 32, 16, 16, PAL.water_light);
  // Water ripples
  for (let ring = 4; ring <= 14; ring += 5) {
    for (let angle = 0; angle < Math.PI * 2; angle += 0.3) {
      const rx = 32 + Math.cos(angle) * ring;
      const ry = 32 + Math.sin(angle) * ring;
      setPixel(png, Math.round(rx), Math.round(ry), PAL.white, 60);
    }
  }

  // Center pedestal
  fillEllipse(png, 32, 32, 6, 6, PAL.stone_dark);
  fillEllipse(png, 32, 32, 4, 4, PAL.stone_med);

  // Water jet (top-down, spray pattern)
  fillEllipse(png, 32, 32, 2, 2, PAL.water_light);
  setPixel(png, 32, 28, PAL.white, 180);
  setPixel(png, 30, 30, PAL.white, 120);
  setPixel(png, 34, 30, PAL.white, 120);
  setPixel(png, 32, 34, PAL.white, 100);
  setPixel(png, 28, 32, PAL.white, 100);
  setPixel(png, 36, 32, PAL.white, 100);

  // Coins at bottom of basin
  setPixel(png, 25, 36, PAL.gold, 160);
  setPixel(png, 38, 30, PAL.gold, 140);
  setPixel(png, 28, 40, PAL.gold, 120);
  setPixel(png, 35, 38, PAL.gold, 150);
  setPixel(png, 22, 32, PAL.gold, 100);

  // Basin rim detail
  for (let angle = 0; angle < Math.PI * 2; angle += 0.25) {
    const rx = 32 + Math.cos(angle) * 20;
    const ry = 32 + Math.sin(angle) * 20;
    setPixel(png, Math.round(rx), Math.round(ry), PAL.stone_dark, 120);
  }

  addShadow(png, 10, 10, 44, 44);

  return png;
}

function generateRuins() {
  // 96x64 (3x2 tiles)
  const png = createPNG(96, 64);

  // Rubble/ground
  fillRect(png, 8, 20, 76, 38, darken(PAL.dirt, 0.1), 120);

  // Broken wall segments (irregular heights)
  // Left wall section (tall)
  fillRect(png, 10, 8, 16, 40, PAL.stone_med);
  fillRect(png, 11, 9, 14, 38, PAL.stone_light);
  // Broken top edge
  fillRect(png, 10, 8, 8, 4, PAL.stone_med);
  fillRect(png, 18, 12, 6, 4, PAL.stone_med); // lower broken edge

  // Center wall segment (medium)
  fillRect(png, 34, 14, 20, 30, PAL.stone_med);
  fillRect(png, 35, 15, 18, 28, PAL.stone_light);
  // Broken arch
  fillRect(png, 38, 30, 12, 14, PAL.black, 120);
  for (let angle = 0; angle < Math.PI; angle += 0.2) {
    const ax = 44 - Math.cos(angle) * 7;
    const ay = 30 - Math.sin(angle) * 5;
    setPixel(png, Math.round(ax), Math.round(ay), PAL.stone_dark);
  }

  // Right wall (short, crumbling)
  fillRect(png, 62, 20, 14, 24, PAL.stone_med);
  fillRect(png, 63, 21, 12, 22, PAL.stone_light);
  fillRect(png, 68, 18, 8, 6, PAL.stone_med); // higher section

  // Moss and vines
  setPixel(png, 12, 38, PAL.moss, 200);
  setPixel(png, 14, 40, PAL.moss, 180);
  setPixel(png, 13, 42, PAL.moss, 160);
  fillRect(png, 36, 40, 3, 4, PAL.moss, 150);
  setPixel(png, 64, 36, PAL.moss, 180);
  setPixel(png, 66, 38, PAL.moss, 160);

  // Vine tendrils
  for (let dy = 0; dy < 8; dy++) {
    setPixel(png, 26 + (dy % 2), 14 + dy, PAL.vine, 180);
  }
  for (let dy = 0; dy < 6; dy++) {
    setPixel(png, 76 + (dy % 2), 22 + dy, PAL.vine, 160);
  }

  // Scattered rubble blocks
  fillRect(png, 28, 46, 4, 3, PAL.stone_dark, 180);
  fillRect(png, 56, 42, 3, 3, PAL.stone_med, 180);
  fillRect(png, 48, 50, 5, 3, PAL.stone_dark, 160);
  fillRect(png, 18, 52, 3, 4, PAL.stone_med, 160);
  fillRect(png, 72, 48, 4, 3, PAL.stone_dark, 150);

  // Brick pattern on standing walls
  for (const wall of [[10, 8, 16, 40], [34, 14, 20, 30], [62, 20, 14, 24]]) {
    const [wx, wy, ww, wh] = wall;
    for (let dy = 0; dy < wh; dy += 6) {
      fillRect(png, wx + 1, wy + dy, ww - 2, 1, PAL.stone_dark, 40);
    }
  }

  addShadow(png, 8, 8, 70, 48);

  return png;
}

function generatePort() {
  // 128x64 (4x2 tiles)
  const png = createPNG(128, 64);

  // Water area (bottom half)
  fillRect(png, 0, 32, 128, 32, PAL.water);
  fillRect(png, 0, 36, 128, 28, PAL.water_light, 120);
  // Water ripples
  for (let dx = 0; dx < 128; dx += 8) {
    for (let dy = 0; dy < 28; dy += 6) {
      setPixel(png, dx + (dy % 2) * 3, 36 + dy, PAL.white, 50);
      setPixel(png, dx + 1 + (dy % 2) * 3, 36 + dy, PAL.white, 40);
    }
  }

  // Dock/pier (wood planks)
  fillRect(png, 4, 18, 120, 18, PAL.wood_dark);
  fillRect(png, 5, 19, 118, 16, PAL.wood_plank);
  // Plank lines
  for (let dx = 0; dx < 118; dx += 8) {
    fillRect(png, 5 + dx, 19, 1, 16, PAL.wood_dark, 80);
  }

  // Dock supports (pilings in water)
  for (let dx = 0; dx < 4; dx++) {
    const px = 20 + dx * 30;
    fillRect(png, px, 34, 4, 8, PAL.wood_dark);
    fillRect(png, px + 1, 35, 2, 6, PAL.wood_med);
  }

  // Boat 1 (small rowboat)
  fillEllipse(png, 30, 48, 10, 5, PAL.wood_dark);
  fillEllipse(png, 30, 48, 8, 4, PAL.wood_med);
  fillRect(png, 29, 44, 2, 8, PAL.wood_dark); // mast

  // Boat 2 (larger)
  fillEllipse(png, 80, 50, 14, 6, PAL.wood_dark);
  fillEllipse(png, 80, 50, 12, 5, PAL.wood_plank);
  fillRect(png, 79, 42, 2, 10, PAL.wood_dark); // mast
  fillRect(png, 81, 42, 6, 4, PAL.white, 180); // sail

  // Crates and barrels on dock
  fillRect(png, 10, 20, 8, 8, PAL.wood_plank);
  strokeRect(png, 10, 20, 8, 8, PAL.wood_dark, 160);
  fillRect(png, 20, 22, 6, 6, PAL.wood_plank);
  strokeRect(png, 20, 22, 6, 6, PAL.wood_dark, 140);

  // Barrel
  fillEllipse(png, 100, 25, 5, 5, PAL.wood_dark);
  fillEllipse(png, 100, 25, 4, 4, PAL.wood_med);
  fillRect(png, 96, 25, 8, 1, PAL.iron, 160);

  // Rope coil
  fillEllipse(png, 112, 24, 4, 4, PAL.rope);
  fillEllipse(png, 112, 24, 2, 2, darken(PAL.rope, 0.2));

  // Rope from boat to dock
  drawLine(png, 38, 46, 45, 34, PAL.rope, 140);

  // Shoreline
  fillRect(png, 0, 14, 128, 6, PAL.dirt);
  fillRect(png, 0, 14, 128, 2, lighten(PAL.dirt, 0.15));

  addShadow(png, 4, 18, 120, 18);

  return png;
}

function generateFishingHut() {
  // 64x64 (2x2 tiles) - bonus building already in the pack
  const png = createPNG(64, 64);

  // Small wooden hut
  fillRect(png, 12, 16, 32, 28, PAL.wood_med);
  fillRect(png, 13, 17, 30, 26, PAL.wood_light);
  for (let dy = 0; dy < 26; dy += 5) {
    fillRect(png, 13, 17 + dy, 30, 1, PAL.wood_dark, 60);
  }

  // Roof
  fillRect(png, 8, 10, 40, 10, PAL.roof_green);
  fillRect(png, 8, 10, 40, 2, lighten(PAL.roof_green, 0.2));

  // Door
  fillRect(png, 24, 32, 6, 10, PAL.door_dark);
  fillRect(png, 25, 33, 4, 8, PAL.door_med);

  // Window
  drawWindow(png, 14, 24, false);

  // Fishing rod leaning against wall
  drawLine(png, 46, 12, 50, 2, PAL.wood_dark);
  drawLine(png, 50, 2, 54, 4, PAL.rope, 140);

  // Water nearby
  fillRect(png, 0, 50, 20, 14, PAL.water, 160);
  fillRect(png, 0, 52, 20, 10, PAL.water_light, 100);

  // Fish bucket
  fillRect(png, 48, 36, 6, 6, PAL.iron);
  fillRect(png, 49, 37, 4, 4, PAL.water, 140);

  addShadow(png, 8, 10, 40, 34);

  return png;
}

function generateWitchHut() {
  // 64x64 (2x2 tiles) - bonus building
  const png = createPNG(64, 64);

  // Crooked wooden hut
  fillRect(png, 14, 20, 28, 28, PAL.wood_dark);
  fillRect(png, 15, 21, 26, 26, darken(PAL.wood_med, 0.1));
  for (let dy = 0; dy < 26; dy += 6) {
    fillRect(png, 15, 21 + dy, 26, 1, PAL.black, 50);
  }

  // Pointy roof (witch hat shape from top)
  fillEllipse(png, 28, 18, 22, 16, darken(PAL.roof_brown, 0.3));
  fillEllipse(png, 28, 18, 18, 14, darken(PAL.roof_brown, 0.2));
  // Tip
  fillEllipse(png, 28, 10, 4, 4, darken(PAL.roof_brown, 0.3));
  setPixel(png, 28, 6, darken(PAL.roof_brown, 0.4));

  // Glowing window (eerie green)
  fillRect(png, 20, 30, 4, 4, PAL.window_frame);
  fillRect(png, 21, 31, 2, 2, { r: 100, g: 200, b: 80 });

  // Door
  fillRect(png, 26, 38, 6, 8, PAL.black);
  fillRect(png, 27, 39, 4, 6, darken(PAL.door_dark, 0.3));

  // Cauldron (outside)
  fillEllipse(png, 48, 40, 5, 4, PAL.iron);
  fillEllipse(png, 48, 40, 3, 3, { r: 60, g: 150, b: 60 });
  // Steam
  setPixel(png, 47, 36, PAL.white, 80);
  setPixel(png, 49, 35, PAL.white, 60);

  // Mushrooms around
  setPixel(png, 8, 42, PAL.tent_red, 200);
  setPixel(png, 10, 44, PAL.tent_red, 180);
  setPixel(png, 6, 48, { r: 160, g: 80, b: 160 }, 200);

  // Dead vines
  for (let dy = 0; dy < 6; dy++) {
    setPixel(png, 42 - (dy % 2), 22 + dy, PAL.vine, 140);
  }

  addShadow(png, 6, 8, 44, 40);

  return png;
}

// ── Main ──

const buildings = [
  { name: 'tavern',        fn: generateTavern },
  { name: 'marketplace',   fn: generateMarketplace },
  { name: 'blacksmith',    fn: generateBlacksmith },
  { name: 'library',       fn: generateLibrary },
  { name: 'temple',        fn: generateTemple },
  { name: 'farm',          fn: generateFarm },
  { name: 'mine_entrance', fn: generateMineEntrance },
  { name: 'inn',           fn: generateInn },
  { name: 'watchtower',    fn: generateWatchtower },
  { name: 'guild_hall',    fn: generateGuildHall },
  { name: 'fountain',      fn: generateFountain },
  { name: 'ruins',         fn: generateRuins },
  { name: 'port',          fn: generatePort },
  { name: 'fishing_hut',   fn: generateFishingHut },
  { name: 'witch_hut',     fn: generateWitchHut },
];

console.log('Generating top-down building sprites...\n');

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

for (const { name, fn } of buildings) {
  const png = fn();
  const buffer = PNG.sync.write(png);
  const outPath = path.join(OUTPUT_DIR, `${name}.png`);
  fs.writeFileSync(outPath, buffer);
  console.log(`  ${name}.png  (${png.width}x${png.height})`);
}

// Generate a metadata JSON with building dimensions
const metadata = {};
for (const { name, fn } of buildings) {
  const png = fn();
  metadata[name] = {
    width: png.width,
    height: png.height,
    tilesW: png.width / 32,
    tilesH: png.height / 32,
  };
}

const metaPath = path.join(OUTPUT_DIR, 'building-metadata.json');
fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
console.log(`\n  building-metadata.json written`);

console.log(`\nDone! ${buildings.length} building sprites generated in ${OUTPUT_DIR}`);
