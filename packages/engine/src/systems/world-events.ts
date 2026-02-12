import type {
  WorldEventType, WorldEventCategory, WorldEventData,
  ActiveWorldEvent, WorldEventEffect, WorldClock, Position, POIType,
} from '@botworld/shared'
import { generateId, TICKS_PER_GAME_DAY } from '@botworld/shared'
import type { TileMap } from '../world/tile-map.js'
import type { PointOfInterest } from '../world/generation/types.js'
import type { EventBus } from '../core/event-bus.js'

// ── Constants ──

/** Max concurrent active events */
const MAX_ACTIVE_EVENTS = 3

/** Tier-based event frequency: check intervals and spawn chances */
type EventTier = 'small' | 'medium' | 'large'
const TIER_CONFIG: Record<EventTier, { checkInterval: number; spawnChance: number }> = {
  small:  { checkInterval: 300,  spawnChance: 0.40 }, // ~12 min avg
  medium: { checkInterval: 600,  spawnChance: 0.30 }, // ~33 min avg
  large:  { checkInterval: 1200, spawnChance: 0.25 }, // ~80 min avg
}

// ── Event templates ──

interface EventTemplate {
  type: WorldEventType
  category: WorldEventCategory
  tier: EventTier
  titleTemplate: string
  descTemplate: string
  /** Duration in ticks */
  durationRange: [number, number]
  /** Effect radius in tiles */
  radiusRange: [number, number]
  /** Where to spawn: 'poi' picks a POI, 'random' picks a random walkable tile */
  spawnTarget: 'poi' | 'random'
  /** Required POI types (if spawnTarget is 'poi') */
  poiTypes?: POIType[]
  /** Weight for random selection (higher = more likely) */
  weight: number
  generateEffects: () => WorldEventEffect[]
}

const RESOURCE_TYPES = ['wood', 'stone', 'iron', 'food', 'herb', 'gold'] as const

const EVENT_TEMPLATES: EventTemplate[] = [
  // ── Resource events ──
  {
    type: 'resource_bloom',
    category: 'resource',
    tier: 'small',
    titleTemplate: 'Resource Bloom: {resource}',
    descTemplate: '{location} 근처에서 {resource}가 대량 발견되었습니다! 서둘러 채집하세요!',
    durationRange: [TICKS_PER_GAME_DAY, TICKS_PER_GAME_DAY * 2],
    radiusRange: [8, 15],
    spawnTarget: 'random',
    weight: 3,
    generateEffects: () => {
      const resource = RESOURCE_TYPES[Math.floor(Math.random() * RESOURCE_TYPES.length)]
      return [
        { type: 'gather_bonus', target: resource, value: 3 },
        { type: 'rare_resource_chance', value: 0.10 },
      ]
    },
  },
  {
    type: 'resource_drought',
    category: 'resource',
    tier: 'small',
    titleTemplate: 'Resource Drought',
    descTemplate: '가뭄이 {location} 주변을 강타했습니다. {resource} 수확량이 감소합니다.',
    durationRange: [TICKS_PER_GAME_DAY, TICKS_PER_GAME_DAY * 2],
    radiusRange: [10, 20],
    spawnTarget: 'poi',
    poiTypes: ['farm', 'mine'],
    weight: 2,
    generateEffects: () => {
      const resource = Math.random() < 0.5 ? 'food' : 'iron'
      return [{ type: 'gather_penalty', target: resource, value: 0.5 }]
    },
  },

  // ── Social events ──
  {
    type: 'festival',
    category: 'social',
    tier: 'large',
    titleTemplate: 'Festival at {location}',
    descTemplate: '{location}에서 축제가 열립니다! 에너지 회복 +50%, 거래 할인을 즐기세요!',
    durationRange: [TICKS_PER_GAME_DAY * 2, TICKS_PER_GAME_DAY * 4],
    radiusRange: [12, 20],
    spawnTarget: 'poi',
    poiTypes: ['tavern', 'marketplace'],
    weight: 2,
    generateEffects: () => [
      { type: 'energy_regen_bonus', value: 1.5 },
      { type: 'trade_discount', value: 0.8 },
    ],
  },
  {
    type: 'market_boom',
    category: 'social',
    tier: 'small',
    titleTemplate: 'Market Boom: {resource}',
    descTemplate: '{resource} 수요가 급증했습니다! 가격이 2배로 올랐습니다!',
    durationRange: [Math.floor(TICKS_PER_GAME_DAY * 0.5), TICKS_PER_GAME_DAY],
    radiusRange: [15, 25],
    spawnTarget: 'poi',
    poiTypes: ['marketplace'],
    weight: 2,
    generateEffects: () => {
      const resource = RESOURCE_TYPES[Math.floor(Math.random() * RESOURCE_TYPES.length)]
      return [{ type: 'price_multiplier', target: resource, value: 2 }]
    },
  },

  // ── Danger events ──
  {
    type: 'monster_spawn',
    category: 'danger',
    tier: 'medium',
    titleTemplate: 'Monster Sighting!',
    descTemplate: '{location} 근처에서 몬스터 무리가 목격되었습니다! 주의하세요!',
    durationRange: [TICKS_PER_GAME_DAY, TICKS_PER_GAME_DAY * 2],
    radiusRange: [6, 12],
    spawnTarget: 'random',
    weight: 1,
    generateEffects: () => [
      { type: 'danger_zone', value: 1 },
      { type: 'gather_penalty', value: 0.3 },
    ],
  },
  {
    type: 'storm_warning',
    category: 'danger',
    tier: 'medium',
    titleTemplate: 'Storm Warning!',
    descTemplate: '강한 폭풍이 {location} 방향에서 접근 중입니다! 안전한 곳으로 피하세요!',
    durationRange: [Math.floor(TICKS_PER_GAME_DAY * 0.3), TICKS_PER_GAME_DAY],
    radiusRange: [15, 30],
    spawnTarget: 'random',
    weight: 1,
    generateEffects: () => [
      { type: 'movement_penalty', value: 0.5 },
      { type: 'energy_drain', value: 1.5 },
    ],
  },

  // ── Discovery events ──
  {
    type: 'hidden_treasure',
    category: 'discovery',
    tier: 'small',
    titleTemplate: 'Hidden Treasure!',
    descTemplate: '오래된 지도가 발견되었습니다! {location} 근처 어딘가에 보물이 숨겨져 있습니다...',
    durationRange: [TICKS_PER_GAME_DAY, TICKS_PER_GAME_DAY * 3],
    radiusRange: [5, 10],
    spawnTarget: 'random',
    weight: 1,
    generateEffects: () => [
      { type: 'treasure_hint', value: 1 },
      { type: 'xp_bonus', value: 2 },
    ],
  },
  {
    type: 'new_poi',
    category: 'discovery',
    tier: 'medium',
    titleTemplate: 'Mysterious Portal!',
    descTemplate: '미지의 포탈이 {location} 근처에 나타났습니다! 탐험가를 기다리고 있습니다!',
    durationRange: [TICKS_PER_GAME_DAY * 2, TICKS_PER_GAME_DAY * 4],
    radiusRange: [8, 15],
    spawnTarget: 'random',
    weight: 1,
    generateEffects: () => [
      { type: 'explore_bonus', value: 2 },
      { type: 'xp_bonus', value: 1.5 },
    ],
  },
]

