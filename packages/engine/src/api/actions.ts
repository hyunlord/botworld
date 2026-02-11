import { type Router as IRouter, Router, type Request, type Response, type NextFunction } from 'express'
import type { ActionType, Position } from '@botworld/shared'
import { ENERGY_COST, REST_ENERGY_REGEN } from '@botworld/shared'
import { requireAuth } from '../auth/middleware.js'
import { contentFilter } from '../security/content-filter.js'
import { findPath } from '../world/pathfinding.js'
import { pool } from '../db/connection.js'
import type { WorldEngine } from '../core/world-engine.js'
import type { ChatRelay } from '../systems/chat-relay.js'

// ──────────────────────────────────────────────
// Cooldown system
// ──────────────────────────────────────────────

export const COOLDOWN_TICKS: Partial<Record<ActionType, number>> = {
  gather: 5,
  craft: 10,
  speak: 3,
  trade: 5,
  explore: 5,
}

/** agentId → (actionType → nextAvailableTick) */
const actionCooldowns = new Map<string, Map<ActionType, number>>()

export function getCooldown(agentId: string, actionType: ActionType): number {
  return actionCooldowns.get(agentId)?.get(actionType) ?? 0
}

export function setCooldown(agentId: string, actionType: ActionType, tick: number): void {
  let agentMap = actionCooldowns.get(agentId)
  if (!agentMap) {
    agentMap = new Map()
    actionCooldowns.set(agentId, agentMap)
  }
  const cd = COOLDOWN_TICKS[actionType]
  if (cd) {
    agentMap.set(actionType, tick + cd)
  }
}

// ──────────────────────────────────────────────
// Trade proposal system
// ──────────────────────────────────────────────

interface TradeProposal {
  id: string
  fromAgentId: string
  toAgentId: string
  offerItemId: string
  requestItemId: string
  createdAt: number
  expiresAt: number
}

class TradeManager {
  private proposals = new Map<string, TradeProposal>()
  private counter = 0

  createProposal(from: string, to: string, offerItemId: string, requestItemId: string): string {
    const id = `trade_${this.counter++}_${Date.now()}`
    this.proposals.set(id, {
      id,
      fromAgentId: from,
      toAgentId: to,
      offerItemId,
      requestItemId,
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    })
    return id
  }

  getProposal(id: string): TradeProposal | undefined {
    const p = this.proposals.get(id)
    if (p && Date.now() > p.expiresAt) {
      this.proposals.delete(id)
      return undefined
    }
    return p
  }

  removeProposal(id: string): void {
    this.proposals.delete(id)
  }

  cleanExpired(): void {
    const now = Date.now()
    for (const [id, p] of this.proposals) {
      if (now > p.expiresAt) {
        this.proposals.delete(id)
      }
    }
  }
}

// ──────────────────────────────────────────────
// Middleware helpers
// ──────────────────────────────────────────────

function requireCharacter() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const agentId = req.agent!.id
    const result = await pool.query<{ character_data: Record<string, unknown> | null }>(
      'SELECT character_data FROM agents WHERE id = $1',
      [agentId],
    )
    if (!result.rows[0]?.character_data?.creation) {
      res.status(403).json({ error: 'Character not created. Use POST /api/characters/create first.' })
      return
    }
    next()
  }
}

function requireEnergy(actionType: ActionType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const world = req.app.get('world') as WorldEngine
    const agent = world.agentManager.getAgent(req.agent!.id)
    if (!agent) {
      res.status(404).json({ error: 'Agent not found in world' })
      return
    }
    const cost = ENERGY_COST[actionType] ?? 0
    if (agent.stats.energy < cost) {
      res.status(400).json({
        error: 'Not enough energy',
        required: cost,
        current: agent.stats.energy,
      })
      return
    }
    next()
  }
}

function requireNoCooldown(actionType: ActionType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const world = req.app.get('world') as WorldEngine
    const tick = world.clock.tick
    const cd = getCooldown(req.agent!.id, actionType)
    if (tick < cd) {
      res.status(429).json({
        error: 'Action on cooldown',
        action: actionType,
        available_at_tick: cd,
        current_tick: tick,
        remaining_ticks: cd - tick,
      })
      return
    }
    next()
  }
}

// ──────────────────────────────────────────────
// Router factory
// ──────────────────────────────────────────────

