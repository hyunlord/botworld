# T-002: Fix Asset Loading Failures (229 Failed Loads)

## Objective
Reduce the ~229 "Failed to process file" console errors during boot by not attempting to load PNG files that don't exist on disk. The procedural fallback system already generates replacement textures; we just need to stop requesting non-existent files.

## Non-goals
- Do not create new PNG art assets
- Do not remove the procedural fallback system (it's the safety net)
- Do not change any visual output — just stop the failed network requests

## Root Cause
`boot-scene.ts` preload() loads many asset categories by iterating arrays and constructing paths like `assets/resources/resource_wood.png`, `assets/actions/action_gather.png`, etc. Many of these PNGs were never created. Each failure logs an error and creates a 1x1 transparent canvas texture. The `create()` method then generates proper procedural fallbacks.

## Files that DO exist on disk (verified)
- `assets/tiles/` — 35 files including iso-terrain-sheet.png, terrain-sheet.png, biome tiles
- `assets/buildings/` — 48 files (all bldg_* and named buildings)
- `assets/characters/` — 26 files (race sprites/bases, NPC sprites, monster sprites)
- `assets/objects/` — 71 files
- `assets/resources/` — 31 files (res_* prefixed)
- `assets/items/` — 26 files
- `assets/ui/` — speech_bubble.png + subdirs (action_icons/, emotion_bubbles/, minimap_icons/)

## Fix Strategy
Wrap each load call with a check — only call `this.load.image()` / `this.load.spritesheet()` for files that exist. The simplest approach:

1. Create an `ASSET_MANIFEST` constant (or read from `assets/asset-manifest.json` which already exists) listing all available files
2. Add a helper method `loadIfExists(type, key, path, opts?)` that checks the manifest before loading
3. Replace direct `this.load.image()` / `this.load.spritesheet()` calls with the helper

Alternatively (simpler):
1. Read the existing `assets/asset-manifest.json` file in preload
2. Use it to filter which assets to attempt loading
3. Skip any asset not in the manifest

The `loaderror` handler (lines 125-133) should remain as a safety net.

## Files to touch
- `packages/client/src/game/scenes/boot-scene.ts`

## Acceptance criteria
- Console shows 0 (or near-zero) "Failed to process file" / loaderror messages
- All procedural fallback textures still generate correctly
- The world renders identically (buildings, terrain, agents all visible)
- `./scripts/gate.sh` passes

## Risk notes
- Low risk: only removes unnecessary network requests
- The loaderror handler remains as fallback safety
- If asset-manifest.json is stale, some real assets might not load (but fallbacks cover them)
