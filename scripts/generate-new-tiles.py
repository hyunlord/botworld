#!/usr/bin/env python3
"""Generate new tile assets for the world generation overhaul."""

import os
import sys
from pathlib import Path
from google import genai
from google.genai import types

# Load API key
API_KEY = os.environ.get("GEMINI_API_KEY")
if not API_KEY:
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

ASSETS_DIR = Path(__file__).parent.parent / "packages" / "client" / "public" / "assets" / "tiles"

STYLE = (
    "Pixel art style, warm and charming aesthetic, cozy village simulation game. "
    "Clean, crisp edges. Transparent background (PNG with alpha). "
    "Consistent lighting from top-left. "
    "Isometric diamond-shaped tile, top-down isometric view (2:1 ratio). "
    "The tile is a 3D isometric block with visible top face and two darker side faces for depth. "
    "64 pixels wide, 40 pixels tall. Small and detailed. "
)

NEW_TILES = [
    ("tile_deep_water.png", STYLE + "Deep dark ocean water tile with dark navy blue color, subtle deep wave patterns, no land visible. Very dark blue compared to regular water."),
    ("tile_dense_forest.png", STYLE + "Very thick, ancient dense forest tile with overlapping dark green tree canopies, almost no ground visible. Much darker and thicker than regular forest. Deep dark emerald green."),
    ("tile_snow.png", STYLE + "Snow-covered tile with pristine white snow, small ice crystal sparkles, gentle blue shadows. Cool white and light blue."),
    ("tile_swamp.png", STYLE + "Murky swamp tile with dark greenish-brown muddy water, small cattails or reeds growing, mossy texture. Dark olive green and brown mix."),
]


def generate_image(prompt: str, output_path: Path) -> bool:
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash-exp-image-generation",
            contents=f"Generate a single game asset image: {prompt}",
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


def post_process(image_path: Path):
    """Resize to 128x128 and remove white background."""
    try:
        from PIL import Image
        import numpy as np

        img = Image.open(image_path).convert("RGBA")
        img = img.resize((128, 128), Image.Resampling.LANCZOS)

        data = np.array(img)
        r, g, b, a = data[:, :, 0], data[:, :, 1], data[:, :, 2], data[:, :, 3]

        # Remove white/near-white backgrounds
        white_mask = (r > 230) & (g > 230) & (b > 230)
        near_white = (r > 200) & (g > 200) & (b > 200) & ~white_mask
        data[white_mask, 3] = 0
        data[near_white, 3] = 100

        result = Image.fromarray(data)
        result.save(image_path)
        print(f"  POST: {image_path.name} resized to 128x128, bg removed")
    except ImportError:
        print(f"  WARN: PIL/numpy not available, skipping post-processing")


def main():
    print("=== Generating New Tile Assets ===\n")

    for filename, prompt in NEW_TILES:
        output_path = ASSETS_DIR / filename
        if output_path.exists():
            print(f"  SKIP: {filename} (already exists)")
            continue

        success = generate_image(prompt, output_path)
        if success:
            post_process(output_path)

    print("\n=== Done ===")


if __name__ == "__main__":
    main()
