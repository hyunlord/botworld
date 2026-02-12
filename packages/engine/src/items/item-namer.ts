import type { RichItem } from '@botworld/shared'
import type { ItemManager } from './item-manager.js'
import type { EventBus } from '../core/event-bus.js'

/**
 * AI-powered item naming system.
 * Listens for naming candidates and uses LLM to generate fantasy names.
 */
export class ItemNamer {
  private pendingNames = new Set<string>()

  constructor(
    private itemManager: ItemManager,
    private eventBus: EventBus,
    private llmCall?: (prompt: string) => Promise<string>,
  ) {
    // Listen for naming candidates
    this.eventBus.on('item:naming_candidate', (event) => {
      if (event.type !== 'item:naming_candidate') return
      this.tryNameItem(event.itemId, event.reason)
    })
  }

  /**
   * Trigger naming for masterwork+ items at creation time.
   */
  async nameOnCreation(item: RichItem, crafterName: string): Promise<void> {
    if (item.quality !== 'masterwork' && item.quality !== 'legendary') return
    await this.tryNameItem(item.id, 'masterwork_creation', crafterName)
  }

  private async tryNameItem(itemId: string, reason: string, crafterName?: string): Promise<void> {
    if (this.pendingNames.has(itemId)) return
    this.pendingNames.add(itemId)

    try {
      const item = this.itemManager.getItem(itemId)
      if (!item || item.customName) {
        this.pendingNames.delete(itemId)
        return
      }

      const name = this.llmCall
        ? await this.generateNameWithLLM(item)
        : this.generateFallbackName(item)

      if (name) {
        this.itemManager.nameItem(itemId, name, crafterName)

        // Broadcast for masterwork+ items
        if (item.quality === 'masterwork' || item.quality === 'legendary') {
          this.eventBus.emit({
            type: 'item:masterwork_created',
            itemId: item.id,
            itemName: item.name,
            customName: name,
            quality: item.quality,
            crafterName: crafterName ?? 'Unknown',
            timestamp: item.createdAt,
          })
        }
      }
    } finally {
      this.pendingNames.delete(itemId)
    }
  }

  private async generateNameWithLLM(item: RichItem): Promise<string | null> {
    if (!this.llmCall) return null

    const historySummary = item.history
      .slice(0, 10)
      .map(h => h.text)
      .join('. ')

    const provenanceSummary = this.getProvenanceSummary(item)

    const prompt = [
      `This is a ${item.quality} ${item.name} (${item.category}).`,
      provenanceSummary,
      historySummary ? `History: ${historySummary}` : '',
      'Give this item a short fantasy name (2-3 words only). Respond with ONLY the name, nothing else.',
    ].filter(Boolean).join(' ')

    try {
      const response = await this.llmCall(prompt)
      const name = response.trim().replace(/^["']|["']$/g, '').slice(0, 40)
      return name || null
    } catch {
      return this.generateFallbackName(item)
    }
  }

  private generateFallbackName(item: RichItem): string {
    const prefixes = [
      'Northern', 'Shadow', 'Storm', 'Iron', 'Golden',
      'Ancient', 'Silent', 'Crimson', 'Frost', 'Thunder',
      'Dawn', 'Twilight', 'Silver', 'Ember', 'Rune',
    ]
    const suffixes: Record<string, string[]> = {
      weapon: ['Fang', 'Edge', 'Bane', 'Fury', 'Wrath', 'Strike', 'Bite', 'Claw'],
      armor: ['Ward', 'Guard', 'Bulwark', 'Shell', 'Aegis', 'Bastion'],
      tool: ['Craft', 'Touch', 'Hand', 'Art', 'Work', 'Mastery'],
      default: ['Star', 'Heart', 'Soul', 'Song', 'Dream', 'Fortune'],
    }

    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
    const suffixPool = suffixes[item.category] ?? suffixes.default
    const suffix = suffixPool[Math.floor(Math.random() * suffixPool.length)]

    // Sometimes use crafter name or location
    if (item.provenance.origin === 'crafted' && Math.random() < 0.3) {
      const shortName = item.provenance.crafted_by_name.split(' ')[0]
      return `${shortName}'s ${suffix}`
    }

    return `${prefix} ${suffix}`
  }

  private getProvenanceSummary(item: RichItem): string {
    const prov = item.provenance
    switch (prov.origin) {
      case 'crafted':
        const matNames = prov.materials.map(m => m.template).join(', ')
        return `Crafted by ${prov.crafted_by_name} at ${prov.crafted_location} from ${matNames}.`
      case 'found':
        return `Found by ${prov.found_by_name} at ${prov.found_location}.`
      case 'dropped':
        return `Dropped by ${prov.dropped_by}.`
      default:
        return ''
    }
  }
}
