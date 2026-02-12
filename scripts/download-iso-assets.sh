#!/bin/bash

# download-iso-assets.sh
# Helper script to document and guide downloading free isometric game assets
# for the Botworld project transition from top-down to isometric perspective.

set -e

# ANSI color codes
BOLD='\033[1m'
CYAN='\033[36m'
GREEN='\033[32m'
YELLOW='\033[33m'
WHITE='\033[37m'
RESET='\033[0m'

# Helper function to print section headers
print_header() {
    echo -e "${BOLD}${CYAN}═══════════════════════════════════════${RESET}"
    echo -e "${BOLD}${CYAN}$1${RESET}"
    echo -e "${BOLD}${CYAN}═══════════════════════════════════════${RESET}"
    echo
}

# Helper function to print subsections
print_section() {
    echo -e "${BOLD}${GREEN}▸ $1${RESET}"
}

# Helper function to print URLs
print_url() {
    echo -e "${WHITE}  $1${RESET}"
}

# Main content
print_header "BOTWORLD ISOMETRIC ASSET STRATEGY"

echo "This script helps you download free isometric tileset assets for the Botworld"
echo "game world. The project is transitioning from top-down to isometric perspective."
echo
echo "Asset Strategy:"
echo "  • Choose ONE base pack for primary terrain/buildings (art style foundation)"
echo "  • Layer supplementary packs for variety (decor, props, special items)"
echo "  • Combine via spritesheet generation for efficient rendering"
echo "  • All recommended assets have permissive licenses (CC0 or Free)"
echo

print_header "RECOMMENDED FREE ISOMETRIC ASSET PACKS"

print_section "Kenney Assets (CC0 - Public Domain)"
echo "Kenney.nl provides excellent, consistent pixel art with no attribution required."
print_url "Isometric Landscape: https://kenney.nl/assets/isometric-landscape"
print_url "Isometric City: https://kenney.nl/assets/isometric-city"
print_url "Isometric Blocks: https://kenney.nl/assets/isometric-blocks"
print_url "Isometric Dungeon: https://kenney.nl/assets/isometric-dungeon-tiles"
echo

print_section "Itch.io Free Packs (Various Licenses)"
print_url "Woulette RPG 64x32: https://woulette.itch.io/isometric-rpg-tileset-64x32-v1-1"
print_url "Raptor_Reece Natural RPG: https://raptor-reece.itch.io/isometric-tiles-free"
echo

print_section "OpenGameArt (CC-BY 3.0)"
print_url "Medieval Buildings 64x64: https://opengameart.org/content/isometric-64x64-medieval-building-tileset"
print_url "Outside Tileset 64x64: https://opengameart.org/content/isometric-64x64-outside-tileset"
echo

print_header "ASSET ORGANIZATION"

echo "This script creates target directories for your downloads:"
echo
print_section "Base Assets (Primary Tileset)"
echo "  ${WHITE}scripts/assets-raw/iso-premium/${RESET}"
echo "  └─ Extract your chosen base pack here"
echo "  └─ Use ONE cohesive art style (e.g., all Kenney or all OpenGameArt)"
echo
print_section "Supplementary Assets"
echo "  ${WHITE}scripts/assets-raw/iso-supplement/${RESET}"
echo "  └─ Extract additional packs for variety"
echo "  └─ Layer different art styles carefully to avoid visual jarring"
echo

# Create directories
echo "Creating asset directories..."
mkdir -p scripts/assets-raw/iso-premium
mkdir -p scripts/assets-raw/iso-supplement
echo -e "${GREEN}✓ Created scripts/assets-raw/iso-premium/${RESET}"
echo -e "${GREEN}✓ Created scripts/assets-raw/iso-supplement/${RESET}"
echo

print_header "NEXT STEPS"

echo "1. ${BOLD}Choose a base pack${RESET}"
echo "   Recommended: Kenney Isometric Landscape or Isometric City (consistent, well-organized)"
echo
echo "2. ${BOLD}Download your chosen pack${RESET}"
echo "   Save the ZIP file and extract contents to:"
echo "   ${WHITE}scripts/assets-raw/iso-premium/${RESET}"
echo
echo "3. ${BOLD}Optionally add supplementary packs${RESET}"
echo "   Download additional tilesets and extract to:"
echo "   ${WHITE}scripts/assets-raw/iso-supplement/${RESET}"
echo
echo "4. ${BOLD}Generate spritesheet${RESET}"
echo "   ${WHITE}node scripts/generate-iso-terrain-v2.js${RESET}"
echo "   This will combine your downloaded assets into an optimized spritesheet"
echo
echo "5. ${BOLD}Update rendering code${RESET}"
echo "   Modify ${WHITE}packages/client/src/game/scenes/world-scene.ts${RESET}"
echo "   to use isometric rendering instead of top-down"
echo

print_header "ART STYLE MATCHING PRINCIPLE"

echo "For best visual results:"
echo "  • ${YELLOW}Tile Size${RESET}: Stick to one size class (32x32, 64x64, etc.)"
echo "  • ${YELLOW}Style${RESET}: Mix assets from similar artistic traditions"
echo "  • ${YELLOW}Color Palette${RESET}: Combine assets with complementary color ranges"
echo "  • ${YELLOW}Perspective${RESET}: Ensure consistent isometric angle (30° typical)"
echo
echo "Example Combinations:"
echo "  ✓ Kenney Landscape + Kenney City (same author, guaranteed match)"
echo "  ✓ Kenney + Woulette (both pixel art, similar scale at 64x64)"
echo "  ⚠ Multiple OpenGameArt packs (verify resolution and angle match)"
echo "  ✗ 32x32 + 64x64 mixed (size mismatch requires scaling)"
echo

print_header "ASSET MANAGEMENT"

echo "Current directory structure:"
echo "  scripts/assets-raw/"
echo "    ├─ tiny-town/          (existing top-down assets)"
echo "    ├─ iso-premium/        (your primary isometric pack)"
echo "    └─ iso-supplement/     (additional packs for variety)"
echo

echo -e "${GREEN}Setup complete!${RESET} Follow the steps above to add your isometric assets."
echo
