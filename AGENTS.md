# AGENTS.md (Codex) — botworld

## Goal
Small, reviewable PRs for the bot world web game.

## Non-negotiables
- One ticket = one PR.
- Do NOT touch secrets (.env, credentials, keys) or leak tokens in logs.
- Do NOT run destructive commands.
- Prefer minimal diffs over refactors.

## Gate
Run: ./scripts/gate.sh

## Botworld guidelines
- Server authoritative: validate all inputs (client + bots).
- Determinism: keep tick/update stable where feasible.
- Add tests for invariants when touching core simulation.
