/**
 * generate-character-sprites.js
 *
 * Generates top-down RPG-style character spritesheets for Botworld.
 * Uses pngjs to draw procedural pixel art at 32x48px per frame.
 *
 * Spritesheet layout (96x192):
 *   3 columns (walk1, stand, walk2) x 4 rows (down, left, right, up)
 *   Frame indices (left-to-right, top-to-bottom):
 *     Row 0 (down):  0, 1, 2
 *     Row 1 (left):  3, 4, 5
 *     Row 2 (right): 6, 7, 8
 *     Row 3 (up):    9, 10, 11
 *
 * Usage: node scripts/generate-character-sprites.js
 */

const { PNG } = require('pngjs')
const fs = require('fs')
const path = require('path')

const OUTPUT_DIR = path.join(__dirname, '../packages/client/public/assets/characters')

const FRAME_W = 32
const FRAME_H = 48
const COLS = 3   // walk1, stand, walk2
const ROWS = 4   // down, left, right, up
const SHEET_W = FRAME_W * COLS  // 96
const SHEET_H = FRAME_H * ROWS  // 192

// ── Drawing primitives ──

function createPNG(w, h) {
  const png = new PNG({ width: w, height: h })
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0; png.data[i + 1] = 0; png.data[i + 2] = 0; png.data[i + 3] = 0
  }
  return png
}

function setPixel(png, x, y, c, a = 255) {
  x = Math.round(x); y = Math.round(y)
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return
  const idx = (y * png.width + x) * 4
  if (a >= 255) {
    png.data[idx] = c.r; png.data[idx + 1] = c.g; png.data[idx + 2] = c.b; png.data[idx + 3] = 255
  } else {
    // Alpha blend
    const srcA = a / 255
    const dstA = png.data[idx + 3] / 255
    const outA = srcA + dstA * (1 - srcA)
    if (outA > 0) {
      png.data[idx]     = Math.round((c.r * srcA + png.data[idx] * dstA * (1 - srcA)) / outA)
      png.data[idx + 1] = Math.round((c.g * srcA + png.data[idx + 1] * dstA * (1 - srcA)) / outA)
      png.data[idx + 2] = Math.round((c.b * srcA + png.data[idx + 2] * dstA * (1 - srcA)) / outA)
      png.data[idx + 3] = Math.round(outA * 255)
    }
  }
}

function fillRect(png, x, y, w, h, c, a = 255) {
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      setPixel(png, px, py, c, a)
    }
  }
}

function fillEllipse(png, cx, cy, rx, ry, c, a = 255) {
  for (let py = Math.floor(cy - ry); py <= Math.ceil(cy + ry); py++) {
    for (let px = Math.floor(cx - rx); px <= Math.ceil(cx + rx); px++) {
      const dx = (px - cx) / rx
      const dy = (py - cy) / ry
      if (dx * dx + dy * dy <= 1.0) {
        setPixel(png, px, py, c, a)
      }
    }
  }
}

function darken(c, factor = 0.7) {
  return { r: Math.round(c.r * factor), g: Math.round(c.g * factor), b: Math.round(c.b * factor) }
}

function lighten(c, factor = 1.3) {
  return {
    r: Math.min(255, Math.round(c.r * factor)),
    g: Math.min(255, Math.round(c.g * factor)),
    b: Math.min(255, Math.round(c.b * factor)),
  }
}

// ── Character templates ──

