import type { Pack, Creature, WorldClock, Position } from '@botworld/shared'
import { generateId } from '@botworld/shared'
import type { EventBus } from '../core/event-bus.js'

export class PackManager {
  private packs = new Map<string, Pack>()
  private readonly TICK_INTERVAL = 10  // process packs every 10 ticks
  private lastTick = 0

  constructor(private eventBus: EventBus) {}

  // ── Pack Lifecycle ──

  createPack(
    packType: Pack['packType'],
    leaderId: string,
    memberIds: string[],
    territory: Position,
    radius = 12
  ): Pack {
    const pack: Pack = {
      id: generateId(),
      packType,
      leaderId,
      memberIds,
      territoryCenter: territory,
      territoryRadius: radius,
      morale: 80,
      state: 'idle',
      lastActionTick: 0,
    }

    this.packs.set(pack.id, pack)

    this.eventBus.emit({
      type: 'pack:formed',
      packId: pack.id,
      packType,
      leaderId,
      memberCount: memberIds.length,
      territory,
      timestamp: Date.now(),
    })

    return pack
  }

  disbandPack(packId: string, reason: string): void {
    const pack = this.packs.get(packId)
    if (!pack) return

    this.packs.delete(packId)

    this.eventBus.emit({
      type: 'pack:disbanded',
      packId,
      packType: pack.packType,
      reason,
      timestamp: Date.now(),
    })
  }

  addMember(packId: string, creatureId: string): void {
    const pack = this.packs.get(packId)
    if (!pack) return
    if (!pack.memberIds.includes(creatureId)) {
      pack.memberIds.push(creatureId)
    }
  }

  removeMember(packId: string, creatureId: string): void {
    const pack = this.packs.get(packId)
    if (!pack) return
    pack.memberIds = pack.memberIds.filter(id => id !== creatureId)
  }

  // ── Main Tick ──

  tick(
    clock: WorldClock,
    getCreature: (id: string) => Creature | undefined,
    getAllCreatures: () => Creature[]
  ): void {
    // Run every TICK_INTERVAL ticks
    if (clock.tick - this.lastTick < this.TICK_INTERVAL) return
    this.lastTick = clock.tick

    const allPacks = Array.from(this.packs.values())
    for (const pack of allPacks) {
      // Handle morale recovery (+1 per 20 ticks when idle)
      if (pack.state === 'idle' && clock.tick % 20 === 0) {
        pack.morale = Math.min(100, pack.morale + 1)
      }

      // Handle pack dissolution
      if (pack.morale <= 0 || pack.memberIds.length < 2) {
        this.disbandPack(pack.id, pack.morale <= 0 ? 'morale collapsed' : 'too few members')
        continue
      }

      // Process behavior based on pack type
      switch (pack.packType) {
        case 'wolf_pack':
          this.tickWolfPack(pack, getCreature, getAllCreatures)
          break
        case 'goblin_tribe':
          this.tickGoblinTribe(pack, getCreature, getAllCreatures)
          break
        case 'bandit_gang':
          this.tickBanditGang(pack, getCreature, getAllCreatures)
          break
        case 'orc_warband':
          this.tickOrcWarband(pack, getCreature, getAllCreatures)
          break
      }

      pack.lastActionTick = clock.tick
    }
  }

  // ── Wolf Pack Behavior ──

