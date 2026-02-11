import type { Item } from '@botworld/shared'
import { MARKET_FEE_RATE } from '@botworld/shared'
import { contentFilter } from '../security/content-filter.js'
import type { AgentManager } from '../agent/agent-manager.js'
import type { TileMap } from '../world/tile-map.js'

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface MarketListing {
  id: string
  sellerId: string
  sellerName: string
  item: Item
  pricePerUnit: number
  quantity: number
  createdAt: number
}

export interface BuyResult {
  success: boolean
  listing?: MarketListing
  totalPrice?: number
  fee?: number
  reason?: string
}

// ──────────────────────────────────────────────
// Marketplace
// ──────────────────────────────────────────────

export class Marketplace {
  private listings = new Map<string, MarketListing>()
  private counter = 0

  constructor(
    private agentManager: AgentManager,
    private tileMap: TileMap,
  ) {}

  /** Check if agent is within 3 tiles of any marketplace POI */
  isNearMarketplace(agentId: string): boolean {
    const agent = this.agentManager.getAgent(agentId)
    if (!agent) return false
    const marketPois = this.tileMap.pois.filter(p => p.type === 'marketplace')
    return marketPois.some(poi => {
      const dx = agent.position.x - poi.position.x
      const dy = agent.position.y - poi.position.y
      return Math.abs(dx) <= 3 && Math.abs(dy) <= 3
    })
  }

  /** List an item for sale */
  async listItem(
    sellerId: string,
    itemId: string,
    quantity: number,
    pricePerUnit: number,
  ): Promise<{ success: boolean; listingId?: string; reason?: string }> {
    const agent = this.agentManager.getAgent(sellerId)
    if (!agent) return { success: false, reason: 'Agent not found' }

    if (pricePerUnit <= 0) return { success: false, reason: 'Price must be positive' }
    if (quantity <= 0 || !Number.isInteger(quantity)) {
      return { success: false, reason: 'Quantity must be a positive integer' }
    }

    const item = agent.inventory.find(i => i.id === itemId)
    if (!item || item.quantity < quantity) {
      return { success: false, reason: 'Insufficient item quantity' }
    }

    // ContentFilter: validate item name
    const nameCheck = await contentFilter.filterMessage(sellerId, item.name)
    if (!nameCheck.allowed) {
      return { success: false, reason: 'Item name blocked by content filter' }
    }
    if (item.description) {
      const descCheck = await contentFilter.filterMessage(sellerId, item.description)
      if (!descCheck.allowed) {
        return { success: false, reason: 'Item description blocked by content filter' }
      }
    }

    // Deduct from seller inventory
    item.quantity -= quantity
    if (item.quantity <= 0) {
      agent.inventory = agent.inventory.filter(i => i.quantity > 0)
    }

    const id = `listing_${++this.counter}`
    const listing: MarketListing = {
      id,
      sellerId,
      sellerName: agent.name,
      item: { ...item, quantity },
      pricePerUnit,
      quantity,
      createdAt: Date.now(),
    }
    this.listings.set(id, listing)

    return { success: true, listingId: id }
  }

  /** Get all listings with optional filters */
  getListings(filter?: { itemType?: string; sellerId?: string }): MarketListing[] {
    let results = Array.from(this.listings.values())
    if (filter?.itemType) {
      results = results.filter(l => l.item.type === filter.itemType)
    }
    if (filter?.sellerId) {
      results = results.filter(l => l.sellerId === filter.sellerId)
    }
    return results.sort((a, b) => a.pricePerUnit - b.pricePerUnit)
  }

  /** Buy from a listing */
  buyItem(buyerId: string, listingId: string, quantity?: number): BuyResult {
    const listing = this.listings.get(listingId)
    if (!listing) return { success: false, reason: 'Listing not found' }

    const buyQty = quantity ?? listing.quantity
    if (buyQty <= 0 || buyQty > listing.quantity) {
      return { success: false, reason: 'Invalid quantity' }
    }

    if (listing.sellerId === buyerId) {
      return { success: false, reason: 'Cannot buy your own listing' }
    }

    const buyer = this.agentManager.getAgent(buyerId)
    if (!buyer) return { success: false, reason: 'Buyer not found' }

    const totalPrice = listing.pricePerUnit * buyQty
    const fee = Math.ceil(totalPrice * MARKET_FEE_RATE)

    // Check buyer has enough gold
    const wallet = buyer.inventory.find(i => i.type === 'currency')
    const buyerGold = wallet?.quantity ?? 0
    if (buyerGold < totalPrice + fee) {
      return {
        success: false,
        reason: `Not enough gold. Need ${totalPrice + fee}, have ${buyerGold}`,
      }
    }

    // Deduct gold from buyer
    wallet!.quantity -= (totalPrice + fee)
    if (wallet!.quantity <= 0) {
      buyer.inventory = buyer.inventory.filter(i => i.quantity > 0)
    }

    // Give item to buyer
    const existingItem = buyer.inventory.find(
      i => i.name === listing.item.name && i.type === listing.item.type,
    )
    if (existingItem) {
      existingItem.quantity += buyQty
    } else {
      buyer.inventory.push({
        ...listing.item,
        id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        quantity: buyQty,
      })
    }

    // Pay seller (without fee)
    const seller = this.agentManager.getAgent(listing.sellerId)
    if (seller) {
      const sellerWallet = seller.inventory.find(i => i.type === 'currency')
      if (sellerWallet) {
        sellerWallet.quantity += totalPrice
      } else {
        seller.inventory.push({
          id: `item_${Date.now()}_gold`,
          type: 'currency',
          name: 'Gold',
          quantity: totalPrice,
        })
      }
    }

    // Update or remove listing
    listing.quantity -= buyQty
    if (listing.quantity <= 0) {
      this.listings.delete(listingId)
    }

    return { success: true, listing, totalPrice, fee }
  }

  /** Cancel a listing (seller only) */
  cancelListing(
    sellerId: string,
    listingId: string,
  ): { success: boolean; reason?: string } {
    const listing = this.listings.get(listingId)
    if (!listing) return { success: false, reason: 'Listing not found' }
    if (listing.sellerId !== sellerId) return { success: false, reason: 'Not your listing' }

    // Return items to seller
    const seller = this.agentManager.getAgent(sellerId)
    if (seller) {
      const existing = seller.inventory.find(i => i.name === listing.item.name)
      if (existing) {
        existing.quantity += listing.quantity
      } else {
        seller.inventory.push({ ...listing.item })
      }
    }

    this.listings.delete(listingId)
    return { success: true }
  }
}