const TEMPLATES = {
  // 8 Races
  human_sprite: {
    skin: { r: 230, g: 190, b: 150 },
    hair: { r: 120, g: 80, b: 40 },
    hairStyle: 'short',
    shirt: { r: 60, g: 100, b: 140 },
    pants: { r: 70, g: 60, b: 50 },
    shoes: { r: 50, g: 40, b: 30 },
    eyes: { r: 40, g: 80, b: 120 },
    outline: { r: 30, g: 25, b: 20 },
    bodyW: 10, headR: 6,
    features: [],
  },
  elf_sprite: {
    skin: { r: 240, g: 218, b: 195 },
    hair: { r: 220, g: 210, b: 170 },
    hairStyle: 'long',
    shirt: { r: 45, g: 120, b: 65 },
    pants: { r: 55, g: 80, b: 50 },
    shoes: { r: 45, g: 60, b: 38 },
    eyes: { r: 60, g: 140, b: 80 },
    outline: { r: 25, g: 30, b: 20 },
    bodyW: 9, headR: 6,
    features: ['pointy_ears'],
  },
  dwarf_sprite: {
    skin: { r: 220, g: 180, b: 140 },
    hair: { r: 160, g: 80, b: 30 },
    hairStyle: 'short',
    shirt: { r: 130, g: 90, b: 50 },
    pants: { r: 80, g: 60, b: 40 },
    shoes: { r: 60, g: 45, b: 30 },
    eyes: { r: 80, g: 60, b: 40 },
    outline: { r: 30, g: 25, b: 15 },
    bodyW: 12, headR: 7,
    features: ['beard'],
    heightMod: -3,
  },
  orc_sprite: {
    skin: { r: 100, g: 160, b: 80 },
    hair: { r: 40, g: 40, b: 30 },
    hairStyle: 'mohawk',
    shirt: { r: 100, g: 70, b: 40 },
    pants: { r: 70, g: 55, b: 35 },
    shoes: { r: 50, g: 40, b: 25 },
    eyes: { r: 200, g: 80, b: 30 },
    outline: { r: 30, g: 40, b: 20 },
    bodyW: 13, headR: 7,
    features: ['tusks'],
  },
  beastkin_sprite: {
    skin: { r: 180, g: 140, b: 100 },
    hair: { r: 160, g: 120, b: 70 },
    hairStyle: 'short',
    shirt: { r: 80, g: 110, b: 50 },
    pants: { r: 70, g: 60, b: 40 },
    shoes: { r: 55, g: 45, b: 30 },
    eyes: { r: 200, g: 170, b: 40 },
    outline: { r: 35, g: 30, b: 20 },
    bodyW: 10, headR: 6,
    features: ['animal_ears', 'tail'],
  },
  undead_sprite: {
    skin: { r: 150, g: 165, b: 155 },
    hair: { r: 90, g: 90, b: 95 },
    hairStyle: 'bald',
    shirt: { r: 75, g: 65, b: 75 },
    pants: { r: 55, g: 50, b: 55 },
    shoes: { r: 45, g: 40, b: 42 },
    eyes: { r: 120, g: 220, b: 120 },
    outline: { r: 30, g: 30, b: 35 },
    bodyW: 9, headR: 6,
    features: ['glowing_eyes'],
  },
  fairy_sprite: {
    skin: { r: 240, g: 225, b: 235 },
    hair: { r: 200, g: 150, b: 220 },
    hairStyle: 'ponytail',
    shirt: { r: 160, g: 200, b: 140 },
    pants: { r: 130, g: 170, b: 120 },
    shoes: { r: 100, g: 140, b: 90 },
    eyes: { r: 140, g: 100, b: 200 },
    outline: { r: 60, g: 50, b: 70 },
    bodyW: 8, headR: 6,
    features: ['wings'],
    heightMod: -2,
  },
  dragonkin_sprite: {
    skin: { r: 140, g: 70, b: 60 },
    hair: { r: 60, g: 30, b: 20 },
    hairStyle: 'short',
    shirt: { r: 80, g: 50, b: 40 },
    pants: { r: 60, g: 40, b: 30 },
    shoes: { r: 40, g: 30, b: 22 },
    eyes: { r: 240, g: 180, b: 40 },
    outline: { r: 30, g: 15, b: 10 },
    bodyW: 12, headR: 7,
    features: ['horns', 'tail'],
  },
  // 5 NPCs
  npc_merchant: {
    skin: { r: 225, g: 185, b: 145 },
    hair: { r: 100, g: 70, b: 40 },
    hairStyle: 'short',
    shirt: { r: 150, g: 110, b: 45 },
    pants: { r: 80, g: 65, b: 42 },
    shoes: { r: 60, g: 45, b: 30 },
    eyes: { r: 60, g: 80, b: 40 },
    outline: { r: 30, g: 25, b: 15 },
    bodyW: 11, headR: 6,
    features: ['pack'],
  },
  npc_innkeeper: {
    skin: { r: 218, g: 175, b: 138 },
    hair: { r: 80, g: 50, b: 30 },
    hairStyle: 'short',
    shirt: { r: 185, g: 165, b: 145 },
    pants: { r: 90, g: 70, b: 50 },
    shoes: { r: 55, g: 40, b: 25 },
    eyes: { r: 80, g: 60, b: 40 },
    outline: { r: 30, g: 25, b: 15 },
    bodyW: 13, headR: 7,
    features: ['apron'],
  },
  npc_guildmaster: {
    skin: { r: 215, g: 180, b: 145 },
    hair: { r: 150, g: 150, b: 160 },
    hairStyle: 'short',
    shirt: { r: 50, g: 40, b: 105 },
    pants: { r: 40, g: 35, b: 72 },
    shoes: { r: 38, g: 32, b: 50 },
    eyes: { r: 60, g: 60, b: 120 },
    outline: { r: 20, g: 15, b: 35 },
    bodyW: 11, headR: 6,
    features: ['cape', 'shoulder_pads'],
  },
  npc_guard: {
    skin: { r: 210, g: 175, b: 140 },
    hair: { r: 60, g: 50, b: 40 },
    hairStyle: 'hidden',
    shirt: { r: 125, g: 125, b: 135 },
    pants: { r: 80, g: 80, b: 90 },
    shoes: { r: 55, g: 55, b: 60 },
    eyes: { r: 60, g: 80, b: 100 },
    outline: { r: 25, g: 25, b: 30 },
    bodyW: 11, headR: 6,
    features: ['helmet', 'spear'],
  },
  npc_wanderer: {
    skin: { r: 200, g: 165, b: 130 },
    hair: { r: 80, g: 60, b: 40 },
    hairStyle: 'long',
    shirt: { r: 90, g: 80, b: 60 },
    pants: { r: 70, g: 60, b: 45 },
    shoes: { r: 50, g: 40, b: 25 },
    eyes: { r: 80, g: 100, b: 60 },
    outline: { r: 25, g: 20, b: 15 },
    bodyW: 10, headR: 6,
    features: ['hood', 'staff'],
  },
}

// Monster templates (humanoid-ish ones)
const MONSTER_TEMPLATES = {
  monster_goblin: {
    skin: { r: 80, g: 140, b: 60 },
    hair: { r: 50, g: 60, b: 30 },
    hairStyle: 'bald',
    shirt: { r: 100, g: 80, b: 50 },
    pants: { r: 70, g: 55, b: 35 },
    shoes: { r: 50, g: 40, b: 25 },
    eyes: { r: 220, g: 60, b: 30 },
    outline: { r: 25, g: 35, b: 15 },
    bodyW: 8, headR: 6,
    features: ['pointy_ears', 'tusks'],
    heightMod: -4,
  },
  monster_skeleton: {
    skin: { r: 220, g: 215, b: 200 },
    hair: { r: 200, g: 195, b: 180 },
    hairStyle: 'bald',
    shirt: { r: 200, g: 195, b: 185 },
    pants: { r: 190, g: 185, b: 175 },
    shoes: { r: 200, g: 195, b: 185 },
    eyes: { r: 180, g: 40, b: 30 },
    outline: { r: 60, g: 55, b: 50 },
    bodyW: 8, headR: 6,
    features: ['skeleton'],
  },
}

// ── Humanoid character drawer ──

