import type { Agent, NpcRole, Position, WorldClock, Item } from '@botworld/shared'
import {
  generateId, createEmotionState, createRandomPersonality,
  DEFAULT_MAX_HP, DEFAULT_MAX_ENERGY, DEFAULT_MAX_HUNGER,
} from '@botworld/shared'
import type { PointOfInterest } from '../world/tile-map.js'
import { EventBus } from '../core/event-bus.js'
import { TileMap } from '../world/tile-map.js'
import { findPath } from '../world/pathfinding.js'

// ── NPC dialogue pools ──

const MERCHANT_LINES = [
  'Welcome! What would you like to buy?',
  'Fine goods at fair prices!',
  'Take a look at my wares.',
  'Everything must go! Well, almost everything.',
  'I just got a fresh shipment. Come see!',
  'Need supplies? You came to the right place.',
]

const INNKEEPER_LINES = [
  'Welcome, traveler! Rest your weary bones.',
  'A warm meal and a soft bed, that is what you need.',
  'Can I get you something to eat?',
  'You look exhausted. Stay a while.',
  'The stew is fresh today. Best in the region!',
]

const INNKEEPER_RUMOR_TEMPLATES = [
  'I heard rare herbs were spotted in the northern forest...',
  'A merchant was bragging about a big gold strike near the mines.',
  'Some travelers mentioned strange sounds from the deep woods.',
  'Word is the marketplace has new stock this season.',
  'A wanderer told me about rich iron deposits to the east.',
  'The farmers had an amazing harvest this year.',
]

const GUILD_MASTER_LINES = [
  'Greetings, adventurer. Seeking glory?',
  'The guild always needs capable hands.',
  'Keep honing your skills. They will serve you well.',
  'Come back when you are stronger. I may have work for you.',
  'Dedication is the path to mastery.',
]

const WANDERER_LINES = [
  'The roads are long, but the world is beautiful.',
  'I have seen many things on my travels...',
  'Be careful near the mountains. The terrain is treacherous.',
  'Have you visited the tavern? Great stew.',
  'The forest has plenty of herbs if you know where to look.',
  'I passed by a mine on my way here. Looked productive.',
]

const GUARD_LINES = [
  'Stay safe out there, traveler.',
  'All is well in this area.',
  'The roads are mostly safe, but watch for wildlife.',
  'New here? The marketplace is that way.',
  'Keep your wits about you in the wilderness.',
]

const DIALOGUE_POOLS: Record<NpcRole, string[]> = {
  merchant: MERCHANT_LINES,
  innkeeper: INNKEEPER_LINES,
  guild_master: GUILD_MASTER_LINES,
  wanderer: WANDERER_LINES,
  guard: GUARD_LINES,
}

// ── NPC names ──

const NPC_NAMES: Record<NpcRole, string[]> = {
  merchant: ['Marcus the Merchant', 'Trader Nessa', 'Shopkeep Bram', 'Vendor Yara'],
  innkeeper: ['Helga the Innkeeper', 'Barkeep Torin', 'Hostess Mae', 'Keeper Sven'],
  guild_master: ['Guildmaster Aldric', 'Master Freya', 'Commander Orin'],
  wanderer: ['Wanderer Kael', 'Nomad Lyra', 'Traveler Finn', 'Rover Ashlyn', 'Drifter Cade'],
  guard: ['Guard Captain Rolf', 'Sentinel Mira', 'Watchman Beric', 'Patrol Thea'],
}

// ── Merchant shop stock ──

interface ShopItem {
  name: string
  type: Item['type']
  price: number
}

const MERCHANT_STOCK: ShopItem[] = [
  { name: 'Bread', type: 'food', price: 5 },
  { name: 'Healing Potion', type: 'food', price: 15 },
  { name: 'Iron Pickaxe', type: 'tool', price: 25 },
  { name: 'Rope', type: 'material', price: 8 },
  { name: 'Torch', type: 'tool', price: 3 },
  { name: 'Herb Bundle', type: 'material', price: 10 },
]

const INNKEEPER_MENU: ShopItem[] = [
  { name: 'Hot Stew', type: 'food', price: 8 },
  { name: 'Ale', type: 'food', price: 4 },
  { name: 'Trail Rations', type: 'food', price: 6 },
]

// ── NPC runtime state ──

