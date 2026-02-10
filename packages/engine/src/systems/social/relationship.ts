import type { Agent, Relationship, EmotionState } from '@botworld/shared'
import { createEmotionState } from '@botworld/shared'
import {
  calculateEmotionDelta, applyEmotionDelta,
  type InteractionOutcome,
} from './emotion-engine.js'

/**
 * Get or create a relationship between two agents.
 */
export function getOrCreateRelationship(agent: Agent, targetId: string): Relationship {
  if (!agent.relationships[targetId]) {
    agent.relationships[targetId] = {
      targetAgentId: targetId,
      emotions: createEmotionState(),
      interactionCount: 0,
      lastInteraction: 0,
    }
  }
  return agent.relationships[targetId]
}

/**
 * Process an interaction between two agents: update relationship emotions and mood.
 */
export function processInteraction(
  agent: Agent,
  target: Agent,
  outcome: InteractionOutcome,
  tick: number,
): void {
  // Update agent's relationship with target
  const rel = getOrCreateRelationship(agent, target.id)
  rel.interactionCount++
  rel.lastInteraction = tick

  // Calculate emotion change based on interaction + personality
  const delta = calculateEmotionDelta(outcome, agent.personality)

  // Apply to relationship emotions
  applyEmotionDelta(rel.emotions, delta)

  // Also affect the agent's overall mood (at 50% intensity of relationship effect)
  const moodDelta: EmotionState = { ...delta }
  const keys = Object.keys(moodDelta) as (keyof EmotionState)[]
  for (const key of keys) {
    moodDelta[key] *= 0.5
  }
  applyEmotionDelta(agent.currentMood, moodDelta)
}

/**
 * Calculate compatibility score between two agents based on personality (0-1).
 * Higher = more compatible.
 */
export function personalityCompatibility(a: Agent, b: Agent): number {
  const pa = a.personality
  const pb = b.personality

  // Similar agreeableness and openness = more compatible
  // Extraversion mix (one high, one low) can work
  const agreedDiff = 1 - Math.abs(pa.agreeableness - pb.agreeableness)
  const openDiff = 1 - Math.abs(pa.openness - pb.openness)
  const consciDiff = 1 - Math.abs(pa.conscientiousness - pb.conscientiousness)

  // High neuroticism in both = less compatible
  const neuroticPenalty = (pa.neuroticism + pb.neuroticism) / 4

  return Math.max(0, Math.min(1,
    (agreedDiff * 0.35 + openDiff * 0.25 + consciDiff * 0.2) - neuroticPenalty + 0.2,
  ))
}

/**
 * Get overall sentiment of a relationship (-1 to 1).
 * Positive = friendly, Negative = hostile.
 */
export function relationshipSentiment(rel: Relationship): number {
  const e = rel.emotions
  const positive = e.joy + e.trust + e.anticipation
  const negative = e.anger + e.fear + e.sadness + e.disgust
  const total = positive + negative
  if (total === 0) return 0
  return (positive - negative) / total
}
