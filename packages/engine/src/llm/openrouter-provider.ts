/**
 * OpenRouterProvider — Wraps existing OpenRouter API calls into the LLMProvider interface.
 */

import type { LLMProvider, LLMProviderName, LLMMessage, LLMProviderOptions, LLMResponse, LLMUsageStats } from './types.js'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

export class OpenRouterProvider implements LLMProvider {
  readonly name: LLMProviderName = 'openrouter'

  private apiKey: string
  private defaultModel: string

  // Usage tracking
  private stats: LLMUsageStats = {
    totalCalls: 0, totalInputTokens: 0, totalOutputTokens: 0, avgLatencyMs: 0, errorCount: 0,
  }
  private latencySum = 0

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || ''
    this.defaultModel = process.env.OPENROUTER_MODEL || process.env.NPC_LLM_MODEL || 'google/gemini-2.0-flash-001'

    if (this.apiKey) {
      console.log(`[OpenRouter] Enabled (model: ${this.defaultModel})`)
    } else {
      console.log('[OpenRouter] Disabled (no OPENROUTER_API_KEY)')
    }
  }

  isAvailable(): boolean {
    return !!this.apiKey
  }

  getUsage(): LLMUsageStats {
    return { ...this.stats }
  }

  async complete(messages: LLMMessage[], options: LLMProviderOptions): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured')
    }

    const start = Date.now()
    const model = options.model || this.defaultModel

    try {
      const body: Record<string, unknown> = {
        model,
        messages,
        max_tokens: options.max_tokens,
        temperature: options.temperature,
      }

      if (options.response_format === 'json') {
        body.response_format = { type: 'json_object' }
      }

      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://botworld.example.com',
          'X-Title': 'Botworld',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(options.timeout_ms || 30_000),
      })

      if (!res.ok) {
        throw new Error(`OpenRouter ${res.status}: ${res.statusText}`)
      }

      const data = await res.json() as {
        choices?: { message?: { content?: string } }[]
        usage?: { prompt_tokens?: number; completion_tokens?: number }
        model?: string
      }

      const content = data.choices?.[0]?.message?.content
      if (!content) {
        throw new Error('Empty response from OpenRouter')
      }

      const latency = Date.now() - start
      const inputTokens = data.usage?.prompt_tokens ?? 0
      const outputTokens = data.usage?.completion_tokens ?? 0

      this.stats.totalCalls++
      this.stats.totalInputTokens += inputTokens
      this.stats.totalOutputTokens += outputTokens
      this.latencySum += latency
      this.stats.avgLatencyMs = Math.round(this.latencySum / this.stats.totalCalls)

      return {
        content,
        provider: 'openrouter',
        model: data.model || model,
        latency_ms: latency,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      }
    } catch (err) {
      this.stats.errorCount++
      throw err
    }
  }
}
