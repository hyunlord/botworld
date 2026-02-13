/**
 * Admin LLM Routes — Dashboard endpoints for LLM usage monitoring.
 * Protected by X-Admin-Key header (same as existing admin routes).
 */

import { Router } from 'express'
import type { LLMRouter } from '../llm/llm-router.js'

export function createAdminLLMRouter(llmRouter: LLMRouter): Router {
  const router = Router()

  /** GET /api/admin/llm/stats — Usage statistics */
  router.get('/admin/llm/stats', (req, res) => {
    const sinceParam = req.query.since as string | undefined
    let sinceMs: number | undefined

    if (sinceParam) {
      // Support: '1h', '6h', '24h', '7d', or raw milliseconds
      const match = sinceParam.match(/^(\d+)(h|d|m)$/)
      if (match) {
        const val = parseInt(match[1], 10)
        const unit = match[2]
        if (unit === 'h') sinceMs = val * 3600_000
        else if (unit === 'd') sinceMs = val * 86400_000
        else if (unit === 'm') sinceMs = val * 60_000
      } else {
        sinceMs = parseInt(sinceParam, 10) || undefined
      }
    }

    const stats = llmRouter.getStats(sinceMs)
    const providers = llmRouter.getProviderStatus()

    res.json({
      ...stats,
      providers,
      period: sinceParam || 'all_time',
      timestamp: new Date().toISOString(),
    })
  })

  /** GET /api/admin/llm/cost — Estimated OpenRouter cost breakdown */
  router.get('/admin/llm/cost', (req, res) => {
    const periods = [
      { label: 'last_1h', ms: 3600_000 },
      { label: 'last_6h', ms: 6 * 3600_000 },
      { label: 'last_24h', ms: 24 * 3600_000 },
      { label: 'last_7d', ms: 7 * 86400_000 },
    ]

    const breakdown = periods.map(p => {
      const stats = llmRouter.getStats(p.ms)
      return {
        period: p.label,
        total_calls: stats.total,
        openrouter_calls: stats.byProvider.openrouter?.calls ?? 0,
        local_calls: stats.byProvider.local?.calls ?? 0,
        estimated_cost_usd: stats.estimatedCost,
        savings_pct: stats.total > 0
          ? Math.round(((stats.byProvider.local?.calls ?? 0) / stats.total) * 100)
          : 0,
      }
    })

    const allTime = llmRouter.getStats()

    res.json({
      breakdown,
      all_time: {
        total_calls: allTime.total,
        estimated_cost_usd: allTime.estimatedCost,
        local_pct: allTime.total > 0
          ? Math.round(((allTime.byProvider.local?.calls ?? 0) / allTime.total) * 100)
          : 0,
      },
      timestamp: new Date().toISOString(),
    })
  })

  /** GET /api/admin/llm/logs — Recent usage log entries */
  router.get('/admin/llm/logs', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 500)
    const logs = llmRouter.getRecentLogs(limit)
    res.json({ logs, count: logs.length })
  })

  /** GET /api/admin/llm/providers — Provider status */
  router.get('/admin/llm/providers', (_req, res) => {
    const providers = llmRouter.getProviderStatus()
    res.json({ providers, timestamp: new Date().toISOString() })
  })

  return router
}
