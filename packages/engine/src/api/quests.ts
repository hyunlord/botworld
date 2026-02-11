import { type Router as IRouter, Router, type Request, type Response } from 'express'
import { requireAuth } from '../auth/middleware.js'
import type { WorldEngine } from '../core/world-engine.js'

export function createQuestRouter(world: WorldEngine): IRouter {
  const router = Router()

  // ── GET /quests/available ──
  router.get('/quests/available', requireAuth(), (req: Request, res: Response) => {
    const agent = world.agentManager.getAgent(req.agent!.id)
    const level = agent?.level ?? 1
    const quests = world.questManager.getAvailableQuests(level)

    res.json({
      quests: quests.map(q => ({
        id: q.id,
        type: q.type,
        title: q.title,
        description: q.description,
        difficulty: q.difficulty,
        requiredLevel: q.requiredLevel,
        objectives: q.objectives.map(o => ({
          description: o.description,
          target: o.target,
          required: o.required,
        })),
        rewards: q.rewards,
        timeLimit: q.timeLimit,
        giver: q.giver,
      })),
    })
  })

  // ── POST /quests/:id/accept ──
  router.post('/quests/:id/accept', requireAuth(), (req: Request, res: Response) => {
    const questId = req.params.id as string
    const agentId = req.agent!.id

    const agent = world.agentManager.getAgent(agentId)
    if (!agent) {
      res.status(404).json({ error: 'Agent not found in world' })
      return
    }

    // Check level requirement
    const quests = world.questManager.getAvailableQuests()
    const quest = quests.find(q => q.id === questId)
    if (quest?.requiredLevel && agent.level < quest.requiredLevel) {
      res.status(400).json({
        error: 'Level too low',
        required: quest.requiredLevel,
        current: agent.level,
      })
      return
    }

    const result = world.questManager.acceptQuest(agentId, questId)
    if (!result.success) {
      res.status(400).json({ error: result.error })
      return
    }

    res.json({ success: true, message: `Quest accepted: ${quest?.title ?? questId}` })
  })

  // ── GET /me/quests ──
  router.get('/me/quests', requireAuth(), (req: Request, res: Response) => {
    const agentId = req.agent!.id
    const activeQuests = world.questManager.getAgentQuests(agentId)

    res.json({
      quests: activeQuests.map(aq => ({
        id: aq.quest.id,
        type: aq.quest.type,
        title: aq.quest.title,
        description: aq.quest.description,
        difficulty: aq.quest.difficulty,
        status: aq.status,
        acceptedAt: aq.acceptedAt,
        timeLimit: aq.quest.timeLimit,
        objectives: aq.objectives.map(o => ({
          description: o.description,
          target: o.target,
          required: o.required,
          current: o.current,
          complete: o.current >= o.required,
        })),
        rewards: aq.quest.rewards,
        allObjectivesMet: aq.objectives.every(o => o.current >= o.required),
      })),
    })
  })

  // ── POST /quests/:id/complete ──
  router.post('/quests/:id/complete', requireAuth(), (req: Request, res: Response) => {
    const questId = req.params.id as string
    const agentId = req.agent!.id

    const result = world.questManager.completeQuest(agentId, questId)
    if (!result.success) {
      res.status(400).json({ error: result.error })
      return
    }

    // Apply rewards to agent
    const agent = world.agentManager.getAgent(agentId)
    if (agent && result.rewards) {
      agent.xp += result.rewards.xp
      if (result.rewards.skillPoints) {
        const { skill, amount } = result.rewards.skillPoints
        const sk = skill as keyof typeof agent.skills
        if (sk in agent.skills) {
          agent.skills[sk] = Math.min(100, agent.skills[sk] + amount)
        }
      }
    }

    res.json({
      success: true,
      message: 'Quest completed!',
      rewards: result.rewards,
    })
  })

  return router
}
