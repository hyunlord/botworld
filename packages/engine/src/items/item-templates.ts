import type { ItemTemplate, CraftingRecipe } from '@botworld/shared'

// ──────────────────────────────────────────────
// Weapons (8 types)
// ──────────────────────────────────────────────

const WEAPONS: ItemTemplate[] = [
  {
    id: 'wooden_sword', name: 'Wooden Sword', category: 'weapon', subtype: 'sword',
    baseStats: { attack: 5, attackSpeed: 1.0 }, baseDurability: 30, baseValue: 10,
  },
  {
    id: 'iron_sword', name: 'Iron Sword', category: 'weapon', subtype: 'sword',
    baseStats: { attack: 12, attackSpeed: 1.0, critChance: 0.05 }, baseDurability: 80, baseValue: 45,
  },
  {
    id: 'steel_sword', name: 'Steel Sword', category: 'weapon', subtype: 'sword',
    baseStats: { attack: 18, attackSpeed: 1.1, critChance: 0.08 }, baseDurability: 120, baseValue: 90,
  },
  {
    id: 'iron_axe', name: 'Iron Axe', category: 'weapon', subtype: 'axe',
    baseStats: { attack: 15, attackSpeed: 0.8, critChance: 0.1 }, baseDurability: 90, baseValue: 50,
  },
  {
    id: 'hunting_bow', name: 'Hunting Bow', category: 'weapon', subtype: 'bow',
    baseStats: { attack: 10, attackSpeed: 1.2, range: 5, critChance: 0.08 }, baseDurability: 50, baseValue: 35,
  },
  {
    id: 'oak_staff', name: 'Oak Staff', category: 'weapon', subtype: 'staff',
    baseStats: { attack: 8, attackSpeed: 0.9, maxEnergy: 15 }, baseDurability: 40, baseValue: 30,
  },
  {
    id: 'iron_dagger', name: 'Iron Dagger', category: 'weapon', subtype: 'dagger',
    baseStats: { attack: 7, attackSpeed: 1.5, critChance: 0.15 }, baseDurability: 60, baseValue: 25,
  },
  {
    id: 'war_hammer', name: 'War Hammer', category: 'weapon', subtype: 'hammer',
    baseStats: { attack: 20, attackSpeed: 0.6, critChance: 0.05 }, baseDurability: 100, baseValue: 60,
  },
  {
    id: 'iron_spear', name: 'Iron Spear', category: 'weapon', subtype: 'spear',
    baseStats: { attack: 13, attackSpeed: 1.0, range: 2, critChance: 0.07 }, baseDurability: 70, baseValue: 40,
  },
  {
    id: 'crossbow', name: 'Crossbow', category: 'weapon', subtype: 'crossbow',
    baseStats: { attack: 16, attackSpeed: 0.7, range: 7, critChance: 0.12 }, baseDurability: 60, baseValue: 70,
  },
  // Special drop weapons
  {
    id: 'rusty_dagger', name: 'Rusty Dagger', category: 'weapon', subtype: 'dagger',
    baseStats: { attack: 4, attackSpeed: 1.3 }, baseDurability: 15, baseValue: 5,
  },
  {
    id: 'club', name: 'Club', category: 'weapon', subtype: 'hammer',
    baseStats: { attack: 6, attackSpeed: 0.7 }, baseDurability: 20, baseValue: 3,
  },
]

// ──────────────────────────────────────────────
// Armor (7 types)
// ──────────────────────────────────────────────

