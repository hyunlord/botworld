import { Router } from 'express'
import type { WorldEngine } from '../core/world-engine.js'
import { requireAuth } from '../auth/middleware.js'
import type { Agent } from '@botworld/shared'

/** Calculate effective attack/defense including equipment bonuses */
function getEffectiveStats(agent: Agent): { attack: number; defense: number } {
  let attack = agent.stats.attack
  let defense = agent.stats.defense

  if (!agent.equipment || !agent.inventory) return { attack, defense }

  const QUALITY_MULTIPLIER: Record<string, number> = {
    crude: 0.7, basic: 1.0, fine: 1.3, masterwork: 1.6, legendary: 2.0,
  }

  for (const [slot, itemId] of Object.entries(agent.equipment)) {
    const item = agent.inventory.find(i => i.id === itemId)
    if (!item?.equipmentStats) continue

    const qualityMult = QUALITY_MULTIPLIER[item.rarity ?? 'common'] ?? 1.0

    if (item.equipmentStats.attack) {
      attack += Math.floor(item.equipmentStats.attack * qualityMult)
    }
    if (item.equipmentStats.defense) {
      defense += Math.floor(item.equipmentStats.defense * qualityMult)
    }
  }

  return { attack, defense }
}

export function createCombatRouter(world: WorldEngine): Router {
  const router = Router()

  /** POST /act/attack - Attack a nearby monster */
  router.post('/act/attack', requireAuth(), (req, res) => {
    const agentId = req.agent!.id
    const { monsterId } = req.body as { monsterId?: string }

    if (!monsterId) {
      return res.status(400).json({ error: 'monsterId is required' })
    }

    const agent = world.agentManager.getAgent(agentId)
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' })
    }

    if (agent.stats.hp <= 0) {
      return res.status(400).json({ error: 'Agent is knocked out' })
    }

    const monster = world.combat.getMonster(monsterId)
    if (!monster || monster.isDead) {
      return res.status(404).json({ error: 'Monster not found or already dead' })
    }

    // Check proximity
    const dx = agent.position.x - monster.position.x
    const dy = agent.position.y - monster.position.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > monster.aggroRadius + 2) {
      return res.status(400).json({ error: 'Monster is too far away' })
    }

    const effectiveStats = getEffectiveStats(agent)
    const combat = world.combat.startCombat(
      agentId,
      effectiveStats.attack,
      effectiveStats.defense,
      agent.stats.hp,
      monsterId,
    )

    if (!combat) {
      return res.status(400).json({ error: 'Cannot start combat (already in combat or monster unavailable)' })
    }

    // Apply damage to agent
    if (combat.outcome === 'defeat') {
      agent.stats.hp = 1 // Knocked out, but not dead (min 1 HP)
    } else if (combat.rounds.length > 0) {
      const lastRound = combat.rounds[combat.rounds.length - 1]
      agent.stats.hp = Math.max(1, lastRound.agentHp)
    }

    // Give loot and XP on victory
    if (combat.outcome === 'victory') {
      for (const item of combat.lootDropped) {
        agent.inventory.push(item)
      }
      const xpGain = monster.level * 15 + Math.floor(Math.random() * 11) + 5
      agent.xp += xpGain
      agent.skills.combat = Math.min(100, agent.skills.combat + 0.5)
    }

    return res.json({
      combat,
      agentHp: agent.stats.hp,
    })
  })

  /** POST /act/flee - Flee from current combat */
  router.post('/act/flee', requireAuth(), (req, res) => {
    const agentId = req.agent!.id

    const result = world.combat.attemptFlee(agentId)
    if (!result.combat) {
      return res.status(400).json({ error: 'Not in combat' })
    }

    return res.json({
      fled: result.success,
      combat: result.combat,
    })
  })

  /** GET /combat/status - Get agent's current combat status */
  router.get('/combat/status', requireAuth(), (req, res) => {
    const agentId = req.agent!.id
    const combat = world.combat.getAgentCombat(agentId)

    return res.json({ inCombat: !!combat, combat })
  })

  /** GET /combat/monsters - Get all alive monsters */
  router.get('/combat/monsters', (_req, res) => {
    const monsters = world.combat.getAliveMonsters()
    return res.json({ monsters })
  })

  /** GET /combat/monsters/near - Get monsters near a position */
  router.get('/combat/monsters/near', (req, res) => {
    const x = Number(req.query.x)
    const y = Number(req.query.y)
    const radius = Number(req.query.radius) || 10

    if (isNaN(x) || isNaN(y)) {
      return res.status(400).json({ error: 'x and y query params required' })
    }

    const monsters = world.combat.getMonstersNear({ x, y }, radius)
    return res.json({ monsters })
  })

  /** POST /combat/advanced/start - Start advanced combat */
  router.post('/combat/advanced/start', requireAuth(), (req, res) => {
    const { attackerIds, defenderIds, formation } = req.body as {
      attackerIds?: string[]
      defenderIds?: string[]
      formation?: string
    }

    if (!attackerIds || !defenderIds || attackerIds.length === 0 || defenderIds.length === 0) {
      return res.status(400).json({ error: 'attackerIds and defenderIds are required' })
    }

    // Create participants from agents
    const attackers: any[] = []
    const defenders: any[] = []

    for (const id of attackerIds) {
      const agent = world.agentManager.getAgent(id)
      if (agent) {
        const effectiveStats = getEffectiveStats(agent)
        const participant = world.advancedCombat.createParticipant({
          id: agent.id,
          name: agent.name,
          side: 'attacker',
          role: 'frontline',
          isCreature: false,
          hp: agent.stats.hp,
          maxHp: agent.stats.maxHp,
          attack: effectiveStats.attack,
          defense: effectiveStats.defense,
          equipment: { items: agent.inventory.map(i => i.name) },
        })
        attackers.push(participant)
      }
    }

    for (const id of defenderIds) {
      const agent = world.agentManager.getAgent(id)
      if (agent) {
        const effectiveStats = getEffectiveStats(agent)
        const participant = world.advancedCombat.createParticipant({
          id: agent.id,
          name: agent.name,
          side: 'defender',
          role: 'frontline',
          isCreature: false,
          hp: agent.stats.hp,
          maxHp: agent.stats.maxHp,
          attack: effectiveStats.attack,
          defense: effectiveStats.defense,
          equipment: { items: agent.inventory.map(i => i.name) },
        })
        defenders.push(participant)
      }
    }

    if (attackers.length === 0 || defenders.length === 0) {
      return res.status(400).json({ error: 'No valid participants found' })
    }

    // Assign roles and apply formation
    world.formationSystem.assignRoles(attackers)
    world.formationSystem.assignRoles(defenders)

    const attackerFormation = (formation as any) || 'line'
    const defenderFormation = 'line'

    const location = attackers[0].position || { x: 0, y: 0 }
    world.formationSystem.positionParticipants(attackers, attackerFormation, 'attacker', location)
    world.formationSystem.positionParticipants(defenders, defenderFormation, 'defender', location)

    // Start combat
    const combat = world.advancedCombat.startCombat(
      'skirmish',
      attackers,
      defenders,
      location,
      'grassland',
      attackerFormation,
      defenderFormation,
    )

    return res.json({ combat })
  })

  /** POST /combat/advanced/:combatId/action - Submit action for a participant */
  router.post('/combat/advanced/:combatId/action', requireAuth(), (req, res) => {
    const combatId = String(req.params.combatId)
    const { participantId, action } = req.body as {
      participantId?: string
      action?: any
    }

    if (!participantId || !action) {
      return res.status(400).json({ error: 'participantId and action are required' })
    }

    const combat = world.advancedCombat.getCombat(combatId)
    if (!combat) {
      return res.status(404).json({ error: 'Combat not found' })
    }

    // Submit action (combat engine tracks pending actions internally)
    // For now, we'll use a simple approach - store in a temp map
    // In a real implementation, you'd track this in the combat engine
    const result = world.advancedCombat.resolveRound(combatId, new Map([[participantId, action]]))

    return res.json({ round: result, combat: world.advancedCombat.getCombat(combatId) })
  })

  /** POST /combat/advanced/:combatId/auto-resolve - Auto-resolve remaining rounds */
  router.post('/combat/advanced/:combatId/auto-resolve', requireAuth(), (req, res) => {
    const combatId = String(req.params.combatId)

    const result = world.advancedCombat.autoResolveCombat(combatId)
    if (!result) {
      return res.status(404).json({ error: 'Combat not found' })
    }

    return res.json({ result })
  })

  /** GET /combat/advanced/:combatId - Get combat state */
  router.get('/combat/advanced/:combatId', requireAuth(), (req, res) => {
    const combatId = String(req.params.combatId)

    const combat = world.advancedCombat.getCombat(combatId)
    if (!combat) {
      return res.status(404).json({ error: 'Combat not found' })
    }

    return res.json({ combat })
  })

  /** GET /combat/advanced/:combatId/ai-context/:participantId - Get AI context */
  router.get('/combat/advanced/:combatId/ai-context/:participantId', requireAuth(), (req, res) => {
    const combatId = String(req.params.combatId)
    const participantId = String(req.params.participantId)

    const context = world.advancedCombat.buildAIContext(combatId, participantId)
    if (!context) {
      return res.status(404).json({ error: 'Combat or participant not found' })
    }

    return res.json({ context })
  })

  /** GET /combat/advanced/active - Get all active advanced combats */
  router.get('/combat/advanced/active', requireAuth(), (_req, res) => {
    const combats = world.advancedCombat.getActiveCombats()
    return res.json({ combats })
  })

  return router
}
