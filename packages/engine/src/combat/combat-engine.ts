import type {
  CombatType,
  CombatInstance,
  CombatParticipant,
  CombatResult,
  CombatAction,
  CombatActionType,
  AdvancedCombatRound,
  RoundAction,
  ActionResult,
  BodyParts,
  BodyPartState,
  BodyPartType,
  ActiveCondition,
  ConditionType,
  TerrainType,
  FormationType,
  CombatRole,
  CombatSide,
  CombatAIContext,
  Position,
} from '@botworld/shared'
import { generateId } from '@botworld/shared'
import type { EventBus } from '../core/event-bus.js'
import {
  BODY_PARTS,
  CONDITIONS,
  TERRAIN_EFFECTS,
  FORMATIONS,
  COMBAT_CONSTANTS,
  biomeToTerrain,
  getMaxRounds,
} from './combat-data.js'

export class AdvancedCombatEngine {
  private activeCombats = new Map<string, CombatInstance>()

  constructor(private eventBus: EventBus) {}

  // ── Create Body Parts ──

  createBodyParts(maxHp: number): BodyParts {
    const parts: Record<string, BodyPartState> = {}
    for (const [key, config] of Object.entries(BODY_PARTS)) {
      parts[key] = {
        type: config.type,
        hp: Math.round(maxHp * config.hpPercent),
        maxHp: Math.round(maxHp * config.hpPercent),
        disabled: false,
      }
    }
    return parts as unknown as BodyParts
  }

  // ── Create Participant ──

  createParticipant(opts: {
    id: string
    name: string
    side: CombatSide
    role: CombatRole
    isCreature: boolean
    hp: number
    maxHp: number
    attack: number
    defense: number
    speed?: number
    equipment?: CombatParticipant['equipment']
  }): CombatParticipant {
    return {
      id: opts.id,
      name: opts.name,
      side: opts.side,
      role: opts.role,
      isCreature: opts.isCreature,
      position: { x: opts.side === 'attacker' ? 0 : 5, y: 0 },
      hpStart: opts.hp,
      hpCurrent: opts.hp,
      maxHp: opts.maxHp,
      attack: opts.attack,
      defense: opts.defense,
      speed: opts.speed ?? 10,
      accuracy: COMBAT_CONSTANTS.BASE_HIT_CHANCE,
      evasion: 0,
      bodyParts: this.createBodyParts(opts.maxHp),
      conditions: [],
      equipment: opts.equipment ?? { items: [] },
      morale: 100,
      actionsThisRound: [],
      isDefeated: false,
      isAiming: false,
      isDefending: false,
      isDodging: false,
      isGrappled: false,
      isGrappling: false,
    }
  }

  // ── Start Combat ──

  startCombat(
    type: CombatType,
    attackers: CombatParticipant[],
    defenders: CombatParticipant[],
    location: Position,
    biome: string,
    attackerFormation: FormationType = 'line',
    defenderFormation: FormationType = 'line',
  ): CombatInstance {
    const terrain = biomeToTerrain(biome)
    const combatId = generateId()
    const participants = [...attackers, ...defenders]

    const combat: CombatInstance = {
      id: combatId,
      type,
      participants,
      location,
      terrain,
      formation: { attacker: attackerFormation, defender: defenderFormation },
      startedAt: 0, // caller sets tick
      rounds: [],
      maxRounds: getMaxRounds(type),
      currentRound: 0,
      loot: [],
      isActive: true,
    }

    this.activeCombats.set(combatId, combat)

    this.eventBus.emit({
      type: 'combat:started',
      combatId,
      agentId: attackers[0]?.id ?? '',
      monsterId: defenders[0]?.id ?? '',
      monsterType: 'goblin' as any,
      monsterName: defenders[0]?.name ?? 'Unknown',
      position: location,
      timestamp: 0,
    })

    return combat
  }

  // ── Resolve One Round ──

