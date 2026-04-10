<!-- Parent: ../AGENTS.md -->
<!-- Maintained locally | Updated: 2026-04-10 -->

# src/shared/ — Repo-Local Helper Layer

## Purpose

Reusable helpers that support this plugin's runtime without centralizing product behavior in another repo.

## Key Files

| File | Purpose |
|------|---------|
| `debounce-controller.ts` | Debounced rerun controller for plugin events |
| `plugin-logger.ts` | Structured logging + notice-backed error helper |
| `plugin-notices.ts` | Notice catalog, mute state, and notice rendering helpers |
| `settings-migration.ts` | Shared migration runner for settings objects |
| `styles.base.css` | Shared CSS primitives used by plugin UI surfaces |

## For AI Agents

- Treat this directory as repo-owned implementation, not synced boilerplate.
- Keep helpers broadly reusable within this repo, but prefer repo-local changes over pushing product behavior into workspace-wide shared code.
- `plugin-logger.ts` and `plugin-notices.ts` may import `obsidian`; other files should stay as dependency-light as practical.

## Dependencies

- May import from `obsidian`, `types/`, or platform built-ins when needed.
- Must not become a dumping ground for feature-specific UI flows; keep concrete product behavior in `ui/` or `main.ts`.
