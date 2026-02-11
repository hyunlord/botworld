import type {
  Quest, QuestType, QuestObjective, QuestReward,
  QuestDifficulty, ActiveQuest, WorldClock, Position,
} from '@botworld/shared'
import { generateId, TICKS_PER_GAME_DAY } from '@botworld/shared'
import type { TileMap, PointOfInterest } from '../world/tile-map.js'
import type { NpcManager } from './npc-manager.js'
import type { EventBus } from '../core/event-bus.js'

/** How often to refresh available quest pool (every half game day) */
const QUEST_REFRESH_INTERVAL = Math.floor(TICKS_PER_GAME_DAY / 2)
/** Max available quests at any time */
const MAX_AVAILABLE_QUESTS = 5
/** Max active quests per agent */
const MAX_ACTIVE_PER_AGENT = 3

// ── Quest templates ──

interface QuestTemplate {
  type: QuestType
  titleTemplate: string
  descTemplate: string
  difficulty: QuestDifficulty
  minLevel: number
  generate: (pois: PointOfInterest[], tileMap: TileMap) => {
    objectives: Omit<QuestObjective, 'id' | 'current'>[]
    rewards: QuestReward
    timeLimit?: number
  }
}

const GATHER_RESOURCES = ['wood', 'stone', 'iron', 'food', 'herb', 'gold']

