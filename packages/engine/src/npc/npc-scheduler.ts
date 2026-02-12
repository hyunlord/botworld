/**
 * NPC Scheduler — manages LLM call timing and action execution.
 *
 * Each NPC has a staggered timer so they don't all call the API at once.
 * Intervals adapt based on NPC state:
 *   - Someone nearby & talking: 15 seconds (active conversation)
 *   - Someone nearby: 30 seconds (social awareness)
 *   - Alone: 60-90 seconds (low priority)
 *   - Routine says no LLM: skip entirely (rule-based behavior)
 */

import type { Agent, NpcRole, Position, WorldClock } from '@botworld/shared'
import type { NPCContext, NPCDecision } from './npc-brain.js'
import { callNPCBrain } from './npc-brain.js'
import { buildSystemPrompt } from './npc-prompts.js'
import { getRoutineEntry } from './npc-routines.js'
import type { EventBus } from '../core/event-bus.js'
import { findPath } from '../world/pathfinding.js'
import type { TileMap } from '../world/tile-map.js'

// ── Configuration ──

const BASE_INTERVAL = parseInt(process.env.NPC_ACTION_INTERVAL_BASE ?? '30000', 10)
const NEARBY_RADIUS = 8

// ── Types ──

export interface NPCSchedulerRuntime {
  npcId: string
  role: NpcRole
  systemPrompt: string
  lastDecisionTime: number
  /** Milliseconds until next LLM call */
  currentInterval: number
  /** Recent chat messages this NPC heard */
  recentChat: string[]
  /** Whether someone is nearby (for interval tuning) */
  hasNearby: boolean
  /** Whether there's active conversation nearby */
  hasConversation: boolean
}

interface NPCRef {
  agent: Agent
  homePosition: Position
  path: Position[]
  pathIndex: number
}

// ── Scheduler ──

export class NPCScheduler {
  private runtimes = new Map<string, NPCSchedulerRuntime>()
  private npcRefs: () => Map<string, NPCRef>
  private getAllAgentsIncludingNpcs: () => Agent[]
  private getWeather: () => string
  private getRecentEventDescriptions: () => string[]

  constructor(
    private eventBus: EventBus,
    private tileMap: TileMap,
    npcRefs: () => Map<string, NPCRef>,
    getAllAgents: () => Agent[],
    getWeather: () => string,
    getRecentEvents: () => string[],
  ) {
    this.npcRefs = npcRefs
    this.getAllAgentsIncludingNpcs = getAllAgents
    this.getWeather = getWeather
    this.getRecentEventDescriptions = getRecentEvents
  }

  /** Register an NPC for scheduled LLM decisions */
  register(npcId: string, role: NpcRole, name: string): void {
    // Stagger initial timing so NPCs don't all fire at once
    const jitter = Math.random() * BASE_INTERVAL
    this.runtimes.set(npcId, {
      npcId,
      role,
      systemPrompt: buildSystemPrompt(role, name),
      lastDecisionTime: Date.now() + jitter,
      currentInterval: BASE_INTERVAL + jitter,
      recentChat: [],
      hasNearby: false,
      hasConversation: false,
    })
  }

  /** Called from NpcManager.tick() — checks timers and triggers LLM decisions */
  async tick(clock: WorldClock): Promise<void> {
    const now = Date.now()

    for (const [npcId, runtime] of this.runtimes) {
      const elapsed = now - runtime.lastDecisionTime
      if (elapsed < runtime.currentInterval) continue

      const ref = this.npcRefs().get(npcId)
      if (!ref) continue

      // Check routine — some time slots skip LLM
      const routine = getRoutineEntry(runtime.role, clock.timeOfDay)

      // Update nearby state for interval tuning
      const nearby = this.findNearbyAgents(ref.agent.position, npcId)
      runtime.hasNearby = nearby.length > 0
      runtime.hasConversation = runtime.recentChat.length > 0 && nearby.length > 0

      // Adjust interval
      runtime.currentInterval = this.computeInterval(runtime)
      runtime.lastDecisionTime = now

      if (!routine.useLLM) {
        // Rule-based fallback for this time slot
        this.executeFallback(ref, runtime, routine.fallback, clock)
        continue
      }

      // Build context and call LLM
      const context = this.buildContext(ref, runtime, clock, nearby, routine.hint)

      // Use premium model if talking to a player agent
      const hasPlayerNearby = nearby.some(a => !a.isNpc)

      // Fire-and-forget: don't block the tick loop
      callNPCBrain(runtime.systemPrompt, context, hasPlayerNearby)
        .then(decision => {
          if (decision) {
            this.executeDecision(ref, runtime, decision, clock)
          } else {
            this.executeFallback(ref, runtime, routine.fallback, clock)
          }
        })
        .catch(() => {
          this.executeFallback(ref, runtime, routine.fallback, clock)
        })
    }
  }

  /** Feed a chat message to nearby NPCs so they have conversation context */
  feedChat(speakerId: string, speakerName: string, message: string, position: Position): void {
    for (const [npcId, runtime] of this.runtimes) {
      const ref = this.npcRefs().get(npcId)
      if (!ref) continue

      const dist = Math.abs(ref.agent.position.x - position.x) +
                   Math.abs(ref.agent.position.y - position.y)
      if (dist <= NEARBY_RADIUS && npcId !== speakerId) {
        runtime.recentChat.push(`${speakerName}: ${message}`)
        // Keep only last 5 messages
        if (runtime.recentChat.length > 5) {
          runtime.recentChat = runtime.recentChat.slice(-5)
        }

        // If someone spoke nearby, reduce interval for quicker response
        runtime.hasConversation = true
        runtime.currentInterval = Math.min(runtime.currentInterval, 15_000)
      }
    }
  }

