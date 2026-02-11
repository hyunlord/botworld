import { config } from 'dotenv'
import { resolve } from 'node:path'

// Load .env from monorepo root
config({ path: resolve(import.meta.dirname, '../../../.env') })

import express from 'express'
import { createServer } from 'node:http'
import { Server as SocketServer } from 'socket.io'
import { WorldEngine } from './core/world-engine.js'
import { registryRouter, claimRouter, sessionRouter } from './auth/index.js'
import { characterRouter } from './api/character.js'
import { createActionRouter } from './api/actions.js'
import { createWorldRouter } from './api/world.js'
import { ChatRelay } from './systems/chat-relay.js'
import { Marketplace } from './systems/marketplace.js'
import { createMarketRouter } from './api/market.js'
import { createAdminRouter } from './api/admin.js'
import { createPromptsRouter } from './api/prompts.js'
import { authRouter } from './api/auth.js'
import { createNotificationRouter } from './api/notifications.js'
import { createQuestRouter } from './api/quests.js'
import { createWorldEventsRouter } from './api/world-events.js'
import { NotificationManager } from './systems/notifications.js'
import { MetricsCollector } from './monitoring/metrics.js'
import { createHealthRouter } from './monitoring/health-check.js'
import { WsManager } from './network/ws-manager.js'
import { pool } from './db/connection.js'

const PORT = Number(process.env.PORT) || 3001

function findSpawnPositions(world: WorldEngine, count: number): { x: number; y: number }[] {
  const market = world.tileMap.pois.find(p => p.type === 'marketplace')
  const center = market?.position ?? { x: 8, y: 8 }
  const positions: { x: number; y: number }[] = []

  for (let r = 0; r <= 15 && positions.length < count; r++) {
    for (let dy = -r; dy <= r && positions.length < count; dy++) {
      for (let dx = -r; dx <= r && positions.length < count; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue
        const x = center.x + dx
        const y = center.y + dy
        if (world.tileMap.isWalkable(x, y)) {
          positions.push({ x, y })
        }
      }
    }
  }

  return positions
}

async function main() {
  // Create world
  const world = new WorldEngine()

  // Load active agents from DB
  console.log('[Botworld] Loading agents from database...')
  try {
    const agentRows = await pool.query<{
      id: string
      name: string
      status: string
      character_data: Record<string, unknown> | null
    }>(
      "SELECT id, name, status, character_data FROM agents WHERE status = 'active'"
    )

    const spawnPositions = findSpawnPositions(world, agentRows.rows.length)
    for (let i = 0; i < agentRows.rows.length; i++) {
      const row = agentRows.rows[i]
      const cd = row.character_data
      const creation = cd?.creation as Record<string, unknown> | undefined
      const pos = spawnPositions[i] ?? { x: 8, y: 8 }

      world.agentManager.loadAgent({
        id: row.id,
        name: row.name,
        position: pos,
        bio: (creation?.backstory as string) ?? '',
        personality: (creation?.personality as Record<string, unknown>)?.traits as any,
      })
      console.log(`[Botworld] Loaded agent ${row.name} at (${pos.x}, ${pos.y})`)
    }

    if (agentRows.rows.length === 0) {
      console.log('[Botworld] No active agents found. Register bots via POST /api/agents/register')
    } else {
      console.log(`[Botworld] Loaded ${agentRows.rows.length} agents`)
    }
  } catch (err) {
    console.warn('[Botworld] Could not load agents from DB (may not be initialized yet):', (err as Error).message)
  }

  // HTTP server
  const app = express()
  app.use(express.json())

  // Serve static files (skill.md, heartbeat.md)
  app.use(express.static(resolve(import.meta.dirname, '../public')))

  // Expose world engine to route handlers
  app.set('world', world)

  const httpServer = createServer(app)

  // Socket.io
  const io = new SocketServer(httpServer, {
    cors: { origin: '*' },
  })

  // Expose io to route handlers (for character appearance broadcasts)
  app.set('io', io)

  // ChatRelay (EventBus only, no io dependency)
  const chatRelay = new ChatRelay(
    world.agentManager, world.eventBus, pool, () => world.clock,
  )

  // Marketplace (in-memory, POI-gated)
  const marketplace = new Marketplace(world.agentManager, world.tileMap)

  // Metrics collector (subscribes to world:tick events)
  const metrics = new MetricsCollector(world)

  // NotificationManager (subscribes to events and manages notifications)
  const notifications = new NotificationManager(pool, world.eventBus, world.agentManager)

  // WsManager: handles all Socket.IO namespaces (/spectator + /bot + /dashboard)
  const _wsManager = new WsManager(io, world, chatRelay, pool, notifications)

  // Auth routes (public — no Bearer required)
  app.use('/api', registryRouter)
  app.use('/api', claimRouter)
  app.use('/api', sessionRouter)
  app.use('/api', authRouter)
  app.use('/api', characterRouter)
  app.use('/api', createActionRouter(world, chatRelay))
  app.use('/api', createWorldRouter(world))
  app.use('/api', createMarketRouter(marketplace))
  app.use('/api', createPromptsRouter())
  app.use('/api', createNotificationRouter(notifications))
  app.use('/api', createQuestRouter(world))
  app.use('/api', createWorldEventsRouter(world))

  // Admin routes (X-Admin-Key auth)
  app.use('/api', createAdminRouter(world, metrics))

  // Health check (public, no auth)
  app.use(createHealthRouter(world, metrics))

  // REST endpoints
  app.get('/api/state', (_req, res) => {
    res.json(world.getState())
  })

  app.get('/api/agents', (_req, res) => {
    res.json(world.agentManager.getAllAgents())
  })

  app.get('/api/agents/:id', (req, res) => {
    const agent = world.agentManager.getAgent(req.params.id)
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' })
      return
    }
    const memory = world.agentManager.getMemoryStream(req.params.id)
    res.json({
      ...agent,
      recentMemories: memory?.getRecent(20) ?? [],
    })
  })

  app.get('/api/world/clock', (_req, res) => {
    res.json(world.clock)
  })

  // Start
  httpServer.listen(PORT, () => {
    console.log(`[Botworld] Server running on http://localhost:${PORT}`)
    console.log(`[Botworld] Agents: ${world.agentManager.getAllAgents().map(a => a.name).join(', ') || '(none)'}`)
    world.start()
  })
}

main().catch(err => {
  console.error('[Botworld] Fatal error:', err)
  process.exit(1)
})