const QUEST_TEMPLATES: QuestTemplate[] = [
  // ── Gather quests ──
  {
    type: 'gather',
    titleTemplate: 'Gather {amount} {resource}',
    descTemplate: 'We need {amount} {resource} for the settlement. Gather them from the surrounding area and return to me.',
    difficulty: 'easy',
    minLevel: 1,
    generate: () => {
      const resource = GATHER_RESOURCES[Math.floor(Math.random() * 4)] // wood/stone/iron/food
      const amount = 3 + Math.floor(Math.random() * 5)
      return {
        objectives: [{
          type: 'gather',
          description: `Gather ${amount} ${resource}`,
          target: resource,
          required: amount,
        }],
        rewards: { xp: 15 * amount, gold: 5 * amount },
        timeLimit: TICKS_PER_GAME_DAY * 2,
      }
    },
  },
  {
    type: 'gather',
    titleTemplate: 'Rare Herb Collection',
    descTemplate: 'I need rare herbs for medicine. Search the forests and gather {amount} herb. They grow in wooded areas.',
    difficulty: 'medium',
    minLevel: 2,
    generate: () => {
      const amount = 5 + Math.floor(Math.random() * 4)
      return {
        objectives: [{
          type: 'gather',
          description: `Gather ${amount} herb`,
          target: 'herb',
          required: amount,
        }],
        rewards: {
          xp: 25 * amount,
          gold: 8 * amount,
          skillPoints: { skill: 'gathering', amount: 1 },
        },
        timeLimit: TICKS_PER_GAME_DAY * 3,
      }
    },
  },
  // ── Explore quests ──
  {
    type: 'explore',
    titleTemplate: 'Scout the {poi}',
    descTemplate: 'We need someone to scout the area around {poi}. Travel there and report back what you find.',
    difficulty: 'easy',
    minLevel: 1,
    generate: (pois) => {
      const poi = pois[Math.floor(Math.random() * pois.length)]
      return {
        objectives: [{
          type: 'explore',
          description: `Visit ${poi.name}`,
          target: poi.name,
          required: 1,
          targetPosition: poi.position,
        }],
        rewards: { xp: 30, gold: 15 },
        timeLimit: TICKS_PER_GAME_DAY * 2,
      }
    },
  },
  {
    type: 'explore',
    titleTemplate: 'Survey Multiple Locations',
    descTemplate: 'The guild needs updated maps. Visit {count} different points of interest and report your findings.',
    difficulty: 'medium',
    minLevel: 2,
    generate: (pois) => {
      const count = Math.min(3, pois.length)
      const selected = [...pois].sort(() => Math.random() - 0.5).slice(0, count)
      return {
        objectives: selected.map(poi => ({
          type: 'explore' as QuestType,
          description: `Visit ${poi.name}`,
          target: poi.name,
          required: 1,
          targetPosition: poi.position,
        })),
        rewards: { xp: 25 * count, gold: 12 * count },
        timeLimit: TICKS_PER_GAME_DAY * 3,
      }
    },
  },
  // ── Craft quests ──
  {
    type: 'craft',
    titleTemplate: 'Craft Equipment',
    descTemplate: 'The workshop needs more crafted items. Craft {amount} items of any kind.',
    difficulty: 'medium',
    minLevel: 2,
    generate: () => {
      const amount = 2 + Math.floor(Math.random() * 2)
      return {
        objectives: [{
          type: 'craft',
          description: `Craft ${amount} items`,
          target: 'any',
          required: amount,
        }],
        rewards: {
          xp: 40 * amount,
          gold: 15 * amount,
          skillPoints: { skill: 'crafting', amount: 1 },
        },
        timeLimit: TICKS_PER_GAME_DAY * 3,
      }
    },
  },
  // ── Social quests ──
  {
    type: 'social',
    titleTemplate: 'Make New Friends',
    descTemplate: 'Get to know the other inhabitants. Have conversations with {amount} different agents.',
    difficulty: 'easy',
    minLevel: 1,
    generate: () => {
      const amount = 2 + Math.floor(Math.random() * 2)
      return {
        objectives: [{
          type: 'social',
          description: `Talk to ${amount} agents`,
          target: 'agents',
          required: amount,
        }],
        rewards: {
          xp: 20 * amount,
          skillPoints: { skill: 'diplomacy', amount: 1 },
        },
      }
    },
  },
  // ── Trade quests ──
  {
    type: 'trade',
    titleTemplate: 'Commerce Challenge',
    descTemplate: 'Complete {amount} trades with other agents or NPCs to stimulate the economy.',
    difficulty: 'medium',
    minLevel: 2,
    generate: () => {
      const amount = 2 + Math.floor(Math.random() * 2)
      return {
        objectives: [{
          type: 'trade',
          description: `Complete ${amount} trades`,
          target: 'trades',
          required: amount,
        }],
        rewards: {
          xp: 30 * amount,
          gold: 20 * amount,
          skillPoints: { skill: 'trading', amount: 1 },
        },
        timeLimit: TICKS_PER_GAME_DAY * 2,
      }
    },
  },
  // ── Deliver quests ──
  {
    type: 'deliver',
    titleTemplate: 'Delivery to {poi}',
    descTemplate: 'Deliver supplies to {poi}. Bring {amount} {resource} to the specified location.',
    difficulty: 'medium',
    minLevel: 2,
    generate: (pois) => {
      const poi = pois[Math.floor(Math.random() * pois.length)]
      const resource = GATHER_RESOURCES[Math.floor(Math.random() * 4)]
      const amount = 3 + Math.floor(Math.random() * 3)
      return {
        objectives: [
          {
            type: 'gather' as QuestType,
            description: `Collect ${amount} ${resource}`,
            target: resource,
            required: amount,
          },
          {
            type: 'deliver' as QuestType,
            description: `Deliver to ${poi.name}`,
            target: poi.name,
            required: 1,
            targetPosition: poi.position,
          },
        ],
        rewards: { xp: 50, gold: 30 },
        timeLimit: TICKS_PER_GAME_DAY * 3,
      }
    },
  },
  // ── Hard gather quest ──
  {
    type: 'gather',
    titleTemplate: 'Gold Rush',
    descTemplate: 'The treasury is running low. Mine {amount} gold ore from the mines.',
    difficulty: 'hard',
    minLevel: 3,
    generate: () => {
      const amount = 8 + Math.floor(Math.random() * 5)
      return {
        objectives: [{
          type: 'gather',
          description: `Mine ${amount} gold`,
          target: 'gold',
          required: amount,
        }],
        rewards: {
          xp: 30 * amount,
          gold: 15 * amount,
          skillPoints: { skill: 'gathering', amount: 2 },
        },
        timeLimit: TICKS_PER_GAME_DAY * 4,
      }
    },
  },
]

// ── Quest Manager ──

export class QuestManager {
  /** Available quests (not yet accepted by anyone) */
  private availableQuests = new Map<string, Quest>()
  /** Active quests per agent: agentId → quest id → ActiveQuest */
  private activeQuests = new Map<string, Map<string, ActiveQuest>>()
  /** Completed quest IDs (to avoid regenerating same ones) */
  private completedQuestIds = new Set<string>()
  /** Last tick when quests were refreshed */
  private lastRefreshTick = 0

  constructor(
    private eventBus: EventBus,
    private tileMap: TileMap,
    private npcManager: NpcManager,
    private clockGetter: () => WorldClock,
  ) {
    this.listenForProgress()
  }

