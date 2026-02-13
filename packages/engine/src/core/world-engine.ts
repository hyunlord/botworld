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
import { SkillManager } from '../skills/skill-manager.js'
import { MagicSystem } from '../skills/magic-system.js'
import { UndergroundGenerator } from '../world/underground-generator.js'
import { OceanSystem } from '../world/ocean-system.js'
import { WorldLayerManager } from '../world/layer-manager.js'
import { RankingManager } from '../systems/ranking-manager.js'
import { WorldRecordManager } from '../systems/world-records.js'
import { StatisticsCollector } from '../systems/statistics-collector.js'

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
  public skillManager: SkillManager
  public magicSystem: MagicSystem
  readonly undergroundGenerator: UndergroundGenerator
  readonly oceanSystem: OceanSystem
  readonly layerManager: WorldLayerManager
  readonly rankingManager: RankingManager
  readonly worldRecordManager: WorldRecordManager
  readonly statisticsCollector: StatisticsCollector
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

    // Skill and Magic systems
    this.skillManager = new SkillManager(this.eventBus)
    this.magicSystem = new MagicSystem(this.eventBus)

    // World layer systems
    this.undergroundGenerator = new UndergroundGenerator()
    this.oceanSystem = new OceanSystem(this.eventBus)
    this.layerManager = new WorldLayerManager(this.eventBus, this.undergroundGenerator, this.oceanSystem)

    // Generate underground at first mine POI
    const minePoi = this.tileMap.pois.find(p => p.type === 'mine')
    if (minePoi) {
      this.layerManager.generateUnderground(minePoi.position)
    }

    // Rankings, records, and statistics systems
    this.rankingManager = new RankingManager(this.eventBus, this.agentManager)
    this.worldRecordManager = new WorldRecordManager(this.eventBus)
    this.statisticsCollector = new StatisticsCollector(this.eventBus, this.agentManager, () => this.clock)
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

    // Wire pack breeding → creature spawning
    this.eventBus.on('pack:breed_request' as any, (event: any) => {
      if (event.type !== 'pack:breed_request') return
      const MAX_CREATURES_PER_AREA = 20
      const nearby = this.creatureManager.getCreaturesInArea(event.position.x, event.position.y, 20)
      if (nearby.length >= MAX_CREATURES_PER_AREA) return
      const creature = this.creatureManager.spawnCreature(event.templateId, event.position, { packId: event.packId })
      if (creature) {
        this.packManager.addMember(event.packId, creature.id)
        console.log(`[Pack] Breeding in pack ${event.packId}: new ${event.templateId} spawned`)
      }
    })

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
      // Award gathering XP
      this.skillManager.awardXP(event.agentId, 'gathering', 1, 'practice', event.timestamp)
    })

    // ── Skill XP wiring ──

    // Initialize skills/magic/layers for newly spawned agents
    this.eventBus.on('agent:spawned', (event) => {
      if (event.type !== 'agent:spawned') return
      this.skillManager.initializeAgent(event.agent.id)
      this.magicSystem.initializeAgent(event.agent.id, 50)
      this.layerManager.initializeAgent(event.agent.id)
    })

    // Combat → combat skill XP
    this.eventBus.on('combat:ended', (event) => {
      if (event.type !== 'combat:ended') return
      // Award combat XP on any outcome (victory gives more)
      const combatMul = event.outcome === 'victory' ? 1.5 : 1
      this.skillManager.awardXP(event.agentId, 'melee', combatMul, 'practice', event.timestamp)
      this.skillManager.awardXP(event.agentId, 'defense', combatMul * 0.8, 'practice', event.timestamp)
      this.skillManager.awardXP(event.agentId, 'tactics', combatMul * 0.5, 'practice', event.timestamp)
    })

    // Trade → trading skill XP
    this.eventBus.on('trade:completed', (event) => {
      if (event.type !== 'trade:completed') return
      this.skillManager.awardXP(event.buyerId, 'trading', 1, 'practice', event.timestamp)
      this.skillManager.awardXP(event.sellerId, 'trading', 1, 'practice', event.timestamp)
    })

    // Crafting → crafting skill XP (route by recipe category)
    this.eventBus.on('item:crafted', (event) => {
      if (event.type !== 'item:crafted') return
      const item = event.item
      // Determine crafting sub-skill from item type
      const craftSkillMap: Record<string, string> = {
        weapon: 'smithing', armor: 'smithing', tool: 'smithing',
        potion: 'alchemy', medicine: 'alchemy',
        food: 'cooking', meal: 'cooking',
        furniture: 'woodworking', structure: 'woodworking',
        clothing: 'tailoring', fabric: 'tailoring',
        enchanted: 'enchanting', scroll: 'enchanting',
      }
      const subSkill = craftSkillMap[item.type] || 'crafting'
      this.skillManager.awardXP(event.agentId, subSkill as any, 1, 'practice', event.timestamp)
    })

    // Conversation → social skill XP
    this.eventBus.on('agent:spoke', (event) => {
      if (event.type !== 'agent:spoke') return
      if (event.targetAgentId) {
        this.skillManager.awardXP(event.agentId, 'charisma', 0.5, 'practice', event.timestamp)
      }
    })

    // Spell casting → magic school XP
    this.eventBus.on('spell:cast_completed', (event) => {
      if (event.type !== 'spell:cast_completed') return
      const school = (event as any).school
      if (school) {
        this.skillManager.awardXP(event.agentId, school, 1.5, 'practice', event.timestamp)
      }
    })

    // Skill level up → update agent mana if magic skill
    this.eventBus.on('skill:level_up', (event) => {
      if (event.type !== 'skill:level_up') return
      const magicSchools = ['fire', 'ice', 'heal', 'summon', 'arcane', 'dark']
      if (magicSchools.includes(event.skillId)) {
        // Increase max mana by 5 per magic level gained
        const state = this.magicSystem.getMagicState(event.agentId)
        if (state) {
          state.maxMana += 5
          state.currentMana = Math.min(state.currentMana + 5, state.maxMana)
        }
      }
    })

    // Initialize skills/magic/layers for any agents loaded before start()
    for (const agent of this.agentManager.getAllAgents()) {
      if (this.skillManager.getAgentSkills(agent.id).length === 0) {
        this.skillManager.initializeAgent(agent.id)
      }
      if (!this.magicSystem.getMagicState(agent.id)) {
        this.magicSystem.initializeAgent(agent.id, agent.stats.maxMana ?? 50)
      }
      this.layerManager.initializeAgent(agent.id)
    }

    // ── Cross-system integration ──

    // 1. Item ↔ Combat: Track item usage in combat, reduce durability
    this.eventBus.on('advanced_combat:ended', (event) => {
      if (event.type !== 'advanced_combat:ended') return
      // Record combat in item history for all survivors' equipped items
      const allParticipantIds = [...event.survivors.map(s => s.name), ...event.casualties.map(c => c.name)]
      for (const participantId of allParticipantIds) {
        const agent = this.agentManager.getAgent(participantId) ?? this.npcManager.getNpc(participantId)
        if (!agent?.inventory) continue
        for (const item of agent.inventory) {
          // Check if item has durability (implying it's equippable/usable)
          if (item.durability !== undefined && item.durability > 0) {
            this.itemManager.recordEvent(item.id, 'used_in_combat', event.timestamp)
            // Reduce durability slightly
            item.durability = Math.max(0, item.durability - 1)
          }
        }
      }
    })

    // 2. Item ↔ Relationships: Gift giving boosts affection
    this.eventBus.on('trade:completed', (event) => {
      if (event.type !== 'trade:completed') return
      // If price is 0, treat as gift
      if (event.price === 0) {
        this.relationshipManager.applyInteraction(
          event.sellerId, event.buyerId, 'gift_given', event.timestamp,
          { item: event.item.name },
        )
      }
    })

    // 3. Combat ↔ Relationships: Fighting together builds trust
    this.eventBus.on('advanced_combat:ended', (event) => {
      if (event.type !== 'advanced_combat:ended') return
      // If survivors are on same side, they fought together
      if (event.survivors.length >= 2) {
        for (let i = 0; i < event.survivors.length; i++) {
          for (let j = i + 1; j < event.survivors.length; j++) {
            this.relationshipManager.applyInteraction(
              event.survivors[i].name, event.survivors[j].name, 'combat_victory', event.timestamp,
            )
          }
        }
      }
    })

    // 4. Weather ↔ Combat: Weather modifiers affect combat
    this.eventBus.on('advanced_combat:started', (event) => {
      if (event.type !== 'advanced_combat:started') return
      const weather = this.weather.getState().current
      if (weather === 'rain' || weather === 'storm') {
        // Log weather effect (actual combat engine would use this)
        console.log(`[WorldEngine] Combat ${event.combatId}: ${weather} weather affects ranged accuracy`)
      }
    })

    // 5. Season ↔ Farming: Winter freezes crops
    this.eventBus.on('world:tick', (event) => {
      if (event.type !== 'world:tick') return
      // Only check every 100 ticks
      if (event.clock.tick % 100 !== 0) return
      const season = this.ecosystemManager.getSeason()
      if (season === 'winter') {
        // Mark farms as winter-affected (pause growth)
        for (const farm of this.farmingSystem.getAllFarms()) {
          for (const plot of farm.plots) {
            if (plot.growthProgress < 100 && !plot.isReady) {
              // Pause growth by marking with metadata
              (plot as any).winterPaused = true
            }
          }
        }
      } else if (season === 'spring') {
        // Resume growth
        for (const farm of this.farmingSystem.getAllFarms()) {
          for (const plot of farm.plots) {
            (plot as any).winterPaused = false
          }
        }
      }
    })

    // 6. Building ↔ Crafting: Nearby buildings boost craft quality
    this.eventBus.on('item:crafted', (event) => {
      if (event.type !== 'item:crafted') return
      const agent = this.agentManager.getAgent(event.agentId) ?? this.npcManager.getNpc(event.agentId)
      if (!agent) return
      // Check if near a relevant building (workshop, blacksmith, etc.)
      const nearbyBuildings = this.buildingManager.getBuildingsNear(agent.position.x, agent.position.y, 3)
      const hasForge = nearbyBuildings.some(b => b.type === 'blacksmith' || b.type === 'workshop' || b.type === 'ancient_forge')
      if (hasForge && event.item) {
        // Quality boost: add building bonus to item
        const item = this.itemManager.getItem(event.item.id)
        if (item && item.stats) {
          // Boost all stats by 10%
          for (const key of Object.keys(item.stats)) {
            (item.stats as any)[key] = Math.ceil((item.stats as any)[key] * 1.1)
          }
          this.itemManager.recordEvent(event.item.id, 'enchanted', event.timestamp)
        }
      }
    })

    // 7. Skill ↔ Crafting: Higher skill = better quality
    this.eventBus.on('item:crafted', (event) => {
      if (event.type !== 'item:crafted') return
      const skills = this.skillManager.getAgentSkills(event.agentId)
      const craftingSkill = skills.find(s => s.skillId === 'smithing' || s.skillId === 'alchemy' || s.skillId === 'cooking')
      if (craftingSkill && craftingSkill.level >= 5) {
        const item = this.itemManager.getItem(event.item.id)
        if (item && item.stats) {
          const bonus = Math.floor(craftingSkill.level / 5) * 0.05 // 5% per 5 levels
          for (const key of Object.keys(item.stats)) {
            (item.stats as any)[key] = Math.ceil((item.stats as any)[key] * (1 + bonus))
          }
        }
      }
    })

    // 8. Rumor ↔ Politics: Rumors influence election outcomes
    this.eventBus.on('election:started', (event) => {
      if (event.type !== 'election:started') return
      // Check if any candidate has negative rumors
      const candidates = event.candidates ?? []
      for (const candidate of candidates) {
        const rumors = this.rumorSystem.getRumorsAbout(candidate.agentId)
        const negativeRumors = rumors.filter(r => r.type === 'scandal')
        if (negativeRumors.length > 0) {
          // Reduce their votes/support via reputation
          this.reputationSystem.adjustReputation(
            candidate.agentId, 'leadership', -negativeRumors.length * 3,
            `Rumors affecting election standing`, event.timestamp,
          )
        }
      }
    })

    // 9. Secret ↔ Politics: Revealed secrets cause political crises
    this.eventBus.on('secret:revealed', (event) => {
      if (event.type !== 'secret:revealed') return
      // Check if the secret holder is a political leader
      const settlements = this.settlementManager.getAllSettlements()
      for (const settlement of settlements) {
        if (settlement.leaderId === event.ownerId) {
          // Create political crisis rumor
          this.rumorSystem.createRumor(
            'scandal',
            `${settlement.name}'s leader's secret was revealed`,
            event.ownerId,
            event.revealedBy,
            event.timestamp,
          )
          // Reputation hit
          this.reputationSystem.adjustReputation(
            event.ownerId, 'leadership', -15,
            'Secret revealed - political crisis', event.timestamp,
          )
        }
      }
    })

    // 10. Creature ↔ Ecosystem: Predators hunt prey (wolves hunt rabbits)
    this.eventBus.on('creature:died', (event) => {
      if (event.type !== 'creature:died') return
      // If killed by another creature (check if killedBy is a creature ID), it's natural ecosystem
      if (event.killedBy && event.killedBy.startsWith('creature_')) {
        this.ecosystemManager.onPredation(
          event.killedBy,
          event.templateId,
          event.position,
          event.timestamp,
        )
      }
    })

    // 11. Building ↔ Combat: Siege damages buildings
    this.eventBus.on('siege:started', (event) => {
      if (event.type !== 'siege:started') return
      // Siege system handles damage internally via SiegeSystem.tick()
      console.log(`[WorldEngine] Siege started at position (${event.position.x}, ${event.position.y}) by ${event.attackerId}`)
    })

    // 12. Magic ↔ Combat: Track spell usage in combat
    this.eventBus.on('spell:cast_completed', (event) => {
      if (event.type !== 'spell:cast_completed') return
      // Check if in combat by looking for recent combat events
      const recentCombats = this.eventBus.getRecentEvents(10).filter(e =>
        e.type === 'advanced_combat:started' || e.type === 'combat:started',
      )
      if (recentCombats.length > 0) {
        // Award bonus combat XP for using magic in combat
        this.skillManager.awardXP(event.agentId, 'tactics', 0.5, 'practice', event.timestamp)
      }
    })

    // 13. Season ↔ Creatures: Winter hibernation/migration
    this.eventBus.on('world:tick', (event) => {
      if (event.type !== 'world:tick') return
      // Only check when season transitions (every 7200 ticks = 1 season)
      if (event.clock.tick % 7200 !== 1) return
      const season = this.ecosystemManager.getSeason()
      const allCreatures = this.creatureManager.getAllCreatures()
      for (const creature of allCreatures) {
        if (season === 'winter') {
          // Bears, rabbits, deer hibernate (reduce activity)
          if (creature.templateId === 'bear' || creature.templateId === 'rabbit' || creature.templateId === 'deer') {
            (creature as any).hibernating = true
          }
        } else if (season === 'spring') {
          // End hibernation
          (creature as any).hibernating = false
        }
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

    // 10.97. Magic system tick
    this.magicSystem.tick(this.clock)

    // 10.98. Ocean system tick (ship movement, builds)
    this.oceanSystem.tick(this.clock.tick)

    // 10.99. Layer system tick (special region effects)
    this.layerManager.tick(this.clock.tick)

    // 10.991. Sync agent positions to layer manager
    for (const agent of this.agentManager.getAllAgents()) {
      this.layerManager.updateAgentPosition(agent.id, agent.position)
    }

    // 10.992. Check for underground knockouts - agents with HP <= 0 in underground layers
    for (const agent of this.agentManager.getAllAgents()) {
      if (agent.stats.hp <= 0 && agent.unconsciousUntil) {
        const result = this.layerManager.handleUndergroundKnockout(agent.id, this.clock.tick)
        if (result.returnToSurface && result.surfacePosition) {
          agent.position = result.surfacePosition
        }
      }
    }

    // 10.995a. Rankings, records, and statistics tick
    this.rankingManager.tick(this.clock.tick)
    this.statisticsCollector.tick(this.clock.tick)

    // 10.995. Mana regeneration for all agents
    for (const agent of this.agentManager.getAllAgents()) {
      const isResting = agent.currentAction?.type === 'rest'
      const isMeditating = agent.currentAction?.type === 'meditate'
      this.magicSystem.regenMana(agent.id, isResting ?? false, isMeditating ?? false)
    }

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
      layers: this.layerManager.getState(),
      ships: this.oceanSystem.getAllShips().length,
      islands: this.oceanSystem.getIslands().length,
      rankings: this.rankingManager.getRankings() ? 'available' : 'pending',
      worldRecords: this.worldRecordManager.getRecords().length,
    }
  }
}
