import type { Agent, Position } from '@botworld/shared'

export const PRIORITY_SCHEDULER_VERSION = 1

export interface ViewportBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export interface PriorityFactors {
  /** Spectator is following this NPC (+40) */
  isFollowed: boolean
  /** NPC is interacting with a player agent/bot (+30) */
  interactingWithPlayer: boolean
  /** NPC is within spectator camera viewport (+25) */
  inViewport: boolean
  /** NPC is in combat (+20) */
  inCombat: boolean
  /** NPC is participating in a world event (+15) */
  inEvent: boolean
  /** NPC is at same POI as a player agent (+10) */
  nearPlayer: boolean
  /** NPC had social changes recently (+5) */
  recentSocialChange: boolean
}

export interface NPCPriority {
  npcId: string
  score: number
  interval: number  // milliseconds between LLM calls
  factors: PriorityFactors
}

function manhattan(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

export class PriorityScheduler {
  /** Current viewport bounds from spectator clients */
  private viewports: ViewportBounds[] = []
  /** NPC ID that spectator is following */
  private followedNpcId: string | null = null
  /** Set of NPC IDs currently in combat */
  private combatNpcs = new Set<string>()
  /** Set of NPC IDs in active world events */
  private eventNpcs = new Set<string>()
  /** Set of NPC IDs with recent social changes (auto-expires) */
  private socialChangeNpcs = new Map<string, number>() // npcId -> expiry tick
  /** Player agent IDs (non-NPC agents) */
  private playerAgentIds = new Set<string>()

  /** Update viewport bounds from spectator client */
  updateViewport(bounds: ViewportBounds): void {
    // Add new viewport, cap at 10 to prevent memory issues
    this.viewports.push(bounds)
    if (this.viewports.length > 10) {
      this.viewports.shift()
    }
  }

  /** Set the NPC being followed by a spectator */
  setFollowedNpc(npcId: string | null): void {
    this.followedNpcId = npcId
  }

  /** Mark NPC as in combat */
  setCombat(npcId: string, inCombat: boolean): void {
    if (inCombat) {
      this.combatNpcs.add(npcId)
    } else {
      this.combatNpcs.delete(npcId)
    }
  }

  /** Mark NPC as in world event */
  setInEvent(npcId: string, inEvent: boolean): void {
    if (inEvent) {
      this.eventNpcs.add(npcId)
    } else {
      this.eventNpcs.delete(npcId)
    }
  }

  /** Mark NPC as having recent social change (expires after duration ticks) */
  markSocialChange(npcId: string, currentTick: number, durationTicks: number = 60): void {
    const expiryTick = currentTick + durationTicks
    this.socialChangeNpcs.set(npcId, expiryTick)
  }

  /** Update player agent IDs (non-NPC agents from agentManager) */
  updatePlayerAgents(agentIds: string[]): void {
    this.playerAgentIds.clear()
    for (const id of agentIds) {
      this.playerAgentIds.add(id)
    }
  }

  /** Check if position is within any viewport */
  private isInAnyViewport(pos: Position): boolean {
    return this.viewports.some(bounds =>
      pos.x >= bounds.minX &&
      pos.x <= bounds.maxX &&
      pos.y >= bounds.minY &&
      pos.y <= bounds.maxY
    )
  }

  /** Calculate priority for an NPC */
  calculatePriority(npcId: string, agent: Agent, allAgents: Agent[]): NPCPriority {
    let score = 0
    const factors: PriorityFactors = {
      isFollowed: false,
      interactingWithPlayer: false,
      inViewport: false,
      inCombat: false,
      inEvent: false,
      nearPlayer: false,
      recentSocialChange: false
    }

    // Check if followed (+40)
    if (this.followedNpcId === npcId) {
      score += 40
      factors.isFollowed = true
    }

    // Check if interacting with player (+30, within 8 tiles)
    for (const playerId of this.playerAgentIds.values()) {
      const player = allAgents.find(a => a.id === playerId)
      if (player && manhattan(agent.position, player.position) <= 8) {
        score += 30
        factors.interactingWithPlayer = true
        break
      }
    }

    // Check viewport (+25)
    if (this.isInAnyViewport(agent.position)) {
      score += 25
      factors.inViewport = true
    }

    // Check combat (+20)
    if (this.combatNpcs.has(npcId)) {
      score += 20
      factors.inCombat = true
    }

    // Check event (+15)
    if (this.eventNpcs.has(npcId)) {
      score += 15
      factors.inEvent = true
    }

    // Check near player (+10, within 15 tiles, if not already interacting)
    if (!factors.interactingWithPlayer) {
      for (const playerId of this.playerAgentIds.values()) {
        const player = allAgents.find(a => a.id === playerId)
        if (player && manhattan(agent.position, player.position) <= 15) {
          score += 10
          factors.nearPlayer = true
          break
        }
      }
    }

    // Check social change (+5)
    if (this.socialChangeNpcs.has(npcId)) {
      score += 5
      factors.recentSocialChange = true
    }

    // Cap at 100
    score = Math.min(score, 100)

    const interval = this.getInterval(score)

    return { npcId, score, interval, factors }
  }

  /** Get the LLM call interval for a priority score */
  getInterval(score: number): number {
    if (score >= 80) return 5000    // 5s, very important
    if (score >= 60) return 15000   // 15s
    if (score >= 40) return 30000   // 30s
    if (score >= 20) return 60000   // 1min
    if (score >= 10) return 120000  // 2min
    return 300000                   // 5min, minimum frequency
  }

  /** Check if an NPC is currently in combat */
  isInCombat(npcId: string): boolean {
    return this.combatNpcs.has(npcId)
  }

  /** Clean up expired social changes */
  cleanupExpired(currentTick: number): void {
    for (const [npcId, expiryTick] of this.socialChangeNpcs.entries()) {
      if (currentTick > expiryTick) {
        this.socialChangeNpcs.delete(npcId)
      }
    }
  }

  /** Get all priorities (for monitoring/debug) */
  getAllPriorities(agents: Agent[], allAgents: Agent[]): NPCPriority[] {
    const priorities: NPCPriority[] = []
    for (const agent of agents) {
      priorities.push(this.calculatePriority(agent.id, agent, allAgents))
    }
    return priorities
  }
}