// ── WorldEventSystem ──

export class WorldEventSystem {
  private activeEvents: Map<string, WorldEventData> = new Map()
  private lastCheckTick: Record<EventTier, number> = { small: 0, medium: 0, large: 0 }
  private eventHistory: string[] = []  // recent event type history to avoid repetition

  constructor(
    private eventBus: EventBus,
    private tileMap: TileMap,
    private clockGetter: () => WorldClock,
  ) {}

  tick(clock: WorldClock): void {
    // Expire ended events
    this.expireEvents(clock.tick)

    // Check each tier independently
    for (const tier of ['small', 'medium', 'large'] as EventTier[]) {
      const cfg = TIER_CONFIG[tier]
      if (clock.tick - this.lastCheckTick[tier] >= cfg.checkInterval) {
        this.lastCheckTick[tier] = clock.tick
        this.trySpawnEvent(clock.tick, tier)
      }
    }
  }

  getActiveEvents(): ActiveWorldEvent[] {
    const clock = this.clockGetter()
    return Array.from(this.activeEvents.values()).map(e => ({
      ...e,
      ticksRemaining: Math.max(0, e.expiresAt - clock.tick),
    }))
  }

  getEvent(id: string): ActiveWorldEvent | undefined {
    const event = this.activeEvents.get(id)
    if (!event) return undefined
    const clock = this.clockGetter()
    return {
      ...event,
      ticksRemaining: Math.max(0, event.expiresAt - clock.tick),
    }
  }

  /** Check if a position is within any active event's radius */
  getEventsAtPosition(pos: Position): ActiveWorldEvent[] {
    const clock = this.clockGetter()
    const result: ActiveWorldEvent[] = []
    for (const event of this.activeEvents.values()) {
      const dx = pos.x - event.position.x
      const dy = pos.y - event.position.y
      if (dx * dx + dy * dy <= event.radius * event.radius) {
        result.push({
          ...event,
          ticksRemaining: Math.max(0, event.expiresAt - clock.tick),
        })
      }
    }
    return result
  }

  // ── Private ──

  private expireEvents(currentTick: number): void {
    for (const [id, event] of this.activeEvents) {
      if (currentTick >= event.expiresAt) {
        this.activeEvents.delete(id)
        this.eventBus.emit({
          type: 'world_event:ended',
          eventId: id,
          eventType: event.type,
          title: event.title,
          timestamp: currentTick,
        })
        console.log(`[WorldEvents] Event expired: ${event.title}`)
      }
    }
  }

  private trySpawnEvent(currentTick: number, tier?: EventTier): void {
    if (this.activeEvents.size >= MAX_ACTIVE_EVENTS) return

    const cfg = tier ? TIER_CONFIG[tier] : TIER_CONFIG.small
    if (Math.random() > cfg.spawnChance) return

    // Filter out recently used event types
    const recentTypes = new Set(this.eventHistory.slice(-3))
    const activeTypes = new Set(Array.from(this.activeEvents.values()).map(e => e.type))

    const candidates = EVENT_TEMPLATES.filter(t =>
      !recentTypes.has(t.type) && !activeTypes.has(t.type) && (!tier || t.tier === tier),
    )
    if (candidates.length === 0) return

    // Weighted random selection
    const totalWeight = candidates.reduce((sum, t) => sum + t.weight, 0)
    let roll = Math.random() * totalWeight
    let selected: EventTemplate | undefined
    for (const t of candidates) {
      roll -= t.weight
      if (roll <= 0) { selected = t; break }
    }
    if (!selected) selected = candidates[candidates.length - 1]

    // Determine position
    const position = this.resolvePosition(selected)
    if (!position) return

    // Generate event
    const duration = randRange(selected.durationRange[0], selected.durationRange[1])
    const radius = randRange(selected.radiusRange[0], selected.radiusRange[1])
    const effects = selected.generateEffects()
    const locationName = this.getLocationName(position)

    // Fill templates
    const resource = effects.find(e => e.target)?.target ?? 'resources'
    const title = selected.titleTemplate
      .replace('{resource}', capitalize(resource))
      .replace('{location}', locationName)
    const description = selected.descTemplate
      .replace('{resource}', resource)
      .replace('{location}', locationName)

    const event: WorldEventData = {
      id: generateId(),
      type: selected.type,
      category: selected.category,
      title,
      description,
      position,
      radius,
      effects,
      duration,
      startedAt: currentTick,
      expiresAt: currentTick + duration,
    }

    this.activeEvents.set(event.id, event)
    this.eventHistory.push(selected.type)
    if (this.eventHistory.length > 10) this.eventHistory.shift()

    this.eventBus.emit({
      type: 'world_event:started',
      eventId: event.id,
      eventType: event.type,
      title: event.title,
      description: event.description,
      category: event.category,
      position: event.position,
      radius: event.radius,
      effects: event.effects,
      duration: event.duration,
      expiresAt: event.expiresAt,
      timestamp: currentTick,
    })

    console.log(`[WorldEvents] Event started: ${event.title} at (${position.x}, ${position.y}) for ${duration} ticks`)
  }

  private resolvePosition(template: EventTemplate): Position | undefined {
    if (template.spawnTarget === 'poi') {
      const matchingPois = template.poiTypes
        ? this.tileMap.pois.filter(p => template.poiTypes!.includes(p.type as POIType))
        : this.tileMap.pois

      if (matchingPois.length === 0) return this.randomWalkablePosition()
      const poi = matchingPois[Math.floor(Math.random() * matchingPois.length)]
      return poi.position
    }

    return this.randomWalkablePosition()
  }

  private randomWalkablePosition(): Position | undefined {
    // Pick a random position near an existing POI
    if (this.tileMap.pois.length === 0) return undefined

    const poi = this.tileMap.pois[Math.floor(Math.random() * this.tileMap.pois.length)]
    const offsetX = Math.floor(Math.random() * 30) - 15
    const offsetY = Math.floor(Math.random() * 30) - 15
    const x = poi.position.x + offsetX
    const y = poi.position.y + offsetY

    if (this.tileMap.isWalkable(x, y)) {
      return { x, y }
    }

    // Fallback: try the POI position itself
    return poi.position
  }

  private getLocationName(pos: Position): string {
    // Find nearest POI for a name reference
    let nearest: PointOfInterest | undefined
    let nearestDist = Infinity

    for (const poi of this.tileMap.pois) {
      const dx = pos.x - poi.position.x
      const dy = pos.y - poi.position.y
      const dist = dx * dx + dy * dy
      if (dist < nearestDist) {
        nearestDist = dist
        nearest = poi
      }
    }

    if (nearest && nearestDist < 400) {
      return nearest.name
    }

    // Cardinal direction from center
    const cx = pos.x > 0 ? '동' : '서'
    const cy = pos.y > 0 ? '남' : '북'
    return `${cy}${cx}쪽 지역`
  }
}

// ── Helpers ──

function randRange(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
