/**
 * generate-iso-buildings.js
 *
 * Generates isometric 2.5D building sprites for Botworld POIs.
 * Each building renders in isometric perspective with visible left wall, right wall, and roof.
 * Uses pngjs to draw procedural pixel art with proper isometric projection.
 *
 * Usage: node scripts/generate-iso-buildings.js
 */

const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '../packages/client/public/assets/buildings');

// ── Isometric constants ──
const ISO_TILE_WIDTH = 64;
const ISO_TILE_HEIGHT = 32;
const HALF_W = ISO_TILE_WIDTH / 2;  // 32
const HALF_H = ISO_TILE_HEIGHT / 2; // 16

// ── Kenney-inspired color palette ──
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
  roof_orange:  { r: 200, g: 120, b: 50 },
  roof_grey:    { r: 110, g: 110, b: 115 },
  // Accents
  window_glow:  { r: 240, g: 200, b: 100 },
  window_frame: { r: 60, g: 45, b: 35 },
  door_dark:    { r: 70, g: 50, b: 35 },
  door_med:     { r: 100, g: 70, b: 45 },
  // Colors
  gold:         { r: 220, g: 180, b: 50 },
  fire:         { r: 230, g: 140, b: 40 },
  white:        { r: 220, g: 220, b: 225 },
  black:        { r: 30, g: 25, b: 20 },
  shadow:       { r: 40, g: 35, b: 30 },
  // Special
  water:        { r: 70, g: 130, b: 180 },
  water_light:  { r: 120, g: 170, b: 210 },
  grass:        { r: 90, g: 140, b: 50 },
  moss:         { r: 60, g: 100, b: 45 },
  purple:       { r: 140, g: 80, b: 160 },
  red:          { r: 200, g: 60, b: 50 },
  blue:         { r: 50, g: 80, b: 150 },
  yellow:       { r: 210, g: 180, b: 50 },
  green:        { r: 60, g: 130, b: 60 },
  iron:         { r: 100, g: 100, b: 110 },
  rope:         { r: 160, g: 130, b: 80 },
  cream:        { r: 230, g: 220, b: 200 },
};

// ── Drawing primitives ──

