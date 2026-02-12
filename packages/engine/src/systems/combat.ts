import type {
  Monster, MonsterType, MonsterTemplate, CombatState, CombatRound,
  CombatOutcome, LootEntry, Position, Item, WorldClock,
} from '@botworld/shared'
import { generateId } from '@botworld/shared'
import { EventBus } from '../core/event-bus.js'
import { TileMap } from '../world/tile-map.js'
import type { ItemManager } from '../items/item-manager.js'

// ── Monster Templates ──

const MONSTER_TEMPLATES: MonsterTemplate[] = [
  {
    type: 'slime',
    name: '슬라임',
    baseHp: 30, baseAttack: 4, baseDefense: 1,
    aggroRadius: 3, respawnTicks: 120,
    loot: [{ itemType: 'slime_gel', chance: 0.6, quantityMin: 1, quantityMax: 2 }],
    minLevel: 1, weight: 30,
  },
  {
    type: 'goblin',
    name: '고블린',
    baseHp: 45, baseAttack: 7, baseDefense: 3,
    aggroRadius: 5, respawnTicks: 180,
    loot: [
      { itemType: 'gold_coin', chance: 0.5, quantityMin: 1, quantityMax: 5 },
      { itemType: 'rusty_dagger', chance: 0.15, quantityMin: 1, quantityMax: 1 },
    ],
    minLevel: 1, weight: 25,
  },
  {
    type: 'wolf',
    name: '늑대',
    baseHp: 50, baseAttack: 9, baseDefense: 2,
    aggroRadius: 6, respawnTicks: 200,
    loot: [
      { itemType: 'wolf_pelt', chance: 0.5, quantityMin: 1, quantityMax: 1 },
      { itemType: 'raw_meat', chance: 0.7, quantityMin: 1, quantityMax: 2 },
    ],
    minLevel: 2, weight: 20,
  },
  {
    type: 'skeleton',
    name: '스켈레톤',
    baseHp: 55, baseAttack: 8, baseDefense: 5,
    aggroRadius: 5, respawnTicks: 240,
    loot: [
      { itemType: 'bone', chance: 0.6, quantityMin: 1, quantityMax: 3 },
      { itemType: 'old_shield', chance: 0.1, quantityMin: 1, quantityMax: 1 },
    ],
    minLevel: 3, weight: 15,
  },
  {
    type: 'bandit',
    name: '산적',
    baseHp: 70, baseAttack: 11, baseDefense: 6,
    aggroRadius: 7, respawnTicks: 300,
    loot: [
      { itemType: 'gold_coin', chance: 0.8, quantityMin: 3, quantityMax: 10 },
      { itemType: 'iron_sword', chance: 0.1, quantityMin: 1, quantityMax: 1 },
    ],
    minLevel: 4, weight: 12,
  },
  {
    type: 'troll',
    name: '트롤',
    baseHp: 120, baseAttack: 14, baseDefense: 8,
    aggroRadius: 4, respawnTicks: 400,
    loot: [
      { itemType: 'troll_hide', chance: 0.4, quantityMin: 1, quantityMax: 1 },
      { itemType: 'club', chance: 0.2, quantityMin: 1, quantityMax: 1 },
    ],
    minLevel: 6, weight: 8,
  },
  {
    type: 'ghost',
    name: '유령',
    baseHp: 60, baseAttack: 12, baseDefense: 10,
    aggroRadius: 5, respawnTicks: 360,
    loot: [
      { itemType: 'ectoplasm', chance: 0.5, quantityMin: 1, quantityMax: 2 },
      { itemType: 'spirit_essence', chance: 0.1, quantityMin: 1, quantityMax: 1 },
    ],
    minLevel: 5, weight: 10,
  },
  {
    type: 'dragon_whelp',
    name: '새끼 드래곤',
    baseHp: 150, baseAttack: 18, baseDefense: 12,
    aggroRadius: 8, respawnTicks: 600,
    loot: [
      { itemType: 'dragon_scale', chance: 0.3, quantityMin: 1, quantityMax: 2 },
      { itemType: 'dragon_tooth', chance: 0.15, quantityMin: 1, quantityMax: 1 },
      { itemType: 'gold_coin', chance: 0.9, quantityMin: 10, quantityMax: 30 },
    ],
    minLevel: 8, weight: 3,
  },
]

