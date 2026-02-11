import type pg from 'pg'
import type { EventBus } from '../core/event-bus.js'
import type { AgentManager } from '../agent/agent-manager.js'
import type { Item } from '@botworld/shared'

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type NotificationType =
  | 'level_up'
  | 'rare_item'
  | 'trade_completed'
  | 'character_ko'
  | 'new_relationship'
  | 'security_warning'
  | 'bot_offline'

export interface Notification {
  id: string
  agentId: string
  ownerId: string | null
  type: NotificationType
  title: string
  message: string
  data: Record<string, unknown>
  read: boolean
  createdAt: Date
}

export interface NotificationPayload {
  type: NotificationType
  title: string
  message: string
  data?: Record<string, unknown>
}

// ──────────────────────────────────────────────
// NotificationManager
// ──────────────────────────────────────────────

export class NotificationManager {
  // In-memory store for pending notifications (for bot → user path)
  private pendingNotifications: Map<string, Notification[]> = new Map()

  // Callback for WebSocket broadcast (set by WsManager)
  private wsBroadcast: ((ownerId: string, notification: Notification) => void) | null = null

  // Track last heartbeat times for bot_offline detection
  private lastHeartbeat: Map<string, number> = new Map()
  private offlineCheckInterval: NodeJS.Timeout | null = null

  constructor(
    private pool: pg.Pool,
    private eventBus: EventBus,
    private agentManager: AgentManager,
  ) {
    this.setupEventListeners()
    this.startOfflineCheck()
  }

  // ── Event Listeners ────────────────────────

  private setupEventListeners(): void {
    // Use onAny with type casting for future event types
    this.eventBus.onAny((event) => {
      const e = event as unknown as Record<string, unknown>
      const eventType = e.type as string

      // Level up (future event type)
      if (eventType === 'agent:level_up') {
        this.createNotification(e.agentId as string, {
          type: 'level_up',
          title: '🎉 Level Up!',
          message: `Your character reached level ${e.newLevel}!`,
          data: { oldLevel: e.oldLevel, newLevel: e.newLevel },
        })
      }

      // Rare item acquired (future event type)
      if (eventType === 'item:acquired') {
        const item = e.item as Item | undefined
        if (item && this.isRareOrBetter(item)) {
          this.createNotification(e.agentId as string, {
            type: 'rare_item',
            title: '✨ Rare Item Found!',
            message: `You found a ${item.rarity} item: ${item.name}`,
            data: { item },
          })
        }
      }

      // Trade completed (existing event type)
      if (eventType === 'trade:completed') {
        const item = e.item as Item
        const price = e.price as number
        // Notify both parties
        this.createNotification(e.buyerId as string, {
          type: 'trade_completed',
          title: '💰 Trade Completed',
          message: `You bought ${item.name} for ${price} gold`,
          data: { item, price, role: 'buyer' },
        })
        this.createNotification(e.sellerId as string, {
          type: 'trade_completed',
          title: '💰 Trade Completed',
          message: `You sold ${item.name} for ${price} gold`,
          data: { item, price, role: 'seller' },
        })
      }

      // Character KO (HP 0) (future event type)
      if (eventType === 'agent:knocked_out') {
        this.createNotification(e.agentId as string, {
          type: 'character_ko',
          title: '💀 Character Knocked Out',
          message: 'Your character has been knocked out. They will respawn soon.',
          data: { cause: e.cause, respawnIn: e.respawnTicks },
        })
      }

      // New relationship formed (future event type)
      if (eventType === 'relationship:formed') {
        const relationType = e.relationType as string
        this.createNotification(e.agentId as string, {
          type: 'new_relationship',
          title: relationType === 'friend' ? '🤝 New Friend!' : '⚔️ New Rival!',
          message: `You've formed a ${relationType} relationship with ${e.targetName}`,
          data: { targetId: e.targetId, targetName: e.targetName, relationType },
        })
      }

      // Security warning (key leak attempt) (future event type)
      if (eventType === 'security:violation') {
        this.createNotification(e.agentId as string, {
          type: 'security_warning',
          title: '🚨 Security Warning',
          message: 'Potential API key leak attempt detected. Your message was blocked.',
          data: { violationType: e.violationType, count: e.violationCount },
        })
      }
    })
  }