function createPNG(w, h) {
  const png = new PNG({ width: w, height: h });
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

function darken(color, factor) {
  return {
    r: Math.round(color.r * (1 - factor)),
    g: Math.round(color.g * (1 - factor)),
    b: Math.round(color.b * (1 - factor)),
  };
}

function lighten(color, factor) {
  return {
    r: Math.min(255, Math.round(color.r + (255 - color.r) * factor)),
    g: Math.min(255, Math.round(color.g + (255 - color.g) * factor)),
    b: Math.min(255, Math.round(color.b + (255 - color.b) * factor)),
  };
}

// ── Isometric drawing helpers ──

/**
 * Draw isometric diamond (floor tile or roof)
 * centerX, centerY = center point of diamond
 * w, h = half-width and half-height of diamond
 */
function fillIsoDiamond(png, centerX, centerY, w, h, color, alpha = 255) {
  // Diamond points: top, right, bottom, left
  const top    = { x: centerX, y: centerY - h };
  const right  = { x: centerX + w, y: centerY };
  const bottom = { x: centerX, y: centerY + h };
  const left   = { x: centerX - w, y: centerY };

  // Fill using scanline
  for (let py = top.y; py <= bottom.y; py++) {
    let leftX, rightX;
    if (py < centerY) {
      // Top half
      const t = (py - top.y) / h;
      leftX = left.x + (centerX - left.x) * t;
      rightX = right.x - (right.x - centerX) * t;
    } else {
      // Bottom half
      const t = (py - centerY) / h;
      leftX = left.x + (centerX - left.x) * (1 - t);
      rightX = right.x - (right.x - centerX) * (1 - t);
    }
    for (let px = Math.round(leftX); px <= Math.round(rightX); px++) {
      setPixel(png, px, py, color, alpha);
    }
  }
}

/**
 * Draw isometric parallelogram (wall face)
 * Points: top-left, top-right, bottom-right, bottom-left
 */
function fillIsoParallelogram(png, points, color, alpha = 255) {
  const [tl, tr, br, bl] = points;

  const minY = Math.floor(Math.min(tl.y, tr.y, br.y, bl.y));
  const maxY = Math.ceil(Math.max(tl.y, tr.y, br.y, bl.y));

  for (let py = minY; py <= maxY; py++) {
    // Find left and right edges at this scanline
    const edges = [];
    const sides = [[tl, bl], [bl, br], [br, tr], [tr, tl]];

    for (const [p1, p2] of sides) {
      if ((p1.y <= py && p2.y >= py) || (p2.y <= py && p1.y >= py)) {
        if (p1.y !== p2.y) {
          const t = (py - p1.y) / (p2.y - p1.y);
          const x = p1.x + (p2.x - p1.x) * t;
          edges.push(x);
        }
      }
    }

    if (edges.length >= 2) {
      edges.sort((a, b) => a - b);
      for (let px = Math.round(edges[0]); px <= Math.round(edges[edges.length - 1]); px++) {
        setPixel(png, px, py, color, alpha);
      }
    }
  }
}

/**
 * Add ground shadow (dark ellipse beneath building)
 */
function addGroundShadow(png, centerX, centerY, radiusX, radiusY) {
  fillEllipse(png, centerX, centerY, radiusX, radiusY, PAL.shadow, 40);
}

/**
 * Draw isometric window (small bright rectangle on wall)
 */
function drawIsoWindow(png, x, y, w, h, glowing = true) {
  fillRect(png, x, y, w, h, PAL.window_frame);
  const inner = glowing ? PAL.window_glow : PAL.blue;
  fillRect(png, x + 1, y + 1, w - 2, h - 2, inner);
}

/**
 * Draw isometric door
 */
function drawIsoDoor(png, x, y, w, h) {
  fillRect(png, x, y, w, h, PAL.door_dark);
  fillRect(png, x + 1, y + 1, w - 2, h - 2, PAL.door_med);
  setPixel(png, x + w - 3, y + h / 2, PAL.gold);
}

// ── Building generators ──

function generateTavern() {
  // 1x1 tile building, 64px height
  const png = createPNG(96, 96);
  const baseX = 48;
  const baseY = 80;
  const height = 48;

  // Ground shadow
  addGroundShadow(png, baseX, baseY + 4, 36, 18);

  // Left wall (darker wood)
  const leftWall = [
    { x: baseX - HALF_W, y: baseY },           // bottom-left
    { x: baseX, y: baseY - HALF_H },           // bottom-center
    { x: baseX, y: baseY - HALF_H - height },  // top-center
    { x: baseX - HALF_W, y: baseY - height },  // top-left
  ];
  fillIsoParallelogram(png, leftWall, darken(PAL.wood_med, 0.2));

  // Right wall (lighter wood)
  const rightWall = [
    { x: baseX, y: baseY - HALF_H },           // bottom-center
    { x: baseX + HALF_W, y: baseY },           // bottom-right
    { x: baseX + HALF_W, y: baseY - height },  // top-right
    { x: baseX, y: baseY - HALF_H - height },  // top-center
  ];
  fillIsoParallelogram(png, rightWall, PAL.wood_light);

  // Roof (orange-brown diamond)
  const roofY = baseY - HALF_H - height;
  fillIsoDiamond(png, baseX, roofY - 8, HALF_W + 4, HALF_H + 2, PAL.roof_orange);
  fillIsoDiamond(png, baseX, roofY - 8, HALF_W, HALF_H, lighten(PAL.roof_orange, 0.15));

  // Windows (warm glow on right wall)
  drawIsoWindow(png, baseX + 8, baseY - 32, 6, 6, true);
  drawIsoWindow(png, baseX + 20, baseY - 24, 6, 6, true);

  // Door (on right wall)
  drawIsoDoor(png, baseX + 10, baseY - 16, 8, 12);

  // Chimney (small cube on left)
  fillRect(png, baseX - 20, roofY - 16, 6, 12, PAL.stone_med);
  fillRect(png, baseX - 20, roofY - 16, 6, 2, PAL.stone_light);
  // Smoke
  setPixel(png, baseX - 17, roofY - 18, PAL.white, 120);
  setPixel(png, baseX - 16, roofY - 20, PAL.white, 80);

  return png;
}

function generateMarketplace() {
  // 2x2 tiles, multiple tents
  const png = createPNG(160, 128);
  const baseX = 80;
  const baseY = 110;

  addGroundShadow(png, baseX, baseY + 4, 56, 28);

  // Multiple tent structures (simplified as peaked roofs)
  const tents = [
    { x: baseX - 40, y: baseY - 20, color: PAL.red, h: 32 },
    { x: baseX, y: baseY - 24, color: PAL.blue, h: 36 },
    { x: baseX + 40, y: baseY - 20, color: PAL.yellow, h: 32 },
  ];

  for (const tent of tents) {
    // Tent roof (diamond)
    fillIsoDiamond(png, tent.x, tent.y - tent.h, 24, 12, tent.color);
    fillIsoDiamond(png, tent.x, tent.y - tent.h, 22, 11, lighten(tent.color, 0.2));

    // Support pole
    fillRect(png, tent.x - 1, tent.y - tent.h, 2, tent.h, PAL.wood_dark);

    // Goods on ground
    fillRect(png, tent.x - 8, tent.y - 4, 4, 4, PAL.gold, 180);
    fillRect(png, tent.x + 4, tent.y - 2, 3, 3, PAL.wood_plank, 180);
  }

  return png;
}

function generateBlacksmith() {
  // 1x1 tile, stone building
  const png = createPNG(96, 96);
  const baseX = 48;
  const baseY = 80;
  const height = 52;

  addGroundShadow(png, baseX, baseY + 4, 36, 18);

  // Left wall (dark stone)
  const leftWall = [
    { x: baseX - HALF_W, y: baseY },
    { x: baseX, y: baseY - HALF_H },
    { x: baseX, y: baseY - HALF_H - height },
    { x: baseX - HALF_W, y: baseY - height },
  ];
  fillIsoParallelogram(png, leftWall, darken(PAL.stone_med, 0.25));

  // Right wall (lighter stone)
  const rightWall = [
    { x: baseX, y: baseY - HALF_H },
    { x: baseX + HALF_W, y: baseY },
    { x: baseX + HALF_W, y: baseY - height },
    { x: baseX, y: baseY - HALF_H - height },
  ];
  fillIsoParallelogram(png, rightWall, PAL.stone_light);

  // Roof (dark grey)
  const roofY = baseY - HALF_H - height;
  fillIsoDiamond(png, baseX, roofY - 6, HALF_W + 4, HALF_H + 2, PAL.roof_grey);

  // Chimney with forge glow
  fillRect(png, baseX + 12, roofY - 20, 8, 20, PAL.stone_dark);
  fillRect(png, baseX + 13, roofY - 20, 6, 18, darken(PAL.stone_dark, 0.1));
  // Glow
  fillRect(png, baseX + 14, roofY - 8, 4, 4, PAL.fire, 180);
  // Smoke
  setPixel(png, baseX + 16, roofY - 22, PAL.white, 100);

  // Window on right wall
  drawIsoWindow(png, baseX + 12, baseY - 36, 6, 6, true);

  // Door
  drawIsoDoor(png, baseX + 8, baseY - 20, 8, 12);

  // Anvil (small sprite on ground)
  fillRect(png, baseX + 24, baseY - 8, 6, 4, PAL.iron);
  fillRect(png, baseX + 25, baseY - 10, 4, 2, PAL.iron);

  return png;
}

function generateWorkshop() {
  // Similar to blacksmith but wood
  const png = createPNG(96, 96);
  const baseX = 48;
  const baseY = 80;
  const height = 48;

  addGroundShadow(png, baseX, baseY + 4, 36, 18);

  // Left wall (darker wood)
  const leftWall = [
    { x: baseX - HALF_W, y: baseY },
    { x: baseX, y: baseY - HALF_H },
    { x: baseX, y: baseY - HALF_H - height },
    { x: baseX - HALF_W, y: baseY - height },
  ];
  fillIsoParallelogram(png, leftWall, darken(PAL.wood_light, 0.2));

  // Right wall (lighter wood)
  const rightWall = [
    { x: baseX, y: baseY - HALF_H },
    { x: baseX + HALF_W, y: baseY },
    { x: baseX + HALF_W, y: baseY - height },
    { x: baseX, y: baseY - HALF_H - height },
  ];
  fillIsoParallelogram(png, rightWall, PAL.wood_light);

  // Roof (blue-grey)
  const roofY = baseY - HALF_H - height;
  fillIsoDiamond(png, baseX, roofY - 6, HALF_W + 4, HALF_H + 2, PAL.roof_blue);

  // Windows
  drawIsoWindow(png, baseX + 10, baseY - 32, 6, 6, true);

  // Door
  drawIsoDoor(png, baseX + 8, baseY - 18, 8, 12);

  return png;
}

function generateLibrary() {
  // 1.5x1.5 tiles, taller building
  const png = createPNG(128, 128);
  const baseX = 64;
  const baseY = 108;
  const height = 64;

  addGroundShadow(png, baseX, baseY + 4, 48, 24);

  // Left wall (stone)
  const leftWall = [
    { x: baseX - HALF_W * 1.5, y: baseY },
    { x: baseX, y: baseY - HALF_H * 1.5 },
    { x: baseX, y: baseY - HALF_H * 1.5 - height },
    { x: baseX - HALF_W * 1.5, y: baseY - height },
  ];
  fillIsoParallelogram(png, leftWall, darken(PAL.stone_light, 0.15));

  // Right wall (stone)
  const rightWall = [
    { x: baseX, y: baseY - HALF_H * 1.5 },
    { x: baseX + HALF_W * 1.5, y: baseY },
    { x: baseX + HALF_W * 1.5, y: baseY - height },
    { x: baseX, y: baseY - HALF_H * 1.5 - height },
  ];
  fillIsoParallelogram(png, rightWall, PAL.stone_light);

  // Dome roof (ellipse on top)
  const roofY = baseY - HALF_H * 1.5 - height;
  fillEllipse(png, baseX, roofY - 12, HALF_W * 1.5, 16, PAL.roof_blue);
  fillEllipse(png, baseX, roofY - 16, HALF_W * 1.3, 12, lighten(PAL.roof_blue, 0.2));

  // Stained glass windows
  drawIsoWindow(png, baseX - 28, baseY - 48, 8, 10, false);
  fillRect(png, baseX - 28, baseY - 48, 4, 10, PAL.red, 180);

  drawIsoWindow(png, baseX + 16, baseY - 36, 8, 10, false);
  fillRect(png, baseX + 16, baseY - 36, 4, 10, PAL.blue, 180);

  // Main entrance
  drawIsoDoor(png, baseX + 8, baseY - 24, 12, 16);

  // Golden ornament on dome
  fillEllipse(png, baseX, roofY - 28, 4, 4, PAL.gold);

  return png;
}

function generateTemple() {
  // 1.5x1 tiles, white stone with golden spire
  const png = createPNG(128, 128);
  const baseX = 64;
  const baseY = 100;
  const height = 56;

  addGroundShadow(png, baseX, baseY + 4, 48, 24);

  // Left wall (cream stone)
  const leftWall = [
    { x: baseX - HALF_W * 1.5, y: baseY },
    { x: baseX, y: baseY - HALF_H * 1.5 },
    { x: baseX, y: baseY - HALF_H * 1.5 - height },
    { x: baseX - HALF_W * 1.5, y: baseY - height },
  ];
  fillIsoParallelogram(png, leftWall, darken(PAL.cream, 0.1));

  // Right wall (cream stone)
  const rightWall = [
    { x: baseX, y: baseY - HALF_H * 1.5 },
    { x: baseX + HALF_W * 1.5, y: baseY },
    { x: baseX + HALF_W * 1.5, y: baseY - height },
    { x: baseX, y: baseY - HALF_H * 1.5 - height },
  ];
  fillIsoParallelogram(png, rightWall, PAL.cream);

  // White roof
  const roofY = baseY - HALF_H * 1.5 - height;
  fillIsoDiamond(png, baseX, roofY - 8, HALF_W * 1.5 + 4, HALF_H * 1.5 + 2, PAL.white);

  // Golden spire
  fillRect(png, baseX - 2, roofY - 28, 4, 20, PAL.gold);
  fillRect(png, baseX - 1, roofY - 32, 2, 4, lighten(PAL.gold, 0.3));

  // Columns (small vertical lines on walls)
  for (let i = 0; i < 3; i++) {
    const cx = baseX + 8 + i * 10;
    fillRect(png, cx, baseY - 48, 2, 24, lighten(PAL.cream, 0.15));
  }

  // Arched entrance
  drawIsoDoor(png, baseX + 10, baseY - 28, 10, 14);

  return png;
}

function generateFarm() {
  // 2x1.5 tiles, barn with fields
  const png = createPNG(160, 128);
  const baseX = 80;
  const baseY = 100;
  const height = 52;

  addGroundShadow(png, baseX, baseY + 4, 60, 30);

  // Barn - left wall (brown wood)
  const leftWall = [
    { x: baseX - HALF_W, y: baseY },
    { x: baseX, y: baseY - HALF_H },
    { x: baseX, y: baseY - HALF_H - height },
    { x: baseX - HALF_W, y: baseY - height },
  ];
  fillIsoParallelogram(png, leftWall, darken(PAL.wood_med, 0.2));

  // Right wall (brown wood)
  const rightWall = [
    { x: baseX, y: baseY - HALF_H },
    { x: baseX + HALF_W, y: baseY },
    { x: baseX + HALF_W, y: baseY - height },
    { x: baseX, y: baseY - HALF_H - height },
  ];
  fillIsoParallelogram(png, rightWall, PAL.wood_med);

  // Roof (hay color)
  const roofY = baseY - HALF_H - height;
  fillIsoDiamond(png, baseX, roofY - 8, HALF_W + 6, HALF_H + 3, PAL.roof_brown);
  fillIsoDiamond(png, baseX, roofY - 8, HALF_W + 2, HALF_H, lighten(PAL.roof_brown, 0.15));

  // Window
  drawIsoWindow(png, baseX + 10, baseY - 36, 6, 6, true);

  // Door
  drawIsoDoor(png, baseX + 6, baseY - 20, 10, 14);

  // Hay bale (on ground)
  fillEllipse(png, baseX + 32, baseY - 8, 8, 6, PAL.yellow);
  fillEllipse(png, baseX + 32, baseY - 8, 6, 4, lighten(PAL.yellow, 0.2));

  // Fence posts
  for (let i = 0; i < 5; i++) {
    const fx = baseX - 40 + i * 20;
    fillRect(png, fx, baseY + 8, 2, 8, PAL.wood_dark);
  }

  return png;
}

function generateMine() {
  return generateMineEntrance();
}

function generateMineEntrance() {
  // 1x1 tile, dark cave entrance
  const png = createPNG(96, 96);
  const baseX = 48;
  const baseY = 80;
  const height = 48;

  addGroundShadow(png, baseX, baseY + 4, 36, 18);

  // Rock/mountain walls (dark stone)
  const leftWall = [
    { x: baseX - HALF_W, y: baseY },
    { x: baseX, y: baseY - HALF_H },
    { x: baseX, y: baseY - HALF_H - height },
    { x: baseX - HALF_W, y: baseY - height },
  ];
  fillIsoParallelogram(png, leftWall, PAL.stone_dark);

  const rightWall = [
    { x: baseX, y: baseY - HALF_H },
    { x: baseX + HALF_W, y: baseY },
    { x: baseX + HALF_W, y: baseY - height },
    { x: baseX, y: baseY - HALF_H - height },
  ];
  fillIsoParallelogram(png, rightWall, darken(PAL.stone_dark, 0.1));

  // Cave entrance (dark arch on front)
  fillEllipse(png, baseX + 16, baseY - 24, 12, 14, PAL.black);

  // Wooden support beams
  fillRect(png, baseX + 6, baseY - 36, 3, 12, PAL.wood_dark);
  fillRect(png, baseX + 22, baseY - 32, 3, 12, PAL.wood_dark);
  fillRect(png, baseX + 6, baseY - 36, 20, 3, PAL.wood_dark);

  // Lantern glow
  fillEllipse(png, baseX + 4, baseY - 28, 3, 3, PAL.fire, 200);

  // Mine cart (small)
  fillRect(png, baseX + 24, baseY - 12, 8, 6, PAL.iron);
  fillRect(png, baseX + 26, baseY - 14, 4, 2, PAL.gold, 180);

  return png;
}

function generateInn() {
  // 1.5x1 tiles, 2-story building
  const png = createPNG(128, 128);
  const baseX = 64;
  const baseY = 100;
  const height = 60;

  addGroundShadow(png, baseX, baseY + 4, 48, 24);

  // Left wall (brown wood)
  const leftWall = [
    { x: baseX - HALF_W * 1.5, y: baseY },
    { x: baseX, y: baseY - HALF_H * 1.5 },
    { x: baseX, y: baseY - HALF_H * 1.5 - height },
    { x: baseX - HALF_W * 1.5, y: baseY - height },
  ];
  fillIsoParallelogram(png, leftWall, darken(PAL.wood_med, 0.2));

  // Right wall (brown wood)
  const rightWall = [
    { x: baseX, y: baseY - HALF_H * 1.5 },
    { x: baseX + HALF_W * 1.5, y: baseY },
    { x: baseX + HALF_W * 1.5, y: baseY - height },
    { x: baseX, y: baseY - HALF_H * 1.5 - height },
  ];
  fillIsoParallelogram(png, rightWall, PAL.wood_light);

  // Floor separator (2 stories)
  drawLine(png, baseX, baseY - HALF_H * 1.5 - 30, baseX + HALF_W * 1.5, baseY - 30, PAL.wood_dark);

  // Roof (red)
  const roofY = baseY - HALF_H * 1.5 - height;
  fillIsoDiamond(png, baseX, roofY - 10, HALF_W * 1.5 + 4, HALF_H * 1.5 + 2, PAL.roof_red);

  // Windows (2nd floor)
  drawIsoWindow(png, baseX - 32, baseY - 56, 6, 6, true);
  drawIsoWindow(png, baseX + 16, baseY - 48, 6, 6, true);

  // Windows (1st floor)
  drawIsoWindow(png, baseX + 20, baseY - 32, 6, 6, true);

  // Door
  drawIsoDoor(png, baseX + 12, baseY - 22, 8, 12);

  // Sign hanging
  fillRect(png, baseX + 36, baseY - 40, 2, 8, PAL.rope);
  fillRect(png, baseX + 32, baseY - 32, 10, 6, PAL.wood_plank);
  setPixel(png, baseX + 36, baseY - 30, PAL.gold);

  return png;
}

function generateWatchtower() {
  // 1x1 tile, tall tower
  const png = createPNG(96, 128);
  const baseX = 48;
  const baseY = 110;
  const height = 80;

  addGroundShadow(png, baseX, baseY + 4, 24, 12);

  // Tower (stone, narrower)
  const leftWall = [
    { x: baseX - HALF_W * 0.7, y: baseY },
    { x: baseX, y: baseY - HALF_H * 0.7 },
    { x: baseX, y: baseY - HALF_H * 0.7 - height },
    { x: baseX - HALF_W * 0.7, y: baseY - height },
  ];
  fillIsoParallelogram(png, leftWall, darken(PAL.stone_med, 0.2));

  const rightWall = [
    { x: baseX, y: baseY - HALF_H * 0.7 },
    { x: baseX + HALF_W * 0.7, y: baseY },
    { x: baseX + HALF_W * 0.7, y: baseY - height },
    { x: baseX, y: baseY - HALF_H * 0.7 - height },
  ];
  fillIsoParallelogram(png, rightWall, PAL.stone_light);

  // Conical roof
  const roofY = baseY - HALF_H * 0.7 - height;
  fillEllipse(png, baseX, roofY - 6, HALF_W * 0.7 + 4, 8, PAL.roof_brown);
  fillEllipse(png, baseX, roofY - 10, HALF_W * 0.5, 6, lighten(PAL.roof_brown, 0.2));

  // Crenellations (battlements at top)
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const cx = baseX + Math.cos(angle) * 18;
    const cy = roofY + Math.sin(angle) * 9;
    fillRect(png, cx - 2, cy, 4, 4, PAL.stone_light);
  }

  // Flag on top
  fillRect(png, baseX - 1, roofY - 22, 2, 16, PAL.wood_dark);
  fillRect(png, baseX + 1, roofY - 22, 8, 6, PAL.red);
  fillRect(png, baseX + 1, roofY - 22, 8, 2, lighten(PAL.red, 0.2));

  // Window (arrow slit)
  fillRect(png, baseX + 10, baseY - 56, 2, 8, PAL.black);

  return png;
}

