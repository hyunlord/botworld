import type {
  Creature,
  CreatureTier,
  CreatureState,
  CreatureType,
  CreatureBehavior,
  WorldClock,
  Position,
  Season,
  ActiveTime,
} from '@botworld/shared'
import { generateId } from '@botworld/shared'

// Note: creature-data.js is being created in parallel
// These imports will work once that file exists
import type { CreatureTemplate } from './creature-data.js'

import type { EventBus } from '../core/event-bus.js'
import type { TileMap } from '../world/tile-map.js'

// Temporary stubs until creature-data.js is created
const CREATURE_TEMPLATES: Record<string, CreatureTemplate> = {}
const BIOME_SPAWN_TABLE: Record<string, CreatureTemplate[]> = {}
function getCreatureTemplate(id: string): CreatureTemplate | undefined {
  return CREATURE_TEMPLATES[id]
}
function getSpawnableCreatures(biome: string, isNight: boolean): CreatureTemplate[] {
  return []
}

export class CreatureManager {
  private creatures = new Map<string, Creature>()
  private lastSpawnCheck = 0
  private lastBehaviorTick = 0

  // Config
  private readonly MAX_CREATURES = 150
  private readonly SPAWN_INTERVAL = 30 // ticks between spawn checks
  private readonly BEHAVIOR_INTERVAL = 5 // ticks between AI updates
  private readonly SAFE_ZONE_RADIUS = 10 // tiles from settlements with no spawning

  constructor(
    private eventBus: EventBus,
    private tileMap: TileMap,
  ) {}

  // ============================================================
  // SPAWNING
  // ============================================================

  spawnCreature(
    templateId: string,
    position: Position,
    options?: { packId?: string; denId?: string; customName?: string },
  ): Creature | null {
    const template = getCreatureTemplate(templateId)
    if (!template) {
      console.warn(`[CreatureManager] Unknown template: ${templateId}`)
      return null
    }

    // Scale stats by tier
    const tierMultiplier = this.getTierMultiplier(template.tier)
    const creature: Creature = {
      id: generateId(),
      templateId: template.id,
      name: template.name,
      customName: options?.customName,
      tier: template.tier,
      creatureType: template.creatureType as CreatureType,
      behavior: template.behavior as CreatureBehavior,
      state: 'roaming',
      position,
      hp: template.baseHp * tierMultiplier,
      maxHp: template.baseHp * tierMultiplier,
      attack: template.baseAttack * tierMultiplier,
      defense: template.baseDefense * tierMultiplier,
      speed: template.speed,
      stats: {
        strength: template.baseAttack,
        agility: template.speed,
        intelligence: 5,
        perception: 5,
      },
      lootTable: template.loot || [],
      habitat: template.habitat,
      activeTime: template.activeTime as ActiveTime,
      packId: options?.packId,
      denId: options?.denId,
      respawnTick: undefined,
      lastActionTick: 0,
      isAnimal: template.isAnimal,
      canBeTamed: template.canBeTamed ?? false,
      produces: template.produces
        ? {
            item: template.produces.item,
            interval: template.produces.interval,
            lastProduced: 0,
          }
        : undefined,
    }

    this.creatures.set(creature.id, creature)
    this.eventBus.emit({
      type: 'creature:spawned',
      creatureId: creature.id,
      templateId: creature.templateId,
      creatureType: creature.creatureType,
      tier: creature.tier,
      name: creature.name,
      position: creature.position,
      timestamp: 0,
    })
    return creature
  }

  private getTierMultiplier(tier: CreatureTier): number {
    switch (tier) {
      case 1:
        return 1
      case 2:
        return 1.5
      case 3:
        return 2.5
      case 4:
        return 4
      case 5:
        return 7
      default:
        return 1
    }
  }

