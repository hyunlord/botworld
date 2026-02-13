/**
 * NPC Brain — LLM-powered decision making via LLM router.
 *
 * Calls the LLM router (local/cloud dual routing) with NPC-specific system prompts + world context,
 * parses the JSON action response, and returns a structured decision.
 * Falls back gracefully when the router is unavailable.
 */

import type { ActionPlan } from '@botworld/shared'
import type { LLMRouter } from '../llm/llm-router.js'

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
  season: string
  weather: string
  position: { x: number; y: number }
  poiName?: string
  hp: number
  maxHp: number
  energy: number
  maxEnergy: number
  hunger: number
  maxHunger: number
  gold: number
  nearbyAgents: {
    id: string
    name: string
    level: number
    action: string
    distance: number
    isNpc: boolean
    role?: string
  }[]
  recentEvents: string[]
  recentChat: string[]
  emotionState: string
  inventory: string[]
  routineHint: string
  /** Social context (optional, enriched when social systems are wired) */
  relationshipContext?: string
  rumorContext?: string
  secretContext?: string
  reputationContext?: string
  /** Politics context (optional, enriched when politics systems are wired) */
  guildContext?: string
  settlementContext?: string
  kingdomContext?: string
  /** Building context (optional, enriched when building manager is wired) */
  buildingContext?: string
  /** Creature context (optional, enriched when creature manager is wired) */
  nearbyCreatures?: string
}

// ── LLM Router ──

let llmRouter: LLMRouter | null = null

export function setLLMRouter(router: LLMRouter): void {
  llmRouter = router
}

export async function callNPCBrain(
  systemPrompt: string,
  context: NPCContext,
  premium = false,
): Promise<NPCDecision | null> {
  if (!llmRouter) {
    return null
  }

  const contextMessage = buildContextMessage(context)

  try {
    const request: Parameters<typeof llmRouter.complete>[0] = {
      category: 'npc_action',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: contextMessage },
      ],
      max_tokens: 800,
      temperature: 0.8,
      response_format: 'json',
    }

    // Add model preference for premium requests (router ignores for local, which is fine)
    if (premium) {
      request.model = process.env.NPC_LLM_MODEL_PREMIUM ?? 'anthropic/claude-3.5-haiku'
    }

    const response = await llmRouter.complete(request)
    if (!response) return null

    return parseDecision(response.content)
  } catch (err) {
    console.warn(`[NPCBrain] LLM router error: ${(err as Error).message}`)
    return null
  }
}

/** Call NPC brain and return an ActionPlan (tries plan parsing first, falls back to single-action) */
export async function callNPCBrainForPlan(
  systemPrompt: string,
  context: NPCContext,
  premium = false,
): Promise<ActionPlan | null> {
  if (!llmRouter) return null

  const contextMessage = buildContextMessage(context)

  try {
    const request: Parameters<typeof llmRouter.complete>[0] = {
      category: 'npc_action',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: contextMessage },
      ],
      max_tokens: 800,
      temperature: 0.8,
      response_format: 'json',
    }

    // Add model preference for premium requests
    if (premium) {
      request.model = process.env.NPC_LLM_MODEL_PREMIUM ?? 'anthropic/claude-3.5-haiku'
    }

    const response = await llmRouter.complete(request)
    if (!response) return null

    // Try plan parsing first (new format with steps array)
    const plan = parsePlanResponse(response.content)
    if (plan) return plan

    // Fall back to old single-action parsing
    const decision = parseDecision(response.content)
    if (decision) return singleActionToPlan(decision)

    return null
  } catch (err) {
    console.warn(`[NPCBrain] LLM router error: ${(err as Error).message}`)
    return null
  }
}

// ── Context builder ──

const SEASON_ORDER = ['spring', 'summer', 'autumn', 'winter'] as const
function getSeason(day: number): string {
  return SEASON_ORDER[Math.floor((day % 28) / 7)]
}

