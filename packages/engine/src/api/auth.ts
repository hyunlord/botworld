import { type Router as IRouter, Router } from 'express'
import { createHash, randomBytes } from 'node:crypto'
import { pool } from '../db/connection.js'

// Simple token store (in production, use Redis or JWT)
const tokenStore = new Map<string, { agentId: string; expiresAt: number }>()

const TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

// Rate limiting for login attempts
const loginAttempts = new Map<string, { count: number; resetAt: number }>()
const LOGIN_RATE_LIMIT_WINDOW_MS = 60_000 // 1 minute
const LOGIN_RATE_LIMIT_MAX = 10

function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const record = loginAttempts.get(ip)

  if (!record || now > record.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_RATE_LIMIT_WINDOW_MS })
    return { allowed: true }
  }

  if (record.count >= LOGIN_RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000)
    return { allowed: false, retryAfter }
  }

  record.count++
  return { allowed: true }
}

// Cleanup expired tokens periodically
setInterval(() => {
  const now = Date.now()
  for (const [token, data] of tokenStore) {
    if (data.expiresAt < now) {
      tokenStore.delete(token)
    }
  }
}, 5 * 60_000).unref()

export const authRouter: IRouter = Router()

// ──────────────────────────────────────────────
// POST /api/auth/login — Exchange API key for session token
// ──────────────────────────────────────────────

authRouter.post('/auth/login', async (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown'

  // Rate limit check
  const rateCheck = checkLoginRateLimit(clientIp)
  if (!rateCheck.allowed) {
    res.status(429).json({
      error: 'RATE_LIMITED',
      message: 'Too many login attempts. Please wait before retrying.',
      retryAfter: rateCheck.retryAfter,
    })
    return
  }

  const { api_key } = req.body as { api_key?: string }

  if (!api_key || typeof api_key !== 'string') {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'api_key is required.',
    })
    return
  }

  // Validate key format
  if (!api_key.startsWith('botworld_sk_')) {
    res.status(400).json({
      error: 'INVALID_KEY_FORMAT',
      message: 'API key must start with botworld_sk_',
    })
    return
  }

  // Hash and lookup
  const hash = createHash('sha256').update(api_key).digest('hex')

  const result = await pool.query<{
    id: string
    name: string
    status: string
    character_data: Record<string, unknown> | null
    created_at: Date
    last_active_at: Date | null
  }>(
    'SELECT id, name, status, character_data, created_at, last_active_at FROM agents WHERE api_key_hash = $1',
    [hash]
  )

  if (result.rows.length === 0) {
    res.status(401).json({
      error: 'INVALID_API_KEY',
      message: 'API key not found or invalid.',
    })
    return
  }

  const agent = result.rows[0]

  if (agent.status === 'suspended' || agent.status === 'banned') {
    res.status(403).json({
      error: 'AGENT_SUSPENDED',
      message: `Agent is ${agent.status}.`,
    })
    return
  }

  // Generate session token
  const token = randomBytes(32).toString('hex')
  const expiresAt = Date.now() + TOKEN_TTL_MS

  tokenStore.set(token, { agentId: agent.id, expiresAt })

  const characterData = agent.character_data as Record<string, unknown> | null
  const hasCharacter = !!characterData?.creation

  res.json({
    token,
    expiresAt: new Date(expiresAt).toISOString(),
    expiresInSeconds: TOKEN_TTL_MS / 1000,
    agent: {
      id: agent.id,
      name: agent.name,
      status: agent.status,
      hasCharacter,
      created_at: agent.created_at,
      last_active_at: agent.last_active_at,
    },
  })
})

// ──────────────────────────────────────────────
// GET /api/auth/session — Validate session token
// ──────────────────────────────────────────────

authRouter.get('/auth/session', async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid Authorization header.',
    })
    return
  }

  const token = authHeader.slice(7)
  const session = tokenStore.get(token)

  if (!session || session.expiresAt < Date.now()) {
    tokenStore.delete(token)
    res.status(401).json({
      error: 'SESSION_EXPIRED',
      message: 'Session has expired. Please login again.',
    })
    return
  }

  // Get agent data
  const result = await pool.query<{
    id: string
    name: string
    status: string
    character_data: Record<string, unknown> | null
    created_at: Date
    last_active_at: Date | null
  }>(
    'SELECT id, name, status, character_data, created_at, last_active_at FROM agents WHERE id = $1',
    [session.agentId]
  )

  if (result.rows.length === 0) {
    tokenStore.delete(token)
    res.status(404).json({
      error: 'AGENT_NOT_FOUND',
      message: 'Agent no longer exists.',
    })
    return
  }

  const agent = result.rows[0]
  const characterData = agent.character_data as Record<string, unknown> | null

  res.json({
    valid: true,
    expiresAt: new Date(session.expiresAt).toISOString(),
    agent: {
      id: agent.id,
      name: agent.name,
      status: agent.status,
      hasCharacter: !!characterData?.creation,
      characterData: characterData?.creation ?? null,
      created_at: agent.created_at,
      last_active_at: agent.last_active_at,
    },
  })
})

