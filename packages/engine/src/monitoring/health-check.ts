import { Router, type Request, type Response } from 'express'
import { pool } from '../db/connection.js'
import type { WorldEngine } from '../core/world-engine.js'
import type { MetricsCollector } from './metrics.js'

// ──────────────────────────────────────────────
// Health check router (no auth required)
// ──────────────────────────────────────────────

export function createHealthRouter(world: WorldEngine, _metrics: MetricsCollector): Router {
  const router = Router()

  // GET /health — server status (public, no auth)
  router.get('/health', async (_req: Request, res: Response) => {
    let dbOk = false
    try {
      await pool.query('SELECT 1')
      dbOk = true
    } catch {
      /* db unreachable */
    }

    const status = world.isRunning() && dbOk ? 'healthy' : 'degraded'
    const code = status === 'healthy' ? 200 : 503

    res.status(code).json({
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      engine: {
        running: world.isRunning(),
        paused: world.isPaused(),
        tick: world.clock.tick,
        speed: world.getSpeed(),
      },
      database: dbOk,
      agents: world.agentManager.getAllAgents().length,
    })
  })

  return router
}
