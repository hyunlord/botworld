import type {
  RichItem, ItemTemplate, ItemProvenance, ItemHistoryEntry,
  ItemHistoryType, ItemQuality, ItemCategory, ItemLocation,
  FamousItemEntry, WorldClock, EquipmentStats, ConsumableEffect,
} from '@botworld/shared'
import {
  generateId,
  MARKET_UPDATE_INTERVAL, MARKET_PRICE_MIN_RATIO, MARKET_PRICE_MAX_RATIO,
} from '@botworld/shared'
import { getItemTemplate } from './item-templates.js'
import {
  calculateQualityScore, scoreToQuality,
  applyQualityToStats, applyQualityToConsumable, getQualityValue,
} from './quality.js'
import type { QualityInput } from './quality.js'
import type { EventBus } from '../core/event-bus.js'

// ── Demand tracking for dynamic pricing ──
interface DemandEntry {
  sold: number
  listed: number
}

export class ItemManager {
  private items = new Map<string, RichItem>()
  private lastMarketTick = 0
  private demandTracker = new Map<string, DemandEntry>()  // templateId → demand

  constructor(
    private eventBus: EventBus,
    private clockGetter: () => WorldClock,
  ) {}

  // ──────────────────────────────────────────────
  // Create items
  // ──────────────────────────────────────────────

  /**
   * Create a rich item from a template with provenance.
   * This is the canonical way to create items in the game.
   */
  createItem(
    templateId: string,
    provenance: ItemProvenance,
    opts?: {
      quality?: ItemQuality
      qualityInput?: QualityInput
      ownerId?: string
      location?: ItemLocation
      customName?: string
      description?: string
      consumableEffect?: ConsumableEffect
      bookContent?: RichItem['bookContent']
      trophySource?: string
    },
  ): RichItem | null {
    const template = getItemTemplate(templateId)
    if (!template) {
      // Fallback: create a generic item for unknown templates
      return this.createGenericItem(templateId, provenance, opts)
    }

    const clock = this.clockGetter()

    // Determine quality
    let quality: ItemQuality
    if (opts?.quality) {
      quality = opts.quality
    } else if (opts?.qualityInput) {
      const score = calculateQualityScore(opts.qualityInput)
      quality = scoreToQuality(score)
    } else {
      quality = 'basic'
    }

    // Apply quality to stats
    const stats = applyQualityToStats(template.baseStats, quality)
    const durability = Math.round(template.baseDurability * (quality === 'legendary' ? 1.5 : quality === 'masterwork' ? 1.3 : 1.0))
    const baseValue = getQualityValue(template.baseValue, quality)

    // Consumable effect (quality-adjusted)
    const consumable = opts?.consumableEffect
      ?? (template.consumableEffect ? applyQualityToConsumable(template.consumableEffect, quality) : undefined)

    const item: RichItem = {
      id: generateId('item'),
      templateId,
      name: template.name,
      customName: opts?.customName,
      description: opts?.description ?? template.description,
      category: template.category,
      subtype: template.subtype,

      quality,
      durability,
      maxDurability: durability,

      stats,
      modifiers: [],

      ownerId: opts?.ownerId,
      location: opts?.location ?? { type: 'inventory', ownerId: opts?.ownerId },

      provenance,
      history: [],

      baseValue,
      marketValue: baseValue,
      sentimentalValue: 0,

      createdAt: clock.tick,

      consumableEffect: consumable,
      bookContent: opts?.bookContent ?? template.bookContent,
      trophySource: opts?.trophySource,
    }

    // Add creation history entry
    const creatorName = this.getProvenanceCreatorName(provenance)
    item.history.push({
      tick: clock.tick,
      type: 'created',
      text: this.getCreationText(item, provenance),
      agent: creatorName,
      details: { quality, templateId },
    })

    this.items.set(item.id, item)

    return item
  }

  /**
   * Create a generic item for template IDs not in the template database.
   */
  private createGenericItem(
    templateId: string,
    provenance: ItemProvenance,
    opts?: {
      quality?: ItemQuality
      ownerId?: string
      location?: ItemLocation
      customName?: string
      description?: string
      consumableEffect?: ConsumableEffect
    },
  ): RichItem {
    const clock = this.clockGetter()
    const quality = opts?.quality ?? 'basic'
    const name = templateId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

    const item: RichItem = {
      id: generateId('item'),
      templateId,
      name,
      customName: opts?.customName,
      description: opts?.description,
      category: 'material',
      quality,
      durability: 1,
      maxDurability: 1,
      stats: {},
      modifiers: [],
      ownerId: opts?.ownerId,
      location: opts?.location ?? { type: 'inventory', ownerId: opts?.ownerId },
      provenance,
      history: [{
        tick: clock.tick,
        type: 'created',
        text: `${name} appeared in the world`,
        details: { templateId },
      }],
      baseValue: 5,
      marketValue: 5,
      sentimentalValue: 0,
      createdAt: clock.tick,
      consumableEffect: opts?.consumableEffect,
    }

    this.items.set(item.id, item)
    return item
  }

