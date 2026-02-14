# T-003: Fix Biome Boundary Smoothing (Straight Lines at Chunk Edges)

## Objective
Biome boundaries show harsh straight lines at chunk edges because the cellular automata smoothing in `smoothChunkTiles()` can't see tiles from neighboring chunks. Fix by passing neighbor chunk border data into the smoothing function.

## Non-goals
- Do not change the biome classification rules
- Do not change chunk size or generation order
- Do not add inter-chunk dependencies during initial generation (chunks should still generate independently)

## Root Cause
In `chunk-generator.ts`, `smoothChunkTiles(tiles, size)` (line 553) iterates `lx` from 0 to size-1 and `ly` from 0 to size-1. For edge tiles, neighbor lookups (`nx < 0 || nx >= size`) skip out-of-bounds tiles, so edge tiles have fewer neighbors and get smoothed less aggressively (threshold adjusts, but the missing data means they keep their original biome).

Meanwhile, the `biome-classifier.ts` `smoothBiomes()` function (line 257) only processes from `y=1` to `height-2`, `x=1` to `width-2` — explicitly skipping border tiles.

## Fix Strategy
**Option A (Recommended — Post-generation cross-chunk smoothing):**
After all chunks in a batch are generated, run a second smoothing pass that includes border data from adjacent chunks. In `tile-map.ts` or wherever chunks are assembled:
1. For each chunk, gather the 1-tile-wide border strips from its 4 neighbors (N/S/E/W)
2. Create a padded grid (size+2 x size+2) with the chunk in the center and neighbor borders around it
3. Run the existing `smoothBiomes()` from `biome-classifier.ts` on this padded grid
4. Copy the inner (size x size) result back to the chunk tiles

**Option B (Simpler — soften at boundaries):**
In `smoothChunkTiles()`, when a tile is on the chunk edge (lx=0, lx=size-1, ly=0, ly=size-1), use a higher threshold for smoothing OR skip smoothing entirely (let the biome-classifier's `smoothBiomes` handle the global smoothing).

Choose **Option A** for best results.

## Files to touch
- `packages/engine/src/world/generation/chunk-generator.ts` — modify or extend `smoothChunkTiles`
- `packages/engine/src/world/tile-map.ts` — add cross-chunk smoothing pass after chunk generation

## Acceptance criteria
- Biome transitions at chunk boundaries look smooth (no visible straight lines along chunk edges)
- The smoothing preserves biome identity (water doesn't bleed into land, etc.)
- Protected tile types (water, road, building, cliff, lava, ice) are still excluded from smoothing
- `./scripts/gate.sh` passes

## Risk notes
- Medium risk: modifying tile-map.ts affects world generation output
- Ensure rivers and roads placed after smoothing are not affected
- Test with multiple seeds to verify visual improvement
