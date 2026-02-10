import type { LLMProvider, LLMOptions, LLMResponse, ChatMessage } from '@botworld/shared'

/**
 * OpenAI provider.
 * Requires OPENAI_API_KEY env var.
 */
export class OpenAIProvider implements LLMProvider {
  id = 'openai'
  name = 'OpenAI'
  defaultModel = 'gpt-4o-mini'

  private get apiKey(): string | undefined {
    return process.env.OPENAI_API_KEY
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
      throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY env var.')
    }

    const model = options?.model ?? 'gpt-4o-mini'

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 256,
      }),
    })

    if (!res.ok) {
      throw new Error(`OpenAI error: ${res.status} ${await res.text()}`)
    }

    const data = await res.json() as {
      choices: { message: { content: string } }[]
      usage?: { prompt_tokens: number; completion_tokens: number }
    }

    return {
      content: data.choices[0]?.message.content ?? '',
      usage: data.usage ? {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
      } : undefined,
    }
  }
}
