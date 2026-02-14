# T-004: Fix Deep Ocean Appearing on Land

## Objective
`deep_ocean` biome tiles (rendered as dark blue water) appear in the middle of continents where they shouldn't be. Fix by ensuring ocean biomes only appear connected to the main ocean body.

## Non-goals
- Do not change the elevation noise generation
- Do not change the Whittaker diagram biome rules fundamentally
- Small inland lakes are OK (they should be `water` type, not `deep_ocean`)

## Root Cause
In `biome-classifier.ts`, the `BIOME_TABLE` assigns `deep_ocean` to any tile with `elevation < 0.10` regardless of geographic context (line 31). When the fBm noise in `chunk-generator.ts` creates small pockets of very low elevation inland, they become `deep_ocean` — which looks wrong because deep ocean should only exist far from shore.

## Fix Strategy
Add a post-classification pass in `classifyBiomes()` (or a new exported function) that:

1. After initial classification, find all tiles classified as `deep_ocean` or `ocean`
2. Flood-fill from the map edges to find the "main ocean body" — any ocean tile reachable from the edge
3. Any `deep_ocean` or `ocean` tile NOT connected to the main ocean body is reclassified:
   - If surrounded mostly by land → convert to `swamp` (if moisture > 0.5) or `grassland` (otherwise)
   - Small isolated water bodies (< 20 tiles) → convert to `water` type with biome `lake` (keep it as a small lake, not ocean)

Alternative simpler approach:
- In `classifyBiome()`, add a minimum distance-from-edge check for `deep_ocean`: only classify as `deep_ocean` if the tile is within a certain range of the chunk edge (proxy for being near the world's ocean). This is less accurate but simpler.

**Recommended: flood-fill approach** applied after `classifyBiomes()` returns.

## Files to touch
- `packages/engine/src/world/generation/biome-classifier.ts` — add `fixInlandOcean()` function
- `packages/engine/src/world/generation/chunk-generator.ts` — call `fixInlandOcean()` after `classifyBiomes()`

## Acceptance criteria
- No `deep_ocean` tiles appear surrounded by land on all sides
- Coastal ocean tiles remain correctly classified
- Small inland water bodies become lakes or swamps (not deep ocean)
- Existing rivers and beaches are unaffected
- `./scripts/gate.sh` passes

## Risk notes
- Medium risk: changes world generation output (maps will look different from current)
- The flood-fill operates per-chunk, so truly inland ocean pockets within a single chunk are fixed, but cross-chunk ocean connectivity is limited to within-chunk analysis
- Test with multiple seeds to verify no regression
