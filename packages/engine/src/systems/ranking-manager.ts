import type {
  RankingsSnapshot,
  RankingBoard,
  RankingEntry,
  AgentRankingStats,
  ItemRankings,
  ItemRankingEntry,
  RankingField,
  AgentCompareData,
  CombatRankingField,
  EconomyRankingField,
  CraftingRankingField,
  ExplorationRankingField,
  SocialRankingField,
  OverallRankingField,
} from '@botworld/shared'
import type { EventBus } from '../core/event-bus.js'
import type { AgentManager } from '../agent/agent-manager.js'
import type {
  WorldEvent,
  CombatEndedEvent,
  TradeCompletedEvent,
  ItemCraftedEvent,
  ResourceGatheredEvent,
  LayerTransitionEvent,
  LayerDiscoveredEvent,
  AdvancedCombatEndedEvent,
} from '@botworld/shared'

const UPDATE_INTERVAL = 100 // ticks

export class RankingManager {
  private agentStats = new Map<string, AgentRankingStats>()
  private rankings: RankingsSnapshot | null = null
  private itemRankings: ItemRankings | null = null
  private lastUpdate = 0

  constructor(
    private eventBus: EventBus,
    private agentManager: AgentManager,
  ) {
    this.subscribeEvents()
  }

  private subscribeEvents(): void {
    // Initialize stats for new agents
    this.eventBus.on('agent:spawned', (event) => {
      const agent = (event as any).agent
      this.initializeStats(agent.id, agent.name, agent.level)
    })

    // Combat events
    this.eventBus.on('combat:ended', (event) => {
      this.handleCombatEnded(event as CombatEndedEvent)
    })

    this.eventBus.on('advanced_combat:ended', (event) => {
      this.handleAdvancedCombatEnded(event as AdvancedCombatEndedEvent)
    })

    // Trade events
    this.eventBus.on('trade:completed', (event) => {
      this.handleTradeCompleted(event as TradeCompletedEvent)
    })

    // Crafting events
    this.eventBus.on('item:crafted', (event) => {
      this.handleItemCrafted(event as ItemCraftedEvent)
    })

    // Exploration events
    this.eventBus.on('resource:gathered', (event) => {
      this.handleResourceGathered(event as ResourceGatheredEvent)
    })

    this.eventBus.on('layer:transition', (event) => {
      this.handleLayerTransition(event as LayerTransitionEvent)
    })

    this.eventBus.on('layer:discovered', (event) => {
      this.handleLayerDiscovered(event as LayerDiscoveredEvent)
    })
  }

  private initializeStats(agentId: string, agentName: string, level: number): void {
    if (!this.agentStats.has(agentId)) {
      this.agentStats.set(agentId, {
        agentId,
        agentName,
        level,
        // Combat
        totalKills: 0,
        bossKills: 0,
        currentWinStreak: 0,
        bestWinStreak: 0,
        maxSingleDamage: 0,
        totalBattles: 0,
        wins: 0,
        // Economy
        gold: 0,
        inventoryValue: 0,
        maxTradeValue: 0,
        totalTrades: 0,
        totalIncome: 0,
        totalTaxPaid: 0,
        // Crafting
        totalCrafted: 0,
        masterworkCount: 0,
        legendaryCount: 0,
        recipesKnown: 0,
        // Exploration
        tilesExplored: 0,
        dungeonCleared: 0,
        deepestUnderground: 0,
        farthestSailed: 0,
        secretRegionsFound: 0,
        // Social
        totalRelationships: 0,
        avgTrust: 0,
        rumorTargetCount: 0,
        longestGuildLeader: 0,
        electionWins: 0,
        // Overall
        reputation: 0,
        infamy: 0,
      })
    }
  }

  private getOrCreateStats(agentId: string): AgentRankingStats {
    if (!this.agentStats.has(agentId)) {
      const agent = this.agentManager.getAgent(agentId)
      if (agent) {
        this.initializeStats(agentId, agent.name, agent.level)
      } else {
        this.initializeStats(agentId, 'Unknown', 1)
      }
    }
    return this.agentStats.get(agentId)!
  }

  private handleCombatEnded(event: CombatEndedEvent): void {
    const stats = this.getOrCreateStats(event.agentId)
    stats.totalBattles++

    if (event.outcome === 'victory') {
      stats.wins++
      stats.totalKills++
      stats.currentWinStreak++
      stats.bestWinStreak = Math.max(stats.bestWinStreak, stats.currentWinStreak)

      // Check if boss kill (loot-based heuristic)
      if (event.loot && event.loot.length > 2) {
        stats.bossKills++
      }
    } else {
      stats.currentWinStreak = 0
    }

    // Track max damage from xpGained as proxy
    if (event.xpGained > stats.maxSingleDamage) {
      stats.maxSingleDamage = event.xpGained
    }
  }

