import type { EventBus } from '../core/event-bus.js'
import type { NpcManager } from '../systems/npc-manager.js'
import type { PlanExecutor } from '../agent/plan-executor.js'
import type { TileMap } from '../world/tile-map.js'
import type {
  ActionPlan,
  Position,
  NpcRole,
  WorldEventType,
  WorldEventStartedEvent
} from '@botworld/shared'

interface ReactionConfig {
  speak?: string
  moveToEvent?: boolean
  emote?: string
  priority?: 'low' | 'normal' | 'high'
}

type RoleReactions = Partial<Record<NpcRole, ReactionConfig>>
type EventReactionMap = Partial<Record<WorldEventType, RoleReactions>>

const REACTION_CONFIG: EventReactionMap = {
  resource_bloom: {
    merchant: {
      speak: '매입가를 올려야겠군! 자원이 풍부해!',
      priority: 'normal',
    },
    farmer: {
      speak: '풍년이야! 어서 가서 수확하자!',
      moveToEvent: true,
      priority: 'normal',
    },
    guard: {
      speak: '자원 지대가 발견되었습니다. 안전하게 채집하십시오.',
      priority: 'low',
    },
    scholar: {
      speak: '흥미로운 자원 파동이 관측됩니다...',
      priority: 'low',
    },
  },
  monster_spawn: {
    guard: {
      speak: '위험합니다! 시민들은 대피하세요!',
      moveToEvent: true,
      priority: 'high',
    },
    innkeeper: {
      speak: '다들 안으로 들어오세요! 안전합니다!',
      priority: 'normal',
    },
    guild_master: {
      speak: '방어 준비! 모든 길드원은 전투 태세!',
      moveToEvent: true,
      priority: 'high',
    },
    blacksmith: {
      speak: '무기가 필요하면 여기로!',
      priority: 'normal',
    },
    priest: {
      speak: '신이여, 마을을 지켜주소서...',
      emote: '*기도하다*',
      priority: 'normal',
    },
  },
  new_poi: {
    guard: {
      speak: '위험합니다! 물러나세요!',
      moveToEvent: true,
      priority: 'high',
    },
    scholar: {
      speak: '흥미로운 에너지 파동... 관찰해봐야겠어!',
      moveToEvent: true,
      priority: 'normal',
    },
    merchant: {
      speak: '포션을 준비하세요! 20% 할인 중!',
      priority: 'normal',
    },
    priest: {
      speak: '불길한 기운이 느껴집니다... 조심하십시오.',
      priority: 'low',
    },
  },
  festival: {
    innkeeper: {
      speak: '축제에 오신 것을 환영합니다! 음식은 무료입니다!',
      priority: 'normal',
    },
    blacksmith: {
      speak: '축제 기념 무기 전시회! 구경하세요!',
      priority: 'normal',
    },
    merchant: {
      speak: '축제 특별 할인! 놓치지 마세요!',
      priority: 'normal',
    },
    farmer: {
      speak: '풍성한 수확에 감사하며 축제를 즐깁시다!',
      priority: 'normal',
    },
    guard: {
      speak: '축제를 즐기되 질서를 유지해 주시기 바랍니다.',
      priority: 'low',
    },
    scholar: {
      speak: '축제의 역사는 참으로 깊고...',
      priority: 'low',
    },
    priest: {
      speak: '모두에게 축복이 있기를!',
      priority: 'normal',
    },
  },
  hidden_treasure: {
    merchant: {
      speak: '보물의 소문을 들었소? 먼저 찾는 자가 임자라오!',
      priority: 'normal',
    },
    scholar: {
      speak: '고대 지도에 의하면... 보물이 근처에!',
      priority: 'normal',
    },
    wanderer: {
      speak: '보물을 찾으러 가자!',
      moveToEvent: true,
      priority: 'normal',
    },
  },
  storm_warning: {
    guard: {
      speak: '폭풍이 접근 중입니다! 안전한 곳으로 대피하세요!',
      priority: 'high',
    },
    innkeeper: {
      speak: '폭풍이 온다네요. 여관에서 쉬어가세요.',
      priority: 'normal',
    },
    farmer: {
      speak: '작물을 서둘러 거둬야 해!',
      priority: 'high',
    },
  },
}

export class NpcEventReactions {
  constructor(
    private eventBus: EventBus,
    private npcManager: NpcManager,
    private planExecutor: PlanExecutor,
    private tileMap: TileMap,
  ) {
    this.eventBus.on('world_event:started', (event) => {
      if (event.type === 'world_event:started') {
        this.handleWorldEvent(event)
      }
    })
  }

  private handleWorldEvent(event: WorldEventStartedEvent): void {
    const reactions = REACTION_CONFIG[event.eventType]
    if (!reactions) return

    // Determine max reaction distance based on event type
    const largeEvents: WorldEventType[] = ['festival', 'storm_warning']
    const maxDistance = largeEvents.includes(event.eventType) ? 50 : 30

    const allNpcs = this.npcManager.getAllNpcs()

    for (const npc of allNpcs) {
      if (!npc.npcRole) continue

      const reactionConfig = reactions[npc.npcRole]
      if (!reactionConfig) continue

      // Check distance
      const distance = this.calculateDistance(npc.position, event.position)
      if (distance > maxDistance) continue

      // Don't interrupt high-priority plans
      if (this.planExecutor.hasPlan(npc.id)) {
        // Allow high-priority reactions to interrupt normal plans
        if (reactionConfig.priority !== 'high') continue
      }

      // Schedule reaction with random delay (2-5 seconds)
      const delayTicks = 2 + Math.floor(Math.random() * 4)
      setTimeout(() => {
        this.executeReaction(npc.id, npc.name, npc.npcRole!, reactionConfig, event.position)
      }, delayTicks * 1000)
    }
  }

  private executeReaction(
    npcId: string,
    npcName: string,
    role: NpcRole,
    config: ReactionConfig,
    eventPosition: Position,
  ): void {
    // Don't interrupt if NPC now has a plan (could have gotten one during delay)
    if (this.planExecutor.hasPlan(npcId) && config.priority !== 'high') {
      return
    }

    const steps: ActionPlan['steps'] = []

    // Add speak action
    if (config.speak) {
      steps.push({
        action: 'speak',
        params: { message: config.speak },
      })
    }

    // Add emote action
    if (config.emote) {
      steps.push({
        action: 'emote',
        params: { emote: config.emote },
        wait_after: 2,
      })
    }

    // Add movement action
    if (config.moveToEvent) {
      steps.push({
        action: 'move',
        params: { destination: eventPosition },
        wait_after: 1,
      })
    }

    // If no steps, return
    if (steps.length === 0) return

    const plan: ActionPlan = {
      plan_name: `event_reaction_${role}`,
      steps,
      max_duration: 30, // Short reaction plans
    }

    this.planExecutor.setPlan(npcId, plan)
    console.log(`[NpcEventReactions] ${npcName} (${role}) reacting to event`)
  }

  private calculateDistance(pos1: Position, pos2: Position): number {
    const dx = pos1.x - pos2.x
    const dy = pos1.y - pos2.y
    return Math.sqrt(dx * dx + dy * dy)
  }
}
