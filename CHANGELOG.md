# obsidian-eagle-plugin changelog

## [2.0.6] - 2026-02-21

### Changed

- Eliminate redundant Eagle thumbnail API call in search+insert flow: `item.filePath`
  from search results is now used directly, reducing API round-trips and failure points.
- Remove runtime monkey-patching of `EagleUploader.upload`; image normalisation
  (`normalizeImageForUpload`) is now called explicitly before upload for better
  type safety and clarity.

### Added

- `EagleUploader.resolveFileUrl(item)` — single entry point for converting an Eagle
  item to a renderable `file://` URL, with fallback to the thumbnail API when
  `filePath` is absent.
- Document Eagle API path contract in `normalizeEagleApiPathToFileUrl` JSDoc.

## [2.0.5] - 2026-02-21

### Fixed

- Normalize Eagle API thumbnail/file paths before generating `file://` URLs to prevent double-encoding issues for non-ASCII filenames during search-import.

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

[2.0.6]: https://github.com/GoBeromsu/obsidian-eagle-plugin/releases/tag/2.0.6
[2.0.5]: https://github.com/GoBeromsu/obsidian-eagle-plugin/releases/tag/2.0.5
[2.0.4]: https://github.com/GoBeromsu/obsidian-eagle-plugin/releases/tag/2.0.4
[2.0.3]: https://github.com/GoBeromsu/obsidian-eagle-plugin/releases/tag/2.0.3
[2.0.2]: https://github.com/GoBeromsu/obsidian-eagle-plugin/releases/tag/2.0.2
[2.0.1]: https://github.com/GoBeromsu/obsidian-eagle-plugin/releases/tag/2.0.1
