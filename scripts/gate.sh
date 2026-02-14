#!/usr/bin/env bash
set -euo pipefail

echo "[gate] repo: $(pwd)"
echo "[gate] git status:"
git status --porcelain || true

if [ -f package.json ]; then
  echo "[gate] Node project detected"

  if [ -f pnpm-lock.yaml ]; then
    echo "[gate] using pnpm (pnpm-lock.yaml)"
    command -v pnpm >/dev/null 2>&1 || { echo "[gate] pnpm not installed"; exit 1; }
    pnpm install --frozen-lockfile

    pnpm -s run format:check || true
    pnpm -s run lint || true
    pnpm -s run typecheck || true
    pnpm -s run test || true
    pnpm -s run test:e2e || true
    pnpm -s run smoke || true

  elif [ -f yarn.lock ]; then
    echo "[gate] using yarn (yarn.lock)"
    command -v yarn >/dev/null 2>&1 || { echo "[gate] yarn not installed"; exit 1; }
    yarn install --frozen-lockfile

    yarn -s format:check || true
    yarn -s lint || true
    yarn -s typecheck || true
    yarn -s test || true
    yarn -s test:e2e || true
    yarn -s smoke || true

  elif [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then
    echo "[gate] using npm ci (lockfile)"
    npm ci

    npm run -s format:check || true
    npm run -s lint || true
    npm run -s typecheck || true
    npm run -s test || true
    npm run -s test:e2e || true
    npm run -s smoke || true

  else
    echo "[gate] no lockfile; using npm install"
    npm install

    npm run -s format:check || true
    npm run -s lint || true
    npm run -s typecheck || true
    npm run -s test || true
    npm run -s test:e2e || true
    npm run -s smoke || true
  fi
fi

if [ -f pyproject.toml ] || [ -f requirements.txt ]; then
  echo "[gate] Python project detected"
  python -m pip install -U pip || true
  pip install -e ".[dev]" || true

  ruff check . || true
  ruff format --check . || true
  mypy . || true
  pytest -q || true
fi

echo "[gate] done"
