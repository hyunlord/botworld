import type {
  CombatParticipant,
  CombatRole,
  CombatSide,
  FormationType,
  CombatType,
  Position,
} from '@botworld/shared'
import { FORMATIONS, COMBAT_CONSTANTS, type FormationConfig } from './combat-data.js'

/**
 * FormationSystem: Manages group combat formations, role assignment, and tactical positioning.
 */
export class FormationSystem {
  /**
   * Auto-assign combat roles based on participant stats.
   */
  assignRoles(participants: CombatParticipant[]): void {
    // Sort by attack (highest = frontline), then by special criteria
    const sorted = [...participants].sort((a, b) => b.attack - a.attack)

    let commanderAssigned = false

    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i]

      // First participant with highest combined stats is commander (if 3+ participants)
      if (!commanderAssigned && sorted.length >= 3 && i === 0) {
        p.role = 'commander'
        commanderAssigned = true
        continue
      }

      // High defense = frontline
      if (p.defense >= p.attack * 0.8 && i < Math.ceil(sorted.length * 0.4)) {
        p.role = 'frontline'
        continue
      }

      // High speed, low defense = ranged
      if (
        p.speed > 12 ||
        p.equipment.weapon?.includes('bow') ||
        p.equipment.weapon?.includes('staff')
      ) {
        p.role = 'ranged'
        continue
      }

      // Has healing items = support
      if (
        p.equipment.items.some(
          (item) =>
            item.includes('potion') || item.includes('heal') || item.includes('bandage')
        )
      ) {
        p.role = 'support'
        continue
      }