function generateGuildHall() {
  // 1.5x1.5 tiles, large ornate building
  const png = createPNG(128, 128);
  const baseX = 64;
  const baseY = 108;
  const height = 68;

  addGroundShadow(png, baseX, baseY + 4, 56, 28);

  // Left wall (wood)
  const leftWall = [
    { x: baseX - HALF_W * 1.5, y: baseY },
    { x: baseX, y: baseY - HALF_H * 1.5 },
    { x: baseX, y: baseY - HALF_H * 1.5 - height },
    { x: baseX - HALF_W * 1.5, y: baseY - height },
  ];
  fillIsoParallelogram(png, leftWall, darken(PAL.wood_med, 0.2));

  // Right wall (wood)
  const rightWall = [
    { x: baseX, y: baseY - HALF_H * 1.5 },
    { x: baseX + HALF_W * 1.5, y: baseY },
    { x: baseX + HALF_W * 1.5, y: baseY - height },
    { x: baseX, y: baseY - HALF_H * 1.5 - height },
  ];
  fillIsoParallelogram(png, rightWall, PAL.wood_light);

  // Roof (brown)
  const roofY = baseY - HALF_H * 1.5 - height;
  fillIsoDiamond(png, baseX, roofY - 10, HALF_W * 1.5 + 6, HALF_H * 1.5 + 3, PAL.roof_brown);

  // Multiple windows
  drawIsoWindow(png, baseX - 36, baseY - 52, 6, 6, true);
  drawIsoWindow(png, baseX - 30, baseY - 38, 6, 6, true);
  drawIsoWindow(png, baseX + 16, baseY - 48, 6, 6, true);
  drawIsoWindow(png, baseX + 24, baseY - 36, 6, 6, true);

  // Grand double doors
  drawIsoDoor(png, baseX + 10, baseY - 26, 12, 16);

  // Guild emblem above door
  fillEllipse(png, baseX + 16, baseY - 44, 6, 6, PAL.gold);
  fillEllipse(png, baseX + 16, baseY - 44, 4, 4, PAL.wood_dark);

  // Flags on roof
  fillRect(png, baseX - 28, roofY - 16, 2, 10, PAL.wood_dark);
  fillRect(png, baseX - 26, roofY - 16, 6, 4, PAL.red);

  fillRect(png, baseX + 32, roofY - 14, 2, 10, PAL.wood_dark);
  fillRect(png, baseX + 34, roofY - 14, 6, 4, PAL.blue);

  return png;
}

