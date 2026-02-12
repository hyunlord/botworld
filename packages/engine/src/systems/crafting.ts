import type { Agent, CraftingRecipe, Item, ItemRarity, EquipmentStats, RichItem, ItemQuality } from '@botworld/shared'
import { RARITY_STAT_MULTIPLIER } from '@botworld/shared'
import { contentFilter } from '../security/content-filter.js'
import { CRAFTING_RECIPES } from '../items/item-templates.js'
import type { ItemManager } from '../items/item-manager.js'
import type { ItemNamer } from '../items/item-namer.js'
import { calculateQualityScore, scoreToQuality } from '../items/quality.js'
import type { TileMap } from '../world/tile-map.js'

// ──────────────────────────────────────────────
// Rarity upgrade map (legacy compat)
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
  richItem?: RichItem
  critical?: boolean
  failed?: boolean
  reason?: string
  quality?: ItemQuality
}

export class CraftingSystem {
  private recipes: CraftingRecipe[] = [...CRAFTING_RECIPES]
  private itemManager: ItemManager | null = null
  private itemNamer: ItemNamer | null = null
  private tileMap: TileMap | null = null

  /** Wire up the ItemManager for rich item creation */
  setItemManager(manager: ItemManager): void {
    this.itemManager = manager
  }

  setItemNamer(namer: ItemNamer): void {
    this.itemNamer = namer
  }

  setTileMap(tileMap: TileMap): void {
    this.tileMap = tileMap
  }

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

