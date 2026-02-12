import type { WorldClock } from '@botworld/shared'
import { TICK_RATE, LOAD_DISTANCE_CHUNKS } from '@botworld/shared'
import { EventBus } from './event-bus.js'
import { createWorldClock, advanceClock } from './world-clock.js'
import { AgentManager } from '../agent/agent-manager.js'
import { PlanExecutor } from '../agent/plan-executor.js'
import { TileMap } from '../world/tile-map.js'
import { WeatherSystem } from '../systems/weather.js'
import { NpcManager } from '../systems/npc-manager.js'
import { QuestManager } from '../systems/quest-manager.js'
import { WorldEventSystem } from '../systems/world-events.js'
import { CombatSystem } from '../systems/combat.js'
import { NpcEventReactions } from '../npc/npc-event-reactions.js'
import { ItemManager } from '../items/item-manager.js'
import { ItemNamer } from '../items/item-namer.js'
import { craftingSystem } from '../systems/crafting.js'
import { RelationshipManager } from '../social/relationship-manager.js'
import { RumorSystem } from '../social/rumor-system.js'
import { SecretSystem } from '../social/secret-system.js'
import { ReputationSystem } from '../social/reputation-system.js'
import { GuildManager } from '../politics/guild-manager.js'
import { SettlementManager } from '../politics/settlement-manager.js'
import { KingdomManager } from '../politics/kingdom-manager.js'
import { WorldHistoryManager } from '../world/world-history.js'
import { EcosystemManager } from '../world/ecosystem-manager.js'
import { BuildingManager } from '../buildings/building-manager.js'
import { SiegeSystem } from '../buildings/siege-system.js'
import { CreatureManager } from '../creatures/creature-manager.js'
import { PackManager } from '../creatures/pack-manager.js'
import { DenManager } from '../creatures/den-manager.js'
import { AdvancedCombatEngine } from '../combat/combat-engine.js'
import { FormationSystem } from '../combat/formation-system.js'
import { RecipeManager } from '../crafting/recipe-manager.js'
import { FarmingSystem } from '../crafting/farming-system.js'
import { ProductionManager } from '../crafting/production-manager.js'

export class WorldEngine {
  readonly eventBus = new EventBus()
  readonly agentManager: AgentManager
  readonly planExecutor: PlanExecutor
  readonly tileMap: TileMap
  readonly weather: WeatherSystem
  readonly npcManager: NpcManager
  readonly questManager: QuestManager
  readonly worldEvents: WorldEventSystem
  readonly combat: CombatSystem
  readonly npcEventReactions: NpcEventReactions
  readonly itemManager: ItemManager
  readonly itemNamer: ItemNamer
  readonly relationshipManager: RelationshipManager
  readonly rumorSystem: RumorSystem
  readonly secretSystem: SecretSystem
  readonly reputationSystem: ReputationSystem
  readonly guildManager: GuildManager
  readonly settlementManager: SettlementManager
  readonly kingdomManager: KingdomManager
  readonly historyManager: WorldHistoryManager
  readonly ecosystemManager: EcosystemManager
  readonly buildingManager: BuildingManager
  readonly siegeSystem: SiegeSystem
  readonly creatureManager: CreatureManager
  readonly packManager: PackManager
  readonly denManager: DenManager
  readonly advancedCombat: AdvancedCombatEngine
  readonly formationSystem: FormationSystem
  readonly recipeManager: RecipeManager
  readonly farmingSystem: FarmingSystem
  readonly productionManager: ProductionManager
  clock: WorldClock

  private tickInterval: ReturnType<typeof setInterval> | null = null
  private running = false
  private paused = false
  private speedMultiplier = 1

