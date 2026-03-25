<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-25 | Updated: 2026-03-25 -->

# src/ui/ — Obsidian-Dependent Layer

## Purpose

All Obsidian API interactions: views, modals, settings tabs, event handlers, commands, and I/O. Contains the Eagle REST API client (`EagleUploader`) and vault adapters.

## Key Files

| File | Purpose |
|------|---------|
| `EagleUploader.ts` | Eagle REST API client — `/api/item/addFromPath`, `/api/folder/list`, `/api/item/list`, thumbnail resolution |
| `EagleCacheManager.ts` | Manages local vault cache — writes Eagle thumbnails via `vault.adapter` |
| `EagleHashStore.ts` | Content-hash → Eagle item ID deduplication store (persistent) |
| `EaglePluginSettingsTab.ts` | Settings tab UI — host/port, folder mappings, cache folder, dedup, debounce |
| `EagleSearchPickerModal.ts` | Item search and picker modal — searches Eagle library, displays results |
| `ImageUploadBlockingModal.ts` | Progress modal shown during image upload |
| `UpdateLinksConfirmationModal.ts` | Confirmation modal before bulk link updates |
| `RenameCacheModal.ts` | Modal to rename cached items |
| `InfoModal.ts` | Generic info modal |
| `VaultFolderSuggestModal.ts` | Folder suggestion/picker modal |
| `Canvas.ts` | Canvas paste handler — intercepts image pastes on canvas views |
| `editor.ts` | Editor helpers — find file under cursor, replace text spans |
| `file-url.ts` | file:// URL ↔ OS path conversion via Node adapter |
| `obsidian-vault.ts` | Vault path helpers — get cached references, replace remote links |
| `misc.ts` | Miscellaneous UI utilities — image normalization, link removal |

## For AI Agents

- **obsidian-ui**: Implement views, modals, settings. Design UX and visual elements.
- **obsidian-developer**: Implement Eagle API integration and vault I/O.
- **obsidian-qa**: Integration test all modal workflows, verify Eagle API calls.

## Dependencies

- Imports from: `domain/`, `types/`, `utils/`, `shared/`, and `obsidian`
- No restrictions on `obsidian` imports — all Obsidian API goes here