  private tickSpawning(clock: WorldClock): void {
    const currentCount = this.getAliveCreatures().length
    if (currentCount >= this.MAX_CREATURES) return

    // WorldClock doesn't have hour or season yet - use simplified logic
    const isNight = false // TODO: Add when WorldClock has hour field
    const seasonMultiplier = 1.0 // TODO: Add when WorldClock has season field
    const chunksToCheck = this.getActiveChunks()

    for (const chunk of chunksToCheck) {
      if (currentCount >= this.MAX_CREATURES) break
      if (Math.random() > 0.15) continue // 15% chance per chunk per interval

      const biome = this.getBiomeForChunk(chunk)
      if (!biome) continue

      // Check safe zone
      if (this.isInSafeZone(chunk.x * 16, chunk.y * 16)) continue

      const spawnableCreatures = getSpawnableCreatures(biome, isNight)
      if (spawnableCreatures.length === 0) continue

      // Pick creature based on distance from center
      const distanceFromCenter = Math.sqrt(chunk.x ** 2 + chunk.y ** 2)
      const allowedTiers = this.getAllowedTiers(distanceFromCenter)
      const filteredCreatures = spawnableCreatures.filter((c) =>
        allowedTiers.includes(c.tier),
      )
      if (filteredCreatures.length === 0) continue

      const template = this.weightedRandom(filteredCreatures)
      if (!template) continue

      // Find valid spawn position in chunk
      const spawnPos = this.findValidSpawnPosition(chunk.x * 16, chunk.y * 16)
      if (!spawnPos) continue

      this.spawnCreature(template.id, spawnPos)
    }
  }

  private getActiveChunks(): Array<{ x: number; y: number }> {
    // Simple approach: check a 5x5 grid of chunks around origin
    const chunks: Array<{ x: number; y: number }> = []
    for (let cx = -2; cx <= 2; cx++) {
      for (let cy = -2; cy <= 2; cy++) {
        chunks.push({ x: cx, y: cy })
      }
    }
    return chunks
  }

  private getBiomeForChunk(chunk: { x: number; y: number }): string | null {
    const centerX = chunk.x * 16 + 8
    const centerY = chunk.y * 16 + 8
    const tile = this.tileMap.getTile(centerX, centerY)
    return tile?.biome || null
  }

  private isInSafeZone(x: number, y: number): boolean {
    // TODO: TileMap.getPOIs() doesn't exist yet
    // For now, return false (no safe zones)
    return false
  }

  private getAllowedTiers(distance: number): CreatureTier[] {
    if (distance < 5) return [1]
    if (distance < 10) return [1, 2]
    if (distance < 20) return [1, 2, 3]
    if (distance < 35) return [1, 2, 3, 4]
    return [1, 2, 3, 4, 5]
  }

  private weightedRandom(templates: CreatureTemplate[]): CreatureTemplate | null {
    const totalWeight = templates.reduce((sum, t) => sum + 1, 0)
    let random = Math.random() * totalWeight
    for (const template of templates) {
      random -= 1
      if (random <= 0) return template
    }
    return templates[0] || null
  }

  private findValidSpawnPosition(
    chunkX: number,
    chunkY: number,
  ): Position | null {
    // Try 10 random positions in chunk
    for (let i = 0; i < 10; i++) {
      const x = chunkX + Math.floor(Math.random() * 16)
      const y = chunkY + Math.floor(Math.random() * 16)
      const tile = this.tileMap.getTile(x, y)
      if (tile && tile.type !== 'water' && tile.type !== 'mountain') {
        return { x, y }
      }
    }
    return null
  }

  // ============================================================
  // BEHAVIOR
  // ============================================================

  private tickBehavior(clock: WorldClock): void {
    const isNight = false // TODO: Add when WorldClock has hour

    for (const creature of this.creatures.values()) {
      if (creature.state === 'dead') continue

      // Check active time
      if (creature.activeTime === 'night' && !isNight) {
        creature.state = 'resting'
        continue
      }
      if (creature.activeTime === 'day' && isNight) {
        creature.state = 'resting'
        continue
      }

      switch (creature.state) {
        case 'roaming':
          this.handleRoaming(creature, clock)
          break
        case 'hunting':
          this.handleHunting(creature, clock)
          break
        case 'resting':
          this.handleResting(creature)
          break
        case 'guarding':
          this.handleGuarding(creature)
          break
        case 'fleeing':
          this.handleFleeing(creature, clock)
          break
      }
    }
  }

