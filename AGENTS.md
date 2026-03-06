Eagle Plugin for Obsidian — uploads images to Eagle instead of storing them locally in the vault.
This file provides guidance for Claude Code when working with this repository.


# References
- eagle api: https://api.eagle.cool/

# Release
- Run `pnpm version patch|minor|major` on `main` — this bumps version, updates `manifest.json`/`versions.json`, commits, and pushes a tag. The CI `release.yml` workflow triggers on the tag and publishes the GitHub Release automatically.