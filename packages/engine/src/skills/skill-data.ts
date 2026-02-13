import type {
  SkillDefinition,
  SkillAbility,
  SkillCategory,
  SkillId,
  SkillCombo,
  AbilityEffect
} from '@botworld/shared'

// ============================================================================
// COMBAT SKILLS (4)
// ============================================================================

const MELEE_ABILITIES: SkillAbility[] = [
  {
    id: 'combo_attack',
    name: 'Combo Attack',
    description: 'Consecutive strikes with increased damage',
    skillId: 'melee',
    requiredLevel: 10,
    type: 'active',
    effects: [{ stat: 'attack', modifier: 50, modifierType: 'percent', duration: 1 }]
  },
  {
    id: 'aimed_strike',
    name: 'Aimed Strike',
    description: 'Target specific body part with perfect accuracy',
    skillId: 'melee',
    requiredLevel: 30,
    type: 'active',
    effects: [{ stat: 'accuracy', modifier: 100, modifierType: 'percent', duration: 1, special: 'body_part_targeting' }]
  },
  {
    id: 'counter_attack',
    name: 'Counter Attack',
    description: 'Automatically counter when defending',
    skillId: 'melee',
    requiredLevel: 50,
    type: 'passive',
    effects: [{ special: 'counter_attack', duration: 0 }]
  },
  {
    id: 'critical_mastery',
    name: 'Critical Mastery',
    description: 'Double critical hit chance',
    skillId: 'melee',
    requiredLevel: 70,
    type: 'passive',
    effects: [{ stat: 'critChance', modifier: 2, modifierType: 'percent', duration: 0, special: 'double_crit' }]
  },
  {
    id: 'legendary_swordplay',
    name: 'Legendary Swordplay',
    description: 'Double attack speed in combat',
    skillId: 'melee',
    requiredLevel: 100,
    type: 'passive',
    effects: [{ stat: 'attackSpeed', modifier: 2, modifierType: 'percent', duration: 0, special: 'double_attack_speed' }]
  }
]

const RANGED_ABILITIES: SkillAbility[] = [
  {
    id: 'aimed_shot',
    name: 'Aimed Shot',
    description: 'Carefully aimed shot with improved accuracy',
    skillId: 'ranged',
    requiredLevel: 10,
    type: 'active',
    effects: [{ stat: 'accuracy', modifier: 50, modifierType: 'percent', duration: 1 }]
  },
  {
    id: 'mobile_shot',
    name: 'Mobile Shot',
    description: 'Shoot while moving without penalty',
    skillId: 'ranged',
    requiredLevel: 30,
    type: 'passive',
    effects: [{ special: 'shoot_while_moving', duration: 0 }]
  },
  {
    id: 'piercing_shot',
    name: 'Piercing Shot',
    description: 'Arrow pierces through to hit enemies behind target',
    skillId: 'ranged',
    requiredLevel: 50,
    type: 'active',
    effects: [{ special: 'piercing', duration: 1 }]
  },
  {
    id: 'rapid_fire',
    name: 'Rapid Fire',
    description: 'Fire two shots per round',
    skillId: 'ranged',
    requiredLevel: 70,
    type: 'active',
    effects: [{ special: 'double_attack', duration: 3 }]
  },
  {
    id: 'ultimate_shot',
    name: 'Ultimate Shot',
    description: 'Guaranteed critical hit with massive damage',
    skillId: 'ranged',
    requiredLevel: 100,
    type: 'active',
    effects: [
      { stat: 'critChance', modifier: 100, modifierType: 'percent', duration: 1 },
      { stat: 'attack', modifier: 200, modifierType: 'percent', duration: 1 }
    ]
  }
]

const DEFENSE_ABILITIES: SkillAbility[] = [
  {
    id: 'shield_block',
    name: 'Shield Block',
    description: 'Raise shield to increase block chance',
    skillId: 'defense',
    requiredLevel: 10,
    type: 'active',
    effects: [{ stat: 'blockChance', modifier: 30, modifierType: 'percent', duration: 2 }]
  },
  {
    id: 'damage_reduction',
    name: 'Toughness',
    description: 'Reduce all incoming damage',
    skillId: 'defense',
    requiredLevel: 30,
    type: 'passive',
    effects: [{ stat: 'damageReduction', modifier: 20, modifierType: 'percent', duration: 0 }]
  },
  {
    id: 'taunt',
    name: 'Taunt',
    description: 'Force enemies to target you',
    skillId: 'defense',
    requiredLevel: 50,
    type: 'active',
    effects: [{ special: 'taunt', duration: 3 }]
  },
  {
    id: 'iron_wall',
    name: 'Iron Wall',
    description: 'Become invincible for one round',
    skillId: 'defense',
    requiredLevel: 70,
    type: 'active',
    effects: [{ stat: 'invincible', modifier: 1, modifierType: 'flat', duration: 1 }]
  },
  {
    id: 'immortal_shield',
    name: 'Immortal Shield',
    description: 'Survive one lethal hit at 1HP per combat',
    skillId: 'defense',
    requiredLevel: 100,
    type: 'passive',
    effects: [{ special: 'immortal_shield', duration: 0 }]
  }
]

const TACTICS_ABILITIES: SkillAbility[] = [
  {
    id: 'formation_command',
    name: 'Formation Command',
    description: 'Organize allies into combat formation',
    skillId: 'tactics',
    requiredLevel: 10,
    type: 'active',
    effects: [{ special: 'formation', duration: 10 }]
  },
  {
    id: 'ambush_setup',
    name: 'Ambush Setup',
    description: 'Increase first strike damage',
    skillId: 'tactics',
    requiredLevel: 30,
    type: 'active',
    effects: [{ stat: 'firstStrike', modifier: 50, modifierType: 'percent', duration: 1 }]
  },
  {
    id: 'rally',
    name: 'Rally',
    description: 'Boost all allies attack power',
    skillId: 'tactics',
    requiredLevel: 50,
    type: 'active',
    effects: [{ stat: 'attack', modifier: 10, modifierType: 'percent', duration: 5, special: 'aoe_allies' }]
  },
  {
    id: 'strategic_retreat',
    name: 'Strategic Retreat',
    description: 'Safe flee for entire party',
    skillId: 'tactics',
    requiredLevel: 70,
    type: 'active',
    effects: [{ special: 'safe_flee_party', duration: 1 }]
  },
  {
    id: 'grand_strategy',
    name: 'Grand Strategy',
    description: 'Reveal enemy stats before combat begins',
    skillId: 'tactics',
    requiredLevel: 100,
    type: 'active',
    effects: [{ special: 'reveal_enemy_stats', duration: 0 }]
  }
]