  /** Execute craft — consume materials, roll quality, create rich item */
  executeCraft(
    agent: Agent,
    recipeId: string,
    generateId: (prefix: string) => string,
  ): CraftResult {
    const recipe = this.getRecipe(recipeId)
    if (!recipe) return { success: false, reason: 'Recipe not found' }

    const check = this.canCraft(agent, recipeId)
    if (!check.ok) return { success: false, reason: check.reason }

    // Collect material info for provenance BEFORE consuming
    const consumedMaterials: { template: string; quality?: ItemQuality; richItemId?: string }[] = []

    // Consume materials
    for (const input of recipe.inputs) {
      if (input.type === '*') {
        let remaining = input.quantity
        for (const item of agent.inventory) {
          if (remaining <= 0) break
          const take = Math.min(item.quantity, remaining)
          consumedMaterials.push({
            template: item.type,
            richItemId: item.richItemId,
          })
          item.quantity -= take
          remaining -= take
        }
      } else {
        const item = agent.inventory.find(
          i => i.type === input.type || i.name.toLowerCase() === input.type,
        )!
        for (let n = 0; n < input.quantity; n++) {
          consumedMaterials.push({
            template: input.type,
            richItemId: item.richItemId,
          })
        }
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

    // ── New quality system (if ItemManager is available) ──
    if (this.itemManager && recipe.outputTemplateId) {
      return this.craftRichItem(agent, recipe, consumedMaterials, skillLevel)
    }

    // ── Legacy fallback (no ItemManager) ──
    return this.craftLegacyItem(agent, recipe, generateId, skillLevel)
  }

  /**
   * Create a rich item using the new quality/provenance system.
   */
  private craftRichItem(
    agent: Agent,
    recipe: CraftingRecipe,
    consumedMaterials: { template: string; quality?: ItemQuality; richItemId?: string }[],
    skillLevel: number,
  ): CraftResult {
    // Build material provenance with rich data from consumed items
    const materialProvenance = consumedMaterials.map(mat => {
      // Try to get rich item data for provenance chain
      const richMat = mat.richItemId ? this.itemManager!.getItem(mat.richItemId) : null
      const gathered = richMat?.provenance
      return {
        template: mat.template,
        gathered_by_name: gathered?.origin === 'found' ? gathered.found_by_name
          : gathered?.origin === 'crafted' ? gathered.crafted_by_name
          : undefined,
        gathered_location: gathered?.origin === 'found' ? gathered.found_location
          : gathered?.origin === 'crafted' ? gathered.crafted_location
          : undefined,
        quality: richMat?.quality ?? mat.quality,
      }
    })

    // Find tool bonus (check if agent has a smithing_hammer equipped/in inventory)
    const toolItem = agent.inventory.find(i =>
      i.type === 'tool' && i.name.toLowerCase().includes('smithing hammer'),
    )
    const toolRichItem = toolItem?.richItemId ? this.itemManager!.getItem(toolItem.richItemId) : null
    const toolQuality = toolRichItem?.quality

    // Apply tool durability
    if (toolItem?.richItemId) {
      this.itemManager!.useToolDurability(toolItem.richItemId, agent.name)
    }

    // Determine crafting location
    const location = this.getNearestPOIName(agent.position)

    // Calculate quality
    const materialQualities = materialProvenance
      .map(m => m.quality)
      .filter((q): q is ItemQuality => !!q)

    const qualityInput = {
      materialQualities: materialQualities.length > 0 ? materialQualities : ['basic' as ItemQuality],
      crafterSkill: skillLevel,
      toolQuality,
    }
    const qualityScore = calculateQualityScore(qualityInput)
    const quality = scoreToQuality(qualityScore)

    // Create rich item
    const richItem = this.itemManager!.createItem(
      recipe.outputTemplateId!,
      {
        origin: 'crafted',
        crafted_by: agent.id,
        crafted_by_name: agent.name,
        crafted_at: 0, // will be set by ItemManager from clock
        crafted_location: location,
        crafting_skill: skillLevel,
        materials: materialProvenance,
      },
      {
        quality,
        ownerId: agent.id,
      },
    )

    if (!richItem) {
      return { success: false, reason: 'Failed to create item from template' }
    }

    // Create lightweight Item for agent inventory
    const item: Item = {
      id: richItem.id,
      type: recipe.output.itemType,
      name: richItem.customName ?? richItem.name,
      quantity: recipe.output.quantity,
      rarity: this.qualityToRarity(quality),
      durability: richItem.durability,
      maxDurability: richItem.maxDurability,
      equipmentStats: Object.keys(richItem.stats).length > 0 ? richItem.stats : undefined,
      consumableEffect: richItem.consumableEffect,
      richItemId: richItem.id,
    }

    agent.inventory.push(item)

    // Trigger AI naming for masterwork+
    if (this.itemNamer && (quality === 'masterwork' || quality === 'legendary')) {
      this.itemNamer.nameOnCreation(richItem, agent.name).catch(() => {})
    }

    return {
      success: true,
      item,
      richItem,
      quality,
      critical: quality === 'masterwork' || quality === 'legendary',
    }
  }

  /**
   * Legacy item creation (no ItemManager).
   */
  private craftLegacyItem(
    agent: Agent,
    recipe: CraftingRecipe,
    generateId: (prefix: string) => string,
    skillLevel: number,
  ): CraftResult {
    // Critical success roll
    const critChance = (recipe.criticalChance ?? 0) + skillLevel * 0.001
    const isCritical = Math.random() < critChance

    const baseRarity = recipe.output.rarity ?? 'common'
    const finalRarity: ItemRarity = isCritical
      ? (RARITY_UPGRADE[baseRarity] ?? baseRarity)
      : baseRarity
    const statMultiplier = RARITY_STAT_MULTIPLIER[finalRarity] ?? 1.0

    const item: Item = {
      id: generateId('item'),
      type: recipe.output.itemType,
      name: isCritical ? `Fine ${recipe.output.name}` : recipe.output.name,
      quantity: recipe.output.quantity,
      rarity: finalRarity,
    }

    if (recipe.output.equipmentStats) {
      const stats: EquipmentStats = {}
      for (const [stat, val] of Object.entries(recipe.output.equipmentStats)) {
        (stats as Record<string, number>)[stat] = Math.round((val as number) * statMultiplier)
      }
      item.equipmentStats = stats
    }

    if (recipe.output.consumableEffect) {
      item.consumableEffect = {
        ...recipe.output.consumableEffect,
        value: Math.round(recipe.output.consumableEffect.value * (isCritical ? 1.5 : 1)),
      }
    }

    return { success: true, item, critical: isCritical }
  }

  private qualityToRarity(quality: ItemQuality): ItemRarity {
    switch (quality) {
      case 'crude': return 'common'
      case 'basic': return 'common'
      case 'fine': return 'uncommon'
      case 'masterwork': return 'epic'
      case 'legendary': return 'legendary'
    }
  }

  private getNearestPOIName(position: { x: number; y: number }): string {
    if (!this.tileMap) return 'the wilderness'
    let nearest: string = 'the wilderness'
    let nearestDist = Infinity
    for (const poi of this.tileMap.pois) {
      const dx = position.x - poi.position.x
      const dy = position.y - poi.position.y
      const dist = dx * dx + dy * dy
      if (dist < nearestDist) {
        nearestDist = dist
        nearest = poi.name
      }
    }
    return nearestDist < 400 ? nearest : 'the wilderness'
  }

  /** Validate item name with ContentFilter */
  async validateItemName(agentId: string, name: string): Promise<boolean> {
    const result = await contentFilter.filterMessage(agentId, name)
    return result.allowed
  }
}

export const craftingSystem = new CraftingSystem()
