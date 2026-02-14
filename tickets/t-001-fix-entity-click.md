# T-001: Fix Entity Click-Through (Agents, Monsters, Buildings)

## Objective
When clicking on agents, monsters, or buildings on the map, the terrain card appears instead of the entity card. Fix so that clicking an entity selects it without also triggering terrain selection.

## Non-goals
- Do not change visual appearance of entities
- Do not refactor the event system

## Root Cause
In `world-scene.ts`, agent/monster/building clicks fire on `pointerdown` (lines 1525, 2363, 1146), but the terrain selection handler fires on `pointerup` (line 496). On `pointerup`, `hitTestPointer(pointer)` may fail to find the entity container (e.g. if the container position was tweened during the click), causing `terrain:selected` to also fire. The React UI then shows the terrain card over the entity card.

## Fix Strategy
Add a flag `_objectClickedThisPress` that is set to `true` whenever any interactive game object's `pointerdown` fires. In the scene-level `pointerup` handler (line 496), check this flag and skip terrain selection if it was set. Reset the flag at the start of each `pointerdown`.

Specifically:
1. Add `private _objectClickedThisPress = false` to the class fields (around line 320)
2. In the scene-level `pointerdown` handler (line 447), add `this._objectClickedThisPress = false`
3. In each entity's `pointerdown` handler (agent line 1525, monster line 2363, building line 1146, resource line 1206), add `this._objectClickedThisPress = true` at the top
4. In the terrain `pointerup` handler (line 496), add `if (this._objectClickedThisPress) return` right after the `_wasDragged` check

## Files to touch
- `packages/client/src/game/scenes/world-scene.ts`

## Acceptance criteria
- Clicking an agent opens the agent card (CharacterCard), NOT the terrain card
- Clicking a monster opens the creature card (CreatureCard), NOT the terrain card
- Clicking a building opens the building card (BuildingCard), NOT the terrain card
- Clicking empty terrain still opens the terrain card (TerrainCard)
- Drag-to-pan still works without triggering any selection
- `./scripts/gate.sh` passes

## Risk notes
- Low risk: only adds a boolean flag and 5 guard checks
- No API changes
