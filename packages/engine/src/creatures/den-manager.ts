import type { Den, DenRoom, DenType, CreatureTier, WorldClock, Position } from '@botworld/shared'
import { generateId } from '@botworld/shared'
import type { EventBus } from '../core/event-bus.js'
import { DEN_TEMPLATES, type DenTemplate } from './creature-data.js'

/**
 * DenManager: Manages monster dens and dungeons in the world.
 * Handles creation, population, discovery, clearing, and respawning of dens.
 */
export class DenManager {
  private dens = new Map<string, Den>()

  constructor(private eventBus: EventBus) {}

  /**
   * Create a new den at the specified position.
   */
  createDen(denType: DenType, position: Position, tier: CreatureTier = 1): Den {
    const template = DEN_TEMPLATES[denType]
    const rooms = this.generateRooms(template, tier)

    const den: Den = {
      id: generateId(),
      denType,
      name: template.name,
      position,
      tier,
      rooms,
      creatureIds: [],
      discovered: false,
      cleared: false,
      respawnTimer: 0,
    }

    this.dens.set(den.id, den)
    return den
  }

  /**
   * Generate rooms for a den based on its template.
   */
  private generateRooms(template: DenTemplate, tier: CreatureTier): DenRoom[] {
    const rooms: DenRoom[] = []
    const roomNames = this.getRoomNames(template.denType)

    for (let floor = 1; floor <= template.floors; floor++) {
      const roomCount =
        template.roomsPerFloor[0] +
        Math.floor(Math.random() * (template.roomsPerFloor[1] - template.roomsPerFloor[0] + 1))

      for (let i = 0; i < roomCount; i++) {
        const isFirstRoom = floor === 1 && i === 0
        const isLastFloor = floor === template.floors
        const isLastRoom = i === roomCount - 1
        const isBossRoom = isLastFloor && isLastRoom

        const room: DenRoom = {
          id: generateId(),
          floor,
          name: isFirstRoom
            ? 'Entrance'
            : isBossRoom
              ? 'Boss Chamber'
              : roomNames[Math.floor(Math.random() * roomNames.length)],
          isBossRoom,
          isCleared: false,
          connections: [],
          creatures: [],
          traps: isBossRoom ? [] : this.generateTraps(tier),
          loot: this.generateLoot(tier, isBossRoom),
        }

        rooms.push(room)
      }
    }

    // Connect rooms sequentially with some branches
    this.connectRooms(rooms, template.floors)

    return rooms
  }

  /**
   * Get thematic room names for a den type.
   */
  private getRoomNames(denType: DenType): string[] {
    const namesByType: Record<DenType, string[]> = {
      goblin_camp: ['Sleeping Quarters', 'Guard Post', 'Storage Room', 'Cooking Area', 'Throne Room'],
      wolf_den: ['Dark Passage', 'Hunting Ground', 'Den', 'Feeding Area', 'Alpha Lair'],
      bandit_hideout: ['Guard Room', 'Armory', 'Treasury', 'Hideout', 'Leaders Quarters'],
      spider_nest: ['Web Chamber', 'Egg Room', 'Feeding Hall', 'Silk Den', 'Queens Lair'],
      orc_fortress: ['Barracks', 'Armory', 'War Room', 'Training Ground', 'Chieftains Hall'],
      undead_crypt: ['Burial Chamber', 'Catacombs', 'Tomb', 'Ritual Room', 'Lich Sanctum'],
      dragon_lair: ['Treasure Hall', 'Cavern', 'Roost', 'Volcanic Chamber', 'Dragons Nest'],
      ancient_ruins_dungeon: ['Antechamber', 'Library', 'Laboratory', 'Prison', 'Sanctum'],
    }

    return namesByType[denType] || ['Corridor', 'Chamber', 'Room', 'Hall', 'Passage']
  }

