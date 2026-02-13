import type { SkillId, AgentSkillState, SkillCombo, LearningMethod } from '@botworld/shared'
import type { EventBus } from '../core/event-bus.js'
import { SKILL_DEFINITIONS, SKILL_COMBOS, SKILL_CATEGORIES } from './skill-data.js'

export class SkillManager {
  // agentId -> skillId -> AgentSkillState
  private agentSkills = new Map<string, Map<string, AgentSkillState>>()
  // agentId -> set of discovered combo IDs
  private discoveredCombos = new Map<string, Set<string>>()

  constructor(private eventBus: EventBus) {}

  /** Initialize all skills for an agent at level 0 */
  initializeAgent(agentId: string): void {
    const skills = new Map<string, AgentSkillState>()
    for (const [skillId, def] of Object.entries(SKILL_DEFINITIONS)) {
      skills.set(skillId, {
        skillId: skillId as SkillId,
        level: 0,
        xp: 0,
        xpToNext: 10, // level 0: 0*0*10 = 0, so use 10 as minimum
        unlockedAbilities: [],
      })
    }
    this.agentSkills.set(agentId, skills)
    this.discoveredCombos.set(agentId, new Set())
  }

  /** Get all skills for an agent */
  getAgentSkills(agentId: string): AgentSkillState[] {
    const skills = this.agentSkills.get(agentId)
    if (!skills) return []
    return Array.from(skills.values())
  }

  /** Get a specific skill state */
  getSkill(agentId: string, skillId: SkillId): AgentSkillState | undefined {
    return this.agentSkills.get(agentId)?.get(skillId)
  }

  /** Get skill level (convenience) */
  getSkillLevel(agentId: string, skillId: SkillId): number {
    return this.getSkill(agentId, skillId)?.level ?? 0
  }

  /** Award XP to a skill from an action
   *  - Calculates XP based on skill definition's xpPerAction range
   *  - tierMultiplier: higher tier actions give more XP (e.g., fighting stronger enemies)
   *  - methodMultiplier: apprenticeship = 1.5, academy = 1.3, normal = 1.0
   *  Returns: { xpGained, leveledUp, newLevel, abilityUnlocked }
   */
  awardXP(agentId: string, skillId: SkillId, tierMultiplier: number = 1, method: LearningMethod = 'practice', tick: number = 0): {
    xpGained: number; leveledUp: boolean; newLevel: number; abilityUnlocked?: string
  } {
    // Get or initialize skill state
    let skills = this.agentSkills.get(agentId)
    if (!skills) {
      this.initializeAgent(agentId)
      skills = this.agentSkills.get(agentId)!
    }
    let state = skills.get(skillId)
    if (!state) {
      state = { skillId, level: 0, xp: 0, xpToNext: 10, unlockedAbilities: [] }
      skills.set(skillId, state)
    }

    if (state.level >= 100) return { xpGained: 0, leveledUp: false, newLevel: 100 }

    const def = SKILL_DEFINITIONS[skillId]
    if (!def) return { xpGained: 0, leveledUp: false, newLevel: state.level }

    // Calculate XP
    const [minXP, maxXP] = def.xpPerAction
    const baseXP = minXP + Math.floor(Math.random() * (maxXP - minXP + 1))
    const methodMultiplier = method === 'apprenticeship' ? 1.5 : method === 'academy' ? 1.3 : method === 'npc_teaching' ? 2.0 : method === 'skill_book' ? 1.0 : 1.0
    const xpGained = Math.floor(baseXP * tierMultiplier * methodMultiplier)

    state.xp += xpGained

    // Check level up
    let leveledUp = false
    let abilityUnlocked: string | undefined
    while (state.xp >= state.xpToNext && state.level < 100) {
      state.xp -= state.xpToNext
      state.level++
      state.xpToNext = Math.max(10, state.level * state.level * 10)
      leveledUp = true

      // Check for ability unlocks at this level
      const newAbility = def.abilities.find(a => a.requiredLevel === state!.level && !state!.unlockedAbilities.includes(a.id))
      if (newAbility) {
        state.unlockedAbilities.push(newAbility.id)
        abilityUnlocked = newAbility.id

        this.eventBus.emit({
          type: 'skill:ability_unlocked',
          agentId,
          skillId,
          skillName: def.name,
          abilityId: newAbility.id,
          abilityName: newAbility.name,
          level: state.level,
          timestamp: tick,
        })
      }
    }

    // Emit XP gain event
    this.eventBus.emit({
      type: 'skill:xp_gained',
      agentId,
      skillId,
      skillName: def.name,
      xpGained,
      method,
      newLevel: state.level,
      leveledUp,
      timestamp: tick,
    })

    if (leveledUp) {
      this.eventBus.emit({
        type: 'skill:level_up',
        agentId,
        skillId,
        skillName: def.name,
        newLevel: state.level,
        timestamp: tick,
      })

      // Check for newly unlocked combos
      this.checkCombos(agentId, tick)
    }

    return { xpGained, leveledUp, newLevel: state.level, abilityUnlocked }
  }

