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

# AGENTS.md (Codex Pro)

## Goal
Implement requested features end-to-end with minimal diffs and passing Gate.

## Must Do
- Run `./scripts/gate.sh` before finishing.
- Add/extend UI and API routes as requested.
- Keep changes scoped and documented.

## Must NOT Do
- Do not modify secrets or add tokens.
- Do not run destructive commands.

## Default assumptions
- If UI framework is Next.js: implement pages + API routes under /app or /pages.
- If backend is FastAPI: add endpoints under backend/api and use existing service patterns.
- If unknown, scan repository and choose the most consistent approach already used in codebase.
