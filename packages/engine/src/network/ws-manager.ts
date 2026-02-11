import type { Server as SocketServer, Namespace, Socket } from 'socket.io'
import type pg from 'pg'
import type { ActionType, CharacterAppearanceMap, Position } from '@botworld/shared'
import { ENERGY_COST, REST_ENERGY_REGEN } from '@botworld/shared'
import type { WorldEngine } from '../core/world-engine.js'
import type { ChatRelay } from '../systems/chat-relay.js'
import type { NotificationManager, Notification } from '../systems/notifications.js'
import { contentFilter } from '../security/content-filter.js'
import { getCooldown, setCooldown, COOLDOWN_TICKS } from '../api/actions.js'
import { findPath } from '../world/pathfinding.js'
import { validateOwnerSession } from '../auth/session.js'

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const NEARBY_RADIUS = 10

// ──────────────────────────────────────────────
// WsManager
// ──────────────────────────────────────────────

export class WsManager {
  private spectatorNs: Namespace
  private botNs: Namespace
  private dashboardNs: Namespace

  // Map owner_id -> Set of socket ids
  private ownerSockets: Map<string, Set<string>> = new Map()

  constructor(
    private io: SocketServer,
    private world: WorldEngine,
    private chatRelay: ChatRelay,
    private pool: pg.Pool,
    private notifications?: NotificationManager,
  ) {
    this.spectatorNs = io.of('/spectator')
    this.botNs = io.of('/bot')
    this.dashboardNs = io.of('/dashboard')

    this.setupSpectatorNamespace()
    this.setupBotNamespace()
    this.setupDashboardNamespace()
    this.setupEventRouting()

    // Set up WebSocket broadcast for notifications
    if (this.notifications) {
      this.notifications.setWebSocketBroadcast((ownerId, notification) => {
        this.broadcastToOwner(ownerId, 'notification:new', notification)
      })
    }
  }

  // ── Broadcast to owner's connected dashboards ──

  private broadcastToOwner(ownerId: string, event: string, data: unknown): void {
    const sockets = this.ownerSockets.get(ownerId)
    if (!sockets || sockets.size === 0) return

    for (const socketId of sockets) {
      const socket = this.dashboardNs.sockets.get(socketId)
      if (socket) {
        socket.emit(event, data)
      }
    }
  }

  // ── /spectator namespace ─────────────────────

  private setupSpectatorNamespace(): void {
    this.spectatorNs.on('connection', (socket) => {
      console.log(`[WS:spectator] Connected: ${socket.id}`)
      this.broadcastSpectatorCount()

      // Initial state
      socket.emit('world:state', this.world.getState())
      socket.emit('world:speed', {
        paused: this.world.isPaused(),
        speed: this.world.getSpeed(),
      })

      // Character appearances
      this.sendCharacterAppearances(socket)

      // Request handlers
      socket.on('request:state', () => {
        socket.emit('world:state', this.world.getState())
      })

      socket.on('request:chunks', (keys: string[]) => {
        const chunkData = this.world.tileMap.getSerializableChunks(keys)
        socket.emit('world:chunks', chunkData)
      })

      // Speed controls
      socket.on('world:pause', () => {
        this.world.setPaused(true)
        this.spectatorNs.emit('world:speed', {
          paused: true,
          speed: this.world.getSpeed(),
        })
      })

      socket.on('world:resume', () => {
        this.world.setPaused(false)
        this.spectatorNs.emit('world:speed', {
          paused: false,
          speed: this.world.getSpeed(),
        })
      })

      socket.on('world:setSpeed', (speed: number) => {
        this.world.setSpeed(speed)
        this.spectatorNs.emit('world:speed', {
          paused: this.world.isPaused(),
          speed: this.world.getSpeed(),
        })
      })

      socket.on('disconnect', () => {
        console.log(`[WS:spectator] Disconnected: ${socket.id}`)
        this.broadcastSpectatorCount()
      })
    })
  }