function drawHumanoidFrame(png, fx, fy, dir, frame, t) {
  const cx = fx + 16  // center x
  const hMod = t.heightMod || 0

  // Vertical positions (adjusted for height mod)
  const headCY = fy + 12 + hMod
  const bodyTop = fy + 18 + hMod
  const bodyBot = fy + 32
  const legTop = fy + 32
  const legBot = fy + 42
  const footY = fy + 42

  const halfBody = Math.floor(t.bodyW / 2)
  const isSkeleton = t.features?.includes('skeleton')

  // Walk offsets for legs
  const walkShift = frame === 0 ? -2 : frame === 2 ? 2 : 0

  // ── Shadow ──
  fillEllipse(png, cx, fy + 45, 8, 2, { r: 0, g: 0, b: 0 }, 60)

  // ── Draw order depends on direction ──
  if (dir === 'down') {
    drawHumanoidDown(png, cx, headCY, bodyTop, bodyBot, legTop, legBot, footY, halfBody, walkShift, t, isSkeleton)
  } else if (dir === 'up') {
    drawHumanoidUp(png, cx, headCY, bodyTop, bodyBot, legTop, legBot, footY, halfBody, walkShift, t, isSkeleton)
  } else if (dir === 'left') {
    drawHumanoidSide(png, cx, headCY, bodyTop, bodyBot, legTop, legBot, footY, halfBody, walkShift, t, -1, isSkeleton)
  } else {
    drawHumanoidSide(png, cx, headCY, bodyTop, bodyBot, legTop, legBot, footY, halfBody, walkShift, t, 1, isSkeleton)
  }
}

