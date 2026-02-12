import type { Building, BuildingType, SiegeWeaponType, WorldClock } from '@botworld/shared'
import { generateId } from '@botworld/shared'
import type { EventBus } from '../core/event-bus.js'

// ── Siege Weapon Data ──

interface SiegeWeaponData {
  type: SiegeWeaponType
  hp: number
  damage: number
  attackInterval: number  // ticks between attacks
  targetPreference: BuildingType[]
  specialEffect?: 'breach' | 'fire'
}

const SIEGE_WEAPONS: Record<SiegeWeaponType, SiegeWeaponData> = {
  catapult: {
    type: 'catapult',
    hp: 100,
    damage: 50,
    attackInterval: 5,
    targetPreference: ['wall_section', 'watchtower', 'barracks'],
    specialEffect: undefined,
  },
  battering_ram: {
    type: 'battering_ram',
    hp: 150,
    damage: 80,
    attackInterval: 3,
    targetPreference: ['gate', 'wall_section'],
    specialEffect: undefined,
  },
  fire_arrows: {
    type: 'fire_arrows',
    hp: 50,
    damage: 30,
    attackInterval: 2,
    targetPreference: ['hut', 'cottage', 'house', 'tavern', 'workshop'],
    specialEffect: 'fire',
  },
  siege_ladder: {
    type: 'siege_ladder',
    hp: 80,
    damage: 0,
    attackInterval: 10,
    targetPreference: ['wall_section'],
    specialEffect: 'breach',
  },
}

// ── Siege Interface ──

export interface SiegeWeaponInstance {
  type: SiegeWeaponType
  hp: number
  maxHp: number
  lastAttackTick: number
}

export interface Siege {
  id: string
  attackerId: string        // kingdom or guild ID
  attackerName: string
  defenderId: string        // settlement ID
  defenderName: string
  position: { x: number; y: number }
  status: 'preparing' | 'active' | 'resolved'
  startedAt: number
  weapons: SiegeWeaponInstance[]
  attackerForce: number     // number of attackers
  defenderForce: number     // number of defenders
  targetBuildings: string[] // building IDs being attacked
  breached: boolean         // has wall been breached
  battleLog: { tick: number; event: string }[]
  ladderProgress: number    // ticks spent on ladder breach attempt
}

// ── Building Manager Interface (expected to exist) ──

export interface BuildingManager {
  damageBuilding(buildingId: string, damage: number, source: string): void
  getBuilding(id: string): Building | undefined
  getBuildingsInSettlement(settlementId: string): Building[]
  destroyBuilding(buildingId: string, destroyedBy: string): void
}

// ── Siege System ──

export class SiegeSystem {
  private sieges = new Map<string, Siege>()

  constructor(private eventBus: EventBus) {}

  startSiege(
    attackerId: string,
    attackerName: string,
    defenderId: string,
    defenderName: string,
    position: { x: number; y: number },
    force: number,
    weapons: { type: SiegeWeaponType; count: number }[],
    tick: number
  ): Siege {
    const weaponInstances: SiegeWeaponInstance[] = []

    for (const weapon of weapons) {
      const data = SIEGE_WEAPONS[weapon.type]
      for (let i = 0; i < weapon.count; i++) {
        weaponInstances.push({
          type: weapon.type,
          hp: data.hp,
          maxHp: data.hp,
          lastAttackTick: tick,
        })
      }
    }

    const siege: Siege = {
      id: generateId(),
      attackerId,
      attackerName,
      defenderId,
      defenderName,
      position,
      status: 'preparing',
      startedAt: tick,
      weapons: weaponInstances,
      attackerForce: force,
      defenderForce: 0, // will be calculated from defenders
      targetBuildings: [],
      breached: false,
      battleLog: [{ tick, event: `${attackerName} begins siege of ${defenderName}` }],
      ladderProgress: 0,
    }

    this.sieges.set(siege.id, siege)

    this.eventBus.emit({
      type: 'siege:started',
      siegeId: siege.id,
      attackerId,
      defenderId,
      position,
      timestamp: Date.now(),
    })

    return siege
  }