interface NpcRuntime {
  agent: Agent
  role: NpcRole
  homePosition: Position
  /** For wanderers: current path between POIs */
  path: Position[]
  pathIndex: number
  /** Tick when last line of dialogue was spoken */
  lastSpokeTick: number
  /** Cooldown in ticks between idle chatter */
  chatterCooldown: number
  /** For wanderers: next POI target index */
  wanderTargetIndex: number
}

export class NpcManager {
  private npcs = new Map<string, NpcRuntime>()
  private nameCounters: Record<NpcRole, number> = {
    merchant: 0, innkeeper: 0, guild_master: 0, wanderer: 0, guard: 0,
  }

  constructor(
    private eventBus: EventBus,
    private tileMap: TileMap,
    private clockGetter: () => WorldClock,
  ) {}

  /** Spawn NPCs at POIs after world generation */
  spawnFromPOIs(pois: PointOfInterest[]): Agent[] {
    const spawned: Agent[] = []

    for (const poi of pois) {
      // Merchant at marketplaces
      if (poi.type === 'marketplace') {
        spawned.push(this.spawnNpc('merchant', poi.position, poi))
      }
      // Innkeeper at taverns
      if (poi.type === 'tavern') {
        spawned.push(this.spawnNpc('innkeeper', poi.position, poi))
      }
      // Guard at major POIs (marketplace, tavern, workshop)
      if (['marketplace', 'tavern', 'workshop'].includes(poi.type)) {
        spawned.push(this.spawnNpc('guard', {
          x: poi.position.x + 1,
          y: poi.position.y + 1,
        }, poi))
      }
    }

    // Spawn wanderers (3-5, roaming between POIs)
    const wandererCount = Math.min(5, Math.max(3, Math.floor(pois.length / 2)))
    for (let i = 0; i < wandererCount; i++) {
      const startPoi = pois[i % pois.length]
      spawned.push(this.spawnNpc('wanderer', { ...startPoi.position }, startPoi))
    }

    // Guild master at first library (closest to guild_hall concept)
    const library = pois.find(p => p.type === 'library')
    if (library) {
      spawned.push(this.spawnNpc('guild_master', library.position, library))
    }

    console.log(`[NpcManager] Spawned ${spawned.length} NPCs`)
    return spawned
  }

  private spawnNpc(role: NpcRole, position: Position, _poi: PointOfInterest): Agent {
    const id = generateId('npc')
    const nameList = NPC_NAMES[role]
    const name = nameList[this.nameCounters[role] % nameList.length]
    this.nameCounters[role]++

    const agent: Agent = {
      id,
      name,
      position: { ...position },
      stats: {
        hp: DEFAULT_MAX_HP,
        maxHp: DEFAULT_MAX_HP,
        energy: DEFAULT_MAX_ENERGY,
        maxEnergy: DEFAULT_MAX_ENERGY,
        hunger: DEFAULT_MAX_HUNGER,
        maxHunger: DEFAULT_MAX_HUNGER,
      },
      level: role === 'guild_master' ? 10 : role === 'guard' ? 5 : 3,
      xp: 0,
      skills: {
        gathering: 1, crafting: 1, combat: role === 'guard' ? 8 : 1,
        diplomacy: role === 'merchant' ? 8 : role === 'innkeeper' ? 6 : 3,
        leadership: role === 'guild_master' ? 10 : 1,
        trading: role === 'merchant' ? 10 : 1,
        farming: 1, cooking: role === 'innkeeper' ? 8 : 1,
      },
      inventory: this.createNpcInventory(role),
      memories: [],
      relationships: {},
      personality: createRandomPersonality(),
      currentMood: createEmotionState(),
      currentAction: null,
      bio: this.createNpcBio(role, name),
      isNpc: true,
      npcRole: role,
    }

    const runtime: NpcRuntime = {
      agent,
      role,
      homePosition: { ...position },
      path: [],
      pathIndex: 0,
      lastSpokeTick: 0,
      chatterCooldown: 60 + Math.floor(Math.random() * 120), // 1-3 minutes
      wanderTargetIndex: 0,
    }

    this.npcs.set(id, runtime)

    this.eventBus.emit({
      type: 'agent:spawned',
      agent,
      timestamp: this.clockGetter().tick,
    })

    return agent
  }

  private createNpcInventory(role: NpcRole): Item[] {
    switch (role) {
      case 'merchant':
        return MERCHANT_STOCK.map(s => ({
          id: generateId('item'),
          type: s.type,
          name: s.name,
          quantity: 99,
        }))
      case 'innkeeper':
        return INNKEEPER_MENU.map(s => ({
          id: generateId('item'),
          type: s.type,
          name: s.name,
          quantity: 99,
        }))
      default:
        return []
    }
  }

