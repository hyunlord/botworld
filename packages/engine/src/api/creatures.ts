import { Router } from 'express'
import type { WorldEngine } from '../core/world-engine.js'

export function createCreaturesRouter(world: WorldEngine): Router {
  const router = Router()

  // GET /creatures - list all alive creatures
  router.get('/creatures', (_req, res) => {
    const creatures = world.creatureManager.getAliveCreatures()
    res.json(creatures)
  })

  // GET /creatures/:id
  router.get('/creatures/:id', (req, res) => {
    const creature = world.creatureManager.getCreature(req.params.id)
    if (!creature) return res.status(404).json({ error: 'Creature not found' })
    res.json(creature)
  })

  // GET /creatures/at/:x/:y?radius=N
  router.get('/creatures/at/:x/:y', (req, res) => {
    const x = parseInt(req.params.x)
    const y = parseInt(req.params.y)
    const radius = parseInt(req.query.radius as string) || 5
    const creatures = world.creatureManager.getCreaturesInArea(x, y, radius)
    res.json(creatures)
  })

  // GET /creatures/type/:templateId
  router.get('/creatures/type/:templateId', (req, res) => {
    const creatures = world.creatureManager.getCreaturesByType(req.params.templateId)
    res.json(creatures)
  })

  // POST /creatures/spawn (admin)
  router.post('/creatures/spawn', (req, res) => {
    const { templateId, x, y, customName, packId, denId } = req.body
    if (!templateId || x == null || y == null) {
      return res.status(400).json({ error: 'templateId, x, y required' })
    }
    const creature = world.creatureManager.spawnCreature(templateId, { x, y }, { customName, packId, denId })
    if (!creature) return res.status(400).json({ error: 'Invalid template or spawn failed' })
    res.json(creature)
  })

  // DELETE /creatures/:id/kill
  router.delete('/creatures/:id/kill', (req, res) => {
    const loot = world.creatureManager.killCreature(req.params.id, req.body?.killerId ?? null)
    res.json({ loot })
  })

  // ── Packs ──

  router.get('/packs', (_req, res) => {
    res.json(world.packManager.getAllPacks())
  })

  router.get('/packs/:id', (req, res) => {
    const pack = world.packManager.getPack(req.params.id)
    if (!pack) return res.status(404).json({ error: 'Pack not found' })
    res.json(pack)
  })

  // ── Dens ──

  router.get('/dens', (_req, res) => {
    res.json(world.denManager.getAllDens())
  })

  router.get('/dens/:id', (req, res) => {
    const den = world.denManager.getDen(req.params.id)
    if (!den) return res.status(404).json({ error: 'Den not found' })
    res.json({
      ...den,
      description: world.denManager.formatForLLM(req.params.id),
    })
  })

  router.get('/dens/discovered', (_req, res) => {
    res.json(world.denManager.getDiscoveredDens())
  })

  // POST /dens/:id/discover
  router.post('/dens/:id/discover', (req, res) => {
    const den = world.denManager.getDen(req.params.id)
    if (!den) return res.status(404).json({ error: 'Den not found' })
    world.denManager.discoverDen(req.params.id, req.body?.discoveredBy ?? 'unknown', world.clock.tick)
    res.json({ success: true })
  })

  return router
}