function generateFountain() {
  // 1x1 tile, circular fountain
  const png = createPNG(96, 96);
  const baseX = 48;
  const baseY = 80;

  // Ground plaza (stone circle)
  fillEllipse(png, baseX, baseY, 32, 16, PAL.stone_light, 120);

  // Fountain basin (stone)
  fillEllipse(png, baseX, baseY - 8, 20, 10, PAL.stone_med);
  fillEllipse(png, baseX, baseY - 10, 18, 9, PAL.stone_light);

  // Water pool
  fillEllipse(png, baseX, baseY - 10, 16, 8, PAL.water);
  fillEllipse(png, baseX, baseY - 12, 14, 7, PAL.water_light);

  // Water ripples
  for (let r = 4; r <= 12; r += 4) {
    for (let angle = 0; angle < Math.PI * 2; angle += 0.5) {
      const wx = baseX + Math.cos(angle) * r;
      const wy = baseY - 10 + Math.sin(angle) * (r / 2);
      setPixel(png, wx, wy, PAL.white, 80);
    }
  }

  // Center pedestal
  fillEllipse(png, baseX, baseY - 16, 6, 3, PAL.stone_dark);
  fillRect(png, baseX - 3, baseY - 28, 6, 12, PAL.stone_med);

  // Water spray
  fillEllipse(png, baseX, baseY - 30, 4, 2, PAL.water_light);
  setPixel(png, baseX - 2, baseY - 32, PAL.white, 150);
  setPixel(png, baseX + 2, baseY - 32, PAL.white, 150);
  setPixel(png, baseX, baseY - 34, PAL.white, 120);

  // Coins at bottom
  setPixel(png, baseX - 6, baseY - 8, PAL.gold, 160);
  setPixel(png, baseX + 4, baseY - 10, PAL.gold, 140);
  setPixel(png, baseX - 2, baseY - 6, PAL.gold, 150);

  addGroundShadow(png, baseX, baseY + 4, 28, 14);

  return png;
}

function generateRuins() {
  // 1.5x1 tiles, broken walls
  const png = createPNG(128, 96);
  const baseX = 64;
  const baseY = 80;

  addGroundShadow(png, baseX, baseY + 4, 48, 24);

  // Broken left wall (partial height)
  const leftWall1 = [
    { x: baseX - HALF_W * 1.5, y: baseY },
    { x: baseX - HALF_W * 0.5, y: baseY - HALF_H },
    { x: baseX - HALF_W * 0.5, y: baseY - HALF_H - 36 },
    { x: baseX - HALF_W * 1.5, y: baseY - 36 },
  ];
  fillIsoParallelogram(png, leftWall1, darken(PAL.stone_med, 0.15));

  // Broken right wall (partial, jagged)
  const rightWall1 = [
    { x: baseX + HALF_W * 0.2, y: baseY - HALF_H * 0.2 },
    { x: baseX + HALF_W * 1.2, y: baseY },
    { x: baseX + HALF_W * 1.2, y: baseY - 28 },
    { x: baseX + HALF_W * 0.2, y: baseY - HALF_H * 0.2 - 28 },
  ];
  fillIsoParallelogram(png, rightWall1, PAL.stone_light);

  // Rubble on ground
  fillRect(png, baseX - 12, baseY - 4, 6, 4, PAL.stone_dark, 180);
  fillRect(png, baseX + 16, baseY - 6, 4, 3, PAL.stone_med, 160);
  fillRect(png, baseX + 4, baseY - 2, 5, 3, darken(PAL.stone_med, 0.1), 180);

  // Moss on walls
  setPixel(png, baseX - 36, baseY - 20, PAL.moss, 200);
  setPixel(png, baseX - 34, baseY - 18, PAL.moss, 180);
  fillRect(png, baseX + 24, baseY - 12, 3, 4, PAL.moss, 160);

  // Vines
  for (let dy = 0; dy < 8; dy++) {
    setPixel(png, baseX - 40 + (dy % 2), baseY - 32 + dy * 2, PAL.grass, 140);
  }

  return png;
}

