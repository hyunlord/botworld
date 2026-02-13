import {
  WorldLayer,
  Ship,
  ShipType,
  ShipDefinition,
  OceanIsland,
  IslandType,
  SeaCreature,
  LayerPortal,
  LayerSpawnEntry,
  LayerResourceEntry,
  generateId,
} from '@botworld/shared';
import { EventBus } from '../core/event-bus.js';

// Ship build costs and stats
export const SHIP_DEFINITIONS: Record<ShipType, ShipDefinition> = {
  rowboat: {
    type: 'rowboat',
    name: 'Rowboat',
    maxCrew: 1,
    speed: 1,
    hp: 30,
    maxHp: 30,
    cargoSlots: 5,
    buildCost: [
      { itemType: 'plank', amount: 10 },
      { itemType: 'rope', amount: 3 },
    ],
    buildTime: 30,
  },
  sailboat: {
    type: 'sailboat',
    name: 'Sailboat',
    maxCrew: 3,
    speed: 2,
    hp: 80,
    maxHp: 80,
    cargoSlots: 15,
    buildCost: [
      { itemType: 'plank', amount: 30 },
      { itemType: 'cloth', amount: 10 },
      { itemType: 'iron_ingot', amount: 5 },
    ],
    buildTime: 100,
  },
  galleon: {
    type: 'galleon',
    name: 'Galleon',
    maxCrew: 10,
    speed: 3,
    hp: 200,
    maxHp: 200,
    cargoSlots: 50,
    buildCost: [
      { itemType: 'plank', amount: 80 },
      { itemType: 'cloth', amount: 30 },
      { itemType: 'iron_ingot', amount: 20 },
      { itemType: 'gold_ingot', amount: 5 },
    ],
    buildTime: 300,
  },
};

export class OceanSystem {
  private ships = new Map<string, Ship>();
  private islands: OceanIsland[] = [];
  private seaCreatures = new Map<string, SeaCreature>();
  private oceanLayer: WorldLayer;
  private buildQueue = new Map<
    string,
    {
      shipType: ShipType;
      ownerId: string;
      startTick: number;
      completionTick: number;
      dockPosition: { x: number; y: number };
    }
  >();
  private shipDestinations = new Map<string, { x: number; y: number }>();

  constructor(private eventBus: EventBus) {
    this.oceanLayer = this.createOceanLayer();
    this.generateIslands();
    this.spawnSeaCreatures();
  }

  // Create the ocean WorldLayer (100x100 map)
  private createOceanLayer(): WorldLayer {
    const portals: LayerPortal[] = [
      {
        id: generateId(),
        sourceLayerId: 'ocean',
        sourcePosition: { x: 50, y: 50 },
        targetLayerId: 'surface',
        targetPosition: { x: 50, y: 50 },
        portalType: 'dock',
        discovered: false,
        discoveredBy: [],
      },
    ];

    const spawns: LayerSpawnEntry[] = [
      { creatureType: 'shark', weight: 0.25, minCount: 3, maxCount: 6 },
      { creatureType: 'jellyfish', weight: 0.4, minCount: 5, maxCount: 10 },
      { creatureType: 'dolphin', weight: 0.3, minCount: 4, maxCount: 8 },
      { creatureType: 'sea_serpent', weight: 0.05, minCount: 1, maxCount: 2 },
    ];

    const resources: LayerResourceEntry[] = [
      { resourceType: 'seaweed', abundance: 0.7, clusterSize: 3, respawnTicks: 100 },
      { resourceType: 'pearl', abundance: 0.05, clusterSize: 1, respawnTicks: 500 },
      { resourceType: 'coral', abundance: 0.3, clusterSize: 2, respawnTicks: 200 },
    ];

    return {
      id: 'ocean',
      name: 'The Ocean',
      type: 'ocean',
      depth: 1,
      width: 100,
      height: 100,
      ambientLight: 1.0,
      dangerLevel: 5,
      portals,
      spawnTable: spawns,
      resourceTable: resources,
      rules: {
        allowCombat: true,
        allowBuilding: false,
        requiresLight: false,
        fogOfWar: true,
        weatherAffected: true,
        timeOfDayAffected: true,
      },
    };
  }

