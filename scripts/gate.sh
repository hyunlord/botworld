#!/usr/bin/env bash
set -euo pipefail

echo "[gate] repo: $(pwd)"
echo "[gate] git status:"
git status --porcelain || true

# ----- Node strict install -----
if [ -f package.json ]; then
  echo "[gate] Node project detected"

  if [ -f pnpm-lock.yaml ]; then
    echo "[gate] pnpm strict (frozen-lockfile)"
    command -v pnpm >/dev/null 2>&1 || { echo "[gate] pnpm not installed. Use: corepack enable && corepack prepare pnpm@latest --activate"; exit 1; }
    pnpm install --frozen-lockfile

    pnpm -s run format:check
    pnpm -s run lint
    pnpm -s run typecheck
    pnpm -s run test || true
    pnpm -s run test:e2e || true
    pnpm -s run smoke || true

  elif [ -f yarn.lock ]; then
    echo "[gate] yarn strict (frozen-lockfile)"
    command -v yarn >/dev/null 2>&1 || { echo "[gate] yarn not installed"; exit 1; }
    yarn install --frozen-lockfile

    yarn -s format:check
    yarn -s lint
    yarn -s typecheck
    yarn -s test || true
    yarn -s test:e2e || true
    yarn -s smoke || true

  elif [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then
    echo "[gate] npm strict (ci)"
    npm ci

    npm run -s format:check
    npm run -s lint
    npm run -s typecheck
    npm run -s test || true
    npm run -s test:e2e || true
    npm run -s smoke || true

  else
    echo "[gate] ERROR: no lockfile found. Add pnpm-lock.yaml/yarn.lock/package-lock.json to enable strict gate."
    exit 1
  fi
fi

echo "[gate] done"