// ============================================================================
// CRAFTING SKILLS (6)
// ============================================================================

const SMITHING_ABILITIES: SkillAbility[] = [
  {
    id: 'basic_metalwork',
    name: 'Basic Metalwork',
    description: 'Craft iron weapons and armor',
    skillId: 'smithing',
    requiredLevel: 10,
    type: 'passive',
    effects: [{ special: 'craft_iron', duration: 0 }]
  },
  {
    id: 'advanced_metalwork',
    name: 'Advanced Metalwork',
    description: 'Craft steel weapons and armor',
    skillId: 'smithing',
    requiredLevel: 30,
    type: 'passive',
    effects: [{ special: 'craft_steel', duration: 0 }]
  },
  {
    id: 'alloy_mastery',
    name: 'Alloy Mastery',
    description: 'Create special alloys for superior items',
    skillId: 'smithing',
    requiredLevel: 50,
    type: 'passive',
    effects: [{ special: 'craft_alloys', duration: 0 }]
  },
  {
    id: 'masterwork_chance',
    name: 'Masterwork Smithing',
    description: '15% chance to create masterwork items',
    skillId: 'smithing',
    requiredLevel: 70,
    type: 'passive',
    effects: [{ stat: 'masterworkChance', modifier: 15, modifierType: 'percent', duration: 0 }]
  },
  {
    id: 'legendary_smithing',
    name: 'Legendary Smithing',
    description: '5% chance for legendary items, can use mithril',
    skillId: 'smithing',
    requiredLevel: 100,
    type: 'passive',
    effects: [
      { stat: 'legendaryChance', modifier: 5, modifierType: 'percent', duration: 0 },
      { special: 'craft_mithril', duration: 0 }
    ]
  }
]

const WOODWORKING_ABILITIES: SkillAbility[] = [
  {
    id: 'basic_carpentry',
    name: 'Basic Carpentry',
    description: 'Craft simple furniture and wooden items',
    skillId: 'woodworking',
    requiredLevel: 10,
    type: 'passive',
    effects: [{ special: 'craft_furniture', duration: 0 }]
  },
  {
    id: 'bow_crafting',
    name: 'Bow Crafting',
    description: 'Craft quality bows and arrows',
    skillId: 'woodworking',
    requiredLevel: 30,
    type: 'passive',
    effects: [{ special: 'craft_bows', duration: 0 }]
  },
  {
    id: 'ornamental_work',
    name: 'Ornamental Work',
    description: 'Create decorative items and art',
    skillId: 'woodworking',
    requiredLevel: 50,
    type: 'passive',
    effects: [{ special: 'ornamental', duration: 0 }]
  },
  {
    id: 'siege_engineering',
    name: 'Siege Engineering',
    description: 'Build siege weapons and fortifications',
    skillId: 'woodworking',
    requiredLevel: 70,
    type: 'passive',
    effects: [{ special: 'craft_siege', duration: 0 }]
  },
  {
    id: 'living_wood',
    name: 'Living Wood',
    description: 'Work with living wood for magical construction',
    skillId: 'woodworking',
    requiredLevel: 100,
    type: 'passive',
    effects: [{ special: 'living_wood', duration: 0 }]
  }
]

const ALCHEMY_ABILITIES: SkillAbility[] = [
  {
    id: 'basic_potions',
    name: 'Basic Potions',
    description: 'Brew basic healing and mana potions',
    skillId: 'alchemy',
    requiredLevel: 10,
    type: 'passive',
    effects: [{ special: 'craft_basic_potions', duration: 0 }]
  },
  {
    id: 'poison_crafting',
    name: 'Poison Crafting',
    description: 'Create deadly poisons and toxins',
    skillId: 'alchemy',
    requiredLevel: 30,
    type: 'passive',
    effects: [{ special: 'craft_poisons', duration: 0 }]
  },
  {
    id: 'transmutation',
    name: 'Transmutation',
    description: 'Convert one material into another',
    skillId: 'alchemy',
    requiredLevel: 50,
    type: 'active',
    effects: [{ special: 'transmute', duration: 0 }]
  },
  {
    id: 'elixir_of_life',
    name: 'Elixir of Life',
    description: 'Create powerful life-restoring potions',
    skillId: 'alchemy',
    requiredLevel: 70,
    type: 'passive',
    effects: [{ special: 'craft_life_elixir', duration: 0 }]
  },
  {
    id: 'philosophers_stone',
    name: "Philosopher's Stone",
    description: 'Transmute base metals into gold',
    skillId: 'alchemy',
    requiredLevel: 100,
    type: 'passive',
    effects: [{ special: 'philosophers_stone', duration: 0 }]
  }
]

const COOKING_ABILITIES: SkillAbility[] = [
  {
    id: 'basic_recipes',
    name: 'Basic Recipes',
    description: 'Cook bread, stew, and simple meals',
    skillId: 'cooking',
    requiredLevel: 10,
    type: 'passive',
    effects: [{ special: 'cook_basic', duration: 0 }]
  },
  {
    id: 'feast_cooking',
    name: 'Feast Cooking',
    description: 'Prepare group meals with stat buffs',
    skillId: 'cooking',
    requiredLevel: 30,
    type: 'passive',
    effects: [{ special: 'cook_feast', duration: 0 }]
  },
  {
    id: 'magic_cuisine',
    name: 'Magic Cuisine',
    description: 'Food that provides permanent minor stat boosts',
    skillId: 'cooking',
    requiredLevel: 50,
    type: 'passive',
    effects: [{ special: 'cook_magic', duration: 0 }]
  },
  {
    id: 'gourmet_mastery',
    name: 'Gourmet Mastery',
    description: 'Create powerful buff food',
    skillId: 'cooking',
    requiredLevel: 70,
    type: 'passive',
    effects: [{ special: 'cook_gourmet', duration: 0 }]
  },
  {
    id: 'divine_feast',
    name: 'Divine Feast',
    description: 'Godly meal granting +20% all stats for 100 ticks',
    skillId: 'cooking',
    requiredLevel: 100,
    type: 'active',
    effects: [{ stat: 'allStats', modifier: 20, modifierType: 'percent', duration: 100 }]
  }
]