// ── Helpers ──

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function rollLootLegacy(entries: LootEntry[]): Item[] {
  const items: Item[] = []
  for (const entry of entries) {
    if (Math.random() < entry.chance) {
      items.push({
        id: generateId(),
        type: 'crafted',
        name: entry.itemType.replace(/_/g, ' '),
        rarity: 'common',
        quantity: randomInt(entry.quantityMin, entry.quantityMax),
      })
    }
  }
  return items
}

function scaleMonster(template: MonsterTemplate, level: number): Omit<Monster, 'id' | 'position'> {
  const scale = 1 + (level - 1) * 0.15
  return {
    type: template.type,
    name: `${template.name} Lv${level}`,
    level,
    hp: Math.round(template.baseHp * scale),
    maxHp: Math.round(template.baseHp * scale),
    attack: Math.round(template.baseAttack * scale),
    defense: Math.round(template.baseDefense * scale),
    loot: template.loot,
    aggroRadius: template.aggroRadius,
    respawnTicks: template.respawnTicks,
    isDead: false,
    deathTick: null,
  }
}

// ── Combat System ──

const MAX_MONSTERS = 20
const SPAWN_INTERVAL_TICKS = 60
const SPAWN_CHANCE = 0.4
const MAX_COMBAT_ROUNDS = 10
const FLEE_SUCCESS_CHANCE = 0.6

export class CombatSystem {
  private eventBus: EventBus
  private tileMap: TileMap
  private clockGetter: () => WorldClock
  private itemManager: ItemManager | null = null

  private monsters: Map<string, Monster> = new Map()
  private activeCombats: Map<string, CombatState> = new Map()
  private lastSpawnTick = 0

  constructor(eventBus: EventBus, tileMap: TileMap, clockGetter: () => WorldClock) {
    this.eventBus = eventBus
    this.tileMap = tileMap
    this.clockGetter = clockGetter
  }

  setItemManager(manager: ItemManager): void {
    this.itemManager = manager
  }

  tick(clock: WorldClock): void {
    // Respawn dead monsters
    for (const [id, monster] of this.monsters) {
      if (monster.isDead && monster.deathTick !== null) {
        if (clock.tick - monster.deathTick >= monster.respawnTicks) {
          monster.isDead = false
          monster.hp = monster.maxHp
          monster.deathTick = null
          this.eventBus.emit({
            type: 'monster:spawned',
            monsterId: monster.id,
            monsterType: monster.type,
            name: monster.name,
            level: monster.level,
            position: monster.position,
            timestamp: clock.tick,
          })
        }
      }
    }

    // Spawn new monsters periodically
    if (clock.tick - this.lastSpawnTick >= SPAWN_INTERVAL_TICKS) {
      this.lastSpawnTick = clock.tick
      const aliveCount = [...this.monsters.values()].filter(m => !m.isDead).length
      if (aliveCount < MAX_MONSTERS && Math.random() < SPAWN_CHANCE) {
        this.spawnRandomMonster(clock)
      }
    }
  }

  private spawnRandomMonster(clock: WorldClock): void {
    // Pick spawn position from existing chunks
    const chunks = this.tileMap.getSerializableChunks()
    const chunkKeys = Object.keys(chunks)
    if (chunkKeys.length === 0) return

    const randomChunk = chunks[chunkKeys[randomInt(0, chunkKeys.length - 1)]]
    if (!randomChunk) return

    // Find a walkable tile in the chunk
    const pos: Position = {
      x: randomChunk.cx * 16 + randomInt(2, 13),
      y: randomChunk.cy * 16 + randomInt(2, 13),
    }

    const tile = this.tileMap.getTile(pos.x, pos.y)
    if (!tile || tile.type === 'water' || tile.type === 'deep_water' || tile.type === 'mountain') return

    // Pick monster type weighted
    const totalWeight = MONSTER_TEMPLATES.reduce((sum, t) => sum + t.weight, 0)
    let roll = Math.random() * totalWeight
    let template = MONSTER_TEMPLATES[0]
    for (const t of MONSTER_TEMPLATES) {
      roll -= t.weight
      if (roll <= 0) {
        template = t
        break
      }
    }

    const level = Math.max(template.minLevel, randomInt(template.minLevel, template.minLevel + 3))
    const id = generateId()
    const scaled = scaleMonster(template, level)

    const monster: Monster = {
      id,
      ...scaled,
      position: pos,
    }

    this.monsters.set(id, monster)

    this.eventBus.emit({
      type: 'monster:spawned',
      monsterId: id,
      monsterType: monster.type,
      name: monster.name,
      level: monster.level,
      position: pos,
      timestamp: clock.tick,
    })
  }