  // Generate 5 islands
  private generateIslands(): void {
    this.islands = [
      {
        id: generateId(),
        name: 'Tropical Paradise',
        type: 'tropical',
        position: { x: 20, y: 20 },
        size: 15,
        discovered: false,
        discoveredBy: [],
        hasPort: true,
        resources: ['coconut', 'palm_wood', 'tropical_fruit'],
        creatures: ['parrot'],
      },
      {
        id: generateId(),
        name: 'Volcanic Isle',
        type: 'volcanic',
        position: { x: 80, y: 20 },
        size: 12,
        discovered: false,
        discoveredBy: [],
        hasPort: false,
        resources: ['obsidian', 'fire_crystal', 'sulfur'],
        creatures: ['wyvern'],
      },
      {
        id: generateId(),
        name: 'Frozen Wastes',
        type: 'frozen',
        position: { x: 20, y: 80 },
        size: 18,
        discovered: false,
        discoveredBy: [],
        hasPort: true,
        resources: ['ice_crystal', 'frozen_fish', 'permafrost_stone'],
        creatures: ['dire_wolf', 'mammoth'],
      },
      {
        id: generateId(),
        name: 'Ancient Ruins',
        type: 'ruins',
        position: { x: 50, y: 50 },
        size: 10,
        discovered: false,
        discoveredBy: [],
        hasPort: false,
        resources: ['ancient_artifact', 'treasure_chest', 'relic'],
        creatures: [],
      },
      {
        id: generateId(),
        name: 'Pirate Cove',
        type: 'pirate',
        position: { x: 80, y: 80 },
        size: 14,
        discovered: false,
        discoveredBy: [],
        hasPort: true,
        resources: ['rum', 'smuggled_goods', 'gold_doubloon'],
        creatures: [],
      },
    ];
  }

  // Spawn initial sea creatures
  private spawnSeaCreatures(): void {
    const creatures: Array<{
      type: string;
      tier: number;
      hostile: boolean;
      count: number;
    }> = [
      { type: 'shark', tier: 2, hostile: true, count: 5 },
      { type: 'jellyfish', tier: 1, hostile: true, count: 8 },
      { type: 'dolphin', tier: 1, hostile: false, count: 6 },
      { type: 'sea_serpent', tier: 4, hostile: true, count: 2 },
    ];

    for (const { type, tier, hostile, count } of creatures) {
      for (let i = 0; i < count; i++) {
        const creature: SeaCreature = {
          id: generateId(),
          type,
          tier,
          position: {
            x: Math.floor(Math.random() * 100),
            y: Math.floor(Math.random() * 100),
          },
          hp: tier * 50,
          maxHp: tier * 50,
          hostile,
          loot: hostile
            ? [{ itemType: 'sea_meat', chance: 0.8 }]
            : [{ itemType: 'dolphin_token', chance: 0.1 }],
        };
        this.seaCreatures.set(creature.id, creature);
      }
    }
  }

  // Build a ship at a dock
  startBuildShip(
    ownerId: string,
    shipType: ShipType,
    dockPosition: { x: number; y: number },
    tick: number
  ): { success: boolean; reason?: string; completionTick?: number } {
    const definition = SHIP_DEFINITIONS[shipType];
    if (!definition) {
      return { success: false, reason: 'Invalid ship type' };
    }

    // Check if position is near a port
    const nearPort = this.islands.some(
      (island) =>
        island.hasPort &&
        Math.abs(island.position.x - dockPosition.x) <= 5 &&
        Math.abs(island.position.y - dockPosition.y) <= 5
    );

    if (!nearPort) {
      return { success: false, reason: 'Must build at a port' };
    }

    const buildId = generateId();
    const completionTick = tick + definition.buildTime;

    this.buildQueue.set(buildId, {
      shipType,
      ownerId,
      startTick: tick,
      completionTick,
      dockPosition,
    });

    return { success: true, completionTick };
  }

  // Check build queue completion
  tick(tick: number): void {
    // Process build queue
    for (const [buildId, build] of this.buildQueue.entries()) {
      if (tick >= build.completionTick) {
        const definition = SHIP_DEFINITIONS[build.shipType];
        const ship: Ship = {
          id: generateId(),
          type: build.shipType,
          name: `${definition.name} of ${build.ownerId}`,
          ownerId: build.ownerId,
          position: { ...build.dockPosition },
          hp: definition.maxHp,
          maxHp: definition.maxHp,
          crew: [],
          cargo: [],
          status: 'docked',
        };

        this.ships.set(ship.id, ship);
        this.buildQueue.delete(buildId);

        this.eventBus.emit({
          type: 'ship:built',
          agentId: build.ownerId,
          shipId: ship.id,
          shipType: build.shipType,
          shipName: ship.name,
          timestamp: tick,
        });
      }
    }

    // Move sailing ships
    this.moveShips(tick);
  }