const ENCHANTING_ABILITIES: SkillAbility[] = [
  {
    id: 'minor_enchant',
    name: 'Minor Enchant',
    description: 'Add minor stat enchantments to items',
    skillId: 'enchanting',
    requiredLevel: 10,
    type: 'passive',
    effects: [{ special: 'enchant_minor', duration: 0 }]
  },
  {
    id: 'elemental_enchant',
    name: 'Elemental Enchant',
    description: 'Add fire, ice, or dark element to weapons',
    skillId: 'enchanting',
    requiredLevel: 30,
    type: 'passive',
    effects: [{ special: 'enchant_elemental', duration: 0 }]
  },
  {
    id: 'compound_enchant',
    name: 'Compound Enchant',
    description: 'Apply multiple enchantments to one item',
    skillId: 'enchanting',
    requiredLevel: 50,
    type: 'passive',
    effects: [{ special: 'enchant_compound', duration: 0 }]
  },
  {
    id: 'soul_binding',
    name: 'Soul Binding',
    description: 'Bind items to owner, preventing theft',
    skillId: 'enchanting',
    requiredLevel: 70,
    type: 'passive',
    effects: [{ special: 'soul_bind', duration: 0 }]
  },
  {
    id: 'legendary_enchant',
    name: 'Legendary Enchant',
    description: 'Apply legendary-tier enchantments',
    skillId: 'enchanting',
    requiredLevel: 100,
    type: 'passive',
    effects: [{ special: 'enchant_legendary', duration: 0 }]
  }
]

const TAILORING_ABILITIES: SkillAbility[] = [
  {
    id: 'basic_sewing',
    name: 'Basic Sewing',
    description: 'Craft simple clothes and garments',
    skillId: 'tailoring',
    requiredLevel: 10,
    type: 'passive',
    effects: [{ special: 'sew_basic', duration: 0 }]
  },
  {
    id: 'armor_padding',
    name: 'Armor Padding',
    description: 'Create padded cloth armor',
    skillId: 'tailoring',
    requiredLevel: 30,
    type: 'passive',
    effects: [{ special: 'sew_armor', duration: 0 }]
  },
  {
    id: 'magic_robes',
    name: 'Magic Robes',
    description: 'Craft mana-boosting magical robes',
    skillId: 'tailoring',
    requiredLevel: 50,
    type: 'passive',
    effects: [{ special: 'sew_magic', duration: 0 }]
  },
  {
    id: 'masterwork_textiles',
    name: 'Masterwork Textiles',
    description: 'Create masterwork cloth items',
    skillId: 'tailoring',
    requiredLevel: 70,
    type: 'passive',
    effects: [{ stat: 'masterworkChance', modifier: 15, modifierType: 'percent', duration: 0 }]
  },
  {
    id: 'invisibility_cloak',
    name: 'Invisibility Cloak',
    description: 'Weave a cloak of invisibility',
    skillId: 'tailoring',
    requiredLevel: 100,
    type: 'passive',
    effects: [{ special: 'craft_invisibility', duration: 0 }]
  }
]

// ============================================================================
// MAGIC SKILLS (6)
// ============================================================================

const FIRE_ABILITIES: SkillAbility[] = [
  {
    id: 'fireball',
    name: 'Fireball',
    description: 'Launch a ball of fire at target',
    skillId: 'fire',
    requiredLevel: 10,
    type: 'active',
    effects: [{ stat: 'damage', modifier: 30, modifierType: 'flat', duration: 0, special: 'fire_damage' }]
  },
  {
    id: 'fire_wall',
    name: 'Fire Wall',
    description: 'Create a wall of flames for area denial',
    skillId: 'fire',
    requiredLevel: 30,
    type: 'active',
    effects: [{ special: 'fire_wall', duration: 5 }]
  },
  {
    id: 'meteor',
    name: 'Meteor',
    description: 'Call down a meteor for massive AoE damage',
    skillId: 'fire',
    requiredLevel: 50,
    type: 'active',
    effects: [{ stat: 'damage', modifier: 150, modifierType: 'flat', duration: 0, special: 'meteor_aoe' }]
  },
  {
    id: 'inferno',
    name: 'Inferno',
    description: 'Create a continuous zone of intense fire',
    skillId: 'fire',
    requiredLevel: 70,
    type: 'active',
    effects: [{ special: 'inferno_zone', duration: 10 }]
  },
  {
    id: 'fire_elemental',
    name: 'Fire Elemental',
    description: 'Summon a powerful fire elemental ally',
    skillId: 'fire',
    requiredLevel: 100,
    type: 'active',
    effects: [{ special: 'summon_fire_elemental', duration: 20 }]
  }
]

const ICE_ABILITIES: SkillAbility[] = [
  {
    id: 'ice_bolt',
    name: 'Ice Bolt',
    description: 'Fire an icy bolt that damages and slows',
    skillId: 'ice',
    requiredLevel: 10,
    type: 'active',
    effects: [
      { stat: 'damage', modifier: 25, modifierType: 'flat', duration: 0, special: 'ice_damage' },
      { stat: 'speed', modifier: -30, modifierType: 'percent', duration: 3 }
    ]
  },
  {
    id: 'frost_barrier',
    name: 'Frost Barrier',
    description: 'Shield that absorbs damage',
    skillId: 'ice',
    requiredLevel: 30,
    type: 'active',
    effects: [{ stat: 'shield', modifier: 50, modifierType: 'flat', duration: 5 }]
  },
  {
    id: 'blizzard',
    name: 'Blizzard',
    description: 'Freeze all enemies in area',
    skillId: 'ice',
    requiredLevel: 50,
    type: 'active',
    effects: [{ special: 'blizzard_freeze', duration: 3 }]
  },
  {
    id: 'glacial_prison',
    name: 'Glacial Prison',
    description: 'Trap target in ice, immobilizing them',
    skillId: 'ice',
    requiredLevel: 70,
    type: 'active',
    effects: [{ special: 'immobilize', duration: 5 }]
  },
  {
    id: 'absolute_zero',
    name: 'Absolute Zero',
    description: 'Instantly freeze all enemies',
    skillId: 'ice',
    requiredLevel: 100,
    type: 'active',
    effects: [{ special: 'freeze_all', duration: 2 }]
  }
]

const HEAL_ABILITIES: SkillAbility[] = [
  {
    id: 'minor_heal',
    name: 'Minor Heal',
    description: 'Restore small amount of HP',
    skillId: 'heal',
    requiredLevel: 10,
    type: 'active',
    effects: [{ stat: 'hp', modifier: 30, modifierType: 'flat', duration: 0 }]
  },
  {
    id: 'major_heal',
    name: 'Major Heal',
    description: 'Restore large amount of HP',
    skillId: 'heal',
    requiredLevel: 30,
    type: 'active',
    effects: [{ stat: 'hp', modifier: 100, modifierType: 'flat', duration: 0 }]
  },
  {
    id: 'group_heal',
    name: 'Group Heal',
    description: 'Heal all allies in range',
    skillId: 'heal',
    requiredLevel: 50,
    type: 'active',
    effects: [{ stat: 'hp', modifier: 60, modifierType: 'flat', duration: 0, special: 'aoe_allies' }]
  },
  {
    id: 'resurrection',
    name: 'Resurrection',
    description: 'Bring a dead ally back to life',
    skillId: 'heal',
    requiredLevel: 70,
    type: 'active',
    effects: [{ special: 'resurrect', duration: 0 }]
  },
  {
    id: 'divine_barrier',
    name: 'Divine Barrier',
    description: 'Grant invulnerability to all allies for 3 rounds',
    skillId: 'heal',
    requiredLevel: 100,
    type: 'active',
    effects: [{ stat: 'invincible', modifier: 1, modifierType: 'flat', duration: 3, special: 'aoe_allies' }]
  }
]

