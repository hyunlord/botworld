import type { ActionPlan } from '@botworld/shared'
import type { NPCContext } from './npc-brain.js'
import { parsePlanResponse } from './npc-brain.js'
import type { LLMRouter } from '../llm/llm-router.js'

export const BATCH_BRAIN_VERSION = 1

export interface BatchEntry {
  npcId: string
  systemPrompt: string
  context: NPCContext
  /** Extra context from triggers */
  triggerContext?: string
  /** Whether this NPC needs premium model */
  premium: boolean
}

export interface BatchResult {
  npcId: string
  plan: ActionPlan | null
}

export class BatchBrain {
  /** Queue of NPCs waiting for batch processing */
  private queue: BatchEntry[] = []
  /** Timer for batch processing (debounce) */
  private batchTimer: ReturnType<typeof setTimeout> | null = null
  /** Callback to receive batch results */
  private resultCallback: ((results: BatchResult[]) => void) | null = null
  /** LLM Router reference */
  private llmRouter: LLMRouter | null = null
  /** Batch delay in ms (accumulate entries before firing) */
  private batchDelay = 500
  /** Max NPCs per batch */
  private maxBatchSize = 5

  /** Set the LLM router */
  setLLMRouter(router: LLMRouter): void {
    this.llmRouter = router
  }

  /** Set callback for receiving results */
  onResults(callback: (results: BatchResult[]) => void): void {
    this.resultCallback = callback
  }

  /** Add an NPC to the batch queue */
  enqueue(entry: BatchEntry): void {
    this.queue.push(entry)

    // If we've reached max batch size, process immediately
    if (this.queue.length >= this.maxBatchSize) {
      if (this.batchTimer !== null) {
        clearTimeout(this.batchTimer)
        this.batchTimer = null
      }
      void this.processBatch()
      return
    }

    // Otherwise, set debounce timer if not already set
    if (this.batchTimer === null) {
      this.batchTimer = setTimeout(() => {
        void this.processBatch()
      }, this.batchDelay)
    }
  }