  // Get a ship
  getShip(shipId: string): Ship | undefined {
    return this.ships.get(shipId);
  }

  // Get all ships
  getAllShips(): Ship[] {
    return Array.from(this.ships.values());
  }

  // Get agent's ship
  getAgentShip(agentId: string): Ship | undefined {
    return Array.from(this.ships.values()).find(
      (ship) => ship.ownerId === agentId || ship.crew.includes(agentId)
    );
  }

  // Set sail from dock
  setSail(
    shipId: string,
    destination: { x: number; y: number },
    tick: number
  ): { success: boolean; reason?: string } {
    const ship = this.ships.get(shipId);
    if (!ship) {
      return { success: false, reason: 'Ship not found' };
    }

    if (ship.status !== 'docked') {
      return { success: false, reason: 'Ship must be docked to set sail' };
    }

    if (ship.crew.length === 0) {
      return { success: false, reason: 'Ship needs at least one crew member' };
    }

    const fromPosition = { ...ship.position };
    ship.status = 'sailing';
    this.shipDestinations.set(shipId, destination);

    this.eventBus.emit({
      type: 'ship:sailed',
      shipId,
      captainId: ship.ownerId,
      fromPosition,
      toPosition: destination,
      timestamp: tick,
    });

    return { success: true };
  }

