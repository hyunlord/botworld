#!/usr/bin/env bash
set -euo pipefail

echo "[gate] repo: $(pwd)"
echo "[gate] branch: $(git rev-parse --abbrev-ref HEAD)"
echo "[gate] git status:"
git status --porcelain || true

# Strict pnpm install (lockfile required)
if [ ! -f pnpm-lock.yaml ]; then
  echo "[gate] ERROR: pnpm-lock.yaml not found"
  exit 1
fi

# Ensure pnpm available (use corepack recommended)
if ! command -v pnpm >/dev/null 2>&1; then
  echo "[gate] ERROR: pnpm not found. Run:"
  echo "  corepack enable"
  echo "  corepack prepare pnpm@10.29.2 --activate"
  exit 1
fi

echo "[gate] pnpm version: $(pnpm --version)"
echo "[gate] pnpm install --frozen-lockfile"
pnpm install --frozen-lockfile

echo "[gate] turbo lint (if configured)"
pnpm -s run lint || true

echo "[gate] turbo build (optional, can be slow)"
# Uncomment if you want strict build gate locally
# pnpm -s run build

echo "[gate] done"
