# CLAUDE.md
Eagle Plugin for Obsidian — uploads images to Eagle instead of storing them locally in the vault.
This file provides guidance for Claude Code when working with this repository.

## Rules

1. Ensure the current branch is `main`.
2. Create a new branch from `main` for this task.
	- Use `feature/<name>`, `fix/<name>`, or `refactor/<name>`.
3. Do not make any commits on `main`.

## Branch Strategy

- `main`
	- Always production-ready
	- Protected branch (no direct commits)

- `feature/<name>`
	- New user-facing functionality
	- Created from `main`
	- Merged via PR only

- `fix/<name>`
	- Bug fixes with minimal scope
	- Created from `main`

- `refactor/<name>`
	- Internal code improvements without behaviour changes
	- No feature mixing

## Commit Format
This project follows Conventional Commits.
```
<type>(<scope>): <description>
```

### Allowed Types

- `feat` | `fix` | `docs` | `refactor` | `perf`
- `test` | `build` | `ci` | `chore`

### Examples

```

feat(uploader): support batch image uploads
fix(api): handle Eagle timeout
refactor(settings): simplify config flow

```

Commitlint is enforced via `.commitlintrc.yaml`.
```