<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-25 | Updated: 2026-03-25 -->

# src/ — Layered Architecture

## Purpose

Composition and integration point for the four-layer architecture. Routes business logic (domain), UI (ui), type definitions (types), and utilities (utils) through a single composition root.

## Key Files

| File | Purpose |
|------|---------|
| `main.ts` | Composition root — wires layers together, registers commands, event handlers, UI elements |

## Subdirectories

- `domain/` — Business logic: settings, folder mapping, error handling. No obsidian imports.
- `ui/` — Obsidian-dependent layer: modals, settings tabs, API client, cache managers.
- `types/` — Pure type definitions: extended Obsidian types, interfaces.
- `utils/` — Pure functions: markdown parsing, image utilities, random ID generation.
- `shared/` — Repo-local helper files: logger, notices, debounce, settings migration.

## For AI Agents

- **obsidian-developer**: Implement logic in `domain/`, wire in `main.ts`. Never import obsidian in domain.
- **obsidian-ui**: Implement UI in `ui/`. Settings tab, modals, event handlers.
- **obsidian-qa**: Verify layer isolation using ESLint `no-restricted-imports` rule.

## Dependencies

- `main.ts` imports from all layers (composition root)
- `ui/` imports from `domain/`, `types/`, `utils/`, `shared/`, and `obsidian`
- `domain/` imports from `types/`, `utils/` only
- `types/` and `utils/` are leaf layers (no project imports)
