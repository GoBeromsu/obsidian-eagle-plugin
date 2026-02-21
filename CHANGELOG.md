# obsidian-eagle-plugin changelog

## [2.0.4] - 2026-02-21

### Fixed

- Replace unsupported `window.prompt` usage in the Eagle search-import command with an Obsidian modal, fixing search flow on Electron environments that block native prompts.

## [2.0.3] - 2026-02-21

### Added

- Add command **Eagle: Insert image from Eagle (search)** to search Eagle library items and insert selected images into the current note.

## [2.0.2] - 2026-02-14

### Added

- Add configurable fallback format for unsupported image uploads (`jpeg`/`png`/`webp`) and HEIC/other non-renderable format handling.
- Detect image type from file signature/extension before deciding conversion.
- Add conversion quality setting for JPEG fallback output.

### Changed

- Keep existing upload error behavior for conversion failures.

### Fixed

- Improve local image link and file list heuristics for non-standard image extensions in upload paths.

## [2.0.1] - 2026-02-09

### Fixed

- Percent-encode `file://` URLs (spaces/unicode/parentheses) so Obsidian renders embeds reliably.

### Added

- Store Eagle item IDs in markdown alt text (`![eagle:<id>](file://...)`) for portability.
- Commands to re-resolve embedded image paths for the current note or the entire vault.

[2.0.4]: https://github.com/GoBeromsu/obsidian-eagle-plugin/releases/tag/2.0.4
[2.0.3]: https://github.com/GoBeromsu/obsidian-eagle-plugin/releases/tag/2.0.3
[2.0.2]: https://github.com/GoBeromsu/obsidian-eagle-plugin/releases/tag/2.0.2
[2.0.1]: https://github.com/GoBeromsu/obsidian-eagle-plugin/releases/tag/2.0.1