  private handleAdvancedCombatEnded(event: AdvancedCombatEndedEvent): void {
    // Track stats for all survivors on winning side
    for (const survivor of event.survivors) {
      const agent = this.agentManager.getAllAgents().find(a => a.name === survivor.name)
      if (!agent) continue

      const stats = this.getOrCreateStats(agent.id)
      stats.totalBattles++

      if (event.winningSide === 'attacker' || event.winningSide === 'defender') {
        stats.wins++
        const casualties = event.casualties.length
        stats.totalKills += casualties
        stats.currentWinStreak++
        stats.bestWinStreak = Math.max(stats.bestWinStreak, stats.currentWinStreak)

        // Boss combat type
        if (event.combatType === 'boss') {
          stats.bossKills++
        }
      } else {
        stats.currentWinStreak = 0
      }
    }

    // Track casualties
    for (const casualty of event.casualties) {
      const agent = this.agentManager.getAllAgents().find(a => a.name === casualty.name)
      if (agent) {
        const stats = this.getOrCreateStats(agent.id)
        stats.totalBattles++
        stats.currentWinStreak = 0
      }
    }
  }

  private handleTradeCompleted(event: TradeCompletedEvent): void {
    const buyerStats = this.getOrCreateStats(event.buyerId)
    const sellerStats = this.getOrCreateStats(event.sellerId)

    buyerStats.totalTrades++
    buyerStats.maxTradeValue = Math.max(buyerStats.maxTradeValue, event.price)

    sellerStats.totalTrades++
    sellerStats.totalIncome += event.price
    sellerStats.maxTradeValue = Math.max(sellerStats.maxTradeValue, event.price)
  }

  private handleItemCrafted(event: ItemCraftedEvent): void {
    const stats = this.getOrCreateStats(event.agentId)
    stats.totalCrafted++

    // Check RichItem quality if available
    const richItem = event.item as any
    if (richItem.quality === 'masterwork') {
      stats.masterworkCount++
    } else if (richItem.quality === 'legendary') {
      stats.legendaryCount++
    }
  }

  private handleResourceGathered(event: ResourceGatheredEvent): void {
    const stats = this.getOrCreateStats(event.agentId)
    stats.tilesExplored++ // Approximate exploration via gathering
  }

  private handleLayerTransition(event: LayerTransitionEvent): void {
    const stats = this.getOrCreateStats(event.agentId)
    // Track depth based on layerId (underground layers have negative depth in their name/id)
    // This is a heuristic - actual depth tracking would need layer manager integration
    const layerIdMatch = event.toLayerId.match(/-?\d+/)
    if (layerIdMatch) {
      const depth = parseInt(layerIdMatch[0], 10)
      if (depth < 0) {
        stats.deepestUnderground = Math.max(stats.deepestUnderground, Math.abs(depth))
      }
    }
  }

  private handleLayerDiscovered(event: LayerDiscoveredEvent): void {
    const stats = this.getOrCreateStats(event.agentId)
    stats.secretRegionsFound++
  }

  tick(currentTick: number): void {
    if (currentTick - this.lastUpdate >= UPDATE_INTERVAL) {
      this.computeRankings()
      this.computeItemRankings()
      this.lastUpdate = currentTick

      // Note: rankings:updated event type not in WorldEvent union yet
      // this.eventBus.emit({
      //   type: 'rankings:updated',
      //   timestamp: currentTick,
      // })
    }
  }

  private computeRankings(): void {
    // Refresh agent data from AgentManager
    const agents = this.agentManager.getAllAgents()
    for (const agent of agents) {
      const stats = this.getOrCreateStats(agent.id)
      stats.level = agent.level
      stats.gold = (agent as any).gold ?? 0

      // Calculate inventory value
      let inventoryValue = 0
      if (agent.inventory) {
        for (const item of agent.inventory) {
          // Item has no value field, use quantity * estimated value
          const richItem = item as any
          inventoryValue += (richItem.baseValue ?? richItem.marketValue ?? item.quantity ?? 1)
        }
      }
      stats.inventoryValue = inventoryValue

      // Update relationship counts
      if (agent.relationships) {
        stats.totalRelationships = Object.keys(agent.relationships).length

        const trustValues = Object.values(agent.relationships).map((r: any) => r.trust ?? 0)
        stats.avgTrust = trustValues.length > 0
          ? trustValues.reduce((a, b) => a + b, 0) / trustValues.length
          : 0
      }

      // Update recipes known if available
      if ((agent as any).recipesKnown) {
        stats.recipesKnown = (agent as any).recipesKnown.length
      }
    }

    const timestamp = Date.now()

    // Compute all ranking boards
    this.rankings = {
      combat: this.computeCombatRankings(timestamp),
      economy: this.computeEconomyRankings(timestamp),
      crafting: this.computeCraftingRankings(timestamp),
      exploration: this.computeExplorationRankings(timestamp),
      social: this.computeSocialRankings(timestamp),
      overall: this.computeOverallRankings(timestamp),
    }
  }

