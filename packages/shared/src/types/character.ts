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
  spriteHash: string
}>
