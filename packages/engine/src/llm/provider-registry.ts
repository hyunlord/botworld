import type { LLMProvider } from '@botworld/shared'

export class ProviderRegistry {
  private providers = new Map<string, LLMProvider>()
  private available: LLMProvider[] = []

  register(provider: LLMProvider): void {
    this.providers.set(provider.id, provider)
    console.log(`[LLM] Registered provider: ${provider.name} (${provider.id})`)
  }

  /** Probe all registered providers and cache which ones are available */
  async detectAvailable(): Promise<LLMProvider[]> {
    this.available = []
    const results = await Promise.allSettled(
      this.listAll().map(async (p) => {
        const ok = await p.isAvailable()
        if (ok) this.available.push(p)
        return { provider: p, available: ok }
      }),
    )

    for (const r of results) {
      if (r.status === 'fulfilled') {
        const { provider, available } = r.value
        console.log(`[LLM] ${provider.name}: ${available ? 'available' : 'not available'}`)
      }
    }

    return this.available
  }

  /** Get all providers that passed the availability check (excludes mock) */
  getAvailable(): LLMProvider[] {
    return this.available.filter(p => p.id !== 'mock')
  }

  /** Pick a random available provider (excludes mock). Returns undefined if none available. */
  getRandom(): LLMProvider | undefined {
    const real = this.getAvailable()
    if (real.length === 0) return undefined
    return real[Math.floor(Math.random() * real.length)]
  }

  /** Pick a random available provider, falling back to mock if none are real */
  getRandomOrMock(): LLMProvider {
    return this.getRandom() ?? this.getOrThrow('mock')
  }

  get(id: string): LLMProvider | undefined {
    return this.providers.get(id)
  }

  getOrThrow(id: string): LLMProvider {
    const provider = this.providers.get(id)
    if (!provider) {
      throw new Error(`LLM provider "${id}" not registered. Available: ${this.listIds().join(', ')}`)
    }
    return provider
  }

  has(id: string): boolean {
    return this.providers.has(id)
  }

  listIds(): string[] {
    return Array.from(this.providers.keys())
  }

  listAll(): LLMProvider[] {
    return Array.from(this.providers.values())
  }
}

/** Global singleton provider registry */
export const providerRegistry = new ProviderRegistry()