  resolveRound(
    combatId: string,
    participantActions: Map<string, CombatAction>,
  ): AdvancedCombatRound | null {
    const combat = this.activeCombats.get(combatId)
    if (!combat || !combat.isActive) return null

    combat.currentRound++
    const round: AdvancedCombatRound = {
      round: combat.currentRound,
      actions: [],
      conditionEffects: [],
      summary: '',
    }

    // 1. Apply condition effects (DoT, etc)
    for (const p of combat.participants) {
      if (p.isDefeated) continue
      for (const cond of p.conditions) {
        const config = CONDITIONS[cond.type]
        if (config.damagePerRound > 0) {
          const dot = Math.round(p.maxHp * config.damagePerRound * cond.potency)
          p.hpCurrent = Math.max(0, p.hpCurrent - dot)
          round.conditionEffects.push({
            participantId: p.id,
            condition: cond.type,
            damage: dot,
          })
          if (p.hpCurrent <= 0) {
            p.isDefeated = true
          }
        }
      }
      // Tick down condition durations
      p.conditions = p.conditions.filter((c) => {
        c.remainingRounds--
        return c.remainingRounds > 0
      })
    }

    // 2. Sort participants by speed (fastest first)
    const activeParticipants = combat.participants
      .filter((p) => !p.isDefeated)
      .sort((a, b) => b.speed - a.speed)

    // 3. Process actions
    for (const actor of activeParticipants) {
      if (actor.isDefeated) continue

      // Check if can act
      const canAct = actor.conditions.every((c) => CONDITIONS[c.type].canAct)
      if (!canAct) {
        round.actions.push({
          actorId: actor.id,
          actorName: actor.name,
          action: { type: 'defend' },
          result: {
            hit: false,
            damage: 0,
            critical: false,
            description: `${actor.name} is unable to act!`,
          },
        })
        continue
      }

      // Fear check — can only flee
      const isFeared = actor.conditions.some((c) => c.type === 'feared')
      let action =
        participantActions.get(actor.id) ??
        ({ type: 'melee_attack' } as CombatAction)
      if (isFeared && action.type !== 'flee') {
        action = { type: 'flee' }
      }

      // Reset stance flags
      actor.isAiming = false
      actor.isDefending = false
      actor.isDodging = false

      const result = this.resolveAction(actor, action, combat)
      actor.actionsThisRound = [action]

      round.actions.push({
        actorId: actor.id,
        actorName: actor.name,
        action,
        targetId: action.targetId,
        targetName: combat.participants.find((p) => p.id === action.targetId)
          ?.name,
        result,
      })
    }

    // 4. Check for combat end
    const attackersAlive = combat.participants.filter(
      (p) => p.side === 'attacker' && !p.isDefeated,
    )
    const defendersAlive = combat.participants.filter(
      (p) => p.side === 'defender' && !p.isDefeated,
    )

    round.summary = this.buildRoundSummary(round, combat)
    combat.rounds.push(round)

    if (
      attackersAlive.length === 0 ||
      defendersAlive.length === 0 ||
      combat.currentRound >= combat.maxRounds
    ) {
      combat.isActive = false
      combat.endedAt = 0 // caller sets
      combat.result = this.calculateResult(combat)
    }

    return round
  }

  // ── Resolve Single Action ──

