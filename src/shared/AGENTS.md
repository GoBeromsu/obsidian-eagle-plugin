<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-25 | Updated: 2026-03-25 -->

# src/shared/ — Boiler-Template Synced Files

## Purpose

Deterministic code synced from `obsidian-boiler-template`. Every plugin in the ecosystem has the same versions of these files via `pnpm sync:plugins`.

**DO NOT EDIT manually — changes will be overwritten on next sync.**

## Key Files

| File | Purpose |
|------|---------|
| `plugin-logger.ts` | Structured logger — console.debug/warn/error only, no notice spam |
| `plugin-notices.ts` | Obsidian Notice wrappers and catalog pattern |
| `debounce-controller.ts` | Debounce utility for event handlers |
| `settings-migration.ts` | Settings version migration helper |
| `styles.base.css` | Base CSS classes for plugin UI |

## For AI Agents

- **obsidian-developer**: Use these utilities in implementations. Do NOT modify.
- If improvements needed: propose changes in `obsidian-boiler-template`, then sync to all plugins.

## Sync Workflow

1. Make changes in `obsidian-boiler-template/src/shared/`
2. Run `pnpm sync:plugins` in monorepo root
3. All plugins automatically receive updates
4. Commit in each plugin: `chore: sync boiler-template`

## Dependencies

- Imports from: `obsidian` and possibly `utils/`, `types/`, `domain/`
- Exports to: All layers via `main.ts`
