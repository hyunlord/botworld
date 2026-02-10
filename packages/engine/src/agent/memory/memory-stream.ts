import type { Memory } from '@botworld/shared'
import { generateId, MAX_MEMORIES, REFLECTION_IMPORTANCE_THRESHOLD } from '@botworld/shared'

export class MemoryStream {
  private memories: Memory[] = []

  constructor(private agentId: string) {}

  add(description: string, importance: number, timestamp: number, relatedAgents: string[] = []): Memory {
    const memory: Memory = {
      id: generateId('mem'),
      agentId: this.agentId,
      description,
      importance: Math.min(10, Math.max(0, importance)),
      timestamp,
      type: 'observation',
      relatedAgents,
    }
    this.memories.push(memory)
    this.pruneIfNeeded()
    return memory
  }

  addReflection(description: string, timestamp: number): Memory {
    const memory: Memory = {
      id: generateId('mem'),
      agentId: this.agentId,
      description,
      importance: 8,
      timestamp,
      type: 'reflection',
      relatedAgents: [],
    }
    this.memories.push(memory)
    return memory
  }

  addPlan(description: string, timestamp: number): Memory {
    const memory: Memory = {
      id: generateId('mem'),
      agentId: this.agentId,
      description,
      importance: 6,
      timestamp,
      type: 'plan',
      relatedAgents: [],
    }
    this.memories.push(memory)
    return memory
  }

  /**
   * Retrieve memories relevant to a query, scored by recency + importance + relevance.
   * For MVP, we use keyword matching. Later, embeddings can replace this.
   */
  retrieve(query: string, count: number = 10, currentTick: number = 0): Memory[] {
    const queryWords = query.toLowerCase().split(/\s+/)

    const scored = this.memories.map(mem => {
      const memWords = mem.description.toLowerCase()
      const relevance = queryWords.filter(w => memWords.includes(w)).length / Math.max(queryWords.length, 1)
      const recency = currentTick > 0 ? 1 / (1 + (currentTick - mem.timestamp) * 0.001) : 0.5
      const importance = mem.importance / 10

      return {
        memory: mem,
        score: relevance * 0.4 + recency * 0.3 + importance * 0.3,
      }
    })

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .map(s => s.memory)
  }

  getRecent(count: number = 10): Memory[] {
    return this.memories.slice(-count)
  }

  getImportant(threshold: number = REFLECTION_IMPORTANCE_THRESHOLD): Memory[] {
    return this.memories.filter(m => m.importance >= threshold)
  }

  getByAgent(agentId: string): Memory[] {
    return this.memories.filter(m => m.relatedAgents.includes(agentId))
  }

  getAll(): Memory[] {
    return [...this.memories]
  }

  private pruneIfNeeded(): void {
    if (this.memories.length <= MAX_MEMORIES) return

    // Keep reflections and high-importance memories, prune oldest low-importance
    this.memories.sort((a, b) => {
      if (a.type === 'reflection' && b.type !== 'reflection') return -1
      if (b.type === 'reflection' && a.type !== 'reflection') return 1
      return b.importance - a.importance || b.timestamp - a.timestamp
    })
    this.memories = this.memories.slice(0, MAX_MEMORIES)
    // Re-sort by timestamp
    this.memories.sort((a, b) => a.timestamp - b.timestamp)
  }
}