function drawHumanoidDown(png, cx, headCY, bodyTop, bodyBot, legTop, legBot, footY, halfBody, walkShift, t, isSkeleton) {
  const skinD = darken(t.skin, 0.85)

  // Back features (cape, wings) drawn first
  if (t.features?.includes('cape')) {
    fillRect(png, cx - halfBody + 1, bodyTop - 1, halfBody * 2 - 2, bodyBot - bodyTop + 8, darken(t.shirt, 0.6), 200)
  }
  if (t.features?.includes('wings')) {
    fillEllipse(png, cx - halfBody - 4, bodyTop + 4, 4, 8, { r: 200, g: 220, b: 255 }, 140)
    fillEllipse(png, cx + halfBody + 4, bodyTop + 4, 4, 8, { r: 200, g: 220, b: 255 }, 140)
  }

  // Legs
  const legW = isSkeleton ? 2 : 3
  const leftLegX = cx - 3 + walkShift
  const rightLegX = cx + 1 - walkShift
  fillRect(png, leftLegX, legTop, legW, legBot - legTop, t.pants)
  fillRect(png, rightLegX, legTop, legW, legBot - legTop, t.pants)
  // Shoes
  fillRect(png, leftLegX - (isSkeleton ? 0 : 1), footY, legW + (isSkeleton ? 0 : 1), 2, t.shoes)
  fillRect(png, rightLegX, footY, legW + (isSkeleton ? 0 : 1), 2, t.shoes)

  // Body / torso
  if (isSkeleton) {
    // Ribcage look
    fillRect(png, cx - halfBody, bodyTop, halfBody * 2, 3, t.shirt)
    fillRect(png, cx - 1, bodyTop, 2, bodyBot - bodyTop, t.shirt)
    for (let i = 0; i < 3; i++) {
      fillRect(png, cx - halfBody + 1, bodyTop + 3 + i * 3, halfBody * 2 - 2, 1, t.shirt)
    }
  } else {
    fillRect(png, cx - halfBody, bodyTop, halfBody * 2, bodyBot - bodyTop, t.shirt)
    // Shirt shadow
    fillRect(png, cx - halfBody, bodyTop, 2, bodyBot - bodyTop, darken(t.shirt, 0.8), 80)
    // Belt line
    fillRect(png, cx - halfBody, bodyBot - 2, halfBody * 2, 1, darken(t.pants, 0.7))
  }

  // Apron (innkeeper)
  if (t.features?.includes('apron')) {
    fillRect(png, cx - 4, bodyTop + 4, 8, bodyBot - bodyTop - 2, { r: 240, g: 235, b: 225 })
  }

  // Pack (merchant) - on back, visible on sides
  if (t.features?.includes('pack')) {
    fillRect(png, cx + halfBody, bodyTop + 2, 4, 8, darken(t.shirt, 0.6))
    fillRect(png, cx + halfBody, bodyTop + 2, 4, 1, darken(t.shirt, 0.4))
  }

  // Arms
  const armW = isSkeleton ? 1 : 2
  const armShift = walkShift !== 0 ? 1 : 0
  fillRect(png, cx - halfBody - armW, bodyTop + 1 - armShift, armW, 10 + armShift, t.shirt)
  fillRect(png, cx + halfBody, bodyTop + 1 + armShift, armW, 10 - armShift, t.shirt)
  // Hands
  fillRect(png, cx - halfBody - armW, bodyTop + 10 - armShift, armW, 2, t.skin)
  fillRect(png, cx + halfBody, bodyTop + 10 + armShift, armW, 2, t.skin)

  // Shoulder pads
  if (t.features?.includes('shoulder_pads')) {
    fillRect(png, cx - halfBody - 2, bodyTop - 1, 4, 3, darken(t.shirt, 0.6))
    fillRect(png, cx + halfBody - 2, bodyTop - 1, 4, 3, darken(t.shirt, 0.6))
  }

  // Spear (guard)
  if (t.features?.includes('spear')) {
    fillRect(png, cx + halfBody + 2, bodyTop - 8, 1, 20, { r: 100, g: 80, b: 50 })
    fillRect(png, cx + halfBody + 1, bodyTop - 10, 3, 3, { r: 160, g: 160, b: 170 })
  }

  // Staff (wanderer)
  if (t.features?.includes('staff')) {
    fillRect(png, cx - halfBody - 3, bodyTop - 6, 1, 22, { r: 100, g: 75, b: 45 })
    fillEllipse(png, cx - halfBody - 3, bodyTop - 7, 2, 2, { r: 140, g: 200, b: 140 }, 180)
  }

  // Neck
  fillRect(png, cx - 2, headCY + t.headR - 1, 4, 3, t.skin)

  // Head
  fillEllipse(png, cx, headCY, t.headR, t.headR, t.skin)
  // Head outline (top arc)
  fillEllipse(png, cx, headCY - 1, t.headR + 1, t.headR, t.outline, 40)
  fillEllipse(png, cx, headCY, t.headR, t.headR, t.skin)

  // Eyes
  const eyeY = headCY + 1
  if (t.features?.includes('glowing_eyes')) {
    setPixel(png, cx - 2, eyeY, t.eyes)
    setPixel(png, cx + 2, eyeY, t.eyes)
    setPixel(png, cx - 2, eyeY - 1, t.eyes, 80)
    setPixel(png, cx + 2, eyeY - 1, t.eyes, 80)
  } else {
    // White of eyes
    setPixel(png, cx - 3, eyeY, { r: 240, g: 240, b: 240 })
    setPixel(png, cx - 2, eyeY, t.eyes)
    setPixel(png, cx + 2, eyeY, t.eyes)
    setPixel(png, cx + 3, eyeY, { r: 240, g: 240, b: 240 })
  }

  // Mouth (tiny line)
  if (!isSkeleton) {
    setPixel(png, cx - 1, headCY + 3, darken(t.skin, 0.7))
    setPixel(png, cx, headCY + 3, darken(t.skin, 0.7))
  } else {
    // Skeleton jaw
    for (let i = -2; i <= 2; i++) {
      setPixel(png, cx + i, headCY + 3, t.outline, 120)
    }
  }

  // Tusks
  if (t.features?.includes('tusks')) {
    setPixel(png, cx - 3, headCY + 3, { r: 230, g: 220, b: 190 })
    setPixel(png, cx + 3, headCY + 3, { r: 230, g: 220, b: 190 })
  }

  // Hair
  drawHair(png, cx, headCY, t.headR, 'down', t)

  // Pointy ears
  if (t.features?.includes('pointy_ears')) {
    setPixel(png, cx - t.headR - 1, headCY - 1, t.skin)
    setPixel(png, cx - t.headR - 2, headCY - 2, t.skin)
    setPixel(png, cx + t.headR + 1, headCY - 1, t.skin)
    setPixel(png, cx + t.headR + 2, headCY - 2, t.skin)
  }

  // Animal ears
  if (t.features?.includes('animal_ears')) {
    fillRect(png, cx - t.headR + 1, headCY - t.headR - 3, 3, 4, darken(t.skin, 0.9))
    fillRect(png, cx + t.headR - 3, headCY - t.headR - 3, 3, 4, darken(t.skin, 0.9))
  }

  // Horns
  if (t.features?.includes('horns')) {
    fillRect(png, cx - t.headR + 1, headCY - t.headR - 2, 2, 4, { r: 80, g: 60, b: 50 })
    fillRect(png, cx + t.headR - 2, headCY - t.headR - 2, 2, 4, { r: 80, g: 60, b: 50 })
  }

  // Helmet
  if (t.features?.includes('helmet')) {
    fillEllipse(png, cx, headCY - 2, t.headR + 1, t.headR - 1, { r: 140, g: 140, b: 150 })
    fillRect(png, cx - t.headR - 1, headCY - 1, t.headR * 2 + 3, 2, { r: 120, g: 120, b: 130 })
    // Visor slit
    fillRect(png, cx - 3, headCY + 1, 6, 1, { r: 40, g: 40, b: 50 })
  }

  // Hood
  if (t.features?.includes('hood')) {
    fillEllipse(png, cx, headCY - 1, t.headR + 2, t.headR + 1, darken(t.shirt, 0.7))
    // Face opening
    fillEllipse(png, cx, headCY + 1, t.headR - 2, t.headR - 2, t.skin)
    setPixel(png, cx - 2, eyeY, t.eyes)
    setPixel(png, cx + 2, eyeY, t.eyes)
  }

  // Tail
  if (t.features?.includes('tail')) {
    const tailC = darken(t.skin, 0.85)
    setPixel(png, cx + halfBody + 1, bodyBot - 1, tailC)
    setPixel(png, cx + halfBody + 2, bodyBot, tailC)
    setPixel(png, cx + halfBody + 3, bodyBot + 1, tailC)
  }
}

