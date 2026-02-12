import type { Agent, AgentAction, Position, WorldClock, NpcRole } from '@botworld/shared'
import type {
  ActionPlan,
  ActionStep,
  PlanState,
  StepCondition,
  InterruptHandler,
  PlanActionType,
} from '@botworld/shared'
import type { EventBus } from '../core/event-bus.js'
import type { TileMap, PointOfInterest } from '../world/tile-map.js'
import { findPath } from '../world/pathfinding.js'

const DEFAULT_MAX_DURATION = 60  // ticks
const MAX_RETRIES = 3
const RANDOM_NEARBY_RANGE = 10
const LOW_HP_THRESHOLD = 0.3
const LOW_ENERGY_THRESHOLD = 0.15
const LOW_HUNGER_THRESHOLD = 0.2

export class PlanExecutor {
  private activePlans = new Map<string, PlanState>()

  constructor(
    private eventBus: EventBus,
    private tileMap: TileMap,
    private getAgent: (id: string) => Agent | undefined,
    private getAllAgents: () => Agent[],
    private enqueueAction: (agentId: string, action: AgentAction) => { success: boolean; error?: string },
    private clockGetter: () => WorldClock,
  ) {}

  /** Set a new plan for an agent, replacing any existing plan */
  setPlan(agentId: string, plan: ActionPlan): void {
    const clock = this.clockGetter()
    this.activePlans.set(agentId, {
      plan,
      stepIndex: 0,
      currentStepActive: false,
      startedAtTick: clock.tick,
      waitUntilTick: 0,
      retryCount: 0,
      paused: false,
      pausedStepIndex: 0,
      interrupted: false,
    })
    console.log(`[PlanExecutor] ${agentId} started plan: "${plan.plan_name}" (${plan.steps.length} steps)`)
  }

  /** Check if agent has an active plan */
  hasPlan(agentId: string): boolean {
    return this.activePlans.has(agentId)
  }

  /** Get current plan state for an agent */
  getPlanState(agentId: string): PlanState | undefined {
    return this.activePlans.get(agentId)
  }

  /** Cancel an agent's current plan */
  cancelPlan(agentId: string): void {
    this.activePlans.delete(agentId)
  }

  /** Pause plan for conversation interrupt */
  pausePlan(agentId: string): void {
    const state = this.activePlans.get(agentId)
    if (state && !state.paused) {
      state.paused = true
      state.pausedStepIndex = state.stepIndex
    }
  }

  /** Resume plan after conversation interrupt */
  resumePlan(agentId: string): void {
    const state = this.activePlans.get(agentId)
    if (state?.paused) {
      state.paused = false
    }
  }

  /** Called every tick from WorldEngine */
  tick(clock: WorldClock): void {
    for (const [agentId, state] of Array.from(this.activePlans)) {
      const agent = this.getAgent(agentId)
      if (!agent) {
        this.activePlans.delete(agentId)
        continue
      }

      // Check max duration
      const maxDuration = state.plan.max_duration ?? DEFAULT_MAX_DURATION
      if (clock.tick - state.startedAtTick >= maxDuration) {
        this.completePlan(agentId, state)
        continue
      }

      // Skip if paused (conversation interrupt)
      if (state.paused) continue

      // 1. Check interrupt conditions
      const interrupt = this.checkInterrupts(agent, state)
      if (interrupt) {
        this.handleInterrupt(agentId, agent, state, interrupt)
        continue
      }

      // 2. If waiting, check if wait is over
      if (state.waitUntilTick > 0 && clock.tick < state.waitUntilTick) continue
      if (state.waitUntilTick > 0 && clock.tick >= state.waitUntilTick) {
        state.waitUntilTick = 0
        state.currentStepActive = false
        state.stepIndex++
        state.retryCount = 0
      }

      // 3. If current step is in progress, check if agent finished it
      if (state.currentStepActive) {
        if (!agent.currentAction) {
          // Action completed — advance
          this.onStepComplete(agentId, state, 'success', clock)
        }
        // else: still executing, wait
        continue
      }

      // 4. Execute next step
      if (state.stepIndex < state.plan.steps.length) {
        this.executeStep(agentId, agent, state, clock)
      } else {
        // All steps done
        this.completePlan(agentId, state)
      }
    }
  }