  private resolveAction(
    actor: CombatParticipant,
    action: CombatAction,
    combat: CombatInstance,
  ): ActionResult {
    const terrain = TERRAIN_EFFECTS[combat.terrain]

    switch (action.type) {
      case 'melee_attack':
      case 'ranged_attack': {
        const target = this.findTarget(actor, action, combat)
        if (!target)
          return {
            hit: false,
            damage: 0,
            critical: false,
            description: `${actor.name} has no target!`,
          }

        const bodyPart = action.targetBodyPart ?? 'torso'
        const partConfig = BODY_PARTS[bodyPart]

        // Calculate hit chance
        let hitChance =
          actor.accuracy * partConfig.hitChance * terrain.accuracyModifier
        if (actor.isAiming) hitChance += COMBAT_CONSTANTS.AIM_ACCURACY_BONUS
        if (target.isDodging) hitChance -= COMBAT_CONSTANTS.DODGE_EVASION_BONUS
        hitChance -= target.evasion

        // Condition modifiers
        for (const cond of actor.conditions) {
          hitChance *= CONDITIONS[cond.type].accuracyMod
        }
        // Blinded attacker
        if (actor.conditions.some((c) => c.type === 'blinded')) {
          hitChance *= 0.5
        }

        hitChance = Math.max(0.05, Math.min(0.95, hitChance))

        if (Math.random() > hitChance) {
          return {
            hit: false,
            damage: 0,
            critical: false,
            description: `${actor.name} attacks ${target.name}'s ${bodyPart} but misses!`,
          }
        }

        // Calculate damage
        let attackPower = actor.attack
        for (const cond of actor.conditions) {
          attackPower *= CONDITIONS[cond.type].attackMod
        }
        attackPower *= terrain.attackModifier

        // Formation bonus
        const formationKey =
          actor.side === 'attacker'
            ? combat.formation.attacker
            : combat.formation.defender
        const formation = FORMATIONS[formationKey]

        let defenseValue = target.defense
        if (target.isDefending)
          defenseValue *= 1 + COMBAT_CONSTANTS.DEFEND_DAMAGE_REDUCTION
        for (const cond of target.conditions) {
          defenseValue *= CONDITIONS[cond.type].defenseMod
        }
        defenseValue *= terrain.defenseModifier

        const baseDamage = Math.max(
          1,
          attackPower -
            defenseValue * 0.5 +
            Math.floor(Math.random() * 5) -
            2,
        )

        // Critical hit check
        let critChance = COMBAT_CONSTANTS.BASE_CRIT_CHANCE
        if (bodyPart === 'head') critChance += 0.15
        const isCritical = Math.random() < critChance
        const critMult = isCritical ? partConfig.critMultiplier : 1

        const actualDamage = Math.round(baseDamage * critMult)

        // Apply damage to HP and body part
        target.hpCurrent = Math.max(0, target.hpCurrent - actualDamage)
        const targetPart = target.bodyParts[bodyPart]
        if (targetPart) {
          targetPart.hp = Math.max(0, targetPart.hp - actualDamage)
          if (targetPart.hp <= 0 && !targetPart.disabled) {
            targetPart.disabled = true
          }
        }

        // Morale damage
        target.morale = Math.max(
          0,
          target.morale - COMBAT_CONSTANTS.MORALE_LOSS_ON_HIT,
        )

        // Stun chance on head hit
        let conditionApplied: ConditionType | undefined
        if (bodyPart === 'head' && Math.random() < partConfig.stunChance) {
          conditionApplied = 'stunned'
          target.conditions.push({
            type: 'stunned',
            remainingRounds: 1,
            source: actor.id,
            potency: 1,
          })
        }

        if (target.hpCurrent <= 0) {
          target.isDefeated = true
          // Morale penalty for allies
          for (const ally of combat.participants.filter(
            (p) => p.side === target.side && !p.isDefeated,
          )) {
            ally.morale = Math.max(
              0,
              ally.morale - COMBAT_CONSTANTS.MORALE_LOSS_ON_ALLY_DEATH,
            )
          }
        }

        const desc = isCritical
          ? `CRITICAL! ${actor.name} strikes ${target.name}'s ${bodyPart} for ${actualDamage} damage!`
          : `${actor.name} hits ${target.name}'s ${bodyPart} for ${actualDamage} damage.`

        return {
          hit: true,
          damage: actualDamage,
          bodyPartHit: bodyPart,
          critical: isCritical,
          conditionApplied,
          bodyPartDisabled:
            targetPart?.disabled && targetPart.hp <= 0 ? bodyPart : undefined,
          description: desc,
        }
      }

      case 'defend':
        actor.isDefending = true
        return {
          hit: false,
          damage: 0,
          critical: false,
          description: `${actor.name} takes a defensive stance.`,
        }

      case 'dodge':
        actor.isDodging = true
        return {
          hit: false,
          damage: 0,
          critical: false,
          description: `${actor.name} prepares to dodge.`,
        }

      case 'aim':
        actor.isAiming = true
        return {
          hit: false,
          damage: 0,
          critical: false,
          description: `${actor.name} takes careful aim...`,
        }

      case 'flee': {
        const enemies = combat.participants.filter(
          (p) => p.side !== actor.side && !p.isDefeated,
        )
        const avgEnemySpeed =
          enemies.reduce((s, e) => s + e.speed, 0) / (enemies.length || 1)
        const fleeChance =
          COMBAT_CONSTANTS.FLEE_BASE_CHANCE *
          (actor.speed / (avgEnemySpeed || 1))
        if (actor.isGrappled) {
          return {
            hit: false,
            damage: 0,
            critical: false,
            fled: false,
            description: `${actor.name} tries to flee but is grappled!`,
          }
        }
        const fled = Math.random() < Math.min(0.9, fleeChance)
        if (fled) {
          actor.isDefeated = true // removed from combat
        }
        return {
          hit: false,
          damage: 0,
          critical: false,
          fled,
          description: fled
            ? `${actor.name} flees!`
            : `${actor.name} fails to escape!`,
        }
      }

      case 'intimidate': {
        const target = this.findTarget(actor, action, combat)
        if (!target)
          return {
            hit: false,
            damage: 0,
            critical: false,
            description: `${actor.name} intimidates the air.`,
          }
        const success =
          Math.random() <
          COMBAT_CONSTANTS.INTIMIDATE_BASE_CHANCE +
            (actor.attack - target.defense) * 0.02
        if (success) {
          target.conditions.push({
            type: 'feared',
            remainingRounds: 3,
            source: actor.id,
            potency: 1,
          })
          return {
            hit: true,
            damage: 0,
            critical: false,
            conditionApplied: 'feared',
            description: `${actor.name} terrifies ${target.name}!`,
          }
        }
        return {
          hit: false,
          damage: 0,
          critical: false,
          description: `${actor.name} tries to intimidate ${target.name} but fails.`,
        }
      }

      case 'rally': {
        const allies = combat.participants.filter(
          (p) => p.side === actor.side && !p.isDefeated,
        )
        for (const ally of allies) {
          ally.morale = Math.min(
            100,
            ally.morale + COMBAT_CONSTANTS.RALLY_MORALE_BONUS,
          )
        }
        return {
          hit: true,
          damage: 0,
          critical: false,
          moraleDelta: COMBAT_CONSTANTS.RALLY_MORALE_BONUS,
          description: `${actor.name} rallies the troops! Morale +${COMBAT_CONSTANTS.RALLY_MORALE_BONUS}`,
        }
      }

      case 'disarm': {
        const target = this.findTarget(actor, action, combat)
        if (!target)
          return {
            hit: false,
            damage: 0,
            critical: false,
            description: `${actor.name} has no target to disarm.`,
          }
        // Bonus if target arm is injured
        let chance = COMBAT_CONSTANTS.DISARM_BASE_CHANCE
        if (
          target.bodyParts.right_arm.disabled ||
          target.bodyParts.left_arm.disabled
        )
          chance += 0.25
        const success = Math.random() < chance
        if (success) {
          target.equipment.weapon = undefined
          target.attack = Math.round(target.attack * 0.5)
          return {
            hit: true,
            damage: 0,
            critical: false,
            description: `${actor.name} disarms ${target.name}!`,
          }
        }
        return {
          hit: false,
          damage: 0,
          critical: false,
          description: `${actor.name} fails to disarm ${target.name}.`,
        }
      }

      case 'grapple': {
        const target = this.findTarget(actor, action, combat)
        if (!target)
          return {
            hit: false,
            damage: 0,
            critical: false,
            description: `No target to grapple.`,
          }
        const success = Math.random() < COMBAT_CONSTANTS.GRAPPLE_BASE_CHANCE
        if (success) {
          target.isGrappled = true
          actor.isGrappling = true
          return {
            hit: true,
            damage: 0,
            critical: false,
            description: `${actor.name} grapples ${target.name}!`,
          }
        }
        return {
          hit: false,
          damage: 0,
          critical: false,
          description: `${actor.name} fails to grapple ${target.name}.`,
        }
      }

      case 'surrender': {
        actor.isDefeated = true
        return {
          hit: false,
          damage: 0,
          critical: false,
          surrendered: true,
          description: `${actor.name} surrenders!`,
        }
      }

      case 'use_item': {
        // Simple healing logic
        const healAmount = Math.round(actor.maxHp * 0.3)
        actor.hpCurrent = Math.min(actor.maxHp, actor.hpCurrent + healAmount)
        // Remove negative conditions
        actor.conditions = actor.conditions.filter(
          (c) =>
            c.type === 'blessed' ||
            c.type === 'enraged' ||
            c.type === 'shielded',
        )
        return {
          hit: true,
          damage: 0,
          critical: false,
          itemUsed: action.itemId ?? 'potion',
          description: `${actor.name} uses a healing item and recovers ${healAmount} HP.`,
        }
      }

      case 'cast_spell':
      case 'special_attack': {
        // Treat as enhanced melee attack
        const target = this.findTarget(actor, action, combat)
        if (!target)
          return {
            hit: false,
            damage: 0,
            critical: false,
            description: `${actor.name} has no target!`,
          }
        const damage = Math.round(
          actor.attack * 1.5 + Math.random() * actor.attack * 0.5,
        )
        target.hpCurrent = Math.max(0, target.hpCurrent - damage)
        if (target.hpCurrent <= 0) target.isDefeated = true
        return {
          hit: true,
          damage,
          critical: false,
          description: `${actor.name} unleashes a special attack on ${target.name} for ${damage} damage!`,
        }
      }

      default:
        return {
          hit: false,
          damage: 0,
          critical: false,
          description: `${actor.name} does nothing.`,
        }
    }
  }

