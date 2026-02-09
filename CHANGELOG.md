# obsidian-eagle-plugin changelog

## [2.0.1] - 2026-02-09

### Fixed

- Percent-encode `file://` URLs (spaces/unicode/parentheses) so Obsidian renders embeds reliably.

### Added

- Store Eagle item IDs in markdown alt text (`![eagle:<id>](file://...)`) for portability.
- Commands to re-resolve embedded image paths for the current note or the entire vault.

## [2.0.0] - 2025-11-10

This release brings Eagle integration for local image management.

### Changed

- Migrated from Imgur to Eagle for image storage
- All images are now stored locally in your Eagle library
- Simplified settings to only require Eagle API host and port configuration

### Added

- Eagle API integration
- Local image library management through Eagle
- Support for Eagle's organizational features

### Removed

- Imgur authentication and anonymous upload features
- Client ID configuration (no longer needed)
- Remote image hosting dependencies

## [1.2.0] - 2021-06-02

### Fixed

- fall back to default behavior if image upload fails (#8, #9)

### Added

- An `ImageUploader` interface which should simplify creating forks supporting other image providers

## [1.1.0] - 2021-04-26

### Added

- support for upload on drag-and-drop
- which enabled gifs upload support (#6)

## [1.0.0] - 2021-01-15

- Initial version
- Works by providing `client_id` manually
- Only supports paste action

[2.0.0]: https://github.com/gavvvr/obsidian-eagle-plugin/releases/tag/2.0.0
[2.0.1]: https://github.com/GoBeromsu/obsidian-eagle-plugin/releases/tag/2.0.1
[1.2.0]: https://github.com/gavvvr/obsidian-imgur-plugin/releases/tag/1.2.0
[1.1.0]: https://github.com/gavvvr/obsidian-imgur-plugin/releases/tag/1.1.0
[1.0.0]: https://github.com/gavvvr/obsidian-imgur-plugin/releases/tag/1.0.0
