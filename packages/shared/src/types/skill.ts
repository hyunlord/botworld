// Skill categories
export type SkillCategory = 'combat' | 'crafting' | 'magic' | 'social' | 'survival'

// All 25 individual skill IDs
export type SkillId =
  // Combat (4)
  | 'melee' | 'ranged' | 'defense' | 'tactics'
  // Crafting (6)
  | 'smithing' | 'woodworking' | 'alchemy' | 'cooking' | 'enchanting' | 'tailoring'
  // Magic (6)
  | 'fire' | 'ice' | 'heal' | 'summon' | 'arcane' | 'dark'
  // Social (5)
  | 'charisma' | 'deception' | 'leadership' | 'trading' | 'lore'
  // Survival (5)
  | 'gathering' | 'hunting' | 'stealth' | 'navigation' | 'farming'

// Spell school type (magic skills)
export type SpellSchool = 'fire' | 'ice' | 'heal' | 'summon' | 'arcane' | 'dark'

// Ability definition — unlocked at specific skill levels
export interface SkillAbility {
  id: string
  name: string
  description: string
  skillId: SkillId
  requiredLevel: number // 10, 30, 50, 70, 100
  type: 'passive' | 'active' | 'toggle'
  effects: AbilityEffect[]
}

export interface AbilityEffect {
  stat?: string       // stat to modify (attack, defense, etc.)
  modifier?: number   // multiplier or flat bonus
  modifierType?: 'flat' | 'percent'
  duration?: number   // in rounds/ticks, 0 = permanent passive
  special?: string    // special effect key (e.g., 'counter_attack', 'piercing_shot')
}

// Full skill definition
export interface SkillDefinition {
  id: SkillId
  name: string
  category: SkillCategory
  description: string
  abilities: SkillAbility[]    // abilities unlocked at various levels
  xpPerAction: [number, number] // [min, max] XP per relevant action
}

// Agent's state for a single skill
export interface AgentSkillState {
  skillId: SkillId
  level: number          // 0-100
  xp: number
  xpToNext: number       // level * level * 10
  unlockedAbilities: string[]  // ability IDs
}

// Skill combo — special abilities from combining two skills
export interface SkillCombo {
  id: string
  name: string
  description: string
  skill1: SkillId
  skill1MinLevel: number
  skill2: SkillId
  skill2MinLevel: number
  ability: SkillAbility
}

// ── Spell System ──

export type SpellType = 'damage' | 'heal' | 'buff' | 'debuff' | 'summon' | 'control' | 'utility'

// Spell definition — flat property structure for direct access
export interface SpellDefinition {
  id: string
  name: string
  school: SpellSchool
  type: SpellType
  description: string
  manaCost: number
  castTime: number           // rounds to cast (0 = instant)
  cooldown: number           // ticks before can cast again
  requiredLevel: number      // minimum skill level in that school
  failureChanceBase: number  // 0-1, reduced by skill level
  // Damage spells
  damage?: number
  element?: 'fire' | 'ice' | 'holy' | 'dark' | 'arcane' | 'physical'
  // Heal spells
  healing?: number
  // Buff/debuff spells
  buffType?: string
  buffAmount?: number
  debuffType?: string
  debuffAmount?: number
  // Control/condition spells
  condition?: string         // condition applied (e.g., 'burned', 'frozen')
  conditionDuration?: number
  // Summon spells
  summonCreature?: string
  // Utility
  special?: string           // special effect key
  // Area & duration
  areaOfEffect?: number      // radius in tiles, undefined = single target
  duration?: number          // rounds for persistent effects
}

// Agent's magic state
export interface AgentMagicState {
  agentId: string
  maxMana: number
  currentMana: number
  activeCasts: ActiveCast[]           // spells currently being cast
  cooldowns: Record<string, number>   // spellId -> tick when available
  activeEffects: ActiveSpellEffect[]
}

export interface ActiveCast {
  castId: string
  agentId: string
  spellId: string
  targetId?: string
  targetPos?: { x: number; y: number }
  startTick: number
  completionTick: number     // tick when casting finishes
}

export interface ActiveSpellEffect {
  effectId: string
  spellId: string
  targetId: string
  type: 'buff' | 'debuff' | 'dot' | 'hot'
  value: number
  startTick: number
  endTick: number
}

// Learning/teaching
export type LearningMethod = 'practice' | 'npc_teaching' | 'skill_book' | 'academy' | 'apprenticeship'

export interface SkillLearningEvent {
  agentId: string
  skillId: SkillId
  method: LearningMethod
  xpGained: number
  newLevel?: number
  abilityUnlocked?: string
  teacherId?: string
}

// Skill build archetype (emergent from skill distribution)
export type ArchetypeId =
  | 'warrior' | 'ranger' | 'mage' | 'healer' | 'necromancer'
  | 'blacksmith' | 'alchemist' | 'enchanter' | 'chef'
  | 'diplomat' | 'merchant' | 'spy' | 'scholar'
  | 'survivalist' | 'hunter' | 'farmer'
  | 'battlemage' | 'paladin' | 'assassin' | 'jack_of_all_trades'
