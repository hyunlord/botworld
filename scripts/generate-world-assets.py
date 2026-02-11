#!/usr/bin/env python3
"""
Botworld World Asset Generator - Nano Banana Pro Pipeline
=========================================================
Generates all game assets using structured JSON specs (Nano Banana Pro format)
with Gemini image generation API.

Usage:
    python scripts/generate-world-assets.py              # Generate all missing assets
    python scripts/generate-world-assets.py --list        # List all assets to generate
    python scripts/generate-world-assets.py --category tiles  # Generate only tiles
    python scripts/generate-world-assets.py --force       # Regenerate all (overwrite)
    python scripts/generate-world-assets.py --dry-run     # Show what would be generated

Categories: tiles, buildings, resources, items, characters, ui
"""

import os
import sys
import json
import argparse
import time
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# API Setup
# ---------------------------------------------------------------------------

API_KEY = os.environ.get("GEMINI_API_KEY")
if not API_KEY:
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("GEMINI_API_KEY="):
                API_KEY = line.split("=", 1)[1].strip().strip('"').strip("'")
                break

ASSETS_DIR = Path(__file__).parent.parent / "packages" / "client" / "public" / "assets"

# ---------------------------------------------------------------------------
# Nano Banana Pro Style Specs - Common Style Prefix
# ---------------------------------------------------------------------------

COMMON_STYLE = {
    "art_style": "2D pixel art",
    "view": "isometric view",
    "genre": "fantasy RPG style",
    "palette": "warm color palette",
    "shadows": "soft shadows",
    "era": "16-bit era aesthetic",
    "background": "transparent background (PNG with alpha)",
    "type": "game asset",
    "lighting": "consistent top-left lighting",
    "edges": "clean crisp pixel edges, no anti-aliasing blur",
}

STYLE_PREFIX = (
    "2D pixel art, isometric view, fantasy RPG style, "
    "warm color palette, soft shadows, 16-bit era aesthetic, "
    "transparent background, game asset, consistent top-left lighting, "
    "clean crisp pixel edges"
)


def make_spec(
    title: str,
    description: str,
    dimensions: dict,
    category: str,
    extra_style: str = "",
) -> dict:
    """Create a Nano Banana Pro marketing_image spec for a game asset."""
    return {
        "marketing_image": {
            "meta": {
                "spec_version": "1.0.0",
                "title": title,
                "campaign": "botworld_assets",
                "brand_name": "Botworld",
                "usage_context": "game",
            },
            "subject": {
                "type": "game_asset",
                "name": title,
                "variant": category,
                "physical_properties": {
                    "width_px": dimensions["width"],
                    "height_px": dimensions["height"],
                    "format": "PNG with transparency",
                },
            },
            "environment": {
                "surface": {"material": "none", "reflection_strength": 0},
                "background": {
                    "color": "transparent",
                    "texture": "none",
                    "effect": "none",
                },
                "atmosphere": {
                    "mood": "fantasy RPG, warm and inviting",
                    "keywords": ["pixel art", "isometric", "16-bit", "fantasy"],
                },
            },
            "camera": {
                "angle": "isometric_top_down",
                "framing": "tight",
                "focal_length_mm": 50,
                "depth_of_field": "infinite",
            },
            "lighting": {
                "key_light_direction": "top_left",
                "key_light_intensity": "medium",
                "fill_light_direction": "right",
                "fill_light_intensity": "low",
                "rim_light": False,
                "color_temperature": "warm",
            },
            "style": {
                "art_direction": STYLE_PREFIX,
                "extra": extra_style,
                "description": description,
            },
            "controls": {
                "lock_subject_geometry": True,
                "lock_dimensions": True,
                "allow_background_variation": False,
            },
        }
    }


# ---------------------------------------------------------------------------
# Asset Definitions - 6 Categories
# ---------------------------------------------------------------------------

# --- 1. Terrain Tiles (isometric 48x48) ---
TILE_DIM = {"width": 48, "height": 48}
TILE_STYLE = "isometric diamond-shaped terrain tile, top-down 2:1 ratio, 3D block with visible top face and two darker side faces for depth"

