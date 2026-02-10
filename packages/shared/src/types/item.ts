import type { ResourceType } from './world.js'

export interface Item {
  id: string
  type: ItemType
  name: string
  quantity: number
  durability?: number
  maxDurability?: number
}

export type ItemType =
  | 'resource'
  | 'tool'
  | 'weapon'
  | 'food'
  | 'material'
  | 'currency'
  | 'crafted'

export interface CraftingRecipe {
  id: string
  name: string
  inputs: { type: string; quantity: number }[]
  output: { type: string; name: string; quantity: number; itemType: ItemType }
  requiredSkill?: { type: string; level: number }
  craftTime: number
}

export interface MarketOrder {
  id: string
  sellerId: string
  itemType: string
  quantity: number
  pricePerUnit: number
  createdAt: number
}
