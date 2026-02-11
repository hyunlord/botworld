import { type Router as IRouter, Router } from 'express'
import { nanoid } from 'nanoid'
import { createHash } from 'node:crypto'
import { pool } from '../db/connection.js'
import { generateApiKey } from './key-generator.js'
import { logAuditEvent, invalidateAgentCache } from './middleware.js'
import type { RegisterAgentBody, RegisterAgentResponse } from './types.js'

const NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9 \-]{1,48}[a-zA-Z0-9]$/

// Rate limiting: track registration attempts per IP
const registrationAttempts = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60_000 // 1 minute
const RATE_LIMIT_MAX_ATTEMPTS = 5

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const record = registrationAttempts.get(ip)

  if (!record || now > record.resetAt) {
    registrationAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return { allowed: true }
  }

  if (record.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000)
    return { allowed: false, retryAfter }
  }

  record.count++
  return { allowed: true }
}

function generateNameSuggestion(baseName: string): string {
  const suffix = Math.floor(Math.random() * 900) + 100 // 100-999
  return `${baseName}_${suffix}`
}

export const registryRouter: IRouter = Router()

// ──────────────────────────────────────────────
// POST /api/agents/register
// ──────────────────────────────────────────────

registryRouter.post('/agents/register', async (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown'

  // Rate limit check
  const rateCheck = checkRateLimit(clientIp)
  if (!rateCheck.allowed) {
    res.status(429).json({
      error: 'RATE_LIMITED',
      message: 'Too many registration attempts. Please wait before retrying.',
      retryAfter: rateCheck.retryAfter,
    })
    return
  }

  const body = req.body as RegisterAgentBody

  // Validate name
  if (!body.name || typeof body.name !== 'string') {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'name is required and must be a string.',
      fields: { name: 'required' },
    })
    return
  }

  const name = body.name.trim()

  if (name.length < 3 || name.length > 50) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'name must be between 3 and 50 characters.',
      fields: { name: 'must be 3-50 characters' },
    })
    return
  }

  if (!NAME_REGEX.test(name)) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'name must be alphanumeric with spaces or hyphens, and must start/end with alphanumeric.',
      fields: { name: 'invalid format' },
    })
    return
  }

  // Check uniqueness (case-insensitive)
  const existing = await pool.query(
    'SELECT id FROM agents WHERE LOWER(name) = LOWER($1)',
    [name]
  )
  if (existing.rows.length > 0) {
    res.status(409).json({
      error: 'NAME_TAKEN',
      message: `Agent name "${name}" is already taken.`,
      suggestion: generateNameSuggestion(name),
    })
    return
  }

  // Generate API key and claim code
  const { plaintext, hash } = await generateApiKey()
  const claimCode = nanoid(32)

  // Insert agent
  const result = await pool.query<{ id: string }>(
    `INSERT INTO agents (api_key_hash, name, status, claim_code, character_data)
     VALUES ($1, $2, 'pending_claim', $3, $4)
     RETURNING id`,
    [
      hash,
      name,
      claimCode,
      body.description ? JSON.stringify({ description: body.description }) : null,
    ]
  )

  const agentId = result.rows[0].id
  invalidateAgentCache()

  // Audit log
  await logAuditEvent(agentId, 'created', req.ip, {
    name,
    has_description: !!body.description,
  })

  // Build claim URL
  const baseUrl = `${req.protocol}://${req.get('host')}`
  const claimUrl = `${baseUrl}/api/agents/claim/${claimCode}`

  const response: RegisterAgentResponse = {
    agent: {
      id: agentId,
      name,
      api_key: plaintext,
      claim_url: claimUrl,
    },
    important: 'Save your API key now. It will NOT be shown again. Use the claim URL to link this agent to your account.',
  }

  res.status(201).json(response)
})

// ──────────────────────────────────────────────
// GET /api/agents/:id/status
// ──────────────────────────────────────────────

