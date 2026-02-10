import type { WorldEvent } from '@botworld/shared'

type EventHandler = (event: WorldEvent) => void
type EventType = WorldEvent['type']

export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>()
  private globalHandlers = new Set<EventHandler>()
  private eventLog: WorldEvent[] = []

  on(type: EventType, handler: EventHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    this.handlers.get(type)!.add(handler)
    return () => this.handlers.get(type)?.delete(handler)
  }

  onAny(handler: EventHandler): () => void {
    this.globalHandlers.add(handler)
    return () => this.globalHandlers.delete(handler)
  }

  emit(event: WorldEvent): void {
    this.eventLog.push(event)

    const handlers = this.handlers.get(event.type)
    if (handlers) {
      for (const handler of handlers) {
        handler(event)
      }
    }

    for (const handler of this.globalHandlers) {
      handler(event)
    }
  }

  getRecentEvents(count: number = 50): WorldEvent[] {
    return this.eventLog.slice(-count)
  }

  getEventsSince(timestamp: number): WorldEvent[] {
    return this.eventLog.filter(e => e.timestamp >= timestamp)
  }

  clearLog(): void {
    this.eventLog = []
  }
}