  /** Direct XP award (for skill books, NPC teaching, etc.) */
  awardDirectXP(agentId: string, skillId: SkillId, xpAmount: number, method: LearningMethod, tick: number = 0): {
    xpGained: number; leveledUp: boolean; newLevel: number; abilityUnlocked?: string
  } {
    // Similar to awardXP but with fixed amount instead of random
    // Initialize if needed, add XP, check level ups, emit events
    let skills = this.agentSkills.get(agentId)
    if (!skills) {
      this.initializeAgent(agentId)
      skills = this.agentSkills.get(agentId)!
    }
    let state = skills.get(skillId)
    if (!state) {
      state = { skillId, level: 0, xp: 0, xpToNext: 10, unlockedAbilities: [] }
      skills.set(skillId, state)
    }

    if (state.level >= 100) return { xpGained: 0, leveledUp: false, newLevel: 100 }

    const def = SKILL_DEFINITIONS[skillId]
    if (!def) return { xpGained: 0, leveledUp: false, newLevel: state.level }

    state.xp += xpAmount
    let leveledUp = false
    let abilityUnlocked: string | undefined

    while (state.xp >= state.xpToNext && state.level < 100) {
      state.xp -= state.xpToNext
      state.level++
      state.xpToNext = Math.max(10, state.level * state.level * 10)
      leveledUp = true

      const newAbility = def.abilities.find(a => a.requiredLevel === state!.level && !state!.unlockedAbilities.includes(a.id))
      if (newAbility) {
        state.unlockedAbilities.push(newAbility.id)
        abilityUnlocked = newAbility.id
        this.eventBus.emit({
          type: 'skill:ability_unlocked',
          agentId, skillId, skillName: def.name,
          abilityId: newAbility.id, abilityName: newAbility.name,
          level: state.level, timestamp: tick,
        })
      }
    }

    this.eventBus.emit({
      type: 'skill:xp_gained',
      agentId, skillId, skillName: def.name,
      xpGained: xpAmount, method, newLevel: state.level, leveledUp, timestamp: tick,
    })

    if (leveledUp) {
      this.eventBus.emit({
        type: 'skill:level_up',
        agentId, skillId, skillName: def.name, newLevel: state.level, timestamp: tick,
      })
      this.checkCombos(agentId, tick)
    }

    return { xpGained: xpAmount, leveledUp, newLevel: state.level, abilityUnlocked }
  }

  /** NPC Teaching: NPC with skill >= 50 teaches agent, big XP boost */
  teachSkill(teacherId: string, studentId: string, skillId: SkillId, teacherSkillLevel: number, tick: number): {
    success: boolean; xpGained?: number; reason?: string
  } {
    if (teacherSkillLevel < 50) return { success: false, reason: 'Teacher skill too low (need 50+)' }

    // XP = teacherLevel * 5 (so a Lv100 teacher gives 500 XP)
    const xpAmount = teacherSkillLevel * 5
    const result = this.awardDirectXP(studentId, skillId, xpAmount, 'npc_teaching', tick)

    this.eventBus.emit({
      type: 'skill:taught',
      teacherId, studentId, skillId,
      xpGained: result.xpGained,
      newLevel: result.newLevel,
      timestamp: tick,
    })

    return { success: true, xpGained: result.xpGained }
  }

  /** Use a skill book: instant XP 50-200 */
  useSkillBook(agentId: string, skillId: SkillId, bookTier: number, tick: number): {
    xpGained: number; leveledUp: boolean; newLevel: number
  } {
    const xpAmount = 50 + bookTier * 50 // tier 1=100, tier 2=150, tier 3=200
    return this.awardDirectXP(agentId, skillId, xpAmount, 'skill_book', tick)
  }

  /** Academy training: daily XP for gold cost */
  academyTrain(agentId: string, skillId: SkillId, academyLevel: number, tick: number): {
    xpGained: number; goldCost: number; leveledUp: boolean; newLevel: number
  } {
    const goldCost = academyLevel * 10
    const xpAmount = 20 + academyLevel * 15
    const result = this.awardDirectXP(agentId, skillId, xpAmount, 'academy', tick)
    return { ...result, goldCost }
  }