const SUMMON_ABILITIES: SkillAbility[] = [
  {
    id: 'summon_sprite',
    name: 'Summon Sprite',
    description: 'Summon a small elemental sprite',
    skillId: 'summon',
    requiredLevel: 10,
    type: 'active',
    effects: [{ special: 'summon_sprite', duration: 10 }]
  },
  {
    id: 'summon_golem',
    name: 'Summon Golem',
    description: 'Summon a stone golem defender',
    skillId: 'summon',
    requiredLevel: 30,
    type: 'active',
    effects: [{ special: 'summon_golem', duration: 15 }]
  },
  {
    id: 'summon_elemental',
    name: 'Summon Elemental',
    description: 'Summon elemental of chosen type',
    skillId: 'summon',
    requiredLevel: 50,
    type: 'active',
    effects: [{ special: 'summon_elemental', duration: 20 }]
  },
  {
    id: 'summon_greater',
    name: 'Summon Greater',
    description: 'Summon a powerful creature',
    skillId: 'summon',
    requiredLevel: 70,
    type: 'active',
    effects: [{ special: 'summon_greater', duration: 25 }]
  },
  {
    id: 'summon_dragon',
    name: 'Summon Dragon',
    description: 'Summon a temporary dragon ally',
    skillId: 'summon',
    requiredLevel: 100,
    type: 'active',
    effects: [{ special: 'summon_dragon', duration: 30 }]
  }
]

const ARCANE_ABILITIES: SkillAbility[] = [
  {
    id: 'detect_magic',
    name: 'Detect Magic',
    description: 'Sense magical items and creatures',
    skillId: 'arcane',
    requiredLevel: 10,
    type: 'active',
    effects: [{ special: 'detect_magic', duration: 10 }]
  },
  {
    id: 'telekinesis',
    name: 'Telekinesis',
    description: 'Move objects with your mind',
    skillId: 'arcane',
    requiredLevel: 30,
    type: 'active',
    effects: [{ special: 'telekinesis', duration: 5 }]
  },
  {
    id: 'teleport',
    name: 'Teleport',
    description: 'Short range teleportation',
    skillId: 'arcane',
    requiredLevel: 50,
    type: 'active',
    effects: [{ special: 'teleport', duration: 0 }]
  },
  {
    id: 'arcane_shield',
    name: 'Arcane Shield',
    description: 'Convert mana into damage absorption',
    skillId: 'arcane',
    requiredLevel: 70,
    type: 'active',
    effects: [{ special: 'mana_shield', duration: 10 }]
  },
  {
    id: 'time_stop',
    name: 'Time Stop',
    description: 'Skip one round for all enemies',
    skillId: 'arcane',
    requiredLevel: 100,
    type: 'active',
    effects: [{ special: 'time_stop', duration: 1 }]
  }
]

const DARK_ABILITIES: SkillAbility[] = [
  {
    id: 'shadow_bolt',
    name: 'Shadow Bolt',
    description: 'Fire a bolt of dark energy',
    skillId: 'dark',
    requiredLevel: 10,
    type: 'active',
    effects: [{ stat: 'damage', modifier: 28, modifierType: 'flat', duration: 0, special: 'dark_damage' }]
  },
  {
    id: 'curse',
    name: 'Curse',
    description: 'Weaken target with dark magic',
    skillId: 'dark',
    requiredLevel: 30,
    type: 'active',
    effects: [{ stat: 'allStats', modifier: -15, modifierType: 'percent', duration: 5 }]
  },
  {
    id: 'dominate_undead',
    name: 'Dominate Undead',
    description: 'Take control of undead creature',
    skillId: 'dark',
    requiredLevel: 50,
    type: 'active',
    effects: [{ special: 'dominate_undead', duration: 20 }]
  },
  {
    id: 'life_drain',
    name: 'Life Drain',
    description: 'Steal HP from target',
    skillId: 'dark',
    requiredLevel: 70,
    type: 'active',
    effects: [
      { stat: 'damage', modifier: 50, modifierType: 'flat', duration: 0 },
      { stat: 'hp', modifier: 50, modifierType: 'flat', duration: 0, special: 'lifesteal' }
    ]
  },
  {
    id: 'soul_harvest',
    name: 'Soul Harvest',
    description: 'Instantly kill weak enemies and gain power',
    skillId: 'dark',
    requiredLevel: 100,
    type: 'active',
    effects: [{ special: 'soul_harvest', duration: 0 }]
  }
]

// ============================================================================
// SOCIAL SKILLS (5)
// ============================================================================

const CHARISMA_ABILITIES: SkillAbility[] = [
  {
    id: 'persuasion',
    name: 'Persuasion',
    description: 'Increase NPC disposition by 10%',
    skillId: 'charisma',
    requiredLevel: 10,
    type: 'passive',
    effects: [{ stat: 'disposition', modifier: 10, modifierType: 'percent', duration: 0 }]
  },
  {
    id: 'haggling',
    name: 'Haggling',
    description: 'Get better prices when trading',
    skillId: 'charisma',
    requiredLevel: 30,
    type: 'passive',
    effects: [{ stat: 'tradePrices', modifier: 15, modifierType: 'percent', duration: 0 }]
  },
  {
    id: 'public_speech',
    name: 'Public Speech',
    description: 'Boost your reputation in settlement',
    skillId: 'charisma',
    requiredLevel: 50,
    type: 'active',
    effects: [{ stat: 'reputation', modifier: 20, modifierType: 'flat', duration: 0 }]
  },
  {
    id: 'inspire_loyalty',
    name: 'Inspire Loyalty',
    description: 'Gain +20 relationship with target',
    skillId: 'charisma',
    requiredLevel: 70,
    type: 'active',
    effects: [{ stat: 'relationship', modifier: 20, modifierType: 'flat', duration: 0 }]
  },
  {
    id: 'royal_presence',
    name: 'Royal Presence',
    description: 'All NPCs fear and respect you',
    skillId: 'charisma',
    requiredLevel: 100,
    type: 'passive',
    effects: [{ special: 'royal_presence', duration: 0 }]
  }
]

