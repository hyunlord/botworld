# T-005: Improve Character Visual Quality

## Objective
Characters currently look like basic colored blobs. Improve the procedural character sprite generation to produce more recognizable humanoid figures with visual distinction between races, roles, and equipment.

## Non-goals
- Do not create new PNG art assets (keep procedural generation)
- Do not change the 14-layer sprite composition system
- Do not change the CharacterAppearance type

## Root Cause
The procedural fallback sprites in `boot-scene.ts` `generateCharacterSheetFallback()` (line 1020) draw very simple shapes: a circle for head, rectangle for body, and two rectangles for legs. All at 32x48 pixel scale. The result looks like a generic colored stick figure.

The 14-layer `composeCharacterSprite()` in `sprite-composer.ts` uses grayscale procedural textures (48x64) that are also very simple rounded rectangles. When tinted, they produce flat-looking characters.

## Fix Strategy
1. **Improve `generateCharacterSheetFallback()`** in boot-scene.ts:
   - Add distinct body proportions per race (dwarf=shorter+wider, elf=taller+slimmer, orc=bulkier)
   - Add simple clothing/armor outlines
   - Add hair silhouettes
   - Add 2-3 pixel detail elements (belt line, collar, boot line)
   - Keep within 32x48 frame size

2. **Improve procedural character parts** in boot-scene.ts `generateCharacterFallbacks()`:
   - Add shading gradients (darker edges) to body/armor/hair parts
   - Add simple detail elements to armors (chainmail pattern, plate segments)
   - Make hair styles more distinct (current ones all look like rounded rectangles)

3. **Add race-specific visual markers**:
   - Elf: pointed ear silhouettes visible in side frames
   - Dwarf: beard outline in front-facing frames
   - Orc: slightly green-tinted, tusks in front frame
   - Undead: slightly transparent, ragged edges

## Files to touch
- `packages/client/src/game/scenes/boot-scene.ts` — improve generateCharacterSheetFallback() and generateCharacterFallbacks()

## Acceptance criteria
- Characters are visually distinguishable by race at normal zoom
- Different armor types are visibly different
- Hair styles show variety
- Characters look like game characters, not colored rectangles
- `./scripts/gate.sh` passes

## Risk notes
- Low risk: only changes procedural texture generation
- Visual-only changes, no game logic affected
- Keep changes within existing texture dimensions (32x48 sheets, 48x64 parts)
