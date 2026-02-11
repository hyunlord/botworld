import { Router, type Request, type Response } from 'express'
import { requireAuth } from '../auth/middleware.js'
import type { Marketplace } from '../systems/marketplace.js'

export function createMarketRouter(marketplace: Marketplace): Router {
  const router = Router()

  // ── POST /market/list ── (list item for sale)
  router.post('/market/list',
    requireAuth(),
    async (req: Request, res: Response) => {
      const agentId = req.agent!.id

      if (!marketplace.isNearMarketplace(agentId)) {
        res.status(400).json({ error: 'Must be near a marketplace POI' })
        return
      }

      const { itemId, quantity, pricePerUnit } = req.body
      if (!itemId || typeof quantity !== 'number' || typeof pricePerUnit !== 'number') {
        res.status(400).json({ error: 'itemId, quantity (number), pricePerUnit (number) required' })
        return
      }

      const result = await marketplace.listItem(agentId, itemId, quantity, pricePerUnit)
      if (!result.success) {
        res.status(400).json({ error: result.reason })
        return
      }

      res.json({ listingId: result.listingId })
    },
  )

  // ── GET /market/listings ── (browse listings)
  router.get('/market/listings',
    requireAuth(),
    (req: Request, res: Response) => {
      const filter = {
        itemType: req.query.itemType as string | undefined,
        sellerId: req.query.sellerId as string | undefined,
      }
      res.json(marketplace.getListings(filter))
    },
  )

  // ── POST /market/buy ── (purchase from listing)
  router.post('/market/buy',
    requireAuth(),
    (req: Request, res: Response) => {
      const agentId = req.agent!.id

      if (!marketplace.isNearMarketplace(agentId)) {
        res.status(400).json({ error: 'Must be near a marketplace POI' })
        return
      }

      const { listingId, quantity } = req.body
      if (!listingId) {
        res.status(400).json({ error: 'listingId required' })
        return
      }

      const result = marketplace.buyItem(agentId, listingId, quantity)
      if (!result.success) {
        res.status(400).json({ error: result.reason })
        return
      }

      res.json({ totalPrice: result.totalPrice, fee: result.fee })
    },
  )

  // ── POST /market/cancel ── (cancel your listing)
  router.post('/market/cancel',
    requireAuth(),
    (req: Request, res: Response) => {
      const { listingId } = req.body
      if (!listingId) {
        res.status(400).json({ error: 'listingId required' })
        return
      }

      const result = marketplace.cancelListing(req.agent!.id, listingId)
      if (!result.success) {
        res.status(400).json({ error: result.reason })
        return
      }

      res.json({ cancelled: true })
    },
  )

  return router
}