function generatePort() {
  // 2x1 tiles, dock with water
  const png = createPNG(160, 96);
  const baseX = 80;
  const baseY = 80;

  // Water area (bottom portion)
  fillRect(png, 0, baseY - 8, 160, 24, PAL.water);
  fillRect(png, 0, baseY - 4, 160, 20, PAL.water_light, 100);

  // Water ripples
  for (let dx = 0; dx < 160; dx += 12) {
    for (let dy = 0; dy < 20; dy += 8) {
      setPixel(png, dx + (dy % 2) * 4, baseY - 4 + dy, PAL.white, 50);
    }
  }

  // Wooden dock (isometric planks)
  const dockHeight = 12;
  const dockWall = [
    { x: baseX - HALF_W * 2, y: baseY },
    { x: baseX + HALF_W * 2, y: baseY },
    { x: baseX + HALF_W * 2, y: baseY - dockHeight },
    { x: baseX - HALF_W * 2, y: baseY - dockHeight },
  ];
  fillIsoParallelogram(png, dockWall, PAL.wood_plank);

  // Plank lines
  for (let dx = -60; dx <= 60; dx += 8) {
    drawLine(png, baseX + dx, baseY - dockHeight, baseX + dx, baseY, PAL.wood_dark, 80);
  }

  // Dock support pilings
  for (let i = 0; i < 5; i++) {
    const px = baseX - 50 + i * 25;
    fillRect(png, px, baseY, 3, 12, PAL.wood_dark);
  }

  // Small boat
  fillEllipse(png, baseX - 32, baseY + 8, 12, 6, PAL.wood_dark);
  fillEllipse(png, baseX - 32, baseY + 8, 10, 5, PAL.wood_med);
  fillRect(png, baseX - 33, baseY, 2, 10, PAL.wood_dark); // mast

  // Crates on dock
  fillRect(png, baseX + 20, baseY - 18, 8, 8, PAL.wood_plank);
  fillRect(png, baseX + 20, baseY - 18, 8, 2, darken(PAL.wood_plank, 0.1));

  // Rope
  fillEllipse(png, baseX + 40, baseY - 14, 4, 2, PAL.rope);

  return png;
}

function generateFishingHut() {
  // 1x1 tile, small hut by water
  const png = createPNG(96, 96);
  const baseX = 48;
  const baseY = 80;
  const height = 40;

  addGroundShadow(png, baseX, baseY + 4, 32, 16);

  // Left wall (wood)
  const leftWall = [
    { x: baseX - HALF_W * 0.8, y: baseY },
    { x: baseX, y: baseY - HALF_H * 0.8 },
    { x: baseX, y: baseY - HALF_H * 0.8 - height },
    { x: baseX - HALF_W * 0.8, y: baseY - height },
  ];
  fillIsoParallelogram(png, leftWall, darken(PAL.wood_light, 0.2));

  // Right wall (wood)
  const rightWall = [
    { x: baseX, y: baseY - HALF_H * 0.8 },
    { x: baseX + HALF_W * 0.8, y: baseY },
    { x: baseX + HALF_W * 0.8, y: baseY - height },
    { x: baseX, y: baseY - HALF_H * 0.8 - height },
  ];
  fillIsoParallelogram(png, rightWall, PAL.wood_light);

  // Roof (green)
  const roofY = baseY - HALF_H * 0.8 - height;
  fillIsoDiamond(png, baseX, roofY - 6, HALF_W * 0.8 + 4, HALF_H * 0.8 + 2, PAL.green);

  // Window
  drawIsoWindow(png, baseX - 18, baseY - 28, 5, 5, false);

  // Door
  drawIsoDoor(png, baseX + 8, baseY - 18, 7, 10);

  // Fishing rod leaning
  drawLine(png, baseX + 28, baseY - 12, baseX + 36, baseY - 24, PAL.wood_dark);
  drawLine(png, baseX + 36, baseY - 24, baseX + 38, baseY - 28, PAL.rope, 120);

  // Water nearby
  fillRect(png, 0, baseY + 8, 30, 12, PAL.water, 140);
  fillRect(png, 0, baseY + 10, 30, 10, PAL.water_light, 80);

  // Fish bucket
  fillRect(png, baseX + 22, baseY - 6, 5, 4, PAL.iron);

  return png;
}

function generateWitchHut() {
  // 1x1 tile, crooked dark hut
  const png = createPNG(96, 96);
  const baseX = 48;
  const baseY = 80;
  const height = 44;

  addGroundShadow(png, baseX, baseY + 4, 32, 16);

  // Left wall (dark wood, slightly offset for crooked look)
  const leftWall = [
    { x: baseX - HALF_W * 0.8, y: baseY },
    { x: baseX - 2, y: baseY - HALF_H * 0.8 },
    { x: baseX - 4, y: baseY - HALF_H * 0.8 - height },
    { x: baseX - HALF_W * 0.8, y: baseY - height + 2 },
  ];
  fillIsoParallelogram(png, leftWall, PAL.wood_dark);

  // Right wall (dark wood)
  const rightWall = [
    { x: baseX, y: baseY - HALF_H * 0.8 },
    { x: baseX + HALF_W * 0.8, y: baseY },
    { x: baseX + HALF_W * 0.8 + 2, y: baseY - height },
    { x: baseX, y: baseY - HALF_H * 0.8 - height },
  ];
  fillIsoParallelogram(png, rightWall, darken(PAL.wood_dark, 0.1));

  // Pointy roof (witch hat style)
  const roofY = baseY - HALF_H * 0.8 - height;
  fillEllipse(png, baseX, roofY - 8, HALF_W * 0.9, 12, darken(PAL.roof_brown, 0.4));
  fillEllipse(png, baseX, roofY - 14, HALF_W * 0.6, 8, darken(PAL.roof_brown, 0.3));
  fillEllipse(png, baseX, roofY - 20, 4, 4, darken(PAL.roof_brown, 0.4));

  // Eerie green window
  fillRect(png, baseX + 8, baseY - 30, 5, 5, PAL.window_frame);
  fillRect(png, baseX + 9, baseY - 29, 3, 3, PAL.green);

  // Dark door
  fillRect(png, baseX + 6, baseY - 18, 6, 10, PAL.black);
  fillRect(png, baseX + 7, baseY - 17, 4, 8, darken(PAL.door_dark, 0.4));

  // Cauldron outside
  fillEllipse(png, baseX + 28, baseY - 8, 5, 3, PAL.iron);
  fillEllipse(png, baseX + 28, baseY - 10, 3, 2, PAL.green);
  // Steam
  setPixel(png, baseX + 27, baseY - 12, PAL.white, 80);
  setPixel(png, baseX + 29, baseY - 14, PAL.white, 60);

  // Mushrooms
  setPixel(png, baseX - 20, baseY - 2, PAL.red, 200);
  setPixel(png, baseX - 16, baseY, PAL.purple, 200);

  return png;
}