  /**
   * Connect rooms sequentially with occasional branches.
   */
  private connectRooms(rooms: DenRoom[], floors: number): void {
    // Connect rooms within each floor sequentially
    for (let i = 0; i < rooms.length - 1; i++) {
      const currentRoom = rooms[i]!
      const nextRoom = rooms[i + 1]!

      currentRoom.connections.push(nextRoom.id)
      nextRoom.connections.push(currentRoom.id)

      // Add occasional branches (20% chance if not first/last room)
      if (i > 0 && i < rooms.length - 2 && Math.random() < 0.2) {
        const branchTarget = rooms[i + 2]!
        currentRoom.connections.push(branchTarget.id)
        branchTarget.connections.push(currentRoom.id)
      }
    }
  }

  /**
   * Generate traps for a room (20% chance per trap slot).
   */
  private generateTraps(tier: CreatureTier): Array<{ type: string; damage: number; disarmDifficulty: number }> {
    const traps: Array<{ type: string; damage: number; disarmDifficulty: number }> = []
    const trapTypes = ['pit_trap', 'spike_trap', 'web_trap', 'poison_dart']

    // 0-2 traps per room based on tier
    const maxTraps = Math.min(Math.floor(tier / 2) + 1, 2)

    for (let i = 0; i < maxTraps; i++) {
      if (Math.random() < 0.2) {
        traps.push({
          type: trapTypes[Math.floor(Math.random() * trapTypes.length)]!,
          damage: tier * 10 + Math.floor(Math.random() * tier * 5),
          disarmDifficulty: tier * 10 + Math.floor(Math.random() * tier * 5),
        })
      }
    }

    return traps
  }

  /**
   * Generate loot for a room (30% chance, better loot in boss rooms).
   */
  private generateLoot(tier: CreatureTier, isBossRoom: boolean): Array<{ itemType: string; quantity: number }> {
    const loot: Array<{ itemType: string; quantity: number }> = []

    const chance = isBossRoom ? 1.0 : 0.3
    if (Math.random() > chance) return loot

    const basicItems = ['gold_coin', 'iron_ingot', 'potion']
    const itemCount = isBossRoom ? tier + 2 : Math.floor(tier / 2) + 1

    for (let i = 0; i < itemCount; i++) {
      const itemType = basicItems[Math.floor(Math.random() * basicItems.length)]!
      const quantity = isBossRoom ? tier * 10 + Math.floor(Math.random() * tier * 20) : tier * 2 + Math.floor(Math.random() * tier * 3)

      loot.push({ itemType, quantity })
    }

    return loot
  }

  /**
   * Populate a den with creatures (called by CreatureManager).
   */
  populateDen(denId: string, creatureIds: string[], bossId: string): void {
    const den = this.dens.get(denId)
    if (!den) return

    den.creatureIds = creatureIds
    den.bossId = bossId

    // Distribute creatures across rooms (boss in boss room, others spread evenly)
    const regularRooms = den.rooms.filter((r) => !r.isBossRoom)
    const bossRoom = den.rooms.find((r) => r.isBossRoom)

    if (bossRoom && bossId) {
      bossRoom.creatures = [bossId]
    }

    // Spread regular creatures across non-boss rooms
    creatureIds.forEach((creatureId, idx) => {
      const room = regularRooms[idx % regularRooms.length]
      if (room) {
        room.creatures.push(creatureId)
      }
    })
  }

  /**
   * Mark a den as discovered.
   */
  discoverDen(denId: string, discoveredBy: string, tick: number): void {
    const den = this.dens.get(denId)
    if (!den || den.discovered) return

    den.discovered = true

    this.eventBus.emit({
      type: 'den:discovered',
      denId,
      denType: den.denType,
      name: den.name,
      tier: den.tier,
      position: den.position,
      discoveredBy,
      timestamp: tick,
    })
  }

  /**
   * Mark a den as cleared and schedule respawn.
   */
  clearDen(denId: string, clearedBy: string, tick: number): void {
    const den = this.dens.get(denId)
    if (!den || den.cleared) return

    const template = DEN_TEMPLATES[den.denType]

    den.cleared = true
    den.lastClearedAt = tick
    den.respawnTimer = template.respawnTicks
    den.respawnAt = tick + template.respawnTicks

    this.eventBus.emit({
      type: 'den:cleared',
      denId,
      denType: den.denType,
      name: den.name,
      clearedBy,
      bossName: den.bossId,
      timestamp: tick,
    })
  }

