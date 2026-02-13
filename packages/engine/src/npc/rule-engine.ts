import type { Agent, ActionPlan, NpcRole, Position } from '@botworld/shared'

export const RULE_ENGINE_VERSION = 1

export interface RuleContext {
  agent: Agent
  timeOfDay: string // 'dawn' | 'morning' | 'noon' | 'afternoon' | 'evening' | 'night'
  nearbyAgents: { id: string; name: string; isNpc: boolean; role?: string; distance: number }[]
  inCombat: boolean
  nearbyEnemies: { id: string; name: string; distance: number }[]
  hasNearbyConversation: boolean
  poiName?: string
}

// Helper: Check if agent has item by name substring
function hasItem(agent: Agent, namePattern: string): boolean {
  return agent.inventory.some(item =>
    item.name.toLowerCase().includes(namePattern.toLowerCase())
  )
}

// Helper: Find best food item in inventory
function findFoodItem(agent: Agent): string | null {
  const foodItems = agent.inventory.filter(item =>
    item.type === 'food' ||
    item.name.toLowerCase().includes('food') ||
    item.name.toLowerCase().includes('bread') ||
    item.name.toLowerCase().includes('meat') ||
    item.name.toLowerCase().includes('apple') ||
    item.name.toLowerCase().includes('berry')
  )

  if (foodItems.length === 0) return null

  // Prefer items with higher quantity
  foodItems.sort((a, b) => b.quantity - a.quantity)
  return foodItems[0].name
}

// Helper: Get agent's home position (simplified - use role-based defaults)
function getHomePosition(agent: Agent): Position {
  const role = agent.npcRole
  // Default home positions by role (these should ideally come from world POI data)
  const roleHomes: Record<string, Position> = {
    merchant: { x: 50, y: 50 },
    innkeeper: { x: 45, y: 45 },
    guild_master: { x: 55, y: 50 },
    blacksmith: { x: 52, y: 48 },
    priest: { x: 48, y: 52 },
    farmer: { x: 60, y: 60 },
    scholar: { x: 40, y: 40 },
    guard: { x: 50, y: 45 },
    wanderer: { x: 50, y: 50 }
  }

  return roleHomes[role || 'wanderer'] || { x: 50, y: 50 }
}

// Helper: Check if role is combat-oriented
function isCombatRole(role?: NpcRole): boolean {
  return role === 'guard' || role === 'wanderer'
}

// Helper: Check if role is non-combat
function isNonCombatRole(role?: NpcRole): boolean {
  return role === 'merchant' || role === 'innkeeper' || role === 'farmer' ||
         role === 'priest' || role === 'scholar' || role === 'blacksmith'
}

/**
 * Evaluate rules and return an ActionPlan if a rule matches, null if LLM is needed
 * Rules are evaluated in priority order: Survival → Time → Combat → Social
 */
