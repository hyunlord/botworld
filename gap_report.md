# Botworld Gap Analysis Report

**Generated**: 2026-02-13
**Analysis Target**: Full source code (`packages/engine`, `packages/client`, `packages/shared`)
**Reference Games**: Dwarf Fortress (Steam), WorldBox

## Summary

- **Total Items**: 105
- **✅ Implemented + Working**: 93
- **⚠️ Implemented + Broken/Unwired**: 8
- **❌ Not Implemented**: 1
- **🔍 Needs Verification**: 3

**Overall Completion: 88.6% fully working**

---

## Top 10 Most Critical Gaps

| # | ID | Description | Status | Impact |
|---|-----|-------------|--------|--------|
| 1 | A-10 | Underground layers (mines, caves, ruins) | ❌ | Entire gameplay dimension missing. Cave entrances are decoration-only. No dungeon exploration, mining depth, or vertical world. |
| 2 | D-07 | Equipment stat application to agents | ⚠️ | Items have `EquipmentStats` (11 stats) but Agent has no equipment slot system. Gear doesn't affect combat power. |
| 3 | B-10 | Agent/NPC death or knockout | ⚠️ | Only monsters can die. Agents/NPCs are immortal — no stakes, no consequence for combat failure. |
| 4 | F-09 | Tax collection dormant | ⚠️ | `collectTaxes()` exists but is never called in tick loop. Economy simulation is hollow. |
| 5 | G-06 | Animal reproduction not wired | ⚠️ | Breeding logic commented out in pack-manager.ts. Ecosystem has no population dynamics. |
| 6 | L-04 | World history has no AI narration | ⚠️ | Events are recorded with significance scores, but no LLM summarization/storytelling layer. |
| 7 | F-10 | No settlement/kingdom rebellion | ⚠️ | Guild coups work, but no peasant uprising, kingdom civil war, or settlement rebellion. |
| 8 | A-07 | Landmarks are decorative only | ⚠️ | Cave entrances, ancient ruins are surface decorations. No interior/dungeon system behind them. |
| 9 | A-05 | Biome boundary smoothing incomplete | ⚠️ | Cellular automata only runs on inner chunk tiles. Cross-chunk biome edges can be harsh. |
| 10 | C-09 | Combat visual effects on client | 🔍 | Combat events are emitted server-side. Client rendering of effects/damage numbers not confirmed. |

---

## Category Details

### A. World Generation

| ID | Item | Status | Related Files | Notes |
|----|------|--------|---------------|-------|
| A-01 | heightMap terrain generation | ✅ | `engine/src/world/generation/chunk-generator.ts:285-317` | 6-octave fBm noise + domain warping + ridged mountains |
| A-02 | moisture/temperature → biome | ✅ | `engine/src/world/generation/chunk-generator.ts:399-416` | Latitude-based temp + altitude cooling, fbm moisture → `classifyBiome()` |
| A-03 | 5+ visually distinct biomes | ✅ | `engine/src/world/generation/chunk-generator.ts:114-183` | 15+ biomes (grassland, forest, desert, tundra, swamp, alpine, etc.) with unique tiles + decorations |
| A-04 | Rivers flow high → low | ✅ | `engine/src/world/tile-map.ts:195-320` | `buildInitialRivers()`: highland sources, gradient descent, width increases downstream |
| A-05 | Biome boundary smoothing | ⚠️ | `engine/src/world/generation/chunk-generator.ts:553-600` | Cellular automata on inner tiles only (ly=1 to size-2). No cross-chunk smoothing. |
| A-06 | Settlements auto-placed with buildings | ✅ | `engine/src/world/generation/chunk-generator.ts:682-737` | 30% of chunks get POIs, biome-appropriate types, 3-tile clear zone |
| A-07 | Landmarks auto-placed | ⚠️ | `engine/src/world/tile-map.ts:418-490` | Volcano, ancient_ruins, giant_tree, cave_entrance placed. But decoration-only — no interior system. |
| A-08 | Roads connect settlements | ✅ | `engine/src/world/generation/road-generator.ts`, `tile-map.ts:553-589` | MST algorithm, A* pathfinding, noise deviation, bridges over rivers |
| A-09 | World history generated & queryable | ✅ | `engine/src/world/world-history.ts` | WorldHistoryManager: 10 event types, significance 1-10, query by type/participant/significance |
| A-10 | Underground layers | ❌ | — | No underground/cave interior system exists. Cave entrances are surface decorations. |