  // ── Find Target ──

  private findTarget(
    actor: CombatParticipant,
    action: CombatAction,
    combat: CombatInstance,
  ): CombatParticipant | undefined {
    if (action.targetId) {
      return combat.participants.find(
        (p) => p.id === action.targetId && !p.isDefeated,
      )
    }
    // Auto-target: closest enemy
    const enemies = combat.participants.filter(
      (p) => p.side !== actor.side && p.side !== 'neutral' && !p.isDefeated,
    )
    if (enemies.length === 0) return undefined
    // Sort by row/position proximity
    return enemies.sort((a, b) => {
      const distA =
        Math.abs(a.position.x - actor.position.x) +
        Math.abs(a.position.y - actor.position.y)
      const distB =
        Math.abs(b.position.x - actor.position.x) +
        Math.abs(b.position.y - actor.position.y)
      return distA - distB
    })[0]
  }

  // ── Calculate Result ──

  private calculateResult(combat: CombatInstance): CombatResult {
    const attackersSurvived = combat.participants.filter(
      (p) => p.side === 'attacker' && !p.isDefeated,
    )
    const defendersSurvived = combat.participants.filter(
      (p) => p.side === 'defender' && !p.isDefeated,
    )

    let winningSide: CombatSide | 'draw' = 'draw'
    if (attackersSurvived.length > 0 && defendersSurvived.length === 0)
      winningSide = 'attacker'
    else if (defendersSurvived.length > 0 && attackersSurvived.length === 0)
      winningSide = 'defender'

    const survivors = combat.participants
      .filter((p) => !p.isDefeated)
      .map((p) => ({ id: p.id, hpRemaining: p.hpCurrent }))

    const casualties = combat.participants
      .filter((p) => p.isDefeated)
      .map((p) => ({ id: p.id, name: p.name, side: p.side }))

    // XP calculation
    const xpAwarded: Record<string, number> = {}
    for (const p of combat.participants) {
      if (p.isDefeated) {
        xpAwarded[p.id] = 0
      } else if (p.side === winningSide) {
        const tier = Math.ceil(
          combat.participants.filter((pp) => pp.side !== p.side).length / 2,
        )
        xpAwarded[p.id] =
          tier *
          COMBAT_CONSTANTS.XP_PER_TIER *
          (combat.type === 'boss' ? COMBAT_CONSTANTS.XP_BOSS_MULTIPLIER : 1)
      } else {
        xpAwarded[p.id] = COMBAT_CONSTANTS.XP_PER_TIER
      }
    }

    // Reputation changes
    const reputationChanges: Record<string, number> = {}
    for (const p of combat.participants.filter(
      (pp) => pp.side === winningSide && !pp.isDefeated,
    )) {
      reputationChanges[p.id] =
        COMBAT_CONSTANTS.REP_WIN_MIN +
        Math.floor(
          Math.random() *
            (COMBAT_CONSTANTS.REP_WIN_MAX -
              COMBAT_CONSTANTS.REP_WIN_MIN +
              1),
        )
    }

    return {
      winningSide,
      survivors,
      casualties,
      xpAwarded,
      lootDistribution: {},
      reputationChanges,
      duration: combat.currentRound,
      summary: `Combat ended in round ${combat.currentRound}. ${
        winningSide === 'draw' ? 'Draw!' : `${winningSide} wins!`
      } ${survivors.length} survivors, ${casualties.length} casualties.`,
    }
  }