TERRAIN_TILES = [
    (
        "tiles/grass_plains.png",
        make_spec(
            "Grass Plains",
            "Lush green grassland tile with small grass blade details and subtle ground texture. Vibrant spring green color.",
            TILE_DIM,
            "terrain",
            TILE_STYLE,
        ),
    ),
    (
        "tiles/grass_flowers.png",
        make_spec(
            "Grass with Flowers",
            "Green grass tile decorated with colorful small wildflowers - red, yellow, purple dots scattered naturally across the surface.",
            TILE_DIM,
            "terrain",
            TILE_STYLE,
        ),
    ),
    (
        "tiles/forest_light.png",
        make_spec(
            "Light Forest",
            "Sparse forest tile with a few small deciduous trees on green grass, dappled sunlight visible on ground. Light green canopy.",
            TILE_DIM,
            "terrain",
            TILE_STYLE,
        ),
    ),
    (
        "tiles/forest_dense.png",
        make_spec(
            "Dense Forest",
            "Thick dense forest tile with overlapping dark green tree canopies, almost no ground visible. Deep emerald green, ancient trees.",
            TILE_DIM,
            "terrain",
            TILE_STYLE,
        ),
    ),
    (
        "tiles/forest_autumn.png",
        make_spec(
            "Autumn Forest",
            "Forest tile with beautiful autumn-colored trees - orange, red, golden yellow foliage. Fallen leaves on ground.",
            TILE_DIM,
            "terrain",
            TILE_STYLE,
        ),
    ),
    (
        "tiles/mountain_low.png",
        make_spec(
            "Low Mountain",
            "Rocky low mountain/hill tile with grey-brown rocks, some grass patches, rough terrain. Not snow-capped.",
            TILE_DIM,
            "terrain",
            TILE_STYLE,
        ),
    ),
    (
        "tiles/mountain_high.png",
        make_spec(
            "High Mountain",
            "Tall snow-capped mountain peak tile. White snow on top, grey rock below, imposing and majestic.",
            TILE_DIM,
            "terrain",
            TILE_STYLE,
        ),
    ),
    (
        "tiles/mountain_rocky.png",
        make_spec(
            "Rocky Mountain",
            "Bare rocky mountain tile with exposed grey and brown stone, jagged edges, no vegetation. Raw stone texture.",
            TILE_DIM,
            "terrain",
            TILE_STYLE,
        ),
    ),
    (
        "tiles/water_shallow.png",
        make_spec(
            "Shallow Water",
            "Clear shallow water tile with light blue color, visible sandy bottom, gentle small wave ripples, white sparkle highlights.",
            TILE_DIM,
            "terrain",
            TILE_STYLE,
        ),
    ),
    (
        "tiles/water_deep.png",
        make_spec(
            "Deep Water",
            "Deep dark ocean water tile with dark navy blue color, subtle deep wave patterns. Very dark blue, no land visible.",
            TILE_DIM,
            "terrain",
            TILE_STYLE,
        ),
    ),
    (
        "tiles/water_river.png",
        make_spec(
            "River",
            "Flowing river water tile with medium blue color, visible current flow lines, small white foam details on surface.",
            TILE_DIM,
            "terrain",
            TILE_STYLE,
        ),
    ),
    (
        "tiles/desert_sand.png",
        make_spec(
            "Sand Desert",
            "Hot sandy desert tile with golden-tan sand, subtle wind-blown ripple patterns, warm dry feeling.",
            TILE_DIM,
            "terrain",
            TILE_STYLE,
        ),
    ),
    (
        "tiles/desert_oasis.png",
        make_spec(
            "Desert Oasis",
            "Desert oasis tile with a small pool of clear blue water surrounded by sand, with one or two small palm trees and green vegetation.",
            TILE_DIM,
            "terrain",
            TILE_STYLE,
        ),
    ),
    (
        "tiles/swamp.png",
        make_spec(
            "Swamp",
            "Murky swamp tile with dark greenish-brown muddy water, small cattails or reeds, mossy texture. Dark olive green and brown.",
            TILE_DIM,
            "terrain",
            TILE_STYLE,
        ),
    ),
    (
        "tiles/snow_field.png",
        make_spec(
            "Snow Field",
            "Pristine white snow-covered flat tile with ice crystal sparkles, gentle blue shadows. Cool white and light blue.",
            TILE_DIM,
            "terrain",
            TILE_STYLE,
        ),
    ),
    (
        "tiles/snow_forest.png",
        make_spec(
            "Snow Forest",
            "Snow-covered forest tile with evergreen pine trees dusted in white snow, frozen ground. Winter wonderland look.",
            TILE_DIM,
            "terrain",
            TILE_STYLE,
        ),
    ),
    (
        "tiles/farmland.png",
        make_spec(
            "Farmland",
            "Plowed farmland tile with neat parallel furrow lines in rich brown soil, small green crop seedlings growing in rows.",
            TILE_DIM,
            "terrain",
            TILE_STYLE,
        ),
    ),
    (
        "tiles/road_dirt.png",
        make_spec(
            "Dirt Road",
            "Earthy brown dirt road tile with worn path marks, small pebble details, lighter center where foot traffic goes.",
            TILE_DIM,
            "terrain",
            TILE_STYLE,
        ),
    ),
    (
        "tiles/road_stone.png",
        make_spec(
            "Stone Road",
            "Cobblestone paved road tile with grey stone blocks arranged in a pattern, mortar lines between stones, well-maintained look.",
            TILE_DIM,
            "terrain",
            TILE_STYLE,
        ),
    ),
    (
        "tiles/beach.png",
        make_spec(
            "Beach",
            "Sandy beach tile at the water's edge with golden sand, tiny seashell details, wet darker sand near water line.",
            TILE_DIM,
            "terrain",
            TILE_STYLE,
        ),
    ),
]

# --- 2. POI Buildings (isometric, larger) ---
BUILDING_DIM = {"width": 96, "height": 128}
BUILDING_STYLE = "isometric building structure, detailed architectural pixel art, slightly larger than terrain tiles, sits on ground"