function drawHumanoidUp(png, cx, headCY, bodyTop, bodyBot, legTop, legBot, footY, halfBody, walkShift, t, isSkeleton) {
  // Similar to down but no face details, hair covers back of head

  // Wings behind body
  if (t.features?.includes('wings')) {
    fillEllipse(png, cx - halfBody - 4, bodyTop + 4, 4, 8, { r: 200, g: 220, b: 255 }, 140)
    fillEllipse(png, cx + halfBody + 4, bodyTop + 4, 4, 8, { r: 200, g: 220, b: 255 }, 140)
  }

  // Cape
  if (t.features?.includes('cape')) {
    fillRect(png, cx - halfBody - 1, bodyTop - 1, halfBody * 2 + 2, bodyBot - bodyTop + 8, darken(t.shirt, 0.6), 220)
  }

  // Legs
  const legW = isSkeleton ? 2 : 3
  fillRect(png, cx - 3 + walkShift, legTop, legW, legBot - legTop, t.pants)
  fillRect(png, cx + 1 - walkShift, legTop, legW, legBot - legTop, t.pants)
  fillRect(png, cx - 3 + walkShift, footY, legW + (isSkeleton ? 0 : 1), 2, t.shoes)
  fillRect(png, cx + 1 - walkShift, footY, legW + (isSkeleton ? 0 : 1), 2, t.shoes)

  // Body
  if (isSkeleton) {
    fillRect(png, cx - 1, bodyTop, 2, bodyBot - bodyTop, t.shirt)
    fillRect(png, cx - halfBody, bodyTop, halfBody * 2, 2, t.shirt)
  } else {
    fillRect(png, cx - halfBody, bodyTop, halfBody * 2, bodyBot - bodyTop, darken(t.shirt, 0.85))
    fillRect(png, cx - halfBody, bodyBot - 2, halfBody * 2, 1, darken(t.pants, 0.7))
  }

  // Pack (merchant)
  if (t.features?.includes('pack')) {
    fillRect(png, cx - 4, bodyTop + 1, 8, 8, darken(t.shirt, 0.5))
    fillRect(png, cx - 4, bodyTop + 1, 8, 1, darken(t.shirt, 0.35))
  }

  // Arms
  const armW = isSkeleton ? 1 : 2
  const armShift = walkShift !== 0 ? 1 : 0
  fillRect(png, cx - halfBody - armW, bodyTop + 1 + armShift, armW, 10, darken(t.shirt, 0.85))
  fillRect(png, cx + halfBody, bodyTop + 1 - armShift, armW, 10, darken(t.shirt, 0.85))
  fillRect(png, cx - halfBody - armW, bodyTop + 10 + armShift, armW, 2, t.skin)
  fillRect(png, cx + halfBody, bodyTop + 10 - armShift, armW, 2, t.skin)

  // Spear
  if (t.features?.includes('spear')) {
    fillRect(png, cx + halfBody + 2, bodyTop - 8, 1, 20, { r: 100, g: 80, b: 50 })
    fillRect(png, cx + halfBody + 1, bodyTop - 10, 3, 3, { r: 160, g: 160, b: 170 })
  }

  // Staff
  if (t.features?.includes('staff')) {
    fillRect(png, cx - halfBody - 3, bodyTop - 6, 1, 22, { r: 100, g: 75, b: 45 })
  }

  // Neck
  fillRect(png, cx - 2, headCY + t.headR - 1, 4, 3, t.skin)

  // Head (from behind - show hair mostly)
  fillEllipse(png, cx, headCY, t.headR, t.headR, t.skin)

  // Hair covers back of head
  drawHair(png, cx, headCY, t.headR, 'up', t)

  // Helmet from behind
  if (t.features?.includes('helmet')) {
    fillEllipse(png, cx, headCY - 1, t.headR + 1, t.headR, { r: 130, g: 130, b: 140 })
    fillRect(png, cx - t.headR - 1, headCY, t.headR * 2 + 3, 2, { r: 110, g: 110, b: 120 })
  }

  // Hood
  if (t.features?.includes('hood')) {
    fillEllipse(png, cx, headCY, t.headR + 2, t.headR + 1, darken(t.shirt, 0.65))
  }

  // Animal ears
  if (t.features?.includes('animal_ears')) {
    fillRect(png, cx - t.headR + 1, headCY - t.headR - 3, 3, 4, darken(t.skin, 0.9))
    fillRect(png, cx + t.headR - 3, headCY - t.headR - 3, 3, 4, darken(t.skin, 0.9))
  }

  // Horns
  if (t.features?.includes('horns')) {
    fillRect(png, cx - t.headR + 1, headCY - t.headR - 2, 2, 4, { r: 80, g: 60, b: 50 })
    fillRect(png, cx + t.headR - 2, headCY - t.headR - 2, 2, 4, { r: 80, g: 60, b: 50 })
  }

  // Tail
  if (t.features?.includes('tail')) {
    const tailC = darken(t.skin, 0.85)
    setPixel(png, cx, bodyBot, tailC)
    setPixel(png, cx, bodyBot + 1, tailC)
    setPixel(png, cx + 1, bodyBot + 2, tailC)
  }
}