  tick(clock: WorldClock, buildingManager: BuildingManager): void {
    for (const siege of this.sieges.values()) {
      if (siege.status !== 'active' && siege.status !== 'preparing') continue

      // Transition from preparing to active after 1 tick
      if (siege.status === 'preparing') {
        siege.status = 'active'
        this.logEvent(siege, clock.tick, `Siege becomes active`)
        continue
      }

      // Get military buildings in defender settlement
      const defenderBuildings = buildingManager.getBuildingsInSettlement(siege.defenderId)
      const walls = defenderBuildings.filter(b => b.type === 'wall_section' && b.state === 'active')
      const gates = defenderBuildings.filter(b => b.type === 'gate' && b.state === 'active')
      const watchtowers = defenderBuildings.filter(b => b.type === 'watchtower' && b.state === 'active')
      const guildHalls = defenderBuildings.filter(b => b.type === 'guild_hall' && b.state === 'active')

      // Update defender force based on military buildings
      siege.defenderForce = Math.max(1, walls.length * 2 + watchtowers.length * 3)

      // Check if walls are still standing
      const wallsStanding = walls.length > 0 || gates.length > 0

      // ── Attacker Actions ──

      // Process each siege weapon
      const activeWeapons = siege.weapons.filter(w => w.hp > 0)

      for (const weapon of activeWeapons) {
        const weaponData = SIEGE_WEAPONS[weapon.type]
        const ticksSinceLastAttack = clock.tick - weapon.lastAttackTick

        if (ticksSinceLastAttack < weaponData.attackInterval) continue

        // Siege ladder special handling
        if (weapon.type === 'siege_ladder' && wallsStanding && !siege.breached) {
          siege.ladderProgress++
          weapon.lastAttackTick = clock.tick

          if (siege.ladderProgress >= 10) {
            siege.breached = true
            this.logEvent(siege, clock.tick, `Siege ladders allow attackers to breach defenses!`)
          } else {
            this.logEvent(siege, clock.tick, `Ladders advance (${siege.ladderProgress}/10)`)
          }
          continue
        }

        // Find target buildings
        let targets: Building[] = []

        if (!siege.breached && wallsStanding) {
          // Attack walls and gates first
          targets = [...walls, ...gates].filter(b =>
            weaponData.targetPreference.includes(b.type)
          )
          if (targets.length === 0) {
            targets = [...walls, ...gates] // any defensive structure
          }
        } else {
          // Breach achieved - attack inner buildings
          if (guildHalls.length > 0) {
            targets = guildHalls
          } else {
            targets = defenderBuildings.filter(b =>
              b.state === 'active' && weaponData.targetPreference.includes(b.type)
            )
            if (targets.length === 0) {
              targets = defenderBuildings.filter(b => b.state === 'active')
            }
          }
        }

        if (targets.length > 0) {
          const target = targets[Math.floor(Math.random() * targets.length)]
          buildingManager.damageBuilding(target.id, weaponData.damage, `${weapon.type} (${siege.attackerName})`)
          weapon.lastAttackTick = clock.tick

          const targetInfo = buildingManager.getBuilding(target.id)
          const destroyed = !targetInfo || targetInfo.state === 'destroyed'

          this.logEvent(
            siege,
            clock.tick,
            `${weapon.type} attacks ${target.name} for ${weaponData.damage} damage${destroyed ? ' - DESTROYED!' : ''}`
          )

          if (destroyed && target.type === 'gate') {
            siege.breached = true
            this.logEvent(siege, clock.tick, `Gate destroyed - defenses breached!`)
          }

          if (destroyed && target.type === 'wall_section') {
            const wallsRemaining = buildingManager.getBuildingsInSettlement(siege.defenderId)
              .filter(b => b.type === 'wall_section' && b.state === 'active').length

            if (wallsRemaining === 0 && gates.length === 0) {
              siege.breached = true
              this.logEvent(siege, clock.tick, `All walls destroyed - defenses breached!`)
            }
          }

          if (!siege.targetBuildings.includes(target.id)) {
            siege.targetBuildings.push(target.id)
          }
        }
      }

      // ── Defender Actions ──

      // Watchtowers counter-attack siege weapons
      for (const tower of watchtowers) {
        if (activeWeapons.length === 0) break
        if (clock.tick % 4 !== 0) continue // attack every 4 ticks

        const target = activeWeapons[Math.floor(Math.random() * activeWeapons.length)]
        const damage = 15
        target.hp = Math.max(0, target.hp - damage)

        if (target.hp === 0) {
          this.logEvent(siege, clock.tick, `Watchtower destroys ${target.type}`)
        } else {
          this.logEvent(siege, clock.tick, `Watchtower damages ${target.type} (${target.hp}/${target.maxHp} HP)`)
        }
      }

      // Wall defenders reduce attacker force
      if (wallsStanding && !siege.breached && clock.tick % 10 === 0) {
        const defenderStrength = walls.length + gates.length
        if (defenderStrength > 0 && siege.attackerForce > 0) {
          siege.attackerForce = Math.max(0, siege.attackerForce - 1)
          this.logEvent(siege, clock.tick, `Defenders repel attackers (force: ${siege.attackerForce})`)
        }
      }

      // ── Victory Conditions ──

      const guildHallDestroyed = guildHalls.length === 0 ||
        guildHalls.every(gh => {
          const current = buildingManager.getBuilding(gh.id)
          return !current || current.state === 'destroyed'
        })

      if (guildHallDestroyed && siege.breached) {
        this.endSiege(siege.id, 'attacker_won', clock.tick)
        continue
      }

      // Defender victory: all weapons destroyed and force exhausted
      if (activeWeapons.length === 0 && siege.attackerForce <= 0) {
        this.endSiege(siege.id, 'defender_won', clock.tick)
        continue
      }

      // Stalemate after 200 ticks
      const siegeDuration = clock.tick - siege.startedAt
      if (siegeDuration >= 200) {
        this.endSiege(siege.id, 'draw', clock.tick)
        continue
      }
    }
  }

