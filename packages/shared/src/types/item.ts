import type { ResourceType } from './world.js'

// ──────────────────────────────────────────────
// Quality system (replaces rarity for crafted items)
// ──────────────────────────────────────────────

export type ItemQuality = 'crude' | 'basic' | 'fine' | 'masterwork' | 'legendary'

/** Legacy rarity kept for backward compat with loot drops */
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

// ──────────────────────────────────────────────
// Item categories & subcategories
// ──────────────────────────────────────────────

export type ItemCategory =
  | 'weapon' | 'armor' | 'tool' | 'food' | 'potion'
  | 'material' | 'book' | 'decoration' | 'currency'

export type WeaponSubtype =
  | 'sword' | 'axe' | 'bow' | 'staff' | 'dagger' | 'hammer' | 'spear' | 'crossbow'

export type ArmorSubtype =
  | 'helmet' | 'chest' | 'legs' | 'boots' | 'shield' | 'cloak' | 'gauntlet'

export type ToolSubtype =
  | 'pickaxe' | 'woodaxe' | 'fishing_rod' | 'smithing_hammer'
  | 'mortar' | 'cooking_pot' | 'sewing_kit'

export type FoodSubtype =
  | 'bread' | 'stew' | 'pie' | 'roasted_meat' | 'fish_pie' | 'cake'

export type PotionSubtype =
  | 'healing' | 'energy' | 'strength' | 'speed' | 'luck'

export type MaterialTier = 'raw' | 'processed' | 'finished'

export type BookSubtype =
  | 'recipe_scroll' | 'skill_book' | 'lore_book' | 'map_fragment' | 'letter'

export type DecorationSubtype =
  | 'monster_trophy' | 'medal' | 'rare_gem' | 'artifact'

// ──────────────────────────────────────────────
// Equipment stats (extended)
// ──────────────────────────────────────────────

export interface EquipmentStats {
  attack?: number
  defense?: number
  speed?: number
  maxEnergy?: number
  maxHp?: number
  attackSpeed?: number
  critChance?: number
  range?: number
  evasion?: number
  moveSpeed?: number
  resistance?: Partial<Record<ElementType, number>>
}

export type ElementType = 'fire' | 'ice' | 'poison' | 'lightning' | 'holy'

export interface ItemModifier {
  type: ElementType | 'lifesteal' | 'piercing' | 'knockback'
  value: number
}

// ──────────────────────────────────────────────
// Consumable effects
// ──────────────────────────────────────────────

export interface ConsumableEffect {
  type: 'heal_hp' | 'restore_energy' | 'buff_attack' | 'buff_defense'
    | 'cure_hunger' | 'buff_speed' | 'buff_luck' | 'buff_critChance'
  value: number
  duration?: number  // ticks (for buffs)
}

// ──────────────────────────────────────────────
// Provenance — how the item came into the world
// ──────────────────────────────────────────────

export type ItemOrigin = 'crafted' | 'found' | 'dropped' | 'quest_reward' | 'event' | 'spawned'

export interface CraftedProvenance {
  origin: 'crafted'
  crafted_by: string          // agent uuid
  crafted_by_name: string
  crafted_at: number          // tick
  crafted_location: string    // POI or area name
  crafting_skill: number      // crafter's skill level at time
  materials: {
    template: string          // e.g. "iron_ore"
    gathered_by_name?: string
    gathered_location?: string
    quality?: ItemQuality
  }[]
}

export interface FoundProvenance {
  origin: 'found'
  found_by: string
  found_by_name: string
  found_at: number
  found_location: string
  found_context?: string      // "discovered in ancient ruins"
}

export interface DroppedProvenance {
  origin: 'dropped'
  dropped_by: string          // monster name
  dropped_by_type?: string    // monster type
  dropped_at: number
  dropped_location?: string
}

export interface QuestRewardProvenance {
  origin: 'quest_reward'
  quest_name: string
  awarded_to: string
  awarded_to_name: string
  awarded_at: number
}

export interface EventProvenance {
  origin: 'event'
  event_name: string
  event_type: string
  obtained_at: number
}

export interface SpawnedProvenance {
  origin: 'spawned'
  spawned_at: number
  reason?: string
}