  // ── Step Execution ──

  private executeStep(agentId: string, agent: Agent, state: PlanState, clock: WorldClock): void {
    const step = state.plan.steps[state.stepIndex]

    // Check condition (skip step if condition fails)
    if (step.condition && !this.evaluateCondition(agent, step.condition, clock)) {
      console.log(`[PlanExecutor] ${agentId} step ${state.stepIndex} condition failed, skipping`)
      state.stepIndex++
      state.retryCount = 0
      return
    }

    // Resolve target for actions that need it
    const targetAgentId = step.target ? this.resolveTarget(agentId, step.target) : undefined

    // Execute action based on type
    const action = step.action
    let success = false
    let instant = false

    switch (action) {
      case 'move': {
        const dest = this.resolveDestination(step.params.destination, agent.position)
        if (!dest) {
          this.onStepComplete(agentId, state, 'fail', clock)
          return
        }
        const result = this.enqueueAction(agentId, {
          type: 'move',
          targetPosition: dest,
          startedAt: clock.tick,
          duration: 1,
        })
        success = result.success
        break
      }

      case 'speak': {
        const msg = (step.params.message ?? step.params.text ?? '') as string
        this.eventBus.emit({
          type: 'agent:spoke',
          agentId,
          message: msg,
          timestamp: clock.tick,
          targetAgentId: targetAgentId ?? undefined,
        })
        instant = true
        success = true
        break
      }

      case 'emote': {
        const emote = step.params.emote as string ?? '*gestures*'
        this.eventBus.emit({
          type: 'agent:spoke',
          agentId,
          message: emote,
          timestamp: clock.tick,
        })
        instant = true
        success = true
        break
      }

      case 'idle': {
        if (step.params.emote) {
          this.eventBus.emit({
            type: 'agent:spoke',
            agentId,
            message: step.params.emote as string,
            timestamp: clock.tick,
          })
        }
        instant = true
        success = true
        break
      }

      case 'gather': {
        const result = this.enqueueAction(agentId, {
          type: 'gather',
          targetPosition: agent.position,
          startedAt: clock.tick,
          duration: 3,
        })
        success = result.success
        break
      }

      case 'craft': {
        const result = this.enqueueAction(agentId, {
          type: 'craft',
          data: { itemType: step.params.item ?? 'tool' },
          startedAt: clock.tick,
          duration: 5,
        })
        success = result.success
        break
      }

      case 'rest': {
        const result = this.enqueueAction(agentId, {
          type: 'rest',
          startedAt: clock.tick,
          duration: step.params.duration as number ?? 10,
        })
        success = result.success
        break
      }

      case 'eat': {
        const result = this.enqueueAction(agentId, {
          type: 'eat',
          targetItemId: step.params.itemId as string,
          startedAt: clock.tick,
          duration: 2,
        })
        success = result.success
        break
      }

      case 'attack': {
        if (!targetAgentId) {
          this.onStepComplete(agentId, state, 'fail', clock)
          return
        }
        const result = this.enqueueAction(agentId, {
          type: 'attack',
          targetAgentId,
          startedAt: clock.tick,
          duration: 1,
        })
        success = result.success
        break
      }

      case 'flee': {
        const dest = this.resolveDestination(step.params.destination ?? 'random_nearby', agent.position)
        if (!dest) {
          this.onStepComplete(agentId, state, 'fail', clock)
          return
        }
        const result = this.enqueueAction(agentId, {
          type: 'flee',
          targetPosition: dest,
          startedAt: clock.tick,
          duration: 1,
        })
        success = result.success
        break
      }

      case 'explore': {
        const result = this.enqueueAction(agentId, {
          type: 'explore',
          startedAt: clock.tick,
          duration: 5,
        })
        success = result.success
        break
      }

      case 'trade': {
        if (!targetAgentId) {
          this.onStepComplete(agentId, state, 'fail', clock)
          return
        }
        const result = this.enqueueAction(agentId, {
          type: 'trade',
          targetAgentId: targetAgentId,
          data: step.params,
          startedAt: clock.tick,
          duration: 3,
        })
        success = result.success
        break
      }

      case 'patrol': {
        const waypoints = step.params.waypoints as Position[] ?? []
        if (waypoints.length === 0) {
          this.onStepComplete(agentId, state, 'fail', clock)
          return
        }
        // Move to first waypoint (simplified patrol for now)
        const result = this.enqueueAction(agentId, {
          type: 'move',
          targetPosition: waypoints[0],
          startedAt: clock.tick,
          duration: 1,
        })
        success = result.success
        break
      }

      case 'follow': {
        if (!targetAgentId) {
          this.onStepComplete(agentId, state, 'fail', clock)
          return
        }
        const target = this.getAgent(targetAgentId)
        if (!target) {
          this.onStepComplete(agentId, state, 'fail', clock)
          return
        }
        const result = this.enqueueAction(agentId, {
          type: 'move',
          targetPosition: target.position,
          startedAt: clock.tick,
          duration: 1,
        })
        success = result.success
        break
      }

      case 'wait_for': {
        // Will be checked each tick via condition evaluation
        state.currentStepActive = true
        return
      }

      case 'talk':
      case 'quest': {
        // These are handled by the AgentManager directly
        const result = this.enqueueAction(agentId, {
          type: action,
          targetAgentId: targetAgentId ?? undefined,
          startedAt: clock.tick,
          duration: 3,
        })
        success = result.success
        break
      }

      default:
        console.warn(`[PlanExecutor] Unknown action type: ${action}`)
        this.onStepComplete(agentId, state, 'fail', clock)
        return
    }

    if (instant) {
      // Instant actions complete immediately
      if (step.wait_after) {
        state.waitUntilTick = clock.tick + step.wait_after
        state.currentStepActive = true
      } else {
        this.onStepComplete(agentId, state, success ? 'success' : 'fail', clock)
      }
    } else if (success) {
      state.currentStepActive = true
    } else {
      this.onStepComplete(agentId, state, 'fail', clock)
    }
  }

