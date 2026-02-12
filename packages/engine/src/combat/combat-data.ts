import type {
  BodyPartType,
  ConditionType,
  TerrainType,
  TerrainEffect,
  FormationType,
  CombatRole,
  CombatType,
} from '@botworld/shared'

// ── Body Part Configuration ──

export interface BodyPartConfig {
  type: BodyPartType
  hpPercent: number      // percent of total HP
  hitChance: number      // base accuracy modifier (1.0 = normal)
  stunChance: number     // chance to stun on hit
  critMultiplier: number // critical damage multiplier
  disableEffect: string  // what happens when disabled
}

export const BODY_PARTS: Record<BodyPartType, BodyPartConfig> = {
  head: {
    type: 'head',
    hpPercent: 0.15,
    hitChance: 0.7,    // -30% accuracy
    stunChance: 0.2,
    critMultiplier: 3.0,
    disableEffect: 'stunned',
  },
  torso: {
    type: 'torso',
    hpPercent: 0.40,
    hitChance: 1.0,
    stunChance: 0,
    critMultiplier: 2.0,
    disableEffect: 'none',
  },
  left_arm: {
    type: 'left_arm',
    hpPercent: 0.10,
    hitChance: 0.85,   // -15% accuracy
    stunChance: 0,
    critMultiplier: 2.0,
    disableEffect: 'left_arm_disabled',
  },
  right_arm: {
    type: 'right_arm',
    hpPercent: 0.10,
    hitChance: 0.85,
    stunChance: 0,
    critMultiplier: 2.0,
    disableEffect: 'right_arm_disabled',
  },
  left_leg: {
    type: 'left_leg',
    hpPercent: 0.125,
    hitChance: 0.85,
    stunChance: 0,
    critMultiplier: 2.0,
    disableEffect: 'speed_halved',
  },
  right_leg: {
    type: 'right_leg',
    hpPercent: 0.125,
    hitChance: 0.85,
    stunChance: 0,
    critMultiplier: 2.0,
    disableEffect: 'speed_halved',
  },
}

// ── Condition Definitions ──

export interface ConditionConfig {
  type: ConditionType
  name: string
  description: string
  duration: number        // default rounds
  damagePerRound: number  // as percent of maxHp (0-1)
  attackMod: number       // multiplier
  defenseMod: number
  accuracyMod: number
  speedMod: number
  canAct: boolean
  canMove: boolean
  canFlee: boolean        // fear: only flee
  curedBy: string[]       // items/actions that cure
}

