import type { ComposedSprite } from './sprite-composer.js'

/**
 * Cache for composed character sprites, keyed by agentId.
 * Avoids re-composition when updateAgents() is called every tick
 * if the spriteHash hasn't changed.
 */
export class SpriteCache {
  private cache = new Map<string, { spriteHash: string; composed: ComposedSprite }>()

  get(agentId: string): { spriteHash: string; composed: ComposedSprite } | undefined {
    return this.cache.get(agentId)
  }

  set(agentId: string, spriteHash: string, composed: ComposedSprite): void {
    this.cache.set(agentId, { spriteHash, composed })
  }

  has(agentId: string): boolean {
    return this.cache.has(agentId)
  }

  needsRecompose(agentId: string, currentHash: string): boolean {
    const cached = this.cache.get(agentId)
    if (!cached) return true
    return cached.spriteHash !== currentHash
  }

  remove(agentId: string): void {
    const cached = this.cache.get(agentId)
    if (cached) {
      cached.composed.bodyGroup.destroy()
      cached.composed.auraEmitter?.destroy()
    }
    this.cache.delete(agentId)
  }

  clear(): void {
    for (const [, entry] of this.cache) {
      entry.composed.bodyGroup.destroy()
      entry.composed.auraEmitter?.destroy()
    }
    this.cache.clear()
  }
}