function generateVillageHouse(variant) {
  // Small houses, 128x120, 2x2 tile footprint
  const png = createPNG(128, 120);
  const baseX = 64;
  const baseY = 100;
  const height = 44;

  addGroundShadow(png, baseX, baseY + 4, 40, 20);

  // Variant-specific colors
  const roofColors = [PAL.roof_red, PAL.roof_brown, PAL.roof_blue, PAL.roof_orange];
  const wallColors = [PAL.wood_light, PAL.cream, lighten(PAL.wood_med, 0.1), PAL.stone_light];
  const roofColor = roofColors[variant - 1] || PAL.roof_red;
  const wallColor = wallColors[variant - 1] || PAL.wood_light;

  // Left wall
  const leftWall = [
    { x: baseX - HALF_W, y: baseY },
    { x: baseX, y: baseY - HALF_H },
    { x: baseX, y: baseY - HALF_H - height },
    { x: baseX - HALF_W, y: baseY - height },
  ];
  fillIsoParallelogram(png, leftWall, darken(wallColor, 0.2));

  // Right wall
  const rightWall = [
    { x: baseX, y: baseY - HALF_H },
    { x: baseX + HALF_W, y: baseY },
    { x: baseX + HALF_W, y: baseY - height },
    { x: baseX, y: baseY - HALF_H - height },
  ];
  fillIsoParallelogram(png, rightWall, wallColor);

  // Roof
  const roofY = baseY - HALF_H - height;
  fillIsoDiamond(png, baseX, roofY - 8, HALF_W + 4, HALF_H + 2, roofColor);
  fillIsoDiamond(png, baseX, roofY - 8, HALF_W + 1, HALF_H, lighten(roofColor, 0.15));

  // Window
  drawIsoWindow(png, baseX + 10, baseY - 30, 6, 6, true);

  // Door
  drawIsoDoor(png, baseX + 6, baseY - 18, 8, 12);

  // Variant-specific details
  if (variant === 1) {
    // Flower pot
    fillRect(png, baseX + 24, baseY - 8, 4, 4, PAL.wood_plank);
    setPixel(png, baseX + 25, baseY - 10, PAL.red, 200);
    setPixel(png, baseX + 26, baseY - 10, PAL.yellow, 200);
  } else if (variant === 2) {
    // Garden fence
    fillRect(png, baseX - 24, baseY - 2, 2, 6, PAL.wood_dark);
    fillRect(png, baseX - 16, baseY, 2, 6, PAL.wood_dark);
  } else if (variant === 3) {
    // Chimney
    fillRect(png, baseX - 18, roofY - 14, 6, 12, PAL.stone_med);
    setPixel(png, baseX - 16, roofY - 16, PAL.white, 100);
  } else if (variant === 4) {
    // Wood pile
    fillRect(png, baseX + 26, baseY - 6, 6, 4, PAL.wood_dark);
    fillRect(png, baseX + 28, baseY - 8, 4, 2, PAL.wood_med);
  }

  return png;
}

function generateVillageHouseLarge(variant) {
  // Larger houses, 192x140, 3x2 footprint
  const png = createPNG(192, 140);
  const baseX = 96;
  const baseY = 120;
  const height = 56;

  addGroundShadow(png, baseX, baseY + 4, 60, 30);

  // Variant-specific colors
  const roofColor = variant === 1 ? PAL.roof_red : PAL.roof_brown;
  const wallColor = variant === 1 ? PAL.wood_light : PAL.cream;

  // Left wall
  const leftWall = [
    { x: baseX - HALF_W * 1.5, y: baseY },
    { x: baseX, y: baseY - HALF_H * 1.5 },
    { x: baseX, y: baseY - HALF_H * 1.5 - height },
    { x: baseX - HALF_W * 1.5, y: baseY - height },
  ];
  fillIsoParallelogram(png, leftWall, darken(wallColor, 0.2));

  // Right wall
  const rightWall = [
    { x: baseX, y: baseY - HALF_H * 1.5 },
    { x: baseX + HALF_W * 1.5, y: baseY },
    { x: baseX + HALF_W * 1.5, y: baseY - height },
    { x: baseX, y: baseY - HALF_H * 1.5 - height },
  ];
  fillIsoParallelogram(png, rightWall, wallColor);

  // Roof
  const roofY = baseY - HALF_H * 1.5 - height;
  fillIsoDiamond(png, baseX, roofY - 10, HALF_W * 1.5 + 6, HALF_H * 1.5 + 3, roofColor);
  fillIsoDiamond(png, baseX, roofY - 10, HALF_W * 1.5 + 2, HALF_H * 1.5, lighten(roofColor, 0.15));

  // Multiple windows
  drawIsoWindow(png, baseX - 32, baseY - 42, 6, 6, true);
  drawIsoWindow(png, baseX + 16, baseY - 38, 6, 6, true);
  drawIsoWindow(png, baseX + 24, baseY - 30, 6, 6, true);

  // Door
  drawIsoDoor(png, baseX + 10, baseY - 22, 10, 14);

  // Variant-specific details
  if (variant === 1) {
    // Chimney with smoke
    fillRect(png, baseX - 24, roofY - 18, 8, 16, PAL.stone_med);
    fillRect(png, baseX - 24, roofY - 18, 8, 2, PAL.stone_light);
    setPixel(png, baseX - 20, roofY - 20, PAL.white, 120);
    setPixel(png, baseX - 19, roofY - 22, PAL.white, 80);
  } else if (variant === 2) {
    // Balcony
    fillRect(png, baseX + 20, baseY - 36, 12, 2, PAL.wood_dark);
    fillRect(png, baseX + 22, baseY - 44, 2, 8, PAL.wood_dark);
    fillRect(png, baseX + 28, baseY - 44, 2, 8, PAL.wood_dark);
  }

  return png;
}

function generateWindmill() {
  // 128x160, 2x2 footprint with windmill blades
  const png = createPNG(128, 160);
  const baseX = 64;
  const baseY = 120;
  const height = 64;

  addGroundShadow(png, baseX, baseY + 4, 48, 24);

  // Tower (stone, tapered)
  const leftWall = [
    { x: baseX - HALF_W, y: baseY },
    { x: baseX, y: baseY - HALF_H },
    { x: baseX, y: baseY - HALF_H - height },
    { x: baseX - HALF_W * 0.7, y: baseY - height },
  ];
  fillIsoParallelogram(png, leftWall, darken(PAL.stone_light, 0.2));

  const rightWall = [
    { x: baseX, y: baseY - HALF_H },
    { x: baseX + HALF_W, y: baseY },
    { x: baseX + HALF_W * 0.7, y: baseY - height },
    { x: baseX, y: baseY - HALF_H - height },
  ];
  fillIsoParallelogram(png, rightWall, PAL.stone_light);

  // Conical roof
  const roofY = baseY - HALF_H - height;
  fillEllipse(png, baseX, roofY - 8, HALF_W * 0.7 + 4, 10, PAL.roof_red);
  fillEllipse(png, baseX, roofY - 12, HALF_W * 0.5, 6, lighten(PAL.roof_red, 0.2));

  // Windows at different levels
  drawIsoWindow(png, baseX + 8, baseY - 52, 5, 5, true);
  drawIsoWindow(png, baseX - 16, baseY - 36, 5, 5, false);

  // Door
  drawIsoDoor(png, baseX + 6, baseY - 20, 8, 12);

  // Windmill blades (4 diagonal blades)
  const bladeX = baseX + 20;
  const bladeY = baseY - 56;

  // Blade 1 (top-right)
  fillRect(png, bladeX, bladeY - 20, 4, 22, PAL.wood_plank);
  fillRect(png, bladeX, bladeY - 20, 12, 4, PAL.wood_light);

  // Blade 2 (bottom-left)
  fillRect(png, bladeX - 8, bladeY + 2, 4, 22, PAL.wood_plank);
  fillRect(png, bladeX - 20, bladeY + 18, 12, 4, PAL.wood_light);

  // Blade 3 (top-left)
  fillRect(png, bladeX - 24, bladeY - 14, 22, 4, PAL.wood_plank);
  fillRect(png, bladeX - 24, bladeY - 14, 4, 12, PAL.wood_light);

  // Blade 4 (bottom-right)
  fillRect(png, bladeX + 6, bladeY + 8, 22, 4, PAL.wood_plank);
  fillRect(png, bladeX + 24, bladeY + 8, 4, 12, PAL.wood_light);

  // Center hub
  fillEllipse(png, bladeX, bladeY, 6, 6, PAL.wood_dark);
  fillEllipse(png, bladeX, bladeY, 4, 4, PAL.iron);

  return png;
}

