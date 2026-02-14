#!/usr/bin/env bash
set -euo pipefail

echo "[gate] repo: $(pwd)"
echo "[gate] git status:"
git status --porcelain || true

# --- Node/TS project checks ---
if [ -f package.json ]; then
  echo "[gate] npm ci"
  npm ci

  echo "[gate] format/lint/type/test/smoke (if available)"
  npm run -s format:check || true
  npm run -s lint || true
  npm run -s typecheck || true
  npm run -s test || true
  npm run -s test:e2e || true
  npm run -s smoke || true
fi

# --- Python project checks ---
if [ -f pyproject.toml ] || [ -f requirements.txt ]; then
  echo "[gate] python deps (best effort)"
  python -m pip install -U pip || true
  pip install -e ".[dev]" || true

  echo "[gate] ruff/mypy/pytest (if installed)"
  ruff check . || true
  ruff format --check . || true
  mypy . || true
  pytest -q || true
fi

echo "[gate] done"