  constructor() {
    this.clock = createWorldClock()
    this.tileMap = new TileMap()
    this.weather = new WeatherSystem()
    this.npcManager = new NpcManager(this.eventBus, this.tileMap, () => this.clock)
    this.agentManager = new AgentManager(this.eventBus, this.tileMap, () => this.clock)
    this.planExecutor = new PlanExecutor(
      this.eventBus,
      this.tileMap,
      (id) => this.agentManager.getAgent(id) ?? this.npcManager.getNpc(id),
      () => [...this.agentManager.getAllAgents(), ...this.npcManager.getAllNpcs()],
      (agentId, action) => {
        // Try AgentManager first (player bots)
        const result = this.agentManager.enqueueAction(agentId, action)
        if (result.success) return result
        // Fall back to NpcManager for NPC agents
        if (this.npcManager.isNpc(agentId)) {
          if (action.type === 'move' && action.targetPosition) {
            return this.npcManager.moveNpc(agentId, action.targetPosition)
              ? { success: true } : { success: false, error: 'NPC path not found' }
          }
          // For non-move actions, set the action directly on the NPC
          return this.npcManager.setNpcAction(agentId, action)
            ? { success: true } : { success: false, error: 'NPC not found' }
        }
        return result
      },
      () => this.clock,
    )
    this.questManager = new QuestManager(this.eventBus, this.tileMap, this.npcManager, () => this.clock)
    this.worldEvents = new WorldEventSystem(this.eventBus, this.tileMap, () => this.clock)
    this.combat = new CombatSystem(this.eventBus, this.tileMap, () => this.clock)
    this.npcEventReactions = new NpcEventReactions(this.eventBus, this.npcManager, this.planExecutor, this.tileMap)

    // Item system
    this.itemManager = new ItemManager(this.eventBus, () => this.clock)
    this.itemNamer = new ItemNamer(this.itemManager, this.eventBus)

    // Wire crafting system to rich item creation
    craftingSystem.setItemManager(this.itemManager)
    craftingSystem.setItemNamer(this.itemNamer)
    craftingSystem.setTileMap(this.tileMap)

    // Wire combat system to rich loot creation
    this.combat.setItemManager(this.itemManager)

    // Wire agent manager for trade history tracking
    this.agentManager.setItemManager(this.itemManager)

    // Social systems
    this.relationshipManager = new RelationshipManager(this.eventBus)
    this.rumorSystem = new RumorSystem(this.eventBus)
    this.secretSystem = new SecretSystem(this.eventBus)
    this.reputationSystem = new ReputationSystem(this.eventBus)
    this.secretSystem.setRelationshipManager(this.relationshipManager)

    // Wire social systems to NPC manager for LLM context enrichment
    this.npcManager.setSocialSystems(this.relationshipManager, this.rumorSystem, this.secretSystem, this.reputationSystem)

    // Politics systems
    this.guildManager = new GuildManager(this.eventBus)
    this.settlementManager = new SettlementManager(this.eventBus)
    this.kingdomManager = new KingdomManager(this.eventBus)

    // Wire politics dependencies
    this.guildManager.setRelationshipManager(this.relationshipManager)
    this.guildManager.setReputationSystem(this.reputationSystem)
    this.settlementManager.setRelationshipManager(this.relationshipManager)
    this.settlementManager.setReputationSystem(this.reputationSystem)
    this.kingdomManager.setSettlementManager(this.settlementManager)
    this.kingdomManager.setRelationshipManager(this.relationshipManager)
    this.kingdomManager.setReputationSystem(this.reputationSystem)

    // Wire politics to NPC manager for LLM context enrichment
    this.npcManager.setPoliticsSystems(this.guildManager, this.settlementManager, this.kingdomManager)

    // History system
    this.historyManager = new WorldHistoryManager(
      this.eventBus,
      (id: string) => {
        const a = this.agentManager.getAgent(id) ?? this.npcManager.getNpc(id)
        return a?.name ?? id
      },
    )

    // Ecosystem system
    this.ecosystemManager = new EcosystemManager(this.eventBus, this.tileMap)

    // Wire ecosystem to NPC manager for seasonal context
    this.npcManager.setEcosystemManager(this.ecosystemManager)

    // Building system
    this.buildingManager = new BuildingManager(this.eventBus)
    this.siegeSystem = new SiegeSystem(this.eventBus)

    // Wire buildings to NPC manager for AI context
    this.npcManager.setBuildingManager(this.buildingManager)

    // Creature system (unified animals + monsters)
    this.creatureManager = new CreatureManager(this.eventBus, this.tileMap)
    this.packManager = new PackManager(this.eventBus)
    this.denManager = new DenManager(this.eventBus)

    // Wire creatures to NPC manager for AI context
    this.npcManager.setCreatureManager(this.creatureManager)

    // Advanced combat system
    this.advancedCombat = new AdvancedCombatEngine(this.eventBus)
    this.formationSystem = new FormationSystem()

    // Crafting systems
    this.recipeManager = new RecipeManager(this.eventBus)
    this.farmingSystem = new FarmingSystem(this.eventBus)
    this.productionManager = new ProductionManager(this.eventBus)
  }