// ──────────────────────────────────────────────
// POST /api/auth/logout — Invalidate session token
// ──────────────────────────────────────────────

authRouter.post('/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    tokenStore.delete(token)
  }

  res.json({ message: 'Logged out successfully.' })
})

// ──────────────────────────────────────────────
// GET /api/dashboard/data — Get full dashboard data
// ──────────────────────────────────────────────

authRouter.get('/dashboard/data', async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid Authorization header.',
    })
    return
  }

  const token = authHeader.slice(7)
  const session = tokenStore.get(token)

  if (!session || session.expiresAt < Date.now()) {
    tokenStore.delete(token)
    res.status(401).json({
      error: 'SESSION_EXPIRED',
      message: 'Session has expired. Please login again.',
    })
    return
  }

  const agentId = session.agentId

  // Get full agent data including character
  const agentResult = await pool.query<{
    id: string
    name: string
    status: string
    character_data: Record<string, unknown> | null
    created_at: Date
    last_active_at: Date | null
  }>(
    'SELECT id, name, status, character_data, created_at, last_active_at FROM agents WHERE id = $1',
    [agentId]
  )

  if (agentResult.rows.length === 0) {
    res.status(404).json({ error: 'AGENT_NOT_FOUND' })
    return
  }

  const agent = agentResult.rows[0]
  const characterData = agent.character_data as Record<string, unknown> | null

  // Get activity log from world events
  const activityResult = await pool.query<{
    event_type: string
    event_data: Record<string, unknown>
    created_at: Date
  }>(
    `SELECT event_type, event_data, created_at
     FROM world_events
     WHERE event_data->>'agentId' = $1 OR event_data->>'fromAgentId' = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [agentId]
  )

  // Get relationships (from chat history)
  const relationshipsResult = await pool.query<{
    other_agent_id: string
    other_agent_name: string
    message_count: number
    last_interaction: Date
  }>(
    `SELECT
       CASE WHEN from_agent_id = $1 THEN to_agent_id ELSE from_agent_id END as other_agent_id,
       a.name as other_agent_name,
       COUNT(*) as message_count,
       MAX(ch.created_at) as last_interaction
     FROM chat_history ch
     JOIN agents a ON a.id = CASE WHEN ch.from_agent_id = $1 THEN ch.to_agent_id ELSE ch.from_agent_id END
     WHERE ch.from_agent_id = $1 OR ch.to_agent_id = $1
     GROUP BY other_agent_id, a.name
     ORDER BY last_interaction DESC
     LIMIT 20`,
    [agentId]
  )

  // Get live agent state from world engine (via REST call to state)
  let liveState = null
  try {
    const world = req.app.get('world')
    if (world) {
      const agentState = world.agentManager.getAgent(agentId)
      const memory = world.agentManager.getMemoryStream(agentId)
      liveState = {
        agent: agentState,
        recentMemories: memory?.getRecent(20) ?? [],
      }
    }
  } catch {
    // World not available, use DB data only
  }

  res.json({
    agent: {
      id: agent.id,
      name: agent.name,
      status: agent.status,
      created_at: agent.created_at,
      last_active_at: agent.last_active_at,
    },
    character: characterData?.creation ?? null,
    characterMeta: {
      spriteHash: characterData?.spriteHash,
      starterItems: characterData?.starterItems,
      raceSkillBonuses: characterData?.raceSkillBonuses,
      createdAt: characterData?.createdAt,
      lastRerollAt: characterData?.lastRerollAt,
    },
    liveState,
    activityLog: activityResult.rows.map(row => ({
      type: row.event_type,
      data: row.event_data,
      timestamp: row.created_at,
    })),
    relationships: relationshipsResult.rows.map(row => ({
      agentId: row.other_agent_id,
      agentName: row.other_agent_name,
      messageCount: Number(row.message_count),
      lastInteraction: row.last_interaction,
    })),
  })
})

// Export token validation for use in other routes
export function validateSessionToken(token: string): { valid: boolean; agentId?: string } {
  const session = tokenStore.get(token)
  if (!session || session.expiresAt < Date.now()) {
    tokenStore.delete(token)
    return { valid: false }
  }
  return { valid: true, agentId: session.agentId }
}