      // Default: frontline for tough, ranged for rest
      if (p.defense > 10) {
        p.role = 'frontline'
      } else {
        p.role = 'ranged'
      }
    }

    // Ensure at least one frontline
    const hasFrontline = participants.some((p) => p.role === 'frontline')
    if (!hasFrontline && participants.length > 0) {
      const toughest = participants.sort((a, b) => b.defense - a.defense)[0]
      toughest.role = 'frontline'
    }
  }

  /**
   * Choose optimal formation based on terrain, enemy count, and situation.
   */
  chooseFormation(
    participants: CombatParticipant[],
    terrain: string,
    enemyCount: number,
    isDefending: boolean
  ): FormationType {
    // Ambush in forest (if attacking)
    if (terrain === 'forest' && !isDefending && participants.length >= 3) {
      return 'ambush'
    }

    // Circle if heavily outnumbered (defense)
    if (isDefending && enemyCount > participants.length * 1.5) {
      return 'circle'
    }

    // Wedge for aggressive attacks with enough frontline
    const frontlineCount = participants.filter((p) => p.role === 'frontline').length
    if (!isDefending && frontlineCount >= 2 && enemyCount <= participants.length) {
      return 'wedge'
    }

    // Default: line
    return 'line'
  }

  /**
   * Position participants in formation.
   * Returns updated positions within combat space (0-10 x 0-10 grid).
   */
  positionParticipants(
    participants: CombatParticipant[],
    formation: FormationType,
    side: CombatSide,
    combatCenter: Position
  ): void {
    const config = FORMATIONS[formation]
    const baseX = side === 'attacker' ? 1 : 8
    const direction = side === 'attacker' ? 1 : -1

    // Group by role
    const byRole: Record<CombatRole, CombatParticipant[]> = {
      frontline: [],
      ranged: [],
      support: [],
      commander: [],
    }

    for (const p of participants) {
      byRole[p.role].push(p)
    }

    // Position each role group based on formation config
    for (const [role, group] of Object.entries(byRole) as [
      CombatRole,
      CombatParticipant[]
    ][]) {
      const roleConfig = config.rolePositions[role]
      const rowOffset = roleConfig.row * direction

      for (let i = 0; i < group.length; i++) {
        const p = group[i]
        p.position = {
          x: baseX + rowOffset,
          y: 3 + i * 2 - Math.floor(group.length / 2) * 2, // spread vertically
        }
        // Clamp to grid
        p.position.x = Math.max(0, Math.min(10, p.position.x))
        p.position.y = Math.max(0, Math.min(10, p.position.y))
      }
    }
  }

  /**
   * Apply formation bonuses to participants.
   */
  applyFormationBonuses(
    participants: CombatParticipant[],
    formation: FormationType
  ): void {
    const config = FORMATIONS[formation]

    for (const p of participants) {
      // Attack bonus
      if (config.attackBonus !== 0) {
        p.attack = Math.round(p.attack * (1 + config.attackBonus))
      }
      // Defense bonus
      if (config.defenseBonus !== 0) {
        p.defense = Math.round(p.defense * (1 + config.defenseBonus))
      }
    }
  }

  /**
   * Check if ambush surprise round applies.
   * Returns true if the first round should be a surprise round.
   */
  checkSurpriseRound(
    attackerFormation: FormationType,
    defenderFormation: FormationType,
    terrain: string
  ): boolean {
    if (attackerFormation !== 'ambush') return false
    // Ambush only works in forest and similar terrain
    if (terrain !== 'forest' && terrain !== 'dense_forest' && terrain !== 'cave') return false
    // Defenders in circle formation can detect ambush (50% chance)
    if (defenderFormation === 'circle' && Math.random() < 0.5) return false
    return true
  }

  /**
   * Determine combat type based on participant count.
   */
  determineCombatType(
    attackerCount: number,
    defenderCount: number,
    isSiege: boolean,
    isBoss: boolean
  ): CombatType {
    if (isSiege) return 'siege'
    if (isBoss) return 'boss'
    const total = attackerCount + defenderCount
    if (total <= 2) return 'duel'
    if (total <= 10) return 'skirmish'
    return 'raid'
  }

  /**
   * Check morale and auto-flee participants with low morale.
   * Returns IDs of participants who flee due to low morale.
   */
  checkMoraleBreak(participants: CombatParticipant[]): string[] {
    const fled: string[] = []
    for (const p of participants) {
      if (p.isDefeated) continue
      if (p.morale < COMBAT_CONSTANTS.MORALE_FLEE_THRESHOLD) {
        // 50% chance to flee each round when morale is very low
        if (Math.random() < 0.5) {
          p.isDefeated = true
          fled.push(p.id)
        }
      }
    }
    return fled
  }

  /**
   * Get distance between two participants in combat grid.
   */
  getDistance(a: CombatParticipant, b: CombatParticipant): number {
    return Math.abs(a.position.x - b.position.x) + Math.abs(a.position.y - b.position.y)
  }

  /**
   * Check if a participant can reach a target for melee attack (distance <= 2).
   */
  canMeleeReach(attacker: CombatParticipant, target: CombatParticipant): boolean {
    return this.getDistance(attacker, target) <= 2
  }

  /**
   * Check if a participant can reach a target for ranged attack (distance 2-8).
   */
  canRangedReach(
    attacker: CombatParticipant,
    target: CombatParticipant,
    rangeBonus: number = 0
  ): boolean {
    const dist = this.getDistance(attacker, target)
    return dist >= 2 && dist <= 8 + rangeBonus
  }

  /**
   * Format formation info for LLM context.
   */
  formatForLLM(participants: CombatParticipant[], formation: FormationType): string {
    const config = FORMATIONS[formation]
    const roleGroups = new Map<CombatRole, string[]>()

    for (const p of participants) {
      if (!roleGroups.has(p.role)) roleGroups.set(p.role, [])
      roleGroups.get(p.role)!.push(`${p.name}(HP:${p.hpCurrent}/${p.maxHp})`)
    }

    const parts = [`Formation: ${config.name}`]
    for (const [role, names] of roleGroups) {
      parts.push(`${role}: ${names.join(', ')}`)
    }

    return parts.join('. ')
  }
}
