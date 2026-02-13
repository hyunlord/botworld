import type {
  WorldStatistics,
  TimeSeries,
  TimeSeriesPoint,
  DistributionEntry,
  CombatStats,
  EconomyStats,
  PopulationStats,
  EcologyStats,
  PoliticsStats,
  HeatmapCell,
  WorldClock,
  TimelineEvent,
} from '@botworld/shared'
import type { EventBus } from '../core/event-bus.js'
import type { AgentManager } from '../agent/agent-manager.js'
import type {
  CombatStartedEvent,
  CombatEndedEvent,
  TradeCompletedEvent,
} from '@botworld/shared'

export class StatisticsCollector {
  // Time series data (keep last 1000 samples = ~100k ticks)
  private static MAX_SAMPLES = 1000
  private static SAMPLE_INTERVAL = 100 // Sample every 100 ticks

  private gdpSeries: TimeSeriesPoint[] = []
  private tradeVolumeSeries: TimeSeriesPoint[] = []
  private dailyBattles: TimeSeriesPoint[] = []
  private agentCountSeries: TimeSeriesPoint[] = []

  // Per-tick accumulators (reset each sample)
  private battlesSinceLastSample = 0
  private tradeVolumeSinceLastSample = 0
  private recentTradePositions: { x: number; y: number }[] = []
  private recentCombatPositions: { x: number; y: number }[] = []
  private monsterKills: Record<string, number> = {}
  private pvpCount = 0
  private pveCount = 0
  private battleDurations: number[] = []

  // Item price tracking
  private priceHistory: Record<string, TimeSeriesPoint[]> = {}
  private lastPrices: Record<string, number> = {}

  // Creature population tracking
  private creaturePopulations: Record<string, TimeSeriesPoint[]> = {}

  private lastSampleTick = 0

  constructor(
    private eventBus: EventBus,
    private agentManager: AgentManager,
    private getClockFn: () => WorldClock,
  ) {
    this.subscribeEvents()
  }

  private subscribeEvents(): void {
    this.eventBus.on('combat:started', (event) => {
      const e = event as CombatStartedEvent
      this.battlesSinceLastSample++
      this.recentCombatPositions.push({ x: e.position.x, y: e.position.y })
    })

    this.eventBus.on('combat:ended', (event) => {
      const e = event as CombatEndedEvent

      // Track PvP vs PvE (monsters have specific ID patterns, agents have agent prefix)
      if (e.monsterId.startsWith('agent_')) {
        this.pvpCount++
      } else {
        this.pveCount++
        // Track monster kills by type
        const monsterType = e.monsterId.split('_')[0] // Extract type from ID
        this.monsterKills[monsterType] = (this.monsterKills[monsterType] || 0) + 1
      }

      // Estimate battle duration (could be improved with actual combat tracking)
      const estimatedDuration = 5 + Math.floor(Math.random() * 10)
      this.battleDurations.push(estimatedDuration)
    })

    this.eventBus.on('trade:completed', (event) => {
      const e = event as TradeCompletedEvent
      this.tradeVolumeSinceLastSample += e.price

      // Track item prices
      const itemName = e.item.name
      this.lastPrices[itemName] = e.price

      // Track trade position for heatmap (use timestamp as approximate position)
      // In a real implementation, this would come from the trade event position
      const posX = Math.floor(Math.random() * 100)
      const posY = Math.floor(Math.random() * 100)
      this.recentTradePositions.push({ x: posX, y: posY })
    })
  }

  tick(currentTick: number): void {
    if (currentTick - this.lastSampleTick >= StatisticsCollector.SAMPLE_INTERVAL) {
      this.sample(currentTick)
      this.lastSampleTick = currentTick
    }
  }

  private sample(tick: number): void {
    const clock = this.getClockFn()

    // Calculate GDP (total gold across all agents)
    let totalGold = 0
    const agents = (this.agentManager as any).agents as Map<string, any>
    for (const runtime of agents.values()) {
      totalGold += runtime.agent.stats?.gold || 0
    }

    // Add data points
    this.addSample(this.gdpSeries, { tick, day: clock.day, value: totalGold })
    this.addSample(this.tradeVolumeSeries, { tick, day: clock.day, value: this.tradeVolumeSinceLastSample })
    this.addSample(this.dailyBattles, { tick, day: clock.day, value: this.battlesSinceLastSample })
    this.addSample(this.agentCountSeries, { tick, day: clock.day, value: agents.size })

    // Track prices for each item type
    for (const [itemName, price] of Object.entries(this.lastPrices)) {
      if (!this.priceHistory[itemName]) {
        this.priceHistory[itemName] = []
      }
      this.addSample(this.priceHistory[itemName], { tick, day: clock.day, value: price })
    }

    // Reset accumulators
    this.battlesSinceLastSample = 0
    this.tradeVolumeSinceLastSample = 0
  }

  private addSample(series: TimeSeriesPoint[], point: TimeSeriesPoint): void {
    series.push(point)
    if (series.length > StatisticsCollector.MAX_SAMPLES) {
      series.shift() // Remove oldest sample
    }
  }

