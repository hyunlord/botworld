import type { WorldRecord, WorldRecordCategory, WorldRecordBrokenEvent } from '@botworld/shared'
import { generateId } from '@botworld/shared'
import type { EventBus } from '../core/event-bus.js'
import type {
  CombatEndedEvent,
  TradeCompletedEvent,
  ItemCraftedEvent,
  SkillLevelUpEvent,
  KingdomFoundedEvent,
  MonsterType,
} from '@botworld/shared'

export class WorldRecordManager {
  private records = new Map<WorldRecordCategory, WorldRecord>()

  constructor(private eventBus: EventBus) {
    this.initializeRecords()
    this.subscribeEvents()
  }

  private initializeRecords(): void {
    const categories: WorldRecordCategory[] = [
      'highest_single_damage',
      'highest_trade_value',
      'longest_war',
      'largest_battle',
      'largest_guild',
      'longest_town_leader',
      'fastest_levelup',
      'wealthiest_ever',
      'longest_peace',
      'most_items_crafted',
      'first_legendary_crafter',
      'first_dragon_slayer',
      'first_nation_founder',
    ]

    for (const category of categories) {
      this.records.set(category, {
        id: generateId('record'),
        category,
        recordValue: 0,
        holderId: null,
        holderName: 'None',
        itemId: null,
        achievedAt: 0,
        description: 'No record set yet',
      })
    }
  }

  private subscribeEvents(): void {
    // Combat events
    this.eventBus.on('combat:ended', (event) => {
      const e = event as CombatEndedEvent
      if (e.outcome === 'victory') {
        // Check for highest single damage (estimate from level and xp)
        const estimatedDamage = Math.floor(e.xpGained / 2)
        this.checkAndSetRecord(
          'highest_single_damage',
          estimatedDamage,
          e.agentId,
          `Agent ${e.agentId}`,
          undefined,
          `Dealt ${estimatedDamage} damage defeating ${e.monsterId}`
        )

        // Check if dragon was slain
        const dragonTypes: MonsterType[] = ['dragon_whelp', 'dragon']
        if (dragonTypes.includes(e.monsterId as MonsterType)) {
          this.checkAndSetRecord(
            'first_dragon_slayer',
            1,
            e.agentId,
            `Agent ${e.agentId}`,
            undefined,
            `First to slay a dragon: ${e.monsterId}`
          )
        }
      }
    })

    // Trade events
    this.eventBus.on('trade:completed', (event) => {
      const e = event as TradeCompletedEvent
      this.checkAndSetRecord(
        'highest_trade_value',
        e.price,
        e.sellerId,
        `Seller ${e.sellerId}`,
        e.item.id,
        `Sold ${e.item.name} for ${e.price} gold`
      )
    })

    // Crafting events
    this.eventBus.on('item:crafted', (event) => {
      const e = event as ItemCraftedEvent

      // Check for first legendary (quality would be in item name or rarity)
      if (e.item.rarity === 'legendary') {
        this.checkAndSetRecord(
          'first_legendary_crafter',
          1,
          e.agentId,
          `Agent ${e.agentId}`,
          e.item.id,
          `First to craft legendary item: ${e.item.name}`
        )
      }

      // Increment total items crafted (get current value and add 1)
      const current = this.records.get('most_items_crafted')
      if (current && current.holderId === e.agentId) {
        this.checkAndSetRecord(
          'most_items_crafted',
          current.recordValue + 1,
          e.agentId,
          `Agent ${e.agentId}`,
          undefined,
          `Crafted ${current.recordValue + 1} items total`
        )
      } else {
        // Different agent, check if they beat the record
        this.checkAndSetRecord(
          'most_items_crafted',
          1,
          e.agentId,
          `Agent ${e.agentId}`,
          undefined,
          'Crafted 1 item'
        )
      }
    })

    // Skill level up events (for fastest level 10)
    this.eventBus.on('skill:level_up', (event) => {
      const e = event as SkillLevelUpEvent
      if (e.newLevel === 10) {
        // For fastest levelup, lower tick count is better
        // We'll use timestamp as the value (first to reach wins)
        const current = this.records.get('fastest_levelup')
        if (current && current.recordValue === 0) {
          this.checkAndSetRecord(
            'fastest_levelup',
            e.timestamp,
            e.agentId,
            `Agent ${e.agentId}`,
            undefined,
            `First to reach skill level 10 in ${e.skillName}`
          )
        }
      }
    })

    // Kingdom founded
    this.eventBus.on('kingdom:founded', (event) => {
      const e = event as KingdomFoundedEvent
      this.checkAndSetRecord(
        'first_nation_founder',
        1,
        e.rulerId,
        e.rulerName,
        undefined,
        `Founded ${e.kingdomName}, the first nation`
      )
    })
  }

  checkAndSetRecord(
    category: WorldRecordCategory,
    value: number,
    holderId: string,
    holderName: string,
    itemId?: string,
    description?: string
  ): boolean {
    const current = this.records.get(category)
    if (!current) return false

    // For "first_" records, only set if never set before (recordValue === 0)
    const isFirstRecord = category.startsWith('first_')
    if (isFirstRecord && current.recordValue !== 0) {
      return false
    }

    // For numeric records, check if new value is higher
    if (!isFirstRecord && value <= current.recordValue) {
      return false
    }

    // Record is broken! Store previous holder info
    const newRecord: WorldRecord = {
      id: current.id,
      category,
      recordValue: value,
      holderId,
      holderName,
      itemId: itemId ?? null,
      achievedAt: Date.now(),
      description: description ?? `New ${category} record: ${value}`,
      previousHolderId: current.holderId,
      previousHolderName: current.holderName,
      previousValue: current.recordValue,
    }

    this.records.set(category, newRecord)

    // Emit world record broken event
    const recordEvent: WorldRecordBrokenEvent = {
      type: 'world_record:broken',
      category,
      newValue: value,
      holderId,
      holderName,
      previousHolderName: current.holderName !== 'None' ? current.holderName : undefined,
      previousValue: current.recordValue > 0 ? current.recordValue : undefined,
      description: newRecord.description,
      timestamp: Date.now(),
    }
    this.eventBus.emit(recordEvent)

    return true
  }

  getRecords(): WorldRecord[] {
    return Array.from(this.records.values())
  }

  getRecord(category: WorldRecordCategory): WorldRecord | undefined {
    return this.records.get(category)
  }
}