const DECEPTION_ABILITIES: SkillAbility[] = [
  {
    id: 'white_lies',
    name: 'White Lies',
    description: 'Increase lie success rate by 20%',
    skillId: 'deception',
    requiredLevel: 10,
    type: 'passive',
    effects: [{ stat: 'lieSuccess', modifier: 20, modifierType: 'percent', duration: 0 }]
  },
  {
    id: 'pickpocket',
    name: 'Pickpocket',
    description: 'Steal items from NPCs',
    skillId: 'deception',
    requiredLevel: 30,
    type: 'active',
    effects: [{ special: 'pickpocket', duration: 0 }]
  },
  {
    id: 'disguise',
    name: 'Disguise',
    description: 'Appear as a different person',
    skillId: 'deception',
    requiredLevel: 50,
    type: 'active',
    effects: [{ special: 'disguise', duration: 50 }]
  },
  {
    id: 'master_manipulator',
    name: 'Master Manipulator',
    description: 'Influence NPC decisions',
    skillId: 'deception',
    requiredLevel: 70,
    type: 'passive',
    effects: [{ special: 'manipulate', duration: 0 }]
  },
  {
    id: 'perfect_deception',
    name: 'Perfect Deception',
    description: 'Your lies are never detected',
    skillId: 'deception',
    requiredLevel: 100,
    type: 'passive',
    effects: [{ special: 'perfect_lies', duration: 0 }]
  }
]

const LEADERSHIP_ABILITIES: SkillAbility[] = [
  {
    id: 'inspire',
    name: 'Inspire',
    description: 'Boost ally stats by 5%',
    skillId: 'leadership',
    requiredLevel: 10,
    type: 'active',
    effects: [{ stat: 'allStats', modifier: 5, modifierType: 'percent', duration: 10, special: 'aoe_allies' }]
  },
  {
    id: 'organize',
    name: 'Organize',
    description: 'Guild management bonus',
    skillId: 'leadership',
    requiredLevel: 30,
    type: 'passive',
    effects: [{ special: 'guild_bonus', duration: 0 }]
  },
  {
    id: 'inspire_greatness',
    name: 'Inspire Greatness',
    description: 'Major buff to all allies',
    skillId: 'leadership',
    requiredLevel: 50,
    type: 'active',
    effects: [{ stat: 'allStats', modifier: 15, modifierType: 'percent', duration: 20, special: 'aoe_allies' }]
  },
  {
    id: 'found_guild',
    name: 'Found Guild',
    description: 'Establish a guild with bonuses',
    skillId: 'leadership',
    requiredLevel: 70,
    type: 'active',
    effects: [{ special: 'found_guild', duration: 0 }]
  },
  {
    id: 'found_kingdom',
    name: 'Found Kingdom',
    description: 'Establish your own kingdom',
    skillId: 'leadership',
    requiredLevel: 100,
    type: 'active',
    effects: [{ special: 'found_kingdom', duration: 0 }]
  }
]

const TRADING_ABILITIES: SkillAbility[] = [
  {
    id: 'price_knowledge',
    name: 'Price Knowledge',
    description: 'See true value of all items',
    skillId: 'trading',
    requiredLevel: 10,
    type: 'passive',
    effects: [{ special: 'see_values', duration: 0 }]
  },
  {
    id: 'bulk_deals',
    name: 'Bulk Deals',
    description: 'Get volume discounts',
    skillId: 'trading',
    requiredLevel: 30,
    type: 'passive',
    effects: [{ stat: 'bulkDiscount', modifier: 10, modifierType: 'percent', duration: 0 }]
  },
  {
    id: 'monopoly',
    name: 'Monopoly',
    description: 'Dominate an item market',
    skillId: 'trading',
    requiredLevel: 50,
    type: 'active',
    effects: [{ special: 'market_monopoly', duration: 0 }]
  },
  {
    id: 'trade_network',
    name: 'Trade Network',
    description: 'Enable cross-settlement trading',
    skillId: 'trading',
    requiredLevel: 70,
    type: 'passive',
    effects: [{ special: 'trade_network', duration: 0 }]
  },
  {
    id: 'trade_empire',
    name: 'Trade Empire',
    description: 'Massive passive gold generation',
    skillId: 'trading',
    requiredLevel: 100,
    type: 'passive',
    effects: [{ stat: 'goldGeneration', modifier: 100, modifierType: 'flat', duration: 0 }]
  }
]

const LORE_ABILITIES: SkillAbility[] = [
  {
    id: 'basic_knowledge',
    name: 'Basic Knowledge',
    description: 'Identify all items',
    skillId: 'lore',
    requiredLevel: 10,
    type: 'passive',
    effects: [{ special: 'identify_items', duration: 0 }]
  },
  {
    id: 'history_expert',
    name: 'History Expert',
    description: 'Discover hidden secrets',
    skillId: 'lore',
    requiredLevel: 30,
    type: 'passive',
    effects: [{ special: 'discover_secrets', duration: 0 }]
  },
  {
    id: 'ancient_languages',
    name: 'Ancient Languages',
    description: 'Read and decode ancient texts',
    skillId: 'lore',
    requiredLevel: 50,
    type: 'passive',
    effects: [{ special: 'read_ancient', duration: 0 }]
  },
  {
    id: 'forbidden_knowledge',
    name: 'Forbidden Knowledge',
    description: 'Access dark and forbidden lore',
    skillId: 'lore',
    requiredLevel: 70,
    type: 'passive',
    effects: [{ special: 'forbidden_lore', duration: 0 }]
  },
  {
    id: 'prophecy',
    name: 'Prophecy',
    description: 'Predict future events',
    skillId: 'lore',
    requiredLevel: 100,
    type: 'active',
    effects: [{ special: 'prophecy', duration: 0 }]
  }
]

// ============================================================================
// SURVIVAL SKILLS (5)
// ============================================================================

const GATHERING_ABILITIES: SkillAbility[] = [
  {
    id: 'efficient_harvest',
    name: 'Efficient Harvest',
    description: 'Increase resource yield by 20%',
    skillId: 'gathering',
    requiredLevel: 10,
    type: 'passive',
    effects: [{ stat: 'gatherYield', modifier: 20, modifierType: 'percent', duration: 0 }]
  },
  {
    id: 'rare_finds',
    name: 'Rare Finds',
    description: 'Chance to discover rare resources',
    skillId: 'gathering',
    requiredLevel: 30,
    type: 'passive',
    effects: [{ special: 'rare_resources', duration: 0 }]
  },
  {
    id: 'ore_sense',
    name: 'Ore Sense',
    description: 'Detect ore veins underground',
    skillId: 'gathering',
    requiredLevel: 50,
    type: 'active',
    effects: [{ special: 'detect_ore', duration: 20 }]
  },
  {
    id: 'master_gatherer',
    name: 'Master Gatherer',
    description: 'Increase yield by 50%',
    skillId: 'gathering',
    requiredLevel: 70,
    type: 'passive',
    effects: [{ stat: 'gatherYield', modifier: 50, modifierType: 'percent', duration: 0 }]
  },
  {
    id: 'gather_anything',
    name: 'Gather Anything',
    description: 'Harvest any resource type',
    skillId: 'gathering',
    requiredLevel: 100,
    type: 'passive',
    effects: [{ special: 'gather_all', duration: 0 }]
  }
]