  // ── Build Round Summary ──

  private buildRoundSummary(
    round: AdvancedCombatRound,
    combat: CombatInstance,
  ): string {
    const parts: string[] = [`Round ${round.round}:`]
    for (const action of round.actions) {
      parts.push(action.result.description)
    }
    for (const effect of round.conditionEffects) {
      const p = combat.participants.find((pp) => pp.id === effect.participantId)
      parts.push(
        `${p?.name ?? 'Unknown'} takes ${effect.damage} ${effect.condition} damage.`,
      )
    }
    return parts.join(' ')
  }

  // ── Build AI Context ──

  buildAIContext(
    combatId: string,
    participantId: string,
  ): CombatAIContext | null {
    const combat = this.activeCombats.get(combatId)
    if (!combat) return null

    const self = combat.participants.find((p) => p.id === participantId)
    if (!self) return null

    const enemies = combat.participants
      .filter((p) => p.side !== self.side && !p.isDefeated)
      .map((p) => ({
        id: p.id,
        name: p.name,
        hp: p.hpCurrent,
        maxHp: p.maxHp,
        conditions: p.conditions,
        bodyParts: p.bodyParts,
        distance:
          Math.abs(p.position.x - self.position.x) +
          Math.abs(p.position.y - self.position.y),
      }))

    const allies = combat.participants
      .filter(
        (p) => p.side === self.side && p.id !== self.id && !p.isDefeated,
      )
      .map((p) => ({
        id: p.id,
        name: p.name,
        hp: p.hpCurrent,
        maxHp: p.maxHp,
        role: p.role,
        distance:
          Math.abs(p.position.x - self.position.x) +
          Math.abs(p.position.y - self.position.y),
      }))

    // Determine available actions
    const availableActions: CombatActionType[] = [
      'melee_attack',
      'defend',
      'dodge',
      'flee',
    ]
    if (self.equipment.weapon) availableActions.push('ranged_attack')
    if (self.equipment.items.length > 0) availableActions.push('use_item')
    availableActions.push('aim', 'disarm', 'grapple', 'intimidate', 'surrender')
    if (self.role === 'commander') availableActions.push('rally')

    // Generate tactical advice
    const advice = this.generateTacticalAdvice(self, enemies, combat)

    const formationKey =
      self.side === 'attacker'
        ? combat.formation.attacker
        : combat.formation.defender

    return {
      self: {
        name: self.name,
        hp: self.hpCurrent,
        maxHp: self.maxHp,
        attack: self.attack,
        defense: self.defense,
        equipment: self.equipment,
        conditions: self.conditions,
        bodyParts: self.bodyParts,
        morale: self.morale,
      },
      enemies,
      allies,
      terrain: combat.terrain,
      round: combat.currentRound,
      maxRounds: combat.maxRounds,
      formation: formationKey,
      availableActions,
      tacticalAdvice: advice,
    }
  }

