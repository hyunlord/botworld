import { Router } from 'express'
import type { WorldEngine } from '../core/world-engine.js'

export function createLayersRouter(world: WorldEngine): Router {
  const router = Router()

  /** GET /layers - Get all world layers (summary) */
  router.get('/layers', (req, res) => {
    const state = world.layerManager.getState()
    res.json(state)
  })

  /** GET /layers/:layerId - Get specific layer details */
  router.get('/layers/:layerId', (req, res) => {
    const layer = world.layerManager.getLayer(req.params.layerId)
    if (!layer) return res.status(404).json({ error: 'Layer not found' })
    const agents = world.layerManager.getAgentsInLayer(req.params.layerId)
    const portals = world.layerManager.getLayerPortals(req.params.layerId)
    res.json({ layer, agents, portals })
  })

  /** GET /layers/agent/:agentId - Get agent's current layer and fog of war */
  router.get('/layers/agent/:agentId', (req, res) => {
    const agentId = req.params.agentId
    const layerId = world.layerManager.getAgentLayer(agentId)
    const layer = world.layerManager.getLayer(layerId)
    const fog = world.layerManager.getFogOfWar(agentId, layerId)
    const portals = world.layerManager.getLayerPortals(layerId)
    res.json({ agentId, layerId, layer, fog, portals })
  })

  /** POST /layers/transition - Move agent through a portal */
  router.post('/layers/transition', (req, res) => {
    const { agentId, portalId } = req.body as { agentId: string; portalId: string }
    const result = world.layerManager.transitionAgent(agentId, portalId, world.clock.tick)
    if (!result.success) return res.status(400).json({ error: result.reason })
    const newLayerId = world.layerManager.getAgentLayer(agentId)
    const newLayer = world.layerManager.getLayer(newLayerId)
    res.json({ success: true, newLayerId, newLayer: newLayer?.name })
  })

  /** GET /layers/portals/:layerId - Get all portals for a layer */
  router.get('/layers/portals/:layerId', (req, res) => {
    const portals = world.layerManager.getLayerPortals(req.params.layerId)
    res.json({ layerId: req.params.layerId, portals })
  })

  // ── Ocean endpoints ──

  /** GET /ocean - Get ocean state (islands, ships, creatures) */
  router.get('/ocean', (req, res) => {
    const islands = world.oceanSystem.getIslands()
    const ships = world.oceanSystem.getAllShips()
    const creatures = world.oceanSystem.getSeaCreatures()
    res.json({ islands, ships, creatures: creatures.length })
  })

  /** GET /ocean/ships - Get all ships */
  router.get('/ocean/ships', (req, res) => {
    res.json({ ships: world.oceanSystem.getAllShips() })
  })

  /** GET /ocean/ships/:shipId - Get specific ship */
  router.get('/ocean/ships/:shipId', (req, res) => {
    const ship = world.oceanSystem.getShip(req.params.shipId)
    if (!ship) return res.status(404).json({ error: 'Ship not found' })
    res.json({ ship })
  })

  /** POST /ocean/build-ship - Start building a ship */
  router.post('/ocean/build-ship', (req, res) => {
    const { agentId, shipType, dockPosition } = req.body as {
      agentId: string
      shipType: string
      dockPosition: { x: number; y: number }
    }
    const result = world.oceanSystem.startBuildShip(
      agentId, shipType as any, dockPosition, world.clock.tick
    )
    res.json(result)
  })

  /** POST /ocean/set-sail - Set sail from dock */
  router.post('/ocean/set-sail', (req, res) => {
    const { shipId, destination } = req.body as {
      shipId: string
      destination: { x: number; y: number }
    }
    const result = world.oceanSystem.setSail(shipId, destination, world.clock.tick)
    res.json(result)
  })

  /** POST /ocean/dock - Dock a ship */
  router.post('/ocean/dock', (req, res) => {
    const { shipId } = req.body as { shipId: string }
    const result = world.oceanSystem.dockShip(shipId, world.clock.tick)
    res.json(result)
  })

  /** POST /ocean/board - Board a ship */
  router.post('/ocean/board', (req, res) => {
    const { agentId, shipId } = req.body as { agentId: string; shipId: string }
    const result = world.oceanSystem.boardShip(agentId, shipId)
    res.json(result)
  })

  /** POST /ocean/disembark - Leave a ship */
  router.post('/ocean/disembark', (req, res) => {
    const { agentId, shipId } = req.body as { agentId: string; shipId: string }
    const result = world.oceanSystem.disembark(agentId, shipId)
    res.json(result)
  })

  /** GET /ocean/islands - Get all islands */
  router.get('/ocean/islands', (req, res) => {
    res.json({ islands: world.oceanSystem.getIslands() })
  })

  return router
}
