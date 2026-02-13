/**
 * Prompt templates optimized for local LLM models (Qwen3-32B class).
 * Shorter, more explicit prompts with JSON examples for reliable parsing.
 */

import type { LLMCategory } from './types.js'

/** Check if a category should use optimized local prompts */
export function shouldUseLocalPrompt(category: LLMCategory): boolean {
  return [
    'npc_action', 'npc_conversation', 'npc_reaction', 'combat_tactics',
    'item_naming', 'election_speech', 'rumor_generation',
    'free_action_interpret', 'monster_dialogue',
  ].includes(category)
}

/** Wrap context into a compressed format for local models (saves tokens) */
export function compressNPCContext(ctx: {
  name: string; race?: string; role: string; level: number
  hp: number; maxHp: number; energy: number; hunger: number
  day: number; timeOfDay: string; weather: string; season: string
  poiName?: string; nearbyAgents?: string; relationships?: string
  recentChat?: string[]
}): string {
  const lines = [
    `[Char] ${ctx.name}, ${ctx.race ?? 'human'} ${ctx.role}, Lv.${ctx.level}`,
    `[Stats] HP:${ctx.hp}/${ctx.maxHp}, Energy:${ctx.energy}, Hunger:${ctx.hunger}`,
    `[Time] Day ${ctx.day}, ${ctx.timeOfDay}, ${ctx.weather}, ${ctx.season}`,
  ]
  if (ctx.poiName) lines.push(`[Location] ${ctx.poiName}`)
  if (ctx.nearbyAgents) lines.push(`[Nearby] ${ctx.nearbyAgents}`)
  if (ctx.relationships) lines.push(`[Relations] ${ctx.relationships}`)
  if (ctx.recentChat?.length) {
    lines.push(`[Chat] ${ctx.recentChat.slice(-3).join(' | ')}`)
  }
  return lines.join('\n')
}

/** Get an optimized system prompt for local models by category */
export function getLocalSystemPrompt(category: LLMCategory, extra?: Record<string, string>): string {
  switch (category) {
    case 'npc_action':
      return `You are a fantasy RPG NPC. Respond ONLY with valid JSON in this exact format:
{"plan_name":"short plan name","steps":[{"action":"move|speak|rest|emote|idle","params":{"destination":{"x":0,"y":0},"message":"text"},"target":"name","wait_after":5}],"fallback":{"action":"idle"}}
Actions: move (needs destination), speak (needs message, optional target), rest, emote (needs emote in params), idle.
Plan 3-6 steps. Be creative but realistic for your role.`

    case 'npc_conversation':
      return `You are ${extra?.name ?? 'an NPC'}. ${extra?.personality ?? 'Friendly and helpful.'}
Reply in 1-2 sentences. Stay in character. No JSON needed.`

    case 'npc_reaction':
      return `You are ${extra?.name ?? 'an NPC'}. Someone approached you. React briefly.
Respond with JSON: {"action":"speak|emote|idle","params":{"message":"text","emotion":"happy|worried|calm"}}`

    case 'combat_tactics':
      return `You are a combat AI. Pick the best action.
Respond with JSON: {"action":"attack|defend|special|flee","target":"name","reasoning":"brief"}`

    case 'item_naming':
      return `Create a fantasy weapon/armor name. 2-3 words only. Name only, no explanation.`

    case 'election_speech':
      return `Write a short election promise (1-2 sentences) for a fantasy village leader candidate.`

    case 'rumor_generation':
      return `Create a fantasy world rumor. One sentence only. Make it intriguing but plausible.`

    case 'free_action_interpret':
      return `Interpret a player's free-form action in a fantasy RPG.
Respond with JSON: {"action":"move|speak|gather|craft|rest|attack|use_item|trade","params":{},"narration":"brief description"}`

    case 'monster_dialogue':
      return `You are a fantasy creature. Speak in-character. 1-2 sentences. Simple vocabulary.`

    default:
      return 'You are a helpful assistant in a fantasy RPG world.'
  }
}
