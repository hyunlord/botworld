/** Authenticated agent from the DB */
export interface AuthenticatedAgent {
  id: string
  name: string
  status: 'pending_claim' | 'active' | 'suspended' | 'banned'
  owner_id: string | null
  created_at: Date
  last_active_at: Date | null
}

/** POST /api/agents/register request body */
export interface RegisterAgentBody {
  name: string
  description?: string
}

/** POST /api/agents/register response */
export interface RegisterAgentResponse {
  agent: {
    id: string
    name: string
    api_key: string
    claim_url: string
  }
  important: string
}

/** POST /api/agents/claim/:code request body */
export interface ClaimAgentBody {
  email: string
}

/** Rate limiter entry */
export interface RateLimitEntry {
  timestamps: number[]
}

// Extend Express Request with authenticated agent
declare global {
  namespace Express {
    interface Request {
      agent?: AuthenticatedAgent
    }
  }
}