  // ── /bot namespace ───────────────────────────

  private setupBotNamespace(): void {
    // Auth middleware: API key required on connection
    this.botNs.use(async (socket, next) => {
      const apiKey = socket.handshake.auth?.apiKey as string | undefined
      if (!apiKey) {
        return next(new Error('API key required'))
      }

      try {
        const result = await this.pool.query<{ id: string; status: string }>(
          'SELECT id, status FROM agents WHERE api_key_hash = crypt($1, api_key_hash)',
          [apiKey],
        )

        if (result.rows.length === 0) {
          return next(new Error('Invalid API key'))
        }

        const agent = result.rows[0]
        if (agent.status !== 'active') {
          return next(new Error(`Agent status: ${agent.status}`))
        }

        socket.data.agentId = agent.id
        next()
      } catch {
        next(new Error('Authentication failed'))
      }
    })

    this.botNs.on('connection', (socket) => {
      const agentId = socket.data.agentId as string
      socket.join(`agent:${agentId}`)
      socket.emit('auth:success', { agentId })
      console.log(`[WS:bot] Authenticated: ${agentId} (${socket.id})`)

      // Register action handlers
      this.registerActHandlers(socket, agentId)

      socket.on('disconnect', () => {
        console.log(`[WS:bot] Disconnected: ${agentId} (${socket.id})`)
      })
    })
  }

  // ── /dashboard namespace ─────────────────────

  private setupDashboardNamespace(): void {
    // Auth middleware: owner session token required
    this.dashboardNs.use((socket, next) => {
      const token = socket.handshake.auth?.token as string | undefined
      if (!token) {
        return next(new Error('Session token required'))
      }

      const session = validateOwnerSession(token)
      if (!session) {
        return next(new Error('Invalid or expired session'))
      }

      socket.data.ownerId = session.ownerId
      socket.data.ownerEmail = session.email
      next()
    })

    this.dashboardNs.on('connection', (socket) => {
      const ownerId = socket.data.ownerId as string
      socket.join(`owner:${ownerId}`)

      // Track socket for this owner
      if (!this.ownerSockets.has(ownerId)) {
        this.ownerSockets.set(ownerId, new Set())
      }
      this.ownerSockets.get(ownerId)!.add(socket.id)

      socket.emit('auth:success', { ownerId })
      console.log(`[WS:dashboard] Connected: owner ${ownerId} (${socket.id})`)

      // Send unread notification count on connect
      if (this.notifications) {
        this.notifications.getUnreadCount(ownerId).then((count) => {
          socket.emit('notification:count', { unreadCount: count })
        })
      }

      // Handle request for notifications
      socket.on('notifications:get', async (data: { since?: string }, cb?: (res: unknown) => void) => {
        if (!this.notifications) {
          return cb?.({ error: 'Notifications not available' })
        }

        const since = data?.since ? new Date(data.since) : undefined
        const notifications = await this.notifications.getNotifications(ownerId, since)
        const unreadCount = await this.notifications.getUnreadCount(ownerId)

        cb?.({ notifications, unreadCount })
      })

      // Handle mark as read
      socket.on('notifications:read', async (data: { ids: string[] }, cb?: (res: unknown) => void) => {
        if (!this.notifications) {
          return cb?.({ error: 'Notifications not available' })
        }

        if (!data?.ids || !Array.isArray(data.ids)) {
          return cb?.({ error: 'ids array required' })
        }

        const updated = await this.notifications.markAsRead(ownerId, data.ids)
        const unreadCount = await this.notifications.getUnreadCount(ownerId)

        cb?.({ updated, unreadCount })

        // Broadcast updated count to all owner's connections
        this.broadcastToOwner(ownerId, 'notification:count', { unreadCount })
      })

      // Handle mark all as read
      socket.on('notifications:read-all', async (cb?: (res: unknown) => void) => {
        if (!this.notifications) {
          return cb?.({ error: 'Notifications not available' })
        }

        const updated = await this.notifications.markAllAsRead(ownerId)
        cb?.({ updated, unreadCount: 0 })

        // Broadcast updated count to all owner's connections
        this.broadcastToOwner(ownerId, 'notification:count', { unreadCount: 0 })
      })

      socket.on('disconnect', () => {
        console.log(`[WS:dashboard] Disconnected: owner ${ownerId} (${socket.id})`)

        // Remove socket from tracking
        const sockets = this.ownerSockets.get(ownerId)
        if (sockets) {
          sockets.delete(socket.id)
          if (sockets.size === 0) {
            this.ownerSockets.delete(ownerId)
          }
        }
      })
    })
  }