const ARMOR: ItemTemplate[] = [
  {
    id: 'leather_helmet', name: 'Leather Helmet', category: 'armor', subtype: 'helmet',
    baseStats: { defense: 3, evasion: 0.02 }, baseDurability: 40, baseValue: 20,
  },
  {
    id: 'leather_armor', name: 'Leather Armor', category: 'armor', subtype: 'chest',
    baseStats: { defense: 8, evasion: 0.03 }, baseDurability: 60, baseValue: 40,
  },
  {
    id: 'iron_armor', name: 'Iron Armor', category: 'armor', subtype: 'chest',
    baseStats: { defense: 15, moveSpeed: -0.1 }, baseDurability: 100, baseValue: 80,
  },
  {
    id: 'leather_boots', name: 'Leather Boots', category: 'armor', subtype: 'boots',
    baseStats: { defense: 2, moveSpeed: 0.1, evasion: 0.02 }, baseDurability: 40, baseValue: 18,
  },
  {
    id: 'wooden_shield', name: 'Wooden Shield', category: 'armor', subtype: 'shield',
    baseStats: { defense: 6 }, baseDurability: 35, baseValue: 15,
  },
  {
    id: 'iron_shield', name: 'Iron Shield', category: 'armor', subtype: 'shield',
    baseStats: { defense: 12 }, baseDurability: 80, baseValue: 50,
  },
  {
    id: 'travelers_cloak', name: "Traveler's Cloak", category: 'armor', subtype: 'cloak',
    baseStats: { defense: 2, moveSpeed: 0.15, evasion: 0.05 }, baseDurability: 30, baseValue: 25,
  },
  {
    id: 'iron_gauntlet', name: 'Iron Gauntlet', category: 'armor', subtype: 'gauntlet',
    baseStats: { defense: 5, attack: 2 }, baseDurability: 60, baseValue: 30,
  },
  {
    id: 'leather_legs', name: 'Leather Leggings', category: 'armor', subtype: 'legs',
    baseStats: { defense: 5, evasion: 0.02 }, baseDurability: 50, baseValue: 28,
  },
  // Special drop armor
  {
    id: 'old_shield', name: 'Old Shield', category: 'armor', subtype: 'shield',
    baseStats: { defense: 3 }, baseDurability: 10, baseValue: 4,
  },
]

// ──────────────────────────────────────────────
// Tools (7 types)
// ──────────────────────────────────────────────

const TOOLS: ItemTemplate[] = [
  {
    id: 'stone_pickaxe', name: 'Stone Pickaxe', category: 'tool', subtype: 'pickaxe',
    baseStats: { attack: 2 }, baseDurability: 40, baseValue: 12,
    description: 'A basic pickaxe for mining ore.',
  },
  {
    id: 'iron_pickaxe', name: 'Iron Pickaxe', category: 'tool', subtype: 'pickaxe',
    baseStats: { attack: 3 }, baseDurability: 80, baseValue: 35,
  },
  {
    id: 'woodaxe', name: 'Woodcutter Axe', category: 'tool', subtype: 'woodaxe',
    baseStats: { attack: 3 }, baseDurability: 60, baseValue: 15,
  },
  {
    id: 'fishing_rod', name: 'Fishing Rod', category: 'tool', subtype: 'fishing_rod',
    baseStats: {}, baseDurability: 30, baseValue: 10,
  },
  {
    id: 'smithing_hammer', name: 'Smithing Hammer', category: 'tool', subtype: 'smithing_hammer',
    baseStats: {}, baseDurability: 100, baseValue: 40,
    description: 'Improves crafting quality when used at a forge.',
  },
  {
    id: 'mortar', name: 'Mortar & Pestle', category: 'tool', subtype: 'mortar',
    baseStats: {}, baseDurability: 50, baseValue: 20,
  },
  {
    id: 'cooking_pot', name: 'Cooking Pot', category: 'tool', subtype: 'cooking_pot',
    baseStats: {}, baseDurability: 70, baseValue: 25,
  },
  {
    id: 'sewing_kit', name: 'Sewing Kit', category: 'tool', subtype: 'sewing_kit',
    baseStats: {}, baseDurability: 40, baseValue: 15,
  },
]

// ──────────────────────────────────────────────
// Food (6 types)
// ──────────────────────────────────────────────

