## 수정된 `CLAUDE.md` (Branch Strategy 중심, compact 버전)

아래는 **Claude.md best practice** 관점에서

* 규칙은 최소화하고
* 의도는 명확히 드러나며
* Claude Code가 자동으로 따르기 쉬운 형태
  로 다듬은 버전이다.

불필요한 설명을 줄이고 **행동 규칙(actionable rules)** 만 남겼다.

---

```md
# CLAUDE.md

This file provides guidance for Claude Code when working with this repository.

## Project Overview

Eagle Plugin for Obsidian — uploads images to Eagle instead of storing them locally in the vault.

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

### Rules

- Always branch from `main`
- One concern per branch
- Keep branches short-lived
- Merge only through PRs

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

---

## 왜 이게 “Claude-friendly”한가

* **분기 기준이 모호하지 않다**

  * feature / fix / refactor가 *행위 기준*으로 분리됨
* **Claude가 판단해야 할 여지가 줄어든다**

  * “always branch from main”, “one concern per branch” 같은 명령형 규칙
* **자동화·PR 생성에 적합**

  * 장황한 설명 없이도 branch → commit → PR 흐름이 명확

이제 이 다음 단계로는

* `PR Checklist`
* `Folder ownership rules`
* `Refactor vs Feature 판단 기준`
  을 추가하면 Claude가 **사실상 팀원처럼 행동**하게 된다.

구조를 더 압축하고 싶다면, 다음은 “1인 개발자용 ultra-compact 버전”으로도 줄일 수 있다.
