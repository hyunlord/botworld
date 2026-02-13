import type { AgentMagicState, SpellDefinition, ActiveCast, ActiveSpellEffect } from '@botworld/shared'
import type { EventBus } from '../core/event-bus.js'
import type { WorldClock } from '@botworld/shared'
import { generateId } from '@botworld/shared'
import { SPELL_DEFINITIONS } from './spell-data.js'

/**
 * MagicSystem manages spell casting, mana, and magical effects for all agents
 */
export class MagicSystem {
  private agentMagicStates = new Map<string, AgentMagicState>()

  constructor(private eventBus: EventBus) {}

  /**
   * Initialize magic state for an agent
   */
  initializeAgent(agentId: string, baseMana: number = 50): AgentMagicState {
    const state: AgentMagicState = {
      agentId,
      maxMana: baseMana,
      currentMana: baseMana,
      activeCasts: [],
      cooldowns: {},
      activeEffects: []
    }

    this.agentMagicStates.set(agentId, state)
    return state
  }

  /**
   * Get agent's magic state
   */
  getMagicState(agentId: string): AgentMagicState | undefined {
    return this.agentMagicStates.get(agentId)
  }

  /**
   * Cast a spell
   */
  castSpell(
    agentId: string,
    spellId: string,
    skillLevel: number,
    targetId?: string,
    targetPos?: { x: number; y: number },
    tick: number = 0
  ): { success: boolean; reason?: string } {
    const state = this.agentMagicStates.get(agentId)
    if (!state) {
      return { success: false, reason: 'Agent not initialized' }
    }

    const spell = SPELL_DEFINITIONS[spellId]
    if (!spell) {
      return { success: false, reason: 'Spell not found' }
    }

    // Check required level
    if (skillLevel < spell.requiredLevel) {
      return {
        success: false,
        reason: `Requires ${spell.school} level ${spell.requiredLevel} (current: ${skillLevel})`
      }
    }

    // Check mana
    if (state.currentMana < spell.manaCost) {
      return {
        success: false,
        reason: `Not enough mana (need ${spell.manaCost}, have ${state.currentMana})`
      }
    }

    // Check cooldown
    const cooldownRemaining = state.cooldowns[spellId] || 0
    if (cooldownRemaining > tick) {
      return {
        success: false,
        reason: `Spell on cooldown (${cooldownRemaining - tick} rounds remaining)`
      }
    }

    // Check if already casting
    if (state.activeCasts.length > 0) {
      return { success: false, reason: 'Already casting a spell' }
    }

    // Check spell failure
    if (this.checkSpellFailure(skillLevel, spell)) {
      state.currentMana -= Math.floor(spell.manaCost / 2) // Half mana cost on failure
      this.eventBus.emit({
        type: 'spell:cast_failed',
        agentId,
        spellId,
        spellName: spell.name,
        reason: 'Spell fizzled',
        manaCost: Math.floor(spell.manaCost / 2),
        timestamp: tick
      })
      return { success: false, reason: 'Spell fizzled' }
    }

    // Deduct mana
    state.currentMana -= spell.manaCost

    // Set cooldown
    state.cooldowns[spellId] = tick + spell.cooldown

    // If instant cast, resolve immediately
    if (spell.castTime === 0) {
      this.resolveSpell(agentId, {
        castId: generateId(),
        agentId,
        spellId,
        targetId,
        targetPos,
        startTick: tick,
        completionTick: tick
      }, tick)
      return { success: true }
    }

    // Add to active casts
    const cast: ActiveCast = {
      castId: generateId(),
      agentId,
      spellId,
      targetId,
      targetPos,
      startTick: tick,
      completionTick: tick + spell.castTime
    }
    state.activeCasts.push(cast)

    this.eventBus.emit({
      type: 'spell:cast_started',
      agentId,
      spellId,
      spellName: spell.name,
      school: spell.school,
      targetId,
      castTime: spell.castTime,
      manaCost: spell.manaCost,
      timestamp: tick
    })

    return { success: true }
  }

