# T-006: Fix Bottom Panel UI Errors

## Objective
Clicking bottom toolbar buttons (🏆 Rankings, 📊 Statistics, 📜 Timeline, ⚖️ Compare) triggers "UI Error" from ErrorBoundary. Fix null/undefined access crashes and add defensive data handling.

## Non-goals
- Do not change panel layouts or visual design
- Do not add new API endpoints

## Root Cause
1. **RankingsPanel** (`RankingsPanel.tsx`):
   - `RankingBoard` component: `board.entries.map()` on line 63 called before null check on line 96 — crashes if entries is undefined
   - `ItemRankingBoard` component: same issue on line 112
   - `Object.entries(categoryData).map()` casts values as `RankingEntry[]` without verifying they are arrays (line 329)
   - `Object.entries(itemRankings).map()` same issue (line 306)

2. **StatsDashboard** (`StatsDashboard.tsx`):
   - `response.json()` called without checking `response.ok` (line 237) — crashes on non-JSON error responses

3. **All panels**: No timeout/fallback when backend server (`localhost:3001`) is unreachable — shows perpetual "Loading..." state

## Fix Strategy
1. Guard all `.map()` calls with `Array.isArray()` checks
2. Add `response.ok` checks before `.json()` calls
3. Add fetch timeout and "unable to connect" fallback states
4. Move null checks before map calls in JSX rendering

## Files to touch
- `packages/client/src/ui/RankingsPanel.tsx`
- `packages/client/src/ui/StatsDashboard.tsx`
- `packages/client/src/ui/TimelineView.tsx`
- `packages/client/src/ui/AgentCompare.tsx`

## Acceptance criteria
- All 4 toolbar buttons (🏆📊📜⚖️) open without "UI Error"
- Panels show meaningful fallback when API is unavailable
- No null/undefined crashes in console
- `./scripts/gate.sh` passes

## Risk notes
- Low risk: only defensive guards and UI fallbacks
- No game logic affected