  private tickWolfPack(
    pack: Pack,
    getCreature: (id: string) => Creature | undefined,
    getAllCreatures: () => Creature[]
  ): void {
    const leader = getCreature(pack.leaderId)
    if (!leader) {
      // Alpha died - succession
      const members = pack.memberIds.map(getCreature).filter(Boolean) as Creature[]
      if (members.length > 0) {
        const newLeader = members.reduce((best, c) => (c.hp > best.hp ? c : best))
        pack.leaderId = newLeader.id
        pack.morale -= 30
      } else {
        this.disbandPack(pack.id, 'all members dead')
        return
      }
    }

    const members = pack.memberIds.map(getCreature).filter(Boolean) as Creature[]

    // State machine
    switch (pack.state) {
      case 'idle': {
        // 30% patrol territory
        if (Math.random() < 0.3) {
          pack.state = 'patrolling'
        }
        // 20% start hunting if prey nearby
        else if (Math.random() < 0.2) {
          const prey = this.findPreyInTerritory(pack, getAllCreatures())
          if (prey) {
            pack.targetId = prey.id
            pack.state = 'hunting'
          }
        }
        break
      }

      case 'hunting': {
        const target = pack.targetId ? getCreature(pack.targetId) : undefined
        if (!target || target.state === 'dead') {
          pack.state = 'idle'
          pack.targetId = undefined
          break
        }

        // Move toward target
        for (const member of members) {
          this.moveToward(member, target.position)
        }

        // Check if 2+ members adjacent to target
        const adjacent = members.filter(m => this.isAdjacent(m.position, target.position))
        if (adjacent.length >= 2) {
          // Calculate surround bonus
          const surroundBonus = 0.2 * this.countFlankingWolves(members, target.position)

          this.eventBus.emit({
            type: 'pack:hunt',
            packId: pack.id,
            packType: pack.packType,
            targetId: target.id,
            targetName: target.name,
            position: target.position,
            timestamp: Date.now(),
          })

          // Success/failure handled by CombatSystem
          // For now, assume success if target dies within 3 ticks
          const targetStillAlive = getCreature(target.id)
          if (!targetStillAlive || targetStillAlive.hp <= 0) {
            pack.morale = Math.min(100, pack.morale + 5)
            pack.state = 'idle'
            pack.targetId = undefined
          } else if (this.distance(leader!.position, target.position) > pack.territoryRadius * 1.5) {
            // Target escaped
            pack.morale = Math.max(0, pack.morale - 3)
            pack.state = 'idle'
            pack.targetId = undefined
          }
        }
        break
      }

      case 'patrolling': {
        // Members spread out in territory
        for (const member of members) {
          const angle = Math.random() * Math.PI * 2
          const dist = Math.random() * pack.territoryRadius * 0.8
          const targetPos = {
            x: Math.round(pack.territoryCenter.x + Math.cos(angle) * dist),
            y: Math.round(pack.territoryCenter.y + Math.sin(angle) * dist),
          }
          this.moveToward(member, targetPos)
        }

        // Check for intruders
        const intruders = getAllCreatures().filter(c => {
          if (c.packId === pack.id) return false
          if (c.isAnimal && !c.canBeTamed) return false
          return this.distance(c.position, pack.territoryCenter) < pack.territoryRadius
        })

        if (intruders.length > 0) {
          pack.morale = Math.max(0, pack.morale - 5)
          pack.state = 'idle'
        }

        // Return to idle after patrol
        if (Math.random() < 0.1) {
          pack.state = 'idle'
        }
        break
      }

      case 'fleeing': {
        // All members move away from threat
        for (const member of members) {
          const dx = member.position.x - pack.territoryCenter.x
          const dy = member.position.y - pack.territoryCenter.y
          const angle = Math.atan2(dy, dx)
          member.position.x = Math.round(member.position.x + Math.cos(angle) * 2)
          member.position.y = Math.round(member.position.y + Math.sin(angle) * 2)
        }

        // Return to idle when safe
        if (pack.morale > 40) {
          pack.state = 'idle'
        }
        break
      }
    }

    // Trigger fleeing when morale < 20
    if (pack.morale < 20 && pack.state !== 'fleeing') {
      pack.state = 'fleeing'
    }

    // Breeding: if pack size < 3 and morale > 60, spawn new wolf pup every 100 ticks
    if (pack.memberIds.length < 3 && pack.morale > 60 && pack.lastActionTick % 100 === 0) {
      this.eventBus.emit({
        type: 'pack:breed_request' as any,
        packId: pack.id,
        packType: pack.packType,
        templateId: this.packTypeToTemplateId(pack.packType),
        position: { ...pack.territoryCenter },
        timestamp: Date.now(),
      } as any)
    }
  }

  // ── Goblin Tribe Behavior ──