  getStatistics(): WorldStatistics {
    const clock = this.getClockFn()
    const agents = (this.agentManager as any).agents as Map<string, any>

    // Calculate total gold circulating
    let totalGold = 0
    const agentGolds: number[] = []
    for (const runtime of agents.values()) {
      const gold = runtime.agent.stats?.gold || 0
      totalGold += gold
      agentGolds.push(gold)
    }

    // Wealth distribution (top 10% vs bottom 50%)
    agentGolds.sort((a, b) => b - a)
    const top10Count = Math.max(1, Math.floor(agentGolds.length * 0.1))
    const bottom50Count = Math.max(1, Math.floor(agentGolds.length * 0.5))
    const top10Wealth = agentGolds.slice(0, top10Count).reduce((sum, g) => sum + g, 0)
    const bottom50Wealth = agentGolds.slice(-bottom50Count).reduce((sum, g) => sum + g, 0)

    const wealthDistribution: DistributionEntry[] = [
      { label: 'Top 10%', value: top10Wealth },
      { label: 'Middle 40%', value: totalGold - top10Wealth - bottom50Wealth },
      { label: 'Bottom 50%', value: bottom50Wealth },
    ]

    // Trade heatmap (aggregate positions into grid cells)
    const tradeHeatmap = this.buildHeatmap(this.recentTradePositions)
    const dangerousAreas = this.buildHeatmap(this.recentCombatPositions)

    // Average item price
    const avgItemPrice = Object.values(this.lastPrices).length > 0
      ? Object.values(this.lastPrices).reduce((sum, p) => sum + p, 0) / Object.values(this.lastPrices).length
      : 0

    // Monster kills distribution
    const monsterKillsByType: DistributionEntry[] = Object.entries(this.monsterKills).map(([type, count]) => ({
      label: type,
      value: count,
    }))

    // PvP vs PvE ratio
    const totalCombats = this.pvpCount + this.pveCount
    const pvpVsPveRatio = {
      pvp: totalCombats > 0 ? this.pvpCount / totalCombats : 0,
      pve: totalCombats > 0 ? this.pveCount / totalCombats : 1,
    }

    // Average battle duration
    const avgBattleDuration = this.battleDurations.length > 0
      ? this.battleDurations.reduce((sum, d) => sum + d, 0) / this.battleDurations.length
      : 0

    // Level distribution (histogram)
    const levelCounts: Record<number, number> = {}
    for (const runtime of agents.values()) {
      const level = runtime.agent.level || 1
      levelCounts[level] = (levelCounts[level] || 0) + 1
    }
    const levelDistribution: DistributionEntry[] = Object.entries(levelCounts).map(([level, count]) => ({
      label: `Level ${level}`,
      value: count,
    }))

    // Race distribution (placeholder - would need character data)
    const raceDistribution: DistributionEntry[] = [
      { label: 'Human', value: Math.floor(agents.size * 0.4) },
      { label: 'Elf', value: Math.floor(agents.size * 0.3) },
      { label: 'Dwarf', value: Math.floor(agents.size * 0.2) },
      { label: 'Other', value: Math.floor(agents.size * 0.1) },
    ]

    // Build price series
    const priceSeries: Record<string, TimeSeries> = {}
    for (const [itemName, data] of Object.entries(this.priceHistory)) {
      priceSeries[itemName] = {
        label: itemName,
        data,
      }
    }

    // Build economy stats
    const economy: EconomyStats = {
      priceSeries,
      gdpSeries: { label: 'Total GDP', data: this.gdpSeries },
      wealthDistribution,
      totalGoldCirculating: totalGold,
      avgItemPrice,
      tradeVolumeSeries: { label: 'Trade Volume', data: this.tradeVolumeSeries },
      tradeHeatmap,
    }

    // Build combat stats
    const combat: CombatStats = {
      dailyBattles: { label: 'Daily Battles', data: this.dailyBattles },
      monsterKillsByType,
      pvpVsPveRatio,
      avgBattleDuration,
      dangerousAreas,
      warTimeline: [], // Placeholder - would need war system integration
    }

    // Build population stats
    const population: PopulationStats = {
      totalAgentsSeries: { label: 'Total Agents', data: this.agentCountSeries },
      raceDistribution,
      townPopulations: [], // Placeholder
      levelDistribution,
      classDistribution: [], // Placeholder
    }

    // Build ecology stats
    const ecology: EcologyStats = {
      creaturePopulations: {}, // Placeholder - would need creature manager
      resourceRegen: { label: 'Resource Regen', data: [] },
      resourceConsumption: { label: 'Resource Consumption', data: [] },
      biomeResources: [],
      desertificationWarnings: [],
    }

    // Build politics stats
    const politics: PoliticsStats = {
      guildPower: [],
      recentElections: [],
      activeWars: [],
      treaties: [],
      nationPower: [],
    }

    return {
      economy,
      combat,
      population,
      ecology,
      politics,
      lastUpdated: clock.tick,
    }
  }

  private buildHeatmap(positions: { x: number; y: number }[]): HeatmapCell[] {
    const CELL_SIZE = 10 // Grid cell size
    const cellCounts = new Map<string, number>()

    for (const pos of positions) {
      const cellX = Math.floor(pos.x / CELL_SIZE) * CELL_SIZE
      const cellY = Math.floor(pos.y / CELL_SIZE) * CELL_SIZE
      const key = `${cellX},${cellY}`
      cellCounts.set(key, (cellCounts.get(key) || 0) + 1)
    }

    const heatmap: HeatmapCell[] = []
    for (const [key, value] of cellCounts.entries()) {
      const [x, y] = key.split(',').map(Number)
      heatmap.push({ x, y, value })
    }

    return heatmap
  }

  getTimelineEvents(): TimelineEvent[] {
    // Placeholder - would integrate with world-history-manager
    return []
  }
}