### B. Character/NPC Simulation

| ID | Item | Status | Related Files | Notes |
|----|------|--------|---------------|-------|
| B-01 | Personality affects behavior | ✅ | `shared/types/emotion.ts:28-34`, `engine/src/systems/social/emotion-engine.ts:15-72` | OCEAN model, modulates emotion sensitivity and relationship compatibility |
| B-02 | Emotions/mood change | ✅ | `shared/types/emotion.ts:1-64`, `engine/src/agent/agent-manager.ts:650-655` | Plutchik 8 emotions + compound emotions, decay every tick |
| B-03 | NPC-NPC relationships change | ✅ | `engine/src/systems/social/relationship.ts`, `engine/src/agent/agent-manager.ts:546-547` | Trust/affection/respect per pair, updated on trade/conversation/combat |
| B-04 | Memories reflected in conversations | ✅ | `engine/src/agent/memory/memory-stream.ts`, `engine/src/npc/npc-scheduler.ts:243-273` | Stanford Generative Agents pattern: recency + importance + relevance retrieval |
| B-05 | Autonomous action plans | ✅ | `engine/src/npc/npc-scheduler.ts`, `engine/src/agent/plan-executor.ts` | 3-tier: Rules → Cache → LLM. Multi-step plans with conditions and retries. |
| B-06 | Role-appropriate actions | ✅ | `engine/src/npc/npc-routines.ts`, `engine/src/systems/npc-manager.ts:348-411` | 9 roles with daily routines (blacksmith=forge, guard=patrol, farmer=harvest) |
| B-07 | NPC conversations (speech bubbles) | ✅ | `engine/src/npc/npc-scheduler.ts:479-514`, `client/src/game/scenes/world-scene.ts:702-780` | `agent:spoke` events → speech bubbles with tail pointers, 3s duration. NPCs respond to nearby speech. |
| B-08 | Skill/level system grows | ✅ | `engine/src/skills/skill-manager.ts`, `engine/src/core/world-engine.ts:416-480` | 36 skills, XP on actions (gather/craft/combat/trade/speak), level² × 10 curve |
| B-09 | Eat, sleep, move survival loop | ✅ | `engine/src/agent/agent-manager.ts:309,392-447` | Hunger drains/tick, eat +30, rest regens energy, movement costs energy, night routines |
| B-10 | NPC death/knockout with cause | ⚠️ | `engine/src/systems/combat.ts:374-403` | Monsters die with `killedBy` recorded. Agents/NPCs have NO death check — they are immortal. |

### C. Combat