const FOOD: ItemTemplate[] = [
  {
    id: 'bread', name: 'Bread', category: 'food', subtype: 'bread',
    baseStats: {}, baseDurability: 1, baseValue: 5,
    consumableEffect: { type: 'cure_hunger', value: 30 },
  },
  {
    id: 'stew', name: 'Hearty Stew', category: 'food', subtype: 'stew',
    baseStats: {}, baseDurability: 1, baseValue: 12,
    consumableEffect: { type: 'cure_hunger', value: 50 },
  },
  {
    id: 'pie', name: 'Meat Pie', category: 'food', subtype: 'pie',
    baseStats: {}, baseDurability: 1, baseValue: 15,
    consumableEffect: { type: 'cure_hunger', value: 45 },
  },
  {
    id: 'roasted_meat', name: 'Roasted Meat', category: 'food', subtype: 'roasted_meat',
    baseStats: {}, baseDurability: 1, baseValue: 8,
    consumableEffect: { type: 'cure_hunger', value: 35 },
  },
  {
    id: 'fish_pie', name: 'Fish Pie', category: 'food', subtype: 'fish_pie',
    baseStats: {}, baseDurability: 1, baseValue: 18,
    consumableEffect: { type: 'cure_hunger', value: 40 },
  },
  {
    id: 'cake', name: 'Celebration Cake', category: 'food', subtype: 'cake',
    baseStats: {}, baseDurability: 1, baseValue: 25,
    consumableEffect: { type: 'cure_hunger', value: 60 },
  },
]

// ──────────────────────────────────────────────
// Potions (5 types)
// ──────────────────────────────────────────────

const POTIONS: ItemTemplate[] = [
  {
    id: 'healing_potion', name: 'Healing Potion', category: 'potion', subtype: 'healing',
    baseStats: {}, baseDurability: 1, baseValue: 20,
    consumableEffect: { type: 'heal_hp', value: 30 },
  },
  {
    id: 'energy_potion', name: 'Energy Tonic', category: 'potion', subtype: 'energy',
    baseStats: {}, baseDurability: 1, baseValue: 18,
    consumableEffect: { type: 'restore_energy', value: 25 },
  },
  {
    id: 'strength_potion', name: 'Strength Elixir', category: 'potion', subtype: 'strength',
    baseStats: {}, baseDurability: 1, baseValue: 30,
    consumableEffect: { type: 'buff_attack', value: 10, duration: 120 },
  },
  {
    id: 'speed_potion', name: 'Swiftness Draught', category: 'potion', subtype: 'speed',
    baseStats: {}, baseDurability: 1, baseValue: 25,
    consumableEffect: { type: 'buff_speed', value: 5, duration: 120 },
  },
  {
    id: 'luck_potion', name: 'Liquid Luck', category: 'potion', subtype: 'luck',
    baseStats: {}, baseDurability: 1, baseValue: 40,
    consumableEffect: { type: 'buff_luck', value: 15, duration: 180 },
  },
]

// ──────────────────────────────────────────────
// Materials — 3-tier chain
// ──────────────────────────────────────────────

