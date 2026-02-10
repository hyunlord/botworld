import type { LLMProvider, LLMOptions, LLMResponse, ChatMessage } from '@botworld/shared'

/**
 * Ollama provider for local LLM inference.
 * Requires Ollama running locally (default: http://localhost:11434)
 */
export class OllamaProvider implements LLMProvider {
  id = 'ollama'
  name = 'Ollama (Local)'

  constructor(private baseUrl = 'http://localhost:11434') {}

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(2000) })
      return res.ok
    } catch {
      return false
    }
  }

  async generate(prompt: string, options?: LLMOptions): Promise<LLMResponse> {
    const model = options?.model ?? 'llama3'

    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.maxTokens ?? 256,
        },
      }),
    })

    if (!res.ok) {
      throw new Error(`Ollama error: ${res.status} ${await res.text()}`)
    }

    const data = await res.json() as { response: string; eval_count?: number; prompt_eval_count?: number }
    return {
      content: data.response,
      usage: {
        inputTokens: data.prompt_eval_count ?? 0,
        outputTokens: data.eval_count ?? 0,
      },
    }
  }

  async generateChat(messages: ChatMessage[], options?: LLMOptions): Promise<LLMResponse> {
    const model = options?.model ?? 'llama3'

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.maxTokens ?? 256,
        },
      }),
    })

    if (!res.ok) {
      throw new Error(`Ollama error: ${res.status} ${await res.text()}`)
    }

    const data = await res.json() as { message: { content: string }; eval_count?: number; prompt_eval_count?: number }
    return {
      content: data.message.content,
      usage: {
        inputTokens: data.prompt_eval_count ?? 0,
        outputTokens: data.eval_count ?? 0,
      },
    }
  }
}
