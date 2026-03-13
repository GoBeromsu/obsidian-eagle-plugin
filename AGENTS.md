Eagle Plugin for Obsidian — uploads images to Eagle instead of storing them locally in the vault.

## Build Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Vault selection + esbuild watch + hot reload |
| `pnpm dev:build` | esbuild watch only (no vault) |
| `pnpm build` | Production build (single-shot) |
| `pnpm ci` | build + lint + test |
| `pnpm test` | Vitest run |
| `pnpm test:ui` | Vitest with UI |
| `pnpm verify` | Build, reload plugin in vault, run verify script |
| `pnpm e2e` | WebdriverIO end-to-end tests |
| `pnpm lint` | ESLint check |
| `pnpm lint:fix` | ESLint auto-fix |
| `pnpm version` | Bump version in package.json, manifest.json, versions.json |
| `pnpm release:patch` | lint:fix, patch bump, auto-push tag |
| `pnpm release:minor` | lint:fix, minor bump, auto-push tag |
| `pnpm release:major` | lint:fix, major bump, auto-push tag |
| `pnpm prepare` | Husky git hooks setup |

## Architecture

```
src/
├── EaglePlugin.ts              # Main plugin entry — registers paste handlers, commands, events
├── Canvas.ts                   # Canvas paste handler (intercepts image pastes on Obsidian Canvas)
├── plugin-settings.ts          # Settings interface + defaults (host, port, cache folder, dedup, etc.)
├── cache/
│   ├── EagleCacheManager.ts    # Local vault cache — writes Eagle thumbnails via vault.adapter
│   └── EagleHashStore.ts       # Content-hash → Eagle item ID dedup store (persisted in plugin data)
├── uploader/
│   ├── EagleUploader.ts        # Eagle REST API client (add from path, folder ops, item search)
│   ├── EagleApiError.ts        # Typed error class for Eagle API failures
│   └── item-naming.ts          # Upload item name template resolution (e.g. {uuid}_{noteName})
├── ui/
│   ├── EaglePluginSettingsTab.ts       # Settings tab UI
│   ├── EagleSearchPickerModal.ts       # Eagle item search/picker modal
│   ├── ImageUploadBlockingModal.ts     # Progress modal during upload
│   ├── InfoModal.ts                    # Generic info modal
│   ├── RenameCacheModal.ts             # Rename cached items modal
│   ├── UpdateLinksConfirmationModal.ts # Confirmation before bulk link updates
│   └── VaultFolderSuggestModal.ts      # Folder suggestion modal
├── types/
│   └── obsidian.d.ts           # Extended Obsidian type declarations
└── utils/
    ├── FileList.ts             # File list helpers (e.g. allFilesAreImages)
    ├── editor.ts               # Editor helpers (find file under cursor, replace text)
    ├── events.ts               # ClipboardEvent utilities (buildPasteEventCopy)
    ├── file-url.ts             # file:// URL ↔ OS path conversion
    ├── folder-mapping.ts       # Obsidian folder → Eagle folder mapping resolution
    ├── image-format.ts         # Image extension extraction
    ├── markdown-image.ts       # Markdown/wikilink image token parsing and replacement
    ├── misc.ts                 # Miscellaneous utilities
    ├── obsidian-vault.ts       # Vault path helpers
    └── pseudo-random.ts        # Pseudo-random ID generation
```

## Key Config

- `boiler.config.mjs` — dev deploy paths (copy mode: manifest.json, styles.css, main.js), version stage files, CI config, release artifact list
- `scripts/version.mjs` — version bump script (synced from boiler-template); updates `manifest.json` and `versions.json`, then stages them via git add

## Release

1. `pnpm ci` — MUST pass (build + lint + test)
2. `pnpm release:patch|minor|major` — lint:fix, version bump, auto-push tag
3. GitHub Actions handles CI + Release workflows

**DENIED by settings.json:** `git tag`, `git push --tags`, `gh release` — only `pnpm release:*` is allowed.

## References

- Eagle API: https://api.eagle.cool/

## Gotchas

- `.gitignore` has a `release/` pattern that blocks `.claude/skills/release/` — a negation rule `!.claude/skills/release/` is in place
- hookify security hook blocks RegExp patterns containing the exec-paren sequence — use `.match()` or `.matchAll()` instead
- esbuild build always succeeds even with TS errors; use `pnpm tsc --noEmit` to check types (has some pre-existing errors from Obsidian type defs)
- Cache sync: never evicts on uncertain failures (`itemExists()` returns `null` on network error)
- Image format in notes: `![[eagle-cache/ITEMID.EXT]]` (wikilink embed, vault-relative); old format `![eagle:ID](file://...)` kept for backward compat
- Cache folder default: `eagle-cache/` (configurable via settings)
