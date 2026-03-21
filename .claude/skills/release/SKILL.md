---
name: release
description: Run pre-flight checks, determine version bump type from commits, generate changelog, and release obsidian-eagle-plugin. Use when the user says /release, 'release plugin', 'bump version', 'publish release', 'new version'. Requires being on the main branch with a clean working tree.
---

# release

Performs a full release of `obsidian-eagle-plugin`: pre-flight checks, version bump, changelog, and CI verification.

## Workflow

### Step 1 — Pre-flight checks

All commands run from `obsidian-eagle-plugin/`:

```bash
cd /Users/beomsu/Documents/GitHub/Obsidian/obsidian-eagle-plugin
```

1. **Branch check**: Must be on `main`. If not, abort and tell the user.
2. **Clean tree**: `git status --porcelain` must be empty. If not, abort.
3. **Build**: `pnpm build` must succeed.
4. **Lint**: `pnpm lint` must pass.
5. **Test**: `pnpm test` must pass.

If any check fails, stop immediately and report the failure. Do NOT proceed.

### Step 2 — Analyze commits for bump type

Get the last tag and analyze commits since then:

```bash
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [ -n "$LAST_TAG" ]; then
  git log "$LAST_TAG"..HEAD --oneline
else
  git log --oneline -20
fi
```

**Bump type rules:**
- Any `feat:` or `feat(scope):` commit → **minor**
- Only `fix:`, `chore:`, `docs:`, `refactor:`, `style:`, `perf:`, `test:` → **patch**
- Any commit message containing `BREAKING CHANGE` or `!:` → **major**

Present the analysis to the user:
```
Commits since vX.Y.Z:
- feat: ... (× N)
- fix: ... (× M)

Suggested bump: minor (X.Y.Z → X.(Y+1).0)
```

Wait for the user to confirm or override the bump type.

### Step 3 — Generate changelog

Group commits by type:

```markdown
## What's Changed

### Features
- Description from feat commits

### Bug Fixes
- Description from fix commits

### Other
- Description from chore/docs/refactor commits
```

Show the changelog to the user for review.

### Step 4 — Version bump

Run the release command (this triggers `scripts/version.mjs` which updates `manifest.json` and `versions.json`, then `postversion` pushes the commit and tag):

```bash
pnpm release:patch   # or release:minor or release:major
```

This single command:
1. Runs `pnpm lint:fix`
2. Runs `pnpm version [patch|minor|major]` which:
   - Bumps `package.json` version
   - Runs `scripts/version.mjs` (updates `manifest.json`, `versions.json`, stages them)
   - Creates a git commit and tag
3. Runs `postversion` hook: `git push && git push --tags`

### Step 5 — Verify CI

After the tag push, GitHub Actions will trigger two workflows:
- **CI** (`ci.yml`) — build + lint + test
- **Release plugin** (`release.yml`) — build + create GitHub Release with artifacts

Monitor with:
```bash
gh run list --limit 5
```

Wait for both workflows to complete successfully. If either fails, report the failure.

### Step 6 — Report

Output:
- New version number
- Release URL: `gh release view --json url -q .url`
- Changelog summary

## Notes

- The entire version bump + push is handled by `pnpm release:[type]` — do NOT manually edit version files
- `scripts/version.mjs` reads `boiler.config.mjs` for `stageFiles` config
- `versions.json` maps each plugin version to its minimum Obsidian app version
- If the user explicitly requests a specific bump type, skip the commit analysis and use their choice
- Never force-push or amend version commits
