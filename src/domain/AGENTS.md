<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-25 | Updated: 2026-03-25 -->

# src/domain/ — Business Logic

## Purpose

Core business logic isolated from Obsidian API. All code is pure, deterministic, and testable with simple stubs. No obsidian imports allowed (enforced by ESLint).

## Key Files

| File | Purpose |
|------|---------|
| `settings.ts` | Settings interface (`EaglePluginSettings`), defaults, and folder mapping type (`ObsidianEagleFolderMapping`) |
| `folder-mapping.ts` | Folder path normalization and mapping resolution (pure logic) |
| `EagleApiError.ts` | Typed error class for Eagle API failures |

## For AI Agents

- **obsidian-developer**: Implement pure business logic here. All functions must be testable with simple stubs.
- **obsidian-qa**: Verify no `obsidian` imports. ESLint rule `no-restricted-imports` enforces this.

## Dependencies

- Imports from: `types/`, `utils/` only
- Imports from: **NOT** `obsidian`, `ui/`, or `shared/`
