import type { LLMProvider, LLMOptions, LLMResponse, ChatMessage } from '@botworld/shared'

/**
 * OpenRouter provider - access hundreds of models through a single API.
 * https://openrouter.ai
 */
export class OpenRouterProvider implements LLMProvider {
  id = 'openrouter'
  name = 'OpenRouter'

  constructor(private apiKey?: string) {}

  async isAvailable(): Promise<boolean> {
    return !!(this.apiKey ?? process.env.OPENROUTER_API_KEY)
  }

  async generate(prompt: string, options?: LLMOptions): Promise<LLMResponse> {
    return this.generateChat(
      [{ role: 'user', content: prompt }],
      options,
    )
  }

  async generateChat(messages: ChatMessage[], options?: LLMOptions): Promise<LLMResponse> {
    const key = options?.model?.includes(':key=')
      ? options.model.split(':key=')[1]
      : this.apiKey ?? process.env.OPENROUTER_API_KEY

    if (!key) {
      throw new Error('OpenRouter API key not configured. Set OPENROUTER_API_KEY env var.')
    }

    const model = options?.model?.split(':key=')[0] ?? 'meta-llama/llama-3-8b-instruct'

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        'X-Title': 'Botworld',
      },
      body: JSON.stringify({
        model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 256,
      }),
    })

    if (!res.ok) {
      throw new Error(`OpenRouter error: ${res.status} ${await res.text()}`)
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
