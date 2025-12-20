# CLAUDE.md

Eagle Plugin for Obsidian — uploads images to Eagle instead of storing them locally in the vault.
This file provides guidance for Claude Code when working with this repository.

## Rules

1. Before starting work, Create a new branch from `main` for this task.

## Practical Feature-Branch Strategy (Industry Standard)

This repository follows a **GitHub-style feature branch workflow**: each task is developed in its own branch and integrated into `main` via PR after review.

- `main` — always production-ready; no direct commits
- `feature/<name>` — new functionality; branched from `main`
- `fix/<name>` — bug fix; branched from `main`
- `refactor/<name>` — internal improvements; branched from `main`

**Workflow Principles**

- Always create a branch from `main` for each change
- Branch names describe _purpose_, not implementation details
- Use PRs for merging into `main` only
- Keep branches short-lived and focused on one concern

## Commit Convention

This project follows **Conventional Commits**.

```
<type>(<scope>): <description>
```

Allowed types:

- `feat` | `fix` | `docs` | `refactor` | `perf`
- `test` | `build` | `ci` | `chore`

Commitlint is enforced via `.commitlintrc.yaml`.