  // ──────────────────────────────────────────────
  // History tracking
  // ──────────────────────────────────────────────

  /**
   * Append a history entry to an item. This is the primary API for tracking item events.
   */
  addHistory(
    itemId: string,
    type: ItemHistoryType,
    text: string,
    agent?: string,
    details?: Record<string, unknown>,
  ): void {
    const item = this.items.get(itemId)
    if (!item) return

    const clock = this.clockGetter()
    item.history.push({ tick: clock.tick, type, text, agent, details })

    // Auto-trigger naming check after combat uses
    if (type === 'used_in_combat') {
      const combatUses = item.history.filter(h => h.type === 'used_in_combat').length
      if (combatUses === 3 && !item.customName) {
        this.eventBus.emit({
          type: 'item:naming_candidate',
          itemId: item.id,
          reason: 'combat_veteran',
          timestamp: clock.tick,
        })
      }
    }

    // Track sentimental value growth
    if (['used_in_combat', 'repaired', 'named', 'gifted', 'inherited'].includes(type)) {
      item.sentimentalValue += type === 'named' ? 20 : type === 'inherited' ? 30 : 5
    }
  }

  /**
   * Record a trade in both items' history.
   */
  recordTrade(
    itemId: string,
    fromName: string,
    toName: string,
    price: number,
  ): void {
    this.addHistory(
      itemId,
      'traded',
      `${fromName} traded this to ${toName} for ${price} gold`,
      toName,
      { from: fromName, to: toName, price },
    )
  }

  /** Record a generic event in item history */
  recordEvent(itemId: string, type: ItemHistoryType, tick: number, details?: Record<string, unknown>): void {
    const item = this.items.get(itemId)
    if (!item) return

    item.history.push({
      tick,
      type,
      text: `Event: ${type}`,
      details,
    })
  }

  /**
   * Record combat use and apply durability damage.
   */
  recordCombatUse(
    itemId: string,
    agentName: string,
    enemyName: string,
    result: 'victory' | 'defeat' | 'fled',
    enemyLevel?: number,
  ): void {
    const item = this.items.get(itemId)
    if (!item) return

    // Durability loss: 1-5 based on enemy level
    const durabilityLost = Math.max(1, Math.min(5, Math.ceil((enemyLevel ?? 1) / 2)))
    item.durability = Math.max(0, item.durability - durabilityLost)

    this.addHistory(
      itemId,
      'used_in_combat',
      `${agentName} used this against ${enemyName} — ${result}`,
      agentName,
      { enemy: enemyName, result, durability_lost: durabilityLost },
    )

    // Check destruction
    if (item.durability <= 0) {
      this.destroyItem(itemId, `Destroyed in combat against ${enemyName}`, agentName)
    }
  }

  /**
   * Record repair.
   */
  recordRepair(
    itemId: string,
    repairedByName: string,
    repairSkill: number,
    cost: number,
  ): void {
    const item = this.items.get(itemId)
    if (!item) return

    // Repair amount based on skill
    const repairAmount = Math.min(
      item.maxDurability - item.durability,
      Math.round(item.maxDurability * (0.3 + repairSkill * 0.007)),
    )
    item.durability += repairAmount

    this.addHistory(
      itemId,
      'repaired',
      `${repairedByName} repaired this item (+${repairAmount} durability)`,
      repairedByName,
      { repaired_by: repairedByName, cost, durability_restored: repairAmount },
    )
  }

  /**
   * Apply tool durability loss (1 per use).
   */
  useToolDurability(itemId: string, agentName: string): boolean {
    const item = this.items.get(itemId)
    if (!item) return false

    item.durability = Math.max(0, item.durability - 1)
    if (item.durability <= 0) {
      this.destroyItem(itemId, `Worn out through use`, agentName)
      return false // item destroyed
    }
    return true // item still usable
  }

