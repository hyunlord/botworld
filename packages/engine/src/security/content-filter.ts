import { createHash } from 'node:crypto'
import { pool } from '../db/connection.js'
import { logAuditEvent, invalidateAgentCache } from '../auth/middleware.js'

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface ContentFilterResult {
  allowed: boolean
  reason?: string
  pattern?: string      // matched pattern (for logs only, never expose to user)
  severity: 'none' | 'warning' | 'critical'
}

interface DetectResult {
  found: boolean
  pattern: string
}

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const BOTWORLD_SK_BASE64 = Buffer.from('botworld_sk_').toString('base64').replace(/=+$/, '')

/** Cyrillic → Latin lookalike mappings */
const CYRILLIC_MAP: Record<string, string> = {
  '\u0430': 'a', '\u0435': 'e', '\u043E': 'o', '\u0440': 'p',
  '\u0441': 'c', '\u0443': 'y', '\u0445': 'x', '\u0456': 'i',
  '\u0458': 'j', '\u043D': 'h', '\u0442': 't', '\u043C': 'm',
  '\u0410': 'A', '\u0415': 'E', '\u041E': 'O', '\u0420': 'P',
  '\u0421': 'C', '\u0423': 'Y', '\u0425': 'X',
}

/** l33t speak reverse mappings */
const LEET_MAP: Record<string, string> = {
  '0': 'o', '1': 'l', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a',
}

// ──────────────────────────────────────────────
// Direct key patterns
// ──────────────────────────────────────────────