function drawHumanoidSide(png, cx, headCY, bodyTop, bodyBot, legTop, legBot, footY, halfBody, walkShift, t, faceDir, isSkeleton) {
  // faceDir: -1 = left, +1 = right
  const sideBodyW = Math.max(5, Math.floor(halfBody * 1.2))
  const bodyLeft = cx - Math.floor(sideBodyW / 2)

  // Wings
  if (t.features?.includes('wings')) {
    const wingX = faceDir < 0 ? cx + 3 : cx - 7
    fillEllipse(png, wingX, bodyTop + 2, 4, 9, { r: 200, g: 220, b: 255 }, 130)
  }

  // Cape (behind)
  if (t.features?.includes('cape')) {
    const capeX = faceDir < 0 ? cx + 2 : cx - sideBodyW
    fillRect(png, capeX, bodyTop - 1, sideBodyW - 2, bodyBot - bodyTop + 6, darken(t.shirt, 0.6), 200)
  }

  // Legs (side view: overlapping, walk shifts them forward/back)
  const legW = isSkeleton ? 2 : 3
  // Back leg
  const backLegX = cx - 1 - walkShift * faceDir
  fillRect(png, backLegX, legTop, legW, legBot - legTop, darken(t.pants, 0.8))
  fillRect(png, backLegX, footY, legW, 2, darken(t.shoes, 0.8))
  // Front leg
  const frontLegX = cx - 1 + walkShift * faceDir
  fillRect(png, frontLegX, legTop, legW, legBot - legTop, t.pants)
  fillRect(png, frontLegX, footY, legW, 2, t.shoes)

  // Body (narrower from side)
  if (isSkeleton) {
    fillRect(png, cx - 1, bodyTop, 2, bodyBot - bodyTop, t.shirt)
    fillRect(png, bodyLeft, bodyTop, sideBodyW, 2, t.shirt)
  } else {
    fillRect(png, bodyLeft, bodyTop, sideBodyW, bodyBot - bodyTop, t.shirt)
    fillRect(png, bodyLeft, bodyBot - 2, sideBodyW, 1, darken(t.pants, 0.7))
  }

  // Apron
  if (t.features?.includes('apron')) {
    fillRect(png, bodyLeft + 1, bodyTop + 4, sideBodyW - 2, bodyBot - bodyTop - 2, { r: 240, g: 235, b: 225 })
  }

  // Pack
  if (t.features?.includes('pack')) {
    const packX = faceDir < 0 ? cx + Math.floor(sideBodyW / 2) : cx - Math.floor(sideBodyW / 2) - 3
    fillRect(png, packX, bodyTop + 1, 3, 7, darken(t.shirt, 0.55))
  }

  // Shoulder pads
  if (t.features?.includes('shoulder_pads')) {
    fillRect(png, bodyLeft - 1, bodyTop - 1, sideBodyW + 2, 3, darken(t.shirt, 0.6))
  }

  // Arms - front arm visible, back arm hidden
  const armX = faceDir < 0 ? bodyLeft - 2 : bodyLeft + sideBodyW
  const armShift = walkShift !== 0 ? 1 : 0
  if (!isSkeleton) {
    fillRect(png, armX, bodyTop + 2 - armShift, 2, 9, t.shirt)
    fillRect(png, armX, bodyTop + 10 - armShift, 2, 2, t.skin)
  } else {
    fillRect(png, armX, bodyTop + 2, 1, 9, t.shirt)
  }

  // Spear
  if (t.features?.includes('spear')) {
    const spearX = faceDir < 0 ? bodyLeft - 3 : bodyLeft + sideBodyW + 1
    fillRect(png, spearX, bodyTop - 8, 1, 22, { r: 100, g: 80, b: 50 })
    fillRect(png, spearX - 1, bodyTop - 10, 3, 3, { r: 160, g: 160, b: 170 })
  }

  // Staff
  if (t.features?.includes('staff')) {
    const staffX = faceDir < 0 ? bodyLeft + sideBodyW + 1 : bodyLeft - 3
    fillRect(png, staffX, bodyTop - 6, 1, 22, { r: 100, g: 75, b: 45 })
    fillEllipse(png, staffX, bodyTop - 7, 2, 2, { r: 140, g: 200, b: 140 }, 180)
  }

  // Neck
  fillRect(png, cx - 1, headCY + t.headR - 1, 3, 3, t.skin)

  // Head
  fillEllipse(png, cx, headCY, t.headR - 1, t.headR, t.skin)

  // Eye (one visible on side facing us)
  const eyeX = cx + faceDir * 2
  const eyeY = headCY + 1
  if (t.features?.includes('glowing_eyes')) {
    setPixel(png, eyeX, eyeY, t.eyes)
    setPixel(png, eyeX, eyeY - 1, t.eyes, 80)
  } else if (!t.features?.includes('helmet') && !t.features?.includes('hood')) {
    setPixel(png, eyeX, eyeY, t.eyes)
    setPixel(png, eyeX + faceDir, eyeY, { r: 240, g: 240, b: 240 })
  }

  // Mouth
  if (!isSkeleton && !t.features?.includes('helmet') && !t.features?.includes('hood')) {
    setPixel(png, cx + faceDir * 1, headCY + 3, darken(t.skin, 0.7))
  }

  // Tusks
  if (t.features?.includes('tusks')) {
    setPixel(png, cx + faceDir * (t.headR - 1), headCY + 3, { r: 230, g: 220, b: 190 })
  }

  // Hair (side view)
  drawHair(png, cx, headCY, t.headR, faceDir < 0 ? 'left' : 'right', t)

  // Pointy ears
  if (t.features?.includes('pointy_ears')) {
    const earX = cx - faceDir * (t.headR)
    setPixel(png, earX, headCY - 2, t.skin)
    setPixel(png, earX - faceDir, headCY - 3, t.skin)
  }

  // Animal ears
  if (t.features?.includes('animal_ears')) {
    fillRect(png, cx - 1, headCY - t.headR - 3, 3, 4, darken(t.skin, 0.9))
  }

  // Horns
  if (t.features?.includes('horns')) {
    const hornX = cx + faceDir * 2
    fillRect(png, hornX, headCY - t.headR - 3, 2, 4, { r: 80, g: 60, b: 50 })
  }

  // Helmet
  if (t.features?.includes('helmet')) {
    fillEllipse(png, cx, headCY - 2, t.headR, t.headR - 1, { r: 135, g: 135, b: 145 })
    fillRect(png, cx - t.headR, headCY, t.headR * 2 + 1, 2, { r: 115, g: 115, b: 125 })
    // Visor
    setPixel(png, cx + faceDir * 2, headCY + 1, { r: 40, g: 40, b: 50 })
    setPixel(png, cx + faceDir * 3, headCY + 1, { r: 40, g: 40, b: 50 })
  }

  // Hood
  if (t.features?.includes('hood')) {
    fillEllipse(png, cx, headCY, t.headR + 1, t.headR + 1, darken(t.shirt, 0.65))
    // Face opening
    const openX = cx + faceDir * 1
    fillEllipse(png, openX, headCY + 1, t.headR - 3, t.headR - 2, t.skin)
    setPixel(png, eyeX, eyeY, t.eyes)
  }

  // Tail (behind)
  if (t.features?.includes('tail')) {
    const tailDir = -faceDir
    const tailC = darken(t.skin, 0.85)
    setPixel(png, cx + tailDir * (Math.floor(sideBodyW / 2) + 1), bodyBot - 1, tailC)
    setPixel(png, cx + tailDir * (Math.floor(sideBodyW / 2) + 2), bodyBot, tailC)
    setPixel(png, cx + tailDir * (Math.floor(sideBodyW / 2) + 3), bodyBot, tailC)
  }
}

// ── Hair drawer ──

