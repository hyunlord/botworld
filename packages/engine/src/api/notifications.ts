import { type Router as IRouter, Router } from 'express'
import type { NotificationManager } from '../systems/notifications.js'
import { validateOwnerSession } from '../auth/session.js'
import { requireAuth } from '../auth/middleware.js'

// ──────────────────────────────────────────────
// Notification Router Factory
// ──────────────────────────────────────────────

export function createNotificationRouter(notificationManager: NotificationManager): IRouter {
  const router = Router()

  // ── Owner Auth Middleware ────────────────────

  const requireOwnerAuth = (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction
  ) => {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authorization header required' })
      return
    }

    const token = authHeader.slice(7)
    const session = validateOwnerSession(token)

    if (!session) {
      res.status(401).json({ error: 'Invalid or expired session' })
      return
    }

    // Attach owner info to request
    ;(req as any).ownerId = session.ownerId
    ;(req as any).ownerEmail = session.email
    next()
  }

  // ──────────────────────────────────────────────
  // GET /api/me/notifications — Get notifications
  // ──────────────────────────────────────────────

  router.get('/me/notifications', requireOwnerAuth, async (req, res) => {
    const ownerId = (req as any).ownerId as string
    const since = req.query.since ? new Date(req.query.since as string) : undefined

    // Validate since date if provided
    if (req.query.since && isNaN(since!.getTime())) {
      res.status(400).json({ error: 'Invalid since parameter. Use ISO 8601 format.' })
      return
    }

    const notifications = await notificationManager.getNotifications(ownerId, since)
    const unreadCount = await notificationManager.getUnreadCount(ownerId)

    res.json({
      notifications,
      unreadCount,
      since: since?.toISOString() ?? null,
    })
  })

  // ──────────────────────────────────────────────
  // GET /api/me/notifications/unread-count
  // ──────────────────────────────────────────────

  router.get('/me/notifications/unread-count', requireOwnerAuth, async (req, res) => {
    const ownerId = (req as any).ownerId as string
    const count = await notificationManager.getUnreadCount(ownerId)

    res.json({ unreadCount: count })
  })

  // ──────────────────────────────────────────────
  // POST /api/me/notifications/read — Mark as read
  // ──────────────────────────────────────────────

  router.post('/me/notifications/read', requireOwnerAuth, async (req, res) => {
    const ownerId = (req as any).ownerId as string
    const { ids } = req.body as { ids?: string[] }

    if (!ids || !Array.isArray(ids)) {
      res.status(400).json({ error: 'ids array is required' })
      return
    }

    if (ids.length === 0) {
      res.status(400).json({ error: 'ids array cannot be empty' })
      return
    }

    if (ids.length > 100) {
      res.status(400).json({ error: 'Maximum 100 ids per request' })
      return
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    for (const id of ids) {
      if (typeof id !== 'string' || !uuidRegex.test(id)) {
        res.status(400).json({ error: `Invalid notification id: ${id}` })
        return
      }
    }

    const updated = await notificationManager.markAsRead(ownerId, ids)

    res.json({
      message: 'Notifications marked as read',
      updated,
    })
  })

  // ──────────────────────────────────────────────
  // POST /api/me/notifications/read-all
  // ──────────────────────────────────────────────

  router.post('/me/notifications/read-all', requireOwnerAuth, async (req, res) => {
    const ownerId = (req as any).ownerId as string
    const updated = await notificationManager.markAllAsRead(ownerId)

    res.json({
      message: 'All notifications marked as read',
      updated,
    })
  })

  // ──────────────────────────────────────────────
  // GET /api/me/notifications/pending — For bots (agent auth)
  // ──────────────────────────────────────────────

  router.get('/me/notifications/pending', requireAuth, async (req, res) => {
    const agentId = (req as any).agent?.id as string

    if (!agentId) {
      res.status(401).json({ error: 'Agent authentication required' })
      return
    }

    // Get pending notifications for this agent
    const pending = notificationManager.getPendingForAgent(agentId)

    res.json({
      notifications: pending.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        data: n.data,
        createdAt: n.createdAt,
      })),
    })
  })

  return router
}