POI_BUILDINGS = [
    (
        "buildings/tavern.png",
        make_spec(
            "Tavern",
            "Cozy wooden tavern building with timber frame walls, orange-brown thatched roof, a hanging wooden sign with a mug icon, warm yellow light glowing from windows, small chimney with smoke.",
            BUILDING_DIM,
            "building",
            BUILDING_STYLE,
        ),
    ),
    (
        "buildings/marketplace.png",
        make_spec(
            "Marketplace",
            "Open-air marketplace with colorful striped canvas tent/awning (red and white stripes), wooden market stalls displaying goods - barrels, crates, hanging items. Busy trading atmosphere.",
            BUILDING_DIM,
            "building",
            BUILDING_STYLE,
        ),
    ),
    (
        "buildings/blacksmith.png",
        make_spec(
            "Blacksmith",
            "Stone and wood blacksmith workshop with a glowing orange forge/furnace visible inside, an anvil outside, hanging tools, dark metal roof. Smoke rising from chimney.",
            BUILDING_DIM,
            "building",
            BUILDING_STYLE,
        ),
    ),
    (
        "buildings/library.png",
        make_spec(
            "Library",
            "Large stone library building with tall arched windows, through which bookshelves are visible. Ornate entrance with columns, slate blue roof, scholarly and grand appearance.",
            BUILDING_DIM,
            "building",
            BUILDING_STYLE,
        ),
    ),
    (
        "buildings/temple.png",
        make_spec(
            "Temple",
            "Majestic stone temple with tall spire/dome, golden ornamental details, grand stone steps leading to entrance, stained glass window, holy and serene atmosphere.",
            BUILDING_DIM,
            "building",
            BUILDING_STYLE,
        ),
    ),
    (
        "buildings/farm.png",
        make_spec(
            "Farm",
            "Rustic farm building with red barn, wooden fence enclosure, visible crop rows or hay bales nearby, a small windmill or silo. Pastoral and peaceful.",
            BUILDING_DIM,
            "building",
            BUILDING_STYLE,
        ),
    ),
    (
        "buildings/mine_entrance.png",
        make_spec(
            "Mine Entrance",
            "Dark cave mine entrance carved into rock face, supported by wooden timber beams, small rail track leading inside, mining cart, a lantern hanging at entrance.",
            BUILDING_DIM,
            "building",
            BUILDING_STYLE,
        ),
    ),
    (
        "buildings/fishing_hut.png",
        make_spec(
            "Fishing Hut",
            "Small wooden hut on stilts at water's edge, thatched roof, fishing nets hanging to dry, a small dock/pier extending out, a fishing rod leaning against the wall.",
            BUILDING_DIM,
            "building",
            BUILDING_STYLE,
        ),
    ),
    (
        "buildings/watchtower.png",
        make_spec(
            "Watchtower",
            "Tall stone watchtower/guard tower with a pointed roof, wooden observation platform at top with railing, narrow slit windows, a flag or banner at the peak.",
            BUILDING_DIM,
            "building",
            BUILDING_STYLE,
        ),
    ),
    (
        "buildings/guild_hall.png",
        make_spec(
            "Guild Hall",
            "Large impressive guild hall building with grand wooden double doors, stone foundation, timber frame upper floors, colorful guild banner/flags hanging from facade, ornate roof.",
            BUILDING_DIM,
            "building",
            BUILDING_STYLE,
        ),
    ),
    (
        "buildings/inn.png",
        make_spec(
            "Inn",
            "Two-story wooden inn building with a warm welcoming appearance, balcony on second floor, flower boxes in windows, cozy yellow-lit windows, a hanging sign with a bed icon.",
            BUILDING_DIM,
            "building",
            BUILDING_STYLE,
        ),
    ),
    (
        "buildings/fountain.png",
        make_spec(
            "Fountain",
            "Ornamental stone fountain in a small plaza/square, circular basin with water flowing, decorative statue or pillar in center, stone tiles around base.",
            BUILDING_DIM,
            "building",
            BUILDING_STYLE,
        ),
    ),
    (
        "buildings/ruins.png",
        make_spec(
            "Ruins",
            "Ancient crumbling stone ruins - broken walls, fallen pillars, overgrown with vines and moss, mysterious and abandoned atmosphere, weathered grey stone.",
            BUILDING_DIM,
            "building",
            BUILDING_STYLE,
        ),
    ),
    (
        "buildings/witch_hut.png",
        make_spec(
            "Witch Hut",
            "Crooked mysterious witch's hut deep in the forest, tilted structure on chicken legs or stilts, glowing purple/green window, hanging herbs, cauldron outside, spooky but charming.",
            BUILDING_DIM,
            "building",
            BUILDING_STYLE,
        ),
    ),
    (
        "buildings/port.png",
        make_spec(
            "Port",
            "Wooden harbor port with a long dock/pier extending over water, moored sailing ship, cargo crates and barrels on dock, rope coils, a small harbormaster's office building.",
            BUILDING_DIM,
            "building",
            BUILDING_STYLE,
        ),
    ),
]

# --- 3. Resource Objects (32x32) ---
RESOURCE_DIM = {"width": 32, "height": 32}
RESOURCE_STYLE = "small game resource object sprite, clear silhouette, recognizable at small size"

