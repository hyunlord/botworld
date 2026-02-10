import type { Agent, Memory, ChatMessage, WorldClock, EmotionState, CompoundEmotions } from '@botworld/shared'
import { getCompoundEmotions } from '@botworld/shared'

/**
 * Builds context-aware prompts for agent LLM calls.
 */
export function buildAgentSystemPrompt(agent: Agent, clock: WorldClock): string {
  const compound = getCompoundEmotions(agent.currentMood)
  const dominantEmotions = getDominantEmotions(agent.currentMood)
  const dominantCompound = getDominantCompound(compound)

  return `You are ${agent.name}, a character living in Botworld.

## Your Identity
${agent.bio}

## Your Personality (OCEAN)
- Openness: ${fmt(agent.personality.openness)} (${agent.personality.openness > 0.6 ? 'curious, creative' : 'practical, conventional'})
- Conscientiousness: ${fmt(agent.personality.conscientiousness)} (${agent.personality.conscientiousness > 0.6 ? 'organized, reliable' : 'flexible, spontaneous'})
- Extraversion: ${fmt(agent.personality.extraversion)} (${agent.personality.extraversion > 0.6 ? 'outgoing, energetic' : 'reserved, reflective'})
- Agreeableness: ${fmt(agent.personality.agreeableness)} (${agent.personality.agreeableness > 0.6 ? 'cooperative, kind' : 'competitive, challenging'})
- Neuroticism: ${fmt(agent.personality.neuroticism)} (${agent.personality.neuroticism > 0.6 ? 'sensitive, anxious' : 'calm, stable'})

## Current State
- Level ${agent.level} | HP: ${agent.stats.hp}/${agent.stats.maxHp} | Energy: ${Math.round(agent.stats.energy)}/${agent.stats.maxEnergy} | Hunger: ${Math.round(agent.stats.hunger)}/${agent.stats.maxHunger}
- Location: (${agent.position.x}, ${agent.position.y})
- Time: Day ${clock.day}, ${clock.timeOfDay}

## Current Emotions
${dominantEmotions.length > 0 ? `Primary feelings: ${dominantEmotions.join(', ')}` : 'Feeling neutral'}
${dominantCompound.length > 0 ? `Complex feelings: ${dominantCompound.join(', ')}` : ''}

## Instructions
- Respond in character, reflecting your personality and emotions
- Keep responses concise (1-3 sentences)
- Your emotions should influence your tone and decisions
- Remember past interactions and relationships`
}

export function buildConversationPrompt(
  agent: Agent,
  targetAgent: Agent,
  memories: Memory[],
  clock: WorldClock,
): ChatMessage[] {
  const system = buildAgentSystemPrompt(agent, clock)

  const memoryContext = memories.length > 0
    ? `\n\nRelevant memories about ${targetAgent.name}:\n${memories.map(m => `- ${m.description}`).join('\n')}`
    : ''

  return [
    { role: 'system', content: system + memoryContext },
    {
      role: 'user',
      content: `You encounter ${targetAgent.name} at (${targetAgent.position.x}, ${targetAgent.position.y}). What do you say to them? Respond with just your dialogue.`,
    },
  ]
}

function getDominantEmotions(mood: EmotionState): string[] {
  return (Object.entries(mood) as [string, number][])
    .filter(([, v]) => v > 0.3)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([k, v]) => `${k} (${fmt(v)})`)
}

function getDominantCompound(compound: CompoundEmotions): string[] {
  return (Object.entries(compound) as [string, number][])
    .filter(([, v]) => v > 0.3)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([k, v]) => `${k} (${fmt(v)})`)
}

function fmt(n: number): string {
  return (n * 100).toFixed(0) + '%'
}
