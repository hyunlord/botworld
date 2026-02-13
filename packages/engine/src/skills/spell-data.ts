import type { SpellDefinition } from '@botworld/shared'

/**
 * Complete spell definitions for all 6 magic schools
 */
export const SPELL_DEFINITIONS: Record<string, SpellDefinition> = {
  // FIRE SCHOOL
  fireball: {
    id: 'fireball',
    name: 'Fireball',
    school: 'fire',
    type: 'damage',
    manaCost: 15,
    castTime: 0,
    cooldown: 3,
    requiredLevel: 10,
    failureChanceBase: 0.2,
    damage: 30,
    element: 'fire',
    condition: 'burned',
    conditionDuration: 2,
    description: 'Launch a ball of fire at your enemy'
  },

  fire_wall: {
    id: 'fire_wall',
    name: 'Fire Wall',
    school: 'fire',
    type: 'damage',
    manaCost: 25,
    castTime: 1,
    cooldown: 8,
    requiredLevel: 30,
    failureChanceBase: 0.15,
    damage: 20,
    element: 'fire',
    areaOfEffect: 2,
    duration: 3,
    description: 'Create a wall of flames that damages enemies each round'
  },

  meteor: {
    id: 'meteor',
    name: 'Meteor',
    school: 'fire',
    type: 'damage',
    manaCost: 60,
    castTime: 3,
    cooldown: 20,
    requiredLevel: 50,
    failureChanceBase: 0.1,
    damage: 100,
    element: 'fire',
    areaOfEffect: 3,
    description: 'Call down a massive meteor on your enemies'
  },

  inferno: {
    id: 'inferno',
    name: 'Inferno',
    school: 'fire',
    type: 'damage',
    manaCost: 40,
    castTime: 1,
    cooldown: 12,
    requiredLevel: 70,
    failureChanceBase: 0.12,
    damage: 40,
    element: 'fire',
    areaOfEffect: 3,
    duration: 5,
    description: 'Create a raging inferno that burns all enemies in range'
  },

  fire_elemental_summon: {
    id: 'fire_elemental_summon',
    name: 'Summon Fire Elemental',
    school: 'fire',
    type: 'summon',
    manaCost: 80,
    castTime: 2,
    cooldown: 50,
    requiredLevel: 100,
    failureChanceBase: 0.08,
    summonCreature: 'fire_elemental',
    description: 'Summon a powerful fire elemental to fight for you'
  },

  // ICE SCHOOL
  ice_bolt: {
    id: 'ice_bolt',
    name: 'Ice Bolt',
    school: 'ice',
    type: 'damage',
    manaCost: 12,
    castTime: 0,
    cooldown: 2,
    requiredLevel: 10,
    failureChanceBase: 0.2,
    damage: 25,
    element: 'ice',
    condition: 'frozen',
    conditionDuration: 1,
    description: 'Hurl a shard of ice at your enemy, potentially freezing them'
  },

  frost_barrier: {
    id: 'frost_barrier',
    name: 'Frost Barrier',
    school: 'ice',
    type: 'buff',
    manaCost: 20,
    castTime: 0,
    cooldown: 10,
    requiredLevel: 30,
    failureChanceBase: 0.15,
    buffType: 'defense',
    buffAmount: 30,
    duration: 5,
    description: 'Create a barrier of ice that increases defense by 30%'
  },

  blizzard: {
    id: 'blizzard',
    name: 'Blizzard',
    school: 'ice',
    type: 'damage',
    manaCost: 50,
    castTime: 2,
    cooldown: 15,
    requiredLevel: 50,
    failureChanceBase: 0.1,
    damage: 60,
    element: 'ice',
    areaOfEffect: 3,
    condition: 'frozen',
    conditionDuration: 2,
    description: 'Summon a freezing blizzard that damages and freezes all enemies'
  },

  glacial_prison: {
    id: 'glacial_prison',
    name: 'Glacial Prison',
    school: 'ice',
    type: 'control',
    manaCost: 35,
    castTime: 1,
    cooldown: 12,
    requiredLevel: 70,
    failureChanceBase: 0.12,
    condition: 'paralyzed',
    conditionDuration: 3,
    description: 'Encase an enemy in ice, paralyzing them completely'
  },

  absolute_zero: {
    id: 'absolute_zero',
    name: 'Absolute Zero',
    school: 'ice',
    type: 'damage',
    manaCost: 90,
    castTime: 3,
    cooldown: 30,
    requiredLevel: 100,
    failureChanceBase: 0.05,
    damage: 80,
    element: 'ice',
    areaOfEffect: 5,
    condition: 'frozen',
    conditionDuration: 3,
    description: 'Freeze all enemies solid with absolute zero temperature'
  },

  // HEAL SCHOOL
  minor_heal: {
    id: 'minor_heal',
    name: 'Minor Heal',
    school: 'heal',
    type: 'heal',
    manaCost: 10,
    castTime: 0,
    cooldown: 2,
    requiredLevel: 10,
    failureChanceBase: 0.1,
    healing: 30,
    description: 'Restore a small amount of health'
  },

  major_heal: {
    id: 'major_heal',
    name: 'Major Heal',
    school: 'heal',
    type: 'heal',
    manaCost: 25,
    castTime: 1,
    cooldown: 5,
    requiredLevel: 30,
    failureChanceBase: 0.08,
    healing: 80,
    description: 'Restore a large amount of health'
  },

  group_heal: {
    id: 'group_heal',
    name: 'Group Heal',
    school: 'heal',
    type: 'heal',
    manaCost: 40,
    castTime: 1,
    cooldown: 8,
    requiredLevel: 50,
    failureChanceBase: 0.1,
    healing: 50,
    areaOfEffect: 5,
    description: 'Restore health to all nearby allies'
  },

  resurrection: {
    id: 'resurrection',
    name: 'Resurrection',
    school: 'heal',
    type: 'utility',
    manaCost: 80,
    castTime: 3,
    cooldown: 60,
    requiredLevel: 70,
    failureChanceBase: 0.15,
    special: 'revive_dead',
    description: 'Bring a fallen ally back to life'
  },

  divine_barrier: {
    id: 'divine_barrier',
    name: 'Divine Barrier',
    school: 'heal',
    type: 'buff',
    manaCost: 100,
    castTime: 2,
    cooldown: 40,
    requiredLevel: 100,
    failureChanceBase: 0.05,
    buffType: 'invulnerable',
    buffAmount: 100,
    areaOfEffect: 5,
    duration: 3,
    description: 'Make all allies invulnerable for 3 rounds'
  },

  // SUMMON SCHOOL
  summon_sprite: {
    id: 'summon_sprite',
    name: 'Summon Sprite',
    school: 'summon',
    type: 'summon',
    manaCost: 15,
    castTime: 1,
    cooldown: 10,
    requiredLevel: 10,
    failureChanceBase: 0.15,
    summonCreature: 'sprite',
    description: 'Summon a helpful sprite to assist you'
  },

  summon_golem: {
    id: 'summon_golem',
    name: 'Summon Golem',
    school: 'summon',
    type: 'summon',
    manaCost: 30,
    castTime: 2,
    cooldown: 20,
    requiredLevel: 30,
    failureChanceBase: 0.12,
    summonCreature: 'stone_golem',
    description: 'Summon a sturdy stone golem'
  },

  summon_elemental: {
    id: 'summon_elemental',
    name: 'Summon Elemental',
    school: 'summon',
    type: 'summon',
    manaCost: 50,
    castTime: 2,
    cooldown: 25,
    requiredLevel: 50,
    failureChanceBase: 0.1,
    summonCreature: 'elemental',
    description: 'Summon a powerful elemental being'
  },

  summon_greater: {
    id: 'summon_greater',
    name: 'Summon Greater Elemental',
    school: 'summon',
    type: 'summon',
    manaCost: 70,
    castTime: 3,
    cooldown: 40,
    requiredLevel: 70,
    failureChanceBase: 0.08,
    summonCreature: 'greater_elemental',
    description: 'Summon a formidable greater elemental'
  },

  summon_dragon: {
    id: 'summon_dragon',
    name: 'Summon Dragon',
    school: 'summon',
    type: 'summon',
    manaCost: 120,
    castTime: 5,
    cooldown: 100,
    requiredLevel: 100,
    failureChanceBase: 0.05,
    summonCreature: 'dragon',
    description: 'Summon a mighty dragon to fight for you'
  },

  // ARCANE SCHOOL
  detect_magic: {
    id: 'detect_magic',
    name: 'Detect Magic',
    school: 'arcane',
    type: 'utility',
    manaCost: 5,
    castTime: 0,
    cooldown: 5,
    requiredLevel: 10,
    failureChanceBase: 0.05,
    special: 'detect_magic',
    description: 'Sense magical auras in your surroundings'
  },

  telekinesis: {
    id: 'telekinesis',
    name: 'Telekinesis',
    school: 'arcane',
    type: 'utility',
    manaCost: 15,
    castTime: 0,
    cooldown: 5,
    requiredLevel: 30,
    failureChanceBase: 0.1,
    special: 'telekinesis',
    description: 'Move objects with the power of your mind'
  },

  teleport: {
    id: 'teleport',
    name: 'Teleport',
    school: 'arcane',
    type: 'utility',
    manaCost: 30,
    castTime: 1,
    cooldown: 15,
    requiredLevel: 50,
    failureChanceBase: 0.12,
    special: 'teleport',
    description: 'Instantly transport yourself to a distant location'
  },

  arcane_shield: {
    id: 'arcane_shield',
    name: 'Arcane Shield',
    school: 'arcane',
    type: 'buff',
    manaCost: 20,
    castTime: 0,
    cooldown: 8,
    requiredLevel: 70,
    failureChanceBase: 0.08,
    buffType: 'defense',
    buffAmount: 50,
    duration: 5,
    description: 'Create a shield of pure arcane energy'
  },

  time_stop: {
    id: 'time_stop',
    name: 'Time Stop',
    school: 'arcane',
    type: 'control',
    manaCost: 100,
    castTime: 2,
    cooldown: 50,
    requiredLevel: 100,
    failureChanceBase: 0.1,
    special: 'time_stop',
    duration: 1,
    description: 'Stop time, causing all enemies to skip their next turn'
  },

  // DARK SCHOOL
  shadow_bolt: {
    id: 'shadow_bolt',
    name: 'Shadow Bolt',
    school: 'dark',
    type: 'damage',
    manaCost: 12,
    castTime: 0,
    cooldown: 2,
    requiredLevel: 10,
    failureChanceBase: 0.2,
    damage: 28,
    element: 'dark',
    description: 'Fire a bolt of dark energy at your enemy'
  },

  curse: {
    id: 'curse',
    name: 'Curse',
    school: 'dark',
    type: 'debuff',
    manaCost: 20,
    castTime: 0,
    cooldown: 8,
    requiredLevel: 30,
    failureChanceBase: 0.15,
    debuffType: 'all_stats',
    debuffAmount: 20,
    duration: 5,
    description: 'Curse an enemy, reducing all their stats by 20%'
  },

  dominate_undead: {
    id: 'dominate_undead',
    name: 'Dominate Undead',
    school: 'dark',
    type: 'control',
    manaCost: 40,
    castTime: 1,
    cooldown: 20,
    requiredLevel: 50,
    failureChanceBase: 0.12,
    special: 'dominate_undead',
    description: 'Take control of an undead creature'
  },

  life_drain: {
    id: 'life_drain',
    name: 'Life Drain',
    school: 'dark',
    type: 'damage',
    manaCost: 30,
    castTime: 0,
    cooldown: 6,
    requiredLevel: 70,
    failureChanceBase: 0.1,
    damage: 40,
    healing: 40,
    element: 'dark',
    description: 'Drain life from your enemy and heal yourself'
  },

  soul_harvest: {
    id: 'soul_harvest',
    name: 'Soul Harvest',
    school: 'dark',
    type: 'damage',
    manaCost: 100,
    castTime: 3,
    cooldown: 60,
    requiredLevel: 100,
    failureChanceBase: 0.08,
    damage: 200,
    special: 'soul_harvest',
    description: 'Harvest the souls of weak enemies, killing them instantly'
  }
}