function buildContextMessage(ctx: NPCContext): string {
  const season = ctx.season || getSeason(ctx.day)
  const lines: string[] = [
    `[Current Situation]`,
    `Time: Day ${ctx.day}, ${ctx.timeOfDay} | Season: ${season} | Weather: ${ctx.weather}`,
    ctx.poiName ? `Location: ${ctx.poiName} (${ctx.position.x}, ${ctx.position.y})` : `Position: (${ctx.position.x}, ${ctx.position.y})`,
    `HP: ${ctx.hp}/${ctx.maxHp} | Energy: ${ctx.energy}/${ctx.maxEnergy} | Hunger: ${ctx.hunger}/${ctx.maxHunger}`,
  ]

  if (ctx.gold > 0) {
    lines.push(`Gold: ${ctx.gold}`)
  }

  if (ctx.nearbyAgents.length > 0) {
    lines.push(`\nNearby characters:`)
    for (const a of ctx.nearbyAgents) {
      const tag = a.isNpc ? (a.role ? ` (${a.role})` : ' (NPC)') : ''
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

  // Social context (relationships, rumors, secrets, reputation)
  if (ctx.relationshipContext) {
    lines.push(`\n${ctx.relationshipContext}`)
  }
  if (ctx.rumorContext) {
    lines.push(`\n${ctx.rumorContext}`)
  }
  if (ctx.secretContext) {
    lines.push(`\n${ctx.secretContext}`)
  }
  if (ctx.reputationContext) {
    lines.push(`\n${ctx.reputationContext}`)
  }

  // Politics context (guild, settlement, kingdom)
  if (ctx.guildContext) {
    lines.push(`\n${ctx.guildContext}`)
  }
  if (ctx.settlementContext) {
    lines.push(`\n${ctx.settlementContext}`)
  }
  if (ctx.kingdomContext) {
    lines.push(`\n${ctx.kingdomContext}`)
  }

  // Building context
  if (ctx.buildingContext) {
    lines.push(`\n${ctx.buildingContext}`)
  }

  if (ctx.routineHint) {
    lines.push(`\n[Daily routine suggestion]: ${ctx.routineHint}`)
  }

  lines.push(`\nDecide your next action. Consider your relationships, reputation, and any rumors/secrets you know. Respond with JSON only.`)

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

/** Parse an LLM response as an ActionPlan */
export function parsePlanResponse(raw: string): ActionPlan | null {
  try {
    let cleaned = raw.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const parsed = JSON.parse(cleaned) as Record<string, unknown>

    // Check if this is a plan (has steps array) or a single action
    if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
      return {
        plan_name: (parsed.plan_name as string) ?? 'unnamed',
        steps: parsed.steps as ActionPlan['steps'],
        interrupt_conditions: parsed.interrupt_conditions as ActionPlan['interrupt_conditions'],
        fallback: parsed.fallback as ActionPlan['fallback'],
        max_duration: parsed.max_duration as number | undefined,
      }
    }

    // Single action → convert to a 1-step plan
    if (parsed.action) {
      const decision = parseDecision(raw)
      if (decision) {
        return singleActionToPlan(decision)
      }
    }

    return null
  } catch {
    console.warn('[NPCBrain] Failed to parse plan response')
    return null
  }
}

/** Convert a single NPCDecision to a 1-step ActionPlan for backward compatibility */
function singleActionToPlan(decision: NPCDecision): ActionPlan {
  const step: ActionPlan['steps'][0] = {
    action: decision.action,
    params: {},
  }

  if (decision.params.message) step.params.message = decision.params.message
  if (decision.params.target) step.target = decision.params.target
  if (decision.params.destination) step.params.destination = decision.params.destination
  if (decision.params.emotion) step.params.emote = decision.params.emotion

  return {
    plan_name: decision.thinking || decision.action,
    steps: [step],
    interrupt_conditions: { on_spoken_to: 'pause_and_respond' },
  }
}
