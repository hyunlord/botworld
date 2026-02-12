/**
 * ReputationSystem — tracks agent reputation across 5 categories + infamy,
 * and automatically calculates social status.
 *
 * Social status determines NPC attitudes, shop discounts, guild access, etc.
 */

import type {
  AgentReputation, ReputationCategory, SocialStatus, WorldClock, Agent,
} from '@botworld/shared'
import { createDefaultReputation } from '@botworld/shared'
import type { EventBus } from '../core/event-bus.js'

const STATUS_CHECK_INTERVAL = 50  // Re-evaluate status every 50 ticks

export class ReputationSystem {
  /** agentId → reputation */
  private reputations = new Map<string, AgentReputation>()
  /** agentId → social status */
  private statuses = new Map<string, SocialStatus>()
  private eventBus: EventBus
  private lastStatusCheck = 0

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus
  }

  /** Get or create reputation for an agent */
  getReputation(agentId: string): AgentReputation {
    let rep = this.reputations.get(agentId)
    if (!rep) {
      rep = createDefaultReputation()
      this.reputations.set(agentId, rep)
    }
    return rep
  }

  /** Get social status for an agent */
  getStatus(agentId: string): SocialStatus {
    return this.statuses.get(agentId) ?? 'newcomer'
  }

  /** Adjust a reputation category */
  adjustReputation(
    agentId: string,
    category: ReputationCategory,
    delta: number,
    reason: string,
    tick: number,
  ): void {
    const rep = this.getReputation(agentId)
    const oldValue = rep[category]
    rep[category] = Math.max(-100, Math.min(100, rep[category] + delta))

    if (oldValue !== rep[category]) {
      this.eventBus.emit({
        type: 'reputation:changed',
        agentId,
        category,
        oldValue,
        newValue: rep[category],
        reason,
        timestamp: tick,
      })
    }
  }

  /** Add infamy */
  addInfamy(agentId: string, amount: number): void {
    const rep = this.getReputation(agentId)
    rep.infamy = Math.max(0, rep.infamy + amount)
  }

  /** Calculate social status based on reputation and game state */
  calculateStatus(
    agentId: string,
    agent: Agent,
    tick: number,
  ): SocialStatus {
    const rep = this.getReputation(agentId)

    // Count categories at 70+
    const highRepCount = [rep.combat, rep.trading, rep.social, rep.crafting, rep.leadership]
      .filter(v => v >= 70).length

    // Legend: 3+ categories at 70+
    if (highRepCount >= 3) return 'legend'

    // Hero: contributed heroically to world events (tracked via combat rep 90+)
    if (rep.combat >= 90) return 'hero'

    // Noble: leadership reputation 80+
    if (rep.leadership >= 80) return 'noble'

    // Scholar: owns 3+ lore books or social rep 80+
    const loreBooks = agent.inventory.filter(i =>
      i.name.toLowerCase().includes('lore') || i.name.toLowerCase().includes('book') || i.name.toLowerCase().includes('tome'),
    ).length
    if (loreBooks >= 3 || rep.social >= 80) return 'scholar'

    // Warrior: combat reputation 70+
    if (rep.combat >= 70) return 'warrior'

    // Merchant: trading reputation 70+
    if (rep.trading >= 70) return 'merchant'

    // Artisan: crafting reputation 80+
    if (rep.crafting >= 80) return 'artisan'

    // Commoner: survived 100+ ticks
    if (tick >= 100) return 'commoner'

    return 'newcomer'
  }

  /** Tick: periodically recalculate statuses */
  tick(clock: WorldClock, agents: Agent[]): void {
    if (clock.tick - this.lastStatusCheck < STATUS_CHECK_INTERVAL) return
    this.lastStatusCheck = clock.tick

    for (const agent of agents) {
      const newStatus = this.calculateStatus(agent.id, agent, clock.tick)
      const oldStatus = this.statuses.get(agent.id) ?? 'newcomer'

      if (newStatus !== oldStatus) {
        this.statuses.set(agent.id, newStatus)
        this.eventBus.emit({
          type: 'social_status:changed',
          agentId: agent.id,
          oldStatus,
          newStatus,
          timestamp: clock.tick,
        })
      }
    }
  }

  /** Format reputation and status for LLM context */
  formatForLLM(agentId: string): string {
    const rep = this.getReputation(agentId)
    const status = this.getStatus(agentId)

    const categories: string[] = []
    if (rep.combat !== 0) categories.push(`Combat: ${rep.combat}`)
    if (rep.trading !== 0) categories.push(`Trading: ${rep.trading}`)
    if (rep.social !== 0) categories.push(`Social: ${rep.social}`)
    if (rep.crafting !== 0) categories.push(`Crafting: ${rep.crafting}`)
    if (rep.leadership !== 0) categories.push(`Leadership: ${rep.leadership}`)
    if (rep.infamy > 0) categories.push(`Infamy: ${rep.infamy}`)

    if (categories.length === 0 && status === 'newcomer') return ''

    let line = `[Your reputation] Status: ${status}`
    if (categories.length > 0) {
      line += ` | ${categories.join(', ')}`
    }
    return line
  }

  /** Format another agent's reputation for LLM context (what this agent perceives) */
  formatOtherForLLM(
    targetId: string,
    getAgentName: (id: string) => string,
  ): string {
    const rep = this.getReputation(targetId)
    const status = this.getStatus(targetId)
    if (status === 'newcomer') return ''

    const name = getAgentName(targetId)
    const statusEffects = this.getStatusEffects(status)

    return `${name} is a ${status}${statusEffects ? ` (${statusEffects})` : ''}`
  }

  /** Get gameplay effects description for a status */
  private getStatusEffects(status: SocialStatus): string {
    switch (status) {
      case 'hero': return 'respected by all, happy to help'
      case 'legend': return 'famous, revered, sought for counsel'
      case 'noble': return 'influential, commands respect'
      case 'warrior': return 'feared in combat, respected'
      case 'merchant': return 'trusted trader, fair prices'
      case 'artisan': return 'skilled crafter, quality work'
      case 'scholar': return 'knowledgeable, shares wisdom'
      default: return ''
    }
  }

  /** Get all reputations (for API) */
  getAllReputations(): Map<string, AgentReputation> {
    return this.reputations
  }

  /** Get all statuses (for API) */
  getAllStatuses(): Map<string, SocialStatus> {
    return this.statuses
  }
}
