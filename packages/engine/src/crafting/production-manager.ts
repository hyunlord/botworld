import type { ProductionQueue, ProductionOrder, WorldClock, AdvancedRecipe } from '@botworld/shared'
import type { EventBus } from '../core/event-bus.js'
import { ALL_ADVANCED_RECIPES } from './recipe-data.js'

export class ProductionManager {
  private queues = new Map<string, ProductionQueue>()

  constructor(private eventBus: EventBus) {}

  /** Set up a production queue for a building */
  createQueue(buildingId: string, workerId?: string): ProductionQueue {
    const queue: ProductionQueue = {
      buildingId,
      orders: [],
      workerId,
    }
    this.queues.set(buildingId, queue)
    return queue
  }

  /** Add a production order */
  addOrder(buildingId: string, recipeId: string, auto: boolean = true, priority: number = 1, dailyLimit: number = 5): boolean {
    let queue = this.queues.get(buildingId)
    if (!queue) {
      queue = this.createQueue(buildingId)
    }

    const recipe = ALL_ADVANCED_RECIPES.find((r: AdvancedRecipe) => r.id === recipeId)
    if (!recipe) return false

    // Check for duplicates
    if (queue.orders.some(o => o.recipeId === recipeId)) return false

    queue.orders.push({
      recipeId,
      auto,
      priority,
      dailyLimit,
      produced: 0,
      active: true,
    })

    // Sort by priority
    queue.orders.sort((a, b) => a.priority - b.priority)
    return true
  }

  /** Remove a production order */
  removeOrder(buildingId: string, recipeId: string): boolean {
    const queue = this.queues.get(buildingId)
    if (!queue) return false
    const idx = queue.orders.findIndex(o => o.recipeId === recipeId)
    if (idx === -1) return false
    queue.orders.splice(idx, 1)
    return true
  }

  /** Assign a worker to a building */
  assignWorker(buildingId: string, workerId: string): void {
    const queue = this.queues.get(buildingId)
    if (queue) queue.workerId = workerId
  }

  /** Tick production — advance current orders, start new ones */
  tick(
    clock: WorldClock,
    checkMaterials: (buildingId: string, recipeId: string) => boolean,
    consumeMaterials: (buildingId: string, recipeId: string) => boolean,
    produceItem: (buildingId: string, recipeId: string, quantity: number) => void,
  ): void {
    for (const queue of this.queues.values()) {
      if (!queue.workerId) continue // no worker, no production
      if (queue.orders.length === 0) continue

      // Advance current production
      if (queue.currentOrder) {
        const recipe = ALL_ADVANCED_RECIPES.find((r: AdvancedRecipe) => r.id === queue.currentOrder!.recipeId)
        if (!recipe) {
          queue.currentOrder = undefined
          continue
        }

        const elapsed = clock.tick - queue.currentOrder.startedAt
        queue.currentOrder.progress = Math.min(100, (elapsed / recipe.craftingTime) * 100)

        if (queue.currentOrder.progress >= 100) {
          // Production complete
          produceItem(queue.buildingId, recipe.id, recipe.output.quantity)

          this.eventBus.emit({
            type: 'production:completed',
            buildingId: queue.buildingId,
            recipeId: recipe.id,
            recipeName: recipe.name,
            quantity: recipe.output.quantity,
            workerId: queue.workerId,
            timestamp: 0,
          } as any)

          // Update order stats
          const order = queue.orders.find(o => o.recipeId === recipe.id)
          if (order) {
            order.produced++
            // Check daily limit
            if (order.dailyLimit > 0 && order.produced >= order.dailyLimit) {
              if (!order.auto) {
                order.active = false
              }
            }
          }

          queue.currentOrder = undefined
        }
      }

      // Start next order if idle
      if (!queue.currentOrder) {
        for (const order of queue.orders) {
          if (!order.active) continue
          if (order.dailyLimit > 0 && order.produced >= order.dailyLimit) continue

          // Check if materials are available
          if (checkMaterials(queue.buildingId, order.recipeId)) {
            if (consumeMaterials(queue.buildingId, order.recipeId)) {
              queue.currentOrder = {
                recipeId: order.recipeId,
                progress: 0,
                startedAt: clock.tick,
              }
              break
            }
          }
        }
      }
    }
  }

  /** Reset daily production counts (call at day change) */
  resetDailyCounts(): void {
    for (const queue of this.queues.values()) {
      for (const order of queue.orders) {
        order.produced = 0
        if (order.auto) order.active = true
      }
    }
  }

  // ── Queries ──

  getQueue(buildingId: string): ProductionQueue | undefined { return this.queues.get(buildingId) }
  getAllQueues(): ProductionQueue[] { return Array.from(this.queues.values()) }

  getActiveQueues(): ProductionQueue[] {
    return Array.from(this.queues.values()).filter(q => q.workerId && q.orders.some(o => o.active))
  }

  formatForLLM(buildingId: string): string {
    const queue = this.queues.get(buildingId)
    if (!queue) return '[No production queue]'
    const active = queue.orders.filter(o => o.active)
    const current = queue.currentOrder
      ? `Currently making: ${queue.currentOrder.recipeId} (${Math.round(queue.currentOrder.progress)}%)`
      : 'Idle'
    return `[Production] Worker: ${queue.workerId ?? 'none'}. ${current}. ${active.length} orders queued.`
  }
}