  /**
   * Resolve a completed spell cast
   */
  private resolveSpell(agentId: string, cast: ActiveCast, tick: number): void {
    const spell = SPELL_DEFINITIONS[cast.spellId]
    if (!spell) return

    const state = this.agentMagicStates.get(agentId)
    if (!state) return

    const effects: string[] = []

    // Apply spell effects based on type
    switch (spell.type) {
      case 'damage':
        if (spell.damage) {
          effects.push(`${spell.damage} ${spell.element || 'physical'} damage`)
        }
        if (spell.condition && spell.conditionDuration) {
          effects.push(`${spell.condition} for ${spell.conditionDuration} rounds`)
        }
        if (spell.areaOfEffect) {
          effects.push(`AoE radius ${spell.areaOfEffect}`)
        }
        break

      case 'heal':
        if (spell.healing) {
          effects.push(`heals ${spell.healing} HP`)
        }
        if (spell.areaOfEffect) {
          effects.push(`to all allies in radius ${spell.areaOfEffect}`)
        }
        break

      case 'buff':
        if (spell.buffType && spell.buffAmount && spell.duration) {
          effects.push(`+${spell.buffAmount}% ${spell.buffType} for ${spell.duration} rounds`)

          // Add active effect for buff
          const buffEffect: ActiveSpellEffect = {
            effectId: generateId(),
            spellId: spell.id,
            targetId: cast.targetId || agentId,
            type: 'buff',
            value: spell.buffAmount,
            startTick: tick,
            endTick: tick + spell.duration
          }
          state.activeEffects.push(buffEffect)
        }
        if (spell.areaOfEffect) {
          effects.push(`to all allies in radius ${spell.areaOfEffect}`)
        }
        break

      case 'debuff':
        if (spell.debuffType && spell.debuffAmount && spell.duration) {
          effects.push(`-${spell.debuffAmount}% ${spell.debuffType} for ${spell.duration} rounds`)

          // Add active effect for debuff
          const debuffEffect: ActiveSpellEffect = {
            effectId: generateId(),
            spellId: spell.id,
            targetId: cast.targetId || agentId,
            type: 'debuff',
            value: spell.debuffAmount,
            startTick: tick,
            endTick: tick + spell.duration
          }
          state.activeEffects.push(debuffEffect)
        }
        break

      case 'summon':
        if (spell.summonCreature) {
          effects.push(`summons ${spell.summonCreature}`)
        }
        break

      case 'control':
        if (spell.condition && spell.conditionDuration) {
          effects.push(`${spell.condition} for ${spell.conditionDuration} rounds`)
        }
        if (spell.special) {
          effects.push(`special: ${spell.special}`)
        }
        break

      case 'utility':
        if (spell.special) {
          effects.push(`special: ${spell.special}`)
        }
        break
    }

    // Add DoT/HoT effects if duration is set
    if (spell.duration && (spell.damage || spell.healing)) {
      const dotHotEffect: ActiveSpellEffect = {
        effectId: generateId(),
        spellId: spell.id,
        targetId: cast.targetId || agentId,
        type: spell.damage ? 'dot' : 'hot',
        value: spell.damage || spell.healing || 0,
        startTick: tick,
        endTick: tick + spell.duration
      }
      state.activeEffects.push(dotHotEffect)
    }

    this.eventBus.emit({
      type: 'spell:cast_completed',
      agentId,
      spellId: spell.id,
      spellName: spell.name,
      school: spell.school,
      targetId: cast.targetId,
      effects,
      manaCost: spell.manaCost,
      timestamp: tick
    })
  }

  /**
   * Check if a spell fails based on skill level
   */
  private checkSpellFailure(skillLevel: number, spell: SpellDefinition): boolean {
    const levelDiff = skillLevel - spell.requiredLevel
    const failChance = spell.failureChanceBase * Math.max(0, 1 - levelDiff / 50)
    return Math.random() < failChance
  }

  /**
   * Interrupt a casting spell (e.g., when hit in combat)
   */
  interruptCast(agentId: string, tick: number): boolean {
    const state = this.agentMagicStates.get(agentId)
    if (!state || state.activeCasts.length === 0) {
      return false
    }

    const cast = state.activeCasts[0]
    const spell = SPELL_DEFINITIONS[cast.spellId]

    state.activeCasts = []

    this.eventBus.emit({
      type: 'spell:cast_interrupted',
      agentId,
      spellId: cast.spellId,
      spellName: spell?.name || 'Unknown',
      timestamp: tick
    })

    return true
  }