export const CONDITIONS: Record<ConditionType, ConditionConfig> = {
  poisoned: {
    type: 'poisoned',
    name: 'Poisoned',
    description: 'Taking poison damage each round',
    duration: 3,
    damagePerRound: 0.05,
    attackMod: 1,
    defenseMod: 1,
    accuracyMod: 1,
    speedMod: 1,
    canAct: true,
    canMove: true,
    canFlee: true,
    curedBy: ['antidote', 'healing_spell'],
  },
  bleeding: {
    type: 'bleeding',
    name: 'Bleeding',
    description: 'Losing blood each round',
    duration: 5,
    damagePerRound: 0.03,
    attackMod: 1,
    defenseMod: 1,
    accuracyMod: 1,
    speedMod: 1,
    canAct: true,
    canMove: true,
    canFlee: true,
    curedBy: ['bandage', 'healing_spell'],
  },
  stunned: {
    type: 'stunned',
    name: 'Stunned',
    description: 'Unable to act for 1 round',
    duration: 1,
    damagePerRound: 0,
    attackMod: 1,
    defenseMod: 0.5,
    accuracyMod: 1,
    speedMod: 0,
    canAct: false,
    canMove: false,
    canFlee: false,
    curedBy: [],
  },
  frozen: {
    type: 'frozen',
    name: 'Frozen',
    description: 'Immobilized and defense reduced',
    duration: 2,
    damagePerRound: 0,
    attackMod: 1,
    defenseMod: 0.8,
    accuracyMod: 1,
    speedMod: 0,
    canAct: true,
    canMove: false,
    canFlee: false,
    curedBy: ['fire_spell', 'torch'],
  },
  burned: {
    type: 'burned',
    name: 'Burned',
    description: 'Taking fire damage, equipment degrading',
    duration: 3,
    damagePerRound: 0.05,
    attackMod: 1,
    defenseMod: 1,
    accuracyMod: 1,
    speedMod: 1,
    canAct: true,
    canMove: true,
    canFlee: true,
    curedBy: ['water', 'ice_spell'],
  },
  blinded: {
    type: 'blinded',
    name: 'Blinded',
    description: 'Accuracy severely reduced',
    duration: 2,
    damagePerRound: 0,
    attackMod: 1,
    defenseMod: 1,
    accuracyMod: 0.5,
    speedMod: 0.7,
    canAct: true,
    canMove: true,
    canFlee: true,
    curedBy: ['eye_drops', 'healing_spell'],
  },
  feared: {
    type: 'feared',
    name: 'Feared',
    description: 'Can only flee',
    duration: 3,
    damagePerRound: 0,
    attackMod: 0.5,
    defenseMod: 0.8,
    accuracyMod: 0.7,
    speedMod: 1.2,
    canAct: false,
    canMove: true,
    canFlee: true,
    curedBy: ['courage_potion', 'rally'],
  },
  paralyzed: {
    type: 'paralyzed',
    name: 'Paralyzed',
    description: 'Completely unable to act',
    duration: 1,
    damagePerRound: 0,
    attackMod: 0,
    defenseMod: 0.3,
    accuracyMod: 0,
    speedMod: 0,
    canAct: false,
    canMove: false,
    canFlee: false,
    curedBy: ['antidote', 'healing_spell'],
  },
  enraged: {
    type: 'enraged',
    name: 'Enraged',
    description: 'Attack boosted, defense reduced',
    duration: 3,
    damagePerRound: 0,
    attackMod: 1.3,
    defenseMod: 0.8,
    accuracyMod: 0.9,
    speedMod: 1.1,
    canAct: true,
    canMove: true,
    canFlee: false,
    curedBy: ['calm_spell'],
  },
  shielded: {
    type: 'shielded',
    name: 'Shielded',
    description: 'Next hit absorbed',
    duration: 1,
    damagePerRound: 0,
    attackMod: 1,
    defenseMod: 2,
    accuracyMod: 1,
    speedMod: 1,
    canAct: true,
    canMove: true,
    canFlee: true,
    curedBy: [],
  },
  blessed: {
    type: 'blessed',
    name: 'Blessed',
    description: 'All stats boosted',
    duration: 5,
    damagePerRound: 0,
    attackMod: 1.1,
    defenseMod: 1.1,
    accuracyMod: 1.1,
    speedMod: 1.1,
    canAct: true,
    canMove: true,
    canFlee: true,
    curedBy: ['curse_spell'],
  },
  cursed: {
    type: 'cursed',
    name: 'Cursed',
    description: 'All stats reduced',
    duration: 5,
    damagePerRound: 0,
    attackMod: 0.9,
    defenseMod: 0.9,
    accuracyMod: 0.9,
    speedMod: 0.9,
    canAct: true,
    canMove: true,
    canFlee: true,
    curedBy: ['blessing', 'holy_water'],
  },
}

// ── Terrain Effects ──

