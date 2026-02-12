#!/usr/bin/env bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ASSETS_RAW_DIR="$SCRIPT_DIR/assets-raw"
CLIENT_ASSETS_DIR="$SCRIPT_DIR/../packages/client/public/assets"

# Kenney asset pack definitions (parallel arrays for bash 3.2 compat)
PACK_NAMES=("tiny-town" "tiny-dungeon" "1-bit-pack")
PACK_URLS=(
  "https://kenney.nl/media/pages/assets/tiny-town/38d4e22f18-1696240880/kenney_tiny-town.zip"
  "https://kenney.nl/media/pages/assets/tiny-dungeon/ea559b291b-1696240854/kenney_tiny-dungeon.zip"
  "https://kenney.nl/media/pages/assets/1-bit-pack/a7ebedee4b-1696240093/kenney_1-bit-pack.zip"
)
PACK_PAGES=(
  "https://kenney.nl/assets/tiny-town"
  "https://kenney.nl/assets/tiny-dungeon"
  "https://kenney.nl/assets/1-bit-pack"
)

# Parse command line flags
FORCE=false
GENERATE_ONLY=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --force)
      FORCE=true
      shift
      ;;
    --generate-only)
      GENERATE_ONLY=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Download and manage Kenney asset packs for Botworld"
      echo ""
      echo "Options:"
      echo "  --force           Re-download and re-extract all assets"
      echo "  --generate-only   Skip download/extract, only run generation scripts"
      echo "  --help, -h        Show this help message"
      echo ""
      echo "Asset packs downloaded:"
      echo "  - Tiny Town (CC0)"
      echo "  - Tiny Dungeon (CC0)"
      echo "  - 1-Bit Pack (CC0)"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

# Colored output helpers
print_status() { echo -e "${BLUE}==>${NC} $1"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }

# Check for required tools
check_requirements() {
  print_status "Checking required tools..."
  local has_missing=false

  for tool in curl unzip node; do
    if ! command -v "$tool" &> /dev/null; then
      print_error "Missing: $tool"
      has_missing=true
    fi
  done

  if [ "$has_missing" = true ]; then
    echo ""
    echo "Install missing tools:"
    echo "  macOS:  brew install curl unzip node"
    echo "  Linux:  apt-get install curl unzip nodejs"
    exit 1
  fi

  print_success "All required tools found"
}

# Download an asset pack
download_asset() {
  local pack_name="$1"
  local url="$2"
  local page_url="$3"
  local zip_file="$ASSETS_RAW_DIR/kenney_${pack_name}.zip"

  if [ -f "$zip_file" ] && [ "$FORCE" != true ]; then
    print_warning "Asset pack '$pack_name' already downloaded, skipping"
    return 0
  fi

  print_status "Downloading $pack_name from kenney.nl..."

  if curl -L -f -o "$zip_file" "$url" 2>/dev/null; then
    print_success "Downloaded $pack_name"
    return 0
  else
    print_error "Failed to download $pack_name"
    print_warning "Download manually:"
    echo "  1. Visit: $page_url"
    echo "  2. Save as: $zip_file"
    return 1
  fi
}

# Extract an asset pack
extract_asset() {
  local pack_name="$1"
  local zip_file="$ASSETS_RAW_DIR/kenney_${pack_name}.zip"
  local extract_dir="$ASSETS_RAW_DIR/$pack_name"

  if [ -d "$extract_dir" ] && [ "$FORCE" != true ]; then
    print_warning "Asset pack '$pack_name' already extracted, skipping"
    return 0
  fi

  if [ ! -f "$zip_file" ]; then
    print_error "Zip file not found: $zip_file"
    return 1
  fi

  print_status "Extracting $pack_name..."

  if [ -d "$extract_dir" ] && [ "$FORCE" = true ]; then
    rm -rf "$extract_dir"
  fi

  if unzip -q "$zip_file" -d "$ASSETS_RAW_DIR"; then
    print_success "Extracted $pack_name"
    return 0
  else
    print_error "Failed to extract $pack_name"
    return 1
  fi
}

# Run generation scripts
run_generators() {
  print_status "Running asset generation scripts..."

  local generators=(
    "generate-terrain-sheet.js"
    "generate-building-sprites.js"
    "generate-character-sprites.js"
  )
  local has_failure=false

  for generator in "${generators[@]}"; do
    local script_path="$SCRIPT_DIR/$generator"

    if [ ! -f "$script_path" ]; then
      print_warning "Generator not found: $generator"
      continue
    fi

    print_status "Running $generator..."

    if node "$script_path"; then
      print_success "Completed $generator"
    else
      print_error "Failed: $generator"
      has_failure=true
    fi
  done

  if [ "$has_failure" = true ]; then
    return 1
  fi

  print_success "All generators completed successfully"
  return 0
}

# Verify output files
verify_outputs() {
  print_status "Verifying generated assets..."
  local has_missing=false

  # Check required files
  for file in "$CLIENT_ASSETS_DIR/tiles/terrain-sheet.png" "$CLIENT_ASSETS_DIR/tiles/terrain-tiles.json"; do
    if [ ! -f "$file" ]; then
      print_error "Missing: $file"
      has_missing=true
    fi
  done

  # Check directories with content
  for dir_info in "buildings:building" "characters:character"; do
    local dir_name="${dir_info%%:*}"
    local label="${dir_info##*:}"
    local dir_path="$CLIENT_ASSETS_DIR/$dir_name"

    if [ -d "$dir_path" ]; then
      local count
      count=$(find "$dir_path" -name "*.png" | wc -l | tr -d ' ')
      if [ "$count" -eq 0 ]; then
        print_error "No $label sprites found in $dir_path"
        has_missing=true
      else
        print_success "Found $count $label sprites"
      fi
    else
      print_error "Directory not found: $dir_path"
      has_missing=true
    fi
  done

  if [ "$has_missing" = true ]; then
    return 1
  fi

  print_success "All expected output files verified"
  return 0
}

# Main execution
main() {
  echo ""
  echo "Botworld Asset Manager"
  echo "======================"
  echo ""

  check_requirements
  mkdir -p "$ASSETS_RAW_DIR"

  if [ "$GENERATE_ONLY" = false ]; then
    print_status "Downloading Kenney asset packs..."

    local download_failed=false
    local i
    for i in "${!PACK_NAMES[@]}"; do
      if ! download_asset "${PACK_NAMES[$i]}" "${PACK_URLS[$i]}" "${PACK_PAGES[$i]}"; then
        download_failed=true
      fi
    done

    if [ "$download_failed" = true ]; then
      print_warning "Some downloads failed. Continuing with existing files..."
    fi

    print_status "Extracting asset packs..."

    local extract_failed=false
    for i in "${!PACK_NAMES[@]}"; do
      if ! extract_asset "${PACK_NAMES[$i]}"; then
        extract_failed=true
      fi
    done

    if [ "$extract_failed" = true ]; then
      print_error "Some extractions failed. Cannot continue."
      exit 1
    fi
  else
    print_status "Skipping download/extraction (--generate-only mode)"
  fi

  if ! run_generators; then
    print_error "Asset generation failed"
    exit 1
  fi

  if ! verify_outputs; then
    print_error "Output verification failed"
    exit 1
  fi

  echo ""
  print_success "Asset setup complete!"
  echo ""
  echo "Generated assets:"
  echo "  - Terrain sheet: $CLIENT_ASSETS_DIR/tiles/"
  echo "  - Building sprites: $CLIENT_ASSETS_DIR/buildings/"
  echo "  - Character sprites: $CLIENT_ASSETS_DIR/characters/"
  echo ""
}

main