  /** Call each tick to generate new quests periodically */
  tick(clock: WorldClock): void {
    // Refresh available quests periodically
    if (clock.tick - this.lastRefreshTick >= QUEST_REFRESH_INTERVAL || this.availableQuests.size === 0) {
      this.refreshAvailableQuests(clock)
      this.lastRefreshTick = clock.tick
    }

    // Check for expired quests
    this.checkExpiredQuests(clock)
  }

  /** Get all quests available for acceptance */
  getAvailableQuests(agentLevel?: number): Quest[] {
    const quests = Array.from(this.availableQuests.values())
    if (agentLevel !== undefined) {
      return quests.filter(q => !q.requiredLevel || q.requiredLevel <= agentLevel)
    }
    return quests
  }

  /** Accept a quest for an agent */
  acceptQuest(agentId: string, questId: string): { success: boolean; error?: string } {
    const quest = this.availableQuests.get(questId)
    if (!quest) return { success: false, error: 'Quest not found or no longer available' }

    let agentQuests = this.activeQuests.get(agentId)
    if (!agentQuests) {
      agentQuests = new Map()
      this.activeQuests.set(agentId, agentQuests)
    }

    if (agentQuests.size >= MAX_ACTIVE_PER_AGENT) {
      return { success: false, error: `Cannot have more than ${MAX_ACTIVE_PER_AGENT} active quests` }
    }

    if (agentQuests.has(questId)) {
      return { success: false, error: 'Quest already accepted' }
    }

    const clock = this.clockGetter()
    const activeQuest: ActiveQuest = {
      quest,
      agentId,
      status: 'active',
      acceptedAt: clock.tick,
      objectives: quest.objectives.map(o => ({ ...o, current: 0 })),
    }

    agentQuests.set(questId, activeQuest)
    // Remove from available pool
    this.availableQuests.delete(questId)

    return { success: true }
  }

  /** Get active quests for an agent */
  getAgentQuests(agentId: string): ActiveQuest[] {
    const agentQuests = this.activeQuests.get(agentId)
    if (!agentQuests) return []
    return Array.from(agentQuests.values())
  }

  /** Try to complete a quest */
  completeQuest(agentId: string, questId: string): {
    success: boolean
    error?: string
    rewards?: QuestReward
  } {
    const agentQuests = this.activeQuests.get(agentId)
    if (!agentQuests) return { success: false, error: 'No active quests' }

    const active = agentQuests.get(questId)
    if (!active) return { success: false, error: 'Quest not active' }

    // Check if all objectives are met
    for (const obj of active.objectives) {
      if (obj.current < obj.required) {
        return {
          success: false,
          error: `Objective not met: ${obj.description} (${obj.current}/${obj.required})`,
        }
      }
    }

    const clock = this.clockGetter()
    active.status = 'completed'
    active.completedAt = clock.tick
    this.completedQuestIds.add(questId)

    // Remove from active
    agentQuests.delete(questId)
    if (agentQuests.size === 0) this.activeQuests.delete(agentId)

    return { success: true, rewards: active.quest.rewards }
  }

  /** Listen to world events to auto-progress quest objectives */
  private listenForProgress(): void {
    this.eventBus.onAny((event) => {
      switch (event.type) {
        case 'resource:gathered':
          this.progressObjective(event.agentId, 'gather', event.resourceType, event.amount)
          break
        case 'item:crafted':
          this.progressObjective(event.agentId, 'craft', 'any', 1)
          break
        case 'trade:completed':
          this.progressObjective(event.buyerId, 'trade', 'trades', 1)
          this.progressObjective(event.sellerId, 'trade', 'trades', 1)
          break
        case 'agent:spoke':
          if (event.targetAgentId) {
            this.progressObjective(event.agentId, 'social', 'agents', 1)
          }
          break
        case 'agent:moved':
          this.checkExploreObjectives(event.agentId, event.to)
          this.checkDeliverObjectives(event.agentId, event.to)
          break
      }
    })
  }

  /** Update progress on matching objectives for an agent */
  private progressObjective(agentId: string, type: QuestType, target: string, amount: number): void {
    const agentQuests = this.activeQuests.get(agentId)
    if (!agentQuests) return

    for (const active of agentQuests.values()) {
      if (active.status !== 'active') continue
      for (const obj of active.objectives) {
        if (obj.type !== type) continue
        if (obj.target === target || obj.target === 'any') {
          obj.current = Math.min(obj.required, obj.current + amount)
        }
      }
    }
  }

