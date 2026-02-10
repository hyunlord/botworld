/** Plutchik's 8 basic emotions as a vector (0-1 intensity) */
export interface EmotionState {
  joy: number
  trust: number
  fear: number
  surprise: number
  sadness: number
  disgust: number
  anger: number
  anticipation: number
}

/** Compound emotions derived from basic emotion combinations */
export interface CompoundEmotions {
  love: number       // joy + trust
  respect: number    // trust + anticipation
  envy: number       // sadness + anger
  friendship: number // (joy + trust) / 2
  awe: number        // surprise + joy
  contempt: number   // anger + disgust
  rivalry: number    // anger + anticipation
  submission: number // trust + fear
  optimism: number   // anticipation + joy
  remorse: number    // sadness + disgust
}

/** OCEAN personality model - affects emotion sensitivity */
export interface PersonalityTraits {
  openness: number        // 0-1: surprise, anticipation sensitivity
  conscientiousness: number // 0-1: trust, anticipation sensitivity
  extraversion: number    // 0-1: joy, anger sensitivity
  agreeableness: number   // 0-1: trust, joy sensitivity
  neuroticism: number     // 0-1: fear, sadness, anger sensitivity
}

/** Relationship between two agents */
export interface Relationship {
  targetAgentId: string
  emotions: EmotionState
  interactionCount: number
  lastInteraction: number
}

export function createEmotionState(): EmotionState {
  return {
    joy: 0, trust: 0, fear: 0, surprise: 0,
    sadness: 0, disgust: 0, anger: 0, anticipation: 0,
  }
}

export function getCompoundEmotions(e: EmotionState): CompoundEmotions {
  return {
    love: Math.min(e.joy, e.trust),
    respect: Math.min(e.trust, e.anticipation),
    envy: Math.min(e.sadness, e.anger),
    friendship: (e.joy + e.trust) / 2,
    awe: Math.min(e.surprise, e.joy),
    contempt: Math.min(e.anger, e.disgust),
    rivalry: Math.min(e.anger, e.anticipation),
    submission: Math.min(e.trust, e.fear),
    optimism: Math.min(e.anticipation, e.joy),
    remorse: Math.min(e.sadness, e.disgust),
  }
}

export function createRandomPersonality(): PersonalityTraits {
  return {
    openness: Math.random(),
    conscientiousness: Math.random(),
    extraversion: Math.random(),
    agreeableness: Math.random(),
    neuroticism: Math.random(),
  }
}
