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
npm run dev       # esbuild watch + vault hot reload
npm run build     # production build → main.js
npm run test      # Vitest unit tests
npm run test:ui   # Vitest UI
npm run e2e       # WebdriverIO + Electron E2E
npm run lint      # ESLint (flat config)
npm run lint:fix  # ESLint auto-fix
```

## Architecture

- `src/EaglePlugin.ts` — Main plugin class
- `src/uploader/` — Eagle API communication
- `src/ui/` — Settings tab, modals
- `src/utils/` — Editor, vault, file utilities
- `scripts/dev.js` — Hot reload dev server (obsidian-utils based)

## Hot Reload Dev Workflow

- `scripts/dev.js`: select vault → auto-install hot-reload plugin → esbuild watch → auto-reload on change
- Set `VAULT_PATH` env or pass CLI arg to specify vault (for CI/non-interactive environments)
- CDP integration: run `verify-plugin.mjs` after build for automated verification

## Testing

- Unit: `test/*.test.ts` (Vitest)
- E2E: `test/e2e/` (WebdriverIO + Electron, PageObject pattern)
- Coverage: v8 provider

## Tooling

- ESLint flat config + TypeScript type checking + import sorting
- Prettier (no semicolons, single quotes, trailing commas)
- Husky pre-commit (lint) + commit-msg (commitlint via `.commitlintrc.yaml`)