  private onStepComplete(
    agentId: string,
    state: PlanState,
    result: 'success' | 'fail',
    clock: WorldClock,
  ): void {
    const step = state.plan.steps[state.stepIndex]

    if (result === 'success') {
      // Handle success navigation
      const nav = step.on_success ?? step.then ?? step.on_arrive ?? 'next'
      if (nav === 'next') {
        state.stepIndex++
        state.retryCount = 0
      } else if (nav === 'done') {
        this.completePlan(agentId, state)
        return
      } else if (typeof nav === 'object' && 'goto' in nav) {
        const idx = this.findStepById(state.plan, nav.goto)
        if (idx >= 0) {
          state.stepIndex = idx
          state.retryCount = 0
        } else {
          console.warn(`[PlanExecutor] goto target not found: ${nav.goto}`)
          state.stepIndex++
        }
      }

      // Handle wait_after
      if (step.wait_after) {
        state.waitUntilTick = clock.tick + step.wait_after
        state.currentStepActive = true
      } else {
        state.currentStepActive = false
      }
    } else {
      // Handle failure navigation
      const nav = step.on_fail ?? 'skip'
      if (nav === 'skip') {
        state.stepIndex++
        state.retryCount = 0
        state.currentStepActive = false
      } else if (nav === 'retry') {
        if (state.retryCount < MAX_RETRIES) {
          state.retryCount++
          state.currentStepActive = false
        } else {
          console.warn(`[PlanExecutor] max retries reached for step ${state.stepIndex}`)
          state.stepIndex++
          state.retryCount = 0
          state.currentStepActive = false
        }
      } else if (nav === 'done') {
        this.completePlan(agentId, state)
      } else if (typeof nav === 'object' && 'goto' in nav) {
        const idx = this.findStepById(state.plan, nav.goto)
        if (idx >= 0) {
          state.stepIndex = idx
          state.retryCount = 0
          state.currentStepActive = false
        } else {
          console.warn(`[PlanExecutor] goto target not found: ${nav.goto}`)
          state.stepIndex++
          state.currentStepActive = false
        }
      }
    }
  }

