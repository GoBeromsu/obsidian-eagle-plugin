# Eagle Integration for Obsidian

An Obsidian plugin that uploads images to [Eagle](https://eagle.cool/) instead of storing them locally in your vault. Images are embedded as Obsidian wikilinks pointing to a local cache folder, so they render offline while Eagle stays the source of truth for your assets.

## Why?

Obsidian stores all data locally by design -- great for text, but images can quickly bloat your vault. If you paste screenshots daily (e.g. lecture slides, design references), vault size grows fast, hitting cloud storage limits or inflating git repository size.

This plugin routes images to Eagle, which excels at organizing and searching visual assets with tags, folders, and annotations. Your vault stays lean; Eagle stays rich.

## Features

- **Paste & drop upload** -- images pasted or dropped into a note are uploaded to Eagle and embedded immediately
- **Canvas support** -- paste uploads work inside Obsidian Canvas views
- **Local cache** -- images are copied from your Eagle library into a configurable vault folder (`eagle-cache/`) for offline rendering
- **Library search** -- search your Eagle library by keyword and insert images without leaving Obsidian
- **Folder mapping** -- route uploads to different Eagle folders based on the active note's Obsidian folder path
- **Lazy cache sync** -- missing cache files are backfilled automatically on startup and on tab switch
- **Cache eviction** -- cached files are removed when the corresponding Eagle item is deleted
- **Migrate command** -- batch-convert old-format `![eagle:ID](...)` links to the new wikilink format
- **Backward compatibility** -- old-format Eagle image links still render correctly

## Prerequisites

- [Eagle](https://eagle.cool/) installed and running
- Eagle's local API enabled (default: `localhost:41595`)

## Installation

Install via **Settings > Community plugins** and search for "Eagle Integration".

Or install manually:

```bash
cd <your-vault>/.obsidian/plugins
git clone https://github.com/GoBeromsu/obsidian-eagle-plugin eagle-integration
cd eagle-integration
pnpm install && pnpm build
```

Reload Obsidian and enable the plugin under **Settings > Community plugins**.

## Quick Start

1. Open a note in Obsidian
2. Make sure Eagle is running
3. Paste or drag-and-drop an image into your note

The plugin uploads the image to Eagle, caches a copy in your vault under `eagle-cache/`, and inserts a wikilink:

```
![[eagle-cache/LXXXXXXXXXXXXXXX.jpg]]
```

## Commands

| Command | Description |
|---------|-------------|
| Eagle: Upload to Eagle | Upload the local image under the cursor to Eagle |
| Eagle: Insert image from Eagle (search) | Search your Eagle library and insert an image at the cursor |
| Eagle: Migrate all images to eagle-cache | Batch-migrate old-format Eagle links to wikilinks |

Right-click a local image reference in the editor to access **Upload to Eagle** from the context menu.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Eagle API Host | `localhost` | Host of the running Eagle instance |
| Eagle API Port | `41595` | Port of the running Eagle instance |
| Eagle Folder Name | _(empty)_ | Default Eagle folder for uploads; leave empty for Eagle's root |
| Cache folder name | `eagle-cache` | Vault folder where images are cached; supports subfolders (e.g. `80. References/Eagle`) |
| Fallback image format | `jpeg` | Format used when uploading unsupported image types (HEIC, etc.) |
| JPEG conversion quality | `0.9` | Quality for JPEG conversion (0-1) |
| Search diagnostics | off | Log search/thumbnail resolution details to the developer console |

### Folder Mapping

Route uploads to different Eagle folders depending on which Obsidian folder the active note lives in. Add rules under **Settings > Eagle Plugin Settings > Folder Mapping**. The longest matching prefix wins.

**Example:**

| Obsidian Folder | Eagle Folder |
|-----------------|--------------|
| `Projects/Design` | `Design` |
| `Projects` | `Projects` |

A note at `Projects/Design/mockup.md` uploads to the `Design` Eagle folder.

## Local Cache

All embedded Eagle images are stored as wikilinks pointing to a local cache folder:

```
![[eagle-cache/LXXXXXXXXXXXXXXX.jpg]]
```

The cache folder is configurable and supports nested paths (e.g. `80. References/07. Eagle`). On startup and on tab switch, the plugin checks for missing cache files and backfills them from your Eagle library. If an Eagle item is deleted, its cached copy is evicted automatically.

To rename the cache folder, update the **Cache folder name** setting and confirm when prompted -- the plugin will move all cached files and update wikilinks across your vault.

## Migrating from the Old Format

Earlier versions embedded images as:

```markdown
![eagle:LXXXXXXXXXXXXXXX](file:///absolute/path/to/image.jpg)
```

Run **Eagle: Migrate all images to eagle-cache** to convert all old-format links to the current wikilink format. The migration copies image files from your Eagle library into the cache folder.

The old format also continues to render correctly via a backward-compatible post-processor.

## Tech Stack

| Category | Technology |
|----------|------------|
| Platform | Obsidian Plugin API |
| Language | TypeScript 5 |
| Bundler | esbuild |
| External | Eagle REST API |
| Testing | Vitest, WebdriverIO (e2e) |
| Linting | ESLint + Prettier + Husky |

## Project Structure

```
obsidian-eagle-plugin/
├── src/
│   ├── EaglePlugin.ts          # Main plugin entry point
│   ├── Canvas.ts               # Canvas paste handler
│   ├── plugin-settings.ts      # Settings interface + defaults
│   ├── cache/                  # Local vault cache manager + hash store
│   ├── uploader/               # Eagle REST API client
│   ├── ui/                     # Settings tab, search modal, progress modal
│   ├── types/                  # Extended Obsidian type declarations
│   └── utils/                  # File, editor, markdown, folder-mapping helpers
├── test/                       # Unit and e2e tests
├── scripts/                    # dev.mjs, version.mjs, release.mjs
├── boiler.config.mjs           # Per-repo config
└── manifest.json               # Obsidian plugin manifest
```

## Development

```bash
pnpm install
pnpm dev          # vault selection + esbuild watch + hot reload
pnpm build        # production build
pnpm test         # Vitest unit tests
pnpm lint         # ESLint
pnpm run ci       # build + lint + test
```

## FAQ

**Q: How secure is this approach?**
A: All images are stored locally in your Eagle library, which you control completely. No data leaves your machine.

**Q: Can I remove an image uploaded by accident?**
A: Yes -- delete it from Eagle directly. On the next tab switch, the plugin detects the deletion and removes the cache file.

**Q: Can it upload videos?**
A: Currently the plugin focuses on image uploads.

**Q: Do images render if Eagle is not running?**
A: Yes. Images are cached inside your vault and render as standard Obsidian wikilinks regardless of whether Eagle is running.

## Known Limitations

- Animated GIFs pasted from the clipboard are captured as static images by the OS. Use drag-and-drop to upload animated GIFs.
- Eagle must be running for uploads and cache sync to work (rendering always works via local cache).

## Contributing

Contributions are welcome. Please open an issue or discussion before submitting large changes.

If you have questions or suggestions, use [GitHub Discussions](https://github.com/GoBeromsu/obsidian-eagle-plugin/discussions).

## Credits

Originally forked from [gavvvr/obsidian-imgur-plugin](https://github.com/gavvvr/obsidian-imgur-plugin) and adapted for Eagle integration.

If this plugin is helpful, consider giving it a star on GitHub.

## License

MIT