function generateDock() {
  // 256x120, 4x2 footprint with wooden planks over water
  const png = createPNG(256, 120);
  const baseX = 128;
  const baseY = 100;

  // Water area
  fillRect(png, 0, baseY - 8, 256, 28, PAL.water);
  fillRect(png, 0, baseY - 4, 256, 24, PAL.water_light, 100);

  // Water ripples
  for (let dx = 0; dx < 256; dx += 16) {
    for (let dy = 0; dy < 24; dy += 8) {
      setPixel(png, dx + (dy % 2) * 6, baseY - 4 + dy, PAL.white, 50);
    }
  }

  // Wooden dock platform (large isometric rectangle)
  const dockHeight = 16;
  const dockWall = [
    { x: baseX - HALF_W * 3, y: baseY },
    { x: baseX + HALF_W * 3, y: baseY },
    { x: baseX + HALF_W * 3, y: baseY - dockHeight },
    { x: baseX - HALF_W * 3, y: baseY - dockHeight },
  ];
  fillIsoParallelogram(png, dockWall, PAL.wood_plank);

  // Plank lines
  for (let dx = -90; dx <= 90; dx += 8) {
    drawLine(png, baseX + dx, baseY - dockHeight, baseX + dx, baseY, PAL.wood_dark, 80);
  }

  // Support pilings
  for (let i = 0; i < 8; i++) {
    const px = baseX - 84 + i * 24;
    fillRect(png, px, baseY, 3, 16, PAL.wood_dark);
  }

  // Mooring posts
  fillRect(png, baseX - 80, baseY - 22, 4, 8, PAL.wood_dark);
  fillRect(png, baseX + 76, baseY - 20, 4, 8, PAL.wood_dark);

  // Ropes
  fillEllipse(png, baseX - 78, baseY - 18, 6, 3, PAL.rope);
  fillEllipse(png, baseX + 78, baseY - 16, 6, 3, PAL.rope);

  // Crates and barrels
  fillRect(png, baseX - 40, baseY - 24, 10, 10, PAL.wood_plank);
  fillRect(png, baseX - 40, baseY - 24, 10, 2, darken(PAL.wood_plank, 0.1));

  fillEllipse(png, baseX + 20, baseY - 22, 6, 4, PAL.wood_med);
  fillRect(png, baseX + 20, baseY - 22, 2, 8, PAL.iron, 150);

  return png;
}

function generateBridgeStone() {
  // 128x80, stone arch bridge
  const png = createPNG(128, 80);
  const baseX = 64;
  const baseY = 60;

  // Water underneath
  fillRect(png, 0, baseY + 4, 128, 16, PAL.water);
  fillRect(png, 0, baseY + 6, 128, 14, PAL.water_light, 100);

  // Stone arch (central span)
  fillEllipse(png, baseX, baseY - 8, 40, 20, PAL.stone_med);
  fillEllipse(png, baseX, baseY - 10, 38, 18, PAL.stone_light);

  // Cut out bottom to make arch
  fillEllipse(png, baseX, baseY + 4, 34, 16, { r: 0, g: 0, b: 0 }, 0);

  // Bridge deck (isometric)
  const deckWall = [
    { x: baseX - HALF_W * 1.5, y: baseY - 12 },
    { x: baseX + HALF_W * 1.5, y: baseY - 12 },
    { x: baseX + HALF_W * 1.5, y: baseY - 16 },
    { x: baseX - HALF_W * 1.5, y: baseY - 16 },
  ];
  fillIsoParallelogram(png, deckWall, PAL.stone_light);

  // Stone texture
  for (let dx = -40; dx <= 40; dx += 12) {
    drawLine(png, baseX + dx, baseY - 16, baseX + dx, baseY - 12, darken(PAL.stone_light, 0.1), 120);
  }

  // Support pillars
  fillRect(png, baseX - 32, baseY - 8, 6, 20, PAL.stone_med);
  fillRect(png, baseX + 26, baseY - 6, 6, 20, PAL.stone_med);

  // Low wall/railing
  for (let i = -2; i <= 2; i++) {
    const rx = baseX + i * 16;
    fillRect(png, rx, baseY - 20, 3, 4, PAL.stone_dark);
  }

  return png;
}

function generateWallSection(type) {
  // Wall variants: straight, corner, T-junction, end
  const png = createPNG(96, 80);
  const baseX = 48;
  const baseY = 64;
  const wallHeight = 32;

  addGroundShadow(png, baseX, baseY + 4, 40, 20);

  if (type === 'straight') {
    // Straight wall section
    const leftWall = [
      { x: baseX - HALF_W, y: baseY },
      { x: baseX + HALF_W, y: baseY },
      { x: baseX + HALF_W, y: baseY - wallHeight },
      { x: baseX - HALF_W, y: baseY - wallHeight },
    ];
    fillIsoParallelogram(png, leftWall, PAL.stone_light);

    // Crenellations
    for (let i = 0; i < 4; i++) {
      const cx = baseX - 24 + i * 16;
      fillRect(png, cx, baseY - wallHeight - 4, 6, 4, PAL.stone_med);
    }
  } else if (type === 'corner') {
    // L-shaped corner
    const wall1 = [
      { x: baseX - HALF_W, y: baseY },
      { x: baseX, y: baseY - HALF_H },
      { x: baseX, y: baseY - HALF_H - wallHeight },
      { x: baseX - HALF_W, y: baseY - wallHeight },
    ];
    fillIsoParallelogram(png, wall1, darken(PAL.stone_light, 0.2));

    const wall2 = [
      { x: baseX, y: baseY - HALF_H },
      { x: baseX + HALF_W, y: baseY },
      { x: baseX + HALF_W, y: baseY - wallHeight },
      { x: baseX, y: baseY - HALF_H - wallHeight },
    ];
    fillIsoParallelogram(png, wall2, PAL.stone_light);

    // Corner crenellations
    fillRect(png, baseX - 4, baseY - HALF_H - wallHeight - 4, 8, 4, PAL.stone_med);
  } else if (type === 'T') {
    // T-junction
    const mainWall = [
      { x: baseX - HALF_W * 1.5, y: baseY },
      { x: baseX + HALF_W * 1.5, y: baseY },
      { x: baseX + HALF_W * 1.5, y: baseY - wallHeight },
      { x: baseX - HALF_W * 1.5, y: baseY - wallHeight },
    ];
    fillIsoParallelogram(png, mainWall, PAL.stone_light);

    const sideWall = [
      { x: baseX - HALF_W * 0.5, y: baseY - HALF_H },
      { x: baseX, y: baseY - HALF_H * 1.5 },
      { x: baseX, y: baseY - HALF_H * 1.5 - wallHeight },
      { x: baseX - HALF_W * 0.5, y: baseY - HALF_H - wallHeight },
    ];
    fillIsoParallelogram(png, sideWall, darken(PAL.stone_light, 0.2));
  } else if (type === 'end') {
    // Wall end with tower
    const wall = [
      { x: baseX - HALF_W * 0.8, y: baseY },
      { x: baseX + HALF_W * 0.2, y: baseY },
      { x: baseX + HALF_W * 0.2, y: baseY - wallHeight },
      { x: baseX - HALF_W * 0.8, y: baseY - wallHeight },
    ];
    fillIsoParallelogram(png, wall, PAL.stone_light);

    // End tower
    fillEllipse(png, baseX + 16, baseY - wallHeight - 4, 12, 6, PAL.stone_med);
    fillRect(png, baseX + 10, baseY - wallHeight - 8, 12, 12, PAL.stone_light);
    fillRect(png, baseX + 12, baseY - wallHeight - 12, 8, 4, PAL.stone_dark);
  }

  // Stone texture (vertical lines)
  for (let dy = 0; dy < wallHeight; dy += 8) {
    drawLine(png, baseX - 20, baseY - dy, baseX + 20, baseY - dy, darken(PAL.stone_light, 0.05), 60);
  }

  return png;
}

