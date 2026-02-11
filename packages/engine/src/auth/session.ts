import { type Router as IRouter, Router } from 'express'
import { randomBytes } from 'node:crypto'
import { pool } from '../db/connection.js'

// ──────────────────────────────────────────────
// Owner Session Management
// ──────────────────────────────────────────────

// In-memory session store (in production, use Redis)
const ownerSessions = new Map<string, {
  ownerId: string
  email: string
  expiresAt: number
}>()

// Magic link tokens (short-lived for login)
const magicLinkTokens = new Map<string, {
  email: string
  expiresAt: number
}>()

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const MAGIC_LINK_TTL_MS = 15 * 60 * 1000 // 15 minutes

// Cleanup expired sessions periodically
setInterval(() => {
  const now = Date.now()
  for (const [token, data] of ownerSessions) {
    if (data.expiresAt < now) ownerSessions.delete(token)
  }
  for (const [token, data] of magicLinkTokens) {
    if (data.expiresAt < now) magicLinkTokens.delete(token)
  }
}, 5 * 60_000).unref()

// ──────────────────────────────────────────────
// Session Functions
// ──────────────────────────────────────────────

export function createOwnerSession(ownerId: string, email: string): {
  token: string
  expiresAt: number
} {
  const token = randomBytes(32).toString('hex')
  const expiresAt = Date.now() + SESSION_TTL_MS

  ownerSessions.set(token, { ownerId, email, expiresAt })

  return { token, expiresAt }
}

export function validateOwnerSession(token: string): {
  valid: boolean
  ownerId?: string
  email?: string
} {
  const session = ownerSessions.get(token)
  if (!session || session.expiresAt < Date.now()) {
    ownerSessions.delete(token)
    return { valid: false }
  }
  return { valid: true, ownerId: session.ownerId, email: session.email }
}

export function invalidateOwnerSession(token: string): void {
  ownerSessions.delete(token)
}

export function createMagicLinkToken(email: string): string {
  const token = randomBytes(32).toString('hex')
  magicLinkTokens.set(token, {
    email,
    expiresAt: Date.now() + MAGIC_LINK_TTL_MS,
  })
  return token
}

export function validateMagicLinkToken(token: string): {
  valid: boolean
  email?: string
} {
  const data = magicLinkTokens.get(token)
  if (!data || data.expiresAt < Date.now()) {
    magicLinkTokens.delete(token)
    return { valid: false }
  }
  // Magic link is single-use
  magicLinkTokens.delete(token)
  return { valid: true, email: data.email }
}

// ──────────────────────────────────────────────
// Router
// ──────────────────────────────────────────────

export const sessionRouter: IRouter = Router()

// ── POST /api/owner/magic-link — Request magic link login
sessionRouter.post('/owner/magic-link', async (req, res) => {
  const { email } = req.body as { email?: string }

  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'email is required.' })
    return
  }

  const normalizedEmail = email.trim().toLowerCase()

  // Check if owner exists
  const result = await pool.query<{ id: string }>(
    'SELECT id FROM owners WHERE email = $1',
    [normalizedEmail]
  )

  if (result.rows.length === 0) {
    // Don't reveal if email exists or not for security
    res.json({
      message: 'If an account exists with this email, a login link has been sent.',
    })
    return
  }

  // Create magic link token
  const token = createMagicLinkToken(normalizedEmail)
  const baseUrl = `${req.protocol}://${req.get('host')}`
  const magicLink = `${baseUrl}/api/owner/verify-magic-link/${token}`

  // In production, send email here
  // For now, just log it (or return in dev mode)
  console.log(`[MagicLink] Login link for ${normalizedEmail}: ${magicLink}`)

  // In development, return the link directly
  if (process.env.NODE_ENV !== 'production') {
    res.json({
      message: 'Magic link created.',
      dev_only_link: magicLink,
      note: 'In production, this link would be sent via email.',
    })
    return
  }

  res.json({
    message: 'If an account exists with this email, a login link has been sent.',
  })
})

// ── GET /api/owner/verify-magic-link/:token — Verify magic link and create session
sessionRouter.get('/owner/verify-magic-link/:token', async (req, res) => {
  const { token } = req.params

  const validation = validateMagicLinkToken(token)
  if (!validation.valid || !validation.email) {
    res.status(400).json({
      error: 'INVALID_OR_EXPIRED_LINK',
      message: 'This login link is invalid or has expired. Please request a new one.',
    })
    return
  }

  // Find owner
  const result = await pool.query<{ id: string; email: string }>(
    'SELECT id, email FROM owners WHERE email = $1',
    [validation.email]
  )

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Owner not found.' })
    return
  }

  const owner = result.rows[0]

  // Create session
  const session = createOwnerSession(owner.id, owner.email)

  // Redirect to dashboard with session token
  res.redirect(`/dashboard?session=${session.token}`)
})

// ── GET /api/owner/session — Validate session and get owner info
sessionRouter.get('/owner/session', async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'UNAUTHORIZED' })
    return
  }

  const token = authHeader.slice(7)
  const validation = validateOwnerSession(token)

  if (!validation.valid) {
    res.status(401).json({
      error: 'SESSION_EXPIRED',
      message: 'Session has expired. Please login again.',
    })
    return
  }

  // Get owner's agents
  const agentsResult = await pool.query<{
    id: string
    name: string
    status: string
    character_data: Record<string, unknown> | null
    created_at: Date
    last_active_at: Date | null
  }>(
    `SELECT id, name, status, character_data, created_at, last_active_at
     FROM agents
     WHERE owner_id = $1
     ORDER BY created_at DESC`,
    [validation.ownerId]
  )

  res.json({
    owner: {
      id: validation.ownerId,
      email: validation.email,
    },
    agents: agentsResult.rows.map(agent => ({
      id: agent.id,
      name: agent.name,
      status: agent.status,
      hasCharacter: !!(agent.character_data as Record<string, unknown>)?.creation,
      created_at: agent.created_at,
      last_active_at: agent.last_active_at,
    })),
  })
})

// ── POST /api/owner/logout — Invalidate session
sessionRouter.post('/owner/logout', (req, res) => {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    invalidateOwnerSession(authHeader.slice(7))
  }
  res.json({ message: 'Logged out successfully.' })
})