  // Move ship towards destination (called per tick for sailing ships)
  private moveShips(tick: number): void {
    for (const ship of this.ships.values()) {
      if (ship.status !== 'sailing') {
        continue;
      }

      const destination = this.shipDestinations.get(ship.id);
      if (!destination) {
        continue;
      }

      const definition = SHIP_DEFINITIONS[ship.type];
      const dx = destination.x - ship.position.x;
      const dy = destination.y - ship.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= 1) {
        // Arrived
        ship.position = { ...destination };
        this.shipDestinations.delete(ship.id);
      } else {
        // Move towards destination
        const moveDistance = Math.min(definition.speed, distance);
        ship.position.x += Math.round((dx / distance) * moveDistance);
        ship.position.y += Math.round((dy / distance) * moveDistance);
      }
    }
  }

  // Dock a ship at nearest port
  dockShip(
    shipId: string,
    tick: number
  ): { success: boolean; reason?: string } {
    const ship = this.ships.get(shipId);
    if (!ship) {
      return { success: false, reason: 'Ship not found' };
    }

    // Find nearest port island
    const nearestPort = this.islands
      .filter((island) => island.hasPort)
      .reduce<{ island: OceanIsland | null; distance: number }>(
        (nearest, island) => {
          const distance = Math.sqrt(
            Math.pow(island.position.x - ship.position.x, 2) +
              Math.pow(island.position.y - ship.position.y, 2)
          );
          if (distance < nearest.distance) {
            return { island, distance };
          }
          return nearest;
        },
        { island: null, distance: Infinity }
      );

    if (!nearestPort.island || nearestPort.distance > 5) {
      return { success: false, reason: 'No port within docking range' };
    }

    ship.status = 'docked';
    this.shipDestinations.delete(shipId);
    ship.position = { ...nearestPort.island.position };

    return { success: true };
  }

  // Board a ship (join crew)
  boardShip(
    agentId: string,
    shipId: string
  ): { success: boolean; reason?: string } {
    const ship = this.ships.get(shipId);
    if (!ship) {
      return { success: false, reason: 'Ship not found' };
    }

    if (ship.status !== 'docked') {
      return { success: false, reason: 'Ship must be docked to board' };
    }

    const definition = SHIP_DEFINITIONS[ship.type];
    if (ship.crew.length >= definition.maxCrew) {
      return { success: false, reason: 'Ship is at max crew capacity' };
    }

    if (ship.crew.includes(agentId)) {
      return { success: false, reason: 'Already a crew member' };
    }

    ship.crew.push(agentId);
    return { success: true };
  }

  // Disembark from ship
  disembark(
    agentId: string,
    shipId: string
  ): { success: boolean; reason?: string } {
    const ship = this.ships.get(shipId);
    if (!ship) {
      return { success: false, reason: 'Ship not found' };
    }

    if (ship.status !== 'docked') {
      return { success: false, reason: 'Ship must be docked to disembark' };
    }

    const crewIndex = ship.crew.indexOf(agentId);
    if (crewIndex === -1) {
      return { success: false, reason: 'Not a crew member' };
    }

    ship.crew.splice(crewIndex, 1);
    return { success: true };
  }

  // Naval combat between ships
  navalCombat(
    attackerShipId: string,
    defenderShipId: string,
    tick: number
  ): { success: boolean; result?: string } {
    const attacker = this.ships.get(attackerShipId);
    const defender = this.ships.get(defenderShipId);

    if (!attacker || !defender) {
      return { success: false, result: 'One or both ships not found' };
    }

    if (attacker.status === 'docked' || defender.status === 'docked') {
      return { success: false, result: 'Cannot attack docked ships' };
    }

    // Simple HP trading based on crew size
    const attackerDamage = Math.max(10, attacker.crew.length * 5);
    const defenderDamage = Math.max(10, defender.crew.length * 5);

    defender.hp = Math.max(0, defender.hp - attackerDamage);
    attacker.hp = Math.max(0, attacker.hp - defenderDamage);

    let result = `Naval combat: ${attacker.name} dealt ${attackerDamage} damage, ${defender.name} dealt ${defenderDamage} damage.`;

    if (defender.hp === 0) {
      result += ` ${defender.name} was sunk!`;
      this.ships.delete(defenderShipId);
    }

    if (attacker.hp === 0) {
      result += ` ${attacker.name} was sunk!`;
      this.ships.delete(attackerShipId);
    }

    return { success: true, result };
  }

  // Get ocean layer
  getOceanLayer(): WorldLayer {
    return this.oceanLayer;
  }

  // Get all islands
  getIslands(): OceanIsland[] {
    return this.islands;
  }

  // Get sea creatures
  getSeaCreatures(): SeaCreature[] {
    return Array.from(this.seaCreatures.values());
  }

  // Discover an island
  discoverIsland(agentId: string, islandId: string, tick: number): boolean {
    const island = this.islands.find((i) => i.id === islandId);
    if (!island) {
      return false;
    }

    if (island.discoveredBy.includes(agentId)) {
      return false;
    }

    island.discoveredBy.push(agentId);
    island.discovered = true;

    this.eventBus.emit({
      type: 'island:discovered',
      agentId,
      islandId,
      islandName: island.name,
      islandType: island.type,
      timestamp: tick,
    });

    return true;
  }

  // Format for LLM context
  formatForLLM(agentId: string): string {
    const agentShip = this.getAgentShip(agentId);
    const discoveredIslands = this.islands.filter((i) =>
      i.discoveredBy.includes(agentId)
    );

    let context = '=== OCEAN LAYER ===\n';
    context += `Map size: ${this.oceanLayer.width}x${this.oceanLayer.height}\n`;
    context += `Danger level: ${this.oceanLayer.dangerLevel}\n\n`;

    if (agentShip) {
      context += `YOUR SHIP: ${agentShip.name} (${agentShip.type})\n`;
      context += `Position: (${agentShip.position.x}, ${agentShip.position.y})\n`;
      context += `Status: ${agentShip.status}\n`;
      context += `HP: ${agentShip.hp}/${agentShip.maxHp}\n`;
      context += `Crew: ${agentShip.crew.length}/${SHIP_DEFINITIONS[agentShip.type].maxCrew}\n`;
      context += `Cargo: ${agentShip.cargo.length}/${SHIP_DEFINITIONS[agentShip.type].cargoSlots}\n`;
      const destination = this.shipDestinations.get(agentShip.id);
      if (destination) {
        context += `Destination: (${destination.x}, ${destination.y})\n`;
      }
      context += '\n';
    } else {
      context += 'You do not currently have a ship.\n\n';
    }

    context += `DISCOVERED ISLANDS (${discoveredIslands.length}):\n`;
    for (const island of discoveredIslands) {
      context += `- ${island.name} (${island.type}) at (${island.position.x}, ${island.position.y})\n`;
      context += `  Port: ${island.hasPort ? 'Yes' : 'No'}\n`;
      context += `  Resources: ${island.resources.join(', ')}\n`;
      if (island.creatures.length > 0) {
        context += `  Creatures: ${island.creatures.join(', ')}\n`;
      }
    }

    return context;
  }
}