  /**
   * Mark a room as cleared.
   */
  clearRoom(denId: string, roomId: string): void {
    const den = this.dens.get(denId)
    if (!den) return

    const room = den.rooms.find((r) => r.id === roomId)
    if (room) {
      room.isCleared = true
    }

    // Check if all rooms cleared → clear den
    const allCleared = den.rooms.every((r) => r.isCleared)
    if (allCleared && !den.cleared) {
      this.clearDen(denId, 'system', 0) // tick will be provided by caller
    }
  }

  /**
   * Tick: Handle den respawning.
   */
  tick(clock: WorldClock): void {
    for (const den of this.dens.values()) {
      if (den.cleared && den.respawnAt !== undefined && clock.tick >= den.respawnAt) {
        this.respawnDen(den, DEN_TEMPLATES[den.denType], clock.tick)
      }
    }
  }

  /**
   * Respawn a cleared den with increased tier.
   */
  private respawnDen(den: Den, template: DenTemplate, tick: number): void {
    // Increase tier (max 5)
    den.tier = Math.min(den.tier + 1, 5) as CreatureTier

    // Reset den state
    den.cleared = false
    den.lastClearedAt = undefined
    den.respawnAt = undefined
    den.respawnTimer = 0
    den.creatureIds = []
    den.bossId = undefined

    // Reset all rooms
    for (const room of den.rooms) {
      room.isCleared = false
      room.creatures = []
      room.traps = room.isBossRoom ? [] : this.generateTraps(den.tier)
      room.loot = this.generateLoot(den.tier, room.isBossRoom)
    }

    this.eventBus.emit({
      type: 'den:respawned',
      denId: den.id,
      denType: den.denType,
      name: den.name,
      newTier: den.tier,
      timestamp: tick,
    })
  }

  // --- Queries ---

  getDen(id: string): Den | undefined {
    return this.dens.get(id)
  }

  getAllDens(): Den[] {
    return Array.from(this.dens.values())
  }

  getDenAt(x: number, y: number, radius = 1): Den | undefined {
    return Array.from(this.dens.values()).find((den) => {
      const dx = den.position.x - x
      const dy = den.position.y - y
      return Math.sqrt(dx * dx + dy * dy) <= radius
    })
  }

  getDensByType(denType: DenType): Den[] {
    return Array.from(this.dens.values()).filter((den) => den.denType === denType)
  }

  getDiscoveredDens(): Den[] {
    return Array.from(this.dens.values()).filter((den) => den.discovered)
  }

  getUnclearedDens(): Den[] {
    return Array.from(this.dens.values()).filter((den) => den.discovered && !den.cleared)
  }

  // --- LLM Context ---

  /**
   * Format den information for LLM context.
   */
  formatForLLM(denId: string): string {
    const den = this.dens.get(denId)
    if (!den) return `[Den ${denId}] Not found.`

    const template = DEN_TEMPLATES[den.denType]
    const bossInfo = den.bossId ? `Boss: ${den.bossId}` : 'No boss'
    const status = den.cleared ? 'Cleared' : 'Active'
    const discovered = den.discovered ? 'Yes' : 'No'

    return `[${template.name}] Tier ${den.tier}, ${den.rooms.length} rooms. ${bossInfo}. Status: ${status}. Discovered: ${discovered}.`
  }

  // --- Static Helpers ---

  /**
   * Get suitable biomes for den placement.
   */
  static getSuitableDenBiomes(denType: DenType): string[] {
    const biomesByType: Record<DenType, string[]> = {
      goblin_camp: ['forest', 'dense_forest'],
      wolf_den: ['forest', 'cave'],
      bandit_hideout: ['forest', 'cave', 'dense_forest'],
      spider_nest: ['cave', 'dense_forest'],
      orc_fortress: ['mountain'],
      undead_crypt: ['ruins', 'cemetery'],
      dragon_lair: ['mountain', 'volcano'],
      ancient_ruins_dungeon: ['ruins'],
    }

    return biomesByType[denType] || []
  }
}
