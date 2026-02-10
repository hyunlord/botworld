/** Ticks per second */
export const TICK_RATE = 1

/** How many real seconds make one game day */
export const REAL_SECONDS_PER_GAME_DAY = 20 * 60 // 20 minutes

/** Ticks per game day */
export const TICKS_PER_GAME_DAY = REAL_SECONDS_PER_GAME_DAY * TICK_RATE

/** Default map dimensions (tiles) */
export const DEFAULT_MAP_WIDTH = 32
export const DEFAULT_MAP_HEIGHT = 32

/** Agent defaults */
export const DEFAULT_MAX_HP = 100
export const DEFAULT_MAX_ENERGY = 100
export const DEFAULT_MAX_HUNGER = 100

/** Energy costs per action */
export const ENERGY_COST = {
  move: 1,
  gather: 3,
  craft: 5,
  trade: 1,
  talk: 1,
  rest: 0,
  eat: 0,
  quest: 2,
  explore: 2,
  idle: 0,
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