  /** Spawn a monster at a specific position (used by world events) */
  spawnMonsterAt(position: Position, minLevel?: number, preferredType?: MonsterType): Monster {
    const clock = this.clockGetter()

    // Pick template
    let template: MonsterTemplate
    if (preferredType) {
      template = MONSTER_TEMPLATES.find(t => t.type === preferredType) ?? MONSTER_TEMPLATES[0]
    } else {
      // Weighted random, but filter by minLevel
      const candidates = MONSTER_TEMPLATES.filter(t => t.minLevel >= (minLevel ?? 1))
      if (candidates.length === 0) {
        template = MONSTER_TEMPLATES[MONSTER_TEMPLATES.length - 1]
      } else {
        const totalWeight = candidates.reduce((sum, t) => sum + t.weight, 0)
        let roll = Math.random() * totalWeight
        template = candidates[0]
        for (const t of candidates) {
          roll -= t.weight
          if (roll <= 0) { template = t; break }
        }
      }
    }

    const level = Math.max(template.minLevel, minLevel ?? template.minLevel)
    const id = generateId()
    const scaled = scaleMonster(template, level + randomInt(0, 2))

    const monster: Monster = { id, ...scaled, position }
    this.monsters.set(id, monster)

    this.eventBus.emit({
      type: 'monster:spawned',
      monsterId: id,
      monsterType: monster.type,
      name: monster.name,
      level: monster.level,
      position,
      timestamp: clock.tick,
    })

    return monster
  }

  /** Start combat between an agent and a nearby monster */
  startCombat(
    agentId: string,
    agentAttack: number,
    agentDefense: number,
    agentHp: number,
    monsterId: string,
  ): CombatState | null {
    const monster = this.monsters.get(monsterId)
    if (!monster || monster.isDead) return null

    // Check if agent already in combat
    if (this.getAgentCombat(agentId)) return null

    const combatId = generateId()
    const clock = this.clockGetter()

    const combat: CombatState = {
      id: combatId,
      agentId,
      monsterId,
      monsterType: monster.type,
      monsterName: monster.name,
      rounds: [],
      outcome: null,
      lootDropped: [],
      startedAt: clock.tick,
    }

    this.activeCombats.set(combatId, combat)

    this.eventBus.emit({
      type: 'combat:started',
      combatId,
      agentId,
      monsterId,
      monsterType: monster.type,
      monsterName: monster.name,
      position: monster.position,
      timestamp: clock.tick,
    })

    // Auto-resolve combat rounds
    this.resolveCombat(combat, agentAttack, agentDefense, agentHp, monster)

    return combat
  }

  private resolveCombat(
    combat: CombatState,
    agentAttack: number,
    agentDefense: number,
    agentHp: number,
    monster: Monster,
  ): void {
    const clock = this.clockGetter()
    let currentAgentHp = agentHp
    let currentMonsterHp = monster.hp

    for (let round = 1; round <= MAX_COMBAT_ROUNDS; round++) {
      // Agent attacks monster
      const agentDmg = Math.max(1, agentAttack - monster.defense + randomInt(-2, 2))
      currentMonsterHp -= agentDmg

      // Monster attacks agent
      const monsterDmg = Math.max(1, monster.attack - agentDefense + randomInt(-2, 2))
      currentAgentHp -= monsterDmg

      const combatRound: CombatRound = {
        round,
        agentDamage: agentDmg,
        monsterDamage: monsterDmg,
        agentHp: Math.max(0, currentAgentHp),
        monsterHp: Math.max(0, currentMonsterHp),
        description: `라운드 ${round}: 에이전트가 ${agentDmg} 피해, 몬스터가 ${monsterDmg} 피해`,
      }

      combat.rounds.push(combatRound)

      this.eventBus.emit({
        type: 'combat:round',
        combatId: combat.id,
        agentId: combat.agentId,
        monsterId: combat.monsterId,
        round: combatRound,
        timestamp: clock.tick,
      })

      // Check for death
      if (currentMonsterHp <= 0) {
        combat.outcome = 'victory'
        break
      }
      if (currentAgentHp <= 0) {
        combat.outcome = 'defeat'
        break
      }
    }

    // If max rounds exceeded with no winner, it's a draw (agent flees)
    if (!combat.outcome) {
      combat.outcome = 'fled'
    }

    // Process outcome
    if (combat.outcome === 'victory') {
      monster.isDead = true
      monster.hp = 0
      monster.deathTick = clock.tick

      combat.lootDropped = this.rollLoot(monster)

      this.eventBus.emit({
        type: 'monster:died',
        monsterId: monster.id,
        monsterType: monster.type,
        killedBy: combat.agentId,
        position: monster.position,
        timestamp: clock.tick,
      })
    }

    const xpGained = combat.outcome === 'victory'
      ? monster.level * 15 + randomInt(5, 15)
      : combat.outcome === 'defeat' ? 0 : Math.round(monster.level * 3)

    this.eventBus.emit({
      type: 'combat:ended',
      combatId: combat.id,
      agentId: combat.agentId,
      monsterId: combat.monsterId,
      outcome: combat.outcome,
      loot: combat.lootDropped,
      xpGained,
      timestamp: clock.tick,
    })

    // Clean up active combat after resolving
    this.activeCombats.delete(combat.id)

    return
  }

