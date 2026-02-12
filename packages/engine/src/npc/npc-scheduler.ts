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

import type { Agent, NpcRole, Position, WorldClock, ActionPlan } from '@botworld/shared'
import type { NPCContext, NPCDecision } from './npc-brain.js'
import { callNPCBrain, callNPCBrainForPlan } from './npc-brain.js'
import { buildSystemPrompt } from './npc-prompts.js'
import { getRoutineEntry } from './npc-routines.js'
import type { EventBus } from '../core/event-bus.js'
import { findPath } from '../world/pathfinding.js'
import type { TileMap } from '../world/tile-map.js'
import type { PlanExecutor } from '../agent/plan-executor.js'
import type { RelationshipManager } from '../social/relationship-manager.js'
import type { RumorSystem } from '../social/rumor-system.js'
import type { SecretSystem } from '../social/secret-system.js'
import type { ReputationSystem } from '../social/reputation-system.js'
import type { GuildManager } from '../politics/guild-manager.js'
import type { SettlementManager } from '../politics/settlement-manager.js'
import type { KingdomManager } from '../politics/kingdom-manager.js'
import type { EcosystemManager } from '../world/ecosystem-manager.js'

// ── Configuration ──

const BASE_INTERVAL = parseInt(process.env.NPC_ACTION_INTERVAL_BASE ?? '45000', 10)
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

// ── Helper function to convert single decisions to plans ──

function singleDecisionToPlan(decision: NPCDecision, role: NpcRole): ActionPlan {
  const steps: ActionPlan['steps'] = []

  switch (decision.action) {
    case 'speak': {
      if (decision.params.message) {
        steps.push({
          action: 'speak',
          params: { message: decision.params.message },
          target: decision.params.target,
          wait_after: 3 + Math.floor(Math.random() * 5),
        })
      }
      // Add a follow-up idle with ambient feel
      steps.push({
        action: 'idle',
        params: {},
        wait_after: 5 + Math.floor(Math.random() * 10),
      })
      break
    }
    case 'move': {
      if (decision.params.destination) {
        steps.push({
          action: 'move',
          params: { destination: decision.params.destination },
        })
        // After arriving, do something contextual
        steps.push({
          action: 'idle',
          params: {},
          wait_after: 3 + Math.floor(Math.random() * 5),
        })
      }
      break
    }
    case 'emote': {
      if (decision.params.emotion) {
        steps.push({
          action: 'emote',
          params: { emote: `*${decision.params.emotion}*` },
          wait_after: 5,
        })
      }
      break
    }
    case 'rest': {
      steps.push({
        action: 'rest',
        params: { duration: 10 },
      })
      break
    }
    case 'idle':
    default: {
      steps.push({
        action: 'idle',
        params: {},
        wait_after: 10 + Math.floor(Math.random() * 20),
      })
      break
    }
  }

  return {
    plan_name: decision.thinking || decision.action,
    steps,
    interrupt_conditions: {
      on_spoken_to: 'pause_and_respond',
    },
    max_duration: 60,
  }
}

// ── Ambient dialogue pools (when NPC is alone) ──

const AMBIENT_LINES: Record<string, string[]> = {
  innkeeper: [
    '*hums while wiping a glass*',
    'That stew needs more salt...',
    'I should restock the ale soon.',
    '*looks out the window* Nice day...',
    'Wonder when the next travelers will arrive.',
    '*arranges plates on the counter*',
  ],
  merchant: [
    '*counts coins quietly*',
    'These prices are fair, very fair...',
    '*inspects merchandise*',
    'The roads were rough today.',
    'I should visit the eastern market next.',
    '*adjusts a price tag*',
  ],
  guard: [
    '*scans the horizon*',
    'All clear so far...',
    '*adjusts armor*',
    'Quiet night... too quiet.',
    'Stay vigilant...',
    '*paces back and forth*',
  ],
  wanderer: [
    '*gazes at the sky*',
    'Long road ahead...',
    '*stretches and yawns*',
    'What a beautiful place.',
    'I wonder what lies beyond those hills.',
    '*hums a travel song*',
  ],
  guild_master: [
    '*reads an old tome*',
    'The guild grows stronger each day.',
    '*strokes chin thoughtfully*',
    'There is much to learn still.',
    'Discipline... that is the key.',
    '*examines a guild notice*',
  ],
  blacksmith: [
    '*hammers a glowing ingot*',
    'This steel needs more carbon...',
    '*examines blade edge critically*',
    'Good metal sings when you strike it right.',
    '*stokes the forge fire*',
    'Where did I put that mithril...',
  ],
  scholar: [
    '*turns a page carefully*',
    'Fascinating... absolutely fascinating.',
    '*scribbles in a notebook*',
    'The old texts mention this exact pattern...',
    '*adjusts reading glasses*',
    'I must cross-reference this with the archives.',
  ],
  farmer: [
    '*checks the soil moisture*',
    'The crops look good this season.',
    '*pulls a stubborn weed*',
    'Rain would be a blessing right about now.',
    '*wipes brow* Hard work, honest work.',
    'These tomatoes are coming along nicely.',
  ],
  priest: [
    '*clasps hands in silent prayer*',
    'May the light guide all travelers.',
    '*lights incense at the altar*',
    'I sense a change in the wind...',
    '*reads from a sacred text*',
    'Peace be upon this place.',
  ],
}