| ID | Item | Status | Related Files | Notes |
|----|------|--------|---------------|-------|
| C-01 | Agent vs monster combat | ✅ | `engine/src/systems/combat.ts:286-427` | `startCombat()` → auto-resolve rounds. Wired at world-engine.ts:810. |
| C-02 | Damage calculation | ✅ | `engine/src/systems/combat.ts:347-351` | `agentAttack - monster.defense + random(-2,2)`, min 1 |
| C-03 | Body part damage | ✅ | `engine/src/combat/combat-engine.ts:40-96,274-408` | 6 body parts (head/torso/arms/legs), hit chances, crit multipliers, disable state |
| C-04 | Status effects | ✅ | `engine/src/combat/combat-data.ts:91-272` | 12 types: poisoned, bleeding, stunned, frozen, burned, blinded, feared, paralyzed, enraged, shielded, blessed, cursed |
| C-05 | Terrain affects combat | ✅ | `engine/src/combat/combat-data.ts:276-376` | 9 terrain types: hill +15% attack, forest +30% stealth, water -40% speed, cave -20% accuracy |
| C-06 | Group combat (skirmish) | ✅ | `engine/src/combat/combat-engine.ts:100-143` | Types: duel/skirmish/raid/siege/boss with max rounds (10/15/20/30/20), multi-participant |
| C-07 | Siege warfare | ✅ | `engine/src/buildings/siege-system.ts`, `combat-data.ts:482-486` | Catapult/battering ram/siege ladder/fire arrows, wall HP, breach tracking |
| C-08 | Combat → XP/items/reputation | ✅ | `engine/src/core/world-engine.ts:331-349,432-439` | XP = level×15 + random(5,15), loot via `rollLoot()`, +5 reputation per victory |
| C-09 | Combat visually shown | 🔍 | `client/src/game/scenes/world-scene.ts` | Combat events emitted. Client has `InteractionEffects` and `EventVisuals` imports. Needs runtime verification. |
| C-10 | AI tactical decisions | ✅ | `engine/src/combat/combat-engine.ts:911-973` | HP<20% → heal/flee, targets weakest, aims body parts, commander rally, disarm/grapple |

### D. Items/Crafting

| ID | Item | Status | Related Files | Notes |
|----|------|--------|---------------|-------|
| D-01 | Name, quality, durability | ✅ | `shared/types/item.ts:7-11,197-209` | 5 quality tiers (crude→legendary), durability/maxDurability on RichItem |
| D-02 | Item history/provenance | ✅ | `shared/types/item.ts:82-163`, `engine/src/items/item-manager.ts:189-253` | 15 history event types, sentimental value, provenance tracking |
| D-03 | Crafting system | ✅ | `engine/src/crafting/recipe-manager.ts`, `recipe-data.ts` | 112 recipes, discovery system, learning methods |
| D-04 | Crafting needs buildings | ✅ | `shared/types/item.ts:343-347` | 18 facility types (smelter, blacksmith, alchemy_lab, etc.) with level requirements |
| D-05 | Multi-stage crafting chain | ✅ | `engine/src/crafting/recipe-data.ts:14-867` | 5-tier chain: raw → processed → components → finished → enchanted. E.g. iron_ore→ingot→blade→sword |
| D-06 | Masterwork/legendary grades | ✅ | `engine/src/items/quality.ts:10-51` | Score formula (material×0.3 + skill×0.4 + tool×0.15 + random×0.15), multipliers up to 2x stats / 10x value |
| D-07 | Equipment affects stats | ⚠️ | `shared/types/item.ts:48-60`, `shared/types/agent.ts` | `EquipmentStats` interface has 11 stats. BUT Agent has no equipment slots. Stats never applied. |
| D-08 | Item trading | ✅ | `engine/src/agent/agent-manager.ts:513-648` | Trade action handler, executeTrade(), ownership transfer, relationship updates |
| D-09 | Item drops from monsters | ✅ | `shared/types/item.ts:110-116`, `engine/src/combat/combat-engine.ts:494-536` | `DroppedProvenance`, `rollLoot()` with ItemManager integration |
| D-10 | Farming cycle | ✅ | `engine/src/crafting/farming-system.ts` | 7 crops, seasonal growth modifiers, water quality, seed return rate |

### E. Buildings