export const TERRAIN_EFFECTS: Record<TerrainType, TerrainEffect> = {
  hill: {
    terrain: 'hill',
    attackModifier: 1.15,
    defenseModifier: 1.0,
    accuracyModifier: 1.0,
    evasionModifier: 1.0,
    speedModifier: 0.9,
    stealthModifier: 1.0,
    rangeModifier: 2,
    specialEffects: ['high_ground'],
  },
  water: {
    terrain: 'water',
    attackModifier: 0.8,
    defenseModifier: 0.8,
    accuracyModifier: 1.0,
    evasionModifier: 0.8,
    speedModifier: 0.6,
    stealthModifier: 0.5,
    rangeModifier: 0,
    specialEffects: ['fire_immune', 'heavy_armor_penalty'],
  },
  forest: {
    terrain: 'forest',
    attackModifier: 1.0,
    defenseModifier: 1.0,
    accuracyModifier: 0.85,
    evasionModifier: 1.1,
    speedModifier: 0.9,
    stealthModifier: 1.3,
    rangeModifier: -1,
    specialEffects: ['ambush_possible', 'ranged_penalty'],
  },
  desert: {
    terrain: 'desert',
    attackModifier: 1.0,
    defenseModifier: 1.0,
    accuracyModifier: 1.0,
    evasionModifier: 1.0,
    speedModifier: 0.9,
    stealthModifier: 0.8,
    rangeModifier: 0,
    specialEffects: ['energy_drain', 'metal_armor_penalty'],
  },
  snow: {
    terrain: 'snow',
    attackModifier: 1.0,
    defenseModifier: 1.0,
    accuracyModifier: 0.95,
    evasionModifier: 0.9,
    speedModifier: 0.8,
    stealthModifier: 0.8,
    rangeModifier: 0,
    specialEffects: ['ice_magic_boost', 'cold_damage'],
  },
  cave: {
    terrain: 'cave',
    attackModifier: 1.0,
    defenseModifier: 1.0,
    accuracyModifier: 0.8,
    evasionModifier: 1.0,
    speedModifier: 0.9,
    stealthModifier: 1.2,
    rangeModifier: -2,
    specialEffects: ['darkness', 'fire_smoke_risk'],
  },
  wall_top: {
    terrain: 'wall_top',
    attackModifier: 1.0,
    defenseModifier: 1.3,
    accuracyModifier: 1.1,
    evasionModifier: 1.0,
    speedModifier: 0.8,
    stealthModifier: 0.5,
    rangeModifier: 3,
    specialEffects: ['ranged_only_defense', 'no_melee_receive'],
  },
  road: {
    terrain: 'road',
    attackModifier: 1.0,
    defenseModifier: 1.0,
    accuracyModifier: 1.0,
    evasionModifier: 1.0,
    speedModifier: 1.0,
    stealthModifier: 1.0,
    rangeModifier: 0,
    specialEffects: [],
  },
  open: {
    terrain: 'open',
    attackModifier: 1.0,
    defenseModifier: 1.0,
    accuracyModifier: 1.0,
    evasionModifier: 1.0,
    speedModifier: 1.0,
    stealthModifier: 0.7,
    rangeModifier: 0,
    specialEffects: [],
  },
}

// ── Formation Configurations ──

export interface FormationConfig {
  type: FormationType
  name: string
  description: string
  attackBonus: number
  defenseBonus: number
  requirement: string     // e.g. 'forest' terrain needed for ambush
  firstRoundBonus: string // special effect on first round
  rolePositions: Record<CombatRole, { row: number; priority: number }>
}

export const FORMATIONS: Record<FormationType, FormationConfig> = {
  line: {
    type: 'line',
    name: 'Line Formation',
    description: 'Standard formation with frontline and ranged',
    attackBonus: 0,
    defenseBonus: 0,
    requirement: 'none',
    firstRoundBonus: 'none',
    rolePositions: {
      frontline: { row: 0, priority: 1 },
      ranged: { row: 2, priority: 3 },
      support: { row: 3, priority: 4 },
      commander: { row: 2, priority: 2 },
    },
  },
  wedge: {
    type: 'wedge',
    name: 'Wedge Formation',
    description: 'Aggressive formation for breakthrough',
    attackBonus: 0.15,
    defenseBonus: -0.1,
    requirement: 'none',
    firstRoundBonus: 'charge_damage',
    rolePositions: {
      frontline: { row: 0, priority: 1 },
      ranged: { row: 1, priority: 2 },
      support: { row: 2, priority: 4 },
      commander: { row: 1, priority: 3 },
    },
  },
  circle: {
    type: 'circle',
    name: 'Circle Formation',
    description: 'Defensive formation protecting all sides',
    attackBonus: -0.1,
    defenseBonus: 0.2,
    requirement: 'none',
    firstRoundBonus: 'none',
    rolePositions: {
      frontline: { row: 0, priority: 1 },
      ranged: { row: 1, priority: 3 },
      support: { row: 1, priority: 4 },
      commander: { row: 1, priority: 2 },
    },
  },
  ambush: {
    type: 'ambush',
    name: 'Ambush',
    description: 'Surprise attack from concealment',
    attackBonus: 0.25,
    defenseBonus: -0.15,
    requirement: 'forest',
    firstRoundBonus: 'surprise_round',
    rolePositions: {
      frontline: { row: 0, priority: 2 },
      ranged: { row: 0, priority: 1 },
      support: { row: 1, priority: 4 },
      commander: { row: 1, priority: 3 },
    },
  },
}

