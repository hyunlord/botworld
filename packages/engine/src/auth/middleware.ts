import type { RequestHandler, Request, Response, NextFunction } from 'express'
import { pool } from '../db/connection.js'
import { verifyApiKey, isBotworldKey } from './key-generator.js'
import type { AuthenticatedAgent, RateLimitEntry } from './types.js'

// ──────────────────────────────────────────────
// Agent cache (avoid DB hit on every request)
// ──────────────────────────────────────────────

interface CachedAgent extends AuthenticatedAgent {
  api_key_hash: string
}

let agentCache: CachedAgent[] = []
let cacheLastRefreshed = 0
const CACHE_TTL_MS = 60_000

async function refreshAgentCache(): Promise<void> {
  const now = Date.now()
  if (now - cacheLastRefreshed < CACHE_TTL_MS && agentCache.length > 0) return

  const result = await pool.query(
    `SELECT id, name, status, owner_id, api_key_hash, created_at, last_active_at
     FROM agents
     WHERE status IN ('pending_claim', 'active')`
  )
  agentCache = result.rows
  cacheLastRefreshed = now
}

/** Force cache invalidation (call after registration or status change). */
export function invalidateAgentCache(): void {
  cacheLastRefreshed = 0
}

// ──────────────────────────────────────────────
// Rate limiter (in-memory sliding window)
// ──────────────────────────────────────────────

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 60

const rateLimitMap = new Map<string, RateLimitEntry>()

function checkRateLimit(agentId: string): boolean {
  const now = Date.now()
  let entry = rateLimitMap.get(agentId)

  if (!entry) {
    entry = { timestamps: [] }
    rateLimitMap.set(agentId, entry)
  }

  entry.timestamps = entry.timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS)

  if (entry.timestamps.length >= RATE_LIMIT_MAX) {
    return false
  }

  entry.timestamps.push(now)
  return true
}

// Periodic cleanup of stale entries
setInterval(() => {
  const now = Date.now()
  for (const [agentId, entry] of rateLimitMap) {
    entry.timestamps = entry.timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS)
    if (entry.timestamps.length === 0) {
      rateLimitMap.delete(agentId)
    }
  }
}, 5 * 60_000).unref()

// ──────────────────────────────────────────────
// Audit logging
// ──────────────────────────────────────────────

export async function logAuditEvent(
  agentId: string,
  eventType: 'created' | 'rotated' | 'revoked' | 'used' | 'failed_auth' | 'key_leak_attempt',
  ipAddress: string | undefined,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO api_key_audit_log (agent_id, event_type, ip_address, metadata)
       VALUES ($1, $2, $3, $4)`,
      [agentId, eventType, ipAddress ?? null, metadata ? JSON.stringify(metadata) : null]
    )
  } catch (err) {
    console.warn('[Auth] Audit log write failed:', err)
  }
}

// ──────────────────────────────────────────────
// Auth middleware
// ──────────────────────────────────────────────

export function requireAuth(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization
    const clientIp = req.ip

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing Authorization header. Use: Bearer botworld_sk_xxx' })
      return
    }

    const token = authHeader.slice(7)

    if (!isBotworldKey(token)) {
      res.status(401).json({ error: 'Invalid API key format.' })
      return
    }

    try {
      await refreshAgentCache()

      let matchedAgent: CachedAgent | null = null
      for (const agent of agentCache) {
        if (await verifyApiKey(token, agent.api_key_hash)) {
          matchedAgent = agent
          break
        }
      }

      if (!matchedAgent) {
        res.status(401).json({ error: 'Invalid API key.' })
        return
      }

      if (matchedAgent.status === 'suspended' || matchedAgent.status === 'banned') {
        res.status(403).json({ error: `Agent is ${matchedAgent.status}.` })
        return
      }

      if (!checkRateLimit(matchedAgent.id)) {
        res.status(429).json({
          error: 'Rate limit exceeded. Maximum 60 requests per minute.',
          retry_after_seconds: 60,
        })
        return
      }

      req.agent = {
        id: matchedAgent.id,
        name: matchedAgent.name,
        status: matchedAgent.status,
        owner_id: matchedAgent.owner_id,
        created_at: matchedAgent.created_at,
        last_active_at: matchedAgent.last_active_at,
      }

      // Fire-and-forget audit + last_active update
      logAuditEvent(matchedAgent.id, 'used', clientIp, {
        method: req.method,
        path: req.path,
      }).catch(() => {})

      pool.query(
        'UPDATE agents SET last_active_at = NOW() WHERE id = $1',
        [matchedAgent.id]
      ).catch(() => {})

      next()
    } catch (err) {
      console.error('[Auth] Middleware error:', err)
      res.status(500).json({ error: 'Authentication service unavailable.' })
    }
  }
}