  private tickGoblinTribe(
    pack: Pack,
    getCreature: (id: string) => Creature | undefined,
    getAllCreatures: () => Creature[]
  ): void {
    const chief = getCreature(pack.leaderId)
    if (!chief) {
      // Chief died - morale -50
      const members = pack.memberIds.map(getCreature).filter(Boolean) as Creature[]
      if (members.length > 0) {
        const newChief = members.reduce((best, c) => (c.hp > best.hp ? c : best))
        pack.leaderId = newChief.id
        pack.morale = Math.max(0, pack.morale - 50)
      } else {
        this.disbandPack(pack.id, 'chief dead, tribe scattered')
        return
      }
    }

    const members = pack.memberIds.map(getCreature).filter(Boolean) as Creature[]

    // Chief decision-making
    const willingToRaid = pack.morale > 70
    const defensive = pack.morale >= 30 && pack.morale <= 70
    const fearful = pack.morale < 30

    switch (pack.state) {
      case 'idle': {
        if (willingToRaid && Math.random() < 0.2) {
          const target = this.findRaidTarget(pack, getAllCreatures())
          if (target) {
            pack.targetId = target.id
            pack.state = 'raiding'
          }
        } else if (defensive && Math.random() < 0.4) {
          pack.state = 'patrolling'
        } else if (fearful) {
          pack.state = 'fleeing'
        }
        break
      }

      case 'raiding': {
        const target = pack.targetId ? getCreature(pack.targetId) : undefined
        if (!target || target.state === 'dead') {
          pack.state = 'idle'
          pack.targetId = undefined
          break
        }

        // Scouts move ahead
        const scouts = members.slice(0, Math.ceil(members.length * 0.3))
        for (const scout of scouts) {
          this.moveToward(scout, target.position, 2)
        }

        // Warriors follow chief
        const warriors = members.slice(scouts.length)
        for (const warrior of warriors) {
          this.moveToward(warrior, chief!.position)
        }

        // Morale check each tick
        if (pack.morale < 30) {
          pack.state = 'fleeing'
        }
        break
      }

      case 'patrolling': {
        // Scouts spread out, warriors guard camp
        const scouts = members.filter(c => c.stats.agility > c.stats.strength)
        const warriors = members.filter(c => c.stats.strength >= c.stats.agility)

        for (const scout of scouts) {
          const angle = Math.random() * Math.PI * 2
          const dist = pack.territoryRadius
          const targetPos = {
            x: Math.round(pack.territoryCenter.x + Math.cos(angle) * dist),
            y: Math.round(pack.territoryCenter.y + Math.sin(angle) * dist),
          }
          this.moveToward(scout, targetPos)
        }

        for (const warrior of warriors) {
          this.moveToward(warrior, pack.territoryCenter)
        }

        if (Math.random() < 0.1) {
          pack.state = 'idle'
        }
        break
      }

      case 'fleeing': {
        // All retreat to den
        for (const member of members) {
          this.moveToward(member, pack.territoryCenter, 2)
        }

        if (pack.morale > 50) {
          pack.state = 'idle'
        }
        break
      }
    }
  }

  // ── Bandit Gang Behavior ──

  private tickBanditGang(
    pack: Pack,
    getCreature: (id: string) => Creature | undefined,
    getAllCreatures: () => Creature[]
  ): void {
    const leader = getCreature(pack.leaderId)
    if (!leader) {
      // Leader died, gang disbands
      this.disbandPack(pack.id, 'leader killed, gang scattered')
      return
    }

    const members = pack.memberIds.map(getCreature).filter(Boolean) as Creature[]

    // Similar to goblin tribe but with ambush mechanic
    switch (pack.state) {
      case 'idle': {
        // Hide near roads, attack passing agents
        if (Math.random() < 0.3) {
          pack.state = 'patrolling'
        }
        break
      }

      case 'patrolling': {
        // Ambush positions
        for (const member of members) {
          const angle = Math.random() * Math.PI * 2
          const dist = pack.territoryRadius * 0.5
          const targetPos = {
            x: Math.round(pack.territoryCenter.x + Math.cos(angle) * dist),
            y: Math.round(pack.territoryCenter.y + Math.sin(angle) * dist),
          }
          this.moveToward(member, targetPos)
        }

        if (Math.random() < 0.1) {
          pack.state = 'idle'
        }
        break
      }

      case 'raiding': {
        const target = pack.targetId ? getCreature(pack.targetId) : undefined
        if (!target || target.state === 'dead') {
          pack.state = 'idle'
          pack.targetId = undefined
          break
        }

        for (const member of members) {
          this.moveToward(member, target.position)
        }
        break
      }
    }
  }