  private handleRoaming(creature: Creature, clock: WorldClock): void {
    // Random movement
    if (Math.random() < 0.4) {
      const dx = Math.floor(Math.random() * 3) - 1
      const dy = Math.floor(Math.random() * 3) - 1
      const newX = creature.position.x + dx
      const newY = creature.position.y + dy

      const tile = this.tileMap.getTile(newX, newY)
      if (
        tile &&
        tile.type !== 'water' &&
        creature.habitat.includes(tile.biome || '')
      ) {
        creature.position.x = newX
        creature.position.y = newY
      }
    }

    // Predators may start hunting
    if (creature.behavior === 'aggressive' && Math.random() < 0.1) {
      creature.state = 'hunting'
    }
  }

  private handleHunting(creature: Creature, clock: WorldClock): void {
    // Simple hunting behavior - move randomly
    const dx = Math.floor(Math.random() * 3) - 1
    const dy = Math.floor(Math.random() * 3) - 1
    const newX = creature.position.x + dx
    const newY = creature.position.y + dy

    const tile = this.tileMap.getTile(newX, newY)
    if (tile && tile.type !== 'water') {
      creature.position.x = newX
      creature.position.y = newY
    }

    // Return to roaming after some time
    if (Math.random() < 0.1) {
      creature.state = 'roaming'
    }
  }

  private handleResting(creature: Creature): void {
    if (Math.random() < 0.2) {
      creature.state = 'roaming'
    }
  }

  private handleGuarding(creature: Creature): void {
    // Stay in place for guarding
    if (Math.random() < 0.05) {
      creature.state = 'roaming'
    }
  }

  private handleFleeing(creature: Creature, clock: WorldClock): void {
    // Move away quickly
    const dx = (Math.random() > 0.5 ? 1 : -1) * 2
    const dy = (Math.random() > 0.5 ? 1 : -1) * 2
    const newX = creature.position.x + dx
    const newY = creature.position.y + dy

    const tile = this.tileMap.getTile(newX, newY)
    if (tile && tile.type !== 'water') {
      creature.position.x = newX
      creature.position.y = newY
    }

    // After 5 ticks, return to roaming
    if (clock.tick - creature.lastActionTick > 5) {
      creature.state = 'roaming'
    }
  }

  // ============================================================
  // ANIMAL BEHAVIORS
  // ============================================================

  private tickAnimalProduction(clock: WorldClock): void {
    for (const creature of this.creatures.values()) {
      if (!creature.isAnimal || !creature.produces) continue
      if (creature.state === 'dead') continue

      const { item, interval, lastProduced } = creature.produces
      if (clock.tick - lastProduced >= interval) {
        creature.produces.lastProduced = clock.tick
        // Note: creature:produced is not in WorldEvent union - using any cast
        this.eventBus.emit({
          type: 'creature:produced' as any,
          creatureId: creature.id,
          itemType: item,
          position: creature.position,
          timestamp: clock.tick,
        } as any)
      }
    }
  }

  private tickPredatorPrey(): void {
    const wolves = this.getCreaturesByType('wolf')
    const rabbits = this.getCreaturesByType('rabbit')
    const deer = this.getCreaturesByType('deer')

    // Simple predator-prey dynamics
    for (const wolf of wolves) {
      if (wolf.state !== 'roaming') continue

      const nearbyPrey = [...rabbits, ...deer].filter(
        (prey) =>
          this.distance(wolf.position, prey.position) <= 8 &&
          prey.state !== 'dead',
      )
      if (nearbyPrey.length > 0) {
        wolf.state = 'hunting'
        const target = nearbyPrey[Math.floor(Math.random() * nearbyPrey.length)]
        target.state = 'fleeing'
        target.lastActionTick = 0
      }
    }
  }