  /**
   * Name an item (AI naming or manual).
   */
  nameItem(itemId: string, customName: string, namedBy?: string): void {
    const item = this.items.get(itemId)
    if (!item) return

    item.customName = customName
    this.addHistory(
      itemId,
      'named',
      namedBy
        ? `${namedBy} named this "${customName}"`
        : `This item was named "${customName}"`,
      namedBy,
      { custom_name: customName },
    )

    const clock = this.clockGetter()
    this.eventBus.emit({
      type: 'item:named',
      itemId: item.id,
      customName,
      quality: item.quality,
      namedBy,
      timestamp: clock.tick,
    })
  }

  /**
   * Destroy an item — add history, emit event, mark as destroyed.
   */
  private destroyItem(itemId: string, reason: string, agentName?: string): void {
    const item = this.items.get(itemId)
    if (!item) return

    const clock = this.clockGetter()
    item.history.push({
      tick: clock.tick,
      type: 'destroyed',
      text: reason,
      agent: agentName,
    })
    item.durability = 0

    this.eventBus.emit({
      type: 'item:destroyed',
      itemId: item.id,
      itemName: item.customName ?? item.name,
      quality: item.quality,
      reason,
      timestamp: clock.tick,
    })
  }

  // ──────────────────────────────────────────────
  // Transfer ownership
  // ──────────────────────────────────────────────

  transferOwner(itemId: string, newOwnerId: string): void {
    const item = this.items.get(itemId)
    if (!item) return
    item.ownerId = newOwnerId
    item.location = { type: 'inventory', ownerId: newOwnerId }
  }

  // ──────────────────────────────────────────────
  // Queries
  // ──────────────────────────────────────────────

  getItem(id: string): RichItem | undefined {
    return this.items.get(id)
  }

  getItemsByOwner(ownerId: string): RichItem[] {
    return [...this.items.values()].filter(
      i => i.ownerId === ownerId && i.durability > 0,
    )
  }

  getItemsByTemplate(templateId: string): RichItem[] {
    return [...this.items.values()].filter(i => i.templateId === templateId)
  }

  getAllItems(): RichItem[] {
    return [...this.items.values()]
  }

  /**
   * Get destroyed items (for historical queries).
   */
  getDestroyedItems(): RichItem[] {
    return [...this.items.values()].filter(i => i.durability <= 0)
  }

  // ──────────────────────────────────────────────
  // Famous items ranking
  // ──────────────────────────────────────────────

  getFamousItems(): {
    mostEventful: FamousItemEntry[]
    oldest: FamousItemEntry[]
    mostBattleTested: FamousItemEntry[]
    mostExpensiveTrade: FamousItemEntry[]
  } {
    const alive = [...this.items.values()].filter(i => i.durability > 0)

    // Most eventful (longest history)
    const mostEventful = [...alive]
      .sort((a, b) => b.history.length - a.history.length)
      .slice(0, 5)
      .map(i => this.toFamousEntry(i, `${i.history.length} recorded events`))

    // Oldest
    const oldest = [...alive]
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, 5)
      .map(i => this.toFamousEntry(i, `Created at tick ${i.createdAt}`))

    // Most battle-tested (most used_in_combat entries)
    const mostBattleTested = [...alive]
      .map(i => ({ item: i, combats: i.history.filter(h => h.type === 'used_in_combat').length }))
      .filter(e => e.combats > 0)
      .sort((a, b) => b.combats - a.combats)
      .slice(0, 5)
      .map(e => this.toFamousEntry(e.item, `Used in ${e.combats} battles`))

    // Most expensive trade
    const mostExpensiveTrade = [...alive]
      .map(i => {
        const trades = i.history.filter(h => h.type === 'traded')
        const maxPrice = trades.reduce((max, t) => {
          const price = (t.details?.price as number) ?? 0
          return price > max ? price : max
        }, 0)
        return { item: i, maxPrice }
      })
      .filter(e => e.maxPrice > 0)
      .sort((a, b) => b.maxPrice - a.maxPrice)
      .slice(0, 5)
      .map(e => this.toFamousEntry(e.item, `Traded for ${e.maxPrice} gold`))