  /** Attempt to flee combat */
  attemptFlee(agentId: string): { success: boolean; combat: CombatState | null } {
    const combat = this.getAgentCombat(agentId)
    if (!combat) return { success: false, combat: null }

    const success = Math.random() < FLEE_SUCCESS_CHANCE
    if (success) {
      combat.outcome = 'fled'
      const clock = this.clockGetter()

      this.eventBus.emit({
        type: 'combat:ended',
        combatId: combat.id,
        agentId: combat.agentId,
        monsterId: combat.monsterId,
        outcome: 'fled',
        loot: [],
        xpGained: 0,
        timestamp: clock.tick,
      })

      this.activeCombats.delete(combat.id)
    }

    return { success, combat }
  }

  /** Get combat state for an agent */
  getAgentCombat(agentId: string): CombatState | null {
    for (const combat of this.activeCombats.values()) {
      if (combat.agentId === agentId) return combat
    }
    return null
  }

  /** Get all alive monsters */
  getAliveMonsters(): Monster[] {
    return [...this.monsters.values()].filter(m => !m.isDead)
  }

  /** Get all monsters (including dead, for respawn tracking) */
  getAllMonsters(): Monster[] {
    return [...this.monsters.values()]
  }

  /** Get a specific monster */
  getMonster(id: string): Monster | undefined {
    return this.monsters.get(id)
  }

  /** Get monsters near a position */
  getMonstersNear(pos: Position, radius: number): Monster[] {
    return this.getAliveMonsters().filter(m => {
      const dx = m.position.x - pos.x
      const dy = m.position.y - pos.y
      return Math.sqrt(dx * dx + dy * dy) <= radius
    })
  }

  /** Get active combats */
  getActiveCombats(): CombatState[] {
    return [...this.activeCombats.values()]
  }

  /** Roll loot — creates RichItems with DroppedProvenance when ItemManager is available */
  private rollLoot(monster: Monster): Item[] {
    if (!this.itemManager) {
      return rollLootLegacy(monster.loot)
    }

    const items: Item[] = []
    for (const entry of monster.loot) {
      if (Math.random() < entry.chance) {
        const quantity = randomInt(entry.quantityMin, entry.quantityMax)
        const richItem = this.itemManager.createItem(
          entry.itemType,
          {
            origin: 'dropped',
            dropped_by: monster.name,
            dropped_at: this.clockGetter().tick,
          },
          { ownerId: undefined },
        )
        if (richItem) {
          items.push({
            id: richItem.id,
            type: 'crafted',
            name: richItem.customName ?? richItem.name,
            quantity,
            rarity: 'common',
            durability: richItem.durability,
            maxDurability: richItem.maxDurability,
            richItemId: richItem.id,
          })
        } else {
          // Fallback for unknown templates
          items.push({
            id: generateId(),
            type: 'crafted',
            name: entry.itemType.replace(/_/g, ' '),
            rarity: 'common',
            quantity,
          })
        }
      }
    }
    return items
  }
}