const HUNTING_ABILITIES: SkillAbility[] = [
  {
    id: 'tracking',
    name: 'Tracking',
    description: 'See creature trails and tracks',
    skillId: 'hunting',
    requiredLevel: 10,
    type: 'passive',
    effects: [{ special: 'track_creatures', duration: 0 }]
  },
  {
    id: 'trap_setting',
    name: 'Trap Setting',
    description: 'Place traps to capture creatures',
    skillId: 'hunting',
    requiredLevel: 30,
    type: 'active',
    effects: [{ special: 'set_trap', duration: 0 }]
  },
  {
    id: 'animal_taming',
    name: 'Animal Taming',
    description: 'Tame animals as companions',
    skillId: 'hunting',
    requiredLevel: 50,
    type: 'active',
    effects: [{ special: 'tame_animal', duration: 0 }]
  },
  {
    id: 'beast_master',
    name: 'Beast Master',
    description: 'Command multiple animal companions',
    skillId: 'hunting',
    requiredLevel: 70,
    type: 'passive',
    effects: [{ special: 'multi_companions', duration: 0 }]
  },
  {
    id: 'dragon_rider',
    name: 'Dragon Rider',
    description: 'Tame and ride dragons',
    skillId: 'hunting',
    requiredLevel: 100,
    type: 'active',
    effects: [{ special: 'tame_dragon', duration: 0 }]
  }
]

const STEALTH_ABILITIES: SkillAbility[] = [
  {
    id: 'sneak',
    name: 'Sneak',
    description: 'Move with reduced detection',
    skillId: 'stealth',
    requiredLevel: 10,
    type: 'active',
    effects: [{ stat: 'detection', modifier: -30, modifierType: 'percent', duration: 10 }]
  },
  {
    id: 'lockpick',
    name: 'Lockpick',
    description: 'Open locked chests and doors',
    skillId: 'stealth',
    requiredLevel: 30,
    type: 'active',
    effects: [{ special: 'lockpick', duration: 0 }]
  },
  {
    id: 'shadow_walk',
    name: 'Shadow Walk',
    description: 'Become invisible at night',
    skillId: 'stealth',
    requiredLevel: 50,
    type: 'active',
    effects: [{ special: 'night_invisibility', duration: 20 }]
  },
  {
    id: 'vanish',
    name: 'Vanish',
    description: 'Enter stealth instantly in combat',
    skillId: 'stealth',
    requiredLevel: 70,
    type: 'active',
    effects: [{ special: 'combat_stealth', duration: 3 }]
  },
  {
    id: 'ghost',
    name: 'Ghost',
    description: 'Permanent reduced detection',
    skillId: 'stealth',
    requiredLevel: 100,
    type: 'passive',
    effects: [{ stat: 'detection', modifier: -50, modifierType: 'percent', duration: 0 }]
  }
]

const NAVIGATION_ABILITIES: SkillAbility[] = [
  {
    id: 'pathfinding',
    name: 'Pathfinding',
    description: 'Move faster on world map',
    skillId: 'navigation',
    requiredLevel: 10,
    type: 'passive',
    effects: [{ stat: 'travelSpeed', modifier: 20, modifierType: 'percent', duration: 0 }]
  },
  {
    id: 'trap_detection',
    name: 'Trap Detection',
    description: 'Automatically detect traps',
    skillId: 'navigation',
    requiredLevel: 30,
    type: 'passive',
    effects: [{ special: 'detect_traps', duration: 0 }]
  },
  {
    id: 'secret_passages',
    name: 'Secret Passages',
    description: 'Find hidden areas and shortcuts',
    skillId: 'navigation',
    requiredLevel: 50,
    type: 'active',
    effects: [{ special: 'find_secrets', duration: 0 }]
  },
  {
    id: 'cartography',
    name: 'Cartography',
    description: 'Reveal larger map chunks',
    skillId: 'navigation',
    requiredLevel: 70,
    type: 'passive',
    effects: [{ special: 'reveal_map', duration: 0 }]
  },
  {
    id: 'dimensional_travel',
    name: 'Dimensional Travel',
    description: 'Teleport to any known location',
    skillId: 'navigation',
    requiredLevel: 100,
    type: 'active',
    effects: [{ special: 'teleport_anywhere', duration: 0 }]
  }
]

const FARMING_ABILITIES: SkillAbility[] = [
  {
    id: 'green_thumb',
    name: 'Green Thumb',
    description: 'Increase crop yield by 20%',
    skillId: 'farming',
    requiredLevel: 10,
    type: 'passive',
    effects: [{ stat: 'cropYield', modifier: 20, modifierType: 'percent', duration: 0 }]
  },
  {
    id: 'crop_rotation',
    name: 'Crop Rotation',
    description: 'Crops regrow faster',
    skillId: 'farming',
    requiredLevel: 30,
    type: 'passive',
    effects: [{ stat: 'cropGrowth', modifier: 30, modifierType: 'percent', duration: 0 }]
  },
  {
    id: 'magic_crops',
    name: 'Magic Crops',
    description: 'Grow magical plants',
    skillId: 'farming',
    requiredLevel: 50,
    type: 'passive',
    effects: [{ special: 'grow_magic', duration: 0 }]
  },
  {
    id: 'animal_husbandry',
    name: 'Animal Husbandry',
    description: 'Better livestock production',
    skillId: 'farming',
    requiredLevel: 70,
    type: 'passive',
    effects: [{ special: 'livestock_bonus', duration: 0 }]
  },
  {
    id: 'tree_of_life',
    name: 'Tree of Life',
    description: 'Grow a legendary life-giving tree',
    skillId: 'farming',
    requiredLevel: 100,
    type: 'active',
    effects: [{ special: 'grow_tree_of_life', duration: 0 }]
  }
]

// ============================================================================
// SKILL DEFINITIONS
// ============================================================================

