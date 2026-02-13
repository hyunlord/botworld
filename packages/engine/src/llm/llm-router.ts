/**
 * LLMRouter — Central routing service for all game LLM calls.
 * Routes requests to local (DGX Spark) or cloud (OpenRouter) based on category.
 * Handles fallback, rate limiting, and usage logging.
 */

import type {
  LLMCategory, LLMRequest, LLMResponse, LLMProvider, LLMProviderName,
  LLMProviderOptions, RoutingRule, UsageLogEntry,
} from './types.js'
import { DEFAULT_ROUTING_TABLE, CATEGORY_DEFAULTS } from './types.js'
import { LocalLLMProvider } from './local-provider.js'
import { OpenRouterProvider } from './openrouter-provider.js'
import { UsageLogger } from './usage-logger.js'

// Rate limiter
let callsThisMinute = 0
let minuteStart = Date.now()
const MAX_CALLS_PER_MINUTE = parseInt(process.env.NPC_MAX_CALLS_PER_MINUTE ?? '30', 10)

function checkRateLimit(): boolean {
  const now = Date.now()
  if (now - minuteStart > 60_000) {
    callsThisMinute = 0
    minuteStart = now
  }
  if (callsThisMinute >= MAX_CALLS_PER_MINUTE) return false
  callsThisMinute++
  return true
}

export class LLMRouter {
  private providers: Map<LLMProviderName, LLMProvider> = new Map()
  private routingTable: Record<LLMCategory, RoutingRule>
  private logger: UsageLogger
  private routeOverride: LLMProviderName | null = null

  constructor() {
    // Initialize providers
    const local = new LocalLLMProvider()
    const openrouter = new OpenRouterProvider()
    this.providers.set('local', local)
    this.providers.set('openrouter', openrouter)

    // Routing table (can be overridden)
    this.routingTable = { ...DEFAULT_ROUTING_TABLE }

    // Check for global route override
    const override = process.env.LLM_ROUTE_ALL
    if (override === 'local' || override === 'openrouter') {
      this.routeOverride = override
      console.log(`[LLMRouter] Global route override: ALL → ${override}`)
    }

    // Usage logger
    this.logger = new UsageLogger()

    // Log status
    const localOk = local.isAvailable() ? 'available' : 'unavailable'
    const cloudOk = openrouter.isAvailable() ? 'available' : 'unavailable'
    console.log(`[LLMRouter] Initialized — local: ${localOk}, openrouter: ${cloudOk}`)
  }

  /** Check if any LLM provider is available */
  isEnabled(): boolean {
    for (const p of this.providers.values()) {
      if (p.isAvailable()) return true
    }
    return false
  }

  /** Main entry point for all game LLM calls */
  async complete(request: LLMRequest): Promise<LLMResponse | null> {
    if (!checkRateLimit()) {
      return null
    }

    const defaults = CATEGORY_DEFAULTS[request.category]
    const options: LLMProviderOptions = {
      model: request.model,
      max_tokens: request.max_tokens ?? defaults.max_tokens,
      temperature: request.temperature ?? defaults.temperature,
      response_format: request.response_format ?? defaults.response_format,
      timeout_ms: request.timeout_ms ?? 30_000,
    }

    // Determine routing
    const rule = this.routingTable[request.category]
    const primaryName = this.routeOverride ?? rule.primary
    const fallbackName = this.routeOverride
      ? (this.routeOverride === 'local' ? 'openrouter' : 'local')
      : rule.fallback

    // Try primary
    const primary = this.providers.get(primaryName)
    if (primary?.isAvailable()) {
      try {
        const response = await primary.complete(request.messages, options)
        this.logger.log({
          timestamp: Date.now(),
          category: request.category,
          provider: primaryName,
          model: response.model,
          input_tokens: response.input_tokens ?? 0,
          output_tokens: response.output_tokens ?? 0,
          latency_ms: response.latency_ms,
          success: true,
        })
        return response
      } catch (err) {
        console.warn(`[LLMRouter] ${primaryName} failed for ${request.category}: ${(err as Error).message}`)
        this.logger.log({
          timestamp: Date.now(),
          category: request.category,
          provider: primaryName,
          model: 'unknown',
          input_tokens: 0,
          output_tokens: 0,
          latency_ms: 0,
          success: false,
          error: (err as Error).message,
        })
      }
    }

    // Try fallback
    const fallback = this.providers.get(fallbackName)
    if (fallback?.isAvailable()) {
      try {
        const response = await fallback.complete(request.messages, options)
        this.logger.log({
          timestamp: Date.now(),
          category: request.category,
          provider: fallbackName,
          model: response.model,
          input_tokens: response.input_tokens ?? 0,
          output_tokens: response.output_tokens ?? 0,
          latency_ms: response.latency_ms,
          success: true,
        })
        return response
      } catch (err) {
        console.warn(`[LLMRouter] Fallback ${fallbackName} also failed for ${request.category}: ${(err as Error).message}`)
        this.logger.log({
          timestamp: Date.now(),
          category: request.category,
          provider: fallbackName,
          model: 'unknown',
          input_tokens: 0,
          output_tokens: 0,
          latency_ms: 0,
          success: false,
          error: (err as Error).message,
        })
      }
    }

    // Both failed
    return null
  }

  /** Get usage statistics for admin dashboard */
  getStats(sinceMs?: number): {
    total: number
    byProvider: Record<string, { calls: number; tokens: number; avgLatency: number; errors: number }>
    byCategory: Record<string, { calls: number; provider_breakdown: Record<string, number> }>
    estimatedCost: number
  } {
    return this.logger.getStats(sinceMs)
  }

  /** Get raw usage log entries */
  getRecentLogs(limit: number = 50): UsageLogEntry[] {
    return this.logger.getRecent(limit)
  }

  /** Get provider status */
  getProviderStatus(): Record<LLMProviderName, { available: boolean; usage: ReturnType<LLMProvider['getUsage']> }> {
    const result: Record<string, { available: boolean; usage: ReturnType<LLMProvider['getUsage']> }> = {}
    for (const [name, provider] of this.providers) {
      result[name] = {
        available: provider.isAvailable(),
        usage: provider.getUsage(),
      }
    }
    return result as Record<LLMProviderName, { available: boolean; usage: ReturnType<LLMProvider['getUsage']> }>
  }

  /** Graceful shutdown */
  destroy(): void {
    for (const provider of this.providers.values()) {
      if ('destroy' in provider && typeof (provider as any).destroy === 'function') {
        (provider as any).destroy()
      }
    }
  }
}
