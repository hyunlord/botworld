import { Router, type Request, type Response, type NextFunction } from 'express'
import { timingSafeEqual } from 'node:crypto'
import { pool } from '../db/connection.js'
import { invalidateAgentCache } from '../auth/middleware.js'
import type { WorldEngine } from '../core/world-engine.js'
import type { MetricsCollector } from '../monitoring/metrics.js'

// ──────────────────────────────────────────────
// Admin auth middleware
// ──────────────────────────────────────────────

function requireAdmin() {
  return (req: Request, res: Response, next: NextFunction) => {
    const secret = process.env.ADMIN_SECRET
    if (!secret) {
      res.status(503).json({ error: 'Admin API not configured' })
      return
    }
    const provided = req.headers['x-admin-key'] as string | undefined
    if (!provided) {
      res.status(401).json({ error: 'X-Admin-Key header required' })
      return
    }
    // Constant-time comparison to prevent timing attacks
    const a = Buffer.from(secret)
    const b = Buffer.from(provided)
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      res.status(403).json({ error: 'Invalid admin key' })
      return
    }
    next()
  }
}

// ──────────────────────────────────────────────
// Admin router
// ──────────────────────────────────────────────

export function createAdminRouter(world: WorldEngine, metrics: MetricsCollector): Router {
  const router = Router()
  router.use(requireAdmin())

  // GET /admin/agents — all agents with DB status
  router.get('/admin/agents', async (_req: Request, res: Response) => {
    const result = await pool.query(
      'SELECT id, name, status, violation_count, created_at, last_active_at FROM agents ORDER BY created_at DESC',
    )
    res.json(result.rows)
  })

  // GET /admin/security/violations — agents with violations
  router.get('/admin/security/violations', async (_req: Request, res: Response) => {
    const result = await pool.query(
      'SELECT id, name, status, violation_count FROM agents WHERE violation_count > 0 ORDER BY violation_count DESC',
    )
    res.json(result.rows)
  })

  // POST /admin/agents/:id/suspend
  router.post('/admin/agents/:id/suspend', async (req: Request, res: Response) => {
    const { id } = req.params
    await pool.query("UPDATE agents SET status = 'suspended' WHERE id = $1", [id])
    invalidateAgentCache()
    res.json({ success: true, status: 'suspended' })
  })

  // POST /admin/agents/:id/ban
  router.post('/admin/agents/:id/ban', async (req: Request, res: Response) => {
    const { id } = req.params
    await pool.query("UPDATE agents SET status = 'banned' WHERE id = $1", [id])
    invalidateAgentCache()
    res.json({ success: true, status: 'banned' })
  })

  // POST /admin/agents/:id/unsuspend
  router.post('/admin/agents/:id/unsuspend', async (req: Request, res: Response) => {
    const { id } = req.params
    await pool.query("UPDATE agents SET status = 'active' WHERE id = $1", [id])
    invalidateAgentCache()
    res.json({ success: true, status: 'active' })
  })

  // GET /admin/stats — server statistics
  router.get('/admin/stats', (_req: Request, res: Response) => {
    const agents = world.agentManager.getAllAgents()
    const mem = process.memoryUsage()
    res.json({
      tick: world.clock.tick,
      day: world.clock.day,
      timeOfDay: world.clock.timeOfDay,
      running: world.isRunning(),
      paused: world.isPaused(),
      speed: world.getSpeed(),
      agents: {
        total: agents.length,
        idle: agents.filter(a => !a.currentAction).length,
        active: agents.filter(a => a.currentAction).length,
      },
      uptime: process.uptime(),
      memory: {
        rss: Math.round(mem.rss / 1024 / 1024),
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      },
      metrics: metrics.getSnapshot(),
    })
  })

  // GET /admin/audit-log — recent audit log entries
  router.get('/admin/audit-log', async (req: Request, res: Response) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200)
    const result = await pool.query(
      'SELECT * FROM api_key_audit_log ORDER BY created_at DESC LIMIT $1',
      [limit],
    )
    res.json(result.rows)
  })

  return router
}
