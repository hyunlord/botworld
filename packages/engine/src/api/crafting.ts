import { Router } from 'express'
import type { WorldEngine } from '../core/world-engine.js'
import { requireAuth } from '../auth/middleware.js'

export function createCraftingRouter(world: WorldEngine): Router {
  const router = Router()

  /** GET /crafting/recipes - Get all known recipes for agent */
  router.get('/crafting/recipes', requireAuth(), (req, res) => {
    const agentId = req.agent!.id
    const recipes = world.recipeManager.getKnownRecipes(agentId)
    res.json({ recipes })
  })

  /** GET /crafting/recipes/all - Get all recipes (admin/spectator) */
  router.get('/crafting/recipes/all', (_req, res) => {
    const { ALL_ADVANCED_RECIPES } = require('../crafting/recipe-data.js')
    res.json({ recipes: ALL_ADVANCED_RECIPES, total: ALL_ADVANCED_RECIPES.length })
  })

  /** GET /crafting/recipes/:category - Get recipes by category */
  router.get('/crafting/recipes/category/:category', (req, res) => {
    const recipes = world.recipeManager.getRecipesByCategory(req.params.category)
    res.json({ recipes })
  })

  /** POST /crafting/discover - Attempt recipe discovery */
  router.post('/crafting/discover', requireAuth(), (req, res) => {
    const agentId = req.agent!.id
    const { method, recipeId } = req.body as { method?: string; recipeId?: string }

    if (method === 'experimentation') {
      const agent = world.agentManager.getAgent(agentId)
      const skill = (agent?.skills as Record<string, number>)?.alchemy ?? 0
      const result = world.recipeManager.attemptExperiment(agentId, skill, world.clock.tick)
      return res.json(result)
    }

    if (method === 'scroll' && recipeId) {
      const success = world.recipeManager.useRecipeScroll(agentId, recipeId, world.clock.tick)
      return res.json({ success })
    }

    return res.status(400).json({ error: 'Invalid discovery method' })
  })

  /** GET /crafting/farms - Get all farms */
  router.get('/crafting/farms', (_req, res) => {
    const farms = world.farmingSystem.getAllFarms()
    res.json({ farms })
  })

  /** GET /crafting/farms/:farmId - Get farm state */
  router.get('/crafting/farms/:farmId', (req, res) => {
    const farm = world.farmingSystem.getFarm(req.params.farmId)
    if (!farm) return res.status(404).json({ error: 'Farm not found' })
    res.json({ farm })
  })

  /** POST /crafting/farms/:farmId/plant - Plant a crop */
  router.post('/crafting/farms/:farmId/plant', requireAuth(), (req, res) => {
    const { cropType, x, y } = req.body as { cropType: string; x: number; y: number }
    // Get current season from ecosystem
    const season = world.ecosystemManager.getSeason()
    const plot = world.farmingSystem.plantCrop(req.params.farmId as string, cropType, { x, y }, season, world.clock.tick)
    if (!plot) return res.status(400).json({ error: 'Cannot plant crop' })
    res.json({ plot })
  })

  /** POST /crafting/farms/:farmId/harvest/:plotId - Harvest a crop */
  router.post('/crafting/farms/:farmId/harvest/:plotId', requireAuth(), (req, res) => {
    const agentId = req.agent!.id
    const agent = world.agentManager.getAgent(agentId)
    const skill = (agent?.skills as Record<string, number>)?.farming ?? 0
    const result = world.farmingSystem.harvest(req.params.farmId as string, req.params.plotId as string, skill)
    if (!result) return res.status(400).json({ error: 'Cannot harvest' })
    res.json(result)
  })

  /** GET /crafting/production - Get all production queues */
  router.get('/crafting/production', (_req, res) => {
    const queues = world.productionManager.getAllQueues()
    res.json({ queues })
  })

  /** POST /crafting/production/:buildingId/order - Add production order */
  router.post('/crafting/production/:buildingId/order', requireAuth(), (req, res) => {
    const { recipeId, auto, priority, dailyLimit } = req.body as {
      recipeId: string; auto?: boolean; priority?: number; dailyLimit?: number
    }
    const success = world.productionManager.addOrder(
      req.params.buildingId as string, recipeId, auto ?? true, priority ?? 1, dailyLimit ?? 5,
    )
    if (!success) return res.status(400).json({ error: 'Cannot add order' })
    res.json({ success: true })
  })

  /** DELETE /crafting/production/:buildingId/order/:recipeId - Remove order */
  router.delete('/crafting/production/:buildingId/order/:recipeId', requireAuth(), (req, res) => {
    const success = world.productionManager.removeOrder(req.params.buildingId as string, req.params.recipeId as string)
    res.json({ success })
  })

  return router
}