  /**
   * Restore mana (from rest, potion, meditation)
   */
  restoreMana(agentId: string, amount: number, source: string = 'unknown', tick: number = 0): void {
    const state = this.agentMagicStates.get(agentId)
    if (!state) return

    const oldMana = state.currentMana
    state.currentMana = Math.min(state.maxMana, state.currentMana + amount)
    const restored = state.currentMana - oldMana

    if (restored > 0) {
      this.eventBus.emit({
        type: 'mana:restored',
        agentId,
        amount: restored,
        source,
        newMana: state.currentMana,
        maxMana: state.maxMana,
        timestamp: tick
      })
    }
  }

  /**
   * Natural mana regeneration per tick (1-3 mana per tick depending on action)
   */
  regenMana(agentId: string, isResting: boolean, isMeditating: boolean): void {
    const state = this.agentMagicStates.get(agentId)
    if (!state) return

    let regen = 1 // base regen
    if (isResting) regen = 3
    if (isMeditating) regen = 8

    state.currentMana = Math.min(state.maxMana, state.currentMana + regen)
  }

  /**
   * Process active casts, cooldowns, and effects each tick
   */
  tick(clock: WorldClock): void {
    const tick = clock.tick

    for (const [agentId, state] of this.agentMagicStates.entries()) {
      // Process active casts
      const completedCasts: ActiveCast[] = []
      state.activeCasts = state.activeCasts.filter((cast) => {
        if (tick >= cast.completionTick) {
          completedCasts.push(cast)
          return false
        }
        return true
      })

      // Resolve completed casts
      for (const cast of completedCasts) {
        this.resolveSpell(agentId, cast, tick)
      }

      // Process active effects (check for expiration)
      const expiredEffects: ActiveSpellEffect[] = []
      state.activeEffects = state.activeEffects.filter((effect) => {
        if (tick >= effect.endTick) {
          expiredEffects.push(effect)
          return false
        }
        return true
      })

      // Emit expiration events
      for (const effect of expiredEffects) {
        this.eventBus.emit({
          type: 'spell:effect_expired',
          agentId,
          spellId: effect.spellId,
          targetId: effect.targetId,
          timestamp: tick
        })
      }
    }
  }

  /**
   * Get available spells for an agent given their magic skill levels
   */
  getAvailableSpells(skillLevels: Record<string, number>): SpellDefinition[] {
    const available: SpellDefinition[] = []

    for (const spell of Object.values(SPELL_DEFINITIONS)) {
      const skillLevel = skillLevels[spell.school] || 0
      if (skillLevel >= spell.requiredLevel) {
        available.push(spell)
      }
    }

    return available.sort((a, b) => a.requiredLevel - b.requiredLevel)
  }

  /**
   * Format magic state for LLM context
   */
  formatForLLM(agentId: string): string {
    const state = this.agentMagicStates.get(agentId)
    if (!state) {
      return 'Magic state not initialized'
    }

    let output = `**Mana**: ${state.currentMana}/${state.maxMana}\n`

    if (state.activeCasts.length > 0) {
      output += `**Currently Casting**:\n`
      for (const cast of state.activeCasts) {
        const spell = SPELL_DEFINITIONS[cast.spellId]
        const remaining = cast.completionTick - cast.startTick
        output += `  - ${spell?.name || cast.spellId} (${remaining} rounds remaining)\n`
      }
    }

    const activeCooldowns = Object.entries(state.cooldowns)
      .filter(([_, endTick]) => endTick > 0)
      .map(([spellId, endTick]) => {
        const spell = SPELL_DEFINITIONS[spellId]
        return { name: spell?.name || spellId, remaining: endTick }
      })

    if (activeCooldowns.length > 0) {
      output += `**Cooldowns**:\n`
      for (const cd of activeCooldowns) {
        output += `  - ${cd.name} (${cd.remaining} rounds)\n`
      }
    }

    if (state.activeEffects.length > 0) {
      output += `**Active Effects**:\n`
      for (const effect of state.activeEffects) {
        const spell = SPELL_DEFINITIONS[effect.spellId]
        const remaining = effect.endTick - effect.startTick
        output += `  - ${spell?.name || effect.spellId} (${effect.type}, ${remaining} rounds)\n`
      }
    }

    return output.trim()
  }
}