  // ── Orc Warband Behavior ──

  private tickOrcWarband(
    pack: Pack,
    getCreature: (id: string) => Creature | undefined,
    getAllCreatures: () => Creature[]
  ): void {
    const leader = getCreature(pack.leaderId)
    if (!leader) {
      const members = pack.memberIds.map(getCreature).filter(Boolean) as Creature[]
      if (members.length > 0) {
        const newLeader = members.reduce((best, c) => (c.attack > best.attack ? c : best))
        pack.leaderId = newLeader.id
        pack.morale -= 20
      } else {
        this.disbandPack(pack.id, 'warchief dead')
        return
      }
    }

    const members = pack.memberIds.map(getCreature).filter(Boolean) as Creature[]

    // Aggressive patrols
    switch (pack.state) {
      case 'idle': {
        if (Math.random() < 0.5) {
          pack.state = 'patrolling'
        }
        break
      }

      case 'patrolling': {
        // Look for other packs/dens to attack
        const targets = getAllCreatures().filter(c => {
          if (c.packId === pack.id) return false
          if (c.packId || c.denId) {
            return this.distance(c.position, pack.territoryCenter) < pack.territoryRadius * 1.5
          }
          return false
        })

        if (targets.length > 0) {
          pack.targetId = targets[0].id
          pack.state = 'raiding'
        }

        // Move aggressively
        for (const member of members) {
          const angle = Math.random() * Math.PI * 2
          const dist = pack.territoryRadius * 1.2
          const targetPos = {
            x: Math.round(pack.territoryCenter.x + Math.cos(angle) * dist),
            y: Math.round(pack.territoryCenter.y + Math.sin(angle) * dist),
          }
          this.moveToward(member, targetPos)
        }

        if (Math.random() < 0.05) {
          pack.state = 'idle'
        }
        break
      }

      case 'raiding': {
        const target = pack.targetId ? getCreature(pack.targetId) : undefined
        if (!target || target.state === 'dead') {
          pack.morale = Math.min(100, pack.morale + 10)
          pack.state = 'idle'
          pack.targetId = undefined
          break
        }

        for (const member of members) {
          // Berserker rage: when HP < 50%, attack doubles (handled by CombatSystem)
          this.moveToward(member, target.position, member.hp < member.maxHp * 0.5 ? 2 : 1)
        }
        break
      }
    }
  }

  // ── Auto-form Packs ──

  tryFormPacks(creatures: Creature[]): void {
    const packTypes: Pack['packType'][] = ['wolf_pack', 'goblin_tribe', 'bandit_gang', 'orc_warband']

    for (const packType of packTypes) {
      const templateId = this.packTypeToTemplateId(packType)
      const candidates = creatures.filter(
        c => c.templateId === templateId && !c.packId && c.state !== 'dead'
      )

      // Group by proximity
      const groups: Creature[][] = []
      for (const creature of candidates) {
        let addedToGroup = false
        for (const group of groups) {
          if (this.distance(group[0].position, creature.position) <= 10) {
            group.push(creature)
            addedToGroup = true
            break
          }
        }
        if (!addedToGroup) {
          groups.push([creature])
        }
      }

      // Form packs for groups of 3+
      for (const group of groups) {
        if (group.length >= 3) {
          const strongest = group.reduce((best, c) => (c.hp > best.hp ? c : best))
          const memberIds = group.map(c => c.id)
          const center = {
            x: Math.round(group.reduce((sum, c) => sum + c.position.x, 0) / group.length),
            y: Math.round(group.reduce((sum, c) => sum + c.position.y, 0) / group.length),
          }
          const pack = this.createPack(packType, strongest.id, memberIds, center)

          // Update creatures
          for (const creature of group) {
            creature.packId = pack.id
          }
        }
      }
    }
  }

  // ── Queries ──

  getPack(id: string): Pack | undefined {
    return this.packs.get(id)
  }

  getAllPacks(): Pack[] {
    return Array.from(this.packs.values())
  }

