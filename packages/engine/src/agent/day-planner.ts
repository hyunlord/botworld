import type { Agent, WorldClock, ChatMessage, ActionType, Position } from '@botworld/shared'
import { buildAgentSystemPrompt } from '../llm/prompt-builder.js'
import { providerRegistry } from '../llm/provider-registry.js'
import { DecisionQueue } from '../llm/decision-queue.js'
import type { AgentGoal } from './goal-system.js'
import type { MemoryStream } from './memory/memory-stream.js'
import type { TileMap } from '../world/tile-map.js'

/**
 * Generates a day plan for an agent using LLM at the start of each day.
 * Falls back to a simple rule-based plan if LLM fails.
 */
export class DayPlanner {
  constructor(private decisionQueue: DecisionQueue) {}

  async createPlan(
    agent: Agent,
    clock: WorldClock,
    memory: MemoryStream,
    tileMap: TileMap,
    nearbyAgents: Agent[],
  ): Promise<AgentGoal[]> {
    try {
      return await this.llmPlan(agent, clock, memory, tileMap, nearbyAgents)
    } catch (err) {
      console.warn(`[DayPlanner] LLM plan failed for ${agent.name}, using fallback:`, (err as Error).message)
      return this.fallbackPlan(agent, clock, tileMap)
    }
  }

  private async llmPlan(
    agent: Agent,
    clock: WorldClock,
    memory: MemoryStream,
    tileMap: TileMap,
    nearbyAgents: Agent[],
  ): Promise<AgentGoal[]> {
    const systemPrompt = buildAgentSystemPrompt(agent, clock)
    const recentMemories = memory.getRecent(10)
    const memoryText = recentMemories.length > 0
      ? recentMemories.map(m => `- ${m.description}`).join('\n')
      : '- No recent memories'

    const nearbyText = nearbyAgents.length > 0
      ? nearbyAgents.map(a => `- ${a.name} (${a.currentAction?.type ?? 'idle'}) at (${a.position.x}, ${a.position.y})`).join('\n')
      : '- No one nearby'

    const inventoryText = agent.inventory.length > 0
      ? agent.inventory.map(i => `- ${i.name} x${i.quantity}`).join('\n')
      : '- Empty inventory'

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `It's a new ${clock.timeOfDay}. Plan your activities for today.

Your recent memories:
${memoryText}

Nearby agents:
${nearbyText}

Your inventory:
${inventoryText}

Available actions: gather (resources from nature), craft (items from materials), trade (with other agents), talk (have a conversation), explore (discover new areas), rest

Respond with a JSON array of 2-4 goals for today. Each goal has:
- "description": what you want to do and why (1 sentence)
- "actionType": one of "gather", "craft", "trade", "talk", "explore", "rest"
- "priority": 1 (most important) to 4 (least)
- "targetAgentName": (optional) name of agent to interact with

Example: [{"description": "Gather wood to build tools", "actionType": "gather", "priority": 1}, {"description": "Chat with Aria about the forest", "actionType": "talk", "priority": 2, "targetAgentName": "Aria"}]

Respond with ONLY the JSON array, no other text.`,
      },
    ]

    const response = await this.decisionQueue.enqueue(
      agent.id,
      agent.llmConfig,
      messages,
      8, // High priority for daily planning
    )

    return this.parseGoals(response.content, agent, clock, nearbyAgents)
  }

  private parseGoals(
    llmResponse: string,
    agent: Agent,
    clock: WorldClock,
    nearbyAgents: Agent[],
  ): AgentGoal[] {
    try {
      // Extract JSON array from response (handle markdown code blocks)
      const jsonMatch = llmResponse.match(/\[[\s\S]*\]/)
      if (!jsonMatch) throw new Error('No JSON array found in response')

      const parsed = JSON.parse(jsonMatch[0]) as Array<{
        description: string
        actionType: string
        priority: number
        targetAgentName?: string
      }>

      const validTypes: ActionType[] = ['gather', 'craft', 'trade', 'talk', 'explore', 'rest']

      return parsed
        .filter(g => validTypes.includes(g.actionType as ActionType))
        .slice(0, 4)
        .map((g, i) => {
          const targetAgent = g.targetAgentName
            ? nearbyAgents.find(a => a.name.toLowerCase() === g.targetAgentName!.toLowerCase())
            : undefined

          return {
            id: `goal_${Date.now()}_${i}`,
            description: g.description,
            actionType: g.actionType as ActionType,
            priority: g.priority ?? (i + 1),
            targetAgentId: targetAgent?.id,
            completed: false,
            createdAt: clock.tick,
          }
        })
    } catch {
      console.warn(`[DayPlanner] Failed to parse LLM goals for ${agent.name}, using fallback`)
      return this.fallbackPlan(agent, clock)
    }
  }

  private fallbackPlan(agent: Agent, clock: WorldClock, _tileMap?: TileMap): AgentGoal[] {
    const goals: AgentGoal[] = []
    const tick = clock.tick

    // Always explore a bit
    goals.push({
      id: `goal_${tick}_0`,
      description: 'Explore the surroundings',
      actionType: 'explore',
      priority: 3,
      completed: false,
      createdAt: tick,
    })

    // Gather if inventory is low
    if (agent.inventory.length < 3) {
      goals.push({
        id: `goal_${tick}_1`,
        description: 'Gather resources',
        actionType: 'gather',
        priority: 1,
        completed: false,
        createdAt: tick,
      })
    }

    // Social if extraversion is high
    if (agent.personality.extraversion > 0.5) {
      goals.push({
        id: `goal_${tick}_2`,
        description: 'Talk to someone nearby',
        actionType: 'talk',
        priority: 2,
        completed: false,
        createdAt: tick,
      })
    }

    return goals.sort((a, b) => a.priority - b.priority)
  }
}
