import { Router } from 'express'
import type { WorldEngine } from '../core/world-engine.js'
import { requireAuth } from '../auth/middleware.js'
import type { SkillId } from '@botworld/shared'

export function createSkillsRouter(world: WorldEngine): Router {
  const router = Router()

  /** GET /skills/:agentId - Get all skills for an agent */
  router.get('/skills/:agentId', (req, res) => {
    const agentId = req.params.agentId as string
    const skills = world.skillManager.getAgentSkills(agentId)
    const archetype = world.skillManager.getArchetype(agentId)
    const combos = world.skillManager.getDiscoveredCombos(agentId)
    res.json({ agentId, archetype, skills, combos })
  })

  /** GET /skills/:agentId/:skillId - Get specific skill */
  router.get('/skills/:agentId/:skillId', (req, res) => {
    const agentId = req.params.agentId as string
    const skillId = req.params.skillId as string as SkillId
    const skill = world.skillManager.getSkill(agentId, skillId)
    if (!skill) return res.status(404).json({ error: 'Skill not found' })
    res.json({ skill })
  })

  /** POST /skills/train - Award XP via action (called by game systems) */
  router.post('/skills/train', requireAuth(), (req, res) => {
    const agentId = req.agent!.id
    const { skillId, tierMultiplier, method } = req.body as {
      skillId: string
      tierMultiplier?: number
      method?: string
    }
    const result = world.skillManager.awardXP(
      agentId,
      skillId as SkillId,
      tierMultiplier ?? 1,
      (method as any) ?? 'practice',
      world.clock.tick
    )
    res.json(result)
  })

  /** POST /skills/teach - NPC teaches agent */
  router.post('/skills/teach', requireAuth(), (req, res) => {
    const studentId = req.agent!.id
    const { teacherId, skillId } = req.body as { teacherId: string; skillId: string }
    // Get teacher's skill level (could be NPC or agent)
    const teacherLevel = world.skillManager.getSkillLevel(teacherId, skillId as SkillId)
    const result = world.skillManager.teachSkill(
      teacherId,
      studentId,
      skillId as SkillId,
      teacherLevel,
      world.clock.tick
    )
    res.json(result)
  })

  /** POST /skills/use-book - Use a skill book */
  router.post('/skills/use-book', requireAuth(), (req, res) => {
    const agentId = req.agent!.id
    const { skillId, bookTier } = req.body as { skillId: string; bookTier: number }
    const result = world.skillManager.useSkillBook(
      agentId,
      skillId as SkillId,
      bookTier ?? 1,
      world.clock.tick
    )
    res.json(result)
  })

  /** POST /skills/academy - Train at academy */
  router.post('/skills/academy', requireAuth(), (req, res) => {
    const agentId = req.agent!.id
    const { skillId, academyLevel } = req.body as { skillId: string; academyLevel: number }
    const result = world.skillManager.academyTrain(
      agentId,
      skillId as SkillId,
      academyLevel ?? 1,
      world.clock.tick
    )
    res.json(result)
  })

  /** GET /skills/search/:skillId - Find agents with specific skill */
  router.get('/skills/search/:skillId', (req, res) => {
    const skillId = req.params.skillId as string as SkillId
    const minLevel = Number(req.query.minLevel) || 1
    const agents = world.skillManager.getAgentsBySkill(skillId, minLevel)
    res.json({ skillId, minLevel, agents })
  })

  // ── Magic endpoints ──

  /** GET /magic/:agentId - Get agent's magic state */
  router.get('/magic/:agentId', (req, res) => {
    const agentId = req.params.agentId as string
    const state = world.magicSystem.getMagicState(agentId)
    if (!state) return res.status(404).json({ error: 'No magic state found' })
    res.json({ agentId, magic: state })
  })

  /** POST /magic/cast - Cast a spell */
  router.post('/magic/cast', requireAuth(), (req, res) => {
    const agentId = req.agent!.id
    const { spellId, targetId, targetPosition } = req.body as {
      spellId: string
      targetId?: string
      targetPosition?: { x: number; y: number }
    }
    // Determine skill level for the spell's school
    const { SPELL_DEFINITIONS } = require('../skills/spell-data.js')
    const spell = SPELL_DEFINITIONS[spellId]
    if (!spell) return res.status(400).json({ error: 'Unknown spell' })
    const skillLevel = world.skillManager.getSkillLevel(agentId, spell.school as SkillId)
    const result = world.magicSystem.castSpell(
      agentId,
      spellId,
      skillLevel,
      targetId,
      targetPosition,
      world.clock.tick
    )
    res.json(result)
  })

  /** GET /magic/:agentId/spells - Get available spells */
  router.get('/magic/:agentId/spells', (req, res) => {
    const agentId = req.params.agentId as string
    // Gather magic skill levels
    const magicSchools = ['fire', 'ice', 'heal', 'summon', 'arcane', 'dark'] as const
    const skillLevels: Record<string, number> = {}
    for (const school of magicSchools) {
      skillLevels[school] = world.skillManager.getSkillLevel(agentId, school as SkillId)
    }
    const spells = world.magicSystem.getAvailableSpells(skillLevels)
    res.json({ agentId, spells })
  })

  /** POST /magic/restore-mana - Restore mana (potion, rest, meditation) */
  router.post('/magic/restore-mana', requireAuth(), (req, res) => {
    const agentId = req.agent!.id
    const { amount, source } = req.body as { amount: number; source?: string }
    world.magicSystem.restoreMana(agentId, amount, source ?? 'potion', world.clock.tick)
    res.json({ success: true })
  })

  return router
}
