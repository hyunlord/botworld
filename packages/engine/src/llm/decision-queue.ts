import type { AgentLLMConfig, LLMResponse, ChatMessage } from '@botworld/shared'
import { providerRegistry } from './provider-registry.js'

interface QueuedDecision {
  id: string
  agentId: string
  llmConfig: AgentLLMConfig
  messages: ChatMessage[]
  priority: number
  resolve: (response: LLMResponse) => void
  reject: (error: Error) => void
}

/**
 * Async decision queue that processes LLM calls without blocking the game loop.
 * Decisions are prioritized and processed in order.
 */
export class DecisionQueue {
  private queue: QueuedDecision[] = []
  private processing = false
  private concurrency: number

  constructor(concurrency = 3) {
    this.concurrency = concurrency
  }

  /**
   * Queue an LLM decision. Returns a promise that resolves when the LLM responds.
   */
  enqueue(
    agentId: string,
    llmConfig: AgentLLMConfig,
    messages: ChatMessage[],
    priority: number = 5,
  ): Promise<LLMResponse> {
    return new Promise((resolve, reject) => {
      const decision: QueuedDecision = {
        id: `${agentId}_${Date.now()}`,
        agentId,
        llmConfig,
        messages,
        priority,
        resolve,
        reject,
      }

      // Insert in priority order (higher priority first)
      const idx = this.queue.findIndex(d => d.priority < priority)
      if (idx === -1) {
        this.queue.push(decision)
      } else {
        this.queue.splice(idx, 0, decision)
      }

      this.processNext()
    })
  }

  get pendingCount(): number {
    return this.queue.length
  }

  private async processNext(): Promise<void> {
    if (this.processing || this.queue.length === 0) return
    this.processing = true

    // Process up to `concurrency` decisions in parallel
    const batch = this.queue.splice(0, this.concurrency)

    await Promise.allSettled(
      batch.map(async (decision) => {
        try {
          const provider = providerRegistry.getOrThrow(decision.llmConfig.provider)
          const response = await provider.generateChat(decision.messages, {
            model: decision.llmConfig.model,
          })
          decision.resolve(response)
        } catch (error) {
          decision.reject(error instanceof Error ? error : new Error(String(error)))
        }
      }),
    )

    this.processing = false
    if (this.queue.length > 0) {
      this.processNext()
    }
  }
}
