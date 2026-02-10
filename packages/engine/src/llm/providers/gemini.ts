import type { LLMProvider, LLMOptions, LLMResponse, ChatMessage } from '@botworld/shared'

/**
 * Google Gemini provider.
 * Requires GEMINI_API_KEY env var.
 */
export class GeminiProvider implements LLMProvider {
  id = 'gemini'
  name = 'Google Gemini'
  defaultModel = 'gemini-2.0-flash'

  private get apiKey(): string | undefined {
    return process.env.GEMINI_API_KEY
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
      throw new Error('Gemini API key not configured. Set GEMINI_API_KEY env var.')
    }

    const model = options?.model ?? 'gemini-2.0-flash'

    // Convert ChatMessage format to Gemini's format
    const systemInstruction = messages.find(m => m.role === 'system')
    const chatMessages = messages.filter(m => m.role !== 'system')

    const contents = chatMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 256,
      },
    }

    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction.content }] }
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      throw new Error(`Gemini error: ${res.status} ${await res.text()}`)
    }

    const data = await res.json() as {
      candidates: { content: { parts: { text: string }[] } }[]
      usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number }
    }

    const text = data.candidates?.[0]?.content.parts.map(p => p.text).join('') ?? ''

    return {
      content: text,
      usage: data.usageMetadata ? {
        inputTokens: data.usageMetadata.promptTokenCount,
        outputTokens: data.usageMetadata.candidatesTokenCount,
      } : undefined,
    }
  }
}
