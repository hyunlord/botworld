# AGENTS.md (Codex Working Agreement) — botworld

## Goal
Implement small, reviewable PRs for the bot world web game.

## Non-negotiables
- One ticket = one PR. Keep scope minimal.
- Do NOT touch secrets (.env, credentials, keys).
- Do NOT run destructive commands.
- Prefer explicit, boring solutions over clever ones.

## How to run checks (Gate)
Run: ./scripts/gate.sh

If scripts are missing, add npm scripts:
- format:check, lint, typecheck, test, smoke

## Botworld guidelines
- Server is authoritative: validate all inputs (client + bots).
- Keep simulation deterministic where feasible (stable tick).
- Add tests for invariants if touching core simulation.

## PR checklist
- [ ] Scoped to ticket
- [ ] ./scripts/gate.sh passes
- [ ] Tests added/updated
- [ ] No secrets/log leaks