    return { mostEventful, oldest, mostBattleTested, mostExpensiveTrade }
  }

  private toFamousEntry(item: RichItem, highlight: string): FamousItemEntry {
    return {
      id: item.id,
      name: item.name,
      customName: item.customName,
      category: item.category,
      quality: item.quality,
      historyLength: item.history.length,
      createdAt: item.createdAt,
      ownerName: undefined, // caller can resolve
      highlight,
    }
  }

  // ──────────────────────────────────────────────
  // Dynamic pricing (tick-based)
  // ──────────────────────────────────────────────

  tick(clock: WorldClock): void {
    if (clock.tick - this.lastMarketTick < MARKET_UPDATE_INTERVAL) return
    this.lastMarketTick = clock.tick

    // Group items by templateId and update market values
    const templateGroups = new Map<string, RichItem[]>()
    for (const item of this.items.values()) {
      if (item.durability <= 0) continue
      const group = templateGroups.get(item.templateId) ?? []
      group.push(item)
      templateGroups.set(item.templateId, group)
    }

    for (const [templateId, items] of templateGroups) {
      const template = getItemTemplate(templateId)
      if (!template) continue

      const demand = this.demandTracker.get(templateId)
      const supply = items.length

      // Supply/demand ratio affects price
      let priceMultiplier = 1.0
      if (demand) {
        const demandRatio = demand.sold > 0 ? (demand.sold / Math.max(1, demand.listed)) : 1.0
        priceMultiplier = 0.8 + demandRatio * 0.4  // range: 0.8 to 1.6+
      }

      // Scarcity bonus (fewer items = higher price)
      if (supply <= 2) priceMultiplier *= 1.3
      else if (supply >= 10) priceMultiplier *= 0.8

      // Season effect (stub — could be linked to weather/calendar)
      // Winter: food prices +50%
      const gameDay = Math.floor(clock.tick / 1200)
      const season = gameDay % 4  // 0=spring, 1=summer, 2=fall, 3=winter
      if (season === 3 && (template.category === 'food' || template.category === 'potion')) {
        priceMultiplier *= 1.5
      }

      // Apply to each item
      for (const item of items) {
        const base = item.baseValue
        const newValue = Math.round(base * priceMultiplier)
        item.marketValue = Math.max(
          Math.round(base * MARKET_PRICE_MIN_RATIO),
          Math.min(Math.round(base * MARKET_PRICE_MAX_RATIO), newValue),
        )
      }
    }

    // Reset demand tracking for next interval
    this.demandTracker.clear()
  }

  /** Record a sale for demand tracking */
  recordSale(templateId: string): void {
    const entry = this.demandTracker.get(templateId) ?? { sold: 0, listed: 0 }
    entry.sold++
    this.demandTracker.set(templateId, entry)
  }

  /** Record a listing for demand tracking */
  recordListing(templateId: string): void {
    const entry = this.demandTracker.get(templateId) ?? { sold: 0, listed: 0 }
    entry.listed++
    this.demandTracker.set(templateId, entry)
  }

  // ──────────────────────────────────────────────
  // Market prices summary
  // ──────────────────────────────────────────────

  getMarketPrices(): { templateId: string; name: string; avgPrice: number; supply: number }[] {
    const groups = new Map<string, { name: string; prices: number[]; count: number }>()

    for (const item of this.items.values()) {
      if (item.durability <= 0) continue
      const group = groups.get(item.templateId) ?? { name: item.name, prices: [], count: 0 }
      group.prices.push(item.marketValue ?? item.baseValue)
      group.count++
      groups.set(item.templateId, group)
    }

    return [...groups.entries()].map(([templateId, g]) => ({
      templateId,
      name: g.name,
      avgPrice: Math.round(g.prices.reduce((s, p) => s + p, 0) / g.prices.length),
      supply: g.count,
    })).sort((a, b) => b.avgPrice - a.avgPrice)
  }

  // ──────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────

  private getProvenanceCreatorName(prov: ItemProvenance): string | undefined {
    switch (prov.origin) {
      case 'crafted': return prov.crafted_by_name
      case 'found': return prov.found_by_name
      case 'dropped': return prov.dropped_by
      default: return undefined
    }
  }

  private getCreationText(item: RichItem, prov: ItemProvenance): string {
    const qualityText = item.quality !== 'basic' ? ` ${item.quality}` : ''
    switch (prov.origin) {
      case 'crafted':
        return `${prov.crafted_by_name} crafted a${qualityText} ${item.name} at ${prov.crafted_location}`
      case 'found':
        return `${prov.found_by_name} found a${qualityText} ${item.name} at ${prov.found_location}`
      case 'dropped':
        return `${prov.dropped_by} dropped a${qualityText} ${item.name}`
      case 'quest_reward':
        return `Awarded as a quest reward for "${prov.quest_name}"`
      case 'event':
        return `Appeared during the ${prov.event_name} event`
      case 'spawned':
        return `A${qualityText} ${item.name} appeared in the world`
    }
  }

  /** Get count of items in the system */
  get size(): number {
    return this.items.size
  }
}
