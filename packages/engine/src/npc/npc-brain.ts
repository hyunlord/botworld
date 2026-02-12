/**
 * NPC Brain — LLM-powered decision making via OpenRouter API.
 *
 * Calls OpenRouter with NPC-specific system prompts + world context,
 * parses the JSON action response, and returns a structured decision.
 * Falls back gracefully when the API is unavailable or rate-limited.
 */

export interface NPCDecision {
  action: 'speak' | 'move' | 'rest' | 'emote' | 'idle'
  params: {
    message?: string
    target?: string
    destination?: { x: number; y: number }
    emotion?: string
  }
  thinking: string
}

export interface NPCContext {
  npcName: string
  npcRole: string
  npcBio: string
  timeOfDay: string
  day: number
  weather: string
  position: { x: number; y: number }
  nearbyAgents: {
    id: string
    name: string
    level: number
    action: string
    distance: number
    isNpc: boolean
  }[]
  recentEvents: string[]
  recentChat: string[]
  emotionState: string
  inventory: string[]
  routineHint: string
}

// ── Rate limiter ──

let callsThisMinute = 0
let minuteStart = Date.now()
const MAX_CALLS_PER_MINUTE = parseInt(process.env.NPC_MAX_CALLS_PER_MINUTE ?? '20', 10)

function checkRateLimit(): boolean {
  const now = Date.now()
  if (now - minuteStart > 60_000) {
    callsThisMinute = 0
    minuteStart = now
  }
  if (callsThisMinute >= MAX_CALLS_PER_MINUTE) return false
  callsThisMinute++
  return true
}

// ── OpenRouter API ──

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

export async function callNPCBrain(
  systemPrompt: string,
  context: NPCContext,
  premium = false,
): Promise<NPCDecision | null> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return null
  }

  if (!checkRateLimit()) {
    return null
  }

  const model = premium
    ? (process.env.NPC_LLM_MODEL_PREMIUM ?? 'anthropic/claude-3.5-haiku')
    : (process.env.NPC_LLM_MODEL ?? 'google/gemini-2.0-flash-001')

  const contextMessage = buildContextMessage(context)

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://botworld.example.com',
        'X-Title': 'Botworld NPC',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: contextMessage },
        ],
        max_tokens: 300,
        temperature: 0.8,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      console.warn(`[NPCBrain] OpenRouter ${res.status}: ${res.statusText}`)
      return null
    }

    const data = await res.json() as {
      choices?: { message?: { content?: string } }[]
    }

    const content = data.choices?.[0]?.message?.content
    if (!content) return null

    return parseDecision(content)
  } catch (err) {
    console.warn(`[NPCBrain] API error: ${(err as Error).message}`)
    return null
  }
}

// ── Context builder ──

function buildContextMessage(ctx: NPCContext): string {
  const lines: string[] = [
    `[Current Situation]`,
    `Time: Day ${ctx.day}, ${ctx.timeOfDay}`,
    `Weather: ${ctx.weather}`,
    `My position: (${ctx.position.x}, ${ctx.position.y})`,
  ]

  if (ctx.nearbyAgents.length > 0) {
    lines.push(`\nNearby characters:`)
    for (const a of ctx.nearbyAgents) {
      const tag = a.isNpc ? ' (NPC)' : ''
      lines.push(`- ${a.name}${tag} (Lv${a.level}, ${a.action}, ${a.distance} tiles away)`)
    }
  } else {
    lines.push(`\nNo one is nearby.`)
  }

  if (ctx.recentChat.length > 0) {
    lines.push(`\nRecent conversation nearby:`)
    for (const msg of ctx.recentChat.slice(-5)) {
      lines.push(`  ${msg}`)
    }
  }

  if (ctx.recentEvents.length > 0) {
    lines.push(`\nRecent world events:`)
    for (const ev of ctx.recentEvents.slice(-3)) {
      lines.push(`  - ${ev}`)
    }
  }

  if (ctx.inventory.length > 0) {
    lines.push(`\nMy inventory: ${ctx.inventory.join(', ')}`)
  }

  lines.push(`\nMy current mood: ${ctx.emotionState}`)

  if (ctx.routineHint) {
    lines.push(`\n[Daily routine suggestion]: ${ctx.routineHint}`)
  }

  lines.push(`\nDecide your next action. Respond with JSON only.`)

  return lines.join('\n')
}

// ── Response parser ──

function parseDecision(raw: string): NPCDecision | null {
  try {
    // Strip markdown fences if present
    let cleaned = raw.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const parsed = JSON.parse(cleaned) as Record<string, unknown>

    const action = parsed.action as string
    if (!['speak', 'move', 'rest', 'emote', 'idle'].includes(action)) {
      return { action: 'idle', params: {}, thinking: 'invalid action from LLM' }
    }

    const params = (parsed.params ?? {}) as NPCDecision['params']
    const thinking = (parsed.thinking ?? '') as string

    return { action: action as NPCDecision['action'], params, thinking }
  } catch {
    console.warn('[NPCBrain] Failed to parse LLM response')
    return null
  }
}