  private completePlan(agentId: string, state: PlanState): void {
    console.log(`[PlanExecutor] ${agentId} completed plan: "${state.plan.plan_name}"`)

    // Execute fallback step if present
    if (state.plan.fallback) {
      const clock = this.clockGetter()
      const agent = this.getAgent(agentId)
      if (agent) {
        // Execute fallback as a simple one-shot action
        const fallback = state.plan.fallback
        if (fallback.action === 'speak' || fallback.action === 'emote') {
          this.eventBus.emit({
            type: 'agent:spoke',
            agentId,
            message: (fallback.params.message ?? fallback.params.text ?? fallback.params.emote ?? '') as string,
            timestamp: clock.tick,
          })
        }
      }
    }

    this.activePlans.delete(agentId)
  }

  // ── Interrupt Handling ──

  private checkInterrupts(agent: Agent, state: PlanState): string | null {
    const ic = state.plan.interrupt_conditions
    if (!ic) return null

    if (ic.on_low_hp && agent.stats.hp < agent.stats.maxHp * LOW_HP_THRESHOLD) {
      return 'on_low_hp'
    }

    if (ic.on_low_energy && agent.stats.energy < agent.stats.maxEnergy * LOW_ENERGY_THRESHOLD) {
      return 'on_low_energy'
    }

    if (ic.on_hungry && agent.stats.hunger < agent.stats.maxHunger * LOW_HUNGER_THRESHOLD) {
      return 'on_hungry'
    }

    return null
  }

  private handleInterrupt(
    agentId: string,
    agent: Agent,
    state: PlanState,
    interruptKey: string,
  ): void {
    const ic = state.plan.interrupt_conditions
    if (!ic) return

    const handler = ic[interruptKey as keyof typeof ic] as InterruptHandler | undefined
    if (!handler) return

    console.log(`[PlanExecutor] ${agentId} interrupted by ${interruptKey}`)

    if (handler === 'flee_to_safety') {
      // Find nearest POI and move there
      const nearestPOI = this.findNearestPOI(agent.position)
      if (nearestPOI) {
        const clock = this.clockGetter()
        this.enqueueAction(agentId, {
          type: 'flee',
          targetPosition: nearestPOI.position,
          startedAt: clock.tick,
          duration: 1,
        })
      }
    } else if (handler === 'fight_back') {
      // Handled externally by combat system
      console.log(`[PlanExecutor] ${agentId} fight_back interrupt (handled externally)`)
    } else if (typeof handler === 'object') {
      // Execute the custom ActionStep
      const step = handler as ActionStep
      const clock = this.clockGetter()
      if (step.action === 'speak' || step.action === 'emote') {
        this.eventBus.emit({
          type: 'agent:spoke',
          agentId,
          message: (step.params.message ?? step.params.text ?? step.params.emote ?? '') as string,
          timestamp: clock.tick,
        })
      }
    }

    // Cancel the plan after handling interrupt
    this.cancelPlan(agentId)
  }

  // ── Condition Evaluation ──

  private evaluateCondition(agent: Agent, condition: StepCondition, clock: WorldClock): boolean {
    switch (condition.type) {
      case 'has_item': {
        const itemType = condition.params.itemType as string
        return agent.inventory.some(item => item.type === itemType)
      }

      case 'hp_above':
        return agent.stats.hp > (condition.params.value as number ?? 0)

      case 'hp_below':
        return agent.stats.hp < (condition.params.value as number ?? agent.stats.maxHp)

      case 'energy_above':
        return agent.stats.energy > (condition.params.value as number ?? 0)

      case 'energy_below':
        return agent.stats.energy < (condition.params.value as number ?? agent.stats.maxEnergy)

      case 'near_poi': {
        const poiName = condition.params.name as string
        const radius = condition.params.radius as number ?? 5
        const poi = this.tileMap.pois.find(p =>
          p.name.toLowerCase().includes(poiName.toLowerCase())
        )
        if (!poi) return false
        return this.distance(agent.position, poi.position) <= radius
      }

      case 'near_agent': {
        const radius = condition.params.radius as number ?? 5
        const agents = this.getAllAgents()
        return agents.some(a =>
          a.id !== agent.id && this.distance(agent.position, a.position) <= radius
        )
      }

      case 'time_is': {
        const time = condition.params.time as string
        return clock.timeOfDay === time
      }

      case 'weather_is':
        // Not implemented yet, always true
        return true

      default:
        console.warn(`[PlanExecutor] Unknown condition type: ${condition.type}`)
        return true
    }
  }

