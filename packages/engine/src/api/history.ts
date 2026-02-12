/**
 * History API — world history timeline endpoints.
 */

import { Router } from 'express'
import type { WorldEngine } from '../core/world-engine.js'

export function createHistoryRouter(world: WorldEngine): Router {
  const router = Router()

  /** GET /api/history — all history entries, optionally filtered */
  router.get('/history', (req, res) => {
    const minSig = parseInt(req.query.minSignificance as string, 10) || 0
    const type = req.query.type as string | undefined
    const participantId = req.query.participant as string | undefined
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200)

    let entries = world.historyManager.getAll()

    if (minSig > 0) {
      entries = entries.filter(e => e.significance >= minSig)
    }
    if (type) {
      entries = entries.filter(e => e.type === type)
    }
    if (participantId) {
      entries = entries.filter(e => e.participants.includes(participantId))
    }

    res.json({
      entries: entries.slice(0, limit),
      total: entries.length,
    })
  })

  /** GET /api/history/summary — recent significant events for homepage */
  router.get('/history/summary', (_req, res) => {
    const entries = world.historyManager.getBySignificance(5)
    res.json({
      entries: entries.slice(0, 10),
      totalSignificant: entries.length,
    })
  })

  return router
}