export const SKILL_DEFINITIONS: Record<SkillId, SkillDefinition> = {
  // Combat
  melee: {
    id: 'melee',
    name: 'Melee Combat',
    category: 'combat',
    description: 'Master of close-quarters combat with blades and blunt weapons',
    abilities: MELEE_ABILITIES,
    xpPerAction: [10, 30]
  },
  ranged: {
    id: 'ranged',
    name: 'Ranged Combat',
    category: 'combat',
    description: 'Expert in bows, crossbows, and thrown weapons',
    abilities: RANGED_ABILITIES,
    xpPerAction: [10, 30]
  },
  defense: {
    id: 'defense',
    name: 'Defense',
    category: 'combat',
    description: 'Shield mastery and defensive tactics',
    abilities: DEFENSE_ABILITIES,
    xpPerAction: [8, 25]
  },
  tactics: {
    id: 'tactics',
    name: 'Tactics',
    category: 'combat',
    description: 'Strategic combat planning and leadership',
    abilities: TACTICS_ABILITIES,
    xpPerAction: [5, 20]
  },

  // Crafting
  smithing: {
    id: 'smithing',
    name: 'Smithing',
    category: 'crafting',
    description: 'Forge weapons and armor from metal',
    abilities: SMITHING_ABILITIES,
    xpPerAction: [15, 40]
  },
  woodworking: {
    id: 'woodworking',
    name: 'Woodworking',
    category: 'crafting',
    description: 'Craft items from wood and construct buildings',
    abilities: WOODWORKING_ABILITIES,
    xpPerAction: [10, 30]
  },
  alchemy: {
    id: 'alchemy',
    name: 'Alchemy',
    category: 'crafting',
    description: 'Brew potions and transmute materials',
    abilities: ALCHEMY_ABILITIES,
    xpPerAction: [15, 40]
  },
  cooking: {
    id: 'cooking',
    name: 'Cooking',
    category: 'crafting',
    description: 'Prepare food and magical cuisine',
    abilities: COOKING_ABILITIES,
    xpPerAction: [8, 25]
  },
  enchanting: {
    id: 'enchanting',
    name: 'Enchanting',
    category: 'crafting',
    description: 'Imbue items with magical properties',
    abilities: ENCHANTING_ABILITIES,
    xpPerAction: [20, 50]
  },
  tailoring: {
    id: 'tailoring',
    name: 'Tailoring',
    category: 'crafting',
    description: 'Sew clothes and cloth armor',
    abilities: TAILORING_ABILITIES,
    xpPerAction: [10, 30]
  },

  // Magic
  fire: {
    id: 'fire',
    name: 'Fire Magic',
    category: 'magic',
    description: 'Command flames and destructive heat',
    abilities: FIRE_ABILITIES,
    xpPerAction: [10, 35]
  },
  ice: {
    id: 'ice',
    name: 'Ice Magic',
    category: 'magic',
    description: 'Control frost and freezing cold',
    abilities: ICE_ABILITIES,
    xpPerAction: [10, 35]
  },
  heal: {
    id: 'heal',
    name: 'Healing Magic',
    category: 'magic',
    description: 'Restore life and cure ailments',
    abilities: HEAL_ABILITIES,
    xpPerAction: [10, 35]
  },
  summon: {
    id: 'summon',
    name: 'Summoning',
    category: 'magic',
    description: 'Call forth creatures to aid you',
    abilities: SUMMON_ABILITIES,
    xpPerAction: [12, 40]
  },
  arcane: {
    id: 'arcane',
    name: 'Arcane Magic',
    category: 'magic',
    description: 'Manipulate pure magical energy',
    abilities: ARCANE_ABILITIES,
    xpPerAction: [10, 35]
  },
  dark: {
    id: 'dark',
    name: 'Dark Magic',
    category: 'magic',
    description: 'Wield shadow and necromantic power',
    abilities: DARK_ABILITIES,
    xpPerAction: [10, 35]
  },

  // Social
  charisma: {
    id: 'charisma',
    name: 'Charisma',
    category: 'social',
    description: 'Win others with charm and presence',
    abilities: CHARISMA_ABILITIES,
    xpPerAction: [5, 20]
  },
  deception: {
    id: 'deception',
    name: 'Deception',
    category: 'social',
    description: 'Lie, steal, and manipulate',
    abilities: DECEPTION_ABILITIES,
    xpPerAction: [5, 20]
  },
  leadership: {
    id: 'leadership',
    name: 'Leadership',
    category: 'social',
    description: 'Inspire and command others',
    abilities: LEADERSHIP_ABILITIES,
    xpPerAction: [5, 15]
  },
  trading: {
    id: 'trading',
    name: 'Trading',
    category: 'social',
    description: 'Master the art of commerce',
    abilities: TRADING_ABILITIES,
    xpPerAction: [5, 20]
  },
  lore: {
    id: 'lore',
    name: 'Lore',
    category: 'social',
    description: 'Study history and arcane knowledge',
    abilities: LORE_ABILITIES,
    xpPerAction: [5, 20]
  },

  // Survival
  gathering: {
    id: 'gathering',
    name: 'Gathering',
    category: 'survival',
    description: 'Harvest natural resources efficiently',
    abilities: GATHERING_ABILITIES,
    xpPerAction: [5, 15]
  },
  hunting: {
    id: 'hunting',
    name: 'Hunting',
    category: 'survival',
    description: 'Track and tame creatures',
    abilities: HUNTING_ABILITIES,
    xpPerAction: [8, 25]
  },
  stealth: {
    id: 'stealth',
    name: 'Stealth',
    category: 'survival',
    description: 'Move unseen and pick locks',
    abilities: STEALTH_ABILITIES,
    xpPerAction: [8, 25]
  },
  navigation: {
    id: 'navigation',
    name: 'Navigation',
    category: 'survival',
    description: 'Find your way and discover secrets',
    abilities: NAVIGATION_ABILITIES,
    xpPerAction: [5, 20]
  },
  farming: {
    id: 'farming',
    name: 'Farming',
    category: 'survival',
    description: 'Cultivate crops and raise livestock',
    abilities: FARMING_ABILITIES,
    xpPerAction: [5, 15]
  }
}

// ============================================================================
// SKILL COMBOS
// ============================================================================

