import { Router } from 'express'
import type { WorldEngine } from '../core/world-engine.js'
import type {
  RankingCategory,
  RankingsSnapshot,
  ItemRankings,
  AgentRankingStats,
  WorldRecord,
  WorldStatistics,
  TimelineEvent,
} from '@botworld/shared'

export function createRankingsRouter(world: WorldEngine): Router {
  const router = Router()

  /** GET /rankings - Get full rankings snapshot */
  router.get('/rankings', (_req, res) => {
    try {
      const rankings = (world as any).rankingManager?.getRankings() as RankingsSnapshot | undefined
      if (!rankings) {
        return res.status(501).json({ error: 'Ranking system not yet implemented' })
      }
      res.json(rankings)
    } catch (error) {
      console.error('Error fetching rankings:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  /** GET /rankings/:category - Get rankings for specific category */
  router.get('/rankings/:category', (req, res) => {
    try {
      const { category } = req.params
      const validCategories: RankingCategory[] = [
        'combat', 'economy', 'crafting', 'exploration', 'social', 'overall', 'items'
      ]

      if (!validCategories.includes(category as RankingCategory)) {
        return res.status(400).json({
          error: 'Invalid category',
          validCategories,
        })
      }

      const rankings = (world as any).rankingManager?.getRankings() as RankingsSnapshot | undefined
      if (!rankings) {
        return res.status(501).json({ error: 'Ranking system not yet implemented' })
      }

      // Items category handled separately
      if (category === 'items') {
        const itemRankings = (world as any).rankingManager?.getItemRankings() as ItemRankings | undefined
        return res.json({ category, rankings: itemRankings })
      }

      const categoryRankings = rankings[category as keyof Omit<RankingsSnapshot, 'items'>]
      res.json({ category, rankings: categoryRankings })
    } catch (error) {
      console.error('Error fetching category rankings:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  /** GET /rankings/items - Get item rankings */
  router.get('/rankings/items', (_req, res) => {
    try {
      const itemRankings = (world as any).rankingManager?.getItemRankings() as ItemRankings | undefined
      if (!itemRankings) {
        return res.status(501).json({ error: 'Item ranking system not yet implemented' })
      }
      res.json(itemRankings)
    } catch (error) {
      console.error('Error fetching item rankings:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  /** GET /rankings/agent/:agentId - Get ranking stats for specific agent */
  router.get('/rankings/agent/:agentId', (req, res) => {
    try {
      const { agentId } = req.params
      const agentStats = (world as any).rankingManager?.getAgentStats(agentId) as AgentRankingStats | null | undefined

      if (!agentStats) {
        return res.status(404).json({ error: 'Agent not found or ranking system not implemented' })
      }

      res.json(agentStats)
    } catch (error) {
      console.error('Error fetching agent stats:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  /** GET /rankings/compare/:agentId1/:agentId2 - Compare two agents */
  router.get('/rankings/compare/:agentId1/:agentId2', (req, res) => {
    try {
      const { agentId1, agentId2 } = req.params

      const stats1 = (world as any).rankingManager?.getAgentStats(agentId1) as AgentRankingStats | null | undefined
      const stats2 = (world as any).rankingManager?.getAgentStats(agentId2) as AgentRankingStats | null | undefined

      if (!stats1 || !stats2) {
        return res.status(404).json({ error: 'One or both agents not found' })
      }

      // Head-to-head record placeholder - would need combat history system
      const headToHead = {
        wins: 0,
        losses: 0,
        draws: 0,
      }

      res.json({
        agent1: stats1,
        agent2: stats2,
        headToHead,
      })
    } catch (error) {
      console.error('Error comparing agents:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  /** GET /records - Get all world records */
  router.get('/records', (_req, res) => {
    try {
      const records = (world as any).worldRecordManager?.getRecords() as WorldRecord[] | undefined
      if (!records) {
        return res.status(501).json({ error: 'World record system not yet implemented' })
      }
      res.json({ records })
    } catch (error) {
      console.error('Error fetching world records:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  /** GET /records/:category - Get specific world record by category */
  router.get('/records/:category', (req, res) => {
    try {
      const { category } = req.params
      const records = (world as any).worldRecordManager?.getRecords() as WorldRecord[] | undefined

      if (!records) {
        return res.status(501).json({ error: 'World record system not yet implemented' })
      }

      const record = records.find(r => r.category === category)
      if (!record) {
        return res.status(404).json({ error: 'Record not found for category' })
      }

      res.json(record)
    } catch (error) {
      console.error('Error fetching world record:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  /** GET /statistics - Get full statistics snapshot */
  router.get('/statistics', (_req, res) => {
    try {
      const statistics = (world as any).statisticsCollector?.getStatistics() as WorldStatistics | undefined
      if (!statistics) {
        return res.status(501).json({ error: 'Statistics system not yet implemented' })
      }
      res.json(statistics)
    } catch (error) {
      console.error('Error fetching statistics:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  /** GET /statistics/:tab - Get statistics for specific tab */
  router.get('/statistics/:tab', (req, res) => {
    try {
      const { tab } = req.params
      const validTabs = ['economy', 'combat', 'population', 'ecology', 'politics']

      if (!validTabs.includes(tab)) {
        return res.status(400).json({
          error: 'Invalid tab',
          validTabs,
        })
      }

      const statistics = (world as any).statisticsCollector?.getStatistics() as WorldStatistics | undefined
      if (!statistics) {
        return res.status(501).json({ error: 'Statistics system not yet implemented' })
      }

      const tabData = statistics[tab as keyof Omit<WorldStatistics, 'lastUpdated'>]
      res.json({ tab, data: tabData, lastUpdated: statistics.lastUpdated })
    } catch (error) {
      console.error('Error fetching statistics tab:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  /** GET /timeline - Get timeline events with optional filters */
  router.get('/timeline', (req, res) => {
    try {
      const { from, to, category } = req.query

      // Try statisticsCollector first, fall back to worldHistoryManager
      let events = (world as any).statisticsCollector?.getTimelineEvents?.() as TimelineEvent[] | undefined

      if (!events) {
        // Fallback to world history manager if available
        events = (world as any).worldHistoryManager?.getTimelineEvents?.() as TimelineEvent[] | undefined
      }

      if (!events) {
        return res.status(501).json({ error: 'Timeline system not yet implemented' })
      }

      // Apply filters
      let filteredEvents = events

      if (from !== undefined) {
        const fromTick = parseInt(from as string, 10)
        if (!isNaN(fromTick)) {
          filteredEvents = filteredEvents.filter(e => e.tick >= fromTick)
        }
      }

      if (to !== undefined) {
        const toTick = parseInt(to as string, 10)
        if (!isNaN(toTick)) {
          filteredEvents = filteredEvents.filter(e => e.tick <= toTick)
        }
      }

      if (category) {
        filteredEvents = filteredEvents.filter(e => e.category === category)
      }

      res.json({ events: filteredEvents, total: filteredEvents.length })
    } catch (error) {
      console.error('Error fetching timeline:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  return router
}
