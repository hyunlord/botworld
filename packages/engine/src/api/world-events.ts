import { type Router as IRouter, Router, type Request, type Response } from 'express'
import type { WorldEngine } from '../core/world-engine.js'

export function createWorldEventsRouter(world: WorldEngine): IRouter {
  const router = Router()

  // ── GET /world/events ──
  router.get('/world/events', (_req: Request, res: Response) => {
    const events = world.worldEvents.getActiveEvents()
    res.json({
      events: events.map(e => ({
        id: e.id,
        type: e.type,
        category: e.category,
        title: e.title,
        description: e.description,
        position: e.position,
        radius: e.radius,
        effects: e.effects,
        ticksRemaining: e.ticksRemaining,
        duration: e.duration,
        startedAt: e.startedAt,
        expiresAt: e.expiresAt,
      })),
    })
  })

  // ── GET /world/events/:id ──
  router.get('/world/events/:id', (req: Request, res: Response) => {
    const eventId = req.params.id as string
    const event = world.worldEvents.getEvent(eventId)

    if (!event) {
      res.status(404).json({ error: 'Event not found or expired' })
      return
    }

    res.json({
      id: event.id,
      type: event.type,
      category: event.category,
      title: event.title,
      description: event.description,
      position: event.position,
      radius: event.radius,
      effects: event.effects,
      ticksRemaining: event.ticksRemaining,
      duration: event.duration,
      startedAt: event.startedAt,
      expiresAt: event.expiresAt,
    })
  })

  return router
}
