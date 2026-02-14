# CLAUDE.md — botworld (Lead)

## Role
Lead engineer: architecture, integration, refactors, boundaries.

## Worktree rules
- Work here: botworld-wt/lead (Claude Code)
- Tickets: botworld-wt/t-<id>-<slug> (Codex Pro)
- Gate: botworld-wt/gate (Codex CLI verification)

## Guardrails
- Input validation at boundaries.
- Spectator/event stream should be structured and replayable.
- Avoid breaking public APIs without migration notes.

## Delegation template for Codex tickets
- Objective / Non-goals
- Files/dirs to touch
- Acceptance criteria: tests + ./scripts/gate.sh
- Risk notes: security/perf/compat