  endSiege(
    siegeId: string,
    result: 'attacker_won' | 'defender_won' | 'draw' | 'abandoned',
    tick: number
  ): void {
    const siege = this.sieges.get(siegeId)
    if (!siege) return

    siege.status = 'resolved'

    const resultMessages = {
      attacker_won: `${siege.attackerName} conquers ${siege.defenderName}!`,
      defender_won: `${siege.defenderName} successfully defends against ${siege.attackerName}`,
      draw: `Siege of ${siege.defenderName} ends in stalemate`,
      abandoned: `${siege.attackerName} abandons siege of ${siege.defenderName}`,
    }

    this.logEvent(siege, tick, resultMessages[result])

    this.eventBus.emit({
      type: 'siege:ended',
      siegeId,
      result,
      timestamp: Date.now(),
    })
  }

  getSiege(id: string): Siege | undefined {
    return this.sieges.get(id)
  }

  getActiveSieges(): Siege[] {
    return Array.from(this.sieges.values()).filter(s => s.status === 'active')
  }

  getSiegesAtSettlement(settlementId: string): Siege[] {
    return Array.from(this.sieges.values()).filter(s => s.defenderId === settlementId)
  }

  formatBattleReport(siegeId: string): string {
    const siege = this.sieges.get(siegeId)
    if (!siege) return 'Siege not found'

    const lines: string[] = []
    lines.push(`═══ SIEGE REPORT: ${siege.attackerName} vs ${siege.defenderName} ═══`)
    lines.push(`Status: ${siege.status.toUpperCase()}`)
    lines.push(`Duration: ${siege.battleLog[siege.battleLog.length - 1].tick - siege.startedAt} ticks`)
    lines.push(`Breach Status: ${siege.breached ? 'BREACHED' : 'HOLDING'}`)
    lines.push(`\nAttacker Force: ${siege.attackerForce}`)
    lines.push(`Defender Force: ${siege.defenderForce}`)
    lines.push(`\nActive Siege Weapons: ${siege.weapons.filter(w => w.hp > 0).length}/${siege.weapons.length}`)

    for (const weapon of siege.weapons) {
      if (weapon.hp > 0) {
        lines.push(`  - ${weapon.type}: ${weapon.hp}/${weapon.maxHp} HP`)
      } else {
        lines.push(`  - ${weapon.type}: DESTROYED`)
      }
    }

    lines.push(`\n─── Battle Log ───`)
    for (const entry of siege.battleLog) {
      lines.push(`[Tick ${entry.tick}] ${entry.event}`)
    }

    return lines.join('\n')
  }

  private logEvent(siege: Siege, tick: number, event: string): void {
    siege.battleLog.push({ tick, event })
  }
}