  private topN(
    field: keyof AgentRankingStats,
    agents: AgentRankingStats[],
    n: number = 10,
    filterFn?: (agent: AgentRankingStats) => boolean
  ): RankingEntry[] {
    let filtered = agents
    if (filterFn) {
      filtered = agents.filter(filterFn)
    }

    return filtered
      .sort((a, b) => (b[field] as number) - (a[field] as number))
      .slice(0, n)
      .map((agent, index) => ({
        rank: index + 1,
        agentId: agent.agentId,
        agentName: agent.agentName,
        value: agent[field] as number,
        detail: `Level ${agent.level}`,
      }))
  }

  private computeCombatRankings(timestamp: number): RankingBoard[] {
    const agents = Array.from(this.agentStats.values())

    return [
      {
        field: 'total_kills' as CombatRankingField,
        label: 'Total Kills',
        category: 'combat',
        entries: this.topN('totalKills', agents),
        updatedAt: timestamp,
      },
      {
        field: 'boss_kills' as CombatRankingField,
        label: 'Boss Kills',
        category: 'combat',
        entries: this.topN('bossKills', agents),
        updatedAt: timestamp,
      },
      {
        field: 'win_streak' as CombatRankingField,
        label: 'Win Streak',
        category: 'combat',
        entries: this.topN('currentWinStreak', agents),
        updatedAt: timestamp,
      },
      {
        field: 'max_single_damage' as CombatRankingField,
        label: 'Highest Damage',
        category: 'combat',
        entries: this.topN('maxSingleDamage', agents),
        updatedAt: timestamp,
      },
      {
        field: 'win_rate' as CombatRankingField,
        label: 'Win Rate (%)',
        category: 'combat',
        entries: agents
          .filter(a => a.totalBattles >= 5)
          .map(a => ({
            ...a,
            winRate: (a.wins / a.totalBattles) * 100,
          }))
          .sort((a, b) => b.winRate - a.winRate)
          .slice(0, 10)
          .map((agent, index) => ({
            rank: index + 1,
            agentId: agent.agentId,
            agentName: agent.agentName,
            value: Math.round(agent.winRate * 10) / 10,
            detail: `${agent.wins}/${agent.totalBattles} battles`,
          })),
        updatedAt: timestamp,
      },
      {
        field: 'total_battles' as CombatRankingField,
        label: 'Most Battles',
        category: 'combat',
        entries: this.topN('totalBattles', agents),
        updatedAt: timestamp,
      },
    ]
  }

  private computeEconomyRankings(timestamp: number): RankingBoard[] {
    const agents = Array.from(this.agentStats.values()).map(a => ({
      ...a,
      totalWealth: a.gold + a.inventoryValue,
    }))

    return [
      {
        field: 'total_wealth' as EconomyRankingField,
        label: 'Total Wealth',
        category: 'economy',
        entries: agents
          .sort((a, b) => b.totalWealth - a.totalWealth)
          .slice(0, 10)
          .map((agent, index) => ({
            rank: index + 1,
            agentId: agent.agentId,
            agentName: agent.agentName,
            value: agent.totalWealth,
            detail: `${agent.gold} gold + ${agent.inventoryValue} items`,
          })),
        updatedAt: timestamp,
      },
      {
        field: 'max_trade_value' as EconomyRankingField,
        label: 'Biggest Trade',
        category: 'economy',
        entries: this.topN('maxTradeValue', agents),
        updatedAt: timestamp,
      },
      {
        field: 'total_trades' as EconomyRankingField,
        label: 'Total Trades',
        category: 'economy',
        entries: this.topN('totalTrades', agents),
        updatedAt: timestamp,
      },
      {
        field: 'total_income' as EconomyRankingField,
        label: 'Total Income',
        category: 'economy',
        entries: this.topN('totalIncome', agents),
        updatedAt: timestamp,
      },
      {
        field: 'total_tax_paid' as EconomyRankingField,
        label: 'Most Tax Paid',
        category: 'economy',
        entries: this.topN('totalTaxPaid', agents),
        updatedAt: timestamp,
      },
    ]
  }