  // ── Event routing ────────────────────────────

  private setupEventRouting(): void {
    this.world.eventBus.onAny((event) => {
      // ── Spectator: broadcast all events ──
      this.spectatorNs.emit('world:event', event)

      if (event.type === 'world:tick') {
        // Bot: tick notification (state not yet updated)
        this.botNs.emit('world:tick', {
          clock: event.clock,
          timestamp: event.timestamp,
        })
      }

      if (event.type === 'world:state_updated') {
        // All processing complete — broadcast fresh state
        this.spectatorNs.emit('world:agents', [
          ...this.world.agentManager.getAllAgents(),
          ...this.world.npcManager.getAllNpcs(),
        ])
        this.sendNearbyUpdates()
      }

      if (event.type === 'world:chunks_generated') {
        const chunkData = this.world.tileMap.getSerializableChunks(event.chunkKeys)
        this.spectatorNs.emit('world:chunks', chunkData)
      }

      if (event.type === 'weather:changed') {
        this.spectatorNs.emit('world:weather', event.weather)
      }

      // ── World events (started/ended) ──
      if (event.type === 'world_event:started') {
        this.spectatorNs.emit('world:event_started', {
          eventId: event.eventId,
          eventType: event.eventType,
          title: event.title,
          description: event.description,
          category: event.category,
          position: event.position,
          radius: event.radius,
          effects: event.effects,
          duration: event.duration,
          expiresAt: event.expiresAt,
        })
        // Also notify bots
        this.botNs.emit('world:event_started', {
          eventId: event.eventId,
          eventType: event.eventType,
          title: event.title,
          description: event.description,
          category: event.category,
          position: event.position,
          radius: event.radius,
        })
      }

      if (event.type === 'world_event:ended') {
        this.spectatorNs.emit('world:event_ended', {
          eventId: event.eventId,
          eventType: event.eventType,
          title: event.title,
        })
        this.botNs.emit('world:event_ended', {
          eventId: event.eventId,
          eventType: event.eventType,
        })
      }

      // ── Combat events ──
      if (event.type === 'combat:started' || event.type === 'combat:round' || event.type === 'combat:ended') {
        this.spectatorNs.emit('combat:event', event)
        if ('agentId' in event) {
          this.botNs.to(`agent:${event.agentId}`).emit('combat:event', event)
        }
      }

      if (event.type === 'monster:spawned' || event.type === 'monster:died') {
        this.spectatorNs.emit('monster:event', event)
      }

      // ── Chat delivery ──
      if (event.type === 'chat:delivered') {
        // Spectators get all chat
        this.spectatorNs.emit('chat:message', {
          fromAgentId: event.fromAgentId,
          fromAgentName: event.fromAgentName,
          message: event.message,
          messageType: event.messageType,
          position: event.position,
          timestamp: event.timestamp,
        })

        // Bots: ContentFilter re-check then deliver
        this.deliverChatToRecipients(event)
      }

      // ── Trade proposed → target bot ──
      if (event.type === 'trade:proposed') {
        this.botNs.to(`agent:${event.toAgentId}`).emit('trade:proposed', {
          proposalId: event.proposalId,
          fromAgentId: event.fromAgentId,
          offerItemId: event.offerItemId,
          requestItemId: event.requestItemId,
          timestamp: event.timestamp,
        })
      }

      // ── Action results → acting bot ──
      if (event.type === 'resource:gathered') {
        this.botNs.to(`agent:${event.agentId}`).emit('action:result', {
          action: 'gather',
          resourceType: event.resourceType,
          amount: event.amount,
          position: event.position,
          timestamp: event.timestamp,
        })
      }

      if (event.type === 'item:crafted') {
        this.botNs.to(`agent:${event.agentId}`).emit('action:result', {
          action: 'craft',
          item: event.item,
          timestamp: event.timestamp,
        })
      }

      if (event.type === 'trade:completed') {
        this.botNs.to(`agent:${event.buyerId}`).emit('action:result', {
          action: 'trade',
          role: 'buyer',
          item: event.item,
          price: event.price,
          timestamp: event.timestamp,
        })
        this.botNs.to(`agent:${event.sellerId}`).emit('action:result', {
          action: 'trade',
          role: 'seller',
          item: event.item,
          price: event.price,
          timestamp: event.timestamp,
        })
      }
    })
  }

