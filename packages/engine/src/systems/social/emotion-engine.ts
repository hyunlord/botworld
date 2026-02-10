import type { EmotionState, PersonalityTraits } from '@botworld/shared'

export type InteractionType = 'conversation' | 'trade' | 'shared_activity' | 'conflict' | 'gift'

export interface InteractionOutcome {
  type: InteractionType
  positive: boolean
  intensity: number // 0-1
}

/**
 * Calculate emotion delta from an interaction, modulated by personality.
 * Uses Plutchik's emotion model + OCEAN personality modifiers.
 */
export function calculateEmotionDelta(
  outcome: InteractionOutcome,
  personality: PersonalityTraits,
): EmotionState {
  const { type, positive, intensity } = outcome
  const delta: EmotionState = {
    joy: 0, trust: 0, fear: 0, surprise: 0,
    sadness: 0, disgust: 0, anger: 0, anticipation: 0,
  }

  const i = intensity

  if (positive) {
    switch (type) {
      case 'conversation':
        delta.joy = 0.05 * i * (1 + personality.extraversion)
        delta.trust = 0.04 * i * (1 + personality.agreeableness)
        delta.anticipation = 0.02 * i * personality.openness
        break
      case 'trade':
        delta.joy = 0.04 * i
        delta.trust = 0.06 * i * (1 + personality.agreeableness)
        delta.anticipation = 0.03 * i
        break
      case 'shared_activity':
        delta.joy = 0.06 * i * (1 + personality.extraversion)
        delta.trust = 0.05 * i
        delta.anticipation = 0.02 * i
        break
      case 'gift':
        delta.joy = 0.08 * i
        delta.trust = 0.07 * i
        delta.surprise = 0.04 * i * personality.openness
        break
    }
  } else {
    switch (type) {
      case 'conversation':
        delta.sadness = 0.03 * i * personality.neuroticism
        delta.anger = 0.02 * i * personality.neuroticism
        delta.trust = -0.03 * i
        break
      case 'trade':
        delta.anger = 0.04 * i * personality.neuroticism
        delta.trust = -0.05 * i
        delta.disgust = 0.02 * i
        break
      case 'conflict':
        delta.anger = 0.08 * i * (1 + personality.neuroticism)
        delta.fear = 0.04 * i * personality.neuroticism
        delta.trust = -0.06 * i
        delta.sadness = 0.03 * i
        break
    }
  }

  return delta
}

/**
 * Apply an emotion delta to a mood state, clamping values to [0, 1].
 */
export function applyEmotionDelta(mood: EmotionState, delta: EmotionState): void {
  const keys = Object.keys(mood) as (keyof EmotionState)[]
  for (const key of keys) {
    mood[key] = Math.max(0, Math.min(1, mood[key] + delta[key]))
  }
}
