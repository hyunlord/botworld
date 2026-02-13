// Layer depth: 0 = surface, -1 = mine, -2 = cavern, -3 = ruins, 1 = ocean, 100+ = special
export type LayerDepth = number

export type LayerType = 'surface' | 'mine' | 'cavern' | 'ancient_ruins' | 'ocean' | 'special'

export type SpecialRegionType = 'enchanted_forest' | 'dragon_domain' | 'elven_city' | 'cursed_lands'

export type PortalType = 'mine_entrance' | 'cave_hole' | 'secret_door' | 'dock' | 'magic_portal' | 'hidden_path'

export interface LayerPortal {
  id: string
  sourceLayerId: string
  sourcePosition: { x: number; y: number }
  targetLayerId: string
  targetPosition: { x: number; y: number }
  portalType: PortalType
  requirements?: PortalRequirement[]
  discovered: boolean
  discoveredBy: string[]  // agent IDs
}

export interface PortalRequirement {
  type: 'skill_level' | 'item' | 'quest' | 'race' | 'reputation'
  skillId?: string
  minLevel?: number
  itemId?: string
  questId?: string
  race?: string
  factionId?: string
  minReputation?: number
}

export interface WorldLayer {
  id: string
  name: string
  type: LayerType
  depth: LayerDepth
  width: number
  height: number
  specialRegion?: SpecialRegionType
  ambientLight: number        // 0-1, 0 = pitch dark, 1 = full daylight
  dangerLevel: number         // 1-10
  portals: LayerPortal[]
  spawnTable: LayerSpawnEntry[]
  resourceTable: LayerResourceEntry[]
  rules: LayerRules
}

export interface LayerRules {
  allowCombat: boolean
  allowBuilding: boolean
  requiresLight: boolean       // need torch/lantern
  fogOfWar: boolean
  weatherAffected: boolean
  timeOfDayAffected: boolean
  specialEffects?: string[]    // e.g., 'cursed', 'peaceful', 'volcanic_damage'
}

export interface LayerSpawnEntry {
  creatureType: string
  weight: number
  minCount: number
  maxCount: number
  conditions?: string[]     // e.g., 'night_only', 'near_water'
}

export interface LayerResourceEntry {
  resourceType: string
  abundance: number         // 0-1
  clusterSize: number       // how many tiles in a vein
  respawnTicks: number
}

// Underground dungeon generation
export type DungeonTileType = 'tunnel' | 'room' | 'wall' | 'door' | 'trap' | 'water' | 'lava' | 'crystal' | 'mushroom' | 'rubble'

export interface DungeonRoom {
  id: string
  x: number
  y: number
  width: number
  height: number
  type: 'normal' | 'treasure' | 'boss' | 'puzzle' | 'shrine' | 'lake' | 'mushroom_forest' | 'crystal_cave'
  connected: string[]       // connected room IDs
}

export interface DungeonTrap {
  id: string
  position: { x: number; y: number }
  type: 'spike' | 'poison_dart' | 'falling_rock' | 'fire_vent' | 'teleport'
  damage: number
  detected: boolean
  disarmed: boolean
  detectionSkill: string    // skill needed to detect
  detectionLevel: number
}

// Ocean system
export type ShipType = 'rowboat' | 'sailboat' | 'galleon'

export interface ShipDefinition {
  type: ShipType
  name: string
  maxCrew: number
  speed: number             // base tiles per tick
  hp: number
  maxHp: number
  cargoSlots: number
  buildCost: { itemType: string; amount: number }[]
  buildTime: number         // ticks
}

export interface Ship {
  id: string
  type: ShipType
  name: string
  ownerId: string
  crew: string[]            // agent IDs
  position: { x: number; y: number }
  hp: number
  maxHp: number
  cargo: { itemType: string; amount: number }[]
  status: 'docked' | 'sailing' | 'combat' | 'sinking' | 'sunk'
  dockedAt?: string         // dock POI id
}

export type IslandType = 'tropical' | 'volcanic' | 'frozen' | 'ruins' | 'pirate'

export interface OceanIsland {
  id: string
  name: string
  type: IslandType
  position: { x: number; y: number }
  size: number              // radius in tiles
  discovered: boolean
  discoveredBy: string[]
  resources: string[]
  creatures: string[]
  npcs?: string[]
  hasPort: boolean
}

export interface SeaCreature {
  id: string
  type: string
  position: { x: number; y: number }
  hp: number
  maxHp: number
  tier: number
  hostile: boolean
  loot: { itemType: string; chance: number }[]
}

// Agent layer tracking
export interface AgentLayerState {
  agentId: string
  currentLayerId: string
  exploredTiles: Record<string, string[]>  // layerId -> array of "x,y" keys
  discoveredPortals: string[]              // portal IDs
  shipId?: string                          // currently on this ship
}

// Fog of war
export interface FogOfWarState {
  layerId: string
  agentId: string
  revealedTiles: string[]   // "x,y" format
  visionRange: number       // tiles the agent can see
}

// Events
export interface LayerTransitionEvent {
  type: 'layer:transition'
  agentId: string
  fromLayerId: string
  toLayerId: string
  portalId: string
  timestamp: number
}

export interface LayerDiscoveredEvent {
  type: 'layer:discovered'
  agentId: string
  layerId: string
  layerName: string
  layerType: LayerType
  timestamp: number
}

export interface PortalDiscoveredEvent {
  type: 'portal:discovered'
  agentId: string
  portalId: string
  portalType: PortalType
  layerId: string
  timestamp: number
}

export interface ShipBuiltEvent {
  type: 'ship:built'
  agentId: string
  shipId: string
  shipType: ShipType
  shipName: string
  timestamp: number
}

export interface ShipSailedEvent {
  type: 'ship:sailed'
  shipId: string
  captainId: string
  fromPosition: { x: number; y: number }
  toPosition: { x: number; y: number }
  timestamp: number
}

export interface IslandDiscoveredEvent {
  type: 'island:discovered'
  agentId: string
  islandId: string
  islandName: string
  islandType: IslandType
  timestamp: number
}

export interface TrapTriggeredEvent {
  type: 'trap:triggered'
  agentId: string
  trapId: string
  trapType: string
  damage: number
  layerId: string
  timestamp: number
}

export interface TrapDisarmedEvent {
  type: 'trap:disarmed'
  agentId: string
  trapId: string
  trapType: string
  layerId: string
  timestamp: number
}

export interface DungeonRoomEnteredEvent {
  type: 'dungeon:room_entered'
  agentId: string
  roomId: string
  roomType: string
  layerId: string
  timestamp: number
}