export type ItemProvenance =
  | CraftedProvenance
  | FoundProvenance
  | DroppedProvenance
  | QuestRewardProvenance
  | EventProvenance
  | SpawnedProvenance

// ──────────────────────────────────────────────
// History — everything that happened to the item
// ──────────────────────────────────────────────

export type ItemHistoryType =
  | 'created' | 'traded' | 'gifted' | 'stolen' | 'looted'
  | 'equipped' | 'used_in_combat' | 'repaired' | 'enchanted'
  | 'damaged' | 'named' | 'lost' | 'recovered'
  | 'inherited' | 'exhibited' | 'destroyed'

export interface ItemHistoryEntry {
  tick: number
  type: ItemHistoryType
  text: string                 // AI-written one-liner
  agent?: string               // related agent name
  details?: Record<string, unknown>
}

// ──────────────────────────────────────────────
// Location tracking
// ──────────────────────────────────────────────

export type ItemLocationType = 'inventory' | 'equipped' | 'shop' | 'ground' | 'storage'

export interface ItemLocation {
  type: ItemLocationType
  ownerId?: string             // agent id if inventory/equipped
  position?: { x: number; y: number }  // if on ground
  shopId?: string              // if in shop
}

// ──────────────────────────────────────────────
// Core item types
// ──────────────────────────────────────────────

/** Legacy ItemType kept for backward compat */
export type ItemType =
  | 'resource'
  | 'tool'
  | 'weapon'
  | 'food'
  | 'material'
  | 'currency'
  | 'crafted'
  | 'equipment'

/**
 * Rich item — the full item with provenance and history.
 * Stored in ItemManager. Referenced by id in agent inventory.
 */
export interface RichItem {
  id: string
  templateId: string           // e.g. "iron_sword"
  name: string                 // display name (default: template name)
  customName?: string          // AI-given name ("Goblin's Bane")
  description?: string         // AI-written description
  category: ItemCategory
  subtype?: string             // weapon subtype, armor subtype, etc.

  quality: ItemQuality
  durability: number
  maxDurability: number

  stats: EquipmentStats
  modifiers: ItemModifier[]

  ownerId?: string             // current owner agent id
  location: ItemLocation

  provenance: ItemProvenance
  history: ItemHistoryEntry[]

  baseValue: number
  marketValue?: number
  sentimentalValue: number

  createdAt: number            // tick

  // Consumable-specific
  consumableEffect?: ConsumableEffect

  // Book-specific
  bookContent?: {
    title?: string
    author?: string
    authorLocation?: string
    text?: string              // actual content (for lore_book)
    recipeId?: string          // for recipe_scroll
    skillType?: string         // for skill_book
    skillXp?: number
  }

  // Decoration-specific
  trophySource?: string        // monster name for trophy
}

/**
 * Lightweight item reference for agent inventory (backward compat).
 * Links to RichItem by id for detailed data.
 */
export interface Item {
  id: string
  type: ItemType
  name: string
  quantity: number
  rarity?: ItemRarity
  durability?: number
  maxDurability?: number
  equipmentStats?: EquipmentStats
  consumableEffect?: ConsumableEffect
  description?: string
  /** Link to RichItem in ItemManager for provenance/history */
  richItemId?: string
}

// ──────────────────────────────────────────────
// Item templates
// ──────────────────────────────────────────────

export interface ItemTemplate {
  id: string                   // e.g. "iron_sword"
  name: string                 // "Iron Sword"
  category: ItemCategory
  subtype?: string
  baseStats: EquipmentStats
  baseDurability: number
  baseValue: number
  description?: string
  consumableEffect?: ConsumableEffect
  materialTier?: MaterialTier
  bookContent?: RichItem['bookContent']
}

// ──────────────────────────────────────────────
// Crafting recipes (updated)
// ──────────────────────────────────────────────

export interface CraftingRecipe {
  id: string
  name: string
  inputs: { type: string; quantity: number }[]
  output: {
    type: string
    name: string
    quantity: number
    itemType: ItemType
    rarity?: ItemRarity
    equipmentStats?: EquipmentStats
    consumableEffect?: ConsumableEffect
  }
  /** Template ID for the output item (links to ItemTemplate) */
  outputTemplateId?: string
  requiredSkill?: { type: string; level: number }
  craftTime: number
  baseFailChance?: number
  criticalChance?: number
}