export function createActionRouter(world: WorldEngine, chatRelay: ChatRelay): IRouter {
  const router = Router()
  const tradeManager = new TradeManager()

  // Clean expired proposals periodically
  setInterval(() => tradeManager.cleanExpired(), 30_000).unref()

  // ── POST /actions/move ──
  router.post('/actions/move',
    requireAuth(), requireCharacter(), requireEnergy('move'), requireNoCooldown('move'),
    async (req: Request, res: Response) => {
      const { x, y } = req.body
      if (typeof x !== 'number' || typeof y !== 'number' || !Number.isInteger(x) || !Number.isInteger(y)) {
        res.status(400).json({ error: 'x and y must be integers' })
        return
      }

      const agent = world.agentManager.getAgent(req.agent!.id)!
      if (agent.position.x === x && agent.position.y === y) {
        res.status(400).json({ error: 'Already at that position' })
        return
      }

      if (!world.tileMap.isWalkable(x, y)) {
        res.status(400).json({ error: 'Target position is not walkable' })
        return
      }

      const path = findPath(world.tileMap, agent.position, { x, y })
      if (path.length === 0) {
        res.status(400).json({ error: 'No path found to target position' })
        return
      }

      const duration = Math.max(path.length * 2, 2)
      const result = world.agentManager.enqueueAction(req.agent!.id, {
        type: 'move',
        targetPosition: { x, y },
        startedAt: world.clock.tick,
        duration,
      })

      if (!result.success) {
        res.status(409).json({ error: result.error })
        return
      }

      setCooldown(req.agent!.id, 'move', world.clock.tick)
      res.json({
        action: 'move',
        path,
        estimatedTicks: duration,
        energyCost: ENERGY_COST.move,
      })
    },
  )

  // ── POST /actions/gather ──
  router.post('/actions/gather',
    requireAuth(), requireCharacter(), requireEnergy('gather'), requireNoCooldown('gather'),
    async (req: Request, res: Response) => {
      const agent = world.agentManager.getAgent(req.agent!.id)!
      const tile = world.tileMap.getTile(agent.position.x, agent.position.y)

      if (!tile?.resource || tile.resource.amount < 1) {
        res.status(400).json({ error: 'No resource at current position' })
        return
      }

      const result = world.agentManager.enqueueAction(req.agent!.id, {
        type: 'gather',
        targetPosition: agent.position,
        startedAt: world.clock.tick,
        duration: 10,
      })

      if (!result.success) {
        res.status(409).json({ error: result.error })
        return
      }

      setCooldown(req.agent!.id, 'gather', world.clock.tick)
      res.json({
        action: 'gather',
        position: agent.position,
        estimatedTicks: 10,
        energyCost: ENERGY_COST.gather,
      })
    },
  )

  // ── POST /actions/craft ──
  router.post('/actions/craft',
    requireAuth(), requireCharacter(), requireEnergy('craft'), requireNoCooldown('craft'),
    async (req: Request, res: Response) => {
      const { materialIds } = req.body
      if (!Array.isArray(materialIds) || materialIds.length !== 2) {
        res.status(400).json({ error: 'materialIds must be an array of exactly 2 item IDs' })
        return
      }

      const agent = world.agentManager.getAgent(req.agent!.id)!
      const mat1 = agent.inventory.find(i => i.id === materialIds[0])
      const mat2 = agent.inventory.find(i => i.id === materialIds[1])

      if (!mat1 || mat1.quantity <= 0) {
        res.status(400).json({ error: `Material ${materialIds[0]} not found or depleted` })
        return
      }
      if (!mat2 || mat2.quantity <= 0) {
        res.status(400).json({ error: `Material ${materialIds[1]} not found or depleted` })
        return
      }

      const result = world.agentManager.enqueueAction(req.agent!.id, {
        type: 'craft',
        data: { materialIds },
        startedAt: world.clock.tick,
        duration: 15,
      })

      if (!result.success) {
        res.status(409).json({ error: result.error })
        return
      }

      setCooldown(req.agent!.id, 'craft', world.clock.tick)
      res.json({
        action: 'craft',
        materials: [mat1.name, mat2.name],
        estimatedTicks: 15,
        energyCost: ENERGY_COST.craft,
      })
    },
  )

  // ── POST /actions/speak ──
  router.post('/actions/speak',
    requireAuth(), requireCharacter(), requireEnergy('speak'), requireNoCooldown('speak'),
    async (req: Request, res: Response) => {
      const { message, targetAgentId } = req.body

      if (!message || typeof message !== 'string' || message.length < 1 || message.length > 200) {
        res.status(400).json({ error: 'message must be 1-200 characters' })
        return
      }

      const result = await chatRelay.handleSpeak(req.agent!.id, message, targetAgentId)

      if (!result.allowed) {
        res.status(403).json({
          error: 'MESSAGE_BLOCKED_SECURITY',
          warning: result.reason,
          violation_count: contentFilter.getViolationCount(req.agent!.id),
        })
        return
      }

      // Deduct energy
      const agent = world.agentManager.getAgent(req.agent!.id)!
      agent.stats.energy = Math.max(0, agent.stats.energy - (ENERGY_COST.speak ?? 1))

      setCooldown(req.agent!.id, 'speak', world.clock.tick)
      res.json({
        action: 'speak',
        message,
        recipientCount: result.recipientCount,
      })
    },
  )

  // ── POST /actions/whisper ──
  router.post('/actions/whisper',
    requireAuth(), requireCharacter(), requireEnergy('speak'), requireNoCooldown('speak'),
    async (req: Request, res: Response) => {
      const { targetAgentId, message } = req.body

      if (!targetAgentId || typeof targetAgentId !== 'string') {
        res.status(400).json({ error: 'targetAgentId is required' })
        return
      }

      if (!message || typeof message !== 'string' || message.length < 1 || message.length > 200) {
        res.status(400).json({ error: 'message must be 1-200 characters' })
        return
      }

      const result = await chatRelay.handleWhisper(req.agent!.id, targetAgentId, message)

      if (!result.allowed) {
        if (result.reason?.includes('not found')) {
          res.status(404).json({ error: result.reason })
        } else if (result.reason?.includes('too far')) {
          res.status(400).json({ error: result.reason })
        } else {
          res.status(403).json({
            error: 'MESSAGE_BLOCKED_SECURITY',
            warning: result.reason,
            violation_count: contentFilter.getViolationCount(req.agent!.id),
          })
        }
        return
      }

      // Deduct energy
      const agent = world.agentManager.getAgent(req.agent!.id)!
      agent.stats.energy = Math.max(0, agent.stats.energy - (ENERGY_COST.speak ?? 1))

      setCooldown(req.agent!.id, 'speak', world.clock.tick)
      res.json({
        action: 'whisper',
        targetAgentId,
        message,
        recipientCount: result.recipientCount,
      })
    },
  )

  // ── POST /actions/trade/propose ──
  router.post('/actions/trade/propose',
    requireAuth(), requireCharacter(), requireEnergy('trade'), requireNoCooldown('trade'),
    async (req: Request, res: Response) => {
      const { targetAgentId, offerItemId, requestItemId } = req.body

      if (!targetAgentId || !offerItemId || !requestItemId) {
        res.status(400).json({ error: 'targetAgentId, offerItemId, and requestItemId are required' })
        return
      }

      const agent = world.agentManager.getAgent(req.agent!.id)!
      const target = world.agentManager.getAgent(targetAgentId)

      if (!target) {
        res.status(404).json({ error: 'Target agent not found' })
        return
      }

      // Proximity check
      const dist = Math.abs(agent.position.x - target.position.x) + Math.abs(agent.position.y - target.position.y)
      if (dist > 2) {
        res.status(400).json({ error: 'Target agent is too far away (max distance: 2)' })
        return
      }

      // Verify items
      const offerItem = agent.inventory.find(i => i.id === offerItemId)
      if (!offerItem || offerItem.quantity <= 0) {
        res.status(400).json({ error: 'Offer item not found in your inventory' })
        return
      }

      const requestItem = target.inventory.find(i => i.id === requestItemId)
      if (!requestItem || requestItem.quantity <= 0) {
        res.status(400).json({ error: 'Request item not found in target inventory' })
        return
      }

      const proposalId = tradeManager.createProposal(agent.id, targetAgentId, offerItemId, requestItemId)

      world.eventBus.emit({
        type: 'trade:proposed',
        proposalId,
        fromAgentId: agent.id,
        toAgentId: targetAgentId,
        offerItemId,
        requestItemId,
        timestamp: world.clock.tick,
      })

      setCooldown(req.agent!.id, 'trade', world.clock.tick)
      res.json({
        proposalId,
        expiresIn: 60,
      })
    },
  )

  // ── POST /actions/trade/respond ──
  router.post('/actions/trade/respond',
    requireAuth(), requireCharacter(),
    async (req: Request, res: Response) => {
      const { proposalId, accept } = req.body

      if (!proposalId || typeof accept !== 'boolean') {
        res.status(400).json({ error: 'proposalId and accept (boolean) are required' })
        return
      }

      const proposal = tradeManager.getProposal(proposalId)
      if (!proposal) {
        res.status(404).json({ error: 'Trade proposal not found or expired' })
        return
      }

      if (proposal.toAgentId !== req.agent!.id) {
        res.status(403).json({ error: 'You are not the recipient of this trade proposal' })
        return
      }

      tradeManager.removeProposal(proposalId)

      if (!accept) {
        res.json({ proposalId, accepted: false })
        return
      }

      // Execute trade
      const tradeResult = world.agentManager.executeTrade(
        proposal.fromAgentId,
        proposal.toAgentId,
        proposal.offerItemId,
        proposal.requestItemId,
      )

      if (!tradeResult.success) {
        res.status(400).json({ error: tradeResult.error })
        return
      }

      res.json({
        proposalId,
        accepted: true,
        trade: { gave: tradeResult.received, received: tradeResult.gave },
      })
    },
  )

  // ── POST /actions/rest ──
  router.post('/actions/rest',
    requireAuth(), requireCharacter(),
    async (req: Request, res: Response) => {
      const duration = Math.max(10, Math.min(120, req.body.duration ?? 30))
      const agent = world.agentManager.getAgent(req.agent!.id)!

      const result = world.agentManager.enqueueAction(req.agent!.id, {
        type: 'rest',
        startedAt: world.clock.tick,
        duration,
      })

      if (!result.success) {
        res.status(409).json({ error: result.error })
        return
      }

      res.json({
        action: 'rest',
        duration,
        currentEnergy: agent.stats.energy,
        estimatedEnergyGain: duration * REST_ENERGY_REGEN,
      })
    },
  )

  // ── POST /actions/eat ──
  router.post('/actions/eat',
    requireAuth(), requireCharacter(),
    async (req: Request, res: Response) => {
      const { itemId } = req.body
      if (!itemId || typeof itemId !== 'string') {
        res.status(400).json({ error: 'itemId is required' })
        return
      }

      const agent = world.agentManager.getAgent(req.agent!.id)!
      const food = agent.inventory.find(i => i.id === itemId)
      if (!food || food.quantity <= 0) {
        res.status(400).json({ error: 'Item not found in inventory' })
        return
      }

      if (food.type !== 'food') {
        res.status(400).json({ error: 'Item is not food' })
        return
      }

      const result = world.agentManager.enqueueAction(req.agent!.id, {
        type: 'eat',
        targetItemId: itemId,
        startedAt: world.clock.tick,
        duration: 3,
      })

      if (!result.success) {
        res.status(409).json({ error: result.error })
        return
      }

      res.json({
        action: 'eat',
        item: food.name,
        hungerRestored: 30,
        estimatedTicks: 3,
      })
    },
  )

  // ── POST /actions/explore ──
  router.post('/actions/explore',
    requireAuth(), requireCharacter(), requireEnergy('explore'), requireNoCooldown('explore'),
    async (req: Request, res: Response) => {
      const { direction } = req.body
      const agent = world.agentManager.getAgent(req.agent!.id)!

      // Calculate target position based on direction
      const radius = 8 + Math.floor(Math.random() * 12)
      let dx = 0
      let dy = 0

      if (direction) {
        const dirMap: Record<string, { dx: number; dy: number }> = {
          n:  { dx: 0, dy: -1 },
          s:  { dx: 0, dy: 1 },
          e:  { dx: 1, dy: 0 },
          w:  { dx: -1, dy: 0 },
          ne: { dx: 1, dy: -1 },
          nw: { dx: -1, dy: -1 },
          se: { dx: 1, dy: 1 },
          sw: { dx: -1, dy: 1 },
        }
        const dir = dirMap[direction]
        if (!dir) {
          res.status(400).json({ error: 'direction must be one of: n, s, e, w, ne, nw, se, sw' })
          return
        }
        dx = dir.dx * radius
        dy = dir.dy * radius
      } else {
        const angle = Math.random() * Math.PI * 2
        dx = Math.round(Math.cos(angle) * radius)
        dy = Math.round(Math.sin(angle) * radius)
      }

      let targetX = agent.position.x + dx
      let targetY = agent.position.y + dy

      // Find a walkable target
      if (!world.tileMap.isWalkable(targetX, targetY)) {
        const neighbors = world.tileMap.getNeighbors({ x: targetX, y: targetY })
        if (neighbors.length > 0) {
          targetX = neighbors[0].x
          targetY = neighbors[0].y
        } else {
          res.status(400).json({ error: 'No walkable exploration target found' })
          return
        }
      }

      const targetPosition: Position = { x: targetX, y: targetY }
      const path = findPath(world.tileMap, agent.position, targetPosition)
      if (path.length === 0) {
        res.status(400).json({ error: 'No path found to exploration target' })
        return
      }

      const duration = Math.max(path.length * 2, 2)
      const result = world.agentManager.enqueueAction(req.agent!.id, {
        type: 'explore',
        targetPosition,
        startedAt: world.clock.tick,
        duration,
      })

      if (!result.success) {
        res.status(409).json({ error: result.error })
        return
      }

      setCooldown(req.agent!.id, 'explore', world.clock.tick)
      res.json({
        action: 'explore',
        targetPosition,
        estimatedTicks: duration,
        energyCost: ENERGY_COST.explore,
      })
    },
  )

  // ── GET /chat ──
  router.get('/chat',
    requireAuth(),
    async (req: Request, res: Response) => {
      const { limit, messageType, since } = req.query
      const messages = await chatRelay.getRecentChat({
        limit: Math.min(Number(limit) || 50, 100),
        messageType: messageType as string | undefined,
        since: since as string | undefined,
      })
      res.json({ messages })
    },
  )

  return router
}
