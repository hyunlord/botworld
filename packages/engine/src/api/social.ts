/**
 * Social API routes — relationships, rumors, secrets, reputation.
 */

import { Router } from 'express'
import type { RelationshipManager } from '../social/relationship-manager.js'
import type { RumorSystem } from '../social/rumor-system.js'
import type { SecretSystem } from '../social/secret-system.js'
import type { ReputationSystem } from '../social/reputation-system.js'

export function createSocialRouter(
  relationshipManager: RelationshipManager,
  rumorSystem: RumorSystem,
  secretSystem: SecretSystem,
  reputationSystem: ReputationSystem,
): Router {
  const router = Router()

  // GET /api/agents/:id/relationships — all relationships FROM this agent
  router.get('/agents/:id/relationships', (req, res) => {
    const rels = relationshipManager.getAgentRelationships(req.params.id)
    res.json({
      agentId: req.params.id,
      relationships: rels.map(r => ({
        toId: r.toId,
        axes: r.axes,
        tags: r.tags,
        memories: r.memories.slice(-10), // Last 10 memories
        firstMet: r.firstMet,
        lastInteraction: r.lastInteraction,
        interactionCount: r.interactionCount,
      })),
    })
  })

  // GET /api/agents/:id/reputation — reputation and social status
  router.get('/agents/:id/reputation', (req, res) => {
    const reputation = reputationSystem.getReputation(req.params.id)
    const status = reputationSystem.getStatus(req.params.id)
    res.json({
      agentId: req.params.id,
      reputation,
      socialStatus: status,
    })
  })

  // GET /api/rumors — all active rumors
  router.get('/rumors', (_req, res) => {
    const rumors = rumorSystem.getAllRumors()
    res.json({ count: rumors.length, rumors })
  })

  // GET /api/agents/:id/rumors — rumors heard by this agent
  router.get('/agents/:id/rumors', (req, res) => {
    const rumors = rumorSystem.getRumorsForAgent(req.params.id, 20)
    res.json({
      agentId: req.params.id,
      rumors,
    })
  })

  // GET /api/secrets — all secrets (admin view)
  router.get('/secrets', (_req, res) => {
    const secrets = secretSystem.getAllSecrets()
    res.json({ count: secrets.length, secrets })
  })

  // GET /api/agents/:id/secrets — secrets known by this agent
  router.get('/agents/:id/secrets', (req, res) => {
    const secrets = secretSystem.getSecretsKnownBy(req.params.id)
    res.json({
      agentId: req.params.id,
      secrets,
    })
  })

  return router
}
