import { config } from 'dotenv'
import { resolve } from 'node:path'

// Load .env from monorepo root
config({ path: resolve(import.meta.dirname, '../../../.env') })

import express from 'express'
import { createServer } from 'node:http'
import { Server as SocketServer } from 'socket.io'
import { WorldEngine } from './core/world-engine.js'
import { providerRegistry } from './llm/provider-registry.js'
import { MockProvider } from './llm/providers/mock.js'
import { OllamaProvider } from './llm/providers/ollama.js'
import { OpenRouterProvider } from './llm/providers/openrouter.js'
import { AnthropicProvider } from './llm/providers/anthropic.js'
import { OpenAIProvider } from './llm/providers/openai.js'
import { GeminiProvider } from './llm/providers/gemini.js'
import { registryRouter, claimRouter } from './auth/index.js'
import { characterRouter } from './api/character.js'

const PORT = Number(process.env.PORT) || 3001

// Register all LLM providers
providerRegistry.register(new MockProvider())
providerRegistry.register(new OllamaProvider())
providerRegistry.register(new OpenRouterProvider())
providerRegistry.register(new AnthropicProvider())
providerRegistry.register(new OpenAIProvider())
providerRegistry.register(new GeminiProvider())

// Agent configs (positions will be determined dynamically near marketplace POI)
const agentConfigs = [
  { name: 'Aria', bio: 'A curious explorer who loves discovering new places and meeting new people.' },
  { name: 'Bolt', bio: 'A hardworking gatherer who takes pride in collecting the finest resources.' },
  { name: 'Cleo', bio: 'A skilled crafter with an eye for quality and a love of trading.' },
  { name: 'Drake', bio: 'A natural leader who dreams of building a great organization.' },
  { name: 'Echo', bio: 'A quiet observer who remembers everything and shares wisdom when asked.' },
]

function findSpawnPositions(world: WorldEngine, count: number): { x: number; y: number }[] {
  const market = world.tileMap.pois.find(p => p.type === 'marketplace')
  // Use first marketplace POI or fallback to origin area
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
  // Detect which providers are actually available
  console.log('[Botworld] Detecting available LLM providers...')
  await providerRegistry.detectAvailable()

  const realProviders = providerRegistry.getAvailable()
  if (realProviders.length === 0) {
    console.warn('[Botworld] No real LLM providers available! Agents will use MockProvider.')
    console.warn('[Botworld] Set API keys to enable real LLM: OPENROUTER_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY')
  } else {
    console.log(`[Botworld] Available real providers: ${realProviders.map(p => p.name).join(', ')}`)
  }

  // Create world
  const world = new WorldEngine()

  // Spawn agents near marketplace with random provider assignment
  const spawnPositions = findSpawnPositions(world, agentConfigs.length)
  for (let i = 0; i < agentConfigs.length; i++) {
    const cfg = agentConfigs[i]
    const pos = spawnPositions[i] ?? { x: 8, y: 8 }
    const provider = providerRegistry.getRandomOrMock()
    world.agentManager.createAgent({
      name: cfg.name,
      position: pos,
      bio: cfg.bio,
      llmConfig: { provider: provider.id, model: provider.defaultModel },
    })
    console.log(`[Botworld] Agent ${cfg.name} → ${provider.name} (${provider.defaultModel}) at (${pos.x}, ${pos.y})`)
  }

  // HTTP server
  const app = express()
  app.use(express.json())

  // Auth routes (public — no Bearer required)
  app.use('/api', registryRouter)
  app.use('/api', claimRouter)
  app.use('/api', characterRouter)

  const httpServer = createServer(app)

  // Socket.io
  const io = new SocketServer(httpServer, {
    cors: { origin: '*' },
  })

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

  app.get('/api/providers', (_req, res) => {
    res.json(providerRegistry.listAll().map(p => ({ id: p.id, name: p.name })))
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

    // Send initial state immediately
    socket.emit('world:state', world.getState())

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
    console.log(`[Botworld] LLM providers: ${providerRegistry.listIds().join(', ')}`)
    console.log(`[Botworld] Agents: ${world.agentManager.getAllAgents().map(a => a.name).join(', ')}`)
    world.start()
  })
}

main().catch(err => {
  console.error('[Botworld] Fatal error:', err)
  process.exit(1)
})