RESOURCE_OBJECTS = [
    (
        "resources/tree_oak.png",
        make_spec("Oak Tree", "Deciduous oak tree with rounded green canopy, brown trunk, full and leafy.", RESOURCE_DIM, "resource", RESOURCE_STYLE),
    ),
    (
        "resources/tree_pine.png",
        make_spec("Pine Tree", "Tall conifer/pine tree with triangular dark green shape, brown trunk, pointed top.", RESOURCE_DIM, "resource", RESOURCE_STYLE),
    ),
    (
        "resources/tree_palm.png",
        make_spec("Palm Tree", "Tropical palm tree with curved brown trunk and large green fronds/leaves at top.", RESOURCE_DIM, "resource", RESOURCE_STYLE),
    ),
    (
        "resources/rock_small.png",
        make_spec("Small Rock", "Small grey stone rock with subtle crack lines. Simple round-ish boulder.", RESOURCE_DIM, "resource", RESOURCE_STYLE),
    ),
    (
        "resources/rock_large.png",
        make_spec("Large Rock", "Larger grey-brown rock formation, more angular and imposing than small rock, with visible geological layers.", RESOURCE_DIM, "resource", RESOURCE_STYLE),
    ),
    (
        "resources/bush_berry.png",
        make_spec("Berry Bush", "Green bush with bright red/purple berries visible among the leaves. Round shrub shape.", RESOURCE_DIM, "resource", RESOURCE_STYLE),
    ),
    (
        "resources/mushroom.png",
        make_spec("Mushroom", "Cute red-capped mushroom with white spots (amanita-style), small white stem. Fantasy-looking.", RESOURCE_DIM, "resource", RESOURCE_STYLE),
    ),
    (
        "resources/herb_green.png",
        make_spec("Green Herb", "Small green herb plant with distinctive medicinal-looking leaves, fresh and vibrant green.", RESOURCE_DIM, "resource", RESOURCE_STYLE),
    ),
    (
        "resources/herb_rare.png",
        make_spec("Rare Herb", "Magical glowing rare herb with blue-purple leaves emitting a soft luminescent glow/sparkle effect. Mystical and valuable.", RESOURCE_DIM, "resource", RESOURCE_STYLE),
    ),
    (
        "resources/flower_red.png",
        make_spec("Red Flower", "Beautiful red flower with green stem and leaves, blooming petals. Simple and recognizable.", RESOURCE_DIM, "resource", RESOURCE_STYLE),
    ),
    (
        "resources/flower_blue.png",
        make_spec("Blue Flower", "Delicate blue flower with green stem and leaves, blooming petals. Cool blue color.", RESOURCE_DIM, "resource", RESOURCE_STYLE),
    ),
    (
        "resources/wheat.png",
        make_spec("Wheat", "Golden wheat stalks bundled together, ripe grain heads drooping. Harvest-ready golden color.", RESOURCE_DIM, "resource", RESOURCE_STYLE),
    ),
    (
        "resources/vegetable.png",
        make_spec("Vegetable", "Fresh garden vegetables - a few carrots and cabbages together, orange and green colors.", RESOURCE_DIM, "resource", RESOURCE_STYLE),
    ),
    (
        "resources/fish_spot.png",
        make_spec("Fish Spot", "Water surface ripple/splash effect indicating fish activity below, concentric circles on blue water, small fish shadow visible.", RESOURCE_DIM, "resource", RESOURCE_STYLE),
    ),
    (
        "resources/ore_iron.png",
        make_spec("Iron Ore", "Rock with visible iron ore veins, dark grey stone with reddish-brown metallic streaks/deposits.", RESOURCE_DIM, "resource", RESOURCE_STYLE),
    ),
    (
        "resources/ore_gold.png",
        make_spec("Gold Ore", "Rock with gleaming gold veins, grey stone with bright golden metallic streaks that sparkle.", RESOURCE_DIM, "resource", RESOURCE_STYLE),
    ),
    (
        "resources/ore_crystal.png",
        make_spec("Crystal Ore", "Rock with protruding crystal formations, translucent purple/blue crystals growing from grey stone, magical glow.", RESOURCE_DIM, "resource", RESOURCE_STYLE),
    ),
]

# --- 4. Item Icons (24x24) ---
ITEM_DIM = {"width": 24, "height": 24}
ITEM_STYLE = "game inventory icon, clean and recognizable at very small size, simple but charming pixel art, item on transparent background"