| ID | Item | Status | Related Files | Notes |
|----|------|--------|---------------|-------|
| E-01 | Buildings visible on map | ✅ | `client/src/game/scenes/world-scene.ts:27-45`, `shared/types/building.ts:116-150` | Sprites with pixel dimensions per type, iso rendering |
| E-02 | 5+ building types | ✅ | `engine/src/buildings/building-data.ts` | 45 types across 7 categories (residential/production/commercial/military/social/infrastructure/special) |
| E-03 | Buildings have functions | ✅ | `engine/src/buildings/building-manager.ts:621-676` | Type-specific: blacksmith=craft+enchant, library=research, tavern=rooms+food, temple=bless+heal |
| E-04 | Building level-up | ✅ | `engine/src/buildings/building-manager.ts:251-308` | `upgradeBuilding()`: checks resources, transitions to construction, adds rooms, records history |
| E-05 | Building interiors | ✅ | `shared/types/building.ts:52-61` | Room system (20+ purposes), 30+ furniture types, quality levels, temperature/light/cleanliness |
| E-06 | Construction process | ✅ | `engine/src/buildings/building-manager.ts:48-129,527-580` | state=construction, progress 0-100, worker bonuses, material consumption |
| E-07 | Buildings damaged/destroyed | ✅ | `engine/src/buildings/building-manager.ts:310-358`, `siege-system.ts` | HP system, damaged<75%, destroyed=0, siege weapons prioritize walls/gates |
| E-08 | NPCs use buildings | ✅ | `engine/src/buildings/building-manager.ts:458-493` | workers/visitors arrays, worker bonuses on construction/production speed |

### F. Politics/Society

| ID | Item | Status | Related Files | Notes |
|----|------|--------|---------------|-------|
| F-01 | Settlements/towns | ✅ | `engine/src/politics/settlement-manager.ts` | camp→village→town→city, population-based growth, treasury, culture |
| F-02 | Guilds/factions | ✅ | `engine/src/politics/guild-manager.ts` | 5 guild types, rank hierarchy, charter system, internal factions form at 8+ members |
| F-03 | Leader elections | ✅ | `engine/src/politics/settlement-manager.ts:469-646` | Every 7 days, 2-day campaign, AI voting (trust 40% + respect 30% + affection 20% - fear 10%) |
| F-04 | Nations/kingdoms | ✅ | `engine/src/politics/kingdom-manager.ts` | 2+ allied settlements form kingdom, policies (tax/conscription/borders), ruler system |
| F-05 | Diplomacy | ✅ | `engine/src/politics/kingdom-manager.ts:124-227` | 6 statuses (war→vassal), 5 treaty types, violation tracking with reputation penalties |
| F-06 | Wars occur | ✅ | `engine/src/politics/kingdom-manager.ts:229-398` | Casus belli, war goals, fatigue system, auto-ceasefire after 30 days, unjustified war penalty |
| F-07 | Rumors spread | ✅ | `engine/src/social/rumor-system.ts` | 5 types, 50% spread/conversation (80% innkeeper), reliability decay, expire after 2000 ticks |
| F-08 | Secrets with consequences | ✅ | `engine/src/social/secret-system.ts` | 5 types, leverage 0-100, reveal/blackmail/keep quiet, relationship destruction on reveal |
| F-09 | Tax/economy system | ⚠️ | `engine/src/politics/settlement-manager.ts:196-218` | `collectTaxes()` code exists. Tax rate 5-20%. BUT never called in tick loop — dormant. |
| F-10 | Rebellion/coup | ⚠️ | `engine/src/politics/guild-manager.ts:394-451` | Guild coups work (influence>60% + approval<30%). No settlement/kingdom rebellion mechanics. |

### G. Monsters/Ecosystem

