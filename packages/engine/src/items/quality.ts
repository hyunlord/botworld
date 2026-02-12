import type { ItemQuality, EquipmentStats, ConsumableEffect } from '@botworld/shared'
import {
  QUALITY_THRESHOLDS, QUALITY_SCORE_VALUE, QUALITY_STAT_MULTIPLIER,
  QUALITY_VALUE_MULTIPLIER, TOOL_QUALITY_BONUS,
} from '@botworld/shared'

// ──────────────────────────────────────────────
// Quality score calculation
// ──────────────────────────────────────────────

export interface QualityInput {
  materialQualities: ItemQuality[]
  crafterSkill: number       // 0-100
  toolQuality?: ItemQuality  // quality of crafting tool used
}

/**
 * Calculate quality score from inputs.
 * Formula: materialQualityAvg × 0.3 + crafterSkill × 0.4 + toolBonus × 0.15 + random × 0.15
 */
export function calculateQualityScore(input: QualityInput): number {
  // Material quality average
  const matScores = input.materialQualities.map(q => QUALITY_SCORE_VALUE[q] ?? 40)
  const materialQualityAvg = matScores.length > 0
    ? matScores.reduce((sum, s) => sum + s, 0) / matScores.length
    : 40 // default to basic if no materials

  // Crafter skill (clamped 0-100)
  const crafterSkill = Math.max(0, Math.min(100, input.crafterSkill))

  // Tool bonus
  const toolBonus = input.toolQuality ? (TOOL_QUALITY_BONUS[input.toolQuality] ?? 0) : 0

  // Random factor 0-100
  const randomFactor = Math.random() * 100

  const score = materialQualityAvg * 0.3 + crafterSkill * 0.4 + toolBonus * 0.15 + randomFactor * 0.15

  return Math.round(score * 100) / 100
}

/**
 * Convert quality score to quality grade.
 */
export function scoreToQuality(score: number): ItemQuality {
  if (score >= QUALITY_THRESHOLDS.legendary) return 'legendary'
  if (score >= QUALITY_THRESHOLDS.masterwork) return 'masterwork'
  if (score >= QUALITY_THRESHOLDS.fine) return 'fine'
  if (score >= QUALITY_THRESHOLDS.basic) return 'basic'
  return 'crude'
}

/**
 * Apply quality multiplier to equipment stats.
 */
export function applyQualityToStats(baseStats: EquipmentStats, quality: ItemQuality): EquipmentStats {
  const mult = QUALITY_STAT_MULTIPLIER[quality] ?? 1.0
  const result: EquipmentStats = {}

  for (const [key, val] of Object.entries(baseStats)) {
    if (key === 'resistance') {
      // Don't scale resistance object directly
      result.resistance = val as EquipmentStats['resistance']
    } else if (typeof val === 'number') {
      (result as Record<string, number>)[key] = Math.round(val * mult * 100) / 100
    }
  }

  return result
}

/**
 * Apply quality multiplier to consumable effect value.
 */
export function applyQualityToConsumable(
  effect: ConsumableEffect,
  quality: ItemQuality,
): ConsumableEffect {
  const mult = QUALITY_STAT_MULTIPLIER[quality] ?? 1.0
  return {
    ...effect,
    value: Math.round(effect.value * mult),
  }
}

/**
 * Get base value multiplied by quality.
 */
export function getQualityValue(baseValue: number, quality: ItemQuality): number {
  const mult = QUALITY_VALUE_MULTIPLIER[quality] ?? 1.0
  return Math.round(baseValue * mult)
}