// ── Combat Constants ──

export const COMBAT_CONSTANTS = {
  BASE_HIT_CHANCE: 0.80,
  BASE_CRIT_CHANCE: 0.05,
  CRIT_MULTIPLIER: 2.0,
  HEAD_CRIT_MULTIPLIER: 3.0,
  AIM_ACCURACY_BONUS: 0.30,
  DEFEND_DAMAGE_REDUCTION: 0.50,
  DODGE_EVASION_BONUS: 0.40,
  FLEE_BASE_CHANCE: 0.5,        // modified by speed ratio
  INTIMIDATE_BASE_CHANCE: 0.3,
  DISARM_BASE_CHANCE: 0.25,
  GRAPPLE_BASE_CHANCE: 0.35,
  RALLY_MORALE_BONUS: 10,
  MAX_ROUNDS_DUEL: 10,
  MAX_ROUNDS_SKIRMISH: 15,
  MAX_ROUNDS_RAID: 20,
  MAX_ROUNDS_SIEGE: 30,
  MAX_ROUNDS_BOSS: 20,
  DEFEAT_RECOVERY_TICKS: 30,
  XP_PER_TIER: 10,
  XP_BOSS_MULTIPLIER: 3,
  REP_WIN_MIN: 5,
  REP_WIN_MAX: 20,
  MORALE_FLEE_THRESHOLD: 20,
  MORALE_LOSS_ON_ALLY_DEATH: 15,
  MORALE_LOSS_ON_HIT: 3,
  SIEGE_WALL_HP_CATAPULT: 50,
  SIEGE_GATE_HP_RAM: 70,
  SIEGE_FIRE_ARROW_BURN: 30,
  SIEGE_LADDER_DEFENSE_PENALTY: 1.0, // no defense while climbing
  SIEGE_BOILING_OIL_DAMAGE: 80,
}

// ── Biome to Terrain Mapping ──

export function biomeToTerrain(biome: string): TerrainType {
  const mapping: Record<string, TerrainType> = {
    grassland: 'open',
    forest: 'forest',
    dense_forest: 'forest',
    mountain: 'hill',
    desert: 'desert',
    swamp: 'water',
    snow: 'snow',
    tundra: 'snow',
    cave: 'cave',
    river: 'water',
    lake: 'water',
    ocean: 'water',
    road: 'road',
    ruins: 'open',
    volcano: 'cave',
  }
  return mapping[biome] ?? 'open'
}

// ── Max rounds by combat type ──

export function getMaxRounds(combatType: CombatType): number {
  const map: Record<CombatType, number> = {
    duel: COMBAT_CONSTANTS.MAX_ROUNDS_DUEL,
    skirmish: COMBAT_CONSTANTS.MAX_ROUNDS_SKIRMISH,
    raid: COMBAT_CONSTANTS.MAX_ROUNDS_RAID,
    siege: COMBAT_CONSTANTS.MAX_ROUNDS_SIEGE,
    boss: COMBAT_CONSTANTS.MAX_ROUNDS_BOSS,
  }
  return map[combatType]
}