| ID | Item | Status | Related Files | Notes |
|----|------|--------|---------------|-------|
| G-01 | Monsters spawn | ✅ | `engine/src/systems/combat.ts:158-240`, `engine/src/creatures/creature-manager.ts:48-173` | Every 60 ticks (20% chance), biome-appropriate, distance-based tier |
| G-02 | 10+ monster types | ✅ | `engine/src/creatures/creature-data.ts:412-987` | 25 monster types + 15 animal types = 40 total species |
| G-03 | Monster tiers | ✅ | `engine/src/creatures/creature-data.ts:68-406` | 5 tiers with multipliers (1x/1.5x/2.5x/4x/7x), distance-based distribution |
| G-04 | Boss monsters | ✅ | `engine/src/creatures/creature-data.ts:853-987` | Lich (HP 160), dragon (HP 1000), ancient_golem (HP 800), world_serpent (HP 3000), demon_lord (HP 2500) |
| G-05 | Non-hostile animals | ✅ | `engine/src/creatures/creature-data.ts:68-406` | 15 animals: passive (rabbit, chicken), neutral (deer, eagle), territorial (boar, bear) |
| G-06 | Animal reproduction cycle | ⚠️ | `engine/src/creatures/pack-manager.ts:262-266` | Breeding logic commented: "if pack size < 3 and morale > 60, spawn pup". Not implemented. |
| G-07 | Predator-prey relationships | ✅ | `engine/src/creatures/creature-manager.ts:373-394` | Wolves hunt rabbits/deer within 8 tiles, sets hunting/fleeing states, every 5 ticks |
| G-08 | Monster dens/dungeons | ✅ | `engine/src/creatures/den-manager.ts` | 8 den types, rooms with traps/loot, boss chambers, discoverable, respawn with tier increase |
| G-09 | Pack behavior | ✅ | `engine/src/creatures/pack-manager.ts` | 4 pack types, state machines (idle/hunting/patrolling/raiding/fleeing), morale, coordination |
| G-10 | Monster societies | ✅ | `engine/src/creatures/pack-manager.ts:269-518` | Goblin tribes (chief/shaman/raiders), orc warbands (warchief/berserker), bandit gangs (leader/ambush) |

### H. Magic/Skills

| ID | Item | Status | Related Files | Notes |
|----|------|--------|---------------|-------|
| H-01 | Skills with XP from actions | ✅ | `engine/src/skills/skill-manager.ts`, `engine/src/core/world-engine.ts:416-480` | 25 skills in 5 categories, XP on gather/craft/combat/trade/speak/cast |
| H-02 | Skill levels unlock abilities | ✅ | `engine/src/skills/skill-data.ts` | 125 abilities total (5 per skill at levels 10/30/50/70/100), passive/active/toggle |
| H-03 | Magic system (mana, spells) | ✅ | `engine/src/skills/magic-system.ts`, `engine/src/skills/spell-data.ts` | 35 spells across 6 schools (fire/ice/heal/summon/arcane/dark), mana regen 1-8/tick |
| H-04 | Magic usable in combat | ✅ | `engine/src/skills/magic-system.ts:42-150`, `world-engine.ts:691-702` | Damage/heal/buff/debuff/control spells, cast interruption, tactics XP bonus |
| H-05 | Enchanting exists | ✅ | `engine/src/skills/skill-data.ts:408-454`, `engine/src/crafting/recipe-data.ts:778-849` | 5 enchanting abilities (Lv10-100), 10 tier-5 recipes, element/lifesteal/piercing modifiers |

### I. Spectator Experience