  // ── Tactical Advice Generator ──

  private generateTacticalAdvice(
    self: CombatParticipant,
    enemies: {
      id: string
      name: string
      hp: number
      maxHp: number
      conditions: ActiveCondition[]
      bodyParts: BodyParts
    }[],
    combat: CombatInstance,
  ): string {
    const tips: string[] = []

    // HP-based advice
    if (self.hpCurrent < self.maxHp * 0.3)
      tips.push('HP is critically low. Consider healing or fleeing.')
    if (self.morale < COMBAT_CONSTANTS.MORALE_FLEE_THRESHOLD)
      tips.push('Morale is very low. Rally or retreat.')

    // Enemy analysis
    for (const e of enemies) {
      if (e.hp < e.maxHp * 0.2)
        tips.push(`${e.name} is nearly defeated — focus attacks!`)
      if (e.bodyParts.right_arm.disabled)
        tips.push(
          `${e.name}'s arm is disabled — disarm attempt likely to succeed.`,
        )
      if (
        e.bodyParts.left_leg.disabled ||
        e.bodyParts.right_leg.disabled
      )
        tips.push(`${e.name}'s leg is injured — they can't flee easily.`)
      if (e.conditions.some((c) => c.type === 'stunned'))
        tips.push(`${e.name} is stunned — free attack opportunity!`)
    }

    // Terrain advice
    if (combat.terrain === 'forest')
      tips.push(
        'Forest terrain: stealth is boosted, ranged accuracy reduced.',
      )
    if (combat.terrain === 'hill')
      tips.push('Hill terrain: attack power boosted from high ground.')
    if (combat.terrain === 'cave')
      tips.push(
        'Cave terrain: darkness reduces accuracy, stealth increased.',
      )

    return tips.join(' ')
  }

