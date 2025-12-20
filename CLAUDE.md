# CLAUDE.md

This file provides guidance for Claude Code when working with this repository.

## Project Overview

Eagle Plugin for Obsidian - uploads images to [Eagle](https://eagle.cool/) instead of storing them locally in your vault.

## Branch Strategy

- **Main branch**: `main` - production-ready code
- **Feature branches**: `feature/<feature-name>` - new features
- **Bugfix branches**: `fix/<bug-name>` - bug fixes
- **Refactor branches**: `refactor/<description>` - code refactoring

Always create a feature branch from `main` and submit a PR for review.

## Commit Format

This project follows [Conventional Commits](https://www.conventionalcommits.org/).

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (formatting, etc.)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `build`: Changes that affect the build system or external dependencies
- `ci`: Changes to CI configuration files and scripts
- `chore`: Other changes that don't modify src or test files

### Examples

```
feat(uploader): add support for batch image uploads
fix(api): handle Eagle connection timeout gracefully
docs(readme): update installation instructions
refactor(settings): simplify configuration logic
```

Commitlint is configured via `.commitlintrc.yaml` with `@commitlint/config-conventional`.