| ID | Item | Status | Related Files | Notes |
|----|------|--------|---------------|-------|
| I-01 | Agent click → info card | ✅ | `client/src/pages/WorldView.tsx:118-127`, `client/src/ui/CharacterCard.tsx` | Full profile with tabs (stats/inventory/relationships/history/achievements) |
| I-02 | Building click → info | ✅ | `client/src/pages/WorldView.tsx:138-143`, `client/src/ui/BuildingCard.tsx` | Durability, status, owner, facilities, recent activity |
| I-03 | Monster/animal click → info | ✅ | `client/src/pages/WorldView.tsx:130-136`, `client/src/ui/CreatureCard.tsx` | HP, behavior, pack info, danger rating, loot drops |
| I-04 | Tile click → biome/elevation | ✅ | `client/src/game/scenes/world-scene.ts:405-444`, `client/src/ui/TerrainCard.tsx` | Full tile data: type, biome, elevation, resource, walkable, movementCost |
| I-05 | Follow agent mode | ✅ | `client/src/game/scenes/world-scene.ts:879-890`, `client/src/ui/FollowHUD.tsx` | Camera tracks agent, FollowHUD shows HP/action/log, stops on drag |
| I-06 | Real-time event feed | ✅ | `client/src/ui/EventFeed.tsx` | Collapsible, filters by category/importance, search, last 50 events, click to navigate |
| I-07 | Minimap (click→move) | ✅ | `client/src/ui/Minimap.tsx` | Canvas-based, agents as dots, POIs as colored squares, click navigates |
| I-08 | Rankings/statistics | ✅ | `client/src/ui/RankingsPanel.tsx`, `client/src/ui/StatsDashboard.tsx` | Tabs: combat/economy/crafting/exploration/social/overall/items, world records |
| I-09 | World history timeline | ✅ | `client/src/ui/HistoryPanel.tsx`, `client/src/ui/TimelineView.tsx` | Significance filter (3-10), type icons, seasons, clickable locations |
| I-10 | Nation/guild territory colors | 🔍 | `client/src/ui/PoliticsPanel.tsx` | PoliticsPanel exists and renders. Territory color overlay on map not confirmed. |
| I-11 | Speed controls (0.5x-5x) | ✅ | `client/src/ui/BottomHUD.tsx:132-149` | 0.5x/1x/2x/3x/5x buttons + pause/resume, visual feedback for active speed |
| I-12 | Favorites/notifications | ✅ | `client/src/ui/FavoritesPanel.tsx`, `client/src/ui/NotificationSystem.tsx` | localStorage persistence, max 20, click to navigate, subscription toggle |

### J. Map/Basic UX

| ID | Item | Status | Related Files | Notes |
|----|------|--------|---------------|-------|
| J-01 | Map drag movement | ✅ | `client/src/game/scenes/world-scene.ts:392-402` | Pointer drag-to-pan with zoom scaling, stops follow mode |
| J-02 | Mouse wheel zoom | ✅ | `client/src/game/scenes/world-scene.ts:368-377` | 0.3x-2.5x range, dynamic LOD tier |
| J-03 | WASD keyboard movement | ✅ | `client/src/game/scenes/world-scene.ts:379-389,464-487` | WASD + arrows + edge scrolling (20px margin), speed scales with zoom |
| J-04 | UI buttons don't freeze | ✅ | Multiple UI components | Sound feedback (`playUIClick()`), proper event handlers, no blocking operations |
| J-05 | Panels closeable | ✅ | CharacterCard, BuildingCard, CreatureCard, TerrainCard, RankingsPanel, EventFeed | ESC handler, X button, backdrop click for modals |
| J-06 | 60fps maintained | 🔍 | `client/src/game/scenes/world-scene.ts:548-556` | FPS counter displayed. LOD + culling optimizations exist. Needs runtime verification. |
| J-07 | WebSocket stable | ✅ | `client/src/network/socket-client.ts` | Socket.io with connect/disconnect handlers, reconnection banner, unsubscribe pattern |
| J-08 | ErrorBoundary | ✅ | `client/src/ui/ErrorBoundary.tsx` | All major panels wrapped (CharacterCard, CreatureCard, BuildingCard, Rankings, Stats, Timeline) |

### K. Atmosphere/Effects

