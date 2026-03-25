<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-25 | Updated: 2026-03-25 -->

# src/utils/ — Pure Functions

## Purpose

Pure utility functions with zero state and zero external dependencies. All functions are deterministic and testable without mocks.

## Key Files

| File | Purpose |
|------|---------|
| `markdown-image.ts` | Markdown/wikilink image token parsing — find image references, replace text spans |
| `image-format.ts` | Image file extension extraction and format detection |
| `item-naming.ts` | Upload item name template resolution — supports `{uuid}`, `{noteName}`, `{date}`, `{originalName}` |
| `pseudo-random.ts` | Pseudo-random ID generation (short 5-char IDs) |
| `FileList.ts` | File list helpers — check if all files are images |
| `events.ts` | ClipboardEvent utilities — build paste event copies |

## For AI Agents

- **obsidian-developer**: Add pure utility functions here. No state, no imports from project except other utils.
- **obsidian-qa**: Unit test all functions without mocks.

## Dependencies

- Imports from: **NOTHING** — leaf layer
- No `obsidian` imports allowed
