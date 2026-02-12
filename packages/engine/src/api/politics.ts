/**
 * Politics API routes — guilds, settlements, kingdoms, treaties, wars.
 */

import { Router } from 'express'
import type { GuildManager } from '../politics/guild-manager.js'
import type { SettlementManager } from '../politics/settlement-manager.js'
import type { KingdomManager } from '../politics/kingdom-manager.js'

export function createPoliticsRouter(
  guildManager: GuildManager,
  settlementManager: SettlementManager,
  kingdomManager: KingdomManager,
  getAgentName: (id: string) => string,
): Router {
  const router = Router()

  // ── Guilds ──

  // GET /api/guilds — all guilds
  router.get('/guilds', (_req, res) => {
    const guilds = guildManager.getAllGuilds()
    res.json({ count: guilds.length, guilds })
  })

  // GET /api/guilds/:id — single guild detail
  router.get('/guilds/:id', (req, res) => {
    const guild = guildManager.getGuild(req.params.id)
    if (!guild) {
      res.status(404).json({ error: 'Guild not found' })
      return
    }
    res.json(guild)
  })

  // GET /api/agents/:id/guild — agent's guild
  router.get('/agents/:id/guild', (req, res) => {
    const guild = guildManager.getAgentGuild(req.params.id)
    if (!guild) {
      res.json({ agentId: req.params.id, guild: null })
      return
    }
    const rank = guildManager.getAgentRank(req.params.id)
    res.json({ agentId: req.params.id, guild, rank })
  })

  // POST /api/guilds — found a guild
  router.post('/guilds', (req, res) => {
    const { founderIds, type, name, motto, tick } = req.body as {
      founderIds: string[]; type: string; name?: string; motto?: string; tick: number
    }
    if (!founderIds || founderIds.length < 3 || !type) {
      res.status(400).json({ error: 'Need at least 3 founders and a type' })
      return
    }
    const guild = guildManager.foundGuild(
      founderIds, type as any, tick ?? 0, getAgentName, name, motto,
    )
    if (!guild) {
      res.status(400).json({ error: 'Could not found guild (members may already be in a guild)' })
      return
    }
    res.status(201).json(guild)
  })

  // POST /api/guilds/:id/members — add member
  router.post('/guilds/:id/members', (req, res) => {
    const { agentId, tick } = req.body as { agentId: string; tick: number }
    const ok = guildManager.addMember(req.params.id, agentId, tick ?? 0)
    if (!ok) {
      res.status(400).json({ error: 'Could not add member' })
      return
    }
    res.json({ success: true })
  })

  // DELETE /api/guilds/:guildId/members/:agentId — remove member
  router.delete('/guilds/:guildId/members/:agentId', (req, res) => {
    const ok = guildManager.removeMember(req.params.agentId, 0)
    if (!ok) {
      res.status(400).json({ error: 'Could not remove member' })
      return
    }
    res.json({ success: true })
  })

  // POST /api/guilds/:id/merge — merge with another guild
  router.post('/guilds/:id/merge', (req, res) => {
    const { otherGuildId, tick } = req.body as { otherGuildId: string; tick: number }
    const result = guildManager.mergeGuilds(req.params.id, otherGuildId, tick ?? 0, getAgentName)
    if (!result) {
      res.status(400).json({ error: 'Could not merge guilds' })
      return
    }
    res.json(result)
  })

  // ── Settlements ──

  // GET /api/settlements — all settlements
  router.get('/settlements', (_req, res) => {
    const settlements = settlementManager.getAllSettlements()
    res.json({ count: settlements.length, settlements })
  })

  // GET /api/settlements/:id — single settlement detail
  router.get('/settlements/:id', (req, res) => {
    const settlement = settlementManager.getSettlement(req.params.id)
    if (!settlement) {
      res.status(404).json({ error: 'Settlement not found' })
      return
    }
    res.json(settlement)
  })

  // GET /api/agents/:id/settlement — agent's settlement
  router.get('/agents/:id/settlement', (req, res) => {
    const settlement = settlementManager.getAgentSettlement(req.params.id)
    res.json({ agentId: req.params.id, settlement: settlement ?? null })
  })

  // POST /api/settlements — create a settlement
  router.post('/settlements', (req, res) => {
    const { poiId, founderIds, tick, poiName } = req.body as {
      poiId: string; founderIds: string[]; tick: number; poiName?: string
    }
    if (!poiId || !founderIds || founderIds.length === 0) {
      res.status(400).json({ error: 'Need poiId and at least one founder' })
      return
    }
    const settlement = settlementManager.createSettlement(poiId, founderIds, tick ?? 0, poiName)
    res.status(201).json(settlement)
  })

  // POST /api/settlements/:id/laws — propose a law
  router.post('/settlements/:id/laws', (req, res) => {
    const { proposerId, type, description, value, tick } = req.body as {
      proposerId: string; type: string; description: string; value: string | number; tick: number
    }
    const ok = settlementManager.proposeLaw(
      req.params.id, proposerId,
      { type: type as any, description, value },
      tick ?? 0,
    )
    if (!ok) {
      res.status(400).json({ error: 'Could not enact law' })
      return
    }
    res.json({ success: true })
  })

  // ── Kingdoms ──

  // GET /api/kingdoms — all kingdoms
  router.get('/kingdoms', (_req, res) => {
    const kingdoms = kingdomManager.getAllKingdoms()
    res.json({ count: kingdoms.length, kingdoms })
  })

  // GET /api/kingdoms/:id — single kingdom detail
  router.get('/kingdoms/:id', (req, res) => {
    const kingdom = kingdomManager.getKingdom(req.params.id)
    if (!kingdom) {
      res.status(404).json({ error: 'Kingdom not found' })
      return
    }
    res.json(kingdom)
  })

  // POST /api/kingdoms — found a kingdom
  router.post('/kingdoms', (req, res) => {
    const { settlementIds, rulerId, tick, name } = req.body as {
      settlementIds: string[]; rulerId: string; tick: number; name?: string
    }
    if (!settlementIds || settlementIds.length < 2 || !rulerId) {
      res.status(400).json({ error: 'Need 2+ settlements and a ruler' })
      return
    }
    const kingdom = kingdomManager.foundKingdom(settlementIds, rulerId, tick ?? 0, getAgentName, name)
    if (!kingdom) {
      res.status(400).json({ error: 'Could not found kingdom' })
      return
    }
    res.status(201).json(kingdom)
  })

  // ── Treaties ──

  // GET /api/treaties — all treaties
  router.get('/treaties', (_req, res) => {
    const treaties = kingdomManager.getAllTreaties()
    res.json({ count: treaties.length, treaties })
  })

  // POST /api/treaties — sign a treaty
  router.post('/treaties', (req, res) => {
    const { partyAId, partyBId, type, terms, durationTicks, tick } = req.body as {
      partyAId: string; partyBId: string; type: string; terms: string[]
      durationTicks: number; tick: number
    }
    const getKName = (id: string) => kingdomManager.getKingdom(id)?.name ?? 'Unknown'
    const treaty = kingdomManager.signTreaty(
      partyAId, partyBId, type as any, terms ?? [],
      durationTicks ?? 50000, tick ?? 0, getKName,
    )
    if (!treaty) {
      res.status(400).json({ error: 'Could not sign treaty' })
      return
    }
    res.status(201).json(treaty)
  })

  // ── Wars ──

  // GET /api/wars — all wars
  router.get('/wars', (_req, res) => {
    const wars = kingdomManager.getAllWars()
    res.json({ count: wars.length, wars })
  })

  // POST /api/wars — declare war
  router.post('/wars', (req, res) => {
    const { attackerId, defenderId, casusBelli, goal, tick } = req.body as {
      attackerId: string; defenderId: string; casusBelli: string; goal: string; tick: number
    }
    const getKName = (id: string) => kingdomManager.getKingdom(id)?.name ?? 'Unknown'
    const war = kingdomManager.declareWar(
      attackerId, defenderId, casusBelli ?? '', goal as any ?? 'territory',
      tick ?? 0, getKName,
    )
    if (!war) {
      res.status(400).json({ error: 'Could not declare war' })
      return
    }
    res.status(201).json(war)
  })

  // POST /api/wars/:id/end — end a war
  router.post('/wars/:id/end', (req, res) => {
    const { tick, terms, winnerId } = req.body as {
      tick: number; terms?: string[]; winnerId?: string
    }
    kingdomManager.endWar(req.params.id, tick ?? 0, terms ?? null, winnerId ?? null)
    res.json({ success: true })
  })

  // GET /api/politics/summary — overview of all political entities
  router.get('/politics/summary', (_req, res) => {
    res.json({
      guilds: guildManager.getAllGuilds().map(g => ({
        id: g.id, name: g.name, type: g.type, members: g.members.length,
        leader: g.leaderId, treasury: g.treasury,
      })),
      settlements: settlementManager.getAllSettlements().map(s => ({
        id: s.id, name: s.name, type: s.type, population: s.residents.length,
        leader: s.leaderId, allegiance: s.allegiance,
      })),
      kingdoms: kingdomManager.getAllKingdoms().map(k => ({
        id: k.id, name: k.name, ruler: k.rulerId,
        settlements: k.settlements.length,
        diplomacy: k.diplomacy,
      })),
      activeWars: kingdomManager.getAllWars().filter(w => w.status === 'active').length,
      activeTreaties: kingdomManager.getAllTreaties().filter(t => t.status === 'active').length,
    })
  })

  return router
}