| ID | Item | Status | Related Files | Notes |
|----|------|--------|---------------|-------|
| K-01 | Day/night brightness/tint | ✅ | `client/src/game/effects/day-night-cycle.ts` | 6 time periods, unique tints, 2s transitions, building lights, stars, agent torches |
| K-02 | Weather visuals (rain, snow) | ✅ | `client/src/game/effects/weather-effects.ts` | 6 weather types: rain particles, storm+lightning, snow drift, fog overlay, cloud shadow |
| K-03 | Seasons visually reflected | ✅ | `client/src/game/effects/season-system.ts` | 4 seasons (7 days each): spring=bright green, summer=saturated, autumn=orange, winter=frost. Tree/grass tinting. |
| K-04 | BGM plays | ✅ | `client/src/game/audio/sound-manager.ts` | 9 procedural 8-bit tracks (day/night/town/combat/forest/winter/boss/event), context-aware switching |
| K-05 | Sound effects | ✅ | `client/src/game/audio/sound-manager.ts` | Full SFX library: combat (7), crafting (3), gathering (3), movement (3), UI (5), spells, trade, levelup |
| K-06 | Particle effects | ✅ | `weather-effects.ts`, `ambient-particles.ts`, `combat-effects.ts`, `environment-effects.ts` | Rain/snow, biome ambient (butterflies/dust/leaves/fireflies), seasonal particles, combat impacts |

### L. Botworld Unique Strengths

| ID | Item | Status | Related Files | Notes |
|----|------|--------|---------------|-------|
| L-01 | Users send bots to world | ✅ | `engine/public/skill.md`, `engine/src/api/skills.ts`, `engine/src/api/auth.ts` | REST + WebSocket API, register→create character→heartbeat, `/bot` namespace |
| L-02 | NPC uses LLM for decisions | ✅ | `engine/src/npc/npc-brain.ts`, `engine/src/llm/llm-router.ts` | Rich context (emotions, inventory, relationships, weather) → JSON decision → plan executor |
| L-03 | AI-generated item names | ✅ | `engine/src/items/item-namer.ts` | Masterwork+ items get LLM names. Fallback: procedural prefix+suffix generation. |
| L-04 | World history narrated by AI | ⚠️ | `engine/src/world/world-history.ts` | Events recorded with significance. `formatForLLM()` exists. But NO narrative generation/summarization. |
| L-05 | Bot API (skill.md) | ✅ | `engine/public/skill.md` | 240-line API docs with curl/Python/JS examples, full action/guild/market/building/skill APIs |
| L-06 | Local LLM routing | ✅ | `engine/src/llm/local-provider.ts`, `engine/src/llm/llm-router.ts` | vLLM/Ollama via OpenAI-compat API, health checks, 8 concurrent calls, local→cloud failover |

---

## Priority Fix Recommendations

### Immediate (Core Gameplay Loops)

1. **D-07 Equipment Slots**: Add `equipped: Record<SlotType, string>` to Agent type + stat merge calculation. Without this, crafted weapons/armor have no gameplay effect.
2. **B-10 Agent Death**: Add HP≤0 check in `AgentManager.updatePassiveEffects()`. Record cause of death. Consider knockout (recoverable) vs death (permanent).
3. **F-09 Wire Tax Collection**: Add `settlementManager.collectTaxes()` to tick loop (e.g., every game day). Enables economic gameplay.

### Medium Priority (Depth & Polish)

4. **G-06 Animal Breeding**: Wire `spawnCreature()` call in `PackManager.tickWolfPack()` line 263. Enable population dynamics.
5. **L-04 AI History Narration**: Add LLM summarization to `WorldHistoryManager`. Generate narrative summaries for high-significance events.
6. **F-10 Settlement Rebellion**: Implement approval rating for settlement leaders. Low approval + high taxes → rebellion event.

### Long-term (New Systems)

7. **A-10 Underground System**: Instance-based dungeon interiors behind cave_entrance landmarks. Separate tile grids per dungeon.
8. **A-05 Cross-Chunk Smoothing**: Apply biome smoothing across chunk boundaries during generation.
9. **A-07 Dungeon Exploration**: Connect landmark decorations to actual explorable areas (requires A-10).
10. **I-10 Territory Overlay**: Add colored semi-transparent tiles on the isometric map showing kingdom/guild territories.
