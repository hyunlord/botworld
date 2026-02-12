// ──────────────────────────────────────────────
// 6-Axis Relationship System
// ──────────────────────────────────────────────

/** 6 relationship axes */
export interface RelationshipAxes {
  /** -100~100: Can I share secrets with this person? */
  trust: number
  /** -100~100: Do I recognize their abilities/achievements? */
  respect: number
  /** -100~100: Do I personally like this person? */
  affection: number
  /** 0~100: Am I afraid of this person? */
  fear: number
  /** 0~100: Do I feel competitive toward this person? */
  rivalry: number
  /** Positive = I owe them, Negative = they owe me */
  debt: number
}

/** Relationship tags */
export type RelationshipTag =
  | 'mentor'
  | 'student'
  | 'trade_partner'
  | 'rival'
  | 'nemesis'
  | 'sworn_ally'
  | 'betrayed_by'
  | 'betrayed'
  | 'saved_life'
  | 'life_saved_by'
  | 'guild_mate'
  | 'former_guild'
  | 'business_partner'
  | 'debtor'
  | 'creditor'
  | 'teacher'
  | 'admirer'
  | 'protector'
  | 'ward'
  | 'co_founder'
  | 'enemy_of_friend'
  | 'friend_of_enemy'

/** A single relationship memory */
export interface RelationshipMemory {
  tick: number
  type: 'positive' | 'negative' | 'neutral'
  event: string
  trustChange: number
  respectChange: number
  affectionChange: number
  fearChange: number
  rivalryChange: number
  debtChange: number
  importance: number  // 1-10
  fading: boolean     // true = decays over time
  /** Decay multiplier applied by fading (starts at 1.0, decreases) */
  decayFactor: number
}

/** Full 6-axis relationship record (asymmetric: A→B != B→A) */
export interface Relationship6 {
  fromId: string
  toId: string
  axes: RelationshipAxes
  tags: RelationshipTag[]
  memories: RelationshipMemory[]
  firstMet: number
  lastInteraction: number
  interactionCount: number
}

// ──────────────────────────────────────────────
// Interaction types for automatic relationship changes
// ──────────────────────────────────────────────

export type RelationshipInteraction =
  | 'combat_victory'     // Fought together and won
  | 'life_saved'         // One saved the other's life
  | 'fair_trade'         // Fair trade completed
  | 'skill_taught'       // Taught a skill
  | 'gift_given'         // Gave a gift
  | 'secret_shared'      // Shared a secret
  | 'quest_completed'    // Completed quest together
  | 'abandoned'          // Fled and left ally behind
  | 'trade_scam'         // Cheated in trade
  | 'betrayal'           // Alliance betrayal / info leak
  | 'attacked'           // Attacked the other
  | 'insulted'           // Insulted or ignored
  | 'competition_lost'   // Lost a competition
  | 'conversation'       // Had a conversation (mild positive)

// ──────────────────────────────────────────────
// Rumor System
// ──────────────────────────────────────────────

export type RumorType = 'achievement' | 'scandal' | 'warning' | 'gossip' | 'trade_tip'

export interface Rumor {
  id: string
  type: RumorType
  content: string
  /** Agent the rumor is about */
  aboutId: string
  /** Agent who first created the rumor */
  originatedFrom: string
  /** Agents who have heard this rumor */
  spreadTo: string[]
  /** 0-100: decreases as rumor spreads */
  reliability: number
  createdAt: number
  expiresAt: number
}

// ──────────────────────────────────────────────
// Secret System
// ──────────────────────────────────────────────

export type SecretType = 'weakness' | 'treasure' | 'betrayal' | 'hidden_skill' | 'past'

export interface Secret {
  id: string
  /** Agent the secret belongs to */
  ownerId: string
  /** Agents who know this secret */
  knownBy: string[]
  type: SecretType
  content: string
  /** Political leverage 0-100 */
  leverage: number
  revealed: boolean
}

// ──────────────────────────────────────────────
// Reputation & Social Status
// ──────────────────────────────────────────────

export type ReputationCategory = 'combat' | 'trading' | 'social' | 'crafting' | 'leadership'

export interface AgentReputation {
  combat: number
  trading: number
  social: number
  crafting: number
  leadership: number
  /** Bad deeds accumulate infamy */
  infamy: number
}

export type SocialStatus =
  | 'newcomer'   // Just arrived
  | 'commoner'   // Survived 100+ ticks
  | 'artisan'    // Crafting reputation 80+
  | 'merchant'   // Trading reputation 70+
  | 'warrior'    // Combat reputation 70+
  | 'scholar'    // Owns 3+ lore_book or long library stay
  | 'noble'      // Town leader experience
  | 'hero'       // Heroic world event contribution
  | 'legend'     // 3+ categories at reputation 70+

export function createDefaultAxes(): RelationshipAxes {
  return { trust: 0, respect: 0, affection: 0, fear: 0, rivalry: 0, debt: 0 }
}

export function createDefaultReputation(): AgentReputation {
  return { combat: 0, trading: 0, social: 0, crafting: 0, leadership: 0, infamy: 0 }
}