  // ── Private helpers ──

  private computeInterval(runtime: NPCSchedulerRuntime): number {
    if (runtime.hasConversation) return 15_000  // Active conversation
    if (runtime.hasNearby) return BASE_INTERVAL  // Someone nearby
    return BASE_INTERVAL * 2 + Math.random() * 30_000  // Alone: 60-90s
  }

  private findNearbyAgents(position: Position, excludeId: string): Agent[] {
    const all = this.getAllAgentsIncludingNpcs()
    return all.filter(a => {
      if (a.id === excludeId) return false
      const dx = Math.abs(a.position.x - position.x)
      const dy = Math.abs(a.position.y - position.y)
      return dx <= NEARBY_RADIUS && dy <= NEARBY_RADIUS
    })
  }

  private buildContext(
    ref: NPCRef,
    runtime: NPCSchedulerRuntime,
    clock: WorldClock,
    nearby: Agent[],
    routineHint: string,
  ): NPCContext {
    return {
      npcName: ref.agent.name,
      npcRole: runtime.role,
      npcBio: ref.agent.bio,
      timeOfDay: clock.timeOfDay,
      day: clock.day,
      weather: this.getWeather(),
      position: { x: ref.agent.position.x, y: ref.agent.position.y },
      nearbyAgents: nearby.map(a => ({
        id: a.id,
        name: a.name,
        level: a.level,
        action: a.currentAction?.type ?? 'idle',
        distance: Math.abs(a.position.x - ref.agent.position.x) +
                  Math.abs(a.position.y - ref.agent.position.y),
        isNpc: a.isNpc ?? false,
      })),
      recentEvents: this.getRecentEventDescriptions(),
      recentChat: [...runtime.recentChat],
      emotionState: this.summarizeEmotion(ref.agent),
      inventory: ref.agent.inventory.map(i => `${i.name} x${i.quantity}`),
      routineHint,
    }
  }

  private summarizeEmotion(agent: Agent): string {
    const mood = agent.currentMood
    const entries = Object.entries(mood) as [string, number][]
    const top = entries.sort((a, b) => b[1] - a[1]).slice(0, 2)
    if (top.length === 0 || top[0][1] < 0.1) return 'calm and neutral'
    return top
      .filter(([, v]) => v > 0.1)
      .map(([k, v]) => `${k} (${Math.round(v * 100)}%)`)
      .join(', ') || 'calm and neutral'
  }

  private executeDecision(
    ref: NPCRef,
    runtime: NPCSchedulerRuntime,
    decision: NPCDecision,
    clock: WorldClock,
  ): void {
    const { agent } = ref

    switch (decision.action) {
      case 'speak': {
        if (decision.params.message) {
          this.eventBus.emit({
            type: 'agent:spoke',
            agentId: agent.id,
            targetAgentId: decision.params.target,
            message: decision.params.message,
            timestamp: clock.tick,
          })
          // Clear conversation buffer after responding
          runtime.recentChat = []
        }
        break
      }

      case 'move': {
        const dest = decision.params.destination
        if (dest) {
          // Clamp to reasonable range (max 15 tiles from current position)
          const clampedX = Math.max(agent.position.x - 15, Math.min(agent.position.x + 15, dest.x))
          const clampedY = Math.max(agent.position.y - 15, Math.min(agent.position.y + 15, dest.y))
          const path = findPath(this.tileMap, agent.position, { x: clampedX, y: clampedY })
          if (path.length > 0) {
            ref.path = path
            ref.pathIndex = 0
          }
        }
        break
      }

      case 'emote': {
        if (decision.params.emotion) {
          // Map emotion string to a visible speech bubble
          const emoteText = this.emotionToEmote(decision.params.emotion)
          this.eventBus.emit({
            type: 'agent:spoke',
            agentId: agent.id,
            message: emoteText,
            timestamp: clock.tick,
          })
        }
        break
      }

      case 'rest': {
        // NPC just stays still and regenerates
        break
      }

      case 'idle':
      default:
        break
    }
  }

  private executeFallback(
    ref: NPCRef,
    runtime: NPCSchedulerRuntime,
    fallback: string,
    clock: WorldClock,
  ): void {
    switch (fallback) {
      case 'speak': {
        // Use existing scripted dialogue (handled by NpcManager.idleChatter)
        break
      }
      case 'move_home': {
        const home = ref.homePosition
        if (home.x !== ref.agent.position.x || home.y !== ref.agent.position.y) {
          const path = findPath(this.tileMap, ref.agent.position, home)
          if (path.length > 0) {
            ref.path = path
            ref.pathIndex = 0
          }
        }
        break
      }
      case 'move_wander': {
        // Handled by existing wanderer tick in NpcManager
        break
      }
      case 'rest':
      case 'idle':
      default:
        break
    }
  }

  private emotionToEmote(emotion: string): string {
    const EMOTES: Record<string, string> = {
      happy: '*smiles warmly*',
      worried: '*looks around nervously*',
      excited: '*eyes light up with excitement*',
      calm: '*takes a deep breath*',
      angry: '*frowns*',
      sad: '*sighs quietly*',
    }
    return EMOTES[emotion] ?? '*nods*'
  }
}
