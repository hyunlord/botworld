/**
 * Buildings API routes — construction, upgrades, siege, custom designs.
 */

import { Router } from 'express'
import type { BuildingManager } from '../buildings/building-manager.js'
import type { SiegeSystem } from '../buildings/siege-system.js'
import type {
  Building,
  BuildingType,
  BuildingState,
  BuildingDesignRequest,
  BuildingDesignResponse,
} from '@botworld/shared'

export function createBuildingsRouter(
  buildingManager: BuildingManager,
  siegeSystem: SiegeSystem,
  getAgentName: (id: string) => string,
): Router {
  const router = Router()

  // ── Query Endpoints ──

  // GET /api/buildings — list all buildings with optional filters
  router.get('/buildings', (req, res) => {
    const settlementId = req.query.settlementId as string | undefined
    const ownerId = req.query.ownerId as string | undefined
    const type = req.query.type as BuildingType | undefined
    const state = req.query.state as BuildingState | undefined

    let buildings = buildingManager.getAllBuildings()

    if (settlementId) {
      buildings = buildings.filter(b => b.settlementId === settlementId)
    }
    if (ownerId) {
      buildings = buildings.filter(b => b.ownerId === ownerId)
    }
    if (type) {
      buildings = buildings.filter(b => b.type === type)
    }
    if (state) {
      buildings = buildings.filter(b => b.state === state)
    }

    res.json({ count: buildings.length, buildings })
  })

  // GET /api/buildings/:id — get building details
  router.get('/buildings/:id', (req, res) => {
    const building = buildingManager.getBuilding(req.params.id)
    if (!building) {
      res.status(404).json({ error: 'Building not found' })
      return
    }

    // Include functionality info
    const functionality = buildingManager.getBuildingFunctionality(req.params.id)

    res.json({
      ...building,
      functionality,
      healthPercent: Math.round((building.hp / building.maxHp) * 100),
    })
  })

  // GET /api/buildings/:id/storage — get building storage contents
  router.get('/buildings/:id/storage', (req, res) => {
    const building = buildingManager.getBuilding(req.params.id)
    if (!building) {
      res.status(404).json({ error: 'Building not found' })
      return
    }
    res.json({ storage: building.storage })
  })

  // GET /api/buildings/at/:x/:y — get buildings at a position
  router.get('/buildings/at/:x/:y', (req, res) => {
    const x = parseInt(req.params.x, 10)
    const y = parseInt(req.params.y, 10)

    if (isNaN(x) || isNaN(y)) {
      res.status(400).json({ error: 'Invalid coordinates' })
      return
    }

    const buildings = buildingManager.getBuildingsAt(x, y)
    res.json({ x, y, count: buildings.length, buildings })
  })

  // GET /api/buildings/settlement/:settlementId — get all buildings in a settlement
  router.get('/buildings/settlement/:settlementId', (req, res) => {
    const buildings = buildingManager.getBuildingsInSettlement(req.params.settlementId)
    res.json({
      settlementId: req.params.settlementId,
      count: buildings.length,
      buildings,
    })
  })

  // ── Action Endpoints ──

  // POST /api/buildings/construct — start construction
  router.post('/buildings/construct', (req, res) => {
    const { type, name, x, y, settlementId, guildId, ownerId, builderId, tick, style } = req.body as {
      type: BuildingType
      name: string
      x: number
      y: number
      settlementId?: string
      guildId?: string
      ownerId?: string
      builderId: string
      tick: number
      style?: string
    }

    if (!type || !name || x === undefined || y === undefined || !builderId || tick === undefined) {
      res.status(400).json({ error: 'Missing required fields: type, name, x, y, builderId, tick' })
      return
    }

    // Validate building type
    if (type === 'custom') {
      res.status(400).json({ error: 'Use /buildings/design endpoint for custom buildings' })
      return
    }

    // Check if position is available
    const existing = buildingManager.getBuildingsAt(x, y)
    if (existing.length > 0) {
      res.status(400).json({ error: 'Position already occupied by another building' })
      return
    }

    try {
      const building = buildingManager.createBuilding(
        type,
        name,
        { x, y },
        builderId,
        tick,
        { settlementId, ownerId, guildId, style },
      )

      res.status(201).json(building)
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Could not create building' })
    }
  })

  // POST /api/buildings/design — design a custom building (bot API)
  router.post('/buildings/design', (req, res) => {
    const { builderId, tick, ...designRequest } = req.body as BuildingDesignRequest & {
      builderId: string
      tick: number
    }

    if (!designRequest.name || !designRequest.description || !designRequest.size || !designRequest.rooms) {
      res.status(400).json({ error: 'Missing required fields: name, description, size, rooms' })
      return
    }

    // Cost estimate only
    if (designRequest.cost_estimate === true) {
      const estimate = buildingManager.estimateCustomBuildingCost(designRequest)
      res.json(estimate as BuildingDesignResponse)
      return
    }

    // Create the custom building
    if (!designRequest.location) {
      res.status(400).json({ error: 'Location required to build custom building' })
      return
    }

    if (!builderId || tick === undefined) {
      res.status(400).json({ error: 'Missing required fields: builderId, tick' })
      return
    }

    try {
      const building = buildingManager.createCustomBuilding(designRequest, builderId, tick)
      res.status(201).json(building)
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Could not create custom building' })
    }
  })

  // POST /api/buildings/:id/upgrade — upgrade a building
  router.post('/buildings/:id/upgrade', (req, res) => {
    const { tick } = req.body as { tick: number }

    if (tick === undefined) {
      res.status(400).json({ error: 'Missing required field: tick' })
      return
    }

    const building = buildingManager.getBuilding(req.params.id)
    if (!building) {
      res.status(404).json({ error: 'Building not found' })
      return
    }

    if (!buildingManager.canUpgrade(req.params.id)) {
      res.status(400).json({ error: 'Building cannot be upgraded (max level or invalid state)' })
      return
    }

    try {
      const success = buildingManager.upgradeBuilding(req.params.id, tick)
      if (!success) {
        res.status(400).json({ error: 'Could not upgrade building' })
        return
      }
      const updated = buildingManager.getBuilding(req.params.id)
      res.json(updated)
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Could not upgrade building' })
    }
  })

  // POST /api/buildings/:id/repair — repair a building
  router.post('/buildings/:id/repair', (req, res) => {
    const { repairerId, tick } = req.body as { repairerId: string; tick: number }

    if (!repairerId || tick === undefined) {
      res.status(400).json({ error: 'Missing required fields: repairerId, tick' })
      return
    }

    const building = buildingManager.getBuilding(req.params.id)
    if (!building) {
      res.status(404).json({ error: 'Building not found' })
      return
    }

    if (building.state === 'destroyed') {
      res.status(400).json({ error: 'Cannot repair destroyed building' })
      return
    }

    if (building.hp >= building.maxHp) {
      res.status(400).json({ error: 'Building is already at full health' })
      return
    }

    try {
      // Simplified repair: restore 25% HP per repair action
      const repairAmount = Math.ceil(building.maxHp * 0.25)
      const success = buildingManager.repairBuilding(req.params.id, repairerId, repairAmount, tick)
      if (!success) {
        res.status(400).json({ error: 'Could not repair building' })
        return
      }
      const updated = buildingManager.getBuilding(req.params.id)
      res.json(updated)
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Could not repair building' })
    }
  })

  // POST /api/buildings/:id/demolish — demolish a building
  router.post('/buildings/:id/demolish', (req, res) => {
    const building = buildingManager.getBuilding(req.params.id)
    if (!building) {
      res.status(404).json({ error: 'Building not found' })
      return
    }

    try {
      const success = buildingManager.demolishBuilding(req.params.id)
      if (!success) {
        res.status(400).json({ error: 'Could not demolish building' })
        return
      }
      res.json({ success: true, message: 'Building demolished' })
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Could not demolish building' })
    }
  })

  // POST /api/buildings/:id/workers — add a worker
  router.post('/buildings/:id/workers', (req, res) => {
    const { agentId } = req.body as { agentId: string }

    if (!agentId) {
      res.status(400).json({ error: 'Missing agentId' })
      return
    }

    const building = buildingManager.getBuilding(req.params.id)
    if (!building) {
      res.status(404).json({ error: 'Building not found' })
      return
    }

    if (building.workers.includes(agentId)) {
      res.status(400).json({ error: 'Agent is already a worker' })
      return
    }

    try {
      buildingManager.addWorker(req.params.id, agentId)
      const updated = buildingManager.getBuilding(req.params.id)
      res.json(updated)
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Could not add worker' })
    }
  })

  // DELETE /api/buildings/:id/workers/:agentId — remove a worker
  router.delete('/buildings/:id/workers/:agentId', (req, res) => {
    const building = buildingManager.getBuilding(req.params.id)
    if (!building) {
      res.status(404).json({ error: 'Building not found' })
      return
    }

    if (!building.workers.includes(req.params.agentId)) {
      res.status(400).json({ error: 'Agent is not a worker' })
      return
    }

    try {
      buildingManager.removeWorker(req.params.id, req.params.agentId)
      const updated = buildingManager.getBuilding(req.params.id)
      res.json(updated)
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Could not remove worker' })
    }
  })

  // POST /api/buildings/:id/storage — add item to storage
  router.post('/buildings/:id/storage', (req, res) => {
    const { itemId, name, quantity } = req.body as {
      itemId: string
      name: string
      quantity: number
    }

    if (!itemId || !name || !quantity || quantity <= 0) {
      res.status(400).json({ error: 'Missing or invalid fields: itemId, name, quantity' })
      return
    }

    const building = buildingManager.getBuilding(req.params.id)
    if (!building) {
      res.status(404).json({ error: 'Building not found' })
      return
    }

    try {
      const success = buildingManager.addToStorage(req.params.id, itemId, name, quantity)
      if (!success) {
        res.status(400).json({ error: 'Could not add item to storage' })
        return
      }
      const updated = buildingManager.getBuilding(req.params.id)
      res.json(updated)
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Could not add item to storage' })
    }
  })

  // DELETE /api/buildings/:id/storage/:itemId — remove item from storage
  router.delete('/buildings/:id/storage/:itemId', (req, res) => {
    const quantity = parseInt(req.query.quantity as string, 10)

    const building = buildingManager.getBuilding(req.params.id)
    if (!building) {
      res.status(404).json({ error: 'Building not found' })
      return
    }

    const item = building.storage.find(i => i.itemId === req.params.itemId)
    if (!item) {
      res.status(404).json({ error: 'Item not found in storage' })
      return
    }

    const removeQuantity = quantity && !isNaN(quantity) ? quantity : item.quantity

    try {
      const success = buildingManager.removeFromStorage(req.params.id, req.params.itemId, removeQuantity)
      if (!success) {
        res.status(400).json({ error: 'Could not remove item from storage' })
        return
      }
      const updated = buildingManager.getBuilding(req.params.id)
      res.json(updated)
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Could not remove item from storage' })
    }
  })

  // ── Siege Endpoints ──

  // GET /api/sieges — list active sieges
  router.get('/sieges', (_req, res) => {
    const sieges = siegeSystem.getActiveSieges()
    res.json({ count: sieges.length, sieges })
  })

  // GET /api/sieges/:id — get siege details with battle report
  router.get('/sieges/:id', (req, res) => {
    const siege = siegeSystem.getSiege(req.params.id)
    if (!siege) {
      res.status(404).json({ error: 'Siege not found' })
      return
    }

    const battleReport = siegeSystem.formatBattleReport(req.params.id)
    res.json({ ...siege, battleReport })
  })

  // POST /api/sieges — start a siege
  router.post('/sieges', (req, res) => {
    const {
      attackerId,
      attackerName,
      defenderId,
      defenderName,
      position,
      force,
      weapons,
      tick,
    } = req.body as {
      attackerId: string
      attackerName: string
      defenderId: string
      defenderName: string
      position: { x: number; y: number }
      force: number
      weapons: { type: 'catapult' | 'battering_ram' | 'siege_ladder' | 'fire_arrows'; count: number }[]
      tick: number
    }

    if (!attackerId || !defenderId || !position || !force || tick === undefined) {
      res.status(400).json({ error: 'Missing required fields: attackerId, defenderId, position, force, tick' })
      return
    }

    // Validate position has a building
    const buildings = buildingManager.getBuildingsAt(position.x, position.y)
    if (buildings.length === 0) {
      res.status(400).json({ error: 'No building at specified position' })
      return
    }

    const targetBuilding = buildings[0]
    if (targetBuilding.ownerId !== defenderId && targetBuilding.settlementId !== defenderId) {
      res.status(400).json({ error: 'Defender does not own the target building' })
      return
    }

    try {
      const siege = siegeSystem.startSiege(
        attackerId,
        attackerName || getAgentName(attackerId),
        defenderId,
        defenderName || getAgentName(defenderId),
        position,
        force,
        weapons || [],
        tick,
      )

      res.status(201).json(siege)
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Could not start siege' })
    }
  })

  return router
}
