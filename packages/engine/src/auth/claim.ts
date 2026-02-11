import { type Router as IRouter, Router } from 'express'
import { pool } from '../db/connection.js'
import { logAuditEvent, invalidateAgentCache } from './middleware.js'
import { createOwnerSession } from './session.js'
import type { ClaimAgentBody } from './types.js'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const claimRouter: IRouter = Router()

// ──────────────────────────────────────────────
// GET /api/agents/claim/:code — View claim info
// ──────────────────────────────────────────────

claimRouter.get('/agents/claim/:code', async (req, res) => {
  const { code } = req.params

  const result = await pool.query<{
    id: string
    name: string
    status: string
    created_at: Date
    character_data: Record<string, unknown> | null
  }>(
    'SELECT id, name, status, created_at, character_data FROM agents WHERE claim_code = $1',
    [code]
  )

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Invalid or expired claim code.' })
    return
  }

  const agent = result.rows[0]

  if (agent.status !== 'pending_claim') {
    res.status(410).json({
      error: 'ALREADY_CLAIMED',
      message: 'This agent has already been claimed.',
      agent: { id: agent.id, name: agent.name, status: agent.status },
    })
    return
  }

  // Extract character info if created
  const characterData = agent.character_data as Record<string, unknown> | null
  const creation = characterData?.creation as Record<string, unknown> | undefined

  res.json({
    agent: {
      id: agent.id,
      name: agent.name,
      status: agent.status,
      created_at: agent.created_at,
    },
    character: creation ? {
      name: creation.name,
      race: creation.race,
      characterClass: creation.characterClass,
      appearance: creation.appearance,
    } : null,
    message: 'POST to this URL with { "email": "you@example.com" } to claim this agent.',
  })
})

// ──────────────────────────────────────────────
// POST /api/agents/claim/:code — Claim agent
// ──────────────────────────────────────────────

claimRouter.post('/agents/claim/:code', async (req, res) => {
  const { code } = req.params
  const body = req.body as ClaimAgentBody

  // Validate email
  if (!body.email || typeof body.email !== 'string') {
    res.status(400).json({ error: 'email is required.' })
    return
  }

  const email = body.email.trim().toLowerCase()

  if (!EMAIL_REGEX.test(email)) {
    res.status(400).json({ error: 'Invalid email format.' })
    return
  }

  // Find agent by claim code
  const agentResult = await pool.query(
    'SELECT id, name, status FROM agents WHERE claim_code = $1',
    [code]
  )

  if (agentResult.rows.length === 0) {
    res.status(404).json({ error: 'Invalid or expired claim code.' })
    return
  }

  const agent = agentResult.rows[0]

  if (agent.status !== 'pending_claim') {
    res.status(410).json({ error: 'This agent has already been claimed.' })
    return
  }

  // Transaction: upsert owner + activate agent
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const ownerResult = await client.query<{ id: string }>(
      `INSERT INTO owners (email)
       VALUES ($1)
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING id`,
      [email]
    )
    const ownerId = ownerResult.rows[0].id

    await client.query(
      `UPDATE agents
       SET owner_id = $1, status = 'active', claim_code = NULL
       WHERE id = $2`,
      [ownerId, agent.id]
    )

    await client.query('COMMIT')

    invalidateAgentCache()

    logAuditEvent(agent.id, 'created', req.ip, {
      event: 'claimed',
      owner_email: email,
      owner_id: ownerId,
    }).catch(() => {})

    // Create owner session for dashboard access
    const session = createOwnerSession(ownerId, email)

    res.json({
      message: 'Agent claimed successfully.',
      agent: {
        id: agent.id,
        name: agent.name,
        status: 'active',
        owner_id: ownerId,
      },
      session: {
        token: session.token,
        expiresAt: new Date(session.expiresAt).toISOString(),
      },
      redirectUrl: `/dashboard?session=${session.token}`,
    })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[Claim] Transaction failed:', err)
    res.status(500).json({ error: 'Failed to claim agent. Please try again.' })
  } finally {
    client.release()
  }
})