function drawHair(png, cx, headCY, headR, dir, t) {
  if (t.features?.includes('helmet') || t.features?.includes('hood')) return

  const hc = t.hair
  const hd = darken(hc, 0.8)

  switch (t.hairStyle) {
    case 'short':
      if (dir === 'down' || dir === 'left' || dir === 'right') {
        fillEllipse(png, cx, headCY - 3, headR + 1, headR - 2, hc)
        fillRect(png, cx - headR, headCY - headR, headR * 2 + 1, 4, hc)
      }
      if (dir === 'up') {
        fillEllipse(png, cx, headCY - 2, headR + 1, headR, hc)
      }
      break
    case 'long':
      if (dir === 'down') {
        fillEllipse(png, cx, headCY - 3, headR + 1, headR - 1, hc)
        fillRect(png, cx - headR - 1, headCY - 1, 3, 10, hc)
        fillRect(png, cx + headR - 1, headCY - 1, 3, 10, hc)
      } else if (dir === 'up') {
        fillEllipse(png, cx, headCY, headR + 1, headR + 1, hc)
        fillRect(png, cx - headR, headCY, headR * 2 + 1, 8, hc)
      } else {
        const fd = dir === 'left' ? -1 : 1
        fillEllipse(png, cx, headCY - 3, headR, headR - 1, hc)
        fillRect(png, cx - fd * headR - 1, headCY - 1, 3, 10, hc)
      }
      break
    case 'mohawk':
      fillRect(png, cx - 2, headCY - headR - 3, 4, 5, hc)
      fillRect(png, cx - 1, headCY - headR - 4, 2, 2, hd)
      break
    case 'ponytail':
      if (dir === 'down' || dir === 'left' || dir === 'right') {
        fillEllipse(png, cx, headCY - 3, headR, headR - 2, hc)
      }
      if (dir === 'up' || dir === 'left' || dir === 'right') {
        fillRect(png, cx - 1, headCY + headR - 2, 2, 8, hc)
      }
      break
    case 'bald':
      // No hair — slight highlight on head
      if (dir === 'down') {
        fillEllipse(png, cx, headCY - 2, 3, 2, lighten(t.skin, 1.1), 60)
      }
      break
    case 'hidden':
      // Hair hidden by helmet/hood
      break
    default:
      // Fallback short hair
      fillEllipse(png, cx, headCY - 3, headR, headR - 2, hc)
      break
  }

  // Beard (dwarf)
  if (t.features?.includes('beard')) {
    const bc = darken(hc, 0.9)
    if (dir === 'down') {
      fillRect(png, cx - 3, headCY + 2, 6, 5, bc)
      fillRect(png, cx - 2, headCY + 6, 4, 2, bc)
    } else if (dir !== 'up') {
      const fd = dir === 'left' ? -1 : 1
      fillRect(png, cx + fd * 1, headCY + 2, 3, 5, bc)
      fillRect(png, cx + fd * 1, headCY + 6, 2, 2, bc)
    }
  }
}

// ── Wolf (quadruped) drawer ──

function drawWolfFrame(png, fx, fy, dir, frame) {
  const cx = fx + 16
  const bodyY = fy + 26
  const fur = { r: 130, g: 120, b: 105 }
  const furD = darken(fur, 0.75)
  const furL = lighten(fur, 1.15)
  const eyes = { r: 200, g: 180, b: 40 }
  const nose = { r: 40, g: 30, b: 25 }

  const walkOff = frame === 0 ? -2 : frame === 2 ? 2 : 0

  // Shadow
  fillEllipse(png, cx, fy + 44, 10, 2, { r: 0, g: 0, b: 0 }, 50)

  if (dir === 'down') {
    // Body (oval from above)
    fillEllipse(png, cx, bodyY, 7, 10, fur)
    fillEllipse(png, cx, bodyY - 2, 6, 5, furL, 60)
    // Legs (4 legs visible, front pair ahead of back)
    fillRect(png, cx - 5 + walkOff, bodyY + 6, 2, 8, furD)
    fillRect(png, cx + 4 - walkOff, bodyY + 6, 2, 8, furD)
    fillRect(png, cx - 3 - walkOff, bodyY + 8, 2, 6, fur)
    fillRect(png, cx + 2 + walkOff, bodyY + 8, 2, 6, fur)
    // Paws
    fillRect(png, cx - 6 + walkOff, fy + 41, 3, 2, furD)
    fillRect(png, cx + 4 - walkOff, fy + 41, 3, 2, furD)
    // Head
    fillEllipse(png, cx, bodyY - 9, 5, 4, fur)
    // Ears
    fillRect(png, cx - 4, bodyY - 14, 2, 3, furD)
    fillRect(png, cx + 3, bodyY - 14, 2, 3, furD)
    // Eyes
    setPixel(png, cx - 2, bodyY - 9, eyes)
    setPixel(png, cx + 2, bodyY - 9, eyes)
    // Snout
    setPixel(png, cx, bodyY - 6, nose)
  } else if (dir === 'up') {
    fillEllipse(png, cx, bodyY, 7, 10, fur)
    // Tail
    fillRect(png, cx - 1, bodyY - 12, 2, 5, furD)
    // Legs
    fillRect(png, cx - 5 - walkOff, bodyY + 6, 2, 8, furD)
    fillRect(png, cx + 4 + walkOff, bodyY + 6, 2, 8, furD)
    fillRect(png, cx - 3 + walkOff, bodyY + 8, 2, 6, fur)
    fillRect(png, cx + 2 - walkOff, bodyY + 8, 2, 6, fur)
    // Head from behind
    fillEllipse(png, cx, bodyY - 9, 5, 4, fur)
    fillRect(png, cx - 4, bodyY - 14, 2, 3, furD)
    fillRect(png, cx + 3, bodyY - 14, 2, 3, furD)
  } else {
    // Side view (left or right)
    const fd = dir === 'left' ? -1 : 1
    // Body (long horizontal oval)
    fillEllipse(png, cx, bodyY, 10, 5, fur)
    fillEllipse(png, cx - fd * 2, bodyY - 1, 8, 3, furL, 50)
    // Tail
    fillRect(png, cx - fd * 10, bodyY - 4, 3, 2, furD)
    fillRect(png, cx - fd * 11, bodyY - 6, 2, 3, furD)
    // Back legs
    fillRect(png, cx - fd * 5 - walkOff, bodyY + 3, 2, 10, furD)
    fillRect(png, cx - fd * 3 + walkOff, bodyY + 3, 2, 10, fur)
    // Front legs
    fillRect(png, cx + fd * 4 + walkOff, bodyY + 3, 2, 10, furD)
    fillRect(png, cx + fd * 6 - walkOff, bodyY + 3, 2, 10, fur)
    // Paws
    fillRect(png, cx + fd * 4 + walkOff, fy + 41, 3, 2, furD)
    fillRect(png, cx - fd * 5 - walkOff, fy + 41, 3, 2, furD)
    // Head (extending forward)
    fillEllipse(png, cx + fd * 9, bodyY - 3, 4, 4, fur)
    // Ear
    fillRect(png, cx + fd * 8, bodyY - 8, 2, 3, furD)
    // Eye
    setPixel(png, cx + fd * 10, bodyY - 4, eyes)
    // Snout
    fillRect(png, cx + fd * 12, bodyY - 2, 2, 2, furD)
    setPixel(png, cx + fd * 13, bodyY - 1, nose)
  }
}

