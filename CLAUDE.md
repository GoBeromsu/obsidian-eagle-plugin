# CLAUDE.md

Eagle Plugin for Obsidian — uploads images to Eagle instead of storing them locally in the vault.
This file provides guidance for Claude Code when working with this repository.

> Git strategy, branch naming, commit convention, and release management are defined in the **root CLAUDE.md**. This file covers plugin-specific details only.

## Project Overview

- Obsidian plugin: uploads images to Eagle app instead of local vault storage
- Entry point: `src/EaglePlugin.ts`
- Build output: `main.js` (CommonJS, ES2018 target)

## Build & Dev Commands

```bash
pnpm run dev       # vault selection + esbuild watch + hot reload
pnpm run dev:build # esbuild watch only (no vault)
pnpm run build     # production build → main.js (single-shot)
pnpm run test      # Vitest unit tests
pnpm run test:ui   # Vitest UI
pnpm run e2e       # WebdriverIO + Electron E2E
pnpm run lint      # ESLint (flat config)
pnpm run lint:fix  # ESLint auto-fix
pnpm run ci        # build + lint + test
```

## Architecture

- `src/EaglePlugin.ts` — Main plugin class
- `src/uploader/` — Eagle API communication
- `src/ui/` — Settings tab, modals
- `src/utils/` — Editor, vault, file utilities
- `scripts/dev.mjs` — Unified dev orchestrator (vault discovery + watch + sync)
- `scripts/dev.config.mjs` — Repo-specific dev config (copy mode)

## Hot Reload Dev Workflow

- `scripts/dev.mjs`: discover vaults → select → mount plugin → esbuild watch → copy output to vault → trigger hot-reload
- Set `VAULT_PATH` env, `VAULT_NAME` env, or `--vault <name>` CLI flag to skip interactive selection
- Use `--non-interactive` for CI environments
- CDP integration: run `verify-plugin.mjs` after build for automated verification

## Testing

- Unit: `test/*.test.ts` (Vitest)
- E2E: `test/e2e/` (WebdriverIO + Electron, PageObject pattern)
- Coverage: v8 provider

## Tooling

- ESLint flat config + TypeScript type checking + import sorting
- Prettier (no semicolons, single quotes, trailing commas)
- Husky pre-commit (lint) + commit-msg (commitlint via `.commitlintrc.yaml`)