  start(): void {
    if (this.running) return
    this.running = true

    // Spawn NPCs at POIs if none exist yet
    if (this.npcManager.getAllNpcs().length === 0) {
      this.npcManager.spawnFromPOIs(this.tileMap.pois)
    }

    // Initialize NPC LLM scheduler with cross-system dependencies
    this.npcManager.initScheduler(
      () => [...this.agentManager.getAllAgents(), ...this.npcManager.getAllNpcs()],
      () => this.weather.getState().current,
      () => {
        // Combine recent events with active world event descriptions
        const recent = this.eventBus.getRecentEvents(5)
          .filter(e => e.type === 'world_event:started' || e.type === 'combat:started' || e.type === 'monster:spawned')
          .map(e => {
            if (e.type === 'world_event:started') return e.title
            if (e.type === 'monster:spawned') return `A ${e.monsterType} appeared nearby`
            if (e.type === 'combat:started') return `Combat broke out nearby`
            return ''
          })
          .filter(Boolean)
        // Add active world event descriptions for richer NPC awareness
        const active = this.worldEvents.getActiveEvents()
          .map(e => `[Active Event] ${e.title}: ${e.description}`)
        return [...recent, ...active]
      },
    )

    // Wire plan executor to NPC scheduler
    this.npcManager.setPlanExecutor(this.planExecutor)

    // Handle pause_and_respond for plan executor
    this.eventBus.on('agent:spoke', (event) => {
      if (event.type !== 'agent:spoke') return
      if (!event.targetAgentId) return
      const state = this.planExecutor.getPlanState(event.targetAgentId)
      if (state && !state.paused) {
        const plan = state.plan
        if (plan.interrupt_conditions?.on_spoken_to === 'pause_and_respond') {
          this.planExecutor.pausePlan(event.targetAgentId)
          // Resume after 10 ticks (enough time for response)
          setTimeout(() => {
            this.planExecutor.resumePlan(event.targetAgentId!)
          }, 10_000)
        }
      }
    })

    // React to world events — spawn monsters for danger/portal events
    this.eventBus.on('world_event:started', (event) => {
      if (event.type !== 'world_event:started') return
      const { eventType, position } = event

      if (eventType === 'monster_spawn') {
        // Spawn 10-15 monsters (monster wave) around the event location
        const count = 10 + Math.floor(Math.random() * 6)
        let spawned = 0
        for (let i = 0; i < count; i++) {
          const offset = { x: position.x + Math.floor(Math.random() * 10) - 5, y: position.y + Math.floor(Math.random() * 10) - 5 }
          if (this.tileMap.isWalkable(offset.x, offset.y)) {
            this.combat.spawnMonsterAt(offset, 2)
            spawned++
          }
        }
        console.log(`[WorldEngine] Spawned ${spawned} monsters for Monster Wave at (${position.x}, ${position.y})`)
      }

      if (eventType === 'new_poi') {
        // Portal guardian — spawn a boss-level monster (HP ~500, attack ~30)
        const guardian = this.combat.spawnMonsterAt(position, 8, 'dragon_whelp')
        // Override stats to match portal guardian spec
        guardian.maxHp = 500
        guardian.hp = 500
        guardian.attack = 30
        guardian.defense = 15
        guardian.name = '포탈 가디언'
        guardian.loot = [
          ...guardian.loot,
          { itemType: 'portal_shard', chance: 1.0, quantityMin: 1, quantityMax: 1 },
          { itemType: 'gold_coin', chance: 1.0, quantityMin: 50, quantityMax: 100 },
        ]
        console.log(`[WorldEngine] Spawned portal guardian at (${position.x}, ${position.y}) [HP: 500, ATK: 30]`)
      }
    })

    // ── Social system event wiring ──

    // Trade → relationship + reputation + rumor
    this.eventBus.on('trade:completed', (event) => {
      if (event.type !== 'trade:completed') return
      const { buyerId, sellerId, item, price } = event
      // Fair trade: both parties get trust/respect boost
      this.relationshipManager.applyInteraction(
        buyerId, sellerId, 'fair_trade', event.timestamp,
        { item: item.name },
      )
      // Reputation boost for seller
      this.reputationSystem.adjustReputation(sellerId, 'trading', 2, `Sold ${item.name}`, event.timestamp)
    })

    // Combat ended → relationship for allies + reputation + rumor
    this.eventBus.on('combat:ended', (event) => {
      if (event.type !== 'combat:ended') return
      if (event.outcome === 'victory') {
        // Combat reputation boost
        this.reputationSystem.adjustReputation(event.agentId, 'combat', 5, `Defeated a monster`, event.timestamp)
        // Create rumor about combat achievement
        const agent = this.agentManager.getAgent(event.agentId) ?? this.npcManager.getNpc(event.agentId)
        if (agent) {
          this.rumorSystem.createRumor(
            'achievement',
            `${agent.name} defeated a monster in combat`,
            event.agentId,
            event.agentId,
            event.timestamp,
          )
        }
      }
    })

    // Dragon kill → world history recording
    this.eventBus.on('creature:died', (event) => {
      if (event.type !== 'creature:died') return
      const creatureEvent = event as any
      if (creatureEvent.templateId === 'dragon' || creatureEvent.templateId === 'ancient_golem' || creatureEvent.templateId === 'world_serpent' || creatureEvent.templateId === 'demon_lord') {
        const pos = creatureEvent.position
        const location = pos ? `(${pos.x}, ${pos.y})` : 'unknown location'
        this.historyManager.record(
          creatureEvent.timestamp,
          this.clock.day,
          'battle',
          `${creatureEvent.name} Slain`,
          `The mighty ${creatureEvent.name} was defeated at ${location}`,
          creatureEvent.killedBy ? [creatureEvent.killedBy] : [],
          location,
          creatureEvent.templateId === 'dragon' ? 9 : 10,
        )
      }
    })

    // Conversation → relationship (mild positive) + rumor spreading
    this.eventBus.on('agent:spoke', (event) => {
      if (event.type !== 'agent:spoke') return
      if (!event.targetAgentId) return
      // Mild relationship boost from conversation
      this.relationshipManager.applyInteraction(
        event.agentId, event.targetAgentId, 'conversation', event.timestamp,
      )
      // Spread rumors between conversation participants
      const speaker = this.agentManager.getAgent(event.agentId) ?? this.npcManager.getNpc(event.agentId)
      const listener = this.agentManager.getAgent(event.targetAgentId) ?? this.npcManager.getNpc(event.targetAgentId)
      if (speaker && listener) {
        this.rumorSystem.spreadRumors(speaker, listener, event.timestamp)
      }
    })

    // Crafting → reputation
    this.eventBus.on('item:crafted', (event) => {
      if (event.type !== 'item:crafted') return
      this.reputationSystem.adjustReputation(event.agentId, 'crafting', 3, `Crafted ${event.item.name}`, event.timestamp)
    })

    // Masterwork → reputation + rumor
    this.eventBus.on('item:masterwork_created', (event) => {
      if (event.type !== 'item:masterwork_created') return
      this.reputationSystem.adjustReputation(event.crafterName, 'crafting', 10, `Created masterwork ${event.itemName}`, event.timestamp)
      this.rumorSystem.createRumor(
        'achievement',
        `${event.crafterName} crafted a ${event.quality} item: ${event.customName}`,
        event.crafterName,
        event.crafterName,
        event.timestamp,
      )
    })

    // Resource depletion → ecosystem regen tracking
    this.eventBus.on('resource:gathered', (event) => {
      if (event.type !== 'resource:gathered') return
      // Check if tile resource is now depleted
      const tile = this.tileMap.getTile(event.position.x, event.position.y)
      if (tile?.resource && tile.resource.amount <= 0) {
        this.ecosystemManager.onResourceDepleted(
          event.position.x, event.position.y,
          event.resourceType, event.timestamp,
        )
      }
    })

    console.log('[WorldEngine] Starting simulation...')
    this.restartInterval()
  }