ITEM_ICONS = [
    # Weapons
    ("items/sword.png", make_spec("Sword", "Steel sword with silver blade, brown leather-wrapped handle, cross-guard. Classic RPG weapon.", ITEM_DIM, "item", ITEM_STYLE)),
    ("items/axe.png", make_spec("Battle Axe", "Iron battle axe with dark metal head, wooden handle. Heavy and powerful looking.", ITEM_DIM, "item", ITEM_STYLE)),
    ("items/bow.png", make_spec("Bow", "Wooden longbow with taut string, elegant curved shape. Brown wood with white string.", ITEM_DIM, "item", ITEM_STYLE)),
    ("items/staff.png", make_spec("Magic Staff", "Wooden magic staff with glowing crystal/orb at the top emitting blue-purple magical energy. Wizard weapon.", ITEM_DIM, "item", ITEM_STYLE)),
    ("items/dagger.png", make_spec("Dagger", "Short dagger with thin pointed blade, small cross-guard, compact handle. Quick weapon.", ITEM_DIM, "item", ITEM_STYLE)),
    # Armor
    ("items/shield.png", make_spec("Shield", "Round metal shield with an emblem/crest in center, rivets around edge. Defensive equipment.", ITEM_DIM, "item", ITEM_STYLE)),
    ("items/helmet.png", make_spec("Helmet", "Iron knight's helmet with visor, protective and sturdy looking. Grey metal.", ITEM_DIM, "item", ITEM_STYLE)),
    ("items/armor_leather.png", make_spec("Leather Armor", "Brown leather armor chest piece with stitching details, buckles. Light armor.", ITEM_DIM, "item", ITEM_STYLE)),
    ("items/armor_plate.png", make_spec("Plate Armor", "Heavy steel plate armor chest piece, polished silver metal, sturdy protection. Heavy armor.", ITEM_DIM, "item", ITEM_STYLE)),
    # Consumables
    ("items/potion_red.png", make_spec("Health Potion", "Red health potion in a round glass bottle/flask with cork stopper. Bright red glowing liquid.", ITEM_DIM, "item", ITEM_STYLE)),
    ("items/potion_blue.png", make_spec("Mana Potion", "Blue mana potion in a round glass bottle/flask with cork stopper. Bright blue glowing liquid.", ITEM_DIM, "item", ITEM_STYLE)),
    ("items/bread.png", make_spec("Bread", "Freshly baked bread loaf, golden brown crust, warm and appetizing. Simple food item.", ITEM_DIM, "item", ITEM_STYLE)),
    ("items/meat.png", make_spec("Cooked Meat", "Cooked meat on a bone (drumstick style), brown and appetizing. Hearty food.", ITEM_DIM, "item", ITEM_STYLE)),
    ("items/fish_cooked.png", make_spec("Cooked Fish", "Grilled whole fish on a plate, golden-brown cooked fish. Food item.", ITEM_DIM, "item", ITEM_STYLE)),
    # Materials
    ("items/wood.png", make_spec("Wood", "Bundle of wooden logs/planks tied together, brown wood grain visible. Crafting material.", ITEM_DIM, "item", ITEM_STYLE)),
    ("items/stone.png", make_spec("Stone", "Grey stone block or chunk, rough hewn surface. Basic building material.", ITEM_DIM, "item", ITEM_STYLE)),
    ("items/iron_ingot.png", make_spec("Iron Ingot", "Silver-grey iron ingot bar, metallic sheen, trapezoidal shape. Smelted metal.", ITEM_DIM, "item", ITEM_STYLE)),
    ("items/gold_ingot.png", make_spec("Gold Ingot", "Shiny golden ingot bar, bright warm gold with sparkle. Precious metal.", ITEM_DIM, "item", ITEM_STYLE)),
    ("items/crystal.png", make_spec("Crystal", "Translucent purple crystal gem, faceted and sparkling with magical energy.", ITEM_DIM, "item", ITEM_STYLE)),
    ("items/leather.png", make_spec("Leather", "Rolled piece of brown leather hide, tanned and ready for crafting.", ITEM_DIM, "item", ITEM_STYLE)),
    ("items/cloth.png", make_spec("Cloth", "Folded piece of white/cream cloth fabric, soft textile material.", ITEM_DIM, "item", ITEM_STYLE)),
    # Special
    ("items/gem_red.png", make_spec("Red Gem", "Brilliant cut red ruby gemstone, faceted and sparkling with deep red color.", ITEM_DIM, "item", ITEM_STYLE)),
    ("items/gem_blue.png", make_spec("Blue Gem", "Brilliant cut blue sapphire gemstone, faceted and sparkling with deep blue color.", ITEM_DIM, "item", ITEM_STYLE)),
    ("items/scroll.png", make_spec("Scroll", "Rolled parchment scroll with a red wax seal, aged paper color, arcane knowledge.", ITEM_DIM, "item", ITEM_STYLE)),
    ("items/key.png", make_spec("Key", "Ornate golden key with decorative bow/handle, classic fantasy key design.", ITEM_DIM, "item", ITEM_STYLE)),
    ("items/map.png", make_spec("Map", "Partially unrolled treasure/world map showing coastlines and an X mark, aged parchment.", ITEM_DIM, "item", ITEM_STYLE)),
]

# --- 5. Character Sprites (48x64) ---
CHAR_DIM = {"width": 48, "height": 64}
CHAR_STYLE = "chibi/super-deformed RPG character sprite, large head (40% of body), big expressive eyes, small body, front-facing view"

CHARACTER_SPRITES = [
    (
        "characters/human_base.png",
        make_spec("Human Base", "Human RPG character with fair skin, brown hair, wearing simple brown tunic and pants. Average build, friendly and approachable.", CHAR_DIM, "character", CHAR_STYLE),
    ),
    (
        "characters/elf_base.png",
        make_spec("Elf Base", "Elegant elf character with pointed ears, light skin, long silver-blonde hair, wearing green forest clothing. Slender and graceful.", CHAR_DIM, "character", CHAR_STYLE),
    ),
    (
        "characters/dwarf_base.png",
        make_spec("Dwarf Base", "Stout dwarf character with thick brown beard, ruddy complexion, wearing heavy leather and metal vest. Short and stocky build.", CHAR_DIM, "character", CHAR_STYLE),
    ),
    (
        "characters/orc_base.png",
        make_spec("Orc Base", "Green-skinned orc character with small tusks, muscular build, wearing tribal leather armor with bone accessories. Strong and fierce.", CHAR_DIM, "character", CHAR_STYLE),
    ),
    (
        "characters/beastkin_base.png",
        make_spec("Beastkin Base", "Fox-like beastkin character with orange fur, pointy ears, bushy tail, wearing simple cloth outfit. Agile and alert expression.", CHAR_DIM, "character", CHAR_STYLE),
    ),
    (
        "characters/undead_base.png",
        make_spec("Undead Base", "Pale undead/skeleton character with ghostly blue-white skin, glowing blue eyes, tattered dark robes. Eerie but not scary, RPG-cute style.", CHAR_DIM, "character", CHAR_STYLE),
    ),
    (
        "characters/fairy_base.png",
        make_spec("Fairy Base", "Tiny fairy character with translucent iridescent wings, light purple skin, wearing flower-petal clothing, sparkling aura. Magical and delicate.", CHAR_DIM, "character", CHAR_STYLE),
    ),
    (
        "characters/dragonkin_base.png",
        make_spec("Dragonkin Base", "Dragon-humanoid character with red scales, small horns, reptilian eyes, tail, wearing metal and leather armor. Powerful and noble.", CHAR_DIM, "character", CHAR_STYLE),
    ),
]

