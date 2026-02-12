/** Ticks per second */
export const TICK_RATE = 1

/** How many real seconds make one game day */
export const REAL_SECONDS_PER_GAME_DAY = 20 * 60 // 20 minutes

/** Ticks per game day */
export const TICKS_PER_GAME_DAY = REAL_SECONDS_PER_GAME_DAY * TICK_RATE

/** Chunk-based world generation */
export const CHUNK_SIZE = 16
export const INITIAL_CHUNK_RADIUS = 3
export const LOAD_DISTANCE_CHUNKS = 4

/** Movement cost per tile type (0 = impassable) */
export const MOVEMENT_COSTS: Record<string, number> = {
  road: 0.5,
  grass: 1.0,
  meadow: 1.0,
  building: 1.0,
  farmland: 1.2,
  sand: 1.3,
  beach: 1.3,
  forest: 1.5,
  tundra: 1.5,
  ice: 1.5,
  snow: 1.8,
  swamp: 2.0,
  volcanic: 2.0,
  dense_forest: 2.5,
  river: 0,
  water: 0,
  deep_water: 0,
  mountain: 0,
  cliff: 0,
  lava: 0,
}

/** Agent defaults */
export const DEFAULT_MAX_HP = 100
export const DEFAULT_MAX_ENERGY = 100
export const DEFAULT_MAX_HUNGER = 100
export const DEFAULT_ATTACK = 10
export const DEFAULT_DEFENSE = 5

/** Energy costs per action */
export const ENERGY_COST = {
  move: 1,
  gather: 3,
  craft: 5,
  trade: 1,
  talk: 1,
  speak: 1,
  rest: 0,
  eat: 0,
  quest: 2,
  explore: 2,
  idle: 0,
  attack: 5,
  flee: 3,
  build: 4,
  give: 0,
} as const

/** Hunger drain per tick */
export const HUNGER_DRAIN_PER_TICK = 0.05

/** Energy regen per tick while resting */
export const REST_ENERGY_REGEN = 3

/** Memory importance threshold for reflection */
export const REFLECTION_IMPORTANCE_THRESHOLD = 7

/** How many memories to keep before pruning low-importance ones */
export const MAX_MEMORIES = 200

/** XP required per level: level * 100 */
export const XP_PER_LEVEL = 100

/** Emotion decay rate per tick (emotions fade over time) */
export const EMOTION_DECAY_RATE = 0.001

/** Item rarity weights (for random generation) */
export const RARITY_WEIGHTS = {
  common: 60,
  uncommon: 25,
  rare: 10,
  epic: 4,
  legendary: 1,
} as const

/** Stat multiplier per rarity tier */
export const RARITY_STAT_MULTIPLIER: Record<string, number> = {
  common: 1.0,
  uncommon: 1.3,
  rare: 1.6,
  epic: 2.0,
  legendary: 3.0,
}

/** Marketplace transaction fee rate */
export const MARKET_FEE_RATE = 0.05
