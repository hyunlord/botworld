import type { LLMProvider, LLMOptions, LLMResponse, ChatMessage } from '@botworld/shared'

/**
 * Anthropic Claude provider.
 * Requires ANTHROPIC_API_KEY env var.
 */
export class AnthropicProvider implements LLMProvider {
  id = 'anthropic'
  name = 'Anthropic Claude'

  private get apiKey(): string | undefined {
    return process.env.ANTHROPIC_API_KEY
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey
  }

  async generate(prompt: string, options?: LLMOptions): Promise<LLMResponse> {
    return this.generateChat(
      [{ role: 'user', content: prompt }],
      options,
    )
  }

  async generateChat(messages: ChatMessage[], options?: LLMOptions): Promise<LLMResponse> {
    const key = this.apiKey
    if (!key) {
      throw new Error('Anthropic API key not configured. Set ANTHROPIC_API_KEY env var.')
    }

    const model = options?.model ?? 'claude-haiku-4-5-20251001'

    // Extract system message if present
    const systemMsg = messages.find(m => m.role === 'system')
    const chatMessages = messages.filter(m => m.role !== 'system')

    const body: Record<string, unknown> = {
      model,
      max_tokens: options?.maxTokens ?? 256,
      messages: chatMessages.map(m => ({ role: m.role, content: m.content })),
    }

    if (options?.temperature !== undefined) {
      body.temperature = options.temperature
    }

    if (systemMsg) {
      body.system = systemMsg.content
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      throw new Error(`Anthropic error: ${res.status} ${await res.text()}`)
    }

    const data = await res.json() as {
      content: { type: string; text: string }[]
      usage?: { input_tokens: number; output_tokens: number }
    }

    return {
      content: data.content.map(c => c.text).join(''),
      usage: data.usage ? {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
      } : undefined,
    }
  }
}
