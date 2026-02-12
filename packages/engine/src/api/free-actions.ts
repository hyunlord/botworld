import { type Router as IRouter, Router, type Request, type Response, type NextFunction } from 'express'
import type { WorldEngine } from '../core/world-engine.js'
import type { ChatRelay } from '../systems/chat-relay.js'
import { requireAuth } from '../auth/middleware.js'
import { generateId } from '@botworld/shared'
import { pool } from '../db/connection.js'

interface TradeOffer {
  id: string
  initiator: string
  target: string
  offer: Array<{ item: string; qty: number }>
  request: Array<{ item: string; qty: number }>
  message?: string
  createdAt: number
  expiresAt: number
}

interface PendingLetter {
  id: string
  from: string
  to: string
  content: string
  deliverAt: number
}

const tradeOffers = new Map<string, TradeOffer>()
const pendingLetters = new Map<string, PendingLetter>()

function requireCharacter() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const agentId = req.agent!.id
    const result = await pool.query<{ character_data: Record<string, unknown> | null }>(
      'SELECT character_data FROM agents WHERE id = $1',
      [agentId]
    )
    if (!result.rows[0]?.character_data?.creation) {
      res.status(403).json({ error: 'Character not created.' })
      return
    }
    next()
  }
}

const KNOWN_INTENT_MAPPING: Record<string, string> = {
  explore: 'explore',
  fight: 'attack',
  attack: 'attack',
  rest: 'rest',
  sleep: 'rest',
  gather: 'gather',
  collect: 'gather',
  craft: 'craft',
  make: 'craft',
  trade: 'trade',
  buy: 'trade',
  sell: 'trade',
  talk: 'speak',
  speak: 'speak'
}

const HARMLESS_ACTIONS = new Set([
  'dance', 'sing', 'meditate', 'pray', 'wave', 'sit', 'stand', 'look',
  'observe', 'write', 'draw', 'cook', 'fish', 'climb', 'swim', 'hide',
  'celebrate', 'cheer', 'laugh', 'cry', 'think'
])

const IMPOSSIBLE_ACTIONS = new Set(['fly', 'teleport', 'levitate', 'vanish', 'conjure'])

