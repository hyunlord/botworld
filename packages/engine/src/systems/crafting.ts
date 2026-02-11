import type { Agent, CraftingRecipe, Item, ItemRarity, EquipmentStats } from '@botworld/shared'
import { RARITY_STAT_MULTIPLIER } from '@botworld/shared'
import { contentFilter } from '../security/content-filter.js'

// ──────────────────────────────────────────────
// Built-in recipe database
// ──────────────────────────────────────────────

const RECIPES: CraftingRecipe[] = [
  // Basic tools & weapons
  {
    id: 'recipe_wooden_sword',
    name: 'Wooden Sword',
    inputs: [{ type: 'wood', quantity: 3 }],
    output: {
      type: 'wooden_sword', name: 'Wooden Sword', quantity: 1,
      itemType: 'weapon', rarity: 'common',
      equipmentStats: { attack: 5 },
    },
    requiredSkill: { type: 'crafting', level: 0 },
    craftTime: 10,
    baseFailChance: 0.05,
    criticalChance: 0.1,
  },
  {
    id: 'recipe_stone_pickaxe',
    name: 'Stone Pickaxe',
    inputs: [{ type: 'stone', quantity: 2 }, { type: 'wood', quantity: 1 }],
    output: {
      type: 'stone_pickaxe', name: 'Stone Pickaxe', quantity: 1,
      itemType: 'tool', rarity: 'common',
      equipmentStats: { attack: 2 },
    },
    requiredSkill: { type: 'crafting', level: 5 },
    craftTime: 12,
    baseFailChance: 0.1,
    criticalChance: 0.1,
  },

  // Food & consumables
  {
    id: 'recipe_bread',
    name: 'Bread',
    inputs: [{ type: 'wheat', quantity: 2 }],
    output: {
      type: 'bread', name: 'Bread', quantity: 1,
      itemType: 'food', rarity: 'common',
      consumableEffect: { type: 'cure_hunger', value: 30 },
    },
    craftTime: 8,
    baseFailChance: 0.05,
    criticalChance: 0.15,
  },
  {
    id: 'recipe_healing_potion',
    name: 'Healing Potion',
    inputs: [{ type: 'herb', quantity: 3 }, { type: 'water', quantity: 1 }],
    output: {
      type: 'healing_potion', name: 'Healing Potion', quantity: 1,
      itemType: 'food',
      consumableEffect: { type: 'heal_hp', value: 25 },
    },
    requiredSkill: { type: 'crafting', level: 10 },
    craftTime: 15,
    baseFailChance: 0.15,
    criticalChance: 0.1,
  },
  {
    id: 'recipe_energy_tonic',
    name: 'Energy Tonic',
    inputs: [{ type: 'herb', quantity: 2 }, { type: 'berry', quantity: 2 }],
    output: {
      type: 'energy_tonic', name: 'Energy Tonic', quantity: 1,
      itemType: 'food',
      consumableEffect: { type: 'restore_energy', value: 20 },
    },
    requiredSkill: { type: 'crafting', level: 8 },
    craftTime: 12,
    baseFailChance: 0.1,
    criticalChance: 0.1,
  },

  // Processed materials
  {
    id: 'recipe_iron_ingot',
    name: 'Iron Ingot',
    inputs: [{ type: 'iron_ore', quantity: 2 }],
    output: {
      type: 'iron_ingot', name: 'Iron Ingot', quantity: 1,
      itemType: 'material', rarity: 'uncommon',
    },
    requiredSkill: { type: 'crafting', level: 15 },
    craftTime: 20,
    baseFailChance: 0.1,
    criticalChance: 0.05,
  },
  {
    id: 'recipe_leather',
    name: 'Leather',
    inputs: [{ type: 'hide', quantity: 2 }],
    output: {
      type: 'leather', name: 'Leather', quantity: 1,
      itemType: 'material', rarity: 'common',
    },
    requiredSkill: { type: 'crafting', level: 5 },
    craftTime: 10,
    baseFailChance: 0.05,
    criticalChance: 0.05,
  },

  // Advanced equipment
  {
    id: 'recipe_iron_sword',
    name: 'Iron Sword',
    inputs: [{ type: 'iron_ingot', quantity: 2 }, { type: 'wood', quantity: 1 }],
    output: {
      type: 'iron_sword', name: 'Iron Sword', quantity: 1,
      itemType: 'weapon', rarity: 'uncommon',
      equipmentStats: { attack: 12, speed: -1 },
    },
    requiredSkill: { type: 'crafting', level: 20 },
    craftTime: 25,
    baseFailChance: 0.15,
    criticalChance: 0.1,
  },
  {
    id: 'recipe_leather_armor',
    name: 'Leather Armor',
    inputs: [{ type: 'leather', quantity: 3 }],
    output: {
      type: 'leather_armor', name: 'Leather Armor', quantity: 1,
      itemType: 'equipment', rarity: 'common',
      equipmentStats: { defense: 8 },
    },
    requiredSkill: { type: 'crafting', level: 10 },
    craftTime: 18,
    baseFailChance: 0.1,
    criticalChance: 0.1,
  },

  // Wildcard fallback (replaces legacy 2-material → tool)
  {
    id: 'recipe_basic_tool',
    name: 'Basic Tool',
    inputs: [{ type: '*', quantity: 1 }, { type: '*', quantity: 1 }],
    output: {
      type: 'basic_tool', name: 'Basic Tool', quantity: 1,
      itemType: 'crafted', rarity: 'common',
    },
    craftTime: 15,
    baseFailChance: 0.05,
    criticalChance: 0.05,
  },
]

// ──────────────────────────────────────────────
// Rarity upgrade map
// ──────────────────────────────────────────────

