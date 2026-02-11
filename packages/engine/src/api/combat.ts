import { Router } from 'express'
import type { WorldEngine } from '../core/world-engine.js'
import { requireAuth } from '../auth/middleware.js'

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

    const combat = world.combat.startCombat(
      agentId,
      agent.stats.attack,
      agent.stats.defense,
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

  return router
}
