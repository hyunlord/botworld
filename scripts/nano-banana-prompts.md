# Nano Banana Custom Asset Prompts for Botworld

Style reference: Kenney Tiny Town / Tiny Dungeon (16x16 pixel art, CC0).
All generated assets should match this color palette and pixel density.

## POI Buildings (32x64 or 64x64 sprites)

### Guild Hall
```
32x32 pixel art, top-down RPG building, medieval guild hall with
stone walls and wooden door, warm interior glow, matching Kenney
Tiny Town color palette, transparent background, clean pixel edges
```

### Magic Portal
```
32x32 pixel art, top-down RPG portal, swirling purple/blue energy
circle on stone pedestal, magical particle glow effect, matching
Kenney Tiny Town color palette, transparent background
```

### Temple / Shrine
```
32x32 pixel art, top-down RPG temple, white stone shrine with
golden roof accent, small altar, matching Kenney Tiny Town style,
transparent background
```

### Blacksmith
```
32x32 pixel art, top-down RPG blacksmith shop, stone building with
chimney smoke, anvil visible, warm orange/red glow from forge,
Kenney Tiny Town palette, transparent background
```

### Bakery / Food Shop
```
32x32 pixel art, top-down RPG bakery, cozy wooden building with
bread sign, warm yellow interior light, matching Kenney Tiny Town
color palette, transparent background
```

## Monster Sprites (16x16 or 32x32)

### Slime
```
16x16 pixel art, top-down RPG green slime monster, blobby shape
with eyes, semi-transparent, matching Kenney Tiny Dungeon style,
transparent background
```

### Goblin
```
16x16 pixel art, top-down RPG goblin, green skin, small pointed
ears, holding tiny club, Kenney Tiny Dungeon character style,
transparent background
```

### Skeleton
```
16x16 pixel art, top-down RPG skeleton warrior, white bones,
holding small sword, Kenney Tiny Dungeon style, transparent background
```

### Wolf
```
16x16 pixel art, top-down RPG wolf, gray fur, fierce eyes,
four-legged stance, Kenney Tiny Dungeon style, transparent background
```

### Dragon (Boss)
```
32x32 pixel art, top-down RPG dragon, red/orange scales, wings
spread, breathing fire particle, Kenney Tiny Dungeon style,
transparent background
```

## Item Icons (16x16)

### Magic Wand
```
16x16 pixel art RPG item icon, wooden magic wand with glowing
star tip, Kenney Tiny Dungeon item style, transparent background
```

### Health Potion
```
16x16 pixel art RPG item icon, red potion in glass flask,
heart symbol, Kenney Tiny Dungeon item style, transparent background
```

### Scroll
```
16x16 pixel art RPG item icon, rolled parchment scroll with
wax seal, Kenney Tiny Dungeon item style, transparent background
```

### Coin / Currency
```
16x16 pixel art RPG item icon, golden coin with star emblem,
shiny highlight, Kenney Tiny Dungeon item style, transparent background
```

### Key
```
16x16 pixel art RPG item icon, golden ornate key,
Kenney Tiny Dungeon item style, transparent background
```

## Special Effects (16x16 spritesheet frames)

### Emotion Bubble - Happy
```
16x16 pixel art, white speech bubble with yellow smiley face,
clean pixel edges, transparent background
```

### Emotion Bubble - Angry
```
16x16 pixel art, white speech bubble with red angry face,
clean pixel edges, transparent background
```

### Sparkle Effect
```
16x16 pixel art, yellow/white sparkle star burst, 4-frame
animation strip, transparent background
```

## Logo / Mascot

### Botworld Logo
```
64x64 pixel art, Botworld game logo, friendly robot/bot character
in a fantasy world setting, green grass, blue sky accent,
warm friendly style matching Kenney pixel art palette
```

## Usage Notes

1. Generate at the target resolution (16x16 or 32x32) for best results
2. After generation, verify pixel alignment and color consistency
3. Use nearest-neighbor scaling only (no bilinear/bicubic)
4. Save as PNG with transparent background
5. Place generated assets in `scripts/assets-raw/custom/`
6. Update `scripts/generate-terrain-sheet.js` if adding terrain tiles
7. For character sprites, ensure they face south (default RPG direction)

## Remaining Terrain Placeholders (21 tiles)

These 16x16 tiles still use colored placeholders and could be
hand-drawn or procedurally improved:

- swamp (dark green/brown wetland)
- water shore corners (8 directional water-grass transitions)
- water river H/V (flowing water with banks)
- rock_small, rock_large, rock_mossy (gray stone variations)
- ore_iron, ore_gold (metallic rock veins)
- flower_red, flower_blue, flower_yellow (small colorful flowers)
- fish_spot (dark water with bubble hint)
- pebbles (scattered small stones)

These are better created by hand in a pixel art editor (Aseprite,
Piskel, or LibreSprite) to match the exact Kenney tile dimensions
and style at 16x16 resolution.
