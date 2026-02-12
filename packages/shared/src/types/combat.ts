import type { Position } from './world.js'
import type { Item } from './item.js'

// ── Monster Types ──

export type MonsterType =
  | 'slime' | 'rat' | 'bat' | 'skeleton' | 'zombie'
  | 'goblin' | 'goblin_shaman' | 'goblin_chief'
  | 'orc_warrior' | 'orc_berserker'
  | 'bandit' | 'bandit_leader'
  | 'harpy' | 'troll' | 'ghost' | 'wraith'
  | 'ogre' | 'wyvern' | 'basilisk' | 'minotaur' | 'lich'
  | 'dragon_whelp' | 'dragon' | 'ancient_golem'
  | 'world_serpent' | 'demon_lord'

export interface LootEntry {
  itemType: string
  chance: number // 0-1
  quantityMin: number
  quantityMax: number
}

export interface Monster {
  id: string
  type: MonsterType
  name: string
  level: number
  hp: number
  maxHp: number
  attack: number
  defense: number
  position: Position
  loot: LootEntry[]
  aggroRadius: number
  respawnTicks: number
  isDead: boolean
  deathTick: number | null
}

// ── Combat State ──

export type CombatOutcome = 'victory' | 'defeat' | 'fled'

export interface CombatRound {
  round: number
  agentDamage: number
  monsterDamage: number
  agentHp: number
  monsterHp: number
  description: string
}

export interface CombatState {
  id: string
  agentId: string
  monsterId: string
  monsterType: MonsterType
  monsterName: string
  rounds: CombatRound[]
  outcome: CombatOutcome | null
  lootDropped: Item[]
  startedAt: number
}

// ── Monster Templates ──

export interface MonsterTemplate {
  type: MonsterType
  name: string
  baseHp: number
  baseAttack: number
  baseDefense: number
  aggroRadius: number
  respawnTicks: number
  loot: LootEntry[]
  /** Min level to spawn */
  minLevel: number
  /** Spawn weight (higher = more common) */
  weight: number
}

// ── Advanced Combat Types ──

export type CombatType = 'duel' | 'skirmish' | 'raid' | 'siege' | 'boss'

export type BodyPartType = 'head' | 'torso' | 'left_arm' | 'right_arm' | 'left_leg' | 'right_leg'

export type ConditionType =
  | 'poisoned' | 'bleeding' | 'stunned' | 'frozen'
  | 'burned' | 'blinded' | 'feared' | 'paralyzed'
  | 'enraged' | 'shielded' | 'blessed' | 'cursed'

export type TerrainType =
  | 'hill' | 'water' | 'forest' | 'desert' | 'snow'
  | 'cave' | 'wall_top' | 'road' | 'open'

export type FormationType = 'line' | 'wedge' | 'circle' | 'ambush'

export type CombatRole = 'frontline' | 'ranged' | 'support' | 'commander'

export type CombatSide = 'attacker' | 'defender' | 'neutral'

export type CombatActionType =
  | 'melee_attack' | 'ranged_attack' | 'defend' | 'dodge'
  | 'use_item' | 'cast_spell' | 'flee' | 'intimidate'
  | 'rally' | 'special_attack' | 'aim' | 'disarm'
  | 'grapple' | 'surrender'

// ── Body Part System ──

export interface BodyPartState {
  type: BodyPartType
  hp: number
  maxHp: number
  disabled: boolean
}

export interface BodyParts {
  head: BodyPartState
  torso: BodyPartState
  left_arm: BodyPartState
  right_arm: BodyPartState
  left_leg: BodyPartState
  right_leg: BodyPartState
}

// ── Conditions ──

export interface ActiveCondition {
  type: ConditionType
  remainingRounds: number
  source: string // who applied it
  potency: number // damage multiplier or effect strength
}

// ── Terrain Effects ──

export interface TerrainEffect {
  terrain: TerrainType
  attackModifier: number      // multiplier (1.15 = +15%)
  defenseModifier: number
  accuracyModifier: number
  evasionModifier: number
  speedModifier: number
  stealthModifier: number
  rangeModifier: number       // added range for ranged attacks
  specialEffects: string[]    // e.g. 'fire_immune', 'ambush_possible'
}