const MATERIALS: ItemTemplate[] = [
  // Tier 1: Raw (gathered)
  { id: 'wood', name: 'Wood', category: 'material', materialTier: 'raw', baseStats: {}, baseDurability: 1, baseValue: 2 },
  { id: 'stone', name: 'Stone', category: 'material', materialTier: 'raw', baseStats: {}, baseDurability: 1, baseValue: 2 },
  { id: 'iron_ore', name: 'Iron Ore', category: 'material', materialTier: 'raw', baseStats: {}, baseDurability: 1, baseValue: 4 },
  { id: 'gold_ore', name: 'Gold Ore', category: 'material', materialTier: 'raw', baseStats: {}, baseDurability: 1, baseValue: 8 },
  { id: 'herb', name: 'Herb', category: 'material', materialTier: 'raw', baseStats: {}, baseDurability: 1, baseValue: 3 },
  { id: 'grain', name: 'Grain', category: 'material', materialTier: 'raw', baseStats: {}, baseDurability: 1, baseValue: 2 },
  { id: 'fish', name: 'Fish', category: 'material', materialTier: 'raw', baseStats: {}, baseDurability: 1, baseValue: 3 },
  { id: 'hide', name: 'Hide', category: 'material', materialTier: 'raw', baseStats: {}, baseDurability: 1, baseValue: 4 },
  { id: 'crystal', name: 'Crystal', category: 'material', materialTier: 'raw', baseStats: {}, baseDurability: 1, baseValue: 12 },

  // Tier 2: Processed
  { id: 'plank', name: 'Plank', category: 'material', materialTier: 'processed', baseStats: {}, baseDurability: 1, baseValue: 6 },
  { id: 'iron_ingot', name: 'Iron Ingot', category: 'material', materialTier: 'processed', baseStats: {}, baseDurability: 1, baseValue: 12 },
  { id: 'gold_ingot', name: 'Gold Ingot', category: 'material', materialTier: 'processed', baseStats: {}, baseDurability: 1, baseValue: 20 },
  { id: 'leather', name: 'Leather', category: 'material', materialTier: 'processed', baseStats: {}, baseDurability: 1, baseValue: 10 },
  { id: 'flour', name: 'Flour', category: 'material', materialTier: 'processed', baseStats: {}, baseDurability: 1, baseValue: 8 },
  { id: 'potion_base', name: 'Potion Base', category: 'material', materialTier: 'processed', baseStats: {}, baseDurability: 1, baseValue: 8 },

  // Monster drops (materials)
  { id: 'slime_gel', name: 'Slime Gel', category: 'material', materialTier: 'raw', baseStats: {}, baseDurability: 1, baseValue: 3 },
  { id: 'wolf_pelt', name: 'Wolf Pelt', category: 'material', materialTier: 'raw', baseStats: {}, baseDurability: 1, baseValue: 6 },
  { id: 'raw_meat', name: 'Raw Meat', category: 'material', materialTier: 'raw', baseStats: {}, baseDurability: 1, baseValue: 3 },
  { id: 'bone', name: 'Bone', category: 'material', materialTier: 'raw', baseStats: {}, baseDurability: 1, baseValue: 2 },
  { id: 'troll_hide', name: 'Troll Hide', category: 'material', materialTier: 'raw', baseStats: {}, baseDurability: 1, baseValue: 15 },
  { id: 'ectoplasm', name: 'Ectoplasm', category: 'material', materialTier: 'raw', baseStats: {}, baseDurability: 1, baseValue: 10 },
  { id: 'spirit_essence', name: 'Spirit Essence', category: 'material', materialTier: 'raw', baseStats: {}, baseDurability: 1, baseValue: 25 },
  { id: 'dragon_scale', name: 'Dragon Scale', category: 'material', materialTier: 'raw', baseStats: {}, baseDurability: 1, baseValue: 40 },
  { id: 'dragon_tooth', name: 'Dragon Tooth', category: 'material', materialTier: 'raw', baseStats: {}, baseDurability: 1, baseValue: 50 },
  { id: 'portal_shard', name: 'Portal Shard', category: 'material', materialTier: 'raw', baseStats: {}, baseDurability: 1, baseValue: 100 },
]

// ──────────────────────────────────────────────
// Books (5 types)
// ──────────────────────────────────────────────