export class NPCScheduler {
  private runtimes = new Map<string, NPCSchedulerRuntime>()
  private npcRefs: () => Map<string, NPCRef>
  private getAllAgentsIncludingNpcs: () => Agent[]
  private getWeather: () => string
  private getRecentEventDescriptions: () => string[]
  private planExecutor: PlanExecutor | null = null

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

  /** Set the plan executor reference (called by NpcManager after WorldEngine creates it) */
  setPlanExecutor(executor: PlanExecutor): void {
    this.planExecutor = executor
  }

  // ── Social system references ──
  private relationshipManager: RelationshipManager | null = null
  private rumorSystem: RumorSystem | null = null
  private secretSystem: SecretSystem | null = null
  private reputationSystem: ReputationSystem | null = null

  /** Wire social systems for LLM context enrichment */
  setSocialSystems(
    rm: RelationshipManager,
    rs: RumorSystem,
    ss: SecretSystem,
    rep: ReputationSystem,
  ): void {
    this.relationshipManager = rm
    this.rumorSystem = rs
    this.secretSystem = ss
    this.reputationSystem = rep
  }

  // ── Politics system references ──
  private guildManager: GuildManager | null = null
  private settlementManager: SettlementManager | null = null
  private kingdomManager: KingdomManager | null = null
  private ecosystemManager: EcosystemManager | null = null

  /** Wire politics systems for LLM context enrichment */
  setPoliticsSystems(
    gm: GuildManager,
    sm: SettlementManager,
    km: KingdomManager,
  ): void {
    this.guildManager = gm
    this.settlementManager = sm
    this.kingdomManager = km
  }