  private createNpcBio(role: NpcRole, name: string): string {
    switch (role) {
      case 'merchant': return `${name} runs a shop at the marketplace, selling supplies to travelers and adventurers.`
      case 'innkeeper': return `${name} runs the local tavern, offering rest, food, and the latest rumors.`
      case 'guild_master': return `${name} oversees the adventurers guild, offering guidance and quests.`
      case 'wanderer': return `${name} wanders the world, sharing stories and information between settlements.`
      case 'guard': return `${name} keeps watch over the settlement, protecting travelers and maintaining order.`
    }
  }

  /** Get all NPC agents for inclusion in agent lists */
  getAllNpcs(): Agent[] {
    return Array.from(this.npcs.values()).map(r => r.agent)
  }

  getNpc(id: string): Agent | undefined {
    return this.npcs.get(id)?.agent
  }

  isNpc(id: string): boolean {
    return this.npcs.has(id)
  }

  /** Get a dialogue line for an NPC (when a bot agent speaks to them) */
  getDialogue(npcId: string, _speakerAgentId?: string): string | null {
    const runtime = this.npcs.get(npcId)
    if (!runtime) return null

    const pool = DIALOGUE_POOLS[runtime.role]

    // Innkeepers mix regular lines with rumors
    if (runtime.role === 'innkeeper' && Math.random() < 0.4) {
      return INNKEEPER_RUMOR_TEMPLATES[Math.floor(Math.random() * INNKEEPER_RUMOR_TEMPLATES.length)]
    }

    return pool[Math.floor(Math.random() * pool.length)]
  }

  /** Get shop items for a merchant/innkeeper NPC */
  getShopItems(npcId: string): ShopItem[] | null {
    const runtime = this.npcs.get(npcId)
    if (!runtime) return null

    if (runtime.role === 'merchant') return MERCHANT_STOCK
    if (runtime.role === 'innkeeper') return INNKEEPER_MENU
    return null
  }

  /** Process NPC behaviors each tick */
  tick(clock: WorldClock): void {
    for (const runtime of this.npcs.values()) {
      // Wanderer movement
      if (runtime.role === 'wanderer') {
        this.tickWanderer(runtime, clock)
      }

      // Idle chatter (NPCs occasionally speak)
      if (clock.tick - runtime.lastSpokeTick >= runtime.chatterCooldown) {
        this.idleChatter(runtime, clock)
      }
    }
  }

  private tickWanderer(runtime: NpcRuntime, clock: WorldClock): void {
    const { agent } = runtime

    // If no path, pick a new POI destination
    if (runtime.path.length === 0 || runtime.pathIndex >= runtime.path.length) {
      const pois = this.tileMap.pois
      if (pois.length < 2) return

      // Pick next POI in sequence (cycling through all POIs)
      runtime.wanderTargetIndex = (runtime.wanderTargetIndex + 1) % pois.length
      const target = pois[runtime.wanderTargetIndex]

      // Don't path to current position
      if (target.position.x === agent.position.x && target.position.y === agent.position.y) {
        runtime.wanderTargetIndex = (runtime.wanderTargetIndex + 1) % pois.length
        return
      }

      runtime.path = findPath(this.tileMap, agent.position, target.position)
      runtime.pathIndex = 0

      if (runtime.path.length === 0) return
    }

    // Move one step every 3 ticks (slower than player agents)
    if (clock.tick % 3 === 0 && runtime.pathIndex < runtime.path.length) {
      const prevPos = { ...agent.position }
      agent.position = runtime.path[runtime.pathIndex]
      runtime.pathIndex++

      this.eventBus.emit({
        type: 'agent:moved',
        agentId: agent.id,
        from: prevPos,
        to: agent.position,
        timestamp: clock.tick,
      })
    }
  }

  private idleChatter(runtime: NpcRuntime, clock: WorldClock): void {
    runtime.lastSpokeTick = clock.tick
    runtime.chatterCooldown = 120 + Math.floor(Math.random() * 180) // 2-5 minutes

    // Only chatter 30% of the time to avoid spam
    if (Math.random() > 0.3) return

    const line = this.getDialogue(runtime.agent.id)
    if (!line) return

    this.eventBus.emit({
      type: 'agent:spoke',
      agentId: runtime.agent.id,
      message: line,
      timestamp: clock.tick,
    })
  }
}