const RARITY_UPGRADE: Record<string, ItemRarity> = {
  common: 'uncommon',
  uncommon: 'rare',
  rare: 'epic',
  epic: 'legendary',
  legendary: 'legendary',
}

// ──────────────────────────────────────────────
// CraftingSystem
// ──────────────────────────────────────────────

export interface CraftResult {
  success: boolean
  item?: Item
  critical?: boolean
  failed?: boolean
  reason?: string
}

export class CraftingSystem {
  private recipes: CraftingRecipe[] = [...RECIPES]

  getRecipes(): CraftingRecipe[] {
    return this.recipes
  }

  getRecipe(id: string): CraftingRecipe | undefined {
    return this.recipes.find(r => r.id === id)
  }

  /** Check if agent can craft a specific recipe */
  canCraft(agent: Agent, recipeId: string): { ok: boolean; reason?: string } {
    const recipe = this.getRecipe(recipeId)
    if (!recipe) return { ok: false, reason: 'Recipe not found' }

    // Skill level check
    if (recipe.requiredSkill) {
      const skillLevel = (agent.skills as Record<string, number>)[recipe.requiredSkill.type] ?? 0
      if (skillLevel < recipe.requiredSkill.level) {
        return {
          ok: false,
          reason: `Requires ${recipe.requiredSkill.type} level ${recipe.requiredSkill.level} (current: ${Math.floor(skillLevel)})`,
        }
      }
    }

    // Material check (wildcard '*' = any item)
    for (const input of recipe.inputs) {
      if (input.type === '*') {
        const totalItems = agent.inventory.reduce((sum, i) => sum + i.quantity, 0)
        if (totalItems < input.quantity) {
          return { ok: false, reason: `Need at least ${input.quantity} item(s)` }
        }
      } else {
        const item = agent.inventory.find(
          i => i.type === input.type || i.name.toLowerCase() === input.type,
        )
        if (!item || item.quantity < input.quantity) {
          return { ok: false, reason: `Missing ${input.type} x${input.quantity}` }
        }
      }
    }

    return { ok: true }
  }

  /** Auto-match a recipe from available inventory */
  findMatchingRecipe(agent: Agent): CraftingRecipe | undefined {
    // Try explicit recipes first (non-wildcard)
    for (const recipe of this.recipes) {
      if (recipe.inputs.some(i => i.type === '*')) continue
      if (this.canCraft(agent, recipe.id).ok) return recipe
    }
    // Fallback to wildcard recipe
    return this.recipes.find(r =>
      r.inputs.some(i => i.type === '*') && this.canCraft(agent, r.id).ok,
    )
  }

  /** Execute craft — consume materials, roll success/fail/critical */
  executeCraft(
    agent: Agent,
    recipeId: string,
    generateId: (prefix: string) => string,
  ): CraftResult {
    const recipe = this.getRecipe(recipeId)
    if (!recipe) return { success: false, reason: 'Recipe not found' }

    const check = this.canCraft(agent, recipeId)
    if (!check.ok) return { success: false, reason: check.reason }

    // Consume materials
    for (const input of recipe.inputs) {
      if (input.type === '*') {
        let remaining = input.quantity
        for (const item of agent.inventory) {
          if (remaining <= 0) break
          const take = Math.min(item.quantity, remaining)
          item.quantity -= take
          remaining -= take
        }
      } else {
        const item = agent.inventory.find(
          i => i.type === input.type || i.name.toLowerCase() === input.type,
        )!
        item.quantity -= input.quantity
      }
    }
    agent.inventory = agent.inventory.filter(i => i.quantity > 0)

    // Failure roll (reduced by skill level)
    const skillLevel = (agent.skills as Record<string, number>)[
      recipe.requiredSkill?.type ?? 'crafting'
    ] ?? 0
    const failChance = Math.max(0, (recipe.baseFailChance ?? 0) - skillLevel * 0.002)
    if (Math.random() < failChance) {
      return { success: false, failed: true, reason: 'Crafting failed! Materials lost.' }
    }

    // Critical success roll (increased by skill level)
    const critChance = (recipe.criticalChance ?? 0) + skillLevel * 0.001
    const isCritical = Math.random() < critChance

    // Determine final rarity
    const baseRarity = recipe.output.rarity ?? 'common'
    const finalRarity: ItemRarity = isCritical
      ? (RARITY_UPGRADE[baseRarity] ?? baseRarity)
      : baseRarity
    const statMultiplier = RARITY_STAT_MULTIPLIER[finalRarity] ?? 1.0

    // Create item
    const item: Item = {
      id: generateId('item'),
      type: recipe.output.itemType,
      name: isCritical ? `Fine ${recipe.output.name}` : recipe.output.name,
      quantity: recipe.output.quantity,
      rarity: finalRarity,
    }

    // Apply equipment stats (with rarity multiplier)
    if (recipe.output.equipmentStats) {
      const stats: EquipmentStats = {}
      for (const [stat, val] of Object.entries(recipe.output.equipmentStats)) {
        (stats as Record<string, number>)[stat] = Math.round(
          (val as number) * statMultiplier,
        )
      }
      item.equipmentStats = stats
    }

    // Apply consumable effect (critical = 1.5x value)
    if (recipe.output.consumableEffect) {
      item.consumableEffect = {
        ...recipe.output.consumableEffect,
        value: Math.round(
          recipe.output.consumableEffect.value * (isCritical ? 1.5 : 1),
        ),
      }
    }

    return { success: true, item, critical: isCritical }
  }

  /** Validate item name with ContentFilter */
  async validateItemName(agentId: string, name: string): Promise<boolean> {
    const result = await contentFilter.filterMessage(agentId, name)
    return result.allowed
  }
}

export const craftingSystem = new CraftingSystem()