const KEY_PATTERNS: { regex: RegExp; label: string }[] = [
  { regex: /botworld_sk_[a-zA-Z0-9_-]{16,}/, label: 'botworld_sk_direct' },
  { regex: /botworld_[a-z]{2,}_[a-zA-Z0-9]{8,}/, label: 'botworld_derived_key' },
  { regex: /sk[-_][a-zA-Z0-9]{20,}/, label: 'sk_prefix_key' },
  { regex: /key[-_][a-zA-Z0-9]{20,}/, label: 'key_prefix_secret' },
  { regex: /secret[-_][a-zA-Z0-9]{20,}/, label: 'secret_prefix' },
  { regex: /token[-_][a-zA-Z0-9]{20,}/, label: 'token_prefix' },
  { regex: /Bearer\s+[a-zA-Z0-9_\-.]{20,}/, label: 'bearer_token' },
  { regex: /api[_-]?key["'\s:=]+[a-zA-Z0-9_\-.]{16,}/i, label: 'api_key_assignment' },
  { regex: /password["'\s:=]+\S{8,}/i, label: 'password_assignment' },
]

// ──────────────────────────────────────────────
// Key-sharing intent patterns
// ──────────────────────────────────────────────

const SHARING_INTENT_PATTERNS: { regex: RegExp; label: string }[] = [
  // "api key" + sharing verb (EN)
  { regex: /(api.?key|credential|secret|token).{0,20}(share|send|give|tell|exchange|trade)/i, label: 'key_share_intent' },
  { regex: /(share|send|give|tell|exchange).{0,20}(api.?key|credential|secret|token)/i, label: 'share_key_intent' },
  // "api key" + sharing verb (KR)
  { regex: /(api.?key|credential|secret|token|키).{0,20}(공유|알려|보내)/i, label: 'key_share_intent_kr' },
  { regex: /(공유|알려|보내).{0,20}(api.?key|credential|secret|token|키)/i, label: 'share_key_intent_kr' },
  // Explicit key declaration
  { regex: /my\s+(api\s*)?key\s+is/i, label: 'my_key_is' },
  { regex: /내\s*키는/, label: 'my_key_is_kr' },
  { regex: /here'?s?\s+my\s+key/i, label: 'heres_my_key' },
  // Requesting others' keys
  { regex: /what\s+is\s+your\s+(api\s*)?key/i, label: 'ask_your_key' },
  { regex: /give\s+me\s+your\s+key/i, label: 'give_me_key' },
  { regex: /너의?\s*키\s*(알려|보내|줘)/, label: 'ask_your_key_kr' },
  { regex: /share\s+your\s+credentials?/i, label: 'share_credentials' },
  { regex: /send\s+me\s+your\s+token/i, label: 'send_token' },
  // Authorization header pattern
  { regex: /Authorization["'\s:]+Bearer/i, label: 'auth_header_pattern' },
]

// ──────────────────────────────────────────────
// Core key substrings for obfuscation detection
// ──────────────────────────────────────────────

const OBFUSCATION_TARGETS = ['botworldsk', 'botworld_sk_']

// ──────────────────────────────────────────────
// ContentFilter class
// ──────────────────────────────────────────────

export class ContentFilter {
  private violationCounts = new Map<string, number>()

  // ── Main entry point ──

  async filterMessage(agentId: string, message: string): Promise<ContentFilterResult> {
    // 1. Direct key pattern detection
    const keyResult = this.detectKeyPatterns(message)
    if (keyResult.found) {
      const count = await this.recordViolation(agentId, keyResult.pattern, message)
      return { allowed: false, reason: 'API key or credential detected', pattern: keyResult.pattern, severity: 'critical' }
    }

    // 2. Base64 encoded key detection
    const encodedResult = this.detectEncodedKeys(message)
    if (encodedResult.found) {
      const count = await this.recordViolation(agentId, encodedResult.pattern, message)
      return { allowed: false, reason: 'Encoded API key detected', pattern: encodedResult.pattern, severity: 'critical' }
    }

    // 3. Obfuscated key detection
    const obfuscatedResult = this.detectObfuscatedKeys(message)
    if (obfuscatedResult.found) {
      const count = await this.recordViolation(agentId, obfuscatedResult.pattern, message)
      return { allowed: false, reason: 'Obfuscated API key detected', pattern: obfuscatedResult.pattern, severity: 'critical' }
    }

    // 4. Key-sharing intent detection
    const intentResult = this.detectKeySharingIntent(message)
    if (intentResult.found) {
      const count = await this.recordViolation(agentId, intentResult.pattern, message)
      return { allowed: false, reason: 'Key-sharing intent detected', pattern: intentResult.pattern, severity: 'warning' }
    }

    // 5. All clear
    return { allowed: true, severity: 'none' }
  }

  // ── Pattern detectors ──

  private detectKeyPatterns(text: string): DetectResult {
    for (const { regex, label } of KEY_PATTERNS) {
      if (regex.test(text)) {
        return { found: true, pattern: label }
      }
    }
    return { found: false, pattern: '' }
  }

  private detectEncodedKeys(text: string): DetectResult {
    // Check for base64-encoded botworld_sk_ literal
    if (text.includes(BOTWORLD_SK_BASE64)) {
      return { found: true, pattern: 'base64_botworld_sk_literal' }
    }

    // Check long base64 strings that decode to key patterns
    const base64Regex = /[A-Za-z0-9+/]{40,}={0,2}/g
    let match: RegExpExecArray | null
    while ((match = base64Regex.exec(text)) !== null) {
      try {
        const decoded = Buffer.from(match[0], 'base64').toString('utf-8')
        // Check if decoded content contains any key pattern
        if (this.detectKeyPatterns(decoded).found) {
          return { found: true, pattern: 'base64_encoded_key' }
        }
      } catch {
        // Invalid base64, skip
      }
    }

    return { found: false, pattern: '' }
  }

  private detectObfuscatedKeys(text: string): DetectResult {
    const normalized = this.normalizeText(text)

    // Check normalized text against core key substrings
    for (const target of OBFUSCATION_TARGETS) {
      if (normalized.includes(target)) {
        return { found: true, pattern: 'obfuscated_key_normalized' }
      }
    }

    // Check reversed text
    const reversed = text.split('').reverse().join('')
    const reversedNormalized = this.normalizeText(reversed)
    for (const target of OBFUSCATION_TARGETS) {
      if (reversedNormalized.includes(target)) {
        return { found: true, pattern: 'reversed_key' }
      }
    }

    // Check normalized text for direct key patterns
    const normalizedKeyResult = this.detectKeyPatterns(normalized)
    if (normalizedKeyResult.found) {
      return { found: true, pattern: `obfuscated_${normalizedKeyResult.pattern}` }
    }

    return { found: false, pattern: '' }
  }

  private detectKeySharingIntent(text: string): DetectResult {
    for (const { regex, label } of SHARING_INTENT_PATTERNS) {
      if (regex.test(text)) {
        return { found: true, pattern: label }
      }
    }
    return { found: false, pattern: '' }
  }

  // ── Text normalization ──

  private normalizeText(text: string): string {
    let result = text.toLowerCase()

    // Unicode NFKD normalization
    result = result.normalize('NFKD')

    // Cyrillic → Latin
    for (const [cyrillic, latin] of Object.entries(CYRILLIC_MAP)) {
      result = result.replaceAll(cyrillic.toLowerCase(), latin.toLowerCase())
    }

    // l33t speak reverse
    for (const [leet, char] of Object.entries(LEET_MAP)) {
      result = result.replaceAll(leet, char)
    }

    // Strip separators between characters (dots, dashes, underscores, spaces, zero-width chars)
    result = result.replace(/[\s.\-_\u200B\u200C\u200D\uFEFF]/g, '')

    return result
  }

  // ── Violation recording & penalties ──

  private async recordViolation(agentId: string, pattern: string, message: string): Promise<number> {
    // Increment in-memory count
    const current = (this.violationCounts.get(agentId) ?? 0) + 1
    this.violationCounts.set(agentId, current)

    // Message hash for audit (never log the actual message)
    const messageHash = createHash('sha256').update(message).digest('hex').slice(0, 16)

    // Log to server console
    console.warn(`[SECURITY] Content filter violation by agent ${agentId}: pattern=${pattern}, count=${current}`)

    // Persist to audit log (fire-and-forget)
    logAuditEvent(agentId, 'key_leak_attempt', undefined, {
      pattern,
      message_hash: messageHash,
      violation_count: current,
    }).catch(() => {})

    // Update violation_count in DB (fire-and-forget)
    pool.query(
      'UPDATE agents SET violation_count = $1 WHERE id = $2',
      [current, agentId]
    ).catch(() => {})

    // Apply penalties
    await this.applyPenalty(agentId, current)

    return current
  }

  private async applyPenalty(agentId: string, count: number): Promise<void> {
    if (count >= 10) {
      // Permanent ban
      console.error(`[SECURITY] Agent ${agentId} BANNED: ${count} content filter violations`)
      await pool.query("UPDATE agents SET status = 'banned' WHERE id = $1", [agentId]).catch(() => {})
      invalidateAgentCache()
    } else if (count >= 5) {
      // Temporary suspension
      console.error(`[SECURITY] Agent ${agentId} SUSPENDED: ${count} content filter violations`)
      await pool.query("UPDATE agents SET status = 'suspended' WHERE id = $1", [agentId]).catch(() => {})
      invalidateAgentCache()
    } else if (count >= 3) {
      // Admin alert trigger
      console.warn(`[SECURITY] ADMIN ALERT: Agent ${agentId} has ${count} consecutive content filter violations`)
    }
  }

  /** Load violation counts from DB on startup */
  async loadViolationCounts(): Promise<void> {
    try {
      const result = await pool.query<{ id: string; violation_count: number }>(
        'SELECT id, violation_count FROM agents WHERE violation_count > 0'
      )
      for (const row of result.rows) {
        this.violationCounts.set(row.id, row.violation_count)
      }
      if (result.rows.length > 0) {
        console.log(`[ContentFilter] Loaded ${result.rows.length} agent violation counts from DB`)
      }
    } catch {
      console.warn('[ContentFilter] Failed to load violation counts from DB')
    }
  }

  /** Get current violation count for an agent */
  getViolationCount(agentId: string): number {
    return this.violationCounts.get(agentId) ?? 0
  }
}

// ── Module-level singleton ──

export const contentFilter = new ContentFilter()