  // ── Destination Resolution ──

  private resolveDestination(dest: unknown, agentPos: Position): Position | null {
    if (!dest) return null

    // Direct position object
    if (typeof dest === 'object' && 'x' in dest && 'y' in dest) {
      return dest as Position
    }

    // String destination
    if (typeof dest === 'string') {
      // Random nearby
      if (dest === 'random_nearby') {
        return this.randomNearbyPosition(agentPos)
      }

      // Home or named POI
      if (dest === 'home') {
        const nearestPOI = this.findNearestPOI(agentPos)
        return nearestPOI?.position ?? null
      }

      // Try to match POI name
      const poi = this.tileMap.pois.find(p =>
        p.name.toLowerCase().includes(dest.toLowerCase())
      )
      if (poi) return poi.position

      // Try to match POI type
      const poiByType = this.tileMap.pois.find(p =>
        p.type.toLowerCase() === dest.toLowerCase()
      )
      if (poiByType) return poiByType.position
    }

    return null
  }

  private randomNearbyPosition(center: Position): Position {
    const maxAttempts = 10
    for (let i = 0; i < maxAttempts; i++) {
      const dx = Math.floor(Math.random() * RANDOM_NEARBY_RANGE * 2) - RANDOM_NEARBY_RANGE
      const dy = Math.floor(Math.random() * RANDOM_NEARBY_RANGE * 2) - RANDOM_NEARBY_RANGE
      const pos = { x: center.x + dx, y: center.y + dy }
      const tile = this.tileMap.getTile(pos.x, pos.y)
      if (tile?.walkable) return pos
    }
    return center
  }

  private findNearestPOI(position: Position): PointOfInterest | null {
    let nearest: PointOfInterest | null = null
    let minDist = Infinity

    for (const poi of this.tileMap.pois) {
      const dist = this.distance(position, poi.position)
      if (dist < minDist) {
        minDist = dist
        nearest = poi
      }
    }

    return nearest
  }

  // ── Target Resolution ──

  private resolveTarget(agentId: string, target: string): string | null {
    // Nearest agent
    if (target === 'nearest_agent') {
      return this.findNearestAgent(agentId, () => true)
    }

    // Nearest merchant
    if (target === 'nearest_merchant') {
      return this.findNearestAgent(agentId, a => a.npcRole === 'merchant')
    }

    // Broadcast (no specific target)
    if (target === 'nearby_agents') {
      return null
    }

    // Try to match by name
    const agents = this.getAllAgents()
    const match = agents.find(a =>
      a.id !== agentId && a.name.toLowerCase().includes(target.toLowerCase())
    )
    return match?.id ?? null
  }

  private findNearestAgent(
    agentId: string,
    predicate: (agent: Agent) => boolean,
  ): string | null {
    const agent = this.getAgent(agentId)
    if (!agent) return null

    const agents = this.getAllAgents()
    let nearest: Agent | null = null
    let minDist = Infinity

    for (const a of agents) {
      if (a.id === agentId) continue
      if (!predicate(a)) continue
      const dist = this.distance(agent.position, a.position)
      if (dist < minDist) {
        minDist = dist
        nearest = a
      }
    }

    return nearest?.id ?? null
  }

  // ── Utilities ──

  private findStepById(plan: ActionPlan, id: string): number {
    return plan.steps.findIndex(step => step.id === id)
  }

  private distance(a: Position, b: Position): number {
    const dx = a.x - b.x
    const dy = a.y - b.y
    return Math.sqrt(dx * dx + dy * dy)
  }
}
