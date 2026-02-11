import { config } from 'dotenv'
import { resolve } from 'node:path'

// Load .env from monorepo root
config({ path: resolve(import.meta.dirname, '../../../.env') })

import express from 'express'
import { createServer } from 'node:http'
import { Server as SocketServer } from 'socket.io'
import { WorldEngine } from './core/world-engine.js'
import { registryRouter, claimRouter } from './auth/index.js'
import { characterRouter } from './api/character.js'
import { createActionRouter } from './api/actions.js'
import { ChatRelay } from './systems/chat-relay.js'
import { pool } from './db/connection.js'
import type { CharacterAppearanceMap } from '@botworld/shared'

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

      world.agentManager.createAgent({
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

  // Expose world engine to route handlers
  app.set('world', world)

  const httpServer = createServer(app)

  // Socket.io
  const io = new SocketServer(httpServer, {
    cors: { origin: '*' },
  })

  // Expose io to route handlers (for character appearance broadcasts)
  app.set('io', io)

  // ChatRelay (must be created after io)
  const chatRelay = new ChatRelay(
    world.agentManager, world.eventBus, io, pool, () => world.clock,
  )

  // Auth routes (public — no Bearer required)
  app.use('/api', registryRouter)
  app.use('/api', claimRouter)
  app.use('/api', characterRouter)
  app.use('/api', createActionRouter(world, chatRelay))

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

  // WebSocket: stream world updates to clients
  world.eventBus.onAny((event) => {
    io.emit('world:event', event)

    // Broadcast full agent state every tick so clients stay in sync
    if (event.type === 'world:tick') {
      io.emit('world:agents', world.agentManager.getAllAgents())
    }

    // Send new chunk data when chunks are generated
    if (event.type === 'world:chunks_generated') {
      const chunkData = world.tileMap.getSerializableChunks(event.chunkKeys)
      io.emit('world:chunks', chunkData)
    }
  })

  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`)

    // Default: join spectator room (browser clients)
    socket.join('spectator')

    // Bot WebSocket authentication (API key → agent room)
    socket.on('auth:agent', async (data: { apiKey: string }) => {
      try {
        const result = await pool.query<{ id: string; status: string }>(
          'SELECT id, status FROM agents WHERE api_key_hash = crypt($1, api_key_hash)',
          [data.apiKey],
        )
        if (result.rows.length === 0) {
          socket.emit('auth:error', { error: 'Invalid API key' })
          return
        }
        const agent = result.rows[0]
        if (agent.status !== 'active') {
          socket.emit('auth:error', { error: `Agent status: ${agent.status}` })
          return
        }
        socket.leave('spectator')
        socket.join(`agent:${agent.id}`)
        socket.data.agentId = agent.id
        socket.emit('auth:success', { agentId: agent.id })
        console.log(`[Socket] Bot authenticated: ${agent.id} (socket ${socket.id})`)
      } catch {
        socket.emit('auth:error', { error: 'Authentication failed' })
      }
    })

    // Send initial state immediately
    socket.emit('world:state', world.getState())

    // Send character appearance data (once on connect)
    pool.query<{ id: string; character_data: Record<string, unknown> | null }>(
      "SELECT id, character_data FROM agents WHERE character_data IS NOT NULL"
    ).then(result => {
      const characterMap: CharacterAppearanceMap = {}
      for (const row of result.rows) {
        const cd = row.character_data as Record<string, unknown> | null
        const creation = cd?.creation as Record<string, unknown> | undefined
        if (creation?.appearance) {
          characterMap[row.id] = {
            appearance: creation.appearance as any,
            race: creation.race as any,
            spriteHash: (cd?.spriteHash as string) ?? '',
          }
        }
      }
      socket.emit('world:characters', characterMap)
    }).catch(() => {})

    // Client can request state at any time (e.g. after scene is ready)
    socket.on('request:state', () => {
      socket.emit('world:state', world.getState())
    })

    // Client can request specific chunks
    socket.on('request:chunks', (keys: string[]) => {
      const chunkData = world.tileMap.getSerializableChunks(keys)
      socket.emit('world:chunks', chunkData)
    })

    // Speed controls
    socket.on('world:pause', () => {
      world.setPaused(true)
      io.emit('world:speed', { paused: true, speed: world.getSpeed() })
    })

    socket.on('world:resume', () => {
      world.setPaused(false)
      io.emit('world:speed', { paused: false, speed: world.getSpeed() })
    })

    socket.on('world:setSpeed', (speed: number) => {
      world.setSpeed(speed)
      io.emit('world:speed', { paused: world.isPaused(), speed: world.getSpeed() })
    })

    // Send current speed state
    socket.emit('world:speed', { paused: world.isPaused(), speed: world.getSpeed() })

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`)
    })
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
