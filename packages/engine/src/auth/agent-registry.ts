import { type Router as IRouter, Router } from 'express'
import { nanoid } from 'nanoid'
import { pool } from '../db/connection.js'
import { generateApiKey } from './key-generator.js'
import { logAuditEvent, invalidateAgentCache } from './middleware.js'
import type { RegisterAgentBody, RegisterAgentResponse } from './types.js'

const NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9 \-]{1,48}[a-zA-Z0-9]$/

export const registryRouter: IRouter = Router()

// ──────────────────────────────────────────────
// POST /api/agents/register
// ──────────────────────────────────────────────

registryRouter.post('/agents/register', async (req, res) => {
  const body = req.body as RegisterAgentBody

  // Validate name
  if (!body.name || typeof body.name !== 'string') {
    res.status(400).json({ error: 'name is required and must be a string.' })
    return
  }

  const name = body.name.trim()

  if (name.length < 3 || name.length > 50) {
    res.status(400).json({ error: 'name must be between 3 and 50 characters.' })
    return
  }

  if (!NAME_REGEX.test(name)) {
    res.status(400).json({
      error: 'name must be alphanumeric with spaces or hyphens, and must start/end with alphanumeric.',
    })
    return
  }

  // Check uniqueness (case-insensitive)
  const existing = await pool.query(
    'SELECT id FROM agents WHERE LOWER(name) = LOWER($1)',
    [name]
  )
  if (existing.rows.length > 0) {
    res.status(409).json({ error: `Agent name "${name}" is already taken.` })
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
