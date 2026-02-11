import { type Router as IRouter, Router, type Request, type Response } from 'express'
import { requireAuth } from '../auth/middleware.js'
import type { WorldEngine } from '../core/world-engine.js'

export function createWorldRouter(world: WorldEngine): IRouter {
  const router = Router()

  // ── GET /me — authenticated agent's own state ──
  router.get('/me',
    requireAuth(),
    (req: Request, res: Response) => {
      const agentId = req.agent!.id
      const agent = world.agentManager.getAgent(agentId)
      if (!agent) {
        res.status(404).json({ error: 'Agent not found in world' })
        return
      }
      const memory = world.agentManager.getMemoryStream(agentId)
      res.json({
        ...agent,
        recentMemories: memory?.getRecent(20) ?? [],
      })
    },
  )

  // ── GET /world/around — nearby agents, POIs, resources ──
  router.get('/world/around',
    requireAuth(),
    (req: Request, res: Response) => {
      const agentId = req.agent!.id
      const radius = Math.max(1, Math.min(20, Number(req.query.radius) || 5))

      const agent = world.agentManager.getAgent(agentId)
      if (!agent) {
        res.status(404).json({ error: 'Agent not found in world' })
        return
      }

      // Nearby agents
      const nearbyAgents = world.agentManager.getNearbyAgents(agentId, radius)

      // Nearby POIs (Chebyshev distance)
      const nearbyPois = world.tileMap.pois.filter((poi) => {
        const dx = Math.abs(poi.position.x - agent.position.x)
        const dy = Math.abs(poi.position.y - agent.position.y)
        return dx <= radius && dy <= radius
      })

      // Nearby tiles with resources
      const resources: Array<{
        position: { x: number; y: number }
        type: string
        amount: number
      }> = []
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const x = agent.position.x + dx
          const y = agent.position.y + dy
          const tile = world.tileMap.getTile(x, y)
          if (tile?.resource && tile.resource.amount > 0) {
            resources.push({
              position: { x, y },
              type: tile.resource.type,
              amount: tile.resource.amount,
            })
          }
        }
      }

      res.json({
        self: {
          position: agent.position,
          stats: agent.stats,
          currentAction: agent.currentAction?.type ?? 'idle',
        },
        agents: nearbyAgents.map((a) => ({
          id: a.id,
          name: a.name,
          position: a.position,
          currentAction: a.currentAction?.type ?? 'idle',
        })),
        pois: nearbyPois.map((p) => ({
          name: p.name,
          type: p.type,
          position: p.position,
        })),
        resources,
        radius,
      })
    },
  )

  return router
}
