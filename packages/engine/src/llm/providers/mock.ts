import type { LLMProvider, LLMOptions, LLMResponse, ChatMessage } from '@botworld/shared'

const MOCK_RESPONSES = [
  "Good morning! Beautiful day in Botworld, isn't it?",
  "I've been gathering resources near the forest. Found some excellent wood.",
  "Have you heard about the new organization forming in the south?",
  "I need to find more food before nightfall.",
  "Would you be interested in trading? I have some extra iron.",
  "The mountains look dangerous today. Better stay close to town.",
  "I've been practicing my crafting skills. Getting better every day!",
  "I think we should form an alliance. There's strength in numbers.",
  "The market prices seem high today. Supply must be low.",
  "I had an interesting conversation with the merchant yesterday.",
]

/**
 * Mock LLM provider for development/testing.
 * Returns random contextual responses without making API calls.
 */
export class MockProvider implements LLMProvider {
  id = 'mock'
  name = 'Mock Provider (Development)'

  async isAvailable(): Promise<boolean> {
    return true // Always available as fallback
  }

  async generate(prompt: string, options?: LLMOptions): Promise<LLMResponse> {
    await this.simulateDelay()
    return {
      content: this.pickResponse(prompt),
      usage: { inputTokens: 0, outputTokens: 0 },
    }
  }

  async generateChat(messages: ChatMessage[], options?: LLMOptions): Promise<LLMResponse> {
    await this.simulateDelay()
    const lastMessage = messages[messages.length - 1]?.content ?? ''
    return {
      content: this.pickResponse(lastMessage),
      usage: { inputTokens: 0, outputTokens: 0 },
    }
  }

  private pickResponse(context: string): string {
    // Simple keyword-based response selection
    const lower = context.toLowerCase()
    if (lower.includes('trade') || lower.includes('market')) {
      return "I'd be happy to trade! What do you have to offer?"
    }
    if (lower.includes('danger') || lower.includes('fight')) {
      return "We should be careful. I've heard rumors of trouble nearby."
    }
    if (lower.includes('food') || lower.includes('hungry')) {
      return "I know a good spot for foraging near the farmlands."
    }
    return MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)]
  }

  private simulateDelay(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200))
  }
}