  // ── Offline Check ──────────────────────────

  private startOfflineCheck(): void {
    // Check every 30 minutes for bots that haven't sent heartbeat in 2+ hours
    this.offlineCheckInterval = setInterval(() => {
      this.checkOfflineBots()
    }, 30 * 60 * 1000)
  }

  recordHeartbeat(agentId: string): void {
    this.lastHeartbeat.set(agentId, Date.now())
  }

  private async checkOfflineBots(): Promise<void> {
    const TWO_HOURS = 2 * 60 * 60 * 1000
    const now = Date.now()

    // Get all active agents
    try {
      const result = await this.pool.query<{ id: string; name: string; owner_id: string }>(
        "SELECT id, name, owner_id FROM agents WHERE status = 'active' AND owner_id IS NOT NULL"
      )

      for (const agent of result.rows) {
        const lastBeat = this.lastHeartbeat.get(agent.id)

        // If no heartbeat recorded or last heartbeat > 2 hours ago
        if (!lastBeat || now - lastBeat > TWO_HOURS) {
          // Check if we already sent this notification recently (avoid spam)
          const recent = await this.pool.query(
            `SELECT id FROM notifications
             WHERE agent_id = $1 AND type = 'bot_offline' AND created_at > NOW() - INTERVAL '4 hours'`,
            [agent.id]
          )

          if (recent.rows.length === 0) {
            await this.createNotification(agent.id, {
              type: 'bot_offline',
              title: '🔴 Bot Offline',
              message: `Your bot "${agent.name}" hasn't sent a heartbeat in over 2 hours. It may need to be restarted.`,
              data: { lastHeartbeat: lastBeat ?? null },
            })
          }
        }
      }
    } catch (err) {
      console.error('[NotificationManager] Failed to check offline bots:', (err as Error).message)
    }
  }

  // ── Notification Creation ──────────────────

  async createNotification(agentId: string, payload: NotificationPayload): Promise<Notification | null> {
    try {
      // Get owner_id for this agent
      const agentResult = await this.pool.query<{ owner_id: string | null }>(
        'SELECT owner_id FROM agents WHERE id = $1',
        [agentId]
      )

      const ownerId = agentResult.rows[0]?.owner_id ?? null

      // Insert into database
      const result = await this.pool.query<{
        id: string
        agent_id: string
        owner_id: string | null
        type: NotificationType
        title: string
        message: string
        data: Record<string, unknown>
        read: boolean
        created_at: Date
      }>(
        `INSERT INTO notifications (agent_id, owner_id, type, title, message, data)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, agent_id, owner_id, type, title, message, data, read, created_at`,
        [agentId, ownerId, payload.type, payload.title, payload.message, payload.data ?? {}]
      )

      const notification: Notification = {
        id: result.rows[0].id,
        agentId: result.rows[0].agent_id,
        ownerId: result.rows[0].owner_id,
        type: result.rows[0].type,
        title: result.rows[0].title,
        message: result.rows[0].message,
        data: result.rows[0].data,
        read: result.rows[0].read,
        createdAt: result.rows[0].created_at,
      }

      // Store in pending notifications for bot → user path
      if (!this.pendingNotifications.has(agentId)) {
        this.pendingNotifications.set(agentId, [])
      }
      this.pendingNotifications.get(agentId)!.push(notification)

      // Broadcast via WebSocket if owner is connected
      if (ownerId && this.wsBroadcast) {
        this.wsBroadcast(ownerId, notification)
      }

      console.log(`[NotificationManager] Created notification: ${payload.type} for agent ${agentId}`)
      return notification
    } catch (err) {
      console.error('[NotificationManager] Failed to create notification:', (err as Error).message)
      return null
    }
  }