registryRouter.get('/agents/:id/status', async (req, res) => {
  const { id } = req.params

  const result = await pool.query(
    'SELECT id, name, status, created_at, last_active_at FROM agents WHERE id = $1',
    [id]
  )

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Agent not found.' })
    return
  }

  const agent = result.rows[0]
  res.json({
    id: agent.id,
    name: agent.name,
    status: agent.status,
    created_at: agent.created_at,
    last_active_at: agent.last_active_at,
  })
})

// ──────────────────────────────────────────────
// POST /api/agents/recover — Recover lost API key
// ──────────────────────────────────────────────

registryRouter.post('/agents/recover', async (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown'

  // Rate limit check (same as registration)
  const rateCheck = checkRateLimit(clientIp)
  if (!rateCheck.allowed) {
    res.status(429).json({
      error: 'RATE_LIMITED',
      message: 'Too many recovery attempts. Please wait before retrying.',
      retryAfter: rateCheck.retryAfter,
    })
    return
  }

  const { name, description } = req.body as { name?: string; description?: string }

  // Validate inputs
  if (!name || typeof name !== 'string') {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'name is required for recovery.',
      fields: { name: 'required' },
    })
    return
  }

  if (!description || typeof description !== 'string') {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'description is required for recovery (must match original registration).',
      fields: { description: 'required' },
    })
    return
  }

  // Find agent by name (case-insensitive)
  const result = await pool.query<{
    id: string
    name: string
    status: string
    character_data: Record<string, unknown> | null
  }>(
    'SELECT id, name, status, character_data FROM agents WHERE LOWER(name) = LOWER($1)',
    [name.trim()]
  )

  if (result.rows.length === 0) {
    res.status(404).json({
      error: 'AGENT_NOT_FOUND',
      message: `No agent found with name "${name}".`,
    })
    return
  }

  const agent = result.rows[0]

  // Verify description matches (simple hash comparison for security)
  const storedDescription = (agent.character_data as Record<string, unknown>)?.description as string | undefined
  if (!storedDescription) {
    res.status(400).json({
      error: 'RECOVERY_NOT_AVAILABLE',
      message: 'This agent was registered without a description and cannot be recovered.',
    })
    return
  }

  // Normalize and compare descriptions
  const normalizedStored = storedDescription.toLowerCase().trim()
  const normalizedInput = description.toLowerCase().trim()

  if (normalizedStored !== normalizedInput) {
    res.status(403).json({
      error: 'RECOVERY_FAILED',
      message: 'Description does not match. Recovery requires the exact description used during registration.',
    })
    return
  }

  // Generate new API key and invalidate old one
  const { plaintext, hash } = await generateApiKey()

  await pool.query(
    'UPDATE agents SET api_key_hash = $1 WHERE id = $2',
    [hash, agent.id]
  )

  invalidateAgentCache()

  // Audit log (use 'rotated' since recovery is essentially a key rotation)
  await logAuditEvent(agent.id, 'rotated', clientIp, {
    name: agent.name,
    reason: 'key_recovery',
  })

  res.json({
    message: 'API key recovered successfully. Your old key is now invalid.',
    agent: {
      id: agent.id,
      name: agent.name,
      api_key: plaintext,
      status: agent.status,
    },
    important: 'Save your new API key now. It will NOT be shown again.',
  })
})

// ──────────────────────────────────────────────
// GET /api/me — Get current agent info (requires auth)
// ──────────────────────────────────────────────

registryRouter.get('/me', async (req, res) => {
  // Extract API key from Authorization header
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid Authorization header. Use: Bearer <api_key>',
    })
    return
  }

  const apiKey = authHeader.slice(7)
  const hash = createHash('sha256').update(apiKey).digest('hex')

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
  const hasCharacter = !!(agent.character_data as Record<string, unknown>)?.creation

  res.json({
    agent: {
      id: agent.id,
      name: agent.name,
      status: agent.status,
      hasCharacter,
      created_at: agent.created_at,
      last_active_at: agent.last_active_at,
    },
    nextStep: hasCharacter
      ? 'Character exists. Read heartbeat.md and start playing.'
      : 'No character yet. Create one with POST /api/characters/create.',
  })
})
