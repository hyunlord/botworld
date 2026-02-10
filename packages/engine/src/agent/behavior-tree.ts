import type { Agent, AgentAction, ActionType, WorldClock, Position } from '@botworld/shared'
import type { TileMap } from '../world/tile-map.js'
import type { AgentGoal } from './goal-system.js'

export type BehaviorResult = 'success' | 'failure' | 'running'

/**
 * Behavior tree that determines an agent's next action.
 * Priority: critical needs → active goal → social opportunity → idle exploration
 */
export function evaluateBehavior(
  agent: Agent,
  clock: WorldClock,
  map: TileMap,
  currentGoal?: AgentGoal,
  nearbyAgents?: Agent[],
): AgentAction | null {
  // Priority 1: Critical needs
  const critical = checkCriticalNeeds(agent, clock)
  if (critical) return critical

  // Priority 2: Continue current action
  if (agent.currentAction && !isActionComplete(agent.currentAction, clock.tick)) {
    return null // keep current action
  }

  // Priority 3: Execute current goal from day plan
  if (currentGoal) {
    const goalAction = executeGoal(agent, currentGoal, clock, map, nearbyAgents ?? [])
    if (goalAction) return goalAction
  }

  // Priority 4: Opportunistic social interaction
  if (nearbyAgents && nearbyAgents.length > 0 && agent.personality.extraversion > 0.3) {
    const socialAction = trySocialize(agent, clock, nearbyAgents)
    if (socialAction) return socialAction
  }

  // Priority 5: Scheduled activities based on time of day
  const scheduled = getScheduledAction(agent, clock, map)
  if (scheduled) return scheduled

  // Priority 6: Idle exploration
  return createIdleAction(agent, clock, map)
}

function checkCriticalNeeds(agent: Agent, clock: WorldClock): AgentAction | null {
  if (agent.stats.hunger < 20) {
    const food = agent.inventory.find(i => i.type === 'food' && i.quantity > 0)
    if (food) {
      return {
        type: 'eat',
        targetItemId: food.id,
        startedAt: clock.tick,
        duration: 3,
      }
    }
  }

  if (agent.stats.energy < 15) {
    return {
      type: 'rest',
      startedAt: clock.tick,
      duration: 30,
    }
  }

  return null
}

function executeGoal(
  agent: Agent,
  goal: AgentGoal,
  clock: WorldClock,
  map: TileMap,
  nearbyAgents: Agent[],
): AgentAction | null {
  switch (goal.actionType) {
    case 'gather': {
      const resourceTile = findNearestResource(agent.position, map)
      if (resourceTile) {
        if (agent.position.x !== resourceTile.x || agent.position.y !== resourceTile.y) {
          return { type: 'move', targetPosition: resourceTile, startedAt: clock.tick, duration: 2 }
        }
        return { type: 'gather', targetPosition: resourceTile, startedAt: clock.tick, duration: 10 }
      }
      return null
    }

    case 'talk': {
      const target = goal.targetAgentId
        ? nearbyAgents.find(a => a.id === goal.targetAgentId)
        : nearbyAgents[0]
      if (target) {
        const dist = Math.abs(agent.position.x - target.position.x) + Math.abs(agent.position.y - target.position.y)
        if (dist > 2) {
          return { type: 'move', targetPosition: target.position, startedAt: clock.tick, duration: 2 }
        }
        return { type: 'talk', targetAgentId: target.id, startedAt: clock.tick, duration: 5 }
      }
      return null
    }

    case 'explore': {
      const target = findExplorationTarget(agent.position, map)
      return { type: 'move', targetPosition: target, startedAt: clock.tick, duration: 2 }
    }

    case 'craft': {
      if (agent.inventory.length >= 2) {
        return { type: 'craft', startedAt: clock.tick, duration: 15 }
      }
      return null
    }

    case 'trade': {
      const target = goal.targetAgentId
        ? nearbyAgents.find(a => a.id === goal.targetAgentId)
        : nearbyAgents.find(a => a.inventory.length > 0)
      if (target) {
        const dist = Math.abs(agent.position.x - target.position.x) + Math.abs(agent.position.y - target.position.y)
        if (dist > 1) {
          return { type: 'move', targetPosition: target.position, startedAt: clock.tick, duration: 2 }
        }
        return { type: 'trade', targetAgentId: target.id, startedAt: clock.tick, duration: 8 }
      }
      return null
    }

    case 'rest':
      return { type: 'rest', startedAt: clock.tick, duration: 30 }

    default:
      return null
  }
}

function trySocialize(agent: Agent, clock: WorldClock, nearbyAgents: Agent[]): AgentAction | null {
  if (Math.random() > agent.personality.extraversion * 0.3) return null

  const target = nearbyAgents.find(a => {
    const dist = Math.abs(agent.position.x - a.position.x) + Math.abs(agent.position.y - a.position.y)
    return dist <= 2 && a.currentAction?.type !== 'talk' && a.currentAction?.type !== 'rest'
  })

  if (target) {
    return { type: 'talk', targetAgentId: target.id, startedAt: clock.tick, duration: 5 }
  }

  return null
}

function getScheduledAction(agent: Agent, clock: WorldClock, map: TileMap): AgentAction | null {
  if (clock.timeOfDay === 'night') {
    return { type: 'rest', startedAt: clock.tick, duration: 60 }
  }

  if (clock.timeOfDay === 'morning' && agent.inventory.length < 5) {
    const resourceTile = findNearestResource(agent.position, map)
    if (resourceTile) {
      return { type: 'gather', targetPosition: resourceTile, startedAt: clock.tick, duration: 10 }
    }
  }

  return null
}

function createIdleAction(agent: Agent, clock: WorldClock, map: TileMap): AgentAction {
  // Explore with some purpose instead of pure random
  if (Math.random() < 0.3) {
    const target = findExplorationTarget(agent.position, map)
    return { type: 'move', targetPosition: target, startedAt: clock.tick, duration: 2 }
  }

  const neighbors = map.getNeighbors(agent.position)
  if (neighbors.length === 0) {
    return { type: 'idle', startedAt: clock.tick, duration: 5 }
  }

  const target = neighbors[Math.floor(Math.random() * neighbors.length)]
  return { type: 'move', targetPosition: target, startedAt: clock.tick, duration: 2 }
}

function isActionComplete(action: AgentAction, currentTick: number): boolean {
  return currentTick >= action.startedAt + action.duration
}

function findNearestResource(pos: Position, map: TileMap, radius = 10): Position | null {
  let closest: Position | null = null
  let closestDist = Infinity

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = pos.x + dx
      const y = pos.y + dy
      const tile = map.getTile(x, y)
      if (tile?.resource && tile.resource.amount >= 1 && tile.walkable) {
        const dist = Math.abs(dx) + Math.abs(dy)
        if (dist < closestDist) {
          closestDist = dist
          closest = { x, y }
        }
      }
    }
  }

  return closest
}

function findExplorationTarget(pos: Position, map: TileMap): Position {
  const radius = 5 + Math.floor(Math.random() * 5)
  const angle = Math.random() * Math.PI * 2
  let tx = Math.round(pos.x + Math.cos(angle) * radius)
  let ty = Math.round(pos.y + Math.sin(angle) * radius)

  tx = Math.max(1, Math.min(map.width - 2, tx))
  ty = Math.max(1, Math.min(map.height - 2, ty))

  if (!map.isWalkable(tx, ty)) {
    const neighbors = map.getNeighbors({ x: tx, y: ty })
    if (neighbors.length > 0) return neighbors[0]
    return pos
  }

  return { x: tx, y: ty }
}