  // ── Bot → User Path (via heartbeat context) ─

  /**
   * Get pending notifications for an agent to include in heartbeat context.
   * This allows the bot to naturally mention events to the user.
   */
  getPendingForAgent(agentId: string): Notification[] {
    const pending = this.pendingNotifications.get(agentId) ?? []
    // Clear pending after retrieval (they've been "delivered" to the bot)
    this.pendingNotifications.set(agentId, [])
    return pending
  }

  // ── API Methods ────────────────────────────

  /**
   * Get notifications for an owner since a timestamp
   */
  async getNotifications(ownerId: string, since?: Date): Promise<Notification[]> {
    try {
      let query = `
        SELECT id, agent_id, owner_id, type, title, message, data, read, created_at
        FROM notifications
        WHERE owner_id = $1
      `
      const params: unknown[] = [ownerId]

      if (since) {
        query += ' AND created_at > $2'
        params.push(since)
      }

      query += ' ORDER BY created_at DESC LIMIT 100'

      const result = await this.pool.query<{
        id: string
        agent_id: string
        owner_id: string | null
        type: NotificationType
        title: string
        message: string
        data: Record<string, unknown>
        read: boolean
        created_at: Date
      }>(query, params)

      return result.rows.map(row => ({
        id: row.id,
        agentId: row.agent_id,
        ownerId: row.owner_id,
        type: row.type,
        title: row.title,
        message: row.message,
        data: row.data,
        read: row.read,
        createdAt: row.created_at,
      }))
    } catch (err) {
      console.error('[NotificationManager] Failed to get notifications:', (err as Error).message)
      return []
    }
  }

  /**
   * Get unread count for an owner
   */
  async getUnreadCount(ownerId: string): Promise<number> {
    try {
      const result = await this.pool.query<{ count: string }>(
        'SELECT COUNT(*) as count FROM notifications WHERE owner_id = $1 AND read = false',
        [ownerId]
      )
      return parseInt(result.rows[0]?.count ?? '0', 10)
    } catch (err) {
      console.error('[NotificationManager] Failed to get unread count:', (err as Error).message)
      return 0
    }
  }

  /**
   * Mark notifications as read
   */
  async markAsRead(ownerId: string, notificationIds: string[]): Promise<number> {
    if (notificationIds.length === 0) return 0

    try {
      const result = await this.pool.query(
        `UPDATE notifications SET read = true
         WHERE owner_id = $1 AND id = ANY($2::uuid[])`,
        [ownerId, notificationIds]
      )
      return result.rowCount ?? 0
    } catch (err) {
      console.error('[NotificationManager] Failed to mark as read:', (err as Error).message)
      return 0
    }
  }

  /**
   * Mark all notifications as read for an owner
   */
  async markAllAsRead(ownerId: string): Promise<number> {
    try {
      const result = await this.pool.query(
        'UPDATE notifications SET read = true WHERE owner_id = $1 AND read = false',
        [ownerId]
      )
      return result.rowCount ?? 0
    } catch (err) {
      console.error('[NotificationManager] Failed to mark all as read:', (err as Error).message)
      return 0
    }
  }

  // ── WebSocket Integration ──────────────────

  setWebSocketBroadcast(fn: (ownerId: string, notification: Notification) => void): void {
    this.wsBroadcast = fn
  }

  // ── Helpers ────────────────────────────────

  private isRareOrBetter(item: Item): boolean {
    const rareRarities = ['rare', 'epic', 'legendary', 'mythic']
    return rareRarities.includes(item.rarity ?? '')
  }

  // ── Cleanup ────────────────────────────────

  destroy(): void {
    if (this.offlineCheckInterval) {
      clearInterval(this.offlineCheckInterval)
    }
  }
}
