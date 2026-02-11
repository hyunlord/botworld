#!/usr/bin/env bash
# download-assets.sh — Download Kenney CC0 asset packs for Botworld
# All assets are CC0 1.0 Universal (Public Domain) — no attribution required
# We credit Kenney in CREDITS.md out of appreciation.
#
# Usage: bash scripts/download-assets.sh
# Requires: curl, unzip

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RAW_DIR="$SCRIPT_DIR/assets-raw"
TEMP_DIR="$RAW_DIR/.tmp"

# Asset pack URLs (kenney.nl direct download links)
TINY_TOWN_URL="https://kenney.nl/media/pages/assets/tiny-town/7fceb09099-1705350388/kenney_tiny-town.zip"
TINY_DUNGEON_URL="https://kenney.nl/media/pages/assets/tiny-dungeon/8c5e5b9ccc-1705350454/kenney_tiny-dungeon.zip"
ONEBIT_URL="https://kenney.nl/media/pages/assets/1-bit-pack/09efa39e81-1705350296/kenney_1-bit-pack.zip"
MICRO_ROGUE_URL="https://kenney.nl/media/pages/assets/micro-roguelike/0e90a0a9c5-1705350454/kenney_micro-roguelike.zip"

mkdir -p "$RAW_DIR" "$TEMP_DIR"

download_pack() {
  local name="$1"
  local url="$2"
  local dest_dir="$3"

  if [ -d "$dest_dir" ]; then
    echo "[skip] $name already exists at $dest_dir"
    return 0
  fi

  echo "[download] $name ..."
  local zip="$TEMP_DIR/${name}.zip"

  if ! curl -fsSL -o "$zip" "$url"; then
    echo "[error] Failed to download $name from $url"
    echo "[info]  Try downloading manually from https://kenney.nl/assets"
    return 1
  fi

  echo "[extract] $name → $dest_dir"
  unzip -qo "$zip" -d "$TEMP_DIR/$name"

  # Kenney zips have a top-level folder; move contents up
  local inner
  inner=$(find "$TEMP_DIR/$name" -mindepth 1 -maxdepth 1 -type d | head -1)
  if [ -n "$inner" ]; then
    mv "$inner" "$dest_dir"
  else
    mv "$TEMP_DIR/$name" "$dest_dir"
  fi

  rm -f "$zip"
  rm -rf "$TEMP_DIR/$name"
  echo "[done] $name"
}

echo "=== Botworld Asset Downloader ==="
echo "Downloading Kenney CC0 asset packs..."
echo ""

download_pack "tiny-town"      "$TINY_TOWN_URL"      "$RAW_DIR/tiny-town"
download_pack "tiny-dungeon"   "$TINY_DUNGEON_URL"    "$RAW_DIR/tiny-dungeon"
download_pack "1-bit-pack"     "$ONEBIT_URL"          "$RAW_DIR/1-bit-pack"
download_pack "micro-roguelike" "$MICRO_ROGUE_URL"    "$RAW_DIR/micro-roguelike"

# Clean up temp dir
rm -rf "$TEMP_DIR"

echo ""
echo "=== Asset download complete ==="
echo ""
echo "Downloaded packs:"
echo "  tiny-town/       — Town tiles, buildings, nature (16x16)"
echo "  tiny-dungeon/    — Dungeon tiles, monsters, items (16x16)"
echo "  1-bit-pack/      — Monochrome tilesheets (can be tinted)"
echo "  micro-roguelike/ — Micro RPG tiles (8x8)"
echo ""
echo "Next: run 'node scripts/generate-terrain-sheet.js' to build the spritesheet."
echo ""
echo "All assets are CC0 1.0 (Public Domain) by Kenney (kenney.nl)."
echo "See CREDITS.md for full attribution."
