#!/usr/bin/env python3
"""Generate game assets using Gemini 2.0 Flash image generation."""

import os
import sys
import base64
from pathlib import Path
from google import genai
from google.genai import types

# Load API key
API_KEY = os.environ.get("GEMINI_API_KEY")
if not API_KEY:
    # Try loading from .env file
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("GEMINI_API_KEY="):
                API_KEY = line.split("=", 1)[1].strip()
                break

if not API_KEY:
    print("ERROR: GEMINI_API_KEY not found")
    sys.exit(1)

client = genai.Client(api_key=API_KEY)

ASSETS_DIR = Path(__file__).parent.parent / "packages" / "client" / "public" / "assets"

STYLE_BASE = (
    "Pixel art style, warm and charming aesthetic, cozy village simulation game. "
    "Clean, crisp edges. Transparent background (PNG with alpha). "
    "Consistent lighting from top-left. "
)

ISO_TILE_STYLE = (
    STYLE_BASE +
    "Isometric diamond-shaped tile, top-down isometric view (2:1 ratio). "
    "The tile is a 3D isometric block with visible top face and two darker side faces for depth. "
    "64 pixels wide, 40 pixels tall. Small and detailed. "
)

AGENT_STYLE = (
    STYLE_BASE +
    "Chibi/super-deformed character with large head (40% of body height), "
    "big expressive eyes with highlights, small body, stubby limbs. "
    "Cute and charming. Front-facing view. "
    "48 pixels wide, 64 pixels tall. Transparent background. "
)

ICON_STYLE = (
    STYLE_BASE +
    "Game UI icon, clean and recognizable at small size. "
    "24x24 pixels. Transparent background. Simple but charming pixel art. "
)

# All assets to generate
ASSETS = {
    "tiles": [
        ("tile_grass.png", ISO_TILE_STYLE + "Lush green grass tile with small grass blade details and tiny wildflowers. Vibrant spring green."),
        ("tile_water.png", ISO_TILE_STYLE + "Clear blue water tile with gentle wave ripples and small white sparkle highlights. Serene blue."),
        ("tile_forest.png", ISO_TILE_STYLE + "Dense forest tile with tiny cute trees on top, dark green canopy, visible small trunks. Deep emerald green."),
        ("tile_sand.png", ISO_TILE_STYLE + "Warm sandy beach tile with grainy texture and tiny shell details. Golden warm sand color."),
        ("tile_mountain.png", ISO_TILE_STYLE + "Rocky mountain tile with grey stone peaks and a small snow cap on top. Cool grey with white peak."),
        ("tile_road.png", ISO_TILE_STYLE + "Earthy dirt road tile with subtle worn path marks and tiny pebble details. Warm brown earth tone."),
        ("tile_building.png", ISO_TILE_STYLE + "Small cozy cottage on the tile with a red/orange roof, cream walls, a tiny yellow-lit window, and a small door. Warm inviting colors."),
        ("tile_farmland.png", ISO_TILE_STYLE + "Plowed farmland tile with neat parallel furrow lines and small green crop seedlings growing in rows. Rich brown soil with green sprouts."),
    ],
    "agents": [
        ("agent_0.png", AGENT_STYLE + "Female character named Aria wearing a red dress/outfit with pink accents. Light skin, dark reddish-brown long hair. Warm and friendly expression."),
        ("agent_1.png", AGENT_STYLE + "Male character named Bolt wearing a blue jacket/outfit with light blue accents. Light skin, dark navy short hair. Energetic and confident expression."),
        ("agent_2.png", AGENT_STYLE + "Female character named Cleo wearing a golden/amber outfit with warm yellow accents. Light skin, medium brown hair in a ponytail. Clever and curious expression."),
        ("agent_3.png", AGENT_STYLE + "Male character named Drake wearing a purple robe/outfit with lavender accents. Light skin, dark purple hair. Mysterious and thoughtful expression."),
        ("agent_4.png", AGENT_STYLE + "Non-binary character named Echo wearing a teal/cyan outfit with mint green accents. Light skin, dark green short wavy hair. Calm and observant expression."),
    ],
    "resources": [
        ("resource_wood.png", ICON_STYLE + "A small cute wooden log or bundle of wood planks. Brown wood grain visible."),
        ("resource_stone.png", ICON_STYLE + "A small grey stone or rock with subtle crack lines. Cool grey."),
        ("resource_food.png", ICON_STYLE + "A cute red apple with a small green leaf on top. Bright red and green."),
        ("resource_iron.png", ICON_STYLE + "A small silver/steel ingot bar with metallic sheen. Cool silver grey."),
        ("resource_gold.png", ICON_STYLE + "A shiny golden gem or coin. Bright warm gold with sparkle."),
        ("resource_herb.png", ICON_STYLE + "A small green herb or plant sprig with leaves. Fresh bright green."),
    ],
    "actions": [
        ("action_gather.png", ICON_STYLE + "A small pickaxe tool icon. Brown wooden handle, grey metal head."),
        ("action_talk.png", ICON_STYLE + "A speech bubble icon with three dots inside. Blue bubble, white dots."),
        ("action_craft.png", ICON_STYLE + "A small hammer tool icon. Brown wooden handle, grey metal head."),
        ("action_rest.png", ICON_STYLE + "A sleep/rest icon with 'Zzz' letters or a crescent moon. Purple/blue."),
        ("action_trade.png", ICON_STYLE + "Two overlapping coins icon suggesting trade/exchange. Gold coins."),
    ],
}


def generate_image(prompt: str, output_path: Path) -> bool:
    """Generate a single image using Gemini."""
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
                print(f"  OK: {output_path.name} ({len(image_data)} bytes)")
                return True

        print(f"  WARN: No image in response for {output_path.name}")
        return False

    except Exception as e:
        print(f"  ERROR: {output_path.name} - {e}")
        return False


def main():
    print("=== Botworld Asset Generator ===\n")

    total = sum(len(items) for items in ASSETS.values())
    done = 0
    failed = 0

    for category, items in ASSETS.items():
        print(f"\n[{category.upper()}] Generating {len(items)} assets...")
        category_dir = ASSETS_DIR / category

        for filename, prompt in items:
            output_path = category_dir / filename
            if output_path.exists():
                print(f"  SKIP: {filename} (already exists)")
                done += 1
                continue

            full_prompt = f"Generate a single game asset image: {prompt}"
            success = generate_image(full_prompt, output_path)
            if success:
                done += 1
            else:
                failed += 1

    print(f"\n=== Done: {done}/{total} generated, {failed} failed ===")

    if failed > 0:
        print("Re-run the script to retry failed assets.")


if __name__ == "__main__":
    main()
