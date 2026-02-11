import type { ResourceType } from './world.js'

// ──────────────────────────────────────────────
// Item rarity & stats
// ──────────────────────────────────────────────

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export interface EquipmentStats {
  attack?: number
  defense?: number
  speed?: number
  maxEnergy?: number
  maxHp?: number
}

export interface ConsumableEffect {
  type: 'heal_hp' | 'restore_energy' | 'buff_attack' | 'buff_defense' | 'cure_hunger'
  value: number
  duration?: number  // ticks (for buffs)
}

// ──────────────────────────────────────────────
// Core item types
// ──────────────────────────────────────────────

export interface Item {
  id: string
  type: ItemType
  name: string
  quantity: number
  rarity?: ItemRarity
  durability?: number
  maxDurability?: number
  equipmentStats?: EquipmentStats
  consumableEffect?: ConsumableEffect
  description?: string
}

export type ItemType =
  | 'resource'
  | 'tool'
  | 'weapon'
  | 'food'
  | 'material'
  | 'currency'
  | 'crafted'
  | 'equipment'

// ──────────────────────────────────────────────
// Crafting recipes
// ──────────────────────────────────────────────

export interface CraftingRecipe {
  id: string
  name: string
  inputs: { type: string; quantity: number }[]
  output: {
    type: string
    name: string
    quantity: number
    itemType: ItemType
    rarity?: ItemRarity
    equipmentStats?: EquipmentStats
    consumableEffect?: ConsumableEffect
  }
  requiredSkill?: { type: string; level: number }
  craftTime: number
  baseFailChance?: number    // 0-1, reduced by skill level
  criticalChance?: number    // 0-1, critical success upgrades rarity
}

// ──────────────────────────────────────────────
// Market orders
// ──────────────────────────────────────────────

export interface MarketOrder {
  id: string
  sellerId: string
  itemType: string
  quantity: number
  pricePerUnit: number
  createdAt: number
}