  private computeCraftingRankings(timestamp: number): RankingBoard[] {
    const agents = Array.from(this.agentStats.values())

    return [
      {
        field: 'total_crafted' as CraftingRankingField,
        label: 'Total Crafted',
        category: 'crafting',
        entries: this.topN('totalCrafted', agents),
        updatedAt: timestamp,
      },
      {
        field: 'masterwork_count' as CraftingRankingField,
        label: 'Masterwork Items',
        category: 'crafting',
        entries: this.topN('masterworkCount', agents),
        updatedAt: timestamp,
      },
      {
        field: 'legendary_count' as CraftingRankingField,
        label: 'Legendary Items',
        category: 'crafting',
        entries: this.topN('legendaryCount', agents),
        updatedAt: timestamp,
      },
      {
        field: 'recipes_known' as CraftingRankingField,
        label: 'Recipes Known',
        category: 'crafting',
        entries: this.topN('recipesKnown', agents),
        updatedAt: timestamp,
      },
    ]
  }

  private computeExplorationRankings(timestamp: number): RankingBoard[] {
    const agents = Array.from(this.agentStats.values())

    return [
      {
        field: 'tiles_explored' as ExplorationRankingField,
        label: 'Tiles Explored',
        category: 'exploration',
        entries: this.topN('tilesExplored', agents),
        updatedAt: timestamp,
      },
      {
        field: 'dungeons_cleared' as ExplorationRankingField,
        label: 'Dungeons Cleared',
        category: 'exploration',
        entries: this.topN('dungeonCleared', agents),
        updatedAt: timestamp,
      },
      {
        field: 'deepest_underground' as ExplorationRankingField,
        label: 'Deepest Level',
        category: 'exploration',
        entries: this.topN('deepestUnderground', agents),
        updatedAt: timestamp,
      },
      {
        field: 'farthest_sailed' as ExplorationRankingField,
        label: 'Farthest Sailed',
        category: 'exploration',
        entries: this.topN('farthestSailed', agents),
        updatedAt: timestamp,
      },
      {
        field: 'secret_regions_found' as ExplorationRankingField,
        label: 'Secrets Found',
        category: 'exploration',
        entries: this.topN('secretRegionsFound', agents),
        updatedAt: timestamp,
      },
    ]
  }

  private computeSocialRankings(timestamp: number): RankingBoard[] {
    const agents = Array.from(this.agentStats.values())

    return [
      {
        field: 'total_relationships' as SocialRankingField,
        label: 'Most Relationships',
        category: 'social',
        entries: this.topN('totalRelationships', agents),
        updatedAt: timestamp,
      },
      {
        field: 'avg_trust' as SocialRankingField,
        label: 'Highest Trust',
        category: 'social',
        entries: this.topN('avgTrust', agents, 10, a => a.totalRelationships > 0),
        updatedAt: timestamp,
      },
      {
        field: 'rumor_target_count' as SocialRankingField,
        label: 'Most Gossiped About',
        category: 'social',
        entries: this.topN('rumorTargetCount', agents),
        updatedAt: timestamp,
      },
      {
        field: 'longest_guild_leader' as SocialRankingField,
        label: 'Longest Guild Leader',
        category: 'social',
        entries: this.topN('longestGuildLeader', agents),
        updatedAt: timestamp,
      },
      {
        field: 'election_wins' as SocialRankingField,
        label: 'Most Elections Won',
        category: 'social',
        entries: this.topN('electionWins', agents),
        updatedAt: timestamp,
      },
    ]
  }

  private computeOverallRankings(timestamp: number): RankingBoard[] {
    const agents = Array.from(this.agentStats.values()).map(a => {
      // Normalize components
      const combatScore = a.totalKills + a.wins * 2
      const wealthScore = a.gold + a.inventoryValue
      const craftingScore = a.totalCrafted * 10 + a.legendaryCount * 100
      const explorationScore = a.tilesExplored
      const socialScore = a.totalRelationships * 10 + a.avgTrust * 5

      // Weighted sum
      const powerScore = Math.round(
        combatScore * 0.3 +
        wealthScore * 0.2 +
        craftingScore * 0.15 +
        explorationScore * 0.15 +
        socialScore * 0.2
      )

      return { ...a, powerScore }
    })

    return [
      {
        field: 'power_score' as OverallRankingField,
        label: 'Power Score',
        category: 'overall',
        entries: agents
          .sort((a, b) => b.powerScore - a.powerScore)
          .slice(0, 10)
          .map((agent, index) => ({
            rank: index + 1,
            agentId: agent.agentId,
            agentName: agent.agentName,
            value: agent.powerScore,
            detail: `Level ${agent.level}`,
          })),
        updatedAt: timestamp,
      },
      {
        field: 'level' as OverallRankingField,
        label: 'Level',
        category: 'overall',
        entries: this.topN('level', agents),
        updatedAt: timestamp,
      },
      {
        field: 'reputation' as OverallRankingField,
        label: 'Reputation',
        category: 'overall',
        entries: this.topN('reputation', agents),
        updatedAt: timestamp,
      },
      {
        field: 'infamy' as OverallRankingField,
        label: 'Infamy',
        category: 'overall',
        entries: this.topN('infamy', agents),
        updatedAt: timestamp,
      },
    ]
  }