// ── Combat Actions ──

export interface CombatAction {
  type: CombatActionType
  targetId?: string           // target participant
  targetBodyPart?: BodyPartType
  itemId?: string             // for use_item
  spellName?: string          // for cast_spell
}

// ── Combat Participant ──

export interface CombatParticipant {
  id: string                  // agent/creature ID
  name: string
  side: CombatSide
  role: CombatRole
  isCreature: boolean         // true for monsters/animals, false for agents
  position: { x: number; y: number }  // combat-internal position
  hpStart: number
  hpCurrent: number
  maxHp: number
  attack: number
  defense: number
  speed: number
  accuracy: number
  evasion: number
  bodyParts: BodyParts
  conditions: ActiveCondition[]
  equipment: { weapon?: string; armor?: string; shield?: string; items: string[] }
  morale: number              // 0-100
  actionsThisRound: CombatAction[]
  isDefeated: boolean
  isAiming: boolean           // aim action buff
  isDefending: boolean        // defend action buff
  isDodging: boolean          // dodge action buff
  isGrappled: boolean         // grapple status
  isGrappling: boolean        // grappling someone
}

// ── Combat Round (Advanced) ──

export interface AdvancedCombatRound {
  round: number
  actions: RoundAction[]
  conditionEffects: { participantId: string; condition: ConditionType; damage: number }[]
  summary: string
}

export interface RoundAction {
  actorId: string
  actorName: string
  action: CombatAction
  targetId?: string
  targetName?: string
  result: ActionResult
}

export interface ActionResult {
  hit: boolean
  damage: number
  bodyPartHit?: BodyPartType
  critical: boolean
  conditionApplied?: ConditionType
  bodyPartDisabled?: BodyPartType
  fled?: boolean
  surrendered?: boolean
  itemUsed?: string
  moraleDelta?: number
  description: string
}

// ── Damage Calculation ──

export interface DamageCalcInput {
  attackerAttack: number
  weaponDamage: number
  weaponQuality: number       // multiplier (1.0 = normal)
  targetDefense: number
  armorReduction: number
  targetBodyPart: BodyPartType
  terrainModifier: number
  isAiming: boolean
  isCritical: boolean
  conditions: ConditionType[] // attacker conditions
  targetConditions: ConditionType[]
}

export interface DamageCalcResult {
  baseDamage: number
  actualDamage: number
  mitigated: number
  critical: boolean
  bodyPartDamage: number      // damage to specific body part
}

// ── Combat Instance ──

export interface CombatInstance {
  id: string
  type: CombatType
  participants: CombatParticipant[]
  location: Position
  terrain: TerrainType
  formation: { attacker: FormationType; defender: FormationType }
  startedAt: number           // tick
  endedAt?: number
  rounds: AdvancedCombatRound[]
  maxRounds: number
  currentRound: number
  result?: CombatResult
  loot: { itemType: string; quantity: number }[]
  isActive: boolean
}

export interface CombatResult {
  winningSide: CombatSide | 'draw'
  survivors: { id: string; hpRemaining: number }[]
  casualties: { id: string; name: string; side: CombatSide }[]
  xpAwarded: Record<string, number>  // participantId -> xp
  lootDistribution: Record<string, { itemType: string; quantity: number }[]>
  reputationChanges: Record<string, number>
  duration: number            // rounds taken
  summary: string
}

// ── Combat AI Context ──

export interface CombatAIContext {
  self: {
    name: string
    hp: number
    maxHp: number
    attack: number
    defense: number
    equipment: CombatParticipant['equipment']
    conditions: ActiveCondition[]
    bodyParts: BodyParts
    morale: number
  }
  enemies: {
    id: string
    name: string
    hp: number
    maxHp: number
    conditions: ActiveCondition[]
    bodyParts: BodyParts
    distance: number
  }[]
  allies: {
    id: string
    name: string
    hp: number
    maxHp: number
    role: CombatRole
    distance: number
  }[]
  terrain: TerrainType
  round: number
  maxRounds: number
  formation: FormationType
  availableActions: CombatActionType[]
  tacticalAdvice: string
}
