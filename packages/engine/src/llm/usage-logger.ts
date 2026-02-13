/**
 * UsageLogger — In-memory LLM usage tracking with rolling window.
 * Keeps last 10,000 entries for dashboard queries.
 */

import type { UsageLogEntry, LLMProviderName, LLMCategory } from './types.js'

// OpenRouter approximate pricing (per 1M tokens)
const OPENROUTER_PRICING: Record<string, { input: number; output: number }> = {
  'google/gemini-2.0-flash-001': { input: 0.10, output: 0.40 },
  'anthropic/claude-3.5-haiku': { input: 0.80, output: 4.00 },
  default: { input: 0.50, output: 1.50 },
}

export class UsageLogger {
  private entries: UsageLogEntry[] = []
  private maxEntries = 10_000

  log(entry: UsageLogEntry): void {
    this.entries.push(entry)
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries)
    }
  }

  getRecent(limit: number): UsageLogEntry[] {
    return this.entries.slice(-limit)
  }

  getStats(sinceMs?: number): {
    total: number
    byProvider: Record<string, { calls: number; tokens: number; avgLatency: number; errors: number }>
    byCategory: Record<string, { calls: number; provider_breakdown: Record<string, number> }>
    estimatedCost: number
  } {
    const since = sinceMs ? Date.now() - sinceMs : 0
    const filtered = since > 0
      ? this.entries.filter(e => e.timestamp >= since)
      : this.entries

    const byProvider: Record<string, { calls: number; tokens: number; avgLatency: number; errors: number; latencySum: number }> = {}
    const byCategory: Record<string, { calls: number; provider_breakdown: Record<string, number> }> = {}
    let estimatedCost = 0

    for (const entry of filtered) {
      // Provider stats
      if (!byProvider[entry.provider]) {
        byProvider[entry.provider] = { calls: 0, tokens: 0, avgLatency: 0, errors: 0, latencySum: 0 }
      }
      const ps = byProvider[entry.provider]
      ps.calls++
      ps.tokens += entry.input_tokens + entry.output_tokens
      ps.latencySum += entry.latency_ms
      if (!entry.success) ps.errors++

      // Category stats
      if (!byCategory[entry.category]) {
        byCategory[entry.category] = { calls: 0, provider_breakdown: {} }
      }
      const cs = byCategory[entry.category]
      cs.calls++
      cs.provider_breakdown[entry.provider] = (cs.provider_breakdown[entry.provider] || 0) + 1

      // Cost estimation (only for OpenRouter)
      if (entry.provider === 'openrouter' && entry.success) {
        const pricing = OPENROUTER_PRICING[entry.model] || OPENROUTER_PRICING.default
        estimatedCost += (entry.input_tokens / 1_000_000) * pricing.input
        estimatedCost += (entry.output_tokens / 1_000_000) * pricing.output
      }
    }

    // Compute avg latencies
    const providerResult: Record<string, { calls: number; tokens: number; avgLatency: number; errors: number }> = {}
    for (const [name, ps] of Object.entries(byProvider)) {
      providerResult[name] = {
        calls: ps.calls,
        tokens: ps.tokens,
        avgLatency: ps.calls > 0 ? Math.round(ps.latencySum / ps.calls) : 0,
        errors: ps.errors,
      }
    }

    return {
      total: filtered.length,
      byProvider: providerResult,
      byCategory,
      estimatedCost: Math.round(estimatedCost * 10000) / 10000,
    }
  }
}
