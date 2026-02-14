#!/usr/bin/env bash
set -euo pipefail

echo "[gate] repo: $(pwd)"
echo "[gate] branch: $(git rev-parse --abbrev-ref HEAD)"
echo "[gate] git status (before):"
git status --porcelain || true

# Hard requirements
test -f package.json || { echo "[gate] ERROR: package.json not found"; exit 1; }
test -f pnpm-lock.yaml || { echo "[gate] ERROR: pnpm-lock.yaml not found"; exit 1; }

# pnpm must exist and match packageManager when possible
if ! command -v pnpm >/dev/null 2>&1; then
  echo "[gate] ERROR: pnpm not found."
  echo "[gate] Install via one of:"
  echo "  - brew install pnpm"
  echo "  - npm i -g pnpm@10.29.2"
  exit 1
fi

PM_LINE="$(node -p "require('./package.json').packageManager || ''" 2>/dev/null || true)"
echo "[gate] packageManager: ${PM_LINE:-<none>}"
echo "[gate] pnpm version: $(pnpm --version)"

# Strict install (reproducible)
echo "[gate] pnpm install --frozen-lockfile"
pnpm install --frozen-lockfile

# Turbo tasks (keep minimal + stable)
# lint exists in package.json
echo "[gate] pnpm run lint"
pnpm -s run lint

# Optional: build can be slow; enable later if you want strict build gate.
# echo "[gate] pnpm run build"
# pnpm -s run build

echo "[gate] done"