export function evaluateRules(ctx: RuleContext): ActionPlan | null {
  const { agent, timeOfDay, nearbyAgents, inCombat, nearbyEnemies, hasNearbyConversation, poiName } = ctx
  const hpPercent = (agent.stats.hp / agent.stats.maxHp) * 100
  const hungerPercent = (agent.stats.hunger / agent.stats.maxHunger) * 100
  const energyPercent = (agent.stats.energy / agent.stats.maxEnergy) * 100

  // ============================================================
  // SURVIVAL RULES (highest priority)
  // ============================================================

  // Rule 1: Critical HP with healing potion
  if (hpPercent < 20 && hasItem(agent, 'potion')) {
    const safePos = getHomePosition(agent)
    return {
      plan_name: 'emergency_heal_and_flee',
      steps: [
        { action: 'eat', params: { item_name: 'healing_potion' } },
        { action: 'move', params: { x: safePos.x, y: safePos.y }, wait_after: 2 }
      ],
      interrupt_conditions: { on_spoken_to: 'pause_and_respond' },
      max_duration: 300
    }
  }

  // Rule 2: Critical HP without healing potion
  if (hpPercent < 20) {
    const safePos = getHomePosition(agent)
    return {
      plan_name: 'emergency_flee',
      steps: [
        { action: 'move', params: { x: safePos.x, y: safePos.y }, wait_after: 2 },
        { action: 'rest', params: {}, wait_after: 10 }
      ],
      interrupt_conditions: { on_spoken_to: 'pause_and_respond' },
      max_duration: 300
    }
  }

  // Rule 3: Low HP in combat (non-combat roles)
  if (hpPercent < 50 && inCombat && isNonCombatRole(agent.npcRole)) {
    const safePos = getHomePosition(agent)
    return {
      plan_name: 'flee_combat',
      steps: [
        { action: 'move', params: { x: safePos.x, y: safePos.y }, wait_after: 2 }
      ],
      interrupt_conditions: { on_spoken_to: 'pause_and_respond' },
      max_duration: 200
    }
  }

  // Rule 4: High hunger with food
  if (hungerPercent > 90) {
    const foodItem = findFoodItem(agent)
    if (foodItem) {
      return {
        plan_name: 'eat_food',
        steps: [
          { action: 'eat', params: { item_name: foodItem } }
        ],
        interrupt_conditions: { on_spoken_to: 'pause_and_respond' },
        max_duration: 60
      }
    }
  }

  // Rule 5: High hunger without food - go to tavern
  if (hungerPercent > 90) {
    return {
      plan_name: 'find_food',
      steps: [
        { action: 'move', params: { x: 45, y: 45 }, wait_after: 2 }, // Tavern location
        { action: 'speak', params: { message: 'I need food urgently.' } }
      ],
      interrupt_conditions: { on_spoken_to: 'pause_and_respond' },
      max_duration: 300
    }
  }

  // Rule 6: Very low energy
  if (energyPercent < 10) {
    const homePos = getHomePosition(agent)
    return {
      plan_name: 'rest_low_energy',
      steps: [
        { action: 'move', params: { x: homePos.x, y: homePos.y }, wait_after: 2 },
        { action: 'rest', params: {}, wait_after: 10 }
      ],
      interrupt_conditions: { on_spoken_to: 'pause_and_respond' },
      max_duration: 600
    }
  }

  // ============================================================
  // TIME RULES
  // ============================================================

  // Rule 7: Night time - go home and rest (except guards)
  if (timeOfDay === 'night' && !inCombat && agent.npcRole !== 'guard') {
    const homePos = getHomePosition(agent)
    return {
      plan_name: 'night_rest',
      steps: [
        { action: 'move', params: { x: homePos.x, y: homePos.y }, wait_after: 2 },
        { action: 'rest', params: {}, wait_after: 20 }
      ],
      interrupt_conditions: { on_spoken_to: 'pause_and_respond' },
      max_duration: 1200
    }
  }

  // Rule 8: Dawn at home - idle (pattern cache will handle routine)
  if (timeOfDay === 'dawn') {
    const homePos = getHomePosition(agent)
    const isAtHome = Math.abs(agent.position.x - homePos.x) < 2 &&
                     Math.abs(agent.position.y - homePos.y) < 2

    if (isAtHome) {
      return {
        plan_name: 'dawn_idle',
        steps: [
          { action: 'idle', params: {}, wait_after: 5 }
        ],
        interrupt_conditions: { on_spoken_to: 'pause_and_respond' },
        max_duration: 60
      }
    }
  }

  // ============================================================
  // COMBAT RULES
  // ============================================================

  // Rule 9: Guard sees enemy approaching
  if (nearbyEnemies.length > 0 && agent.npcRole === 'guard') {
    const nearestEnemy = nearbyEnemies.reduce((closest, enemy) =>
      enemy.distance < closest.distance ? enemy : closest
    )

    return {
      plan_name: 'guard_engage',
      steps: [
        { action: 'attack', params: {}, target: nearestEnemy.id, wait_after: 1 }
      ],
      max_duration: 300
    }
  }

  // Rule 10: Combat role attacked - fight back
  if (inCombat && isCombatRole(agent.npcRole) && nearbyEnemies.length > 0) {
    const nearestEnemy = nearbyEnemies[0]

    return {
      plan_name: 'counter_attack',
      steps: [
        { action: 'attack', params: {}, target: nearestEnemy.id, wait_after: 1 }
      ],
      max_duration: 300
    }
  }

  // Rule 11: Non-combat NPC attacked - flee and call for help
  if (inCombat && isNonCombatRole(agent.npcRole)) {
    const safePos = getHomePosition(agent)

    return {
      plan_name: 'flee_and_call_help',
      steps: [
        { action: 'speak', params: { message: 'Help! Guards!' } },
        { action: 'move', params: { x: safePos.x, y: safePos.y }, wait_after: 2 }
      ],
      interrupt_conditions: { on_spoken_to: 'pause_and_respond' },
      max_duration: 200
    }
  }

  // ============================================================
  // SOCIAL RULES
  // ============================================================

  // Rule 12: Customer at shop (merchant)
  if (agent.npcRole === 'merchant' && poiName?.toLowerCase().includes('shop')) {
    const hasCustomer = nearbyAgents.some(a => !a.isNpc && a.distance < 5)

    if (hasCustomer) {
      return {
        plan_name: 'greet_customer',
        steps: [
          { action: 'speak', params: { message: 'Welcome to my shop! How may I help you?' } },
          { action: 'idle', params: {}, wait_after: 10 }
        ],
        interrupt_conditions: { on_spoken_to: 'pause_and_respond' },
        max_duration: 120
      }
    }
  }

  // Rule 13: Patient at temple (priest)
  if (agent.npcRole === 'priest' && poiName?.toLowerCase().includes('temple')) {
    const hasVisitor = nearbyAgents.some(a => a.distance < 5)

    if (hasVisitor) {
      return {
        plan_name: 'bless_visitor',
        steps: [
          { action: 'speak', params: { message: 'May the divine light guide your path.' } },
          { action: 'idle', params: {}, wait_after: 5 }
        ],
        interrupt_conditions: { on_spoken_to: 'pause_and_respond' },
        max_duration: 90
      }
    }
  }

  // ============================================================
  // No rule matched - LLM needed
  // ============================================================
  return null
}
