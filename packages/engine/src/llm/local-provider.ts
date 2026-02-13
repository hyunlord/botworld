/**
 * LocalLLMProvider — Calls a local vLLM/Ollama server via OpenAI-compatible API.
 * Includes health checking, concurrency control, and automatic availability detection.
 */

import type { LLMProvider, LLMProviderName, LLMMessage, LLMProviderOptions, LLMResponse, LLMUsageStats } from './types.js'

export class LocalLLMProvider implements LLMProvider {
  readonly name: LLMProviderName = 'local'

  private baseUrl: string
  private model: string
  private apiKey: string
  private maxConcurrent: number
  private healthCheckInterval: number
  private timeoutMs: number

  private available = false
  private activeCalls = 0
  private waitQueue: (() => void)[] = []
  private healthTimer: ReturnType<typeof setInterval> | null = null

  // Usage tracking
  private stats: LLMUsageStats = {
    totalCalls: 0, totalInputTokens: 0, totalOutputTokens: 0, avgLatencyMs: 0, errorCount: 0,
  }
  private latencySum = 0

  constructor() {
    this.baseUrl = process.env.LOCAL_LLM_BASE_URL || 'http://localhost:8000/v1'
    this.model = process.env.LOCAL_LLM_MODEL || 'Qwen/Qwen3-32B'
    this.apiKey = process.env.LOCAL_LLM_API_KEY || ''
    this.maxConcurrent = parseInt(process.env.LOCAL_LLM_MAX_CONCURRENT || '8', 10)
    this.healthCheckInterval = parseInt(process.env.LOCAL_LLM_HEALTH_CHECK_INTERVAL_MS || '30000', 10)
    this.timeoutMs = parseInt(process.env.LOCAL_LLM_TIMEOUT_MS || '30000', 10)

    const enabled = process.env.LOCAL_LLM_ENABLED === 'true'
    if (enabled) {
      this.startHealthCheck()
      console.log(`[LocalLLM] Enabled → ${this.baseUrl} (model: ${this.model}, max concurrent: ${this.maxConcurrent})`)
    } else {
      console.log('[LocalLLM] Disabled (LOCAL_LLM_ENABLED != true)')
    }
  }

  isAvailable(): boolean {
    return this.available
  }

  getUsage(): LLMUsageStats {
    return { ...this.stats }
  }

  async complete(messages: LLMMessage[], options: LLMProviderOptions): Promise<LLMResponse> {
    if (!this.available) {
      throw new Error('Local LLM is not available')
    }

    await this.acquireSemaphore()
    const start = Date.now()

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`
      }

      const body: Record<string, unknown> = {
        model: options.model || this.model,
        messages,
        max_tokens: options.max_tokens,
        temperature: options.temperature,
      }

      if (options.response_format === 'json') {
        body.response_format = { type: 'json_object' }
      }

      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(options.timeout_ms || this.timeoutMs),
      })

      if (!res.ok) {
        throw new Error(`Local LLM ${res.status}: ${res.statusText}`)
      }

      const data = await res.json() as {
        choices?: { message?: { content?: string } }[]
        usage?: { prompt_tokens?: number; completion_tokens?: number }
        model?: string
      }

      const content = data.choices?.[0]?.message?.content
      if (!content) {
        throw new Error('Empty response from local LLM')
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
        provider: 'local',
        model: data.model || this.model,
        latency_ms: latency,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      }
    } catch (err) {
      this.stats.errorCount++
      throw err
    } finally {
      this.releaseSemaphore()
    }
  }

  /** Graceful shutdown */
  destroy(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer)
      this.healthTimer = null
    }
  }

  // ── Concurrency semaphore ──

  private acquireSemaphore(): Promise<void> {
    if (this.activeCalls < this.maxConcurrent) {
      this.activeCalls++
      return Promise.resolve()
    }
    return new Promise<void>(resolve => {
      this.waitQueue.push(() => {
        this.activeCalls++
        resolve()
      })
    })
  }

  private releaseSemaphore(): void {
    this.activeCalls--
    const next = this.waitQueue.shift()
    if (next) next()
  }

  // ── Health checking ──

  private startHealthCheck(): void {
    // Initial check
    this.checkHealth()
    // Periodic
    this.healthTimer = setInterval(() => this.checkHealth(), this.healthCheckInterval)
  }

  private async checkHealth(): Promise<void> {
    try {
      // Try /health first (vLLM), then /v1/models (OpenAI-compat)
      const url = this.baseUrl.replace(/\/v1$/, '')
      let ok = false

      try {
        const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) })
        ok = res.ok
      } catch {
        // Try /v1/models instead
        try {
          const res = await fetch(`${this.baseUrl}/models`, { signal: AbortSignal.timeout(5000) })
          ok = res.ok
        } catch {
          ok = false
        }
      }

      if (ok && !this.available) {
        console.log('[LocalLLM] Server is now available')
      } else if (!ok && this.available) {
        console.warn('[LocalLLM] Server became unavailable')
      }
      this.available = ok
    } catch {
      if (this.available) {
        console.warn('[LocalLLM] Health check failed')
      }
      this.available = false
    }
  }
}