  /** Force process any pending batch immediately */
  async flush(): Promise<void> {
    if (this.batchTimer !== null) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }
    if (this.queue.length > 0) {
      await this.processBatch()
    }
  }

  /** Get queue size */
  getQueueSize(): number {
    return this.queue.length
  }

  /** Process accumulated batch */
  private async processBatch(): Promise<void> {
    this.batchTimer = null

    // Take up to maxBatchSize entries from front of queue
    const entries = this.queue.splice(0, this.maxBatchSize)
    if (entries.length === 0) return

    // Guard: ensure llmRouter is available
    if (!this.llmRouter) {
      console.warn('[BatchBrain] No LLM router available, returning null for all entries')
      const results: BatchResult[] = entries.map(e => ({ npcId: e.npcId, plan: null }))
      this.resultCallback?.(results)
      return
    }

    // Group entries by location
    const groups = new Map<string, BatchEntry[]>()
    for (const entry of entries) {
      const groupKey = entry.context.poiName ??
        `pos_${Math.floor(entry.context.position.x / 16)}_${Math.floor(entry.context.position.y / 16)}`
      if (!groups.has(groupKey)) {
        groups.set(groupKey, [])
      }
      groups.get(groupKey)!.push(entry)
    }

    const results: BatchResult[] = []

    // Process each group
    for (const [groupKey, groupEntries] of groups) {
      if (groupEntries.length === 1) {
        // Single NPC: use individual call
        const result = await this.processIndividual(groupEntries[0])
        results.push(result)
      } else {
        // Multiple NPCs: batch call
        console.log(`[BatchBrain] Processing batch of ${groupEntries.length} NPCs at ${groupKey}`)
        const batchResults = await this.processBatchGroup(groupEntries, groupKey)
        results.push(...batchResults)
      }
    }

    // Send results to callback
    this.resultCallback?.(results)
  }

  /** Process a batch group of NPCs at the same location */
  private async processBatchGroup(entries: BatchEntry[], groupKey: string): Promise<BatchResult[]> {
    if (!this.llmRouter) {
      return entries.map(e => ({ npcId: e.npcId, plan: null }))
    }

    const batchPrompt = BatchBrain.buildBatchPrompt(entries)
    const systemPrompt = entries[0].systemPrompt // Use first entry's system prompt for batch

    try {
      const response = await this.llmRouter.complete({
        category: 'npc_action',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: batchPrompt }
        ],
        max_tokens: 1000 * entries.length, // Scale tokens by number of NPCs
        temperature: 0.8,
        response_format: 'json',
      })

      if (!response) {
        console.warn(`[BatchBrain] No response for batch at ${groupKey}`)
        throw new Error('No LLM response')
      }

      const parsed = BatchBrain.parseBatchResponse(response.content, entries)

      // If batch parsing succeeded, return results
      if (parsed !== null) {
        return parsed
      }

      // Batch parsing failed, fall back to individual calls
      console.warn(`[BatchBrain] Batch parsing failed for ${groupKey}, falling back to individual calls`)
    } catch (err) {
      console.error(`[BatchBrain] Batch LLM call failed for ${groupKey}:`, err)
    }

    // Fallback: process each NPC individually
    const fallbackResults: BatchResult[] = []
    for (const entry of entries) {
      const result = await this.processIndividual(entry)
      fallbackResults.push(result)
    }
    return fallbackResults
  }

  /** Process a single NPC (fallback or single-entry group) */
  private async processIndividual(entry: BatchEntry): Promise<BatchResult> {
    if (!this.llmRouter) {
      return { npcId: entry.npcId, plan: null }
    }

    const contextPrompt = BatchBrain.buildIndividualPrompt(entry)

    try {
      const response = await this.llmRouter.complete({
        category: 'npc_action',
        messages: [
          { role: 'system', content: entry.systemPrompt },
          { role: 'user', content: contextPrompt }
        ],
        max_tokens: 500,
        temperature: 0.8,
        response_format: 'json',
      })

      if (!response) {
        return { npcId: entry.npcId, plan: null }
      }

      const plan = parsePlanResponse(response.content)
      return { npcId: entry.npcId, plan }
    } catch (err) {
      console.error(`[BatchBrain] Individual LLM call failed for ${entry.npcId}:`, err)
      return { npcId: entry.npcId, plan: null }
    }
  }

  /** Build batch prompt for multiple NPCs at same location */
  private static buildBatchPrompt(entries: BatchEntry[]): string {
    // Extract common context from first entry
    const ctx = entries[0].context
    const situation = `[Situation] Day ${ctx.day}, ${ctx.timeOfDay} | Weather: ${ctx.weather} | Season: ${ctx.season}`
    const location = `[Location] ${ctx.poiName || `(${ctx.position.x}, ${ctx.position.y})`}`

    let prompt = `${situation}\n${location}\n\n`
    prompt += `Decide the next action for each NPC below. They are aware of each other.\n\n`

    // Add each NPC's context
    entries.forEach((entry, idx) => {
      const c = entry.context
      prompt += `NPC ${idx + 1}: ${c.npcName} (${c.npcRole})\n`
      prompt += `  Status: HP ${c.hp}/${c.maxHp}, Energy ${c.energy}/${c.maxEnergy}, Hunger ${c.hunger}/${c.maxHunger}\n`

      if (c.emotionState) {
        prompt += `  Personality: ${c.emotionState}\n`
      }

      if (entry.triggerContext) {
        prompt += `  ${entry.triggerContext}\n`
      }

      if (c.recentChat && c.recentChat.length > 0) {
        const chatSummary = c.recentChat.slice(-2).join('; ')
        prompt += `  Recent chat: ${chatSummary}\n`
      }

      prompt += '\n'
    })

    prompt += `Respond with a JSON array. Each element must have "agent_id" and "plan":\n`
    prompt += `[\n`
    entries.forEach((entry, idx) => {
      const comma = idx < entries.length - 1 ? ',' : ''
      prompt += `  { "agent_id": "${entry.npcId}", "plan": { "plan_name": "...", "steps": [{"action": "...", "params": {...}}] } }${comma}\n`
    })
    prompt += `]`

    return prompt
  }

  /** Parse batch LLM response */
  private static parseBatchResponse(raw: string, entries: BatchEntry[]): BatchResult[] | null {
    // Strip markdown fences
    let cleaned = raw.trim()
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7)
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3)
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3)
    }
    cleaned = cleaned.trim()

    try {
      const parsed = JSON.parse(cleaned)

      if (!Array.isArray(parsed)) {
        console.warn('[BatchBrain] Batch response is not an array')
        return null
      }

      const results: BatchResult[] = []
      const npcMap = new Map(entries.map(e => [e.npcId, e]))

      for (const item of parsed) {
        if (!item.agent_id || !item.plan) {
          console.warn('[BatchBrain] Batch item missing agent_id or plan:', item)
          continue
        }

        if (!npcMap.has(item.agent_id)) {
          console.warn('[BatchBrain] Unknown agent_id in batch response:', item.agent_id)
          continue
        }

        // Parse the plan for this NPC
        const planJson = JSON.stringify(item.plan)
        const plan = parsePlanResponse(planJson)

        results.push({
          npcId: item.agent_id,
          plan
        })
      }

      // Ensure we got results for all NPCs (fill missing with null)
      for (const entry of entries) {
        if (!results.find(r => r.npcId === entry.npcId)) {
          console.warn(`[BatchBrain] No result for ${entry.npcId}, returning null`)
          results.push({ npcId: entry.npcId, plan: null })
        }
      }

      return results
    } catch (err) {
      console.error('[BatchBrain] Failed to parse batch response:', err)
      return null
    }
  }

  /** Build individual prompt for a single NPC */
  private static buildIndividualPrompt(entry: BatchEntry): string {
    const c = entry.context
    let prompt = `[Current Situation]\n`
    prompt += `Time: Day ${c.day}, ${c.timeOfDay} | Weather: ${c.weather}\n`
    prompt += `Location: ${c.poiName || `(${c.position.x}, ${c.position.y})`}\n`
    prompt += `HP: ${c.hp}/${c.maxHp} | Energy: ${c.energy}/${c.maxEnergy} | Hunger: ${c.hunger}/${c.maxHunger}\n`

    if (entry.triggerContext) {
      prompt += `${entry.triggerContext}\n`
    }

    if (c.nearbyAgents && c.nearbyAgents.length > 0) {
      const nearby = c.nearbyAgents.slice(0, 3).join(', ')
      prompt += `Nearby: ${nearby}\n`
    }

    if (c.recentChat && c.recentChat.length > 0) {
      const chatSummary = c.recentChat.slice(-2).join('; ')
      prompt += `Recent chat: ${chatSummary}\n`
    }

    if (c.emotionState) {
      prompt += `Mood: ${c.emotionState}\n`
    }

    if (c.routineHint) {
      prompt += `${c.routineHint}\n`
    }

    prompt += `\nDecide your next action. Respond with JSON: { "plan_name": "...", "steps": [...] }`

    return prompt
  }
}