  /** Check if agent reached an explore objective location */
  private checkExploreObjectives(agentId: string, position: Position): void {
    const agentQuests = this.activeQuests.get(agentId)
    if (!agentQuests) return

    for (const active of agentQuests.values()) {
      if (active.status !== 'active') continue
      for (const obj of active.objectives) {
        if (obj.type !== 'explore' || !obj.targetPosition) continue
        const dx = Math.abs(position.x - obj.targetPosition.x)
        const dy = Math.abs(position.y - obj.targetPosition.y)
        if (dx <= 3 && dy <= 3) {
          obj.current = Math.min(obj.required, obj.current + 1)
        }
      }
    }
  }

  /** Check if agent reached a delivery target location */
  private checkDeliverObjectives(agentId: string, position: Position): void {
    const agentQuests = this.activeQuests.get(agentId)
    if (!agentQuests) return

    for (const active of agentQuests.values()) {
      if (active.status !== 'active') continue
      for (const obj of active.objectives) {
        if (obj.type !== 'deliver' || !obj.targetPosition) continue
        const dx = Math.abs(position.x - obj.targetPosition.x)
        const dy = Math.abs(position.y - obj.targetPosition.y)
        // Check that prior gather objectives are met first
        const gatherObjs = active.objectives.filter(o => o.type === 'gather')
        const gathersMet = gatherObjs.every(o => o.current >= o.required)
        if (dx <= 3 && dy <= 3 && gathersMet) {
          obj.current = Math.min(obj.required, obj.current + 1)
        }
      }
    }
  }

  /** Check for expired quests and mark as failed */
  private checkExpiredQuests(clock: WorldClock): void {
    for (const [agentId, agentQuests] of this.activeQuests) {
      for (const [questId, active] of agentQuests) {
        if (active.status !== 'active') continue
        if (active.quest.timeLimit) {
          const deadline = active.acceptedAt + active.quest.timeLimit
          if (clock.tick >= deadline) {
            active.status = 'expired'
            agentQuests.delete(questId)
            if (agentQuests.size === 0) this.activeQuests.delete(agentId)
          }
        }
      }
    }
  }

  /** Generate new quests to fill available pool */
  private refreshAvailableQuests(clock: WorldClock): void {
    // Remove expired available quests (older than 1 game day)
    for (const [id, quest] of this.availableQuests) {
      if (clock.tick - quest.createdAt > TICKS_PER_GAME_DAY) {
        this.availableQuests.delete(id)
      }
    }

    // Fill up to MAX_AVAILABLE_QUESTS
    const needed = MAX_AVAILABLE_QUESTS - this.availableQuests.size
    if (needed <= 0) return

    const pois = this.tileMap.pois
    if (pois.length === 0) return

    // Find a guild master NPC to be the quest giver
    const guildMaster = this.npcManager.getAllNpcs().find(n => n.npcRole === 'guild_master')
    const giverId = guildMaster?.id ?? 'system'

    for (let i = 0; i < needed; i++) {
      const template = QUEST_TEMPLATES[Math.floor(Math.random() * QUEST_TEMPLATES.length)]
      const generated = template.generate(pois, this.tileMap)

      const id = generateId('quest')
      const title = this.fillTemplate(template.titleTemplate, generated, pois)
      const description = this.fillTemplate(template.descTemplate, generated, pois)

      const quest: Quest = {
        id,
        type: template.type,
        title,
        description,
        objectives: generated.objectives.map(o => ({
          ...o,
          id: generateId('obj'),
          current: 0,
        })),
        rewards: generated.rewards,
        difficulty: template.difficulty,
        timeLimit: generated.timeLimit,
        requiredLevel: template.minLevel,
        giver: giverId,
        createdAt: clock.tick,
      }

      this.availableQuests.set(id, quest)
    }

    console.log(`[QuestManager] Refreshed quests: ${this.availableQuests.size} available`)
  }

  private fillTemplate(
    template: string,
    generated: { objectives: Omit<QuestObjective, 'id' | 'current'>[] },
    pois: PointOfInterest[],
  ): string {
    const obj = generated.objectives[0]
    let result = template
    if (obj) {
      result = result
        .replace('{amount}', String(obj.required))
        .replace('{resource}', obj.target)
        .replace('{count}', String(generated.objectives.length))
    }
    // Replace {poi} with a random POI name
    if (result.includes('{poi}')) {
      const poi = pois[Math.floor(Math.random() * pois.length)]
      result = result.replace('{poi}', poi?.name ?? 'the settlement')
    }
    return result
  }
}
