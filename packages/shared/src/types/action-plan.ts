/**
 * Action Plan — multi-step behavior plans for agents and NPCs.
 *
 * Instead of single actions, the LLM returns a plan of 5-10 steps
 * that the server auto-executes tick by tick over ~1 minute.
 */

import type { ActionType } from './agent.js'

/**
 * Extended action types available in plans.
 * Includes base ActionType plus plan-specific actions.
 */
export type PlanActionType = ActionType | 'emote' | 'patrol' | 'follow' | 'wait_for' | 'write' | 'steal'

/**
 * A multi-step action plan for an agent or NPC.
 * LLM generates these plans which the server auto-executes.
 */
export interface ActionPlan {
  /** Human-readable name for this plan (e.g., "morning_routine", "gather_wood") */
  plan_name: string

  /** Ordered list of steps to execute */
  steps: ActionStep[]

  /** Optional interrupt handlers for external events */
  interrupt_conditions?: InterruptMap

  /** Fallback step if plan fails or is interrupted */
  fallback?: ActionStep

  /** Maximum duration in ticks (default 60 = ~1 minute at 1 tick/sec) */
  max_duration?: number
}

/**
 * A single step in an action plan.
 * Can include flow control, conditions, and timing parameters.
 */
export interface ActionStep {
  /** Optional label for goto targets */
  id?: string

  /** The action to perform */
  action: PlanActionType

  /** Action-specific parameters (e.g., { item: 'wood', quantity: 5 }) */
  params: Record<string, unknown>

  // Flow control
  /** Unconditional next step ('next' or goto label) */
  then?: 'next' | { goto: string }

  /** Next step on success */
  on_success?: 'next' | 'done' | { goto: string }

  /** Next step on failure */
  on_fail?: 'skip' | 'retry' | 'done' | { goto: string }

  /** Next step when arriving at destination (for move actions) */
  on_arrive?: 'next'

  // Conditional execution
  /** Optional condition to check before executing this step */
  condition?: StepCondition

  // Timing
  /** Number of ticks to wait after completing this step */
  wait_after?: number

  /** Maximum ticks to spend on this step before timing out */
  timeout?: number

  // Target
  /** Target identifier (agent name, 'nearest_agent', 'nearest_merchant', 'nearby_agents') */
  target?: string
}

/**
 * Condition to check before executing a step.
 */
export interface StepCondition {
  /** Type of condition to check */
  type:
    | 'has_item'
    | 'hp_above'
    | 'hp_below'
    | 'energy_above'
    | 'energy_below'
    | 'near_poi'
    | 'near_agent'
    | 'time_is'
    | 'weather_is'

  /** Condition-specific parameters (e.g., { item: 'wood', min: 5 }) */
  params: Record<string, unknown>
}

/**
 * Interrupt handlers for external events during plan execution.
 */
export interface InterruptMap {
  /** Response when attacked */
  on_attacked?: InterruptHandler

  /** Response when another agent speaks to this agent */
  on_spoken_to?: 'pause_and_respond' | 'ignore'

  /** Response to nearby events */
  on_event_nearby?: 'evaluate' | 'ignore'

  /** Response when HP drops below 30% */
  on_low_hp?: InterruptHandler

  /** Response when energy drops below 15% */
  on_low_energy?: InterruptHandler

  /** Response when hunger drops below 20% */
  on_hungry?: InterruptHandler
}

/**
 * Handler for an interrupt event.
 * Can be a predefined behavior or a custom action step.
 */
export type InterruptHandler = 'flee_to_safety' | 'fight_back' | ActionStep

/**
 * Runtime state for an active plan.
 * Tracks execution progress and manages interruptions.
 */
export interface PlanState {
  /** The active plan being executed */
  plan: ActionPlan

  /** Current step index in the plan */
  stepIndex: number

  /** Whether the current step is actively executing */
  currentStepActive: boolean

  /** Tick when the plan started */
  startedAtTick: number

  /** Tick when waiting should end (for wait_after) */
  waitUntilTick: number

  /** Number of retries for the current step */
  retryCount: number

  /** Whether the plan is paused (e.g., due to interruption) */
  paused: boolean

  /** Step index to resume after pause */
  pausedStepIndex: number

  /** Whether the plan was interrupted */
  interrupted: boolean
}
