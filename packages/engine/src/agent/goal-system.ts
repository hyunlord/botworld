import type { ActionType, Position } from '@botworld/shared'

export interface AgentGoal {
  id: string
  description: string
  actionType: ActionType
  priority: number // 1 = highest
  targetPosition?: Position
  targetAgentId?: string
  completed: boolean
  createdAt: number
}

export class GoalSystem {
  private goals: AgentGoal[] = []
  private nextId = 0

  /** Replace all goals with a new plan */
  setPlan(goals: AgentGoal[]): void {
    this.goals = goals
  }

  /** Add a single goal */
  addGoal(goal: Omit<AgentGoal, 'id' | 'completed'>): AgentGoal {
    const g: AgentGoal = { ...goal, id: `goal_${this.nextId++}`, completed: false }
    this.goals.push(g)
    this.goals.sort((a, b) => a.priority - b.priority)
    return g
  }

  /** Get the highest-priority incomplete goal */
  getCurrentGoal(): AgentGoal | undefined {
    return this.goals.find(g => !g.completed)
  }

  /** Mark a goal as completed */
  completeGoal(goalId: string): void {
    const goal = this.goals.find(g => g.id === goalId)
    if (goal) goal.completed = true
  }

  /** Complete the current goal */
  completeCurrentGoal(): void {
    const current = this.getCurrentGoal()
    if (current) current.completed = true
  }

  /** Get all goals */
  getAll(): AgentGoal[] {
    return [...this.goals]
  }

  /** Get incomplete goals */
  getPending(): AgentGoal[] {
    return this.goals.filter(g => !g.completed)
  }

  /** Clear all goals */
  clear(): void {
    this.goals = []
  }

  /** Check if there are any remaining goals */
  hasGoals(): boolean {
    return this.goals.some(g => !g.completed)
  }
}