const BOOKS: ItemTemplate[] = [
  {
    id: 'recipe_scroll', name: 'Recipe Scroll', category: 'book', subtype: 'recipe_scroll',
    baseStats: {}, baseDurability: 1, baseValue: 30,
  },
  {
    id: 'skill_book', name: 'Skill Book', category: 'book', subtype: 'skill_book',
    baseStats: {}, baseDurability: 1, baseValue: 50,
  },
  {
    id: 'lore_book', name: 'Lore Book', category: 'book', subtype: 'lore_book',
    baseStats: {}, baseDurability: 1, baseValue: 20,
  },
  {
    id: 'map_fragment', name: 'Map Fragment', category: 'book', subtype: 'map_fragment',
    baseStats: {}, baseDurability: 1, baseValue: 15,
  },
  {
    id: 'letter', name: 'Letter', category: 'book', subtype: 'letter',
    baseStats: {}, baseDurability: 1, baseValue: 1,
  },
]

// ──────────────────────────────────────────────
// Decorations (4 types)
// ──────────────────────────────────────────────

const DECORATIONS: ItemTemplate[] = [
  {
    id: 'monster_trophy', name: 'Monster Trophy', category: 'decoration', subtype: 'monster_trophy',
    baseStats: {}, baseDurability: 100, baseValue: 15,
  },
  {
    id: 'medal', name: 'Medal of Honor', category: 'decoration', subtype: 'medal',
    baseStats: {}, baseDurability: 500, baseValue: 50,
  },
  {
    id: 'rare_gem', name: 'Rare Gem', category: 'decoration', subtype: 'rare_gem',
    baseStats: {}, baseDurability: 1000, baseValue: 80,
  },
  {
    id: 'artifact', name: 'Ancient Artifact', category: 'decoration', subtype: 'artifact',
    baseStats: { maxHp: 10, maxEnergy: 10 }, baseDurability: 200, baseValue: 200,
  },
]

// ──────────────────────────────────────────────
// Currency
// ──────────────────────────────────────────────

const CURRENCY: ItemTemplate[] = [
  {
    id: 'gold_coin', name: 'Gold Coin', category: 'currency',
    baseStats: {}, baseDurability: 1, baseValue: 1,
  },
]

// ──────────────────────────────────────────────
// All templates + lookup
// ──────────────────────────────────────────────

export const ALL_TEMPLATES: ItemTemplate[] = [
  ...WEAPONS, ...ARMOR, ...TOOLS, ...FOOD, ...POTIONS,
  ...MATERIALS, ...BOOKS, ...DECORATIONS, ...CURRENCY,
]

const TEMPLATE_MAP = new Map<string, ItemTemplate>()
for (const t of ALL_TEMPLATES) {
  TEMPLATE_MAP.set(t.id, t)
}

export function getItemTemplate(id: string): ItemTemplate | undefined {
  return TEMPLATE_MAP.get(id)
}