  stop(): void {
    if (!this.running) return
    this.running = false

    if (this.tickInterval) {
      clearInterval(this.tickInterval)
      this.tickInterval = null
    }
    console.log('[WorldEngine] Simulation stopped.')
  }

  setPaused(paused: boolean): void {
    this.paused = paused
    console.log(`[WorldEngine] ${paused ? 'Paused' : 'Resumed'}`)
  }

  isPaused(): boolean {
    return this.paused
  }

  setSpeed(multiplier: number): void {
    this.speedMultiplier = Math.max(0.25, Math.min(5, multiplier))
    if (this.running) {
      this.restartInterval()
    }
    console.log(`[WorldEngine] Speed set to ${this.speedMultiplier}x`)
  }

  getSpeed(): number {
    return this.speedMultiplier
  }

  isRunning(): boolean {
    return this.running
  }

  private restartInterval(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval)
    }
    const intervalMs = (1000 / TICK_RATE) / this.speedMultiplier
    this.tickInterval = setInterval(() => this.tick(), intervalMs)
  }

  private tick(): void {
    if (this.paused) return

    // 1. Advance clock
    this.clock = advanceClock(this.clock)

    // 2. Emit tick event (pre-processing notification)
    this.eventBus.emit({
      type: 'world:tick',
      clock: this.clock,
      timestamp: this.clock.tick,
    })

    // 3. Expand world around agents (lazy chunk generation)
    this.expandWorldAroundAgents()

    // 4. Process queued actions (complete finished → start queued)
    this.agentManager.processQueuedActions(this.clock)

    // 4.5. Execute active plans (move to next step when current step completes)
    this.planExecutor.tick(this.clock)

    // 5. Update passive effects (hunger, emotions, movement, rest)
    this.agentManager.updatePassiveEffects(this.clock)

    // 6. Regenerate resources
    this.tileMap.tickResources()

    // 7. NPC behaviors (wanderer movement, idle chatter)
    this.npcManager.tick(this.clock)

    // 8. Quest system tick (refresh pool, expire old quests)
    this.questManager.tick(this.clock)

    // 9. World events tick (spawn/expire events)
    this.worldEvents.tick(this.clock)

    // 10. Combat system tick (spawn/respawn monsters)
    this.combat.tick(this.clock)

    // 10.5. Item system tick (dynamic pricing)
    this.itemManager.tick(this.clock)

    // 10.6. Social systems tick (memory fading, rumor expiry, status recalculation)
    this.relationshipManager.tick(this.clock)
    this.rumorSystem.tick(this.clock)
    this.reputationSystem.tick(this.clock, [...this.agentManager.getAllAgents(), ...this.npcManager.getAllNpcs()])

    // 10.7. Politics systems tick (guild drama, settlement elections, treaty expiry)
    const allAgentsForPolitics = [...this.agentManager.getAllAgents(), ...this.npcManager.getAllNpcs()]
    const nameResolver = (id: string) => {
      const a = this.agentManager.getAgent(id) ?? this.npcManager.getNpc(id)
      return a?.name ?? id
    }
    this.guildManager.tick(this.clock, allAgentsForPolitics)
    this.settlementManager.tick(this.clock, allAgentsForPolitics, nameResolver)
    this.kingdomManager.tick(this.clock)

    // 10.8. Ecosystem tick (resource regen, animals, seasons)
    this.ecosystemManager.tick(this.clock)

    // 10.9. Building system tick (construction progress, production)
    this.buildingManager.tick(this.clock)

    // 10.95. Siege system tick
    this.siegeSystem.tick(this.clock, this.buildingManager)

    // 10.96. Creature system tick
    this.creatureManager.tick(this.clock)
    this.packManager.tick(
      this.clock,
      (id) => this.creatureManager.getCreature(id),
      () => this.creatureManager.getAllCreatures(),
    )
    this.denManager.tick(this.clock)

    // 11. Weather system tick
    const weatherChanged = this.weather.tick(this.clock)
    if (weatherChanged) {
      this.eventBus.emit({
        type: 'weather:changed',
        weather: this.weather.getState(),
        timestamp: this.clock.tick,
      })
    }

    // 12. Broadcast updated state (all processing complete)
    this.eventBus.emit({
      type: 'world:state_updated',
      clock: this.clock,
      timestamp: this.clock.tick,
    })
  }

  /** Generate new chunks around agents as they explore */
  private expandWorldAroundAgents(): void {
    const agents = this.agentManager.getAllAgents()
    const allNewKeys: string[] = []

    for (const agent of agents) {
      const newKeys = this.tileMap.ensureChunksAround(
        agent.position.x, agent.position.y, LOAD_DISTANCE_CHUNKS,
      )
      allNewKeys.push(...newKeys)
    }

    if (allNewKeys.length > 0) {
      this.eventBus.emit({
        type: 'world:chunks_generated',
        chunkKeys: allNewKeys,
        timestamp: this.clock.tick,
      })
    }
  }

  getState() {
    return {
      clock: this.clock,
      weather: this.weather.getState(),
      agents: [...this.agentManager.getAllAgents(), ...this.npcManager.getAllNpcs()],
      chunks: this.tileMap.getSerializableChunks(),
      worldEvents: this.worldEvents.getActiveEvents(),
      monsters: this.combat.getAliveMonsters(),
      recentEvents: this.eventBus.getRecentEvents(20),
      guilds: this.guildManager.getAllGuilds(),
      settlements: this.settlementManager.getAllSettlements(),
      kingdoms: this.kingdomManager.getAllKingdoms(),
      wars: this.kingdomManager.getAllWars().filter(w => w.status === 'active'),
      treaties: this.kingdomManager.getAllTreaties().filter(t => t.status === 'active'),
      history: this.historyManager.getBySignificance(4),
      season: this.ecosystemManager.getSeason(),
      animals: this.ecosystemManager.getAnimals(),
      buildings: this.buildingManager.getAllBuildings(),
      activeSieges: this.siegeSystem.getActiveSieges(),
      creatures: this.creatureManager.getAllCreatures(),
      packs: this.packManager.getAllPacks(),
      dens: this.denManager.getAllDens(),
      advancedCombats: this.advancedCombat.getActiveCombats().length,
      farms: this.farmingSystem.getAllFarms().length,
      productionQueues: this.productionManager.getActiveQueues().length,
    }
  }
}