export function createFreeActionsRouter(world: WorldEngine, chatRelay: ChatRelay): IRouter {
  const router = Router()

  // POST /actions/free - Free-form action
  router.post('/free', requireAuth(), requireCharacter(), async (req: Request, res: Response) => {
    const { description, intent } = req.body
    const agentId = req.agent!.id
    const agentName = req.agent!.name

    // Validate description
    if (typeof description !== 'string' || description.length < 1 || description.length > 500) {
      res.status(400).json({ error: 'Description must be 1-500 characters' })
      return
    }

    // Validate optional intent
    if (intent !== undefined && typeof intent !== 'string') {
      res.status(400).json({ error: 'Intent must be a string' })
      return
    }

    // Map known intents to existing actions
    if (intent && KNOWN_INTENT_MAPPING[intent.toLowerCase()]) {
      const mappedAction = KNOWN_INTENT_MAPPING[intent.toLowerCase()]
      const agent = world.agentManager.getAgent(agentId)

      if (!agent) {
        res.status(404).json({ error: 'Agent not found' })
        return
      }

      // Enqueue the mapped action
      world.agentManager.enqueueAction(agentId, {
        type: mappedAction as any,
        startedAt: world.clock.tick,
        duration: 10
      })

      res.json({
        action: mappedAction,
        narration: `${agentName} decides to ${mappedAction}: ${description}`,
        effects: []
      })
      return
    }

    // Handle custom actions
    const actionVerb = intent?.toLowerCase() || description.split(' ')[0].toLowerCase()

    if (IMPOSSIBLE_ACTIONS.has(actionVerb)) {
      res.json({
        action: 'failed',
        narration: `${agentName} attempts to ${actionVerb}, but such magic is beyond mortal capabilities in this world.`,
        effects: []
      })
      return
    }

    if (HARMLESS_ACTIONS.has(actionVerb) || !intent) {
      // Create emote-style response
      const narration = `${agentName} ${description}`

      // Emit event for other agents to potentially see (using agent:action as closest match)
      world.eventBus.emit({
        type: 'agent:action',
        agentId,
        action: {
          type: 'idle',
          startedAt: world.clock.tick,
          duration: 1,
          data: { customAction: actionVerb, description }
        },
        timestamp: Date.now()
      })

      res.json({
        action: 'emote',
        narration,
        effects: [{ type: 'emote', description }]
      })
      return
    }

    // Unknown intent - treat as emote
    res.json({
      action: 'custom',
      narration: `${agentName} ${description}`,
      effects: []
    })
  })

  // POST /actions/build - Place custom building
  router.post('/build', requireAuth(), requireCharacter(), async (req: Request, res: Response) => {
    const { name, description, location, cost } = req.body
    const agentId = req.agent!.id

    // Validate inputs
    if (typeof name !== 'string' || name.length < 1 || name.length > 50) {
      res.status(400).json({ error: 'Name must be 1-50 characters' })
      return
    }

    if (typeof description !== 'string' || description.length < 1 || description.length > 200) {
      res.status(400).json({ error: 'Description must be 1-200 characters' })
      return
    }

    if (!location || typeof location.x !== 'number' || typeof location.y !== 'number') {
      res.status(400).json({ error: 'Location must have x and y coordinates' })
      return
    }

    if (!cost || typeof cost !== 'object') {
      res.status(400).json({ error: 'Cost must be an object with resource keys' })
      return
    }

    const agent = world.agentManager.getAgent(agentId)
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' })
      return
    }

    // Check if tile is walkable
    const tile = world.tileMap.getTile(location.x, location.y)
    if (!tile?.walkable) {
      res.status(400).json({ error: 'Cannot build on non-walkable terrain' })
      return
    }

    // Check if location is already occupied by a POI
    const existingPOI = world.tileMap.pois.find(
      poi => poi.position.x === location.x && poi.position.y === location.y
    )
    if (existingPOI) {
      res.status(400).json({ error: 'Location already occupied by another structure' })
      return
    }

    // Check agent has sufficient resources
    for (const [resource, qty] of Object.entries(cost)) {
      if (typeof qty !== 'number' || qty < 0) {
        res.status(400).json({ error: `Invalid cost for ${resource}` })
        return
      }

      const inventoryItem = agent.inventory.find(
        item => item.name.toLowerCase() === resource.toLowerCase()
      )
      const currentQty = inventoryItem?.quantity || 0

      if (currentQty < qty) {
        res.status(400).json({
          error: `Insufficient ${resource}: have ${currentQty}, need ${qty}`
        })
        return
      }
    }

    // Deduct resources from inventory
    for (const [resource, qty] of Object.entries(cost)) {
      const inventoryItem = agent.inventory.find(
        item => item.name.toLowerCase() === resource.toLowerCase()
      )
      if (inventoryItem) {
        inventoryItem.quantity -= qty as number
        if (inventoryItem.quantity <= 0) {
          agent.inventory = agent.inventory.filter(item => item !== inventoryItem)
        }
      }
    }

    // Add new POI to tileMap (using 'workshop' as the closest match for custom buildings)
    const newBuilding = {
      type: 'workshop' as const,
      name,
      position: location
    }

    world.tileMap.pois.push(newBuilding)

    // Emit event (use agent:action as closest match for custom building)
    world.eventBus.emit({
      type: 'agent:action',
      agentId,
      action: {
        type: 'build',
        startedAt: world.clock.tick,
        duration: 1,
        data: { buildingName: name, position: location }
      },
      timestamp: Date.now()
    })

    res.json({
      ok: true,
      building: {
        name,
        position: location,
        owner: agentId
      }
    })
  })

  // POST /actions/trade/offer - Enhanced trade with messages
  router.post('/trade/offer', requireAuth(), requireCharacter(), async (req: Request, res: Response) => {
    const { target_agent, offer, request, message } = req.body
    const agentId = req.agent!.id

    // Validate inputs
    if (typeof target_agent !== 'string') {
      res.status(400).json({ error: 'target_agent must be a string' })
      return
    }

    if (!Array.isArray(offer) || !Array.isArray(request)) {
      res.status(400).json({ error: 'offer and request must be arrays' })
      return
    }

    if (message !== undefined && (typeof message !== 'string' || message.length > 200)) {
      res.status(400).json({ error: 'Message must be a string (max 200 chars)' })
      return
    }

    // Validate offer/request items
    for (const item of [...offer, ...request]) {
      if (!item.item || typeof item.item !== 'string' || typeof item.qty !== 'number' || item.qty <= 0) {
        res.status(400).json({ error: 'Invalid item format: {item: string, qty: number}' })
        return
      }
    }

    const agent = world.agentManager.getAgent(agentId)
    const targetAgent = world.agentManager.getAgent(target_agent)

    if (!agent || !targetAgent) {
      res.status(404).json({ error: 'Agent not found' })
      return
    }

    // Check proximity (Manhattan distance ≤ 5)
    const distance = Math.abs(agent.position.x - targetAgent.position.x) +
                     Math.abs(agent.position.y - targetAgent.position.y)

    if (distance > 5) {
      res.status(400).json({ error: 'Target agent is too far away (max distance: 5)' })
      return
    }

    // Verify agent has offered items
    for (const { item, qty } of offer) {
      const inventoryItem = agent.inventory.find(
        inv => inv.name.toLowerCase() === item.toLowerCase()
      )
      const currentQty = inventoryItem?.quantity || 0

      if (currentQty < qty) {
        res.status(400).json({
          error: `Insufficient ${item}: have ${currentQty}, need ${qty}`
        })
        return
      }
    }

    // Create trade offer
    const tradeId = generateId('trade')
    const now = Date.now()
    const expiresAt = now + 120000 // 120 seconds

    const tradeOffer: TradeOffer = {
      id: tradeId,
      initiator: agentId,
      target: target_agent,
      offer,
      request,
      message,
      createdAt: now,
      expiresAt
    }

    tradeOffers.set(tradeId, tradeOffer)

    // Auto-expire after 120 seconds
    setTimeout(() => {
      tradeOffers.delete(tradeId)
    }, 120000)

    // Emit event (use existing trade:proposed event structure)
    world.eventBus.emit({
      type: 'trade:proposed',
      proposalId: tradeId,
      fromAgentId: agentId,
      toAgentId: target_agent,
      offerItemId: offer.map(o => o.item).join(','),
      requestItemId: request.map(r => r.item).join(','),
      timestamp: now
    })

    res.json({
      trade_id: tradeId,
      expires_in: 120
    })
  })

  // POST /actions/trade/counter - Counter trade offer
  router.post('/trade/counter', requireAuth(), requireCharacter(), async (req: Request, res: Response) => {
    const { trade_id, action, counter_offer, message } = req.body
    const agentId = req.agent!.id

    // Validate inputs
    if (typeof trade_id !== 'string') {
      res.status(400).json({ error: 'trade_id must be a string' })
      return
    }

    if (!['accept', 'reject', 'counter'].includes(action)) {
      res.status(400).json({ error: 'action must be accept, reject, or counter' })
      return
    }

    const offer = tradeOffers.get(trade_id)
    if (!offer) {
      res.status(404).json({ error: 'Trade offer not found or expired' })
      return
    }

    // Verify agent is the target
    if (offer.target !== agentId) {
      res.status(403).json({ error: 'You are not the target of this trade offer' })
      return
    }

    const initiator = world.agentManager.getAgent(offer.initiator)
    const target = world.agentManager.getAgent(offer.target)

    if (!initiator || !target) {
      res.status(404).json({ error: 'One or both agents not found' })
      return
    }

    if (action === 'reject') {
      tradeOffers.delete(trade_id)
      // No event emission for rejection (not a standard event type)
      res.json({ status: 'rejected' })
      return
    }

    if (action === 'accept') {
      // Execute trade - verify both sides have items
      for (const { item, qty } of offer.offer) {
        const inventoryItem = initiator.inventory.find(
          inv => inv.name.toLowerCase() === item.toLowerCase()
        )
        if (!inventoryItem || inventoryItem.quantity < qty) {
          res.status(400).json({ error: `Initiator no longer has sufficient ${item}` })
          return
        }
      }

      for (const { item, qty } of offer.request) {
        const inventoryItem = target.inventory.find(
          inv => inv.name.toLowerCase() === item.toLowerCase()
        )
        if (!inventoryItem || inventoryItem.quantity < qty) {
          res.status(400).json({ error: `You no longer have sufficient ${item}` })
          return
        }
      }

      // Execute swap
      for (const { item, qty } of offer.offer) {
        const initiatorItem = initiator.inventory.find(
          inv => inv.name.toLowerCase() === item.toLowerCase()
        )!
        initiatorItem.quantity -= qty

        const targetItem = target.inventory.find(
          inv => inv.name.toLowerCase() === item.toLowerCase()
        )
        if (targetItem) {
          targetItem.quantity += qty
        } else {
          target.inventory.push({
            id: generateId('item'),
            type: 'resource',
            name: item,
            quantity: qty
          })
        }

        if (initiatorItem.quantity <= 0) {
          initiator.inventory = initiator.inventory.filter(i => i !== initiatorItem)
        }
      }

      for (const { item, qty } of offer.request) {
        const targetItem = target.inventory.find(
          inv => inv.name.toLowerCase() === item.toLowerCase()
        )!
        targetItem.quantity -= qty

        const initiatorItem = initiator.inventory.find(
          inv => inv.name.toLowerCase() === item.toLowerCase()
        )
        if (initiatorItem) {
          initiatorItem.quantity += qty
        } else {
          initiator.inventory.push({
            id: generateId('item'),
            type: 'resource',
            name: item,
            quantity: qty
          })
        }

        if (targetItem.quantity <= 0) {
          target.inventory = target.inventory.filter(i => i !== targetItem)
        }
      }

      tradeOffers.delete(trade_id)

      // Emit trade:completed event (using first offered item as representative)
      const firstOfferedItem = initiator.inventory.find(
        i => i.name.toLowerCase() === offer.offer[0].item.toLowerCase()
      )
      if (firstOfferedItem) {
        world.eventBus.emit({
          type: 'trade:completed',
          buyerId: offer.target,
          sellerId: offer.initiator,
          item: firstOfferedItem,
          price: 0, // Custom trade, no price
          timestamp: Date.now()
        })
      }

      res.json({ status: 'accepted', trade_executed: true })
      return
    }

    if (action === 'counter') {
      if (!Array.isArray(counter_offer)) {
        res.status(400).json({ error: 'counter_offer must be an array' })
        return
      }

      // Verify target has items for counter offer
      for (const { item, qty } of counter_offer) {
        const inventoryItem = target.inventory.find(
          inv => inv.name.toLowerCase() === item.toLowerCase()
        )
        if (!inventoryItem || inventoryItem.quantity < qty) {
          res.status(400).json({ error: `Insufficient ${item} for counter offer` })
          return
        }
      }

      // Create new offer with swapped roles
      const counterTradeId = generateId('trade')
      const now = Date.now()

      const counterTrade: TradeOffer = {
        id: counterTradeId,
        initiator: agentId,
        target: offer.initiator,
        offer: counter_offer,
        request: offer.offer, // Original offer becomes new request
        message,
        createdAt: now,
        expiresAt: now + 120000
      }

      tradeOffers.set(counterTradeId, counterTrade)
      tradeOffers.delete(trade_id) // Remove original offer

      setTimeout(() => {
        tradeOffers.delete(counterTradeId)
      }, 120000)

      // No event emission for counter offer (not a standard event type)

      res.json({
        status: 'countered',
        new_trade_id: counterTradeId,
        expires_in: 120
      })
      return
    }
  })

  // POST /actions/message - Send letter or whisper
  router.post('/message', requireAuth(), requireCharacter(), async (req: Request, res: Response) => {
    const { to, content, type } = req.body
    const agentId = req.agent!.id
    const agentName = req.agent!.name

    // Validate inputs
    if (typeof to !== 'string' || typeof content !== 'string') {
      res.status(400).json({ error: 'to and content must be strings' })
      return
    }

    if (!['letter', 'whisper'].includes(type)) {
      res.status(400).json({ error: 'type must be letter or whisper' })
      return
    }

    if (content.length < 1 || content.length > 500) {
      res.status(400).json({ error: 'Content must be 1-500 characters' })
      return
    }

    // Find target agent by name or ID
    const targetAgent = world.agentManager.getAllAgents().find(
      agent => agent.id === to || agent.name === to
    )

    if (!targetAgent) {
      res.status(404).json({ error: 'Target agent not found' })
      return
    }

    const agent = world.agentManager.getAgent(agentId)
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' })
      return
    }

    if (type === 'whisper') {
      // Check if in same area (distance ≤ 10)
      const distance = Math.abs(agent.position.x - targetAgent.position.x) +
                       Math.abs(agent.position.y - targetAgent.position.y)

      if (distance > 10) {
        res.status(400).json({ error: 'Target too far for whisper (max distance: 10)' })
        return
      }

      // Use chatRelay for immediate delivery
      await chatRelay.handleWhisper(agentId, targetAgent.id, content)

      res.json({
        sent: true,
        delivery: 'instant',
        estimated_delivery_ticks: 0
      })
      return
    }

    if (type === 'letter') {
      // Store in pending letters, deliver after 30 ticks
      const letterId = generateId('letter')
      const currentTick = world.clock.tick
      const deliverAt = currentTick + 30

      const letter: PendingLetter = {
        id: letterId,
        from: agentId,
        to: targetAgent.id,
        content,
        deliverAt
      }

      pendingLetters.set(letterId, letter)

      // Set up delivery after 30 ticks (assuming 1 tick/second)
      setTimeout(async () => {
        const storedLetter = pendingLetters.get(letterId)
        if (storedLetter) {
          const sender = world.agentManager.getAgent(agentId)
          await chatRelay.handleWhisper(agentId, targetAgent.id, `[Letter] ${content}`)

          world.eventBus.emit({
            type: 'chat:delivered',
            fromAgentId: agentId,
            fromAgentName: sender?.name || 'Unknown',
            message: `[Letter] ${content}`,
            messageType: 'whisper',
            recipientIds: [targetAgent.id],
            position: targetAgent.position,
            timestamp: Date.now()
          })

          pendingLetters.delete(letterId)
        }
      }, 30000) // 30 ticks * 1000ms

      res.json({
        sent: true,
        delivery: 'pending',
        estimated_delivery_ticks: 30
      })
      return
    }
  })

  // POST /actions/events/host - Host player event
  router.post('/events/host', requireAuth(), requireCharacter(), async (req: Request, res: Response) => {
    const { name, description, location, start_after, type, entry_fee, prize } = req.body
    const agentId = req.agent!.id

    // Validate inputs
    if (typeof name !== 'string' || name.length < 1 || name.length > 100) {
      res.status(400).json({ error: 'Name must be 1-100 characters' })
      return
    }

    if (typeof description !== 'string' || description.length < 1 || description.length > 500) {
      res.status(400).json({ error: 'Description must be 1-500 characters' })
      return
    }

    if (typeof type !== 'string') {
      res.status(400).json({ error: 'Type must be a string' })
      return
    }

    if (typeof start_after !== 'number' || start_after < 0) {
      res.status(400).json({ error: 'start_after must be a positive number' })
      return
    }

    if (typeof prize !== 'number' || prize < 0) {
      res.status(400).json({ error: 'Prize must be a positive number' })
      return
    }

    const agent = world.agentManager.getAgent(agentId)
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' })
      return
    }

    // Check agent has enough gold for the prize
    const goldItem = agent.inventory.find(item => item.type === 'currency' && item.name.toLowerCase() === 'gold')
    const currentGold = goldItem?.quantity || 0

    if (currentGold < prize) {
      res.status(400).json({
        error: `Insufficient gold for prize: have ${currentGold}, need ${prize}`
      })
      return
    }

    // Deduct prize gold
    if (goldItem) {
      goldItem.quantity -= prize
      if (goldItem.quantity <= 0) {
        agent.inventory = agent.inventory.filter(item => item !== goldItem)
      }
    }

    // Resolve location
    let eventPosition: { x: number; y: number }

    if (typeof location === 'string') {
      // Location is POI name
      const poi = world.tileMap.pois.find(
        p => p.name.toLowerCase() === location.toLowerCase()
      )
      if (!poi) {
        res.status(404).json({ error: `POI ${location} not found` })
        return
      }
      eventPosition = poi.position
    } else if (location && typeof location.x === 'number' && typeof location.y === 'number') {
      eventPosition = location
    } else {
      res.status(400).json({ error: 'Location must be POI name or {x, y}' })
      return
    }

    // Create event
    const eventId = generateId('event')
    const currentTick = world.clock.tick
    const startsAt = currentTick + start_after

    const playerEvent = {
      id: eventId,
      name,
      description,
      type,
      position: eventPosition,
      host: agentId,
      entryFee: entry_fee || 0,
      prize,
      startsAt,
      createdAt: Date.now(),
      participants: [] as string[]
    }

    // Emit world event (using 'festival' as closest match for player events)
    world.eventBus.emit({
      type: 'world_event:started',
      eventId,
      eventType: 'festival',
      title: `${name} hosted by ${agent.name}`,
      description,
      category: 'social',
      position: eventPosition,
      radius: 10,
      effects: [],
      duration: 100,
      expiresAt: startsAt + 100,
      timestamp: Date.now()
    })

    res.json({
      event_id: eventId,
      starts_at_tick: startsAt,
      name
    })
  })

  return router
}