  // ── Chat delivery with ContentFilter re-check ─

  private async deliverChatToRecipients(event: {
    fromAgentId: string
    fromAgentName: string
    message: string
    messageType: 'say' | 'whisper' | 'shout'
    recipientIds: string[]
    position: { x: number; y: number }
    timestamp: number
  }): Promise<void> {
    const eventName = event.messageType === 'whisper' ? 'chat:whisper' : 'chat:heard'

    // ContentFilter re-check (single check per message, not per recipient)
    const recheck = await contentFilter.filterMessage(event.fromAgentId, event.message)
    if (!recheck.allowed) return

    const payload = {
      fromAgentId: event.fromAgentId,
      fromAgentName: event.fromAgentName,
      message: event.message,
      messageType: event.messageType,
      position: event.position,
      timestamp: event.timestamp,
    }

    for (const recipientId of event.recipientIds) {
      this.botNs.to(`agent:${recipientId}`).emit(eventName, payload)
    }
  }

  // ── Nearby updates (per-tick, per-bot) ───────

  private sendNearbyUpdates(): void {
    for (const [, socket] of this.botNs.sockets) {
      const agentId = socket.data.agentId as string
      if (!agentId) continue

      const agent = this.world.agentManager.getAgent(agentId)
      if (!agent) continue

      const nearbyAgents = this.world.agentManager.getNearbyAgents(agentId, NEARBY_RADIUS)

      socket.emit('world:nearby', {
        self: {
          position: agent.position,
          stats: agent.stats,
          inventory: agent.inventory,
          currentAction: agent.currentAction?.type ?? 'idle',
        },
        agents: nearbyAgents.map((a) => ({
          id: a.id,
          name: a.name,
          position: a.position,
          currentAction: a.currentAction?.type ?? 'idle',
        })),
        tick: this.world.clock.tick,
      })
    }
  }

  // ── Spectator count broadcast ───────────────

  private broadcastSpectatorCount(): void {
    this.spectatorNs.emit('spectator:count', this.spectatorNs.sockets.size)
  }

  // ── Character appearances helper ─────────────

  private sendCharacterAppearances(socket: Socket): void {
    this.pool
      .query<{ id: string; character_data: Record<string, unknown> | null }>(
        'SELECT id, character_data FROM agents WHERE character_data IS NOT NULL',
      )
      .then((result) => {
        const characterMap: CharacterAppearanceMap = {}
        for (const row of result.rows) {
          const cd = row.character_data as Record<string, unknown> | null
          const creation = cd?.creation as Record<string, unknown> | undefined
          if (creation?.appearance) {
            characterMap[row.id] = {
              appearance: creation.appearance as any,
              race: creation.race as any,
              characterClass: creation.characterClass as any,
              persona_reasoning: creation.persona_reasoning as any,
              spriteHash: (cd?.spriteHash as string) ?? '',
            }
          }
        }
        socket.emit('world:characters', characterMap)
      })
      .catch(() => {})
  }