function generateGate() {
  // 128x160, castle gate with arch
  const png = createPNG(128, 160);
  const baseX = 64;
  const baseY = 140;
  const height = 80;

  addGroundShadow(png, baseX, baseY + 4, 48, 24);

  // Gate towers (left)
  const leftTower = [
    { x: baseX - HALF_W * 1.2, y: baseY },
    { x: baseX - HALF_W * 0.4, y: baseY - HALF_H },
    { x: baseX - HALF_W * 0.4, y: baseY - HALF_H - height },
    { x: baseX - HALF_W * 1.2, y: baseY - height },
  ];
  fillIsoParallelogram(png, leftTower, darken(PAL.stone_med, 0.2));

  // Gate towers (right)
  const rightTower = [
    { x: baseX + HALF_W * 0.4, y: baseY - HALF_H },
    { x: baseX + HALF_W * 1.2, y: baseY },
    { x: baseX + HALF_W * 1.2, y: baseY - height },
    { x: baseX + HALF_W * 0.4, y: baseY - HALF_H - height },
  ];
  fillIsoParallelogram(png, rightTower, PAL.stone_light);

  // Connecting wall above gate
  const topWall = [
    { x: baseX - HALF_W * 0.4, y: baseY - HALF_H - 48 },
    { x: baseX + HALF_W * 0.4, y: baseY - HALF_H - 48 },
    { x: baseX + HALF_W * 0.4, y: baseY - HALF_H - height },
    { x: baseX - HALF_W * 0.4, y: baseY - HALF_H - height },
  ];
  fillIsoParallelogram(png, topWall, PAL.stone_med);

  // Arched gate opening
  fillEllipse(png, baseX, baseY - 32, 20, 24, PAL.black);
  fillEllipse(png, baseX, baseY - 34, 18, 22, darken(PAL.stone_dark, 0.3));

  // Wooden gate doors (closed)
  fillRect(png, baseX - 16, baseY - 44, 14, 44, PAL.wood_dark);
  fillRect(png, baseX + 2, baseY - 44, 14, 44, PAL.wood_dark);

  // Iron bands on door
  fillRect(png, baseX - 16, baseY - 38, 14, 2, PAL.iron);
  fillRect(png, baseX - 16, baseY - 24, 14, 2, PAL.iron);
  fillRect(png, baseX + 2, baseY - 38, 14, 2, PAL.iron);
  fillRect(png, baseX + 2, baseY - 24, 14, 2, PAL.iron);

  // Tower crenellations
  const roofY = baseY - HALF_H - height;
  for (let i = 0; i < 3; i++) {
    fillRect(png, baseX - 32 + i * 8, roofY, 6, 4, PAL.stone_light);
    fillRect(png, baseX + 20 + i * 8, roofY, 6, 4, PAL.stone_light);
  }

  // Arrow slits
  fillRect(png, baseX - 28, baseY - 60, 2, 8, PAL.black);
  fillRect(png, baseX + 26, baseY - 56, 2, 8, PAL.black);

  // Flags on towers
  fillRect(png, baseX - 28, roofY - 16, 2, 12, PAL.wood_dark);
  fillRect(png, baseX - 26, roofY - 16, 8, 6, PAL.red);

  fillRect(png, baseX + 26, roofY - 14, 2, 12, PAL.wood_dark);
  fillRect(png, baseX + 28, roofY - 14, 8, 6, PAL.blue);

  return png;
}

// ── Main ──

const buildings = [
  { name: 'bldg_tavern',        fn: generateTavern },
  { name: 'bldg_marketplace',   fn: generateMarketplace },
  { name: 'bldg_blacksmith',    fn: generateBlacksmith },
  { name: 'bldg_workshop',      fn: generateWorkshop },
  { name: 'bldg_library',       fn: generateLibrary },
  { name: 'bldg_temple',        fn: generateTemple },
  { name: 'bldg_farm',          fn: generateFarm },
  { name: 'bldg_mine',          fn: generateMine },
  { name: 'bldg_mine_entrance', fn: generateMineEntrance },
  { name: 'bldg_inn',           fn: generateInn },
  { name: 'bldg_watchtower',    fn: generateWatchtower },
  { name: 'bldg_guild_hall',    fn: generateGuildHall },
  { name: 'bldg_fountain',      fn: generateFountain },
  { name: 'bldg_ruins',         fn: generateRuins },
  { name: 'bldg_port',          fn: generatePort },
  { name: 'bldg_fishing_hut',   fn: generateFishingHut },
  { name: 'bldg_witch_hut',     fn: generateWitchHut },
  // Village houses (4 variants)
  { name: 'bldg_village_house_01', fn: () => generateVillageHouse(1) },
  { name: 'bldg_village_house_02', fn: () => generateVillageHouse(2) },
  { name: 'bldg_village_house_03', fn: () => generateVillageHouse(3) },
  { name: 'bldg_village_house_04', fn: () => generateVillageHouse(4) },
  // Large village houses (2 variants)
  { name: 'bldg_village_house_large_01', fn: () => generateVillageHouseLarge(1) },
  { name: 'bldg_village_house_large_02', fn: () => generateVillageHouseLarge(2) },
  // Special structures
  { name: 'bldg_windmill_01',   fn: generateWindmill },
  { name: 'bldg_dock_01',       fn: generateDock },
  { name: 'bldg_bridge_stone_01', fn: generateBridgeStone },
  // Wall sections (4 variants)
  { name: 'bldg_wall_section_01', fn: () => generateWallSection('straight') },
  { name: 'bldg_wall_section_02', fn: () => generateWallSection('corner') },
  { name: 'bldg_wall_section_03', fn: () => generateWallSection('T') },
  { name: 'bldg_wall_section_04', fn: () => generateWallSection('end') },
  // Gate
  { name: 'bldg_gate_01',       fn: generateGate },
];

console.log('Generating isometric 2.5D building sprites...\n');

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

for (const { name, fn } of buildings) {
  const png = fn();
  const buffer = PNG.sync.write(png);
  const outPath = path.join(OUTPUT_DIR, `${name}.png`);
  fs.writeFileSync(outPath, buffer);
  console.log(`  ${name}.png  (${png.width}x${png.height})`);
}

// Generate metadata JSON with isometric building dimensions
const metadata = {};
for (const { name, fn } of buildings) {
  const png = fn();
  metadata[name] = {
    width: png.width,
    height: png.height,
    perspective: 'isometric_2.5D',
    baseTileWidth: ISO_TILE_WIDTH,
    baseTileHeight: ISO_TILE_HEIGHT,
  };
}

const metaPath = path.join(OUTPUT_DIR, 'iso-building-metadata.json');
fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
console.log(`\n  iso-building-metadata.json written`);

console.log(`\nDone! ${buildings.length} isometric building sprites generated in ${OUTPUT_DIR}`);
console.log('\nNote: BUILDING_SIZES in world-scene.ts will need updating to reflect new isometric dimensions.');