# --- 6. UI Elements ---
MINIMAP_DIM = {"width": 12, "height": 12}
EMOTION_DIM = {"width": 16, "height": 16}
ACTION_DIM = {"width": 16, "height": 16}
BUBBLE_DIM = {"width": 64, "height": 48}

MINIMAP_STYLE = "tiny minimap marker icon, extremely simple, 2-3 colors max, must be recognizable at 12x12 pixels"
EMOTION_STYLE = "small emoji-style emotion bubble icon, expressive face, simple shapes, cute"
ACTION_STYLE = "small action indicator icon, simple and clear silhouette, game HUD style"
BUBBLE_STYLE = "speech bubble UI frame element, clean rounded shape with tail/pointer"

UI_ELEMENTS = [
    # Minimap POI icons
    ("ui/minimap_icons/tavern.png", make_spec("Minimap Tavern", "Tiny mug/cup icon for tavern location marker.", MINIMAP_DIM, "ui_minimap", MINIMAP_STYLE)),
    ("ui/minimap_icons/market.png", make_spec("Minimap Market", "Tiny shopping bag/cart icon for market location.", MINIMAP_DIM, "ui_minimap", MINIMAP_STYLE)),
    ("ui/minimap_icons/blacksmith.png", make_spec("Minimap Blacksmith", "Tiny anvil/hammer icon for blacksmith location.", MINIMAP_DIM, "ui_minimap", MINIMAP_STYLE)),
    ("ui/minimap_icons/library.png", make_spec("Minimap Library", "Tiny book icon for library location.", MINIMAP_DIM, "ui_minimap", MINIMAP_STYLE)),
    ("ui/minimap_icons/temple.png", make_spec("Minimap Temple", "Tiny cross/star icon for temple location.", MINIMAP_DIM, "ui_minimap", MINIMAP_STYLE)),
    ("ui/minimap_icons/farm.png", make_spec("Minimap Farm", "Tiny wheat/plant icon for farm location.", MINIMAP_DIM, "ui_minimap", MINIMAP_STYLE)),
    ("ui/minimap_icons/mine.png", make_spec("Minimap Mine", "Tiny pickaxe icon for mine location.", MINIMAP_DIM, "ui_minimap", MINIMAP_STYLE)),
    ("ui/minimap_icons/port.png", make_spec("Minimap Port", "Tiny anchor/boat icon for port location.", MINIMAP_DIM, "ui_minimap", MINIMAP_STYLE)),
    # Emotion bubbles
    ("ui/emotion_bubbles/happy.png", make_spec("Happy Emotion", "Happy smiling face emoji with closed eyes smile. Yellow, joyful.", EMOTION_DIM, "ui_emotion", EMOTION_STYLE)),
    ("ui/emotion_bubbles/sad.png", make_spec("Sad Emotion", "Sad face emoji with downturned mouth and teardrop. Blue, melancholy.", EMOTION_DIM, "ui_emotion", EMOTION_STYLE)),
    ("ui/emotion_bubbles/angry.png", make_spec("Angry Emotion", "Angry face emoji with furrowed brows and frown. Red, frustrated.", EMOTION_DIM, "ui_emotion", EMOTION_STYLE)),
    ("ui/emotion_bubbles/surprised.png", make_spec("Surprised Emotion", "Surprised face emoji with wide open mouth and eyes. Yellow, shocked.", EMOTION_DIM, "ui_emotion", EMOTION_STYLE)),
    ("ui/emotion_bubbles/scared.png", make_spec("Scared Emotion", "Fearful face emoji with wide eyes, trembling expression. Pale/blue, frightened.", EMOTION_DIM, "ui_emotion", EMOTION_STYLE)),
    ("ui/emotion_bubbles/love.png", make_spec("Love Emotion", "Love emoji with heart eyes or hearts floating around. Pink/red, affectionate.", EMOTION_DIM, "ui_emotion", EMOTION_STYLE)),
    ("ui/emotion_bubbles/thinking.png", make_spec("Thinking Emotion", "Thinking face emoji with hand on chin, raised eyebrow. Yellow, contemplative.", EMOTION_DIM, "ui_emotion", EMOTION_STYLE)),
    ("ui/emotion_bubbles/sleepy.png", make_spec("Sleepy Emotion", "Sleepy face emoji with closed eyes and Zzz letters floating. Purple/blue, drowsy.", EMOTION_DIM, "ui_emotion", EMOTION_STYLE)),
    # Speech bubble
    ("ui/speech_bubble.png", make_spec("Speech Bubble", "White speech bubble frame with rounded corners, thin dark outline, small triangular tail/pointer at bottom. Clean UI element.", BUBBLE_DIM, "ui_bubble", BUBBLE_STYLE)),
    # Action icons
    ("ui/action_icons/gathering.png", make_spec("Gathering Action", "Small pickaxe/hand gathering icon. Resource collection activity indicator.", ACTION_DIM, "ui_action", ACTION_STYLE)),
    ("ui/action_icons/crafting.png", make_spec("Crafting Action", "Small hammer and anvil icon. Crafting/smithing activity indicator.", ACTION_DIM, "ui_action", ACTION_STYLE)),
    ("ui/action_icons/fighting.png", make_spec("Fighting Action", "Small crossed swords icon. Combat/battle activity indicator.", ACTION_DIM, "ui_action", ACTION_STYLE)),
    ("ui/action_icons/resting.png", make_spec("Resting Action", "Small crescent moon with Zzz icon. Sleeping/resting activity indicator.", ACTION_DIM, "ui_action", ACTION_STYLE)),
    ("ui/action_icons/trading.png", make_spec("Trading Action", "Small handshake or coin exchange icon. Trading activity indicator.", ACTION_DIM, "ui_action", ACTION_STYLE)),
    ("ui/action_icons/walking.png", make_spec("Walking Action", "Small footprints or walking person silhouette icon. Movement activity indicator.", ACTION_DIM, "ui_action", ACTION_STYLE)),
    ("ui/action_icons/eating.png", make_spec("Eating Action", "Small fork and knife or apple icon. Eating/consuming activity indicator.", ACTION_DIM, "ui_action", ACTION_STYLE)),
    ("ui/action_icons/exploring.png", make_spec("Exploring Action", "Small compass or magnifying glass icon. Exploration activity indicator.", ACTION_DIM, "ui_action", ACTION_STYLE)),
]