// ── Slime drawer ──

function drawSlimeFrame(png, fx, fy, dir, frame) {
  const cx = fx + 16
  const baseY = fy + 34

  // Slime squish animation
  const squish = frame === 1 ? 0 : (frame === 0 ? 1 : -1)
  const rx = 9 + squish
  const ry = 8 - squish

  const body = { r: 60, g: 180, b: 80 }
  const bodyL = lighten(body, 1.3)
  const bodyD = darken(body, 0.6)
  const eyes = { r: 240, g: 240, b: 240 }
  const pupil = { r: 30, g: 30, b: 40 }

  // Shadow
  fillEllipse(png, cx, fy + 44, 8 + squish, 2, { r: 0, g: 0, b: 0 }, 50)

  // Body blob
  fillEllipse(png, cx, baseY, rx, ry, body, 200)
  // Highlight
  fillEllipse(png, cx - 2, baseY - 3, rx - 4, ry - 4, bodyL, 80)
  // Dark bottom
  fillEllipse(png, cx, baseY + 3, rx - 1, ry - 4, bodyD, 60)

  // Eyes (direction determines which way they look)
  if (dir === 'up') {
    // Eyes not visible from behind, just a slightly darker back
    fillEllipse(png, cx, baseY - 1, rx - 2, ry - 2, darken(body, 0.85), 60)
  } else {
    const eyeOffX = dir === 'left' ? -2 : dir === 'right' ? 2 : 0
    const eyeSpread = dir === 'down' ? 3 : 2

    // Left eye
    fillEllipse(png, cx - eyeSpread + eyeOffX, baseY - 3, 2, 2, eyes)
    setPixel(png, cx - eyeSpread + eyeOffX + (dir === 'right' ? 1 : 0), baseY - 3, pupil)
    // Right eye
    fillEllipse(png, cx + eyeSpread + eyeOffX, baseY - 3, 2, 2, eyes)
    setPixel(png, cx + eyeSpread + eyeOffX + (dir === 'right' ? 1 : 0), baseY - 3, pupil)

    // Mouth (only down view)
    if (dir === 'down') {
      setPixel(png, cx - 1, baseY, bodyD)
      setPixel(png, cx, baseY, bodyD)
      setPixel(png, cx + 1, baseY, bodyD)
    }
  }
}

// ── Main generation ──

function generateSheet(name, drawFn, template) {
  const png = createPNG(SHEET_W, SHEET_H)
  const dirs = ['down', 'left', 'right', 'up']

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const fx = col * FRAME_W
      const fy = row * FRAME_H
      drawFn(png, fx, fy, dirs[row], col, template)
    }
  }

  const buffer = PNG.sync.write(png)
  const outPath = path.join(OUTPUT_DIR, `${name}.png`)
  fs.writeFileSync(outPath, buffer)
  console.log(`  ✓ ${name}.png (${SHEET_W}x${SHEET_H})`)
}

function main() {
  console.log('Generating character spritesheets...')
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  // Humanoid characters (races + NPCs + humanoid monsters)
  for (const [name, template] of Object.entries(TEMPLATES)) {
    generateSheet(name, drawHumanoidFrame, template)
  }
  for (const [name, template] of Object.entries(MONSTER_TEMPLATES)) {
    generateSheet(name, drawHumanoidFrame, template)
  }

  // Wolf (quadruped)
  generateSheet('monster_wolf', drawWolfFrame, null)

  // Slime (blob)
  generateSheet('monster_slime', drawSlimeFrame, null)

  // Write metadata JSON
  const allNames = [
    ...Object.keys(TEMPLATES),
    ...Object.keys(MONSTER_TEMPLATES),
    'monster_wolf',
    'monster_slime',
  ]
  const metadata = {}
  for (const name of allNames) {
    metadata[name] = {
      frameWidth: FRAME_W,
      frameHeight: FRAME_H,
      cols: COLS,
      rows: ROWS,
      directions: ['down', 'left', 'right', 'up'],
      framesPerDirection: COLS,
    }
  }
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'character-metadata.json'),
    JSON.stringify(metadata, null, 2),
  )
  console.log(`  ✓ character-metadata.json`)
  console.log(`Done! Generated ${allNames.length} spritesheets.`)
}

main()
