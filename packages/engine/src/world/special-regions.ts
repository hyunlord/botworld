import {
  WorldLayer,
  SpecialRegionType,
  LayerSpawnEntry,
  LayerResourceEntry,
  LayerRules,
  generateId,
} from '@botworld/shared';

export const SPECIAL_REGION_DEFINITIONS: Record<
  SpecialRegionType,
  {
    name: string;
    width: number;
    height: number;
    ambientLight: number;
    dangerLevel: number;
    rules: LayerRules;
    spawnTable: LayerSpawnEntry[];
    resourceTable: LayerResourceEntry[];
    description: string;
  }
> = {
  enchanted_forest: {
    name: 'Enchanted Forest',
    width: 40,
    height: 40,
    ambientLight: 0.7,
    dangerLevel: 1,
    description: 'A peaceful magical woodland where attacking makes the forest turn hostile',
    rules: {
      allowCombat: false,
      allowBuilding: false,
      requiresLight: false,
      fogOfWar: false,
      weatherAffected: false,
      timeOfDayAffected: true,
      specialEffects: ['peaceful', 'mana_regen_boost'],
    },
    resourceTable: [
      { resourceType: 'moonflower', abundance: 0.15, clusterSize: 3, respawnTicks: 1200 },
      { resourceType: 'fairy_dust', abundance: 0.1, clusterSize: 1, respawnTicks: 800 },
      { resourceType: 'living_wood', abundance: 0.2, clusterSize: 5, respawnTicks: 2000 },
      { resourceType: 'magic_herb', abundance: 0.25, clusterSize: 4, respawnTicks: 1000 },
    ],
    spawnTable: [
      { creatureType: 'fairy', weight: 5, minCount: 2, maxCount: 5 },
      { creatureType: 'unicorn', weight: 1, minCount: 1, maxCount: 2 },
      { creatureType: 'treant', weight: 2, minCount: 1, maxCount: 3 },
      { creatureType: 'pixie', weight: 4, minCount: 3, maxCount: 8 },
    ],
  },

  dragon_domain: {
    name: "Dragon's Domain",
    width: 35,
    height: 35,
    ambientLight: 0.4,
    dangerLevel: 10,
    description: 'A volcanic wasteland ruled by dragons and their kin',
    rules: {
      allowCombat: true,
      allowBuilding: false,
      requiresLight: false,
      fogOfWar: false,
      weatherAffected: false,
      timeOfDayAffected: false,
      specialEffects: ['volcanic_damage', 'fire_resistance_needed'],
    },
    resourceTable: [
      { resourceType: 'dragon_scale', abundance: 0.05, clusterSize: 1, respawnTicks: 5000 },
      { resourceType: 'fire_crystal', abundance: 0.2, clusterSize: 4, respawnTicks: 2000 },
      { resourceType: 'obsidian', abundance: 0.25, clusterSize: 8, respawnTicks: 1500 },
      { resourceType: 'volcanic_ash', abundance: 0.3, clusterSize: 10, respawnTicks: 500 },
    ],
    spawnTable: [
      { creatureType: 'wyvern', weight: 3, minCount: 1, maxCount: 3 },
      { creatureType: 'fire_elemental', weight: 4, minCount: 2, maxCount: 5 },
      { creatureType: 'dragon_whelp', weight: 2, minCount: 1, maxCount: 2 },
      { creatureType: 'dragon', weight: 0.5, minCount: 1, maxCount: 1 },
    ],
  },

  elven_city: {
    name: 'Hidden Elven City',
    width: 30,
    height: 30,
    ambientLight: 0.9,
    dangerLevel: 0,
    description: 'An ancient elven settlement hidden from the world, a sanctuary of peace and enchantment',
    rules: {
      allowCombat: false,
      allowBuilding: false,
      requiresLight: false,
      fogOfWar: false,
      weatherAffected: false,
      timeOfDayAffected: true,
      specialEffects: ['peaceful', 'enchanting_bonus'],
    },
    resourceTable: [
      { resourceType: 'enchanted_cloth', abundance: 0.15, clusterSize: 2, respawnTicks: 3000 },
      { resourceType: 'elven_bow_wood', abundance: 0.1, clusterSize: 3, respawnTicks: 4000 },
      { resourceType: 'healing_herb', abundance: 0.3, clusterSize: 5, respawnTicks: 1200 },
      { resourceType: 'starlight_gem', abundance: 0.05, clusterSize: 1, respawnTicks: 6000 },
    ],
    spawnTable: [
      { creatureType: 'elf_artisan', weight: 5, minCount: 3, maxCount: 6 },
      { creatureType: 'elf_ranger', weight: 3, minCount: 2, maxCount: 4 },
      { creatureType: 'elf_mage', weight: 2, minCount: 1, maxCount: 3 },
      { creatureType: 'elf_elder', weight: 1, minCount: 1, maxCount: 2 },
    ],
  },

  cursed_lands: {
    name: 'Cursed Lands',
    width: 50,
    height: 50,
    ambientLight: 0.05,
    dangerLevel: 8,
    description: 'A realm of perpetual night where the undead roam and darkness reigns',
    rules: {
      allowCombat: true,
      allowBuilding: true,
      requiresLight: true,
      fogOfWar: true,
      weatherAffected: false,
      timeOfDayAffected: false,
      specialEffects: ['cursed', 'undead_regen', 'permanent_night'],
    },
    resourceTable: [
      { resourceType: 'shadow_essence', abundance: 0.2, clusterSize: 3, respawnTicks: 1000 },
      { resourceType: 'bone', abundance: 0.4, clusterSize: 6, respawnTicks: 600 },
      { resourceType: 'cursed_gem', abundance: 0.1, clusterSize: 2, respawnTicks: 4000 },
      { resourceType: 'dark_iron_ore', abundance: 0.15, clusterSize: 7, respawnTicks: 2500 },
    ],
    spawnTable: [
      { creatureType: 'skeleton', weight: 6, minCount: 3, maxCount: 8 },
      { creatureType: 'zombie', weight: 5, minCount: 2, maxCount: 6 },
      { creatureType: 'wraith', weight: 3, minCount: 1, maxCount: 4 },
      { creatureType: 'death_knight', weight: 1, minCount: 1, maxCount: 2 },
      { creatureType: 'lich_king', weight: 0.2, minCount: 1, maxCount: 1 },
    ],
  },
};

const DEPTH_MAP: Record<SpecialRegionType, number> = {
  enchanted_forest: 100,
  dragon_domain: 101,
  elven_city: 102,
  cursed_lands: 103,
};

export function createSpecialRegion(regionType: SpecialRegionType): WorldLayer {
  const def = SPECIAL_REGION_DEFINITIONS[regionType];

  return {
    id: generateId(),
    name: def.name,
    type: 'special',
    depth: DEPTH_MAP[regionType],
    width: def.width,
    height: def.height,
    ambientLight: def.ambientLight,
    dangerLevel: def.dangerLevel,
    rules: def.rules,
    spawnTable: def.spawnTable,
    resourceTable: def.resourceTable,
    portals: [],
  };
}
