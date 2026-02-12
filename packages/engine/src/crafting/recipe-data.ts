import type { AdvancedRecipe } from '@botworld/shared'

// ══════════════════════════════════════════════════════════════════════════════
// BOTWORLD RECIPE DATABASE
// ══════════════════════════════════════════════════════════════════════════════
// Comprehensive crafting recipes organized by tier (1-5) and category
// Tier 1: Raw materials (gathering-based, no recipes)
// Tier 2: Primary processing (ores → ingots, logs → planks)
// Tier 3: Components and parts (ingots → blades, planks → limbs)
// Tier 4: Finished products (weapons, armor, tools, food, potions)
// Tier 5: Magical/legendary items (enchanted gear, rare potions)
// ══════════════════════════════════════════════════════════════════════════════

// ── Tier 2: Primary Processing ──

export const TIER2_RECIPES: AdvancedRecipe[] = [
  {
    id: 'smelt_iron', name: 'Smelt Iron Ingot', category: 'smelting', tier: 2,
    inputs: [{ itemId: 'iron_ore', quantity: 2 }, { itemId: 'charcoal', quantity: 1 }],
    output: { itemId: 'iron_ingot', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'smelter', facilityLevel: 1, requiredSkill: 'smithing', requiredSkillLevel: 5,
    craftingTime: 3, discoveryMethod: 'known', baseFailChance: 0.05, description: 'Smelt iron ore into a usable ingot.',
  },
  {
    id: 'smelt_steel', name: 'Forge Steel Ingot', category: 'smelting', tier: 2,
    inputs: [{ itemId: 'iron_ingot', quantity: 2 }, { itemId: 'charcoal', quantity: 2 }],
    output: { itemId: 'steel_ingot', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'smelter', facilityLevel: 2, requiredSkill: 'smithing', requiredSkillLevel: 20,
    craftingTime: 5, discoveryMethod: 'known', baseFailChance: 0.1, description: 'High-temperature forging of steel.',
  },
  {
    id: 'smelt_gold', name: 'Smelt Gold Ingot', category: 'smelting', tier: 2,
    inputs: [{ itemId: 'gold_ore', quantity: 3 }],
    output: { itemId: 'gold_ingot', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'smelter', facilityLevel: 1, requiredSkill: 'smithing', requiredSkillLevel: 10,
    craftingTime: 4, discoveryMethod: 'known', baseFailChance: 0.05, description: 'Smelt gold ore into pure gold.',
  },
  {
    id: 'smelt_bronze', name: 'Smelt Bronze Ingot', category: 'smelting', tier: 2,
    inputs: [{ itemId: 'copper_ore', quantity: 1 }, { itemId: 'tin_ore', quantity: 1 }],
    output: { itemId: 'bronze_ingot', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'smelter', facilityLevel: 1, requiredSkill: 'smithing', requiredSkillLevel: 3,
    craftingTime: 3, discoveryMethod: 'known', baseFailChance: 0.03, description: 'Alloy copper and tin into bronze.',
  },
  {
    id: 'smelt_mithril', name: 'Forge Mithril Ingot', category: 'smelting', tier: 2,
    inputs: [{ itemId: 'mithril_ore', quantity: 3 }, { itemId: 'crystal', quantity: 1 }],
    output: { itemId: 'mithril_ingot', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'smelter', facilityLevel: 3, requiredSkill: 'smithing', requiredSkillLevel: 60,
    craftingTime: 10, discoveryMethod: 'recipe_scroll', baseFailChance: 0.2, description: 'Requires magical heat to forge.',
  },
  {
    id: 'saw_plank', name: 'Cut Planks', category: 'woodworking', tier: 2,
    inputs: [{ itemId: 'wood', quantity: 2 }],
    output: { itemId: 'plank', quantity: 2, qualityAffectedBySkill: false, qualityAffectedByFacility: true },
    facility: 'sawmill', requiredSkill: 'crafting', requiredSkillLevel: 1,
    craftingTime: 2, discoveryMethod: 'known', baseFailChance: 0.02, description: 'Cut logs into usable planks.',
  },
  {
    id: 'burn_charcoal', name: 'Burn Charcoal', category: 'smelting', tier: 2,
    inputs: [{ itemId: 'wood', quantity: 3 }],
    output: { itemId: 'charcoal', quantity: 2, qualityAffectedBySkill: false, qualityAffectedByFacility: false },
    facility: 'kiln', requiredSkill: 'crafting', requiredSkillLevel: 1,
    craftingTime: 4, discoveryMethod: 'known', baseFailChance: 0.02, description: 'Slowly burn wood into charcoal.',
  },
  {
    id: 'tan_leather', name: 'Tan Leather', category: 'leatherwork', tier: 2,
    inputs: [{ itemId: 'hide', quantity: 2 }],
    output: { itemId: 'leather', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'tannery', requiredSkill: 'crafting', requiredSkillLevel: 5,
    craftingTime: 5, discoveryMethod: 'known', baseFailChance: 0.05, description: 'Cure and tan raw hides.',
  },
  {
    id: 'weave_cloth', name: 'Weave Cloth', category: 'textiles', tier: 2,
    inputs: [{ itemId: 'cotton', quantity: 3 }],
    output: { itemId: 'cloth', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'loom', requiredSkill: 'crafting', requiredSkillLevel: 5,
    craftingTime: 4, discoveryMethod: 'known', baseFailChance: 0.05, description: 'Weave cotton into cloth.',
  },
  {
    id: 'weave_silk', name: 'Weave Silk Cloth', category: 'textiles', tier: 2,
    inputs: [{ itemId: 'spider_silk', quantity: 5 }],
    output: { itemId: 'silk_cloth', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'loom', facilityLevel: 2, requiredSkill: 'crafting', requiredSkillLevel: 25,
    craftingTime: 6, discoveryMethod: 'recipe_scroll', baseFailChance: 0.1, description: 'Delicate silk weaving.',
  },
  {
    id: 'grind_flour', name: 'Grind Flour', category: 'cooking', tier: 2,
    inputs: [{ itemId: 'grain', quantity: 3 }],
    output: { itemId: 'flour', quantity: 2, qualityAffectedBySkill: false, qualityAffectedByFacility: true },
    facility: 'mill', requiredSkill: 'cooking', requiredSkillLevel: 1,
    craftingTime: 2, discoveryMethod: 'known', baseFailChance: 0.01, description: 'Grind grain into flour.',
  },
  {
    id: 'make_glass', name: 'Blow Glass', category: 'smelting', tier: 2,
    inputs: [{ itemId: 'sand', quantity: 3 }],
    output: { itemId: 'glass', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'smelter', requiredSkill: 'crafting', requiredSkillLevel: 10,
    craftingTime: 4, discoveryMethod: 'known', baseFailChance: 0.1, description: 'Heat sand into clear glass.',
  },
  {
    id: 'fire_brick', name: 'Fire Bricks', category: 'pottery', tier: 2,
    inputs: [{ itemId: 'clay', quantity: 2 }],
    output: { itemId: 'brick', quantity: 2, qualityAffectedBySkill: false, qualityAffectedByFacility: false },
    facility: 'kiln', requiredSkill: 'crafting', requiredSkillLevel: 3,
    craftingTime: 3, discoveryMethod: 'known', baseFailChance: 0.02, description: 'Fire clay into sturdy bricks.',
  },
  {
    id: 'brew_potion_base', name: 'Brew Potion Base', category: 'alchemy', tier: 2,
    inputs: [{ itemId: 'herb', quantity: 2 }, { itemId: 'water', quantity: 1 }],
    output: { itemId: 'potion_base', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'alchemy_lab', facilityLevel: 1, requiredSkill: 'alchemy', requiredSkillLevel: 5,
    craftingTime: 3, discoveryMethod: 'known', baseFailChance: 0.08, description: 'Distill herbs into a potion base.',
  },
  {
    id: 'refine_crystal', name: 'Refine Crystal', category: 'alchemy', tier: 2,
    inputs: [{ itemId: 'crystal', quantity: 2 }],
    output: { itemId: 'refined_crystal', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'alchemy_lab', facilityLevel: 2, requiredSkill: 'alchemy', requiredSkillLevel: 20,
    craftingTime: 5, discoveryMethod: 'recipe_scroll', baseFailChance: 0.15, description: 'Purify raw crystals.',
  },
  {
    id: 'smelt_copper', name: 'Smelt Copper Ingot', category: 'smelting', tier: 2,
    inputs: [{ itemId: 'copper_ore', quantity: 2 }, { itemId: 'charcoal', quantity: 1 }],
    output: { itemId: 'copper_ingot', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'smelter', facilityLevel: 1, requiredSkill: 'smithing', requiredSkillLevel: 3,
    craftingTime: 3, discoveryMethod: 'known', baseFailChance: 0.04, description: 'Smelt copper ore into ingots.',
  },
  {
    id: 'smelt_silver', name: 'Smelt Silver Ingot', category: 'smelting', tier: 2,
    inputs: [{ itemId: 'silver_ore', quantity: 3 }],
    output: { itemId: 'silver_ingot', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'smelter', facilityLevel: 1, requiredSkill: 'smithing', requiredSkillLevel: 12,
    craftingTime: 4, discoveryMethod: 'known', baseFailChance: 0.06, description: 'Smelt silver ore into pure silver.',
  },
  {
    id: 'process_salt', name: 'Process Salt', category: 'cooking', tier: 2,
    inputs: [{ itemId: 'salt_rock', quantity: 2 }],
    output: { itemId: 'salt', quantity: 3, qualityAffectedBySkill: false, qualityAffectedByFacility: false },
    facility: 'kitchen', requiredSkill: 'cooking', requiredSkillLevel: 1,
    craftingTime: 1, discoveryMethod: 'known', baseFailChance: 0.01, description: 'Grind salt rocks into cooking salt.',
  },
  {
    id: 'dry_herbs', name: 'Dry Herbs', category: 'cooking', tier: 2,
    inputs: [{ itemId: 'herb', quantity: 3 }],
    output: { itemId: 'dried_herb', quantity: 2, qualityAffectedBySkill: false, qualityAffectedByFacility: true },
    facility: 'kitchen', requiredSkill: 'cooking', requiredSkillLevel: 3,
    craftingTime: 4, discoveryMethod: 'known', baseFailChance: 0.02, description: 'Preserve herbs through drying.',
  },
  {
    id: 'weave_rope', name: 'Weave Rope', category: 'textiles', tier: 2,
    inputs: [{ itemId: 'fiber', quantity: 3 }],
    output: { itemId: 'rope', quantity: 1, qualityAffectedBySkill: false, qualityAffectedByFacility: false },
    facility: 'workshop', requiredSkill: 'crafting', requiredSkillLevel: 2,
    craftingTime: 2, discoveryMethod: 'known', baseFailChance: 0.02, description: 'Twist fibers into strong rope.',
  },
  {
    id: 'make_glue', name: 'Make Glue', category: 'alchemy', tier: 2,
    inputs: [{ itemId: 'bone', quantity: 2 }, { itemId: 'water', quantity: 1 }],
    output: { itemId: 'glue', quantity: 2, qualityAffectedBySkill: false, qualityAffectedByFacility: false },
    facility: 'kitchen', requiredSkill: 'crafting', requiredSkillLevel: 3,
    craftingTime: 3, discoveryMethod: 'known', baseFailChance: 0.03, description: 'Boil bones into adhesive glue.',
  },
]

// ── Tier 3: Components/Parts ──

export const TIER3_RECIPES: AdvancedRecipe[] = [
  {
    id: 'forge_sword_blade', name: 'Forge Sword Blade', category: 'smithing', tier: 3,
    inputs: [{ itemId: 'steel_ingot', quantity: 2 }],
    output: { itemId: 'sword_blade', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'blacksmith', facilityLevel: 2, requiredSkill: 'smithing', requiredSkillLevel: 25,
    craftingTime: 5, discoveryMethod: 'known', baseFailChance: 0.08, description: 'Hammer steel into a sword blade.',
  },
  {
    id: 'forge_armor_plate', name: 'Forge Armor Plate', category: 'smithing', tier: 3,
    inputs: [{ itemId: 'steel_ingot', quantity: 3 }],
    output: { itemId: 'armor_plate', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'blacksmith', facilityLevel: 2, requiredSkill: 'smithing', requiredSkillLevel: 30,
    craftingTime: 6, discoveryMethod: 'known', baseFailChance: 0.1, description: 'Shape steel into armor plates.',
  },
  {
    id: 'carve_bow_limb', name: 'Carve Bow Limb', category: 'woodworking', tier: 3,
    inputs: [{ itemId: 'plank', quantity: 2 }, { itemId: 'sinew', quantity: 1 }],
    output: { itemId: 'bow_limb', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'workshop', requiredSkill: 'crafting', requiredSkillLevel: 15,
    craftingTime: 4, discoveryMethod: 'known', baseFailChance: 0.05, description: 'Carve flexible bow limbs.',
  },
  {
    id: 'cut_arrow_shafts', name: 'Cut Arrow Shafts', category: 'woodworking', tier: 3,
    inputs: [{ itemId: 'plank', quantity: 1 }],
    output: { itemId: 'arrow_shaft', quantity: 10, qualityAffectedBySkill: false, qualityAffectedByFacility: false },
    facility: 'workshop', requiredSkill: 'crafting', requiredSkillLevel: 3,
    craftingTime: 2, discoveryMethod: 'known', baseFailChance: 0.02, description: 'Cut wood into arrow shafts.',
  },
  {
    id: 'make_chain_links', name: 'Make Chain Links', category: 'smithing', tier: 3,
    inputs: [{ itemId: 'iron_ingot', quantity: 1 }],
    output: { itemId: 'chain_links', quantity: 20, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'blacksmith', requiredSkill: 'smithing', requiredSkillLevel: 15,
    craftingTime: 4, discoveryMethod: 'known', baseFailChance: 0.05, description: 'Hammer and link iron rings.',
  },
  {
    id: 'cut_leather_straps', name: 'Cut Leather Straps', category: 'leatherwork', tier: 3,
    inputs: [{ itemId: 'leather', quantity: 1 }],
    output: { itemId: 'leather_strap', quantity: 5, qualityAffectedBySkill: false, qualityAffectedByFacility: false },
    facility: 'workshop', requiredSkill: 'crafting', requiredSkillLevel: 3,
    craftingTime: 1, discoveryMethod: 'known', baseFailChance: 0.01, description: 'Cut leather into straps.',
  },
  {
    id: 'blow_glass_vial', name: 'Blow Glass Vials', category: 'pottery', tier: 3,
    inputs: [{ itemId: 'glass', quantity: 1 }],
    output: { itemId: 'glass_vial', quantity: 3, qualityAffectedBySkill: true, qualityAffectedByFacility: false },
    facility: 'workshop', requiredSkill: 'crafting', requiredSkillLevel: 10,
    craftingTime: 2, discoveryMethod: 'known', baseFailChance: 0.08, description: 'Shape glass into potion vials.',
  },
  {
    id: 'make_parchment', name: 'Make Parchment', category: 'leatherwork', tier: 3,
    inputs: [{ itemId: 'hide', quantity: 1 }],
    output: { itemId: 'parchment', quantity: 3, qualityAffectedBySkill: false, qualityAffectedByFacility: false },
    facility: 'workshop', requiredSkill: 'crafting', requiredSkillLevel: 5,
    craftingTime: 3, discoveryMethod: 'known', baseFailChance: 0.03, description: 'Process hide into writing parchment.',
  },
  {
    id: 'brew_enchanting_ink', name: 'Brew Enchanting Ink', category: 'alchemy', tier: 3,
    inputs: [{ itemId: 'potion_base', quantity: 1 }, { itemId: 'refined_crystal', quantity: 1 }, { itemId: 'gold_dust', quantity: 1 }],
    output: { itemId: 'enchanting_ink', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'alchemy_lab', facilityLevel: 3, requiredSkill: 'alchemy', requiredSkillLevel: 40,
    craftingTime: 8, discoveryMethod: 'recipe_scroll', baseFailChance: 0.15, description: 'Magical ink for enchanting.',
  },
  {
    id: 'make_nails', name: 'Make Nails', category: 'smithing', tier: 3,
    inputs: [{ itemId: 'iron_ingot', quantity: 1 }],
    output: { itemId: 'nail', quantity: 20, qualityAffectedBySkill: false, qualityAffectedByFacility: false },
    facility: 'blacksmith', requiredSkill: 'smithing', requiredSkillLevel: 5,
    craftingTime: 2, discoveryMethod: 'known', baseFailChance: 0.01, description: 'Forge iron nails.',
  },
  {
    id: 'make_hinges', name: 'Make Hinges', category: 'smithing', tier: 3,
    inputs: [{ itemId: 'iron_ingot', quantity: 1 }],
    output: { itemId: 'iron_hinge', quantity: 4, qualityAffectedBySkill: false, qualityAffectedByFacility: false },
    facility: 'blacksmith', requiredSkill: 'smithing', requiredSkillLevel: 8,
    craftingTime: 2, discoveryMethod: 'known', baseFailChance: 0.02, description: 'Forge iron hinges.',
  },
  {
    id: 'make_string', name: 'Make String', category: 'textiles', tier: 3,
    inputs: [{ itemId: 'fiber', quantity: 2 }],
    output: { itemId: 'string', quantity: 5, qualityAffectedBySkill: false, qualityAffectedByFacility: false },
    facility: 'workshop', requiredSkill: 'crafting', requiredSkillLevel: 1,
    craftingTime: 1, discoveryMethod: 'known', baseFailChance: 0.01, description: 'Twist fibers into string.',
  },
  {
    id: 'make_arrowheads', name: 'Forge Arrowheads', category: 'smithing', tier: 3,
    inputs: [{ itemId: 'iron_ingot', quantity: 1 }],
    output: { itemId: 'arrowhead', quantity: 15, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'blacksmith', requiredSkill: 'smithing', requiredSkillLevel: 10,
    craftingTime: 3, discoveryMethod: 'known', baseFailChance: 0.04, description: 'Forge sharp arrowheads.',
  },
  {
    id: 'carve_staff_core', name: 'Carve Staff Core', category: 'woodworking', tier: 3,
    inputs: [{ itemId: 'plank', quantity: 2 }],
    output: { itemId: 'staff_core', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'workshop', requiredSkill: 'crafting', requiredSkillLevel: 12,
    craftingTime: 3, discoveryMethod: 'known', baseFailChance: 0.04, description: 'Carve wood into a staff core.',
  },
  {
    id: 'make_axe_head', name: 'Forge Axe Head', category: 'smithing', tier: 3,
    inputs: [{ itemId: 'iron_ingot', quantity: 2 }],
    output: { itemId: 'axe_head', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'blacksmith', requiredSkill: 'smithing', requiredSkillLevel: 15,
    craftingTime: 4, discoveryMethod: 'known', baseFailChance: 0.05, description: 'Forge a heavy axe head.',
  },
  {
    id: 'make_gem_setting', name: 'Make Gem Setting', category: 'smithing', tier: 3,
    inputs: [{ itemId: 'gold_ingot', quantity: 1 }],
    output: { itemId: 'gem_setting', quantity: 3, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'blacksmith', requiredSkill: 'smithing', requiredSkillLevel: 20,
    craftingTime: 3, discoveryMethod: 'known', baseFailChance: 0.06, description: 'Craft delicate gem settings.',
  },
  {
    id: 'make_shield_boss', name: 'Forge Shield Boss', category: 'smithing', tier: 3,
    inputs: [{ itemId: 'steel_ingot', quantity: 1 }],
    output: { itemId: 'shield_boss', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'blacksmith', requiredSkill: 'smithing', requiredSkillLevel: 18,
    craftingTime: 4, discoveryMethod: 'known', baseFailChance: 0.05, description: 'Forge a shield boss.',
  },
  {
    id: 'cut_gemstone', name: 'Cut Gemstone', category: 'smithing', tier: 3,
    inputs: [{ itemId: 'raw_gemstone', quantity: 1 }],
    output: { itemId: 'cut_gemstone', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'workshop', requiredSkill: 'crafting', requiredSkillLevel: 25,
    craftingTime: 5, discoveryMethod: 'npc_teaching', baseFailChance: 0.12, description: 'Cut and polish gemstones.',
  },
  {
    id: 'make_lock_mechanism', name: 'Make Lock Mechanism', category: 'smithing', tier: 3,
    inputs: [{ itemId: 'iron_ingot', quantity: 1 }, { itemId: 'steel_ingot', quantity: 1 }],
    output: { itemId: 'lock_mechanism', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'blacksmith', requiredSkill: 'smithing', requiredSkillLevel: 22,
    craftingTime: 5, discoveryMethod: 'npc_teaching', baseFailChance: 0.08, description: 'Craft intricate lock mechanisms.',
  },
]

// ── Tier 4: Finished Products ──
// WEAPONS

export const TIER4_WEAPONS: AdvancedRecipe[] = [
  {
    id: 'craft_iron_sword', name: 'Forge Iron Sword', category: 'smithing', tier: 4,
    inputs: [{ itemId: 'sword_blade', quantity: 1 }, { itemId: 'plank', quantity: 1 }, { itemId: 'leather_strap', quantity: 1 }],
    output: { itemId: 'iron_sword', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'blacksmith', facilityLevel: 1, requiredSkill: 'smithing', requiredSkillLevel: 15,
    craftingTime: 5, discoveryMethod: 'known', baseFailChance: 0.05, description: 'Assemble an iron sword.',
  },
  {
    id: 'craft_steel_greatsword', name: 'Forge Steel Greatsword', category: 'smithing', tier: 4,
    inputs: [{ itemId: 'sword_blade', quantity: 2 }, { itemId: 'plank', quantity: 1 }, { itemId: 'leather_strap', quantity: 2 }],
    output: { itemId: 'steel_greatsword', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'blacksmith', facilityLevel: 2, requiredSkill: 'smithing', requiredSkillLevel: 35,
    craftingTime: 8, discoveryMethod: 'known', baseFailChance: 0.1, description: 'Forge a mighty greatsword.',
  },
  {
    id: 'craft_bow', name: 'Craft Hunting Bow', category: 'woodworking', tier: 4,
    inputs: [{ itemId: 'bow_limb', quantity: 2 }, { itemId: 'sinew', quantity: 1 }, { itemId: 'string', quantity: 1 }],
    output: { itemId: 'hunting_bow', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'workshop', requiredSkill: 'crafting', requiredSkillLevel: 20,
    craftingTime: 5, discoveryMethod: 'known', baseFailChance: 0.05, description: 'Assemble a hunting bow.',
  },
  {
    id: 'craft_crossbow', name: 'Craft Crossbow', category: 'woodworking', tier: 4,
    inputs: [{ itemId: 'plank', quantity: 2 }, { itemId: 'iron_ingot', quantity: 1 }, { itemId: 'sinew', quantity: 1 }],
    output: { itemId: 'crossbow', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'workshop', requiredSkill: 'crafting', requiredSkillLevel: 25,
    craftingTime: 6, discoveryMethod: 'known', baseFailChance: 0.08, description: 'Craft a crossbow mechanism.',
  },
  {
    id: 'craft_war_hammer', name: 'Forge War Hammer', category: 'smithing', tier: 4,
    inputs: [{ itemId: 'steel_ingot', quantity: 3 }, { itemId: 'plank', quantity: 2 }],
    output: { itemId: 'war_hammer', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'blacksmith', facilityLevel: 2, requiredSkill: 'smithing', requiredSkillLevel: 30,
    craftingTime: 7, discoveryMethod: 'known', baseFailChance: 0.08, description: 'Forge a devastating war hammer.',
  },
  {
    id: 'craft_iron_axe', name: 'Forge Iron Axe', category: 'smithing', tier: 4,
    inputs: [{ itemId: 'axe_head', quantity: 1 }, { itemId: 'plank', quantity: 1 }],
    output: { itemId: 'iron_axe', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'blacksmith', requiredSkill: 'smithing', requiredSkillLevel: 12,
    craftingTime: 4, discoveryMethod: 'known', baseFailChance: 0.05, description: 'Forge an iron axe.',
  },
  {
    id: 'craft_iron_spear', name: 'Forge Iron Spear', category: 'smithing', tier: 4,
    inputs: [{ itemId: 'iron_ingot', quantity: 1 }, { itemId: 'plank', quantity: 2 }],
    output: { itemId: 'iron_spear', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'blacksmith', requiredSkill: 'smithing', requiredSkillLevel: 10,
    craftingTime: 4, discoveryMethod: 'known', baseFailChance: 0.04, description: 'Forge an iron-tipped spear.',
  },
  {
    id: 'craft_iron_dagger', name: 'Forge Iron Dagger', category: 'smithing', tier: 4,
    inputs: [{ itemId: 'iron_ingot', quantity: 1 }, { itemId: 'leather_strap', quantity: 1 }],
    output: { itemId: 'iron_dagger', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'blacksmith', requiredSkill: 'smithing', requiredSkillLevel: 8,
    craftingTime: 3, discoveryMethod: 'known', baseFailChance: 0.03, description: 'Forge a swift dagger.',
  },
  {
    id: 'craft_arrows', name: 'Craft Arrows', category: 'woodworking', tier: 4,
    inputs: [{ itemId: 'arrow_shaft', quantity: 5 }, { itemId: 'arrowhead', quantity: 5 }, { itemId: 'feather', quantity: 5 }],
    output: { itemId: 'arrow', quantity: 5, qualityAffectedBySkill: true, qualityAffectedByFacility: false },
    facility: 'workshop', requiredSkill: 'crafting', requiredSkillLevel: 8,
    craftingTime: 2, discoveryMethod: 'known', baseFailChance: 0.02, description: 'Assemble arrows.',
  },
  {
    id: 'craft_mace', name: 'Forge Mace', category: 'smithing', tier: 4,
    inputs: [{ itemId: 'iron_ingot', quantity: 2 }, { itemId: 'plank', quantity: 1 }],
    output: { itemId: 'mace', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'blacksmith', requiredSkill: 'smithing', requiredSkillLevel: 14,
    craftingTime: 4, discoveryMethod: 'known', baseFailChance: 0.05, description: 'Forge a heavy mace.',
  },
  {
    id: 'craft_flail', name: 'Forge Flail', category: 'smithing', tier: 4,
    inputs: [{ itemId: 'iron_ingot', quantity: 2 }, { itemId: 'chain_links', quantity: 10 }, { itemId: 'plank', quantity: 1 }],
    output: { itemId: 'flail', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'blacksmith', requiredSkill: 'smithing', requiredSkillLevel: 20,
    craftingTime: 5, discoveryMethod: 'npc_teaching', baseFailChance: 0.07, description: 'Craft a chained flail.',
  },
  {
    id: 'craft_staff', name: 'Craft Mage Staff', category: 'enchanting', tier: 4,
    inputs: [{ itemId: 'staff_core', quantity: 1 }, { itemId: 'refined_crystal', quantity: 1 }, { itemId: 'leather_strap', quantity: 1 }],
    output: { itemId: 'mage_staff', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'enchanting_table', requiredSkill: 'alchemy', requiredSkillLevel: 25,
    craftingTime: 6, discoveryMethod: 'recipe_scroll', baseFailChance: 0.08, description: 'Craft a magical staff.',
  },
]

// ARMOR
export const TIER4_ARMOR: AdvancedRecipe[] = [
  {
    id: 'craft_leather_armor', name: 'Craft Leather Armor', category: 'leatherwork', tier: 4,
    inputs: [{ itemId: 'leather', quantity: 4 }, { itemId: 'leather_strap', quantity: 4 }],
    output: { itemId: 'leather_armor', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'workshop', requiredSkill: 'crafting', requiredSkillLevel: 15,
    craftingTime: 5, discoveryMethod: 'known', baseFailChance: 0.05, description: 'Stitch leather into armor.',
  },
  {
    id: 'craft_chain_mail', name: 'Craft Chain Mail', category: 'smithing', tier: 4,
    inputs: [{ itemId: 'chain_links', quantity: 40 }, { itemId: 'leather', quantity: 2 }],
    output: { itemId: 'chain_mail', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'blacksmith', facilityLevel: 2, requiredSkill: 'smithing', requiredSkillLevel: 35,
    craftingTime: 10, discoveryMethod: 'known', baseFailChance: 0.1, description: 'Link chains into protective mail.',
  },
  {
    id: 'craft_plate_armor', name: 'Forge Plate Armor', category: 'smithing', tier: 4,
    inputs: [{ itemId: 'armor_plate', quantity: 4 }, { itemId: 'chain_links', quantity: 20 }, { itemId: 'leather_strap', quantity: 6 }],
    output: { itemId: 'plate_armor', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'blacksmith', facilityLevel: 3, requiredSkill: 'smithing', requiredSkillLevel: 50,
    craftingTime: 15, discoveryMethod: 'recipe_scroll', baseFailChance: 0.15, description: 'Master smithing: full plate armor.',
  },
  {
    id: 'craft_mithril_armor', name: 'Forge Mithril Armor', category: 'smithing', tier: 4,
    inputs: [{ itemId: 'mithril_ingot', quantity: 5 }, { itemId: 'silk_cloth', quantity: 3 }],
    output: { itemId: 'mithril_armor', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'blacksmith', facilityLevel: 3, requiredSkill: 'smithing', requiredSkillLevel: 70,
    craftingTime: 20, discoveryMethod: 'recipe_scroll', baseFailChance: 0.2, description: 'Legendary mithril craftsmanship.',
  },
  {
    id: 'craft_wooden_shield', name: 'Craft Wooden Shield', category: 'woodworking', tier: 4,
    inputs: [{ itemId: 'plank', quantity: 3 }, { itemId: 'leather_strap', quantity: 2 }],
    output: { itemId: 'wooden_shield', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'workshop', requiredSkill: 'crafting', requiredSkillLevel: 10,
    craftingTime: 4, discoveryMethod: 'known', baseFailChance: 0.04, description: 'Craft a wooden shield.',
  },
  {
    id: 'craft_iron_shield', name: 'Forge Iron Shield', category: 'smithing', tier: 4,
    inputs: [{ itemId: 'shield_boss', quantity: 1 }, { itemId: 'plank', quantity: 2 }, { itemId: 'leather_strap', quantity: 2 }],
    output: { itemId: 'iron_shield', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'blacksmith', requiredSkill: 'smithing', requiredSkillLevel: 20,
    craftingTime: 5, discoveryMethod: 'known', baseFailChance: 0.06, description: 'Forge an iron-reinforced shield.',
  },
  {
    id: 'craft_helmet', name: 'Forge Helmet', category: 'smithing', tier: 4,
    inputs: [{ itemId: 'steel_ingot', quantity: 2 }, { itemId: 'leather', quantity: 1 }],
    output: { itemId: 'helmet', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'blacksmith', requiredSkill: 'smithing', requiredSkillLevel: 25,
    craftingTime: 6, discoveryMethod: 'known', baseFailChance: 0.07, description: 'Forge a protective helmet.',
  },
  {
    id: 'craft_gauntlets', name: 'Forge Gauntlets', category: 'smithing', tier: 4,
    inputs: [{ itemId: 'steel_ingot', quantity: 1 }, { itemId: 'leather', quantity: 1 }],
    output: { itemId: 'gauntlets', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'blacksmith', requiredSkill: 'smithing', requiredSkillLevel: 22,
    craftingTime: 5, discoveryMethod: 'known', baseFailChance: 0.06, description: 'Forge armored gauntlets.',
  },
  {
    id: 'craft_boots', name: 'Craft Leather Boots', category: 'leatherwork', tier: 4,
    inputs: [{ itemId: 'leather', quantity: 2 }, { itemId: 'leather_strap', quantity: 2 }],
    output: { itemId: 'boots', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'workshop', requiredSkill: 'crafting', requiredSkillLevel: 12,
    craftingTime: 4, discoveryMethod: 'known', baseFailChance: 0.04, description: 'Craft sturdy leather boots.',
  },
]

// TOOLS
export const TIER4_TOOLS: AdvancedRecipe[] = [
  {
    id: 'craft_steel_pickaxe', name: 'Forge Steel Pickaxe', category: 'smithing', tier: 4,
    inputs: [{ itemId: 'steel_ingot', quantity: 1 }, { itemId: 'plank', quantity: 1 }],
    output: { itemId: 'steel_pickaxe', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'blacksmith', requiredSkill: 'smithing', requiredSkillLevel: 15,
    craftingTime: 4, discoveryMethod: 'known', baseFailChance: 0.05, description: 'Forge a durable pickaxe.',
  },
  {
    id: 'craft_master_hammer', name: 'Forge Master Hammer', category: 'smithing', tier: 4,
    inputs: [{ itemId: 'steel_ingot', quantity: 2 }, { itemId: 'leather_strap', quantity: 1 }, { itemId: 'plank', quantity: 1 }],
    output: { itemId: 'smithing_hammer', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'blacksmith', facilityLevel: 2, requiredSkill: 'smithing', requiredSkillLevel: 30,
    craftingTime: 6, discoveryMethod: 'npc_teaching', baseFailChance: 0.08, description: 'A smiths most important tool.',
  },
  {
    id: 'craft_saw', name: 'Forge Saw', category: 'smithing', tier: 4,
    inputs: [{ itemId: 'steel_ingot', quantity: 1 }, { itemId: 'plank', quantity: 1 }],
    output: { itemId: 'saw', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'blacksmith', requiredSkill: 'smithing', requiredSkillLevel: 12,
    craftingTime: 4, discoveryMethod: 'known', baseFailChance: 0.05, description: 'Forge a sharp saw.',
  },
  {
    id: 'craft_fishing_rod', name: 'Craft Fishing Rod', category: 'woodworking', tier: 4,
    inputs: [{ itemId: 'plank', quantity: 1 }, { itemId: 'string', quantity: 3 }],
    output: { itemId: 'fishing_rod', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: false },
    facility: 'workshop', requiredSkill: 'crafting', requiredSkillLevel: 5,
    craftingTime: 2, discoveryMethod: 'known', baseFailChance: 0.02, description: 'Craft a simple fishing rod.',
  },
  {
    id: 'craft_shovel', name: 'Forge Shovel', category: 'smithing', tier: 4,
    inputs: [{ itemId: 'iron_ingot', quantity: 1 }, { itemId: 'plank', quantity: 1 }],
    output: { itemId: 'shovel', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'blacksmith', requiredSkill: 'smithing', requiredSkillLevel: 8,
    craftingTime: 3, discoveryMethod: 'known', baseFailChance: 0.03, description: 'Forge a sturdy shovel.',
  },
  {
    id: 'craft_hoe', name: 'Forge Hoe', category: 'smithing', tier: 4,
    inputs: [{ itemId: 'iron_ingot', quantity: 1 }, { itemId: 'plank', quantity: 1 }],
    output: { itemId: 'hoe', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'blacksmith', requiredSkill: 'smithing', requiredSkillLevel: 8,
    craftingTime: 3, discoveryMethod: 'known', baseFailChance: 0.03, description: 'Forge a farming hoe.',
  },
  {
    id: 'craft_sickle', name: 'Forge Sickle', category: 'smithing', tier: 4,
    inputs: [{ itemId: 'iron_ingot', quantity: 1 }, { itemId: 'plank', quantity: 1 }],
    output: { itemId: 'sickle', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'blacksmith', requiredSkill: 'smithing', requiredSkillLevel: 10,
    craftingTime: 3, discoveryMethod: 'known', baseFailChance: 0.04, description: 'Forge a harvesting sickle.',
  },
]

// FOOD
export const TIER4_FOOD: AdvancedRecipe[] = [
  {
    id: 'bake_bread', name: 'Bake Bread', category: 'cooking', tier: 4,
    inputs: [{ itemId: 'flour', quantity: 1 }, { itemId: 'water', quantity: 1 }],
    output: { itemId: 'bread', quantity: 2, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'bakery', requiredSkill: 'cooking', requiredSkillLevel: 3,
    craftingTime: 3, discoveryMethod: 'known', baseFailChance: 0.03, description: 'Bake fresh bread.',
  },
  {
    id: 'cook_stew', name: 'Cook Hearty Stew', category: 'cooking', tier: 4,
    inputs: [{ itemId: 'meat', quantity: 1 }, { itemId: 'potato', quantity: 1 }, { itemId: 'herb', quantity: 1 }, { itemId: 'water', quantity: 1 }],
    output: { itemId: 'stew', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'kitchen', requiredSkill: 'cooking', requiredSkillLevel: 10,
    craftingTime: 4, discoveryMethod: 'known', baseFailChance: 0.05, description: 'A warming, hearty stew.',
  },
  {
    id: 'bake_pie', name: 'Bake Meat Pie', category: 'cooking', tier: 4,
    inputs: [{ itemId: 'flour', quantity: 1 }, { itemId: 'meat', quantity: 1 }, { itemId: 'egg', quantity: 1 }],
    output: { itemId: 'pie', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'bakery', requiredSkill: 'cooking', requiredSkillLevel: 15,
    craftingTime: 4, discoveryMethod: 'known', baseFailChance: 0.05, description: 'Golden-crusted meat pie.',
  },
  {
    id: 'bake_cake', name: 'Bake Celebration Cake', category: 'cooking', tier: 4,
    inputs: [{ itemId: 'flour', quantity: 1 }, { itemId: 'egg', quantity: 2 }, { itemId: 'milk', quantity: 1 }, { itemId: 'honey', quantity: 1 }],
    output: { itemId: 'cake', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'bakery', facilityLevel: 2, requiredSkill: 'cooking', requiredSkillLevel: 25,
    craftingTime: 5, discoveryMethod: 'npc_teaching', baseFailChance: 0.08, description: 'An exquisite celebration cake.',
  },
  {
    id: 'roast_meat', name: 'Roast Meat', category: 'cooking', tier: 4,
    inputs: [{ itemId: 'meat', quantity: 2 }, { itemId: 'herb', quantity: 1 }],
    output: { itemId: 'roasted_meat', quantity: 2, qualityAffectedBySkill: true, qualityAffectedByFacility: false },
    facility: 'kitchen', requiredSkill: 'cooking', requiredSkillLevel: 5,
    craftingTime: 3, discoveryMethod: 'known', baseFailChance: 0.03, description: 'Savory roasted meat.',
  },
  {
    id: 'cook_soup', name: 'Cook Vegetable Soup', category: 'cooking', tier: 4,
    inputs: [{ itemId: 'potato', quantity: 1 }, { itemId: 'carrot', quantity: 1 }, { itemId: 'water', quantity: 1 }],
    output: { itemId: 'soup', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'kitchen', requiredSkill: 'cooking', requiredSkillLevel: 5,
    craftingTime: 3, discoveryMethod: 'known', baseFailChance: 0.02, description: 'Simple vegetable soup.',
  },
  {
    id: 'cook_pasta', name: 'Cook Pasta', category: 'cooking', tier: 4,
    inputs: [{ itemId: 'flour', quantity: 1 }, { itemId: 'egg', quantity: 1 }, { itemId: 'water', quantity: 1 }],
    output: { itemId: 'pasta', quantity: 2, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'kitchen', requiredSkill: 'cooking', requiredSkillLevel: 8,
    craftingTime: 3, discoveryMethod: 'cultural_tradition', baseFailChance: 0.03, description: 'Fresh pasta.',
  },
  {
    id: 'cook_fish', name: 'Cook Fish', category: 'cooking', tier: 4,
    inputs: [{ itemId: 'fish', quantity: 1 }, { itemId: 'herb', quantity: 1 }],
    output: { itemId: 'cooked_fish', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: false },
    facility: 'kitchen', requiredSkill: 'cooking', requiredSkillLevel: 3,
    craftingTime: 2, discoveryMethod: 'known', baseFailChance: 0.02, description: 'Pan-fried fish.',
  },
  {
    id: 'make_cheese', name: 'Make Cheese', category: 'cooking', tier: 4,
    inputs: [{ itemId: 'milk', quantity: 3 }, { itemId: 'salt', quantity: 1 }],
    output: { itemId: 'cheese', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'kitchen', requiredSkill: 'cooking', requiredSkillLevel: 12,
    craftingTime: 6, discoveryMethod: 'cultural_tradition', baseFailChance: 0.05, description: 'Age milk into cheese.',
  },
  {
    id: 'make_butter', name: 'Make Butter', category: 'cooking', tier: 4,
    inputs: [{ itemId: 'milk', quantity: 2 }],
    output: { itemId: 'butter', quantity: 1, qualityAffectedBySkill: false, qualityAffectedByFacility: false },
    facility: 'kitchen', requiredSkill: 'cooking', requiredSkillLevel: 3,
    craftingTime: 2, discoveryMethod: 'known', baseFailChance: 0.02, description: 'Churn milk into butter.',
  },
  {
    id: 'preserve_meat', name: 'Preserve Meat', category: 'cooking', tier: 4,
    inputs: [{ itemId: 'meat', quantity: 2 }, { itemId: 'salt', quantity: 2 }],
    output: { itemId: 'preserved_meat', quantity: 2, qualityAffectedBySkill: true, qualityAffectedByFacility: false },
    facility: 'kitchen', requiredSkill: 'cooking', requiredSkillLevel: 8,
    craftingTime: 4, discoveryMethod: 'known', baseFailChance: 0.03, description: 'Salt-cure meat for storage.',
  },
]

// POTIONS
export const TIER4_POTIONS: AdvancedRecipe[] = [
  {
    id: 'brew_healing_potion', name: 'Brew Healing Potion', category: 'alchemy', tier: 4,
    inputs: [{ itemId: 'potion_base', quantity: 1 }, { itemId: 'herb', quantity: 2 }, { itemId: 'glass_vial', quantity: 1 }],
    output: { itemId: 'healing_potion', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'alchemy_lab', facilityLevel: 1, requiredSkill: 'alchemy', requiredSkillLevel: 10,
    craftingTime: 4, discoveryMethod: 'known', baseFailChance: 0.08, description: 'A potion to restore health.',
  },
  {
    id: 'brew_mana_potion', name: 'Brew Mana Potion', category: 'alchemy', tier: 4,
    inputs: [{ itemId: 'potion_base', quantity: 1 }, { itemId: 'refined_crystal', quantity: 1 }, { itemId: 'glass_vial', quantity: 1 }],
    output: { itemId: 'mana_potion', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'alchemy_lab', facilityLevel: 2, requiredSkill: 'alchemy', requiredSkillLevel: 20,
    craftingTime: 5, discoveryMethod: 'experimentation', baseFailChance: 0.12, description: 'Restores magical energy.',
  },
  {
    id: 'brew_strength_potion', name: 'Brew Strength Potion', category: 'alchemy', tier: 4,
    inputs: [{ itemId: 'potion_base', quantity: 1 }, { itemId: 'troll_blood', quantity: 1 }, { itemId: 'glass_vial', quantity: 1 }],
    output: { itemId: 'strength_potion', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'alchemy_lab', facilityLevel: 2, requiredSkill: 'alchemy', requiredSkillLevel: 25,
    craftingTime: 5, discoveryMethod: 'experimentation', baseFailChance: 0.12, description: 'Grants temporary strength.',
  },
  {
    id: 'brew_antidote', name: 'Brew Antidote', category: 'alchemy', tier: 4,
    inputs: [{ itemId: 'potion_base', quantity: 1 }, { itemId: 'herb', quantity: 3 }, { itemId: 'glass_vial', quantity: 1 }],
    output: { itemId: 'antidote', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'alchemy_lab', facilityLevel: 1, requiredSkill: 'alchemy', requiredSkillLevel: 15,
    craftingTime: 3, discoveryMethod: 'known', baseFailChance: 0.05, description: 'Cures poison and toxins.',
  },
  {
    id: 'brew_invisibility_potion', name: 'Brew Invisibility Potion', category: 'alchemy', tier: 4,
    inputs: [{ itemId: 'potion_base', quantity: 1 }, { itemId: 'shadow_essence', quantity: 1 }, { itemId: 'refined_crystal', quantity: 1 }, { itemId: 'glass_vial', quantity: 1 }],
    output: { itemId: 'invisibility_potion', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'alchemy_lab', facilityLevel: 3, requiredSkill: 'alchemy', requiredSkillLevel: 45,
    craftingTime: 8, discoveryMethod: 'recipe_scroll', baseFailChance: 0.18, description: 'Grants temporary invisibility.',
  },
  {
    id: 'brew_speed_potion', name: 'Brew Speed Potion', category: 'alchemy', tier: 4,
    inputs: [{ itemId: 'potion_base', quantity: 1 }, { itemId: 'rabbit_foot', quantity: 1 }, { itemId: 'glass_vial', quantity: 1 }],
    output: { itemId: 'speed_potion', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'alchemy_lab', facilityLevel: 2, requiredSkill: 'alchemy', requiredSkillLevel: 22,
    craftingTime: 4, discoveryMethod: 'experimentation', baseFailChance: 0.1, description: 'Increases movement speed.',
  },
  {
    id: 'brew_fire_resistance_potion', name: 'Brew Fire Resistance Potion', category: 'alchemy', tier: 4,
    inputs: [{ itemId: 'potion_base', quantity: 1 }, { itemId: 'salamander_scale', quantity: 1 }, { itemId: 'glass_vial', quantity: 1 }],
    output: { itemId: 'fire_resistance_potion', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'alchemy_lab', facilityLevel: 2, requiredSkill: 'alchemy', requiredSkillLevel: 28,
    craftingTime: 5, discoveryMethod: 'recipe_scroll', baseFailChance: 0.12, description: 'Protects against fire damage.',
  },
]

// BOOKS & SCROLLS
export const TIER4_BOOKS: AdvancedRecipe[] = [
  {
    id: 'bind_blank_book', name: 'Bind Blank Book', category: 'leatherwork', tier: 4,
    inputs: [{ itemId: 'leather', quantity: 1 }, { itemId: 'parchment', quantity: 10 }],
    output: { itemId: 'blank_book', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: false },
    facility: 'workshop', requiredSkill: 'crafting', requiredSkillLevel: 15,
    craftingTime: 4, discoveryMethod: 'known', baseFailChance: 0.03, description: 'Bind parchment into a book.',
  },
  {
    id: 'write_scroll', name: 'Write Enchanting Scroll', category: 'enchanting', tier: 4,
    inputs: [{ itemId: 'parchment', quantity: 1 }, { itemId: 'enchanting_ink', quantity: 1 }],
    output: { itemId: 'magic_scroll', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: false },
    facility: 'enchanting_table', requiredSkill: 'alchemy', requiredSkillLevel: 30,
    craftingTime: 5, discoveryMethod: 'library_research', baseFailChance: 0.1, description: 'Inscribe magical formulae.',
  },
  {
    id: 'write_recipe_book', name: 'Write Recipe Book', category: 'leatherwork', tier: 4,
    inputs: [{ itemId: 'blank_book', quantity: 1 }, { itemId: 'ink', quantity: 1 }],
    output: { itemId: 'recipe_book', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: false },
    facility: 'workshop', requiredSkill: 'crafting', requiredSkillLevel: 20,
    craftingTime: 6, discoveryMethod: 'known', baseFailChance: 0.05, description: 'Compile recipes into a book.',
  },
]

// CONSTRUCTION
export const TIER4_CONSTRUCTION: AdvancedRecipe[] = [
  {
    id: 'craft_door', name: 'Build Door', category: 'construction', tier: 4,
    inputs: [{ itemId: 'plank', quantity: 4 }, { itemId: 'iron_hinge', quantity: 2 }],
    output: { itemId: 'door', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: false },
    facility: 'workshop', requiredSkill: 'crafting', requiredSkillLevel: 10,
    craftingTime: 3, discoveryMethod: 'known', baseFailChance: 0.03, description: 'Build a sturdy wooden door.',
  },
  {
    id: 'craft_window', name: 'Build Window', category: 'construction', tier: 4,
    inputs: [{ itemId: 'glass', quantity: 2 }, { itemId: 'plank', quantity: 2 }],
    output: { itemId: 'window', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: false },
    facility: 'workshop', requiredSkill: 'crafting', requiredSkillLevel: 12,
    craftingTime: 3, discoveryMethod: 'known', baseFailChance: 0.05, description: 'Frame glass into a window.',
  },
  {
    id: 'craft_furniture', name: 'Build Furniture', category: 'construction', tier: 4,
    inputs: [{ itemId: 'plank', quantity: 3 }, { itemId: 'nail', quantity: 10 }],
    output: { itemId: 'furniture', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'workshop', requiredSkill: 'crafting', requiredSkillLevel: 15,
    craftingTime: 4, discoveryMethod: 'known', baseFailChance: 0.05, description: 'Craft quality furniture.',
  },
  {
    id: 'craft_chest', name: 'Build Chest', category: 'construction', tier: 4,
    inputs: [{ itemId: 'plank', quantity: 4 }, { itemId: 'iron_hinge', quantity: 2 }, { itemId: 'lock_mechanism', quantity: 1 }],
    output: { itemId: 'chest', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'workshop', requiredSkill: 'crafting', requiredSkillLevel: 18,
    craftingTime: 5, discoveryMethod: 'known', baseFailChance: 0.05, description: 'Build a lockable storage chest.',
  },
  {
    id: 'craft_barrel', name: 'Build Barrel', category: 'construction', tier: 4,
    inputs: [{ itemId: 'plank', quantity: 3 }, { itemId: 'iron_hinge', quantity: 1 }],
    output: { itemId: 'barrel', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'workshop', requiredSkill: 'crafting', requiredSkillLevel: 10,
    craftingTime: 3, discoveryMethod: 'known', baseFailChance: 0.04, description: 'Craft a wooden barrel.',
  },
  {
    id: 'craft_ladder', name: 'Build Ladder', category: 'construction', tier: 4,
    inputs: [{ itemId: 'plank', quantity: 2 }, { itemId: 'rope', quantity: 1 }],
    output: { itemId: 'ladder', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: false },
    facility: 'workshop', requiredSkill: 'crafting', requiredSkillLevel: 8,
    craftingTime: 2, discoveryMethod: 'known', baseFailChance: 0.03, description: 'Build a climbing ladder.',
  },
]

// BREWING
export const TIER4_BREWING: AdvancedRecipe[] = [
  {
    id: 'brew_ale', name: 'Brew Ale', category: 'brewing', tier: 4,
    inputs: [{ itemId: 'grain', quantity: 3 }, { itemId: 'water', quantity: 2 }, { itemId: 'honey', quantity: 1 }],
    output: { itemId: 'ale', quantity: 3, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'brewery', requiredSkill: 'cooking', requiredSkillLevel: 15,
    craftingTime: 10, discoveryMethod: 'known', baseFailChance: 0.05, description: 'Brew hearty ale.',
  },
  {
    id: 'brew_wine', name: 'Brew Wine', category: 'brewing', tier: 4,
    inputs: [{ itemId: 'grape', quantity: 5 }, { itemId: 'water', quantity: 1 }],
    output: { itemId: 'wine', quantity: 2, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'brewery', facilityLevel: 2, requiredSkill: 'cooking', requiredSkillLevel: 25,
    craftingTime: 20, discoveryMethod: 'cultural_tradition', baseFailChance: 0.08, description: 'Fine wine, aged to perfection.',
  },
  {
    id: 'brew_mead', name: 'Brew Mead', category: 'brewing', tier: 4,
    inputs: [{ itemId: 'honey', quantity: 3 }, { itemId: 'water', quantity: 2 }],
    output: { itemId: 'mead', quantity: 2, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'brewery', requiredSkill: 'cooking', requiredSkillLevel: 18,
    craftingTime: 15, discoveryMethod: 'cultural_tradition', baseFailChance: 0.06, description: 'Sweet honey mead.',
  },
]

// JEWELRY
export const TIER4_JEWELRY: AdvancedRecipe[] = [
  {
    id: 'craft_gold_ring', name: 'Craft Gold Ring', category: 'smithing', tier: 4,
    inputs: [{ itemId: 'gold_ingot', quantity: 1 }],
    output: { itemId: 'gold_ring', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'blacksmith', requiredSkill: 'smithing', requiredSkillLevel: 15,
    craftingTime: 3, discoveryMethod: 'known', baseFailChance: 0.05, description: 'Craft a gold ring.',
  },
  {
    id: 'craft_gemmed_ring', name: 'Craft Gemmed Ring', category: 'smithing', tier: 4,
    inputs: [{ itemId: 'gold_ring', quantity: 1 }, { itemId: 'cut_gemstone', quantity: 1 }, { itemId: 'gem_setting', quantity: 1 }],
    output: { itemId: 'gemmed_ring', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'blacksmith', requiredSkill: 'smithing', requiredSkillLevel: 30,
    craftingTime: 5, discoveryMethod: 'npc_teaching', baseFailChance: 0.1, description: 'Set a gemstone into a ring.',
  },
  {
    id: 'craft_necklace', name: 'Craft Necklace', category: 'smithing', tier: 4,
    inputs: [{ itemId: 'gold_ingot', quantity: 1 }, { itemId: 'gem_setting', quantity: 1 }, { itemId: 'cut_gemstone', quantity: 1 }],
    output: { itemId: 'necklace', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'blacksmith', requiredSkill: 'smithing', requiredSkillLevel: 25,
    craftingTime: 4, discoveryMethod: 'known', baseFailChance: 0.08, description: 'Craft an ornate necklace.',
  },
  {
    id: 'craft_crown', name: 'Forge Crown', category: 'smithing', tier: 4,
    inputs: [{ itemId: 'gold_ingot', quantity: 3 }, { itemId: 'cut_gemstone', quantity: 5 }],
    output: { itemId: 'crown', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'blacksmith', facilityLevel: 3, requiredSkill: 'smithing', requiredSkillLevel: 60,
    craftingTime: 12, discoveryMethod: 'recipe_scroll', baseFailChance: 0.15, description: 'Forge a royal crown.',
  },
]

// ── Tier 5: Magical/Special ──

export const TIER5_RECIPES: AdvancedRecipe[] = [
  {
    id: 'enchant_sword', name: 'Enchant Sword', category: 'enchanting', tier: 5,
    inputs: [{ itemId: 'iron_sword', quantity: 1 }, { itemId: 'enchanting_ink', quantity: 1 }, { itemId: 'crystal', quantity: 1 }],
    output: { itemId: 'enchanted_sword', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'enchanting_table', requiredSkill: 'alchemy', requiredSkillLevel: 40,
    craftingTime: 10, discoveryMethod: 'library_research', baseFailChance: 0.15, description: 'Imbue a sword with magic.',
  },
  {
    id: 'forge_legendary_armor', name: 'Forge Legendary Armor', category: 'smithing', tier: 5,
    inputs: [{ itemId: 'mithril_armor', quantity: 1 }, { itemId: 'dragon_scale', quantity: 3 }, { itemId: 'enchanting_ink', quantity: 5 }],
    output: { itemId: 'legendary_armor', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'ancient_forge', requiredSkill: 'smithing', requiredSkillLevel: 90,
    craftingTime: 30, discoveryMethod: 'recipe_scroll', baseFailChance: 0.25, description: 'The ultimate smithing achievement.',
  },
  {
    id: 'brew_resurrection_potion', name: 'Brew Potion of Resurrection', category: 'alchemy', tier: 5,
    inputs: [{ itemId: 'potion_base', quantity: 3 }, { itemId: 'refined_crystal', quantity: 2 }, { itemId: 'phoenix_feather', quantity: 1 }, { itemId: 'dragon_heart', quantity: 1 }, { itemId: 'glass_vial', quantity: 1 }],
    output: { itemId: 'resurrection_potion', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'alchemy_lab', facilityLevel: 5, requiredSkill: 'alchemy', requiredSkillLevel: 80,
    craftingTime: 20, discoveryMethod: 'recipe_scroll', baseFailChance: 0.3, description: 'Brings the fallen back to life.',
  },
  {
    id: 'craft_golem_heart', name: 'Craft Golem Heart', category: 'enchanting', tier: 5,
    inputs: [{ itemId: 'golem_core', quantity: 1 }, { itemId: 'refined_crystal', quantity: 5 }, { itemId: 'enchanting_ink', quantity: 3 }],
    output: { itemId: 'golem_heart', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'ancient_forge', requiredSkill: 'alchemy', requiredSkillLevel: 85,
    craftingTime: 25, discoveryMethod: 'recipe_scroll', baseFailChance: 0.3, description: 'Animate a golem servant.',
  },
  {
    id: 'enchant_armor', name: 'Enchant Armor', category: 'enchanting', tier: 5,
    inputs: [{ itemId: 'plate_armor', quantity: 1 }, { itemId: 'enchanting_ink', quantity: 3 }, { itemId: 'refined_crystal', quantity: 2 }],
    output: { itemId: 'enchanted_armor', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'enchanting_table', requiredSkill: 'alchemy', requiredSkillLevel: 50,
    craftingTime: 15, discoveryMethod: 'library_research', baseFailChance: 0.18, description: 'Magically enhance armor.',
  },
  {
    id: 'forge_dragonbone_sword', name: 'Forge Dragonbone Sword', category: 'smithing', tier: 5,
    inputs: [{ itemId: 'dragon_bone', quantity: 2 }, { itemId: 'mithril_ingot', quantity: 1 }, { itemId: 'enchanting_ink', quantity: 1 }],
    output: { itemId: 'dragonbone_sword', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'ancient_forge', requiredSkill: 'smithing', requiredSkillLevel: 75,
    craftingTime: 18, discoveryMethod: 'recipe_scroll', baseFailChance: 0.22, description: 'Legendary blade of dragonbone.',
  },
  {
    id: 'brew_elixir_of_life', name: 'Brew Elixir of Life', category: 'alchemy', tier: 5,
    inputs: [{ itemId: 'potion_base', quantity: 5 }, { itemId: 'refined_crystal', quantity: 3 }, { itemId: 'unicorn_horn', quantity: 1 }, { itemId: 'glass_vial', quantity: 1 }],
    output: { itemId: 'elixir_of_life', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'alchemy_lab', facilityLevel: 5, requiredSkill: 'alchemy', requiredSkillLevel: 90,
    craftingTime: 25, discoveryMethod: 'recipe_scroll', baseFailChance: 0.35, description: 'Grants extended lifespan.',
  },
  {
    id: 'craft_arcane_focus', name: 'Craft Arcane Focus', category: 'enchanting', tier: 5,
    inputs: [{ itemId: 'mage_staff', quantity: 1 }, { itemId: 'refined_crystal', quantity: 5 }, { itemId: 'enchanting_ink', quantity: 5 }],
    output: { itemId: 'arcane_focus', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'enchanting_table', requiredSkill: 'alchemy', requiredSkillLevel: 70,
    craftingTime: 20, discoveryMethod: 'library_research', baseFailChance: 0.25, description: 'Supreme magical channeling device.',
  },
  {
    id: 'forge_celestial_armor', name: 'Forge Celestial Armor', category: 'smithing', tier: 5,
    inputs: [{ itemId: 'mithril_ingot', quantity: 8 }, { itemId: 'stardust', quantity: 5 }, { itemId: 'enchanting_ink', quantity: 10 }],
    output: { itemId: 'celestial_armor', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'ancient_forge', requiredSkill: 'smithing', requiredSkillLevel: 95,
    craftingTime: 40, discoveryMethod: 'recipe_scroll', baseFailChance: 0.3, description: 'Armor forged from starlight.',
  },
  {
    id: 'brew_philosopher_stone', name: 'Create Philosopher\'s Stone', category: 'alchemy', tier: 5,
    inputs: [{ itemId: 'refined_crystal', quantity: 10 }, { itemId: 'gold_ingot', quantity: 5 }, { itemId: 'dragon_heart', quantity: 1 }, { itemId: 'phoenix_feather', quantity: 1 }],
    output: { itemId: 'philosopher_stone', quantity: 1, qualityAffectedBySkill: true, qualityAffectedByFacility: true },
    facility: 'alchemy_lab', facilityLevel: 5, requiredSkill: 'alchemy', requiredSkillLevel: 100,
    craftingTime: 50, discoveryMethod: 'recipe_scroll', baseFailChance: 0.4, description: 'The magnum opus of alchemy.',
  },
]

// ── Combined Export ──

export const ALL_ADVANCED_RECIPES: AdvancedRecipe[] = [
  ...TIER2_RECIPES,
  ...TIER3_RECIPES,
  ...TIER4_WEAPONS,
  ...TIER4_ARMOR,
  ...TIER4_TOOLS,
  ...TIER4_FOOD,
  ...TIER4_POTIONS,
  ...TIER4_BOOKS,
  ...TIER4_CONSTRUCTION,
  ...TIER4_BREWING,
  ...TIER4_JEWELRY,
  ...TIER5_RECIPES,
]

// ── Crop Data ──

export interface CropConfig {
  type: string
  seedId: string
  outputId: string
  growthTicks: { spring: number; summer: number; autumn: number; winter: number | null }
  yieldMin: number
  yieldMax: number
  seedReturnRate: number    // fraction of harvest that becomes seeds
}

export const CROPS: CropConfig[] = [
  { type: 'grain', seedId: 'grain_seed', outputId: 'grain', growthTicks: { spring: 50, summer: 50, autumn: 75, winter: null }, yieldMin: 3, yieldMax: 5, seedReturnRate: 0.2 },
  { type: 'potato', seedId: 'potato_seed', outputId: 'potato', growthTicks: { spring: 50, summer: 50, autumn: 75, winter: null }, yieldMin: 3, yieldMax: 6, seedReturnRate: 0.15 },
  { type: 'carrot', seedId: 'carrot_seed', outputId: 'carrot', growthTicks: { spring: 40, summer: 40, autumn: 60, winter: null }, yieldMin: 3, yieldMax: 5, seedReturnRate: 0.15 },
  { type: 'cotton', seedId: 'cotton_seed', outputId: 'cotton', growthTicks: { spring: 60, summer: 50, autumn: 80, winter: null }, yieldMin: 2, yieldMax: 4, seedReturnRate: 0.2 },
  { type: 'herb', seedId: 'herb_seed', outputId: 'herb', growthTicks: { spring: 40, summer: 35, autumn: 55, winter: null }, yieldMin: 2, yieldMax: 4, seedReturnRate: 0.25 },
  { type: 'flax', seedId: 'flax_seed', outputId: 'flax', growthTicks: { spring: 55, summer: 50, autumn: 70, winter: null }, yieldMin: 2, yieldMax: 4, seedReturnRate: 0.2 },
  { type: 'grape', seedId: 'grape_vine', outputId: 'grape', growthTicks: { spring: 80, summer: 70, autumn: 100, winter: null }, yieldMin: 4, yieldMax: 8, seedReturnRate: 0.1 },
]

export const ORCHARD_TREES = [
  { type: 'apple_tree', outputId: 'apple', maturityTicks: 200, harvestInterval: 50 },
  { type: 'grape_vine', outputId: 'grape', maturityTicks: 150, harvestInterval: 60 },
  { type: 'cherry_tree', outputId: 'cherry', maturityTicks: 200, harvestInterval: 50 },
]