  /** Check and discover skill combos for an agent */
  private checkCombos(agentId: string, tick: number): void {
    const skills = this.agentSkills.get(agentId)
    const discovered = this.discoveredCombos.get(agentId)
    if (!skills || !discovered) return

    for (const combo of SKILL_COMBOS) {
      if (discovered.has(combo.id)) continue

      const skill1Level = skills.get(combo.skill1)?.level ?? 0
      const skill2Level = skills.get(combo.skill2)?.level ?? 0

      if (skill1Level >= combo.skill1MinLevel && skill2Level >= combo.skill2MinLevel) {
        discovered.add(combo.id)
        this.eventBus.emit({
          type: 'skill:combo_discovered',
          agentId,
          comboId: combo.id,
          comboName: combo.name,
          skill1: combo.skill1,
          skill2: combo.skill2,
          abilityName: combo.ability.name,
          timestamp: tick,
        })
      }
    }
  }

  /** Get discovered combos for an agent */
  getDiscoveredCombos(agentId: string): SkillCombo[] {
    const discovered = this.discoveredCombos.get(agentId)
    if (!discovered) return []
    return SKILL_COMBOS.filter(c => discovered.has(c.id))
  }

  /** Check if agent has a specific ability (from skills or combos) */
  hasAbility(agentId: string, abilityId: string): boolean {
    const skills = this.agentSkills.get(agentId)
    if (!skills) return false
    for (const state of skills.values()) {
      if (state.unlockedAbilities.includes(abilityId)) return true
    }
    // Check combo abilities
    const combos = this.getDiscoveredCombos(agentId)
    return combos.some(c => c.ability.id === abilityId)
  }

  /** Get agent's dominant archetype based on highest skills */
  getArchetype(agentId: string): string {
    const skills = this.agentSkills.get(agentId)
    if (!skills) return 'novice'

    // Find highest skill per category
    const categoryMaxes: Record<string, number> = {}
    for (const [cat, skillIds] of Object.entries(SKILL_CATEGORIES)) {
      categoryMaxes[cat] = Math.max(...skillIds.map(sid => skills.get(sid)?.level ?? 0))
    }

    // Simple archetype detection
    const highest = Object.entries(categoryMaxes).sort((a, b) => b[1] - a[1])
    const [topCat, topLevel] = highest[0]!
    if (topLevel < 10) return 'novice'

    // Find the actual top skill
    const topSkillIds = SKILL_CATEGORIES[topCat as keyof typeof SKILL_CATEGORIES] ?? []
    let topSkillId = topSkillIds[0] ?? topCat
    let topSkillLevel = 0
    for (const sid of topSkillIds) {
      const lvl = skills.get(sid)?.level ?? 0
      if (lvl > topSkillLevel) { topSkillLevel = lvl; topSkillId = sid }
    }

    // Map top skill to archetype
    const archetypeMap: Record<string, string> = {
      melee: 'warrior', ranged: 'ranger', defense: 'guardian', tactics: 'strategist',
      smithing: 'blacksmith', woodworking: 'carpenter', alchemy: 'alchemist',
      cooking: 'chef', enchanting: 'enchanter', tailoring: 'tailor',
      fire: 'pyromancer', ice: 'cryomancer', heal: 'healer', summon: 'summoner',
      arcane: 'arcanist', dark: 'necromancer',
      charisma: 'diplomat', deception: 'spy', leadership: 'leader',
      trading: 'merchant', lore: 'scholar',
      gathering: 'gatherer', hunting: 'hunter', stealth: 'assassin',
      navigation: 'explorer', farming: 'farmer',
    }
    return archetypeMap[topSkillId] ?? 'adventurer'
  }

  /** Format skills for LLM context */
  formatForLLM(agentId: string): string {
    const skills = this.getAgentSkills(agentId)
    if (skills.length === 0) return '[Skills] None'

    const nonZero = skills.filter(s => s.level > 0).sort((a, b) => b.level - a.level)
    if (nonZero.length === 0) return '[Skills] All at level 0 (untrained)'

    const archetype = this.getArchetype(agentId)
    const lines = nonZero.slice(0, 10).map(s => {
      const def = SKILL_DEFINITIONS[s.skillId]
      return `${def?.name ?? s.skillId} Lv${s.level} (${s.xp}/${s.xpToNext} XP)`
    })

    const combos = this.getDiscoveredCombos(agentId)
    const comboStr = combos.length > 0 ? `\nCombos: ${combos.map(c => c.name).join(', ')}` : ''

    return `[Skills] Archetype: ${archetype}. ${lines.join(', ')}${comboStr}`
  }

  // Queries
  getAgentsBySkill(skillId: SkillId, minLevel: number): string[] {
    const result: string[] = []
    for (const [agentId, skills] of this.agentSkills) {
      const state = skills.get(skillId)
      if (state && state.level >= minLevel) result.push(agentId)
    }
    return result
  }
}
