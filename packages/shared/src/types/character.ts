import type { PersonalityTraits, EmotionState, Relationship } from './emotion.js'
import type { AgentStats, SkillType } from './agent.js'
import type { Item } from './item.js'
import type { Position } from './world.js'

// ──────────────────────────────────────────────
// Race & Class
// ──────────────────────────────────────────────

export type Race =
  | 'human'
  | 'elf'
  | 'dwarf'
  | 'orc'
  | 'beastkin'
  | 'undead'
  | 'fairy'
  | 'dragonkin'

export type CharacterClass =
  | 'warrior'
  | 'mage'
  | 'rogue'
  | 'cleric'
  | 'ranger'
  | 'bard'
  | 'alchemist'
  | 'merchant'

export type Gender = 'male' | 'female'

export type EquipmentQuality = 'crude' | 'basic' | 'fine' | 'masterwork' | 'legendary'

export type WeaponType =
  | 'none' | 'sword' | 'greatsword' | 'axe' | 'battle_axe' | 'dagger' | 'spear'
  | 'hammer' | 'war_hammer' | 'bow' | 'crossbow' | 'staff' | 'wand' | 'mace'
  | 'halberd' | 'katana' | 'rapier' | 'flail' | 'pickaxe' | 'woodaxe' | 'fishing_rod'

export type ShieldType = 'none' | 'buckler' | 'kite_shield' | 'tower_shield'

export type PantsType = 'cloth_pants' | 'leather_pants' | 'chain_leggings' | 'plate_leggings' | 'robe_skirt'
export type ShoesType = 'sandals' | 'boots' | 'armored_boots' | 'mage_shoes'
export type HelmetType = 'none' | 'leather_cap' | 'chain_coif' | 'iron_helm' | 'full_helm' | 'crown'
export type CloakType = 'none' | 'short_cloak' | 'long_cloak' | 'royal_cloak'

export type HairStyle =
  | 'short_crop' | 'medium_wavy' | 'long_straight' | 'long_braided' | 'ponytail'
  | 'mohawk' | 'bald' | 'curly' | 'twin_tails' | 'topknot'
  | 'short_messy' | 'braided' | 'afro' | 'bob' | 'spiky' // legacy compat

export const SKIN_PALETTES = {
  pale: '#FFE0D0',
  light: '#F5C5A3',
  medium: '#D4A373',
  tan: '#C48B5C',
  brown: '#8B6544',
  dark: '#5C3A21',
  fantasy_green: '#7CAA6E',
  fantasy_blue: '#A0C4E8',
} as const

export type SkinPalette = keyof typeof SKIN_PALETTES

export const HAIR_PALETTES = {
  black: '#1A1A1A',
  dark_brown: '#3D2B1F',
  brown: '#6B4423',
  auburn: '#922724',
  ginger: '#C45A27',
  blonde: '#E8C872',
  platinum: '#E8E0D0',
  white: '#F0EDE8',
  silver: '#C0C0C0',
  blue: '#4488CC',
  green: '#44AA66',
  purple: '#8844AA',
} as const

export type HairPalette = keyof typeof HAIR_PALETTES

// ──────────────────────────────────────────────
// Appearance — layered sprite system
// ──────────────────────────────────────────────

export interface RacialFeatures {
  earType?: 'normal' | 'pointed' | 'long_pointed' | 'animal'
  hornType?: 'none' | 'small' | 'curved' | 'dragon'
  tailType?: 'none' | 'fox' | 'cat' | 'dragon' | 'demon'
  wingType?: 'none' | 'fairy' | 'bat' | 'feathered'
  skinTexture?: 'smooth' | 'scaled' | 'bark' | 'ethereal'
}

export interface CharacterAppearance {
  // Body
  bodyType: 'slim' | 'average' | 'athletic' | 'large'
  height: 'short' | 'medium' | 'tall'
  skinTone: string // hex '#F5D6C3'

  // Face
  faceShape: 'round' | 'oval' | 'square' | 'heart' | 'long'
  eyeShape: 'round' | 'almond' | 'monolid' | 'hooded' | 'droopy'
  eyeColor: string // hex
  eyebrowStyle: 'thin' | 'thick' | 'arched' | 'straight' | 'bushy'
  noseType: 'small' | 'button' | 'straight' | 'wide' | 'pointed'
  mouthType: 'small' | 'wide' | 'thin_lip' | 'full_lip'

  // Hair
  hairStyle: string // 'short_messy' | 'long_straight' | 'ponytail' | 'braided' | 'bald' | 'afro' | 'mohawk' etc
  hairColor: string // hex
  facialHair?: 'none' | 'stubble' | 'beard' | 'mustache' | 'goatee'

