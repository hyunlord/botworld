# CLAUDE.md — botworld (Lead / Integration)

## Role
Act as lead engineer: architecture, integration, refactors, boundaries.

## Branch/worktree rules
- Work in: botworld-wt/lead (this worktree)
- Ticket branches: t/<id>-<slug> (Codex Pro works there)
- Gate checks: ./scripts/gate.sh (run in gate worktree)

## Guardrails
- Authoritative server; strict input validation.
- Deterministic simulation tick when possible.
- Observability: structured logs + event stream for spectator UI.
- Security: rate limits, sandbox bot actions, defend injection.

## Delegation format for Codex tickets
Include:
- Objective
- Non-goals
- Files/dirs to touch
- Acceptance criteria (tests + gate passing)
- Risk notes (security/perf/compat)