  getPacksAt(x: number, y: number, radius: number): Pack[] {
    return Array.from(this.packs.values()).filter(
      pack => this.distance(pack.territoryCenter, { x, y }) <= radius
    )
  }

  getPackForCreature(creatureId: string): Pack | undefined {
    const allPacks = Array.from(this.packs.values())
    for (const pack of allPacks) {
      if (pack.leaderId === creatureId || pack.memberIds.includes(creatureId)) {
        return pack
      }
    }
    return undefined
  }

  // ── LLM Context ──

  formatPackForLLM(packId: string, getCreature: (id: string) => Creature | undefined): string {
    const pack = this.packs.get(packId)
    if (!pack) return ''

    const leader = getCreature(pack.leaderId)
    const members = pack.memberIds.map(getCreature).filter(Boolean) as Creature[]

    const packName = this.getPackDisplayName(pack, leader)
    const memberCount = pack.memberIds.length
    const memberDesc = this.getPackMemberDescription(pack, members)

    return `[${packName}] Members: ${memberCount} ${memberDesc}. Morale: ${pack.morale}. Currently: ${pack.state}. Territory: (${pack.territoryCenter.x},${pack.territoryCenter.y}) r=${pack.territoryRadius}`
  }

  // ── Helper Methods ──

  private moveToward(creature: Creature, target: Position, speed = 1): void {
    const dx = target.x - creature.position.x
    const dy = target.y - creature.position.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist > 0) {
      creature.position.x = Math.round(
        creature.position.x + (dx / dist) * Math.min(speed, dist)
      )
      creature.position.y = Math.round(
        creature.position.y + (dy / dist) * Math.min(speed, dist)
      )
    }
  }

  private distance(a: Position, b: Position): number {
    const dx = a.x - b.x
    const dy = a.y - b.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  private isAdjacent(a: Position, b: Position): boolean {
    return Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1
  }

  private findPreyInTerritory(pack: Pack, allCreatures: Creature[]): Creature | undefined {
    return allCreatures.find(
      c =>
        (c.templateId === 'deer' || c.templateId === 'rabbit') &&
        this.distance(c.position, pack.territoryCenter) <= pack.territoryRadius &&
        c.state !== 'dead'
    )
  }

  private findRaidTarget(pack: Pack, allCreatures: Creature[]): Creature | undefined {
    const targets = allCreatures.filter(
      c =>
        !c.packId &&
        this.distance(c.position, pack.territoryCenter) <= pack.territoryRadius * 1.5 &&
        c.state !== 'dead'
    )
    return targets.length > 0 ? targets[0] : undefined
  }

  private countFlankingWolves(members: Creature[], targetPos: Position): number {
    let count = 0
    for (const member of members) {
      const dist = this.distance(member.position, targetPos)
      if (dist <= 2) count++
    }
    return count
  }

  private packTypeToTemplateId(packType: Pack['packType']): string {
    switch (packType) {
      case 'wolf_pack':
        return 'wolf'
      case 'goblin_tribe':
        return 'goblin'
      case 'bandit_gang':
        return 'bandit'
      case 'orc_warband':
        return 'orc'
    }
  }

  private getPackDisplayName(pack: Pack, leader: Creature | undefined): string {
    const leaderName = leader?.customName || leader?.name || 'Unknown'
    switch (pack.packType) {
      case 'wolf_pack':
        return `Wolf Pack of ${leaderName}`
      case 'goblin_tribe':
        return `Goblin Tribe of ${leaderName}`
      case 'bandit_gang':
        return `${leaderName}'s Bandit Gang`
      case 'orc_warband':
        return `${leaderName}'s Warband`
    }
  }

  private getPackMemberDescription(pack: Pack, members: Creature[]): string {
    switch (pack.packType) {
      case 'wolf_pack':
        return `(alpha, ${members.length - 1} pack members)`
      case 'goblin_tribe': {
        const scouts = members.filter(c => c.stats.agility > c.stats.strength).length
        const warriors = members.length - scouts - 1
        return `(chief, ${warriors} warriors, ${scouts} scouts)`
      }
      case 'bandit_gang':
        return `(leader, ${members.length - 1} bandits)`
      case 'orc_warband':
        return `(warchief, ${members.length - 1} warriors)`
    }
  }
}