export const SKILL_COMBOS: SkillCombo[] = [
  {
    id: 'flame_forge',
    name: 'Flame Forge',
    description: 'Craft weapons infused with fire element',
    skill1: 'smithing',
    skill1MinLevel: 50,
    skill2: 'fire',
    skill2MinLevel: 30,
    ability: {
      id: 'flame_forge_ability',
      name: 'Flame Forge',
      description: 'Crafted weapons deal fire damage',
      skillId: 'smithing',
      requiredLevel: 50,
      type: 'passive',
      effects: [{ special: 'craft_fire_weapons', duration: 0 }]
    }
  },
  {
    id: 'poison_synthesis',
    name: 'Poison Synthesis',
    description: 'Create deadly poisons using dark magic',
    skill1: 'alchemy',
    skill1MinLevel: 50,
    skill2: 'dark',
    skill2MinLevel: 30,
    ability: {
      id: 'poison_synthesis_ability',
      name: 'Poison Synthesis',
      description: 'Craft extremely potent poisons',
      skillId: 'alchemy',
      requiredLevel: 50,
      type: 'passive',
      effects: [{ special: 'craft_deadly_poisons', duration: 0 }]
    }
  },
  {
    id: 'assassination',
    name: 'Assassination',
    description: 'Deal triple damage from stealth',
    skill1: 'melee',
    skill1MinLevel: 50,
    skill2: 'stealth',
    skill2MinLevel: 30,
    ability: {
      id: 'assassination_ability',
      name: 'Assassination',
      description: 'Triple damage on stealth attacks',
      skillId: 'melee',
      requiredLevel: 50,
      type: 'passive',
      effects: [{ stat: 'stealthDamage', modifier: 3, modifierType: 'percent', duration: 0 }]
    }
  },
  {
    id: 'healing_cuisine',
    name: 'Healing Cuisine',
    description: 'Cook food that restores HP over time',
    skill1: 'heal',
    skill1MinLevel: 50,
    skill2: 'cooking',
    skill2MinLevel: 30,
    ability: {
      id: 'healing_cuisine_ability',
      name: 'Healing Cuisine',
      description: 'Food restores HP gradually',
      skillId: 'cooking',
      requiredLevel: 30,
      type: 'passive',
      effects: [{ special: 'cook_healing_food', duration: 0 }]
    }
  },
  {
    id: 'arcane_decryption',
    name: 'Arcane Decryption',
    description: 'Automatically solve ruin puzzles',
    skill1: 'lore',
    skill1MinLevel: 50,
    skill2: 'arcane',
    skill2MinLevel: 30,
    ability: {
      id: 'arcane_decryption_ability',
      name: 'Arcane Decryption',
      description: 'Bypass ruin puzzle mechanics',
      skillId: 'lore',
      requiredLevel: 50,
      type: 'passive',
      effects: [{ special: 'auto_solve_puzzles', duration: 0 }]
    }
  },
  {
    id: 'battle_mage',
    name: 'Battle Mage',
    description: 'Melee attacks deal fire damage',
    skill1: 'melee',
    skill1MinLevel: 30,
    skill2: 'fire',
    skill2MinLevel: 30,
    ability: {
      id: 'battle_mage_ability',
      name: 'Battle Mage',
      description: 'Infuse melee strikes with flames',
      skillId: 'melee',
      requiredLevel: 30,
      type: 'passive',
      effects: [{ special: 'melee_fire_damage', duration: 0 }]
    }
  },
  {
    id: 'frost_armor',
    name: 'Frost Armor',
    description: 'Reflect ice damage when hit',
    skill1: 'defense',
    skill1MinLevel: 30,
    skill2: 'ice',
    skill2MinLevel: 30,
    ability: {
      id: 'frost_armor_ability',
      name: 'Frost Armor',
      description: 'Attackers take ice damage',
      skillId: 'defense',
      requiredLevel: 30,
      type: 'passive',
      effects: [{ special: 'reflect_ice', duration: 0 }]
    }
  },
  {
    id: 'shadow_trade',
    name: 'Shadow Trade',
    description: 'Use trickery for massive trade discounts',
    skill1: 'trading',
    skill1MinLevel: 30,
    skill2: 'deception',
    skill2MinLevel: 30,
    ability: {
      id: 'shadow_trade_ability',
      name: 'Shadow Trade',
      description: 'Get unfair trade advantages',
      skillId: 'trading',
      requiredLevel: 30,
      type: 'passive',
      effects: [{ stat: 'tradePrices', modifier: 40, modifierType: 'percent', duration: 0 }]
    }
  },
  {
    id: 'nature_bond',
    name: 'Nature Bond',
    description: 'Crops grow twice as fast',
    skill1: 'farming',
    skill1MinLevel: 50,
    skill2: 'heal',
    skill2MinLevel: 30,
    ability: {
      id: 'nature_bond_ability',
      name: 'Nature Bond',
      description: 'Accelerate crop growth with magic',
      skillId: 'farming',
      requiredLevel: 50,
      type: 'passive',
      effects: [{ stat: 'cropGrowth', modifier: 2, modifierType: 'percent', duration: 0 }]
    }
  },
  {
    id: 'siege_master',
    name: 'Siege Master',
    description: 'Siege weapons deal double damage',
    skill1: 'tactics',
    skill1MinLevel: 50,
    skill2: 'woodworking',
    skill2MinLevel: 30,
    ability: {
      id: 'siege_master_ability',
      name: 'Siege Master',
      description: 'Superior siege weapon construction',
      skillId: 'tactics',
      requiredLevel: 50,
      type: 'passive',
      effects: [{ stat: 'siegeDamage', modifier: 2, modifierType: 'percent', duration: 0 }]
    }
  },
  {
    id: 'holy_warrior',
    name: 'Holy Warrior',
    description: 'Heal yourself when blocking',
    skill1: 'defense',
    skill1MinLevel: 50,
    skill2: 'heal',
    skill2MinLevel: 30,
    ability: {
      id: 'holy_warrior_ability',
      name: 'Holy Warrior',
      description: 'Blocking restores HP',
      skillId: 'defense',
      requiredLevel: 50,
      type: 'passive',
      effects: [{ special: 'block_heal', duration: 0 }]
    }
  },
  {
    id: 'arcane_smith',
    name: 'Arcane Smith',
    description: 'Crafted items come pre-enchanted',
    skill1: 'smithing',
    skill1MinLevel: 30,
    skill2: 'enchanting',
    skill2MinLevel: 30,
    ability: {
      id: 'arcane_smith_ability',
      name: 'Arcane Smith',
      description: 'Auto-enchant crafted items',
      skillId: 'smithing',
      requiredLevel: 30,
      type: 'passive',
      effects: [{ special: 'auto_enchant_craft', duration: 0 }]
    }
  }
]

// ============================================================================
// CATEGORY HELPERS
// ============================================================================

export const SKILL_CATEGORIES: Record<SkillCategory, SkillId[]> = {
  combat: ['melee', 'ranged', 'defense', 'tactics'],
  crafting: ['smithing', 'woodworking', 'alchemy', 'cooking', 'enchanting', 'tailoring'],
  magic: ['fire', 'ice', 'heal', 'summon', 'arcane', 'dark'],
  social: ['charisma', 'deception', 'leadership', 'trading', 'lore'],
  survival: ['gathering', 'hunting', 'stealth', 'navigation', 'farming']
}
