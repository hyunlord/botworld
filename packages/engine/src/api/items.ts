import { Router } from 'express'
import type { ItemManager } from '../items/item-manager.js'
import type { AgentManager } from '../agent/agent-manager.js'
import type { NpcManager } from '../systems/npc-manager.js'

export function createItemsRouter(
  itemManager: ItemManager,
  agentManager: AgentManager,
  npcManager: NpcManager,
): Router {
  const router = Router()

  // ── GET /api/items/famous — Famous items ranking ──
  router.get('/items/famous', (_req, res) => {
    const famous = itemManager.getFamousItems()

    // Resolve owner names
    const resolveOwner = (ownerId?: string): string | undefined => {
      if (!ownerId) return undefined
      const agent = agentManager.getAgent(ownerId) ?? npcManager.getNpc(ownerId)
      return agent?.name
    }

    const resolveEntries = (entries: typeof famous.mostEventful) =>
      entries.map(e => {
        const item = itemManager.getItem(e.id)
        return { ...e, ownerName: resolveOwner(item?.ownerId) }
      })

    res.json({
      mostEventful: resolveEntries(famous.mostEventful),
      oldest: resolveEntries(famous.oldest),
      mostBattleTested: resolveEntries(famous.mostBattleTested),
      mostExpensiveTrade: resolveEntries(famous.mostExpensiveTrade),
      totalItems: itemManager.size,
    })
  })

  // ── GET /api/items/:id — Item detail with full history ──
  router.get('/items/:id', (req, res) => {
    const item = itemManager.getItem(req.params.id)
    if (!item) {
      res.status(404).json({ error: 'Item not found' })
      return
    }

    // Resolve owner name
    const owner = item.ownerId
      ? (agentManager.getAgent(item.ownerId) ?? npcManager.getNpc(item.ownerId))
      : null

    res.json({
      ...item,
      ownerName: owner?.name ?? null,
      displayName: item.customName ?? item.name,
      isDestroyed: item.durability <= 0,
      durabilityPercent: item.maxDurability > 0
        ? Math.round((item.durability / item.maxDurability) * 100)
        : 0,
    })
  })

  // ── GET /api/market/prices — All item market prices ──
  router.get('/market/prices', (_req, res) => {
    const prices = itemManager.getMarketPrices()
    res.json({ prices })
  })

  // ── GET /api/agents/:id/inventory — Agent inventory with rich item data ──
  router.get('/agents/:id/inventory', (req, res) => {
    const agent = agentManager.getAgent(req.params.id) ?? npcManager.getNpc(req.params.id)
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' })
      return
    }

    // Get rich items owned by this agent
    const richItems = itemManager.getItemsByOwner(req.params.id)

    // Also include legacy inventory items not in ItemManager
    const legacyItems = agent.inventory.filter(
      i => !i.richItemId && !richItems.some(r => r.id === i.id),
    )

    res.json({
      agentId: agent.id,
      agentName: agent.name,
      richItems: richItems.map(item => ({
        ...item,
        displayName: item.customName ?? item.name,
        durabilityPercent: item.maxDurability > 0
          ? Math.round((item.durability / item.maxDurability) * 100)
          : 0,
      })),
      legacyItems,
    })
  })

  return router
}