  private distance(a: Position, b: Position): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
  }

  // ============================================================
  // DEATH & RESPAWN
  // ============================================================

  killCreature(creatureId: string, killerId: string | null): string[] {
    const creature = this.creatures.get(creatureId)
    if (!creature) return []

    creature.state = 'dead'
    creature.hp = 0

    // Generate loot
    const loot: string[] = []
    if (creature.lootTable) {
      for (const entry of creature.lootTable) {
        if (Math.random() < entry.chance) {
          const min = entry.quantityMin || 1
          const max = entry.quantityMax || 1
          const quantity = min + Math.floor(Math.random() * (max - min + 1))
          for (let i = 0; i < quantity; i++) {
            loot.push(entry.itemType)
          }
        }
      }
    }

    this.eventBus.emit({
      type: 'creature:died',
      creatureId,
      templateId: creature.templateId,
      name: creature.name,
      killedBy: killerId,
      loot,
      position: creature.position,
      timestamp: 0,
    })

    return loot
  }

  private tickRespawn(clock: WorldClock): void {
    for (const creature of this.creatures.values()) {
      if (creature.state !== 'dead' || !creature.respawnTick) continue

      if (clock.tick >= creature.respawnTick) {
        // Find valid respawn position near original spawn
        const respawnPos =
          this.findValidSpawnPosition(
            Math.floor(creature.position.x / 16) * 16,
            Math.floor(creature.position.y / 16) * 16,
          ) || creature.position

        creature.position = respawnPos
        creature.hp = creature.maxHp
        creature.state = 'roaming'
        creature.respawnTick = undefined

        // Note: creature:respawned is not in WorldEvent union - using any cast
        this.eventBus.emit({
          type: 'creature:respawned' as any,
          creatureId: creature.id,
          timestamp: clock.tick,
        } as any)
      }
    }
  }

  // ============================================================
  // QUERIES
  // ============================================================

  getCreature(id: string): Creature | undefined {
    return this.creatures.get(id)
  }

  getAllCreatures(): Creature[] {
    return Array.from(this.creatures.values())
  }

  getCreaturesAt(x: number, y: number, radius = 0): Creature[] {
    return Array.from(this.creatures.values()).filter((c) => {
      const dx = Math.abs(c.position.x - x)
      const dy = Math.abs(c.position.y - y)
      return dx <= radius && dy <= radius
    })
  }

  getCreaturesInArea(x: number, y: number, radius: number): Creature[] {
    return Array.from(this.creatures.values()).filter((c) => {
      const dx = c.position.x - x
      const dy = c.position.y - y
      return Math.sqrt(dx * dx + dy * dy) <= radius
    })
  }

  getCreaturesByType(templateId: string): Creature[] {
    return Array.from(this.creatures.values()).filter(
      (c) => c.templateId === templateId,
    )
  }

  getAliveCreatures(): Creature[] {
    return Array.from(this.creatures.values()).filter((c) => c.state !== 'dead')
  }

  getCreatureCount(): number {
    return this.creatures.size
  }

  // ============================================================
  // LLM CONTEXT
  // ============================================================

  formatForLLM(nearPosition: Position, radius: number): string {
    const nearby = this.getCreaturesInArea(nearPosition.x, nearPosition.y, radius)
    if (nearby.length === 0) return '[Nearby Creatures] None'

    // Group by template
    const grouped = new Map<string, Creature[]>()
    for (const c of nearby) {
      if (!grouped.has(c.templateId)) grouped.set(c.templateId, [])
      grouped.get(c.templateId)!.push(c)
    }

    const lines: string[] = ['[Nearby Creatures]']
    for (const [templateId, creatures] of grouped) {
      const template = getCreatureTemplate(templateId)
      const name = template?.name || templateId

      if (creatures.length === 1) {
        const c = creatures[0]
        lines.push(
          `- ${name} (HP ${c.hp}/${c.maxHp}, ${c.state}${c.behavior === 'aggressive' ? ', aggressive' : ''})`,
        )
      } else {
        const aliveCount = creatures.filter((c) => c.state !== 'dead').length
        const states = creatures
          .map((c) => c.state)
          .filter((s, i, arr) => arr.indexOf(s) === i)
        lines.push(
          `- ${aliveCount}x ${name} (${states.join('/')}, ${creatures[0].behavior})`,
        )
      }
    }

    return lines.join('\n')
  }

  // ============================================================
  // MAIN TICK
  // ============================================================

  tick(clock: WorldClock): void {
    if (clock.tick - this.lastSpawnCheck >= this.SPAWN_INTERVAL) {
      this.lastSpawnCheck = clock.tick
      this.tickSpawning(clock)
    }

    if (clock.tick - this.lastBehaviorTick >= this.BEHAVIOR_INTERVAL) {
      this.lastBehaviorTick = clock.tick
      this.tickBehavior(clock)
      this.tickAnimalProduction(clock)
      this.tickPredatorPrey()
    }

    this.tickRespawn(clock)
  }
}