  // Equipment / Armor
  headgear?: string // 'wizard_hat' | 'hood' | 'crown' | 'bandana' | 'helmet' | 'none'
  armor: string     // 'cloth_robe' | 'leather' | 'chainmail' | 'plate' | 'casual'
  armorPrimaryColor: string   // hex
  armorSecondaryColor: string // hex
  cape?: 'none' | 'short' | 'long'
  capeColor?: string // hex

  // Accessories (max 3)
  accessories: string[] // ['scarf', 'necklace', 'monocle', 'earring', 'gloves', 'belt_pouch']

  // Markings
  markings: string[] // ['scar_left_eye', 'freckles', 'tattoo_arm', 'birthmark']
  aura?: 'none' | 'fire' | 'ice' | 'nature' | 'shadow' | 'holy' | 'arcane'

  // Racial features (optional)
  racialFeatures?: RacialFeatures

  // Gender (new - PROMPT 21 Visual Identity)
  gender?: Gender

  // Equipment layers (new - PROMPT 21 Visual Identity)
  pants?: PantsType
  shoes?: ShoesType
  helmet?: HelmetType
  cloak?: CloakType
  weapon?: WeaponType
  weaponQuality?: EquipmentQuality
  shield?: ShieldType
  armorQuality?: EquipmentQuality

  // Portrait (new - PROMPT 21 Visual Identity)
  portraitUrl?: string
}

// ──────────────────────────────────────────────
// Personality — OCEAN + RP elements
// ──────────────────────────────────────────────

export interface CharacterPersonality {
  // OCEAN model (0-1)
  traits: PersonalityTraits

  // RP-specific
  values: string[]       // max 3: 'honor' | 'knowledge' | 'freedom' | 'wealth' | 'family' etc
  fears: string[]        // max 2: 'darkness' | 'betrayal' | 'failure' | 'heights' etc
  speechStyle: string    // 'formal' | 'casual' | 'archaic' | 'scholarly' | 'street' | 'poetic'
  quirks: string[]       // max 3: 'always_hums' | 'collects_shiny_things' | 'talks_to_plants' etc
  catchphrase?: string   // max 50 chars
}

// ──────────────────────────────────────────────
// Character creation request (bot → server)
// ──────────────────────────────────────────────

export interface CharacterCreationRequest {
  name: string                      // 2-20 chars, content-filtered
  race: Race
  characterClass: CharacterClass    // 'class' is JS reserved word
  appearance: CharacterAppearance
  personality: CharacterPersonality
  backstory: string                 // max 500 chars
  persona_reasoning: string         // required, max 300 chars — why the bot chose this design
}

// ──────────────────────────────────────────────
// Character (server-persisted)
// ──────────────────────────────────────────────

export interface Character {
  id: string
  agentId: string
  creation: CharacterCreationRequest
  spriteHash: string               // generated sprite combination hash
  level: number
  xp: number
  stats: AgentStats
  skills: Record<SkillType, number>
  inventory: Item[]
  currentMood: EmotionState
  relationships: Record<string, Relationship>
  position: Position
  createdAt: number
  lastActiveAt: number
}

// ──────────────────────────────────────────────
// Client rendering map (sent via socket)
// ──────────────────────────────────────────────

/** agentId → appearance data for client-side layered sprite rendering */
export type CharacterAppearanceMap = Record<string, {
  appearance: CharacterAppearance
  race: Race
  characterClass?: CharacterClass
  persona_reasoning?: string
  spriteHash: string
}>

// ──────────────────────────────────────────────
// Helper Functions — PROMPT 21 Visual Identity
// ──────────────────────────────────────────────

export function getBodyKey(race: Race, gender: Gender): string {
  return `${race}_${gender}`
}

export const RACE_DEFAULTS: Record<Race, Partial<CharacterAppearance>> = {
  human: { skinTone: '#F5C5A3', height: 'medium', bodyType: 'average' },
  elf: { skinTone: '#F5C5A3', height: 'tall', bodyType: 'slim' },
  dwarf: { skinTone: '#D4A373', height: 'short', bodyType: 'large' },
  orc: { skinTone: '#7CAA6E', height: 'tall', bodyType: 'athletic' },
  beastkin: { skinTone: '#D4A373', height: 'medium', bodyType: 'athletic' },
  undead: { skinTone: '#A0C4E8', height: 'medium', bodyType: 'slim' },
  fairy: { skinTone: '#FFE0D0', height: 'short', bodyType: 'slim' },
  dragonkin: { skinTone: '#8B6544', height: 'tall', bodyType: 'large' },
}