# ---------------------------------------------------------------------------
# All categories registry
# ---------------------------------------------------------------------------

ALL_CATEGORIES: dict[str, list[tuple[str, dict]]] = {
    "tiles": TERRAIN_TILES,
    "buildings": POI_BUILDINGS,
    "resources": RESOURCE_OBJECTS,
    "items": ITEM_ICONS,
    "characters": CHARACTER_SPRITES,
    "ui": UI_ELEMENTS,
}


# ---------------------------------------------------------------------------
# Image Generation
# ---------------------------------------------------------------------------


def build_prompt(spec: dict) -> str:
    """Convert a Nano Banana Pro spec into a Gemini image generation prompt."""
    img = spec["marketing_image"]
    style = img["style"]
    subject = img["subject"]
    dims = subject["physical_properties"]

    prompt_parts = [
        f"Generate a single game asset image.",
        f"Art style: {style['art_direction']}.",
        f"Type: {style['extra']}.",
        f"Subject: {img['meta']['title']}.",
        f"Description: {style['description']}.",
        f"Dimensions: {dims['width_px']}x{dims['height_px']} pixels.",
        f"Must have transparent background (PNG with alpha channel).",
        f"No text, no labels, no watermarks. Just the game asset sprite.",
    ]
    return " ".join(prompt_parts)


def generate_image(client: Any, prompt: str, output_path: Path, retries: int = 2) -> bool:
    """Generate a single image using Gemini API with retries."""
    from google.genai import types

    for attempt in range(retries + 1):
        try:
            response = client.models.generate_content(
                model="gemini-2.0-flash-exp-image-generation",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE", "TEXT"],
                ),
            )

            for part in response.candidates[0].content.parts:
                if part.inline_data is not None:
                    image_data = part.inline_data.data
                    output_path.parent.mkdir(parents=True, exist_ok=True)
                    with open(output_path, "wb") as f:
                        f.write(image_data)
                    size_kb = len(image_data) / 1024
                    print(f"    OK: {output_path.name} ({size_kb:.1f} KB)")
                    return True

            print(f"    WARN: No image data in response for {output_path.name}")
            if attempt < retries:
                print(f"    Retrying ({attempt + 1}/{retries})...")
                time.sleep(2)

        except Exception as e:
            print(f"    ERROR: {output_path.name} - {e}")
            if attempt < retries:
                print(f"    Retrying ({attempt + 1}/{retries})...")
                time.sleep(3)

    return False


