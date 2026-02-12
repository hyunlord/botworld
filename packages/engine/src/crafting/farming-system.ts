import type { CropPlot, FarmState, FarmStructure, WorldClock, CropType, FarmStructureType } from '@botworld/shared'
import { generateId } from '@botworld/shared'
import type { EventBus } from '../core/event-bus.js'
// @ts-ignore - JS file
import { CROPS, ORCHARD_TREES } from './recipe-data.js'

interface CropConfig {
  type: string
  outputId: string
  growthTicks: { spring: number | null; summer: number | null; autumn: number | null; winter: number | null }
  yieldMin: number
  yieldMax: number
  seedReturnRate: number
}

export class FarmingSystem {
  private farms = new Map<string, FarmState>()

  constructor(private eventBus: EventBus) {}

  /** Register a farm building */
  registerFarm(farmId: string): FarmState {
    const state: FarmState = {
      farmId,
      plots: [],
      structures: [],
      lastTickedAt: 0,
    }
    this.farms.set(farmId, state)
    return state
  }

  /** Plant a crop */
  plantCrop(farmId: string, cropType: string, position: { x: number; y: number }, season: string, tick: number): CropPlot | null {
    const farm = this.farms.get(farmId)
    if (!farm) return null

    const cropConfig = CROPS.find((c: CropConfig) => c.type === cropType)
    if (!cropConfig) return null

    const seasonKey = season as keyof typeof cropConfig.growthTicks
    const maturityTicks = cropConfig.growthTicks[seasonKey]
    if (maturityTicks === null) return null // can't plant in winter

    const plot: CropPlot = {
      id: generateId(),
      farmId,
      cropType: cropType as any,
      plantedAt: tick,
      growthProgress: 0,
      maturityTicks,
      waterLevel: 50,
      quality: 50,
      isReady: false,
      season,
      position,
    }

    farm.plots.push(plot)

    this.eventBus.emit({
      type: 'farming:planted',
      farmId,
      cropType,
      plotId: plot.id,
      position,
      timestamp: 0,
    } as any)

    return plot
  }

  /** Tick farming — grow crops, produce from structures */
  tick(clock: WorldClock, currentSeason: string, isRaining: boolean): void {
    for (const farm of this.farms.values()) {
      farm.lastTickedAt = clock.tick

      // Grow crops
      for (const plot of farm.plots) {
        if (plot.isReady) continue

        // Winter = no growth
        if (currentSeason === 'winter') continue

        // Growth rate modifiers
        let growthRate = 1.0
        if (plot.waterLevel > 70) growthRate += 0.2  // well-watered
        if (isRaining) growthRate += 0.1
        if (currentSeason === 'spring' || currentSeason === 'summer') growthRate += 0.1

        plot.growthProgress += (100 / plot.maturityTicks) * growthRate

        // Water decreases over time
        plot.waterLevel = Math.max(0, plot.waterLevel - 1)
        if (isRaining) plot.waterLevel = Math.min(100, plot.waterLevel + 5)

        // Quality affected by water
        if (plot.waterLevel < 20) plot.quality = Math.max(0, plot.quality - 1)
        if (plot.waterLevel > 60) plot.quality = Math.min(100, plot.quality + 0.2)

        if (plot.growthProgress >= 100) {
          plot.isReady = true
          plot.growthProgress = 100
          this.eventBus.emit({
            type: 'farming:ready',
            farmId: farm.farmId,
            cropType: plot.cropType,
            plotId: plot.id,
            timestamp: 0,
          } as any)
        }
      }

      // Production structures (beehive, fish_pond)
      for (const structure of farm.structures) {
        if (!structure.production) continue
        const elapsed = clock.tick - structure.production.lastProducedAt
        if (elapsed >= structure.production.interval) {
          structure.production.lastProducedAt = clock.tick
          this.eventBus.emit({
            type: 'farming:produced',
            farmId: farm.farmId,
            structureType: structure.type,
            itemId: structure.production.itemId,
            timestamp: 0,
          } as any)
        }
      }
    }
  }

  /** Harvest a crop — returns items */
  harvest(farmId: string, plotId: string, farmerSkill: number): { itemId: string; quantity: number; seeds: number } | null {
    const farm = this.farms.get(farmId)
    if (!farm) return null

    const plotIdx = farm.plots.findIndex(p => p.id === plotId)
    if (plotIdx === -1) return null

    const plot = farm.plots[plotIdx]
    if (!plot.isReady) return null

    const cropConfig = CROPS.find((c: CropConfig) => c.type === plot.cropType)
    if (!cropConfig) return null

    // Calculate yield
    const qualityBonus = plot.quality / 100
    const skillBonus = Math.min(farmerSkill / 100, 0.5)
    const baseYield = cropConfig.yieldMin + Math.floor(Math.random() * (cropConfig.yieldMax - cropConfig.yieldMin + 1))
    const totalYield = Math.round(baseYield * (1 + qualityBonus * 0.3 + skillBonus))
    const seeds = Math.max(1, Math.round(totalYield * cropConfig.seedReturnRate))

    // Remove plot
    farm.plots.splice(plotIdx, 1)

    this.eventBus.emit({
      type: 'farming:harvested',
      farmId,
      cropType: plot.cropType,
      quantity: totalYield,
      timestamp: 0,
    } as any)

    return {
      itemId: cropConfig.outputId,
      quantity: totalYield,
      seeds,
    }
  }

  /** Water a plot */
  waterPlot(farmId: string, plotId: string): boolean {
    const farm = this.farms.get(farmId)
    if (!farm) return false
    const plot = farm.plots.find(p => p.id === plotId)
    if (!plot) return false
    plot.waterLevel = Math.min(100, plot.waterLevel + 30)
    return true
  }

  /** Add a farm structure (beehive, fish_pond, etc.) */
  addStructure(farmId: string, type: string, position: { x: number; y: number }): FarmStructure | null {
    const farm = this.farms.get(farmId)
    if (!farm) return null

    const productions: Record<string, { itemId: string; interval: number }> = {
      beehive: { itemId: 'honey', interval: 40 },
      fish_pond: { itemId: 'fish', interval: 30 },
    }

    const structure: FarmStructure = {
      id: generateId(),
      type: type as any,
      position,
      level: 1,
      production: productions[type] ? { ...productions[type], lastProducedAt: 0 } : undefined,
    }

    farm.structures.push(structure)
    return structure
  }

  // ── Queries ──

  getFarm(farmId: string): FarmState | undefined { return this.farms.get(farmId) }
  getAllFarms(): FarmState[] { return Array.from(this.farms.values()) }

  getReadyCrops(farmId: string): CropPlot[] {
    const farm = this.farms.get(farmId)
    return farm?.plots.filter(p => p.isReady) ?? []
  }

  formatForLLM(farmId: string): string {
    const farm = this.farms.get(farmId)
    if (!farm) return '[Farm not found]'
    const growing = farm.plots.filter(p => !p.isReady).length
    const ready = farm.plots.filter(p => p.isReady).length
    const structures = farm.structures.length
    return `[Farm] ${growing} growing, ${ready} ready to harvest, ${structures} structures.`
  }
}
