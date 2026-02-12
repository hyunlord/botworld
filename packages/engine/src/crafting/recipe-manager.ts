import type { AdvancedRecipe, RecipeKnowledge, DiscoveryMethod } from '@botworld/shared'
import type { EventBus } from '../core/event-bus.js'
import { ALL_ADVANCED_RECIPES } from './recipe-data.js'

export class RecipeManager {
  // agentId -> Map<recipeId, RecipeKnowledge>
  private knownRecipes = new Map<string, Map<string, RecipeKnowledge>>()

  constructor(private eventBus: EventBus) {}

  /** Initialize default known recipes for an agent (tier 1-2 with discoveryMethod='known') */
  initializeAgent(agentId: string): void {
    if (this.knownRecipes.has(agentId)) return
    const recipes = new Map<string, RecipeKnowledge>()

    for (const recipe of ALL_ADVANCED_RECIPES) {
      if (recipe.discoveryMethod === 'known') {
        recipes.set(recipe.id, {
          recipeId: recipe.id,
          discoveredAt: 0,
          discoveryMethod: 'known',
          timesUsed: 0,
        })
      }
    }

    this.knownRecipes.set(agentId, recipes)
  }

  /** Check if an agent knows a recipe */
  knowsRecipe(agentId: string, recipeId: string): boolean {
    return this.knownRecipes.get(agentId)?.has(recipeId) ?? false
  }

  /** Get all known recipes for an agent */
  getKnownRecipes(agentId: string): AdvancedRecipe[] {
    const known = this.knownRecipes.get(agentId)
    if (!known) return []
    return ALL_ADVANCED_RECIPES.filter((r: AdvancedRecipe) => known.has(r.id))
  }

  /** Get unknown recipes that could be discovered */
  getDiscoverableRecipes(agentId: string): AdvancedRecipe[] {
    const known = this.knownRecipes.get(agentId)
    if (!known) return ALL_ADVANCED_RECIPES.filter((r: AdvancedRecipe) => r.discoveryMethod !== 'known')
    return ALL_ADVANCED_RECIPES.filter((r: AdvancedRecipe) => !known.has(r.id))
  }

  /** Discover a recipe (from scroll, NPC, experiment, etc.) */
  discoverRecipe(agentId: string, recipeId: string, method: DiscoveryMethod, tick: number): boolean {
    if (!this.knownRecipes.has(agentId)) this.initializeAgent(agentId)

    const recipes = this.knownRecipes.get(agentId)!
    if (recipes.has(recipeId)) return false // already known

    const recipe = ALL_ADVANCED_RECIPES.find((r: AdvancedRecipe) => r.id === recipeId)
    if (!recipe) return false

    recipes.set(recipeId, {
      recipeId,
      discoveredAt: tick,
      discoveryMethod: method,
      timesUsed: 0,
    })

    this.eventBus.emit({
      type: 'recipe:discovered',
      agentId,
      recipeId,
      recipeName: recipe.name,
      method,
      timestamp: 0,
    } as any)

    return true
  }

  /** Use a recipe scroll item to learn a recipe */
  useRecipeScroll(agentId: string, recipeId: string, tick: number): boolean {
    return this.discoverRecipe(agentId, recipeId, 'recipe_scroll', tick)
  }

  /** Attempt to discover a recipe through experimentation (alchemy) */
  attemptExperiment(agentId: string, alchemySkill: number, tick: number): { success: boolean; recipeId?: string } {
    const discoverable = this.getDiscoverableRecipes(agentId)
      .filter((r: AdvancedRecipe) => r.discoveryMethod === 'experimentation' && r.requiredSkillLevel <= alchemySkill * 1.2)

    if (discoverable.length === 0) return { success: false }

    // Success chance based on skill
    const chance = Math.min(0.4, alchemySkill * 0.005)
    if (Math.random() > chance) return { success: false }

    // Pick a random discoverable recipe
    const recipe = discoverable[Math.floor(Math.random() * discoverable.length)]
    this.discoverRecipe(agentId, recipe.id, 'experimentation', tick)
    return { success: true, recipeId: recipe.id }
  }

  /** Learn from NPC (requires relationship respect threshold) */
  learnFromNPC(agentId: string, npcSpecialty: string, tick: number): { success: boolean; recipeId?: string } {
    const discoverable = this.getDiscoverableRecipes(agentId)
      .filter((r: AdvancedRecipe) => r.discoveryMethod === 'npc_teaching' && r.category === npcSpecialty)

    if (discoverable.length === 0) return { success: false }

    const recipe = discoverable[0] // teach in order
    this.discoverRecipe(agentId, recipe.id, 'npc_teaching', tick)
    return { success: true, recipeId: recipe.id }
  }

  /** Learn from library research */
  learnFromLibrary(agentId: string, bookTopic: string, tick: number): { success: boolean; recipeId?: string } {
    const discoverable = this.getDiscoverableRecipes(agentId)
      .filter((r: AdvancedRecipe) => r.discoveryMethod === 'library_research')

    if (discoverable.length === 0) return { success: false }

    const recipe = discoverable[Math.floor(Math.random() * discoverable.length)]
    this.discoverRecipe(agentId, recipe.id, 'library_research', tick)
    return { success: true, recipeId: recipe.id }
  }

  /** Record recipe usage */
  recordUsage(agentId: string, recipeId: string, tick: number): void {
    const knowledge = this.knownRecipes.get(agentId)?.get(recipeId)
    if (knowledge) {
      knowledge.timesUsed++
      knowledge.lastUsedAt = tick
    }
  }

  /** Get recipe by ID */
  getRecipe(recipeId: string): AdvancedRecipe | undefined {
    return ALL_ADVANCED_RECIPES.find((r: AdvancedRecipe) => r.id === recipeId)
  }

  /** Get recipes by category */
  getRecipesByCategory(category: string): AdvancedRecipe[] {
    return ALL_ADVANCED_RECIPES.filter((r: AdvancedRecipe) => r.category === category)
  }

  /** Get recipes by facility */
  getRecipesByFacility(facility: string): AdvancedRecipe[] {
    return ALL_ADVANCED_RECIPES.filter((r: AdvancedRecipe) => r.facility === facility)
  }

  /** Format for LLM */
  formatKnownRecipesForLLM(agentId: string): string {
    const recipes = this.getKnownRecipes(agentId)
    if (recipes.length === 0) return '[No recipes known]'
    const byCategory = new Map<string, string[]>()
    for (const r of recipes) {
      if (!byCategory.has(r.category)) byCategory.set(r.category, [])
      byCategory.get(r.category)!.push(r.name)
    }
    const parts: string[] = []
    for (const [cat, names] of byCategory) {
      parts.push(`${cat}: ${names.join(', ')}`)
    }
    return `[Known Recipes] ${parts.join('. ')}`
  }
}
