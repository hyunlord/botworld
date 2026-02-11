import type { Position, POIType } from './world.js'

export type WorldEventCategory = 'resource' | 'social' | 'danger' | 'discovery'

export type WorldEventType =
  | 'resource_bloom'
  | 'resource_drought'
  | 'festival'
  | 'market_boom'
  | 'monster_spawn'
  | 'storm_warning'
  | 'hidden_treasure'
  | 'new_poi'

export interface WorldEventEffect {
  /** e.g. 'gather_bonus', 'trade_discount', 'price_multiplier' */
  type: string
  /** Target resource or item type */
  target?: string
  /** Multiplier or flat value */
  value: number
}

export interface WorldEventData {
  id: string
  type: WorldEventType
  category: WorldEventCategory
  title: string
  description: string
  /** Where the event is centered */
  position: Position
  /** Radius of effect in tiles */
  radius: number
  /** Associated POI type (if any) */
  poiType?: POIType
  /** Gameplay effects */
  effects: WorldEventEffect[]
  /** Duration in ticks */
  duration: number
  /** Tick when event started */
  startedAt: number
  /** Tick when event expires */
  expiresAt: number
}

export interface ActiveWorldEvent extends WorldEventData {
  /** Ticks remaining */
  ticksRemaining: number
}