  // ── act:* WebSocket handlers ─────────────────

  private registerActHandlers(socket: Socket, agentId: string): void {
    // Shared validation helper
    const validate = async (
      actionType: ActionType,
    ): Promise<string | null> => {
      // Character check
      try {
        const charResult = await this.pool.query<{
          character_data: Record<string, unknown> | null
        }>('SELECT character_data FROM agents WHERE id = $1', [agentId])
        if (!charResult.rows[0]?.character_data?.creation) {
          return 'Character not created. Use POST /api/characters/create first.'
        }
      } catch {
        return 'Database error'
      }

      // Agent in world check
      const agent = this.world.agentManager.getAgent(agentId)
      if (!agent) return 'Agent not found in world'

      // Energy check
      const cost = ENERGY_COST[actionType] ?? 0
      if (agent.stats.energy < cost) {
        return `Not enough energy (need ${cost}, have ${agent.stats.energy})`
      }

      // Cooldown check
      const cd = getCooldown(agentId, actionType)
      if (this.world.clock.tick < cd) {
        return `Action on cooldown (${cd - this.world.clock.tick} ticks remaining)`
      }

      return null
    }

    // ── act:move ──

    socket.on(
      'act:move',
      async (
        data: { target: { x: number; y: number } },
        cb?: (res: Record<string, unknown>) => void,
      ) => {
        const error = await validate('move')
        if (error) return cb?.({ error })

        const { x, y } = data.target ?? {}
        if (
          typeof x !== 'number' ||
          typeof y !== 'number' ||
          !Number.isInteger(x) ||
          !Number.isInteger(y)
        ) {
          return cb?.({ error: 'target.x and target.y must be integers' })
        }

        const agent = this.world.agentManager.getAgent(agentId)!
        if (agent.position.x === x && agent.position.y === y) {
          return cb?.({ error: 'Already at that position' })
        }

        if (!this.world.tileMap.isWalkable(x, y)) {
          return cb?.({ error: 'Target position is not walkable' })
        }

        const path = findPath(this.world.tileMap, agent.position, { x, y })
        if (path.length === 0) {
          return cb?.({ error: 'No path found to target position' })
        }

        const duration = Math.max(path.length * 2, 2)
        const result = this.world.agentManager.enqueueAction(agentId, {
          type: 'move',
          targetPosition: { x, y },
          startedAt: this.world.clock.tick,
          duration,
        })

        if (!result.success) {
          return cb?.({ error: result.error })
        }

        setCooldown(agentId, 'move', this.world.clock.tick)
        cb?.({
          success: true,
          path,
          estimatedTicks: duration,
          energyCost: ENERGY_COST.move,
        })
      },
    )

    // ── act:speak ──

    socket.on(
      'act:speak',
      async (
        data: { message: string; targetAgentId?: string },
        cb?: (res: Record<string, unknown>) => void,
      ) => {
        const error = await validate('speak')
        if (error) return cb?.({ error })

        if (
          !data.message ||
          typeof data.message !== 'string' ||
          data.message.length < 1 ||
          data.message.length > 200
        ) {
          return cb?.({ error: 'message must be 1-200 characters' })
        }

        const result = await this.chatRelay.handleSpeak(
          agentId,
          data.message,
          data.targetAgentId,
        )

        if (!result.allowed) {
          return cb?.({
            error: 'MESSAGE_BLOCKED',
            reason: result.reason,
            violation_count: contentFilter.getViolationCount(agentId),
          })
        }

        const agent = this.world.agentManager.getAgent(agentId)!
        agent.stats.energy = Math.max(
          0,
          agent.stats.energy - (ENERGY_COST.speak ?? 1),
        )

        setCooldown(agentId, 'speak', this.world.clock.tick)
        cb?.({
          success: true,
          recipientCount: result.recipientCount,
        })
      },
    )

    // ── act:whisper ──

    socket.on(
      'act:whisper',
      async (
        data: { targetAgentId: string; message: string },
        cb?: (res: Record<string, unknown>) => void,
      ) => {
        const error = await validate('speak')
        if (error) return cb?.({ error })

        if (!data.targetAgentId || typeof data.targetAgentId !== 'string') {
          return cb?.({ error: 'targetAgentId is required' })
        }

        if (
          !data.message ||
          typeof data.message !== 'string' ||
          data.message.length < 1 ||
          data.message.length > 200
        ) {
          return cb?.({ error: 'message must be 1-200 characters' })
        }

        const result = await this.chatRelay.handleWhisper(
          agentId,
          data.targetAgentId,
          data.message,
        )

        if (!result.allowed) {
          return cb?.({ error: result.reason })
        }

        const agent = this.world.agentManager.getAgent(agentId)!
        agent.stats.energy = Math.max(
          0,
          agent.stats.energy - (ENERGY_COST.speak ?? 1),
        )

        setCooldown(agentId, 'speak', this.world.clock.tick)
        cb?.({
          success: true,
          recipientCount: result.recipientCount,
        })
      },
    )

    // ── act:gather ──

    socket.on(
      'act:gather',
      async (
        _data: unknown,
        cb?: (res: Record<string, unknown>) => void,
      ) => {
        const error = await validate('gather')
        if (error) return cb?.({ error })

        const agent = this.world.agentManager.getAgent(agentId)!
        const tile = this.world.tileMap.getTile(
          agent.position.x,
          agent.position.y,
        )

        if (!tile?.resource || tile.resource.amount < 1) {
          return cb?.({ error: 'No resource at current position' })
        }

        const result = this.world.agentManager.enqueueAction(agentId, {
          type: 'gather',
          targetPosition: agent.position,
          startedAt: this.world.clock.tick,
          duration: 10,
        })

        if (!result.success) {
          return cb?.({ error: result.error })
        }

        setCooldown(agentId, 'gather', this.world.clock.tick)
        cb?.({
          success: true,
          position: agent.position,
          estimatedTicks: 10,
          energyCost: ENERGY_COST.gather,
        })
      },
    )

    // ── act:craft ──

    socket.on(
      'act:craft',
      async (
        data: { materialIds: [string, string] },
        cb?: (res: Record<string, unknown>) => void,
      ) => {
        const error = await validate('craft')
        if (error) return cb?.({ error })

        const { materialIds } = data
        if (!Array.isArray(materialIds) || materialIds.length !== 2) {
          return cb?.({
            error: 'materialIds must be an array of exactly 2 item IDs',
          })
        }

        const agent = this.world.agentManager.getAgent(agentId)!
        const mat1 = agent.inventory.find((i) => i.id === materialIds[0])
        const mat2 = agent.inventory.find((i) => i.id === materialIds[1])

        if (!mat1 || mat1.quantity <= 0) {
          return cb?.({
            error: `Material ${materialIds[0]} not found or depleted`,
          })
        }
        if (!mat2 || mat2.quantity <= 0) {
          return cb?.({
            error: `Material ${materialIds[1]} not found or depleted`,
          })
        }

        const result = this.world.agentManager.enqueueAction(agentId, {
          type: 'craft',
          data: { materialIds },
          startedAt: this.world.clock.tick,
          duration: 15,
        })

        if (!result.success) {
          return cb?.({ error: result.error })
        }

        setCooldown(agentId, 'craft', this.world.clock.tick)
        cb?.({
          success: true,
          materials: [mat1.name, mat2.name],
          estimatedTicks: 15,
          energyCost: ENERGY_COST.craft,
        })
      },
    )

    // ── act:rest ──

    socket.on(
      'act:rest',
      async (
        data: { duration?: number },
        cb?: (res: Record<string, unknown>) => void,
      ) => {
        // No energy/cooldown check for rest
        const agent = this.world.agentManager.getAgent(agentId)
        if (!agent) return cb?.({ error: 'Agent not found in world' })

        const duration = Math.max(10, Math.min(120, data?.duration ?? 30))

        const result = this.world.agentManager.enqueueAction(agentId, {
          type: 'rest',
          startedAt: this.world.clock.tick,
          duration,
        })

        if (!result.success) {
          return cb?.({ error: result.error })
        }

        cb?.({
          success: true,
          duration,
          currentEnergy: agent.stats.energy,
          estimatedEnergyGain: duration * REST_ENERGY_REGEN,
        })
      },
    )

    // ── act:eat ──

    socket.on(
      'act:eat',
      async (
        data: { itemId: string },
        cb?: (res: Record<string, unknown>) => void,
      ) => {
        const agent = this.world.agentManager.getAgent(agentId)
        if (!agent) return cb?.({ error: 'Agent not found in world' })

        if (!data.itemId || typeof data.itemId !== 'string') {
          return cb?.({ error: 'itemId is required' })
        }

        const food = agent.inventory.find((i) => i.id === data.itemId)
        if (!food || food.quantity <= 0) {
          return cb?.({ error: 'Item not found in inventory' })
        }
        if (food.type !== 'food') {
          return cb?.({ error: 'Item is not food' })
        }

        const result = this.world.agentManager.enqueueAction(agentId, {
          type: 'eat',
          targetItemId: data.itemId,
          startedAt: this.world.clock.tick,
          duration: 3,
        })

        if (!result.success) {
          return cb?.({ error: result.error })
        }

        cb?.({
          success: true,
          item: food.name,
          hungerRestored: 30,
          estimatedTicks: 3,
        })
      },
    )

    // ── act:explore ──

    socket.on(
      'act:explore',
      async (
        data: { direction?: string },
        cb?: (res: Record<string, unknown>) => void,
      ) => {
        const error = await validate('explore')
        if (error) return cb?.({ error })

        const agent = this.world.agentManager.getAgent(agentId)!

        const radius = 8 + Math.floor(Math.random() * 12)
        let dx = 0
        let dy = 0

        if (data?.direction) {
          const dirMap: Record<string, { dx: number; dy: number }> = {
            n: { dx: 0, dy: -1 },
            s: { dx: 0, dy: 1 },
            e: { dx: 1, dy: 0 },
            w: { dx: -1, dy: 0 },
            ne: { dx: 1, dy: -1 },
            nw: { dx: -1, dy: -1 },
            se: { dx: 1, dy: 1 },
            sw: { dx: -1, dy: 1 },
          }
          const dir = dirMap[data.direction]
          if (!dir) {
            return cb?.({
              error: 'direction must be one of: n, s, e, w, ne, nw, se, sw',
            })
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

        if (!this.world.tileMap.isWalkable(targetX, targetY)) {
          const neighbors = this.world.tileMap.getNeighbors({
            x: targetX,
            y: targetY,
          })
          if (neighbors.length > 0) {
            targetX = neighbors[0].x
            targetY = neighbors[0].y
          } else {
            return cb?.({ error: 'No walkable exploration target found' })
          }
        }

        const targetPosition: Position = { x: targetX, y: targetY }
        const path = findPath(
          this.world.tileMap,
          agent.position,
          targetPosition,
        )
        if (path.length === 0) {
          return cb?.({ error: 'No path found to exploration target' })
        }

        const duration = Math.max(path.length * 2, 2)
        const result = this.world.agentManager.enqueueAction(agentId, {
          type: 'explore',
          targetPosition,
          startedAt: this.world.clock.tick,
          duration,
        })

        if (!result.success) {
          return cb?.({ error: result.error })
        }

        setCooldown(agentId, 'explore', this.world.clock.tick)
        cb?.({
          success: true,
          targetPosition,
          estimatedTicks: duration,
          energyCost: ENERGY_COST.explore,
        })
      },
    )
  }
}
