import type pg from 'pg'
import type { AgentManager } from '../agent/agent-manager.js'
import type { EventBus } from '../core/event-bus.js'
import { contentFilter } from '../security/content-filter.js'
import { processInteraction } from './social/relationship.js'

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const SAY_RADIUS = 10
const WHISPER_RADIUS = 2

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface ChatResult {
  allowed: boolean
  reason?: string
  recipientCount?: number
}

export interface ChatMessageRecord {
  id: string
  agent_id: string
  location: { x: number; y: number } | null
  content: string
  message_type: string
  target_agent_id: string | null
  blocked: boolean
  created_at: string
}

export interface GetRecentChatOptions {
  limit?: number
  messageType?: string
  since?: string
}

// ──────────────────────────────────────────────
// ChatRelay
// ──────────────────────────────────────────────

export class ChatRelay {
  constructor(
    private agentManager: AgentManager,
    private eventBus: EventBus,
    private pool: pg.Pool,
    private clockGetter: () => { tick: number },
  ) {}

  // ── handleSpeak ──────────────────────────────

  async handleSpeak(
    agentId: string,
    message: string,
    targetAgentId?: string,
  ): Promise<ChatResult> {
    // 1. ContentFilter
    const filterResult = await contentFilter.filterMessage(agentId, message)

    if (!filterResult.allowed) {
      await this.saveToLog(agentId, message, 'say', targetAgentId, true)
      return { allowed: false, reason: filterResult.reason }
    }

    // 2. Save to DB
    await this.saveToLog(agentId, message, 'say', targetAgentId, false)

    // 3. Add to agent memory
    const memory = this.agentManager.getMemoryStream(agentId)
    if (memory) {
      memory.add(
        `Said: "${message}"${targetAgentId ? ' to another agent' : ''}`,
        3,
        this.clockGetter().tick,
        targetAgentId ? [targetAgentId] : [],
      )
    }

    // 4. Broadcast to nearby agents
    const recipientCount = this.broadcastToNearby(agentId, message, 'say', SAY_RADIUS)

    // 5. Social interaction for targeted speech
    if (targetAgentId) {
      const agent = this.agentManager.getAgent(agentId)
      const target = this.agentManager.getAgent(targetAgentId)
      if (agent && target) {
        processInteraction(
          agent,
          target,
          { type: 'conversation', positive: true, intensity: 0.3 },
          this.clockGetter().tick,
        )
      }
    }

    // 6. Emit agent:spoke for UI compatibility
    this.eventBus.emit({
      type: 'agent:spoke',
      agentId,
      targetAgentId,
      message,
      timestamp: this.clockGetter().tick,
    })

    return { allowed: true, recipientCount }
  }

  // ── handleWhisper ────────────────────────────

  async handleWhisper(
    agentId: string,
    targetAgentId: string,
    message: string,
  ): Promise<ChatResult> {
    // 1. Target exists + proximity check
    const agent = this.agentManager.getAgent(agentId)
    const target = this.agentManager.getAgent(targetAgentId)

    if (!agent) return { allowed: false, reason: 'Agent not found' }
    if (!target) return { allowed: false, reason: 'Target agent not found' }

    const dist =
      Math.abs(agent.position.x - target.position.x) +
      Math.abs(agent.position.y - target.position.y)
    if (dist > WHISPER_RADIUS) {
      return { allowed: false, reason: `Target too far for whisper (distance: ${dist}, max: ${WHISPER_RADIUS})` }
    }

    // 2. ContentFilter
    const filterResult = await contentFilter.filterMessage(agentId, message)

    if (!filterResult.allowed) {
      await this.saveToLog(agentId, message, 'whisper', targetAgentId, true)
      return { allowed: false, reason: filterResult.reason }
    }

    // 3. Save to DB
    await this.saveToLog(agentId, message, 'whisper', targetAgentId, false)

    // 4. Emit chat:delivered for WsManager to handle WebSocket delivery
    const tick = this.clockGetter().tick

    this.eventBus.emit({
      type: 'chat:delivered',
      fromAgentId: agentId,
      fromAgentName: agent.name,
      message,
      messageType: 'whisper',
      recipientIds: [targetAgentId],
      position: { x: agent.position.x, y: agent.position.y },
      timestamp: tick,
    })

    // 5. Add memories for both agents
    const senderMemory = this.agentManager.getMemoryStream(agentId)
    if (senderMemory) {
      senderMemory.add(
        `Whispered to ${target.name}: "${message}"`,
        4, tick, [targetAgentId],
      )
    }
    const targetMemory = this.agentManager.getMemoryStream(targetAgentId)
    if (targetMemory) {
      targetMemory.add(
        `${agent.name} whispered: "${message}"`,
        4, tick, [agentId],
      )
    }

    // 6. Social interaction
    processInteraction(
      agent, target,
      { type: 'conversation', positive: true, intensity: 0.5 },
      tick,
    )

    // 7. Emit for UI compatibility
    this.eventBus.emit({
      type: 'agent:spoke',
      agentId,
      targetAgentId,
      message: `[whisper] ${message}`,
      timestamp: tick,
    })

    return { allowed: true, recipientCount: 1 }
  }

  // ── broadcastToNearby ────────────────────────

  broadcastToNearby(
    agentId: string,
    message: string,
    messageType: 'say' | 'whisper' | 'shout',
    radius: number,
  ): number {
    const agent = this.agentManager.getAgent(agentId)
    if (!agent) return 0

    const nearby = this.agentManager.getNearbyAgents(agentId, radius)
    const tick = this.clockGetter().tick

    // Emit chat:delivered event (WsManager handles WebSocket delivery)
    const recipientIds = nearby.map(a => a.id)
    this.eventBus.emit({
      type: 'chat:delivered',
      fromAgentId: agentId,
      fromAgentName: agent.name,
      message,
      messageType,
      recipientIds,
      position: { x: agent.position.x, y: agent.position.y },
      timestamp: tick,
    })

    return nearby.length
  }

  // ── saveToLog ────────────────────────────────

  async saveToLog(
    agentId: string,
    content: string,
    messageType: string,
    targetAgentId?: string,
    blocked = false,
  ): Promise<void> {
    const agent = this.agentManager.getAgent(agentId)
    const location = agent
      ? JSON.stringify({ x: agent.position.x, y: agent.position.y })
      : null

    try {
      await this.pool.query(
        `INSERT INTO chat_messages (agent_id, location, content, message_type, target_agent_id, blocked)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [agentId, location, content, messageType, targetAgentId ?? null, blocked],
      )
    } catch (err) {
      console.error('[ChatRelay] Failed to save chat message:', (err as Error).message)
    }
  }

  // ── getRecentChat ────────────────────────────

  async getRecentChat(options: GetRecentChatOptions = {}): Promise<ChatMessageRecord[]> {
    const limit = Math.min(options.limit ?? 50, 100)
    const conditions: string[] = ['blocked = false']
    const params: unknown[] = []
    let paramIndex = 1

    if (options.messageType) {
      conditions.push(`message_type = $${paramIndex}`)
      params.push(options.messageType)
      paramIndex++
    }

    if (options.since) {
      conditions.push(`created_at > $${paramIndex}`)
      params.push(options.since)
      paramIndex++
    }

    params.push(limit)

    const query = `
      SELECT id, agent_id, location, content, message_type, target_agent_id, blocked, created_at
      FROM chat_messages
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${paramIndex}
    `

    try {
      const result = await this.pool.query<ChatMessageRecord>(query, params)
      return result.rows
    } catch (err) {
      console.error('[ChatRelay] Failed to query chat messages:', (err as Error).message)
      return []
    }
  }
}
