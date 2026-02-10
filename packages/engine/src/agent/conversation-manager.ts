import type { Agent, ChatMessage, WorldClock } from '@botworld/shared'
import { buildAgentSystemPrompt } from '../llm/prompt-builder.js'
import { DecisionQueue } from '../llm/decision-queue.js'
import { EventBus } from '../core/event-bus.js'
import type { MemoryStream } from './memory/memory-stream.js'

interface ActiveConversation {
  id: string
  agentA: string
  agentB: string
  turns: { speakerId: string; message: string }[]
  maxTurns: number
  startedAt: number
}

/**
 * Manages multi-turn conversations between agents using LLM.
 * Conversations happen asynchronously alongside the game loop.
 */
export class ConversationManager {
  private conversations = new Map<string, ActiveConversation>()
  private agentCooldowns = new Map<string, number>() // agentId → tick when they can talk again
  private conversationCounter = 0

  constructor(
    private decisionQueue: DecisionQueue,
    private eventBus: EventBus,
  ) {}

  /** Check if an agent is available for conversation */
  canConverse(agentId: string, currentTick: number): boolean {
    const cooldown = this.agentCooldowns.get(agentId) ?? 0
    if (currentTick < cooldown) return false
    // Check if already in a conversation
    for (const conv of this.conversations.values()) {
      if (conv.agentA === agentId || conv.agentB === agentId) return false
    }
    return true
  }

  /** Start a conversation between two agents */
  async startConversation(
    agentA: Agent,
    agentB: Agent,
    clock: WorldClock,
    memoryA: MemoryStream,
    memoryB: MemoryStream,
  ): Promise<void> {
    const convId = `conv_${this.conversationCounter++}`
    const maxTurns = 3 + Math.floor(Math.random() * 4) // 3-6 turns

    const conversation: ActiveConversation = {
      id: convId,
      agentA: agentA.id,
      agentB: agentB.id,
      turns: [],
      maxTurns,
      startedAt: clock.tick,
    }

    this.conversations.set(convId, conversation)

    try {
      await this.runConversation(conversation, agentA, agentB, clock, memoryA, memoryB)
    } catch (err) {
      console.warn(`[Conversation] Error in ${agentA.name} <-> ${agentB.name}:`, (err as Error).message)
    } finally {
      this.conversations.delete(convId)
      // Set cooldown: agents can't talk again for 30-60 ticks
      const cooldownDuration = 30 + Math.floor(Math.random() * 30)
      this.agentCooldowns.set(agentA.id, clock.tick + cooldownDuration)
      this.agentCooldowns.set(agentB.id, clock.tick + cooldownDuration)
    }
  }

  private async runConversation(
    conversation: ActiveConversation,
    agentA: Agent,
    agentB: Agent,
    clock: WorldClock,
    memoryA: MemoryStream,
    memoryB: MemoryStream,
  ): Promise<void> {
    // Agent A initiates
    let currentSpeaker = agentA
    let currentListener = agentB
    let currentSpeakerMemory = memoryA
    let currentListenerMemory = memoryB

    for (let turn = 0; turn < conversation.maxTurns; turn++) {
      const message = await this.generateTurn(
        currentSpeaker,
        currentListener,
        conversation,
        clock,
        currentSpeakerMemory,
      )

      if (!message || message.trim().length === 0) break

      conversation.turns.push({ speakerId: currentSpeaker.id, message })

      // Emit speech event
      this.eventBus.emit({
        type: 'agent:spoke',
        agentId: currentSpeaker.id,
        targetAgentId: currentListener.id,
        message,
        timestamp: clock.tick,
      })

      // Swap speaker/listener
      ;[currentSpeaker, currentListener] = [currentListener, currentSpeaker]
      ;[currentSpeakerMemory, currentListenerMemory] = [currentListenerMemory, currentSpeakerMemory]
    }

    // Store conversation summary in both agents' memories
    if (conversation.turns.length > 0) {
      const summary = this.summarizeConversation(conversation, agentA, agentB)
      memoryA.add(summary, 5, clock.tick, [agentB.id])
      memoryB.add(summary, 5, clock.tick, [agentA.id])
    }
  }

  private async generateTurn(
    speaker: Agent,
    listener: Agent,
    conversation: ActiveConversation,
    clock: WorldClock,
    speakerMemory: MemoryStream,
  ): Promise<string> {
    const systemPrompt = buildAgentSystemPrompt(speaker, clock)

    // Get relevant memories about the listener
    const relevantMemories = speakerMemory.retrieve(listener.name, 5, clock.tick)
    const memoryContext = relevantMemories.length > 0
      ? `\nYour memories about ${listener.name}:\n${relevantMemories.map(m => `- ${m.description}`).join('\n')}`
      : ''

    // Build conversation history
    const history = conversation.turns.map(t => {
      const name = t.speakerId === speaker.id ? speaker.name : listener.name
      return `${name}: "${t.message}"`
    }).join('\n')

    const historyContext = history ? `\nConversation so far:\n${history}` : ''

    const isInitiator = conversation.turns.length === 0
    const turnPrompt = isInitiator
      ? `You encounter ${listener.name}. Start a conversation with them. Respond with just your dialogue (1-2 sentences).`
      : `Continue the conversation with ${listener.name}. Respond with just your dialogue (1-2 sentences). You may end the conversation naturally if appropriate.`

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt + memoryContext + historyContext },
      { role: 'user', content: turnPrompt },
    ]

    const response = await this.decisionQueue.enqueue(
      speaker.id,
      speaker.llmConfig,
      messages,
      6, // Medium-high priority for conversations
    )

    // Clean up response - remove quotes, name prefix, etc.
    let content = response.content.trim()
    content = content.replace(/^["']|["']$/g, '')
    content = content.replace(new RegExp(`^${speaker.name}:\\s*`, 'i'), '')
    content = content.replace(/^["']|["']$/g, '')

    return content
  }

  private summarizeConversation(
    conversation: ActiveConversation,
    agentA: Agent,
    agentB: Agent,
  ): string {
    const turnCount = conversation.turns.length
    const topics = conversation.turns.map(t => t.message).join(' ').slice(0, 100)
    return `Had a ${turnCount}-turn conversation with ${agentA.name === conversation.agentA ? agentB.name : agentA.name}. Topics: ${topics}...`
  }

  /** Get count of active conversations */
  get activeCount(): number {
    return this.conversations.size
  }
}