// ──────────────────────────────────────────────
// Market orders
// ──────────────────────────────────────────────

export interface MarketOrder {
  id: string
  sellerId: string
  itemType: string
  quantity: number
  pricePerUnit: number
  createdAt: number
}

// ──────────────────────────────────────────────
// Famous items ranking
// ──────────────────────────────────────────────

export interface FamousItemEntry {
  id: string
  name: string
  customName?: string
  category: string
  quality: ItemQuality
  historyLength: number
  createdAt: number
  ownerName?: string
  highlight: string            // why it's famous
}

// ──────────────────────────────────────────────
// Advanced Crafting System
// ──────────────────────────────────────────────

export type RecipeCategory =
  | 'smelting' | 'smithing' | 'woodworking' | 'leatherwork' | 'textiles'
  | 'alchemy' | 'cooking' | 'brewing' | 'construction' | 'enchanting'
  | 'jewelry' | 'pottery' | 'farming'

export type FacilityType =
  | 'smelter' | 'blacksmith' | 'workshop' | 'alchemy_lab'
  | 'bakery' | 'brewery' | 'loom' | 'kiln' | 'sawmill'
  | 'tannery' | 'mill' | 'enchanting_table' | 'ancient_forge'
  | 'kitchen' | 'farm' | 'fish_pond' | 'beehive'

export type DiscoveryMethod =
  | 'known' | 'recipe_scroll' | 'experimentation' | 'npc_teaching'
  | 'library_research' | 'cultural_tradition' | 'quest_reward'

export type CropType =
  | 'grain' | 'potato' | 'carrot' | 'cotton' | 'herb'
  | 'flax' | 'grape' | 'apple' | 'cherry'

export type FarmStructureType =
  | 'crop_field' | 'orchard' | 'beehive' | 'fish_pond'
  | 'pasture' | 'greenhouse'

// ── Advanced Recipe ──

export interface AdvancedRecipe {
  id: string
  name: string
  category: RecipeCategory
  tier: number                    // 1-5
  inputs: RecipeInput[]
  output: RecipeOutput
  facility?: FacilityType         // required building/facility
  facilityLevel?: number          // minimum facility level
  requiredSkill: string           // skill type
  requiredSkillLevel: number
  craftingTime: number            // ticks
  discoveryMethod: DiscoveryMethod
  baseFailChance: number          // 0-1
  description: string
}

export interface RecipeInput {
  itemId: string                  // template ID
  quantity: number
}

export interface RecipeOutput {
  itemId: string                  // template ID
  quantity: number
  qualityAffectedBySkill: boolean
  qualityAffectedByFacility: boolean
}

// ── Recipe Discovery ──

export interface RecipeKnowledge {
  recipeId: string
  discoveredAt: number            // tick
  discoveryMethod: DiscoveryMethod
  timesUsed: number
  lastUsedAt?: number
}

// ── Farming ──

export interface CropPlot {
  id: string
  farmId: string                  // building ID
  cropType: CropType
  plantedAt: number               // tick
  growthProgress: number          // 0-100
  maturityTicks: number           // ticks to mature
  waterLevel: number              // 0-100
  quality: number                 // 0-100 (affects yield)
  isReady: boolean
  season: string
  position: { x: number; y: number }
}

export interface FarmState {
  farmId: string
  plots: CropPlot[]
  structures: FarmStructure[]
  lastTickedAt: number
}

export interface FarmStructure {
  id: string
  type: FarmStructureType
  position: { x: number; y: number }
  level: number
  production?: {
    itemId: string
    interval: number              // ticks between production
    lastProducedAt: number
  }
}

// ── Production Automation ──

export interface ProductionOrder {
  recipeId: string
  auto: boolean                   // repeat automatically
  priority: number                // 1 = highest
  dailyLimit: number              // max per day (0 = unlimited)
  produced: number                // count today
  active: boolean
}

export interface ProductionQueue {
  buildingId: string
  orders: ProductionOrder[]
  workerId?: string               // assigned worker agent/NPC
  currentOrder?: {
    recipeId: string
    progress: number              // 0-100
    startedAt: number
  }
}