  private computeItemRankings(): void {
    const agents = this.agentManager.getAllAgents()
    const allItems: Array<{ item: any; ownerId: string; ownerName: string }> = []

    for (const agent of agents) {
      if (agent.inventory) {
        for (const item of agent.inventory) {
          allItems.push({ item, ownerId: agent.id, ownerName: agent.name })
        }
      }
    }

    const itemEntries: ItemRankingEntry[] = allItems.map(({ item, ownerId, ownerName }) => {
      const richItem = item as any
      const historyLength = richItem.history?.length ?? 0
      const age = richItem.createdAt ? Date.now() - richItem.createdAt : 0
      const battleCount = richItem.history?.filter((h: any) => h.type === 'used_in_combat').length ?? 0
      const ownerCount = new Set(richItem.history?.map((h: any) => h.agent)).size
      const tradeHistory = richItem.history?.filter((h: any) => h.type === 'traded') ?? []
      const maxTradePrice = Math.max(
        0,
        ...tradeHistory.map((h: any) => h.details?.price ?? 0)
      )

      return {
        itemId: item.id,
        itemName: richItem.customName ?? item.name,
        itemType: item.type,
        ownerName,
        ownerId,
        value: richItem.baseValue ?? richItem.marketValue ?? 0,
        rarity: richItem.quality ?? item.rarity,
        historyLength,
        age,
        battleCount,
        ownerCount,
        maxTradePrice,
      }
    })

    this.itemRankings = {
      mostFamous: itemEntries
        .sort((a, b) => b.historyLength - a.historyLength)
        .slice(0, 10),
      oldest: itemEntries
        .sort((a, b) => b.age - a.age)
        .slice(0, 10),
      mostExpensive: itemEntries
        .sort((a, b) => b.maxTradePrice - a.maxTradePrice)
        .slice(0, 10),
      mostBattled: itemEntries
        .sort((a, b) => b.battleCount - a.battleCount)
        .slice(0, 10),
      mostOwners: itemEntries
        .sort((a, b) => b.ownerCount - a.ownerCount)
        .slice(0, 10),
      legendary: itemEntries
        .filter(e => e.rarity === 'legendary')
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),
    }
  }

  getRankings(): RankingsSnapshot {
    if (!this.rankings) {
      this.computeRankings()
    }
    return this.rankings!
  }

  getItemRankings(): ItemRankings {
    if (!this.itemRankings) {
      this.computeItemRankings()
    }
    return this.itemRankings!
  }

  getAgentStats(agentId: string): AgentRankingStats | undefined {
    return this.agentStats.get(agentId)
  }

  getCompareData(agentId: string): AgentCompareData | null {
    const stats = this.agentStats.get(agentId)
    if (!stats) return null

    const agent = this.agentManager.getAgent(agentId)
    if (!agent) return null

    // Extract skills from agent
    const skills: Record<string, number> = {}
    if (agent.skills) {
      Object.assign(skills, agent.skills)
    }

    return {
      agentId: stats.agentId,
      agentName: stats.agentName,
      level: stats.level,
      stats: {
        combat: stats.totalKills + stats.wins,
        economy: stats.gold + stats.inventoryValue,
        crafting: stats.totalCrafted,
        exploration: stats.tilesExplored,
        social: stats.totalRelationships,
        magic: (agent.stats?.mana ?? 0),
      },
      skills,
      gold: stats.gold,
      inventoryValue: stats.inventoryValue,
      totalKills: stats.totalKills,
      totalCrafted: stats.totalCrafted,
      tilesExplored: stats.tilesExplored,
      headToHead: {
        wins: stats.wins,
        losses: stats.totalBattles - stats.wins,
        draws: 0,
      },
    }
  }
}