// ──────────────────────────────────────────────
// Crafting recipes (full set with outputTemplateId)
// ──────────────────────────────────────────────

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  // Tier 2: Processing
  {
    id: 'recipe_plank', name: 'Plank', outputTemplateId: 'plank',
    inputs: [{ type: 'wood', quantity: 2 }],
    output: { type: 'plank', name: 'Plank', quantity: 1, itemType: 'material' as const },
    craftTime: 6, baseFailChance: 0.02,
  },
  {
    id: 'recipe_iron_ingot', name: 'Iron Ingot', outputTemplateId: 'iron_ingot',
    inputs: [{ type: 'iron_ore', quantity: 2 }, { type: 'wood', quantity: 1 }],
    output: { type: 'iron_ingot', name: 'Iron Ingot', quantity: 1, itemType: 'material' as const },
    requiredSkill: { type: 'crafting', level: 10 },
    craftTime: 15, baseFailChance: 0.08,
  },
  {
    id: 'recipe_gold_ingot', name: 'Gold Ingot', outputTemplateId: 'gold_ingot',
    inputs: [{ type: 'gold_ore', quantity: 2 }, { type: 'wood', quantity: 1 }],
    output: { type: 'gold_ingot', name: 'Gold Ingot', quantity: 1, itemType: 'material' as const },
    requiredSkill: { type: 'crafting', level: 20 },
    craftTime: 18, baseFailChance: 0.1,
  },
  {
    id: 'recipe_leather', name: 'Leather', outputTemplateId: 'leather',
    inputs: [{ type: 'hide', quantity: 2 }],
    output: { type: 'leather', name: 'Leather', quantity: 1, itemType: 'material' as const },
    requiredSkill: { type: 'crafting', level: 5 },
    craftTime: 10, baseFailChance: 0.05,
  },
  {
    id: 'recipe_flour', name: 'Flour', outputTemplateId: 'flour',
    inputs: [{ type: 'grain', quantity: 3 }],
    output: { type: 'flour', name: 'Flour', quantity: 1, itemType: 'material' as const },
    craftTime: 5, baseFailChance: 0.02,
  },
  {
    id: 'recipe_potion_base', name: 'Potion Base', outputTemplateId: 'potion_base',
    inputs: [{ type: 'herb', quantity: 2 }],
    output: { type: 'potion_base', name: 'Potion Base', quantity: 1, itemType: 'material' as const },
    requiredSkill: { type: 'crafting', level: 8 },
    craftTime: 8, baseFailChance: 0.05,
  },

  // Tier 3: Weapons
  {
    id: 'recipe_wooden_sword', name: 'Wooden Sword', outputTemplateId: 'wooden_sword',
    inputs: [{ type: 'wood', quantity: 3 }],
    output: { type: 'wooden_sword', name: 'Wooden Sword', quantity: 1, itemType: 'weapon' as const, equipmentStats: { attack: 5 } },
    craftTime: 10, baseFailChance: 0.05,
  },
  {
    id: 'recipe_iron_sword', name: 'Iron Sword', outputTemplateId: 'iron_sword',
    inputs: [{ type: 'iron_ingot', quantity: 2 }, { type: 'plank', quantity: 1 }],
    output: { type: 'iron_sword', name: 'Iron Sword', quantity: 1, itemType: 'weapon' as const, equipmentStats: { attack: 12 } },
    requiredSkill: { type: 'crafting', level: 20 },
    craftTime: 25, baseFailChance: 0.12,
  },
  {
    id: 'recipe_iron_axe', name: 'Iron Axe', outputTemplateId: 'iron_axe',
    inputs: [{ type: 'iron_ingot', quantity: 2 }, { type: 'wood', quantity: 2 }],
    output: { type: 'iron_axe', name: 'Iron Axe', quantity: 1, itemType: 'weapon' as const, equipmentStats: { attack: 15 } },
    requiredSkill: { type: 'crafting', level: 18 },
    craftTime: 22, baseFailChance: 0.1,
  },
  {
    id: 'recipe_hunting_bow', name: 'Hunting Bow', outputTemplateId: 'hunting_bow',
    inputs: [{ type: 'wood', quantity: 3 }, { type: 'leather', quantity: 1 }],
    output: { type: 'hunting_bow', name: 'Hunting Bow', quantity: 1, itemType: 'weapon' as const, equipmentStats: { attack: 10 } },
    requiredSkill: { type: 'crafting', level: 15 },
    craftTime: 18, baseFailChance: 0.08,
  },
  {
    id: 'recipe_iron_dagger', name: 'Iron Dagger', outputTemplateId: 'iron_dagger',
    inputs: [{ type: 'iron_ingot', quantity: 1 }, { type: 'leather', quantity: 1 }],
    output: { type: 'iron_dagger', name: 'Iron Dagger', quantity: 1, itemType: 'weapon' as const, equipmentStats: { attack: 7 } },
    requiredSkill: { type: 'crafting', level: 12 },
    craftTime: 14, baseFailChance: 0.06,
  },
  {
    id: 'recipe_war_hammer', name: 'War Hammer', outputTemplateId: 'war_hammer',
    inputs: [{ type: 'iron_ingot', quantity: 3 }, { type: 'plank', quantity: 1 }],
    output: { type: 'war_hammer', name: 'War Hammer', quantity: 1, itemType: 'weapon' as const, equipmentStats: { attack: 20 } },
    requiredSkill: { type: 'crafting', level: 25 },
    craftTime: 30, baseFailChance: 0.15,
  },

  // Tier 3: Armor
  {
    id: 'recipe_leather_armor', name: 'Leather Armor', outputTemplateId: 'leather_armor',
    inputs: [{ type: 'leather', quantity: 3 }],
    output: { type: 'leather_armor', name: 'Leather Armor', quantity: 1, itemType: 'equipment' as const, equipmentStats: { defense: 8 } },
    requiredSkill: { type: 'crafting', level: 10 },
    craftTime: 18, baseFailChance: 0.08,
  },
  {
    id: 'recipe_iron_armor', name: 'Iron Armor', outputTemplateId: 'iron_armor',
    inputs: [{ type: 'iron_ingot', quantity: 3 }, { type: 'leather', quantity: 2 }],
    output: { type: 'iron_armor', name: 'Iron Armor', quantity: 1, itemType: 'equipment' as const, equipmentStats: { defense: 15 } },
    requiredSkill: { type: 'crafting', level: 25 },
    craftTime: 30, baseFailChance: 0.15,
  },
  {
    id: 'recipe_leather_boots', name: 'Leather Boots', outputTemplateId: 'leather_boots',
    inputs: [{ type: 'leather', quantity: 2 }],
    output: { type: 'leather_boots', name: 'Leather Boots', quantity: 1, itemType: 'equipment' as const, equipmentStats: { defense: 2 } },
    requiredSkill: { type: 'crafting', level: 8 },
    craftTime: 12, baseFailChance: 0.06,
  },
  {
    id: 'recipe_wooden_shield', name: 'Wooden Shield', outputTemplateId: 'wooden_shield',
    inputs: [{ type: 'plank', quantity: 3 }],
    output: { type: 'wooden_shield', name: 'Wooden Shield', quantity: 1, itemType: 'equipment' as const, equipmentStats: { defense: 6 } },
    requiredSkill: { type: 'crafting', level: 5 },
    craftTime: 10, baseFailChance: 0.05,
  },

  // Tier 3: Tools
  {
    id: 'recipe_stone_pickaxe', name: 'Stone Pickaxe', outputTemplateId: 'stone_pickaxe',
    inputs: [{ type: 'stone', quantity: 2 }, { type: 'wood', quantity: 1 }],
    output: { type: 'stone_pickaxe', name: 'Stone Pickaxe', quantity: 1, itemType: 'tool' as const, equipmentStats: { attack: 2 } },
    requiredSkill: { type: 'crafting', level: 5 },
    craftTime: 12, baseFailChance: 0.05,
  },
  {
    id: 'recipe_iron_pickaxe', name: 'Iron Pickaxe', outputTemplateId: 'iron_pickaxe',
    inputs: [{ type: 'iron_ingot', quantity: 2 }, { type: 'wood', quantity: 1 }],
    output: { type: 'iron_pickaxe', name: 'Iron Pickaxe', quantity: 1, itemType: 'tool' as const },
    requiredSkill: { type: 'crafting', level: 15 },
    craftTime: 18, baseFailChance: 0.08,
  },
  {
    id: 'recipe_smithing_hammer', name: 'Smithing Hammer', outputTemplateId: 'smithing_hammer',
    inputs: [{ type: 'iron_ingot', quantity: 2 }, { type: 'plank', quantity: 1 }],
    output: { type: 'smithing_hammer', name: 'Smithing Hammer', quantity: 1, itemType: 'tool' as const },
    requiredSkill: { type: 'crafting', level: 20 },
    craftTime: 20, baseFailChance: 0.1,
  },
  {
    id: 'recipe_fishing_rod', name: 'Fishing Rod', outputTemplateId: 'fishing_rod',
    inputs: [{ type: 'wood', quantity: 2 }, { type: 'leather', quantity: 1 }],
    output: { type: 'fishing_rod', name: 'Fishing Rod', quantity: 1, itemType: 'tool' as const },
    requiredSkill: { type: 'crafting', level: 5 },
    craftTime: 8, baseFailChance: 0.04,
  },

  // Tier 3: Food
  {
    id: 'recipe_bread', name: 'Bread', outputTemplateId: 'bread',
    inputs: [{ type: 'flour', quantity: 2 }],
    output: { type: 'bread', name: 'Bread', quantity: 1, itemType: 'food' as const, consumableEffect: { type: 'cure_hunger', value: 30 } },
    requiredSkill: { type: 'cooking', level: 1 },
    craftTime: 8, baseFailChance: 0.05,
  },
  {
    id: 'recipe_stew', name: 'Hearty Stew', outputTemplateId: 'stew',
    inputs: [{ type: 'raw_meat', quantity: 2 }, { type: 'herb', quantity: 1 }],
    output: { type: 'stew', name: 'Hearty Stew', quantity: 1, itemType: 'food' as const, consumableEffect: { type: 'cure_hunger', value: 50 } },
    requiredSkill: { type: 'cooking', level: 10 },
    craftTime: 12, baseFailChance: 0.08,
  },
  {
    id: 'recipe_roasted_meat', name: 'Roasted Meat', outputTemplateId: 'roasted_meat',
    inputs: [{ type: 'raw_meat', quantity: 1 }],
    output: { type: 'roasted_meat', name: 'Roasted Meat', quantity: 1, itemType: 'food' as const, consumableEffect: { type: 'cure_hunger', value: 35 } },
    requiredSkill: { type: 'cooking', level: 3 },
    craftTime: 6, baseFailChance: 0.04,
  },

  // Tier 3: Potions
  {
    id: 'recipe_healing_potion', name: 'Healing Potion', outputTemplateId: 'healing_potion',
    inputs: [{ type: 'potion_base', quantity: 1 }, { type: 'herb', quantity: 1 }],
    output: { type: 'healing_potion', name: 'Healing Potion', quantity: 1, itemType: 'food' as const, consumableEffect: { type: 'heal_hp', value: 30 } },
    requiredSkill: { type: 'crafting', level: 12 },
    craftTime: 12, baseFailChance: 0.1,
  },
  {
    id: 'recipe_energy_potion', name: 'Energy Tonic', outputTemplateId: 'energy_potion',
    inputs: [{ type: 'potion_base', quantity: 1 }, { type: 'crystal', quantity: 1 }],
    output: { type: 'energy_potion', name: 'Energy Tonic', quantity: 1, itemType: 'food' as const, consumableEffect: { type: 'restore_energy', value: 25 } },
    requiredSkill: { type: 'crafting', level: 15 },
    craftTime: 14, baseFailChance: 0.1,
  },
  {
    id: 'recipe_strength_potion', name: 'Strength Elixir', outputTemplateId: 'strength_potion',
    inputs: [{ type: 'potion_base', quantity: 1 }, { type: 'troll_hide', quantity: 1 }],
    output: { type: 'strength_potion', name: 'Strength Elixir', quantity: 1, itemType: 'food' as const, consumableEffect: { type: 'buff_attack', value: 10, duration: 120 } },
    requiredSkill: { type: 'crafting', level: 25 },
    craftTime: 18, baseFailChance: 0.15,
  },

  // Fallback wildcard
  {
    id: 'recipe_basic_tool', name: 'Basic Tool',
    inputs: [{ type: '*', quantity: 1 }, { type: '*', quantity: 1 }],
    output: { type: 'basic_tool', name: 'Basic Tool', quantity: 1, itemType: 'crafted' as const },
    craftTime: 15, baseFailChance: 0.05,
  },
]