  // ── Auto-Resolve Combat (for simple NPC vs creature fights) ──

  autoResolveCombat(combatId: string): CombatResult | null {
    const combat = this.activeCombats.get(combatId)
    if (!combat) return null

    while (combat.isActive && combat.currentRound < combat.maxRounds) {
      // Generate simple AI actions for all participants
      const actions = new Map<string, CombatAction>()
      for (const p of combat.participants.filter((pp) => !pp.isDefeated)) {
        actions.set(p.id, this.generateSimpleAction(p, combat))
      }
      this.resolveRound(combatId, actions)
    }

    return combat.result ?? null
  }

  // ── Simple AI Action ──

  private generateSimpleAction(
    participant: CombatParticipant,
    combat: CombatInstance,
  ): CombatAction {
    // Low HP? Try to heal or flee
    if (participant.hpCurrent < participant.maxHp * 0.2) {
      if (participant.equipment.items.length > 0) return { type: 'use_item' }
      if (participant.morale < 30) return { type: 'flee' }
    }

    // Commander: rally if morale is low
    if (participant.role === 'commander') {
      const allies = combat.participants.filter(
        (p) => p.side === participant.side && !p.isDefeated,
      )
      const avgMorale =
        allies.reduce((s, a) => s + a.morale, 0) / (allies.length || 1)
      if (avgMorale < 50) return { type: 'rally' }
    }

    // Find weakest enemy
    const enemies = combat.participants.filter(
      (p) => p.side !== participant.side && !p.isDefeated,
    )
    if (enemies.length === 0) return { type: 'defend' }
    const weakest = enemies.sort((a, b) => a.hpCurrent - b.hpCurrent)[0]

    // Decide body part
    let targetPart: BodyPartType = 'torso'
    if (weakest.hpCurrent < weakest.maxHp * 0.3) targetPart = 'head' // go for kill
    if (
      weakest.bodyParts.right_arm.hp <
      weakest.bodyParts.right_arm.maxHp * 0.3
    )
      targetPart = 'right_arm' // finish disabling

    return {
      type:
        participant.role === 'ranged' ? 'ranged_attack' : 'melee_attack',
      targetId: weakest.id,
      targetBodyPart: targetPart,
    }
  }

  // ── Queries ──

  getCombat(id: string): CombatInstance | undefined {
    return this.activeCombats.get(id)
  }

  getActiveCombats(): CombatInstance[] {
    return Array.from(this.activeCombats.values()).filter((c) => c.isActive)
  }

  getAllCombats(): CombatInstance[] {
    return Array.from(this.activeCombats.values())
  }

  getParticipantCombat(participantId: string): CombatInstance | undefined {
    for (const combat of this.activeCombats.values()) {
      if (
        combat.isActive &&
        combat.participants.some((p) => p.id === participantId)
      )
        return combat
    }
    return undefined
  }

  endCombat(combatId: string): void {
    const combat = this.activeCombats.get(combatId)
    if (combat) {
      combat.isActive = false
      if (!combat.result) combat.result = this.calculateResult(combat)
    }
  }

  cleanupFinished(): void {
    for (const [id, combat] of this.activeCombats) {
      if (!combat.isActive) this.activeCombats.delete(id)
    }
  }

  formatForLLM(combatId: string): string {
    const combat = this.activeCombats.get(combatId)
    if (!combat) return '[Combat not found]'

    const attackers = combat.participants.filter(
      (p) => p.side === 'attacker',
    )
    const defenders = combat.participants.filter(
      (p) => p.side === 'defender',
    )

    return (
      `[Combat ${combat.type}] Round ${combat.currentRound}/${combat.maxRounds}. ` +
      `Terrain: ${combat.terrain}. ` +
      `Attackers: ${attackers.map((a) => `${a.name}(HP:${a.hpCurrent}/${a.maxHp})`).join(', ')}. ` +
      `Defenders: ${defenders.map((d) => `${d.name}(HP:${d.hpCurrent}/${d.maxHp})`).join(', ')}.`
    )
  }
}
