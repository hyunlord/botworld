// ──────────────────────────────────────────────
// Building System — Construction, Architecture, Siege
// ──────────────────────────────────────────────

// ── Building Categories ──

export type BuildingCategory = 'residential' | 'production' | 'commercial' | 'military' | 'social' | 'infrastructure' | 'special'

// ── Building Types ──

export type BuildingType =
  | 'hut' | 'cottage' | 'house' | 'manor' | 'estate'
  | 'blacksmith' | 'workshop' | 'alchemy_lab' | 'bakery' | 'brewery' | 'tannery' | 'sawmill' | 'smelter'
  | 'market_stall' | 'shop' | 'emporium' | 'trade_hub' | 'warehouse' | 'bank'
  | 'watchtower' | 'barracks' | 'wall_section' | 'gate' | 'siege_workshop' | 'armory' | 'prison'
  | 'tavern' | 'library' | 'temple' | 'guild_hall' | 'arena' | 'academy' | 'hospital' | 'courthouse'
  | 'bridge' | 'well' | 'road_lamp' | 'signpost' | 'dock' | 'stable' | 'cemetery'
  | 'portal_shrine' | 'ancient_forge' | 'dragon_lair' | 'wizard_tower'
  | 'custom'

export type BuildingState = 'construction' | 'active' | 'damaged' | 'destroyed' | 'abandoned'

// ── Furniture Types ──

export type FurnitureType =
  | 'bed' | 'table' | 'chair' | 'chest' | 'shelf' | 'anvil' | 'forge' | 'oven'
  | 'brewing_vat' | 'altar' | 'lectern' | 'weapon_rack' | 'training_dummy'
  | 'jail_cell' | 'throne' | 'workbench' | 'loom' | 'tanning_rack'
  | 'alchemy_table' | 'herb_shelf' | 'mortar' | 'planter_box' | 'water_basin'
  | 'display_case' | 'safe' | 'fireplace' | 'cauldron' | 'enchanting_table'

export type FurnitureQuality = 'crude' | 'basic' | 'fine' | 'masterwork' | 'legendary'

export interface Furniture {
  type: FurnitureType
  quality: FurnitureQuality
  effect?: string        // e.g. "craft_speed +10%"
  capacity?: number      // for storage furniture
}

// ── Room Types ──

export type RoomSize = 'small' | 'medium' | 'large'

export type RoomPurpose =
  | 'sleeping' | 'dining' | 'crafting' | 'storage' | 'alchemy'
  | 'training' | 'worship' | 'study' | 'entertainment' | 'prison'
  | 'farming' | 'meeting' | 'commerce' | 'medical' | 'forge'
  | 'kitchen' | 'office' | 'arena' | 'healing' | 'relaxation'
  | 'entrance' | 'barracks' | 'lookout' | 'shop' | 'workshop'

export interface Room {
  id: string
  name: string
  size: RoomSize
  purpose: RoomPurpose
  furniture: Furniture[]
  temperature?: 'cold' | 'normal' | 'warm' | 'hot'
  light?: 'dark' | 'dim' | 'normal' | 'bright'
  cleanliness: number   // 0-100
}

// ── Construction Costs ──

export interface ConstructionCost {
  wood?: number
  stone?: number
  iron?: number
  gold?: number
  crystal?: number
  herb?: number
  food?: number
}

// ── Building Definitions (Static Data) ──

export interface BuildingLevelConfig {
  level: number
  name?: string           // optional name override (e.g. "cottage" for hut at Lv2)
  sizeX: number
  sizeY: number
  maxHp: number
  defenseRating: number
  upgradeCost: ConstructionCost
  constructionTicks: number
  rooms: { name: string; size: RoomSize; purpose: RoomPurpose; defaultFurniture: FurnitureType[] }[]
  capacity?: number       // residents for residential, storage for warehouse, etc.
  features: string[]      // descriptive features unlocked at this level
  productionBonus?: Record<string, number>  // e.g. { craft_speed: 0.1 }
}

export interface BuildingDefinition {
  type: BuildingType
  category: BuildingCategory
  description: string
  maxLevel: number
  levels: BuildingLevelConfig[]
  canBeOwned: boolean     // personal ownership allowed
  requiresSettlement: boolean
}

// ── Siege Weapons ──

export type SiegeWeaponType = 'catapult' | 'battering_ram' | 'siege_ladder' | 'fire_arrows'

export interface SiegeWeapon {
  type: SiegeWeaponType
  damage: number
  targetPreference: BuildingType[]  // which buildings it's effective against
  craftCost: ConstructionCost
  craftTicks: number
}

// ── Building Instance (Runtime Data) ──

export interface Building {
  id: string
  name: string
  type: BuildingType
  subtype?: string
  ownerId?: string          // personal building
  settlementId?: string     // public building
  guildId?: string          // guild building
  x: number
  y: number
  sizeX: number
  sizeY: number
  level: number             // 1-5
  hp: number
  maxHp: number
  defenseRating: number
  state: BuildingState
  rooms: Room[]
  storage: { itemId: string; name: string; quantity: number }[]
  workers: string[]         // agent IDs
  visitors: string[]        // agent IDs currently inside
  upgrades: string[]        // upgrade names applied
  production?: {
    recipe?: string
    progress: number        // 0-100
    outputItem?: string
  }
  builtBy: string
  builtAt: number           // tick
  materialsUsed: ConstructionCost
  constructionProgress?: number  // 0-100 during construction
  history: { tick: number; event: string }[]
  style?: string            // architectural style
  customDescription?: string // for custom buildings
}

// ── Custom Building Design (Bot API) ──

export interface BuildingDesignRequest {
  name: string
  type: 'custom'
  description: string
  size: { x: number; y: number }
  rooms: { name: string; purpose: RoomPurpose; furniture: FurnitureType[] }[]
  location: { x: number; y: number }
  cost_estimate?: boolean
}

export interface BuildingDesignResponse {
  estimatedCost: ConstructionCost
  estimatedTicks: number
  valid: boolean
  errors?: string[]
}