  /** Wire ecosystem manager for seasonal context */
  setEcosystemManager(em: EcosystemManager): void {
    this.ecosystemManager = em
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

      // Skip if NPC already has an active plan running
      if (this.planExecutor?.hasPlan(npcId)) continue

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
      if (this.planExecutor) {
        // Use plan-aware brain call → set plan directly
        callNPCBrainForPlan(runtime.systemPrompt, context, hasPlayerNearby)
          .then(plan => {
            if (plan && !this.planExecutor!.hasPlan(npcId)) {
              this.planExecutor!.setPlan(npcId, plan)
            } else if (!plan) {
              this.executeFallback(ref, runtime, routine.fallback, clock)
            }
          })
          .catch(() => {
            this.executeFallback(ref, runtime, routine.fallback, clock)
          })
      } else {
        // Legacy: single-action brain call
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
  }

  /** Feed a chat message to nearby NPCs so they have conversation context */
  feedChat(speakerId: string, speakerName: string, message: string, position: Position, targetId?: string): void {
    for (const [npcId, runtime] of this.runtimes) {
      const ref = this.npcRefs().get(npcId)
      if (!ref) continue

      const dist = Math.abs(ref.agent.position.x - position.x) +
                   Math.abs(ref.agent.position.y - position.y)
      if (dist <= NEARBY_RADIUS && npcId !== speakerId) {
        // Mark if this message is directed at this NPC
        const prefix = targetId === npcId ? '[to you] ' : ''
        runtime.recentChat.push(`${prefix}${speakerName}: ${message}`)
        // Keep only last 5 messages
        if (runtime.recentChat.length > 5) {
          runtime.recentChat = runtime.recentChat.slice(-5)
        }

        // If someone spoke nearby, reduce interval for quicker response
        // Respond faster when directly addressed
        runtime.hasConversation = true
        runtime.currentInterval = Math.min(
          runtime.currentInterval,
          targetId === npcId ? 8_000 : 15_000,
        )
      }
    }
  }

  // ── Private helpers ──

  private computeInterval(runtime: NPCSchedulerRuntime): number {
    if (runtime.hasConversation) return 15_000  // Active conversation nearby
    if (runtime.hasNearby) return 15_000         // Agent nearby: respond quickly
    return 90_000 + Math.random() * 15_000       // Alone: 90-105s (cost saving)
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
    // Find nearest POI name
    const poiName = this.findNearestPoiName(ref.agent.position)
    const gold = ref.agent.inventory
      .filter(i => i.name.toLowerCase().includes('gold') || i.name.toLowerCase().includes('coin'))
      .reduce((sum, i) => sum + i.quantity, 0)

    // Build social context if social systems are available
    const nearbyIds = nearby.map(a => a.id)
    const getAgentName = (id: string) => {
      const all = this.getAllAgentsIncludingNpcs()
      return all.find(a => a.id === id)?.name ?? 'Unknown'
    }

    const relationshipContext = this.relationshipManager
      ? this.relationshipManager.formatForLLM(ref.agent.id, nearbyIds, getAgentName)
      : undefined
    const rumorContext = this.rumorSystem
      ? this.rumorSystem.formatForLLM(ref.agent.id, getAgentName)
      : undefined
    const secretContext = this.secretSystem
      ? this.secretSystem.formatForLLM(ref.agent.id, getAgentName)
      : undefined
    const reputationContext = this.reputationSystem
      ? this.reputationSystem.formatForLLM(ref.agent.id)
      : undefined

    // Build politics context if politics systems are available
    const guildContext = this.guildManager
      ? this.guildManager.formatForLLM(ref.agent.id, getAgentName)
      : undefined
    const settlementContext = this.settlementManager
      ? this.settlementManager.formatForLLM(ref.agent.id)
      : undefined
    const kingdomContext = this.kingdomManager
      ? this.kingdomManager.formatForLLM(ref.agent.id, getAgentName)
      : undefined

    return {
      npcName: ref.agent.name,
      npcRole: runtime.role,
      npcBio: ref.agent.bio,
      timeOfDay: clock.timeOfDay,
      day: clock.day,
      season: '',  // computed in brain from day
      weather: this.getWeather(),
      position: { x: ref.agent.position.x, y: ref.agent.position.y },
      poiName,
      hp: ref.agent.stats.hp,
      maxHp: ref.agent.stats.maxHp,
      energy: ref.agent.stats.energy,
      maxEnergy: ref.agent.stats.maxEnergy,
      hunger: ref.agent.stats.hunger,
      maxHunger: ref.agent.stats.maxHunger,
      gold,
      nearbyAgents: nearby.map(a => ({
        id: a.id,
        name: a.name,
        level: a.level,
        action: a.currentAction?.type ?? 'idle',
        distance: Math.abs(a.position.x - ref.agent.position.x) +
                  Math.abs(a.position.y - ref.agent.position.y),
        isNpc: a.isNpc ?? false,
        role: a.npcRole,
      })),
      recentEvents: this.getRecentEventDescriptions(),
      recentChat: [...runtime.recentChat],
      emotionState: this.summarizeEmotion(ref.agent),
      inventory: ref.agent.inventory.map(i => `${i.name} x${i.quantity}`),
      routineHint: this.ecosystemManager
        ? `${routineHint}\n${this.ecosystemManager.formatForLLM()}`
        : routineHint,
      relationshipContext,
      rumorContext,
      secretContext,
      reputationContext,
      guildContext,
      settlementContext,
      kingdomContext,
    }
  }

  /** Find the name of the nearest POI to a position */
  private findNearestPoiName(pos: Position): string | undefined {
    const pois = this.tileMap.pois
    let best: { name: string; dist: number } | undefined
    for (const poi of pois) {
      const dist = Math.abs(poi.position.x - pos.x) + Math.abs(poi.position.y - pos.y)
      if (dist <= 5 && (!best || dist < best.dist)) {
        best = { name: poi.name, dist }
      }
    }
    return best?.name
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
          // Resolve target name to agent ID
          const nearby = this.findNearbyAgents(agent.position, agent.id)
          const resolvedTarget = this.resolveTargetId(decision.params.target, nearby)

          this.eventBus.emit({
            type: 'agent:spoke',
            agentId: agent.id,
            targetAgentId: resolvedTarget,
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

      case 'rest':
      case 'idle':
      default: {
        // Ambient dialogue: occasionally mutter when alone
        if (!runtime.hasNearby && Math.random() < 0.25) {
          const ambient = this.getAmbientLine(runtime.role)
          this.eventBus.emit({
            type: 'agent:spoke',
            agentId: agent.id,
            message: ambient,
            timestamp: clock.tick,
          })
        }
        break
      }
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
        // Emit ambient dialogue since LLM is not available for this slot
        if (Math.random() < 0.3) {
          const ambient = this.getAmbientLine(runtime.role)
          this.eventBus.emit({
            type: 'agent:spoke',
            agentId: ref.agent.id,
            message: ambient,
            timestamp: clock.tick,
          })
        }
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

  /** Resolve a target string (name or ID) to a valid agent ID */
  private resolveTargetId(targetStr: string | undefined, nearby: Agent[]): string | undefined {
    if (!targetStr) return undefined
    // Already a valid agent ID?
    if (nearby.some(a => a.id === targetStr)) return targetStr
    // Exact name match
    const exact = nearby.find(a => a.name === targetStr)
    if (exact) return exact.id
    // Partial name match (case-insensitive)
    const lower = targetStr.toLowerCase()
    const partial = nearby.find(a =>
      a.name.toLowerCase().includes(lower) || lower.includes(a.name.toLowerCase()),
    )
    if (partial) return partial.id
    // First-name match (e.g. "Helga" matches "Helga the Innkeeper")
    const firstName = lower.split(/\s+/)[0]
    if (firstName.length >= 3) {
      const firstMatch = nearby.find(a => a.name.toLowerCase().startsWith(firstName))
      if (firstMatch) return firstMatch.id
    }
    return undefined
  }

  /** Get a random ambient dialogue line for an NPC role */
  private getAmbientLine(role: NpcRole): string {
    const lines = AMBIENT_LINES[role]
    if (!lines?.length) return '*nods quietly*'
    return lines[Math.floor(Math.random() * lines.length)]
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