def post_process(image_path: Path, target_width: int, target_height: int):
    """Resize to target dimensions and clean up background."""
    try:
        from PIL import Image
        import numpy as np

        img = Image.open(image_path).convert("RGBA")

        # Resize to target dimensions
        if img.size != (target_width, target_height):
            img = img.resize((target_width, target_height), Image.Resampling.LANCZOS)

        # Remove white/near-white backgrounds
        data = np.array(img)
        r, g, b = data[:, :, 0], data[:, :, 1], data[:, :, 2]

        white_mask = (r > 240) & (g > 240) & (b > 240)
        near_white = (r > 220) & (g > 220) & (b > 220) & ~white_mask
        data[white_mask, 3] = 0
        data[near_white, 3] = (data[near_white, 3] * 0.3).astype(np.uint8)

        result = Image.fromarray(data)
        result.save(image_path)
        print(f"    POST: Resized to {target_width}x{target_height}, bg cleaned")
    except ImportError:
        print("    WARN: PIL/numpy not available, skipping post-processing")
        print("    Install: pip install Pillow numpy")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def list_assets(categories: dict[str, list]):
    """Print all assets grouped by category."""
    total = 0
    for cat_name, assets in categories.items():
        print(f"\n{'=' * 60}")
        print(f"  {cat_name.upper()} ({len(assets)} assets)")
        print(f"{'=' * 60}")
        for filepath, spec in assets:
            img = spec["marketing_image"]
            dims = img["subject"]["physical_properties"]
            exists = (ASSETS_DIR / filepath).exists()
            status = "[EXISTS]" if exists else "[NEW]"
            print(f"  {status} {filepath:<45} {dims['width_px']}x{dims['height_px']}px")
            total += 1
    print(f"\n{'=' * 60}")
    print(f"  TOTAL: {total} assets")
    existing = sum(1 for cat in categories.values() for fp, _ in cat if (ASSETS_DIR / fp).exists())
    print(f"  Existing: {existing} | To generate: {total - existing}")
    print(f"{'=' * 60}")


def export_specs(categories: dict[str, list], output_dir: Path):
    """Export all Nano Banana Pro JSON specs to files for manual use."""
    output_dir.mkdir(parents=True, exist_ok=True)
    for cat_name, assets in categories.items():
        cat_dir = output_dir / cat_name
        cat_dir.mkdir(parents=True, exist_ok=True)
        for filepath, spec in assets:
            name = Path(filepath).stem
            spec_path = cat_dir / f"{name}.json"
            with open(spec_path, "w") as f:
                json.dump(spec, f, indent=2)
    print(f"Exported specs to {output_dir}")


def main():
    parser = argparse.ArgumentParser(
        description="Botworld World Asset Generator - Nano Banana Pro Pipeline"
    )
    parser.add_argument("--list", action="store_true", help="List all assets")
    parser.add_argument("--category", type=str, help="Generate only this category")
    parser.add_argument("--force", action="store_true", help="Regenerate all (overwrite existing)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be generated")
    parser.add_argument("--no-post", action="store_true", help="Skip post-processing (resize/bg removal)")
    parser.add_argument("--export-specs", type=str, help="Export JSON specs to directory")
    parser.add_argument("--delay", type=float, default=1.0, help="Delay between API calls (seconds)")
    args = parser.parse_args()

    # Filter categories if specified
    if args.category:
        if args.category not in ALL_CATEGORIES:
            print(f"ERROR: Unknown category '{args.category}'")
            print(f"Available: {', '.join(ALL_CATEGORIES.keys())}")
            sys.exit(1)
        categories = {args.category: ALL_CATEGORIES[args.category]}
    else:
        categories = ALL_CATEGORIES

    # List mode
    if args.list:
        list_assets(categories)
        return

    # Export specs mode
    if args.export_specs:
        export_specs(categories, Path(args.export_specs))
        return

    # Dry run mode
    if args.dry_run:
        print("=== DRY RUN - Would generate: ===\n")
        count = 0
        for cat_name, assets in categories.items():
            for filepath, spec in assets:
                output_path = ASSETS_DIR / filepath
                if output_path.exists() and not args.force:
                    continue
                print(f"  {filepath}")
                count += 1
        print(f"\nWould generate {count} assets.")
        return

    # Generation mode - need API key
    if not API_KEY:
        print("ERROR: GEMINI_API_KEY not found")
        print("Set it as environment variable or in .env file")
        sys.exit(1)

    from google import genai

    client = genai.Client(api_key=API_KEY)

    print("=" * 60)
    print("  BOTWORLD ASSET GENERATOR")
    print("  Nano Banana Pro Pipeline")
    print("=" * 60)

    total_assets = sum(len(assets) for assets in categories.values())
    generated = 0
    skipped = 0
    failed = 0
    processed = 0

    for cat_name, assets in categories.items():
        print(f"\n--- [{cat_name.upper()}] {len(assets)} assets ---\n")

        for filepath, spec in assets:
            processed += 1
            output_path = ASSETS_DIR / filepath
            progress = f"[{processed}/{total_assets}]"

            if output_path.exists() and not args.force:
                print(f"  {progress} SKIP: {filepath} (exists)")
                skipped += 1
                continue

            print(f"  {progress} Generating: {filepath}")
            prompt = build_prompt(spec)

            success = generate_image(client, prompt, output_path)
            if success:
                generated += 1

                # Post-process
                if not args.no_post:
                    dims = spec["marketing_image"]["subject"]["physical_properties"]
                    post_process(output_path, dims["width_px"], dims["height_px"])

                # Rate limiting
                time.sleep(args.delay)
            else:
                failed += 1

    # Summary
    print(f"\n{'=' * 60}")
    print(f"  GENERATION COMPLETE")
    print(f"{'=' * 60}")
    print(f"  Generated: {generated}")
    print(f"  Skipped:   {skipped}")
    print(f"  Failed:    {failed}")
    print(f"  Total:     {total_assets}")
    print(f"{'=' * 60}")

    if failed > 0:
        print(f"\n  {failed} assets failed. Re-run the script to retry.")
        print("  (Only missing assets will be generated)")


if __name__ == "__main__":
    main()
