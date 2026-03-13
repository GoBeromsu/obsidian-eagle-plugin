---
name: issue
description: Create a standardized GitHub issue for obsidian-eagle-plugin with type-based label mapping and title prefix. Use when the user says /issue, 'create issue', 'file a bug', 'feature request', 'report bug', 'new issue'. If no args provided, analyze conversation context for issue candidates.
---

# issue

Creates a standardized GitHub issue for `obsidian-eagle-plugin` with consistent title prefixes, labels, and body structure.

## Type-to-Label Mapping

| Type | Title Prefix | Labels | When to use |
|------|-------------|--------|-------------|
| `bug` | `[Bug]` | `bug` | Defects that prevent expected behavior |
| `feature` | `[Feature]` | `enhancement` | New functionality or capability |
| `ux` | `[UX]` | `enhancement,ux` | User experience improvements |
| `dx` | `[DX]` | `dx` | Developer experience (tooling, testing, docs) |
| `security` | `[Security]` | `bug,security` | Security vulnerabilities or concerns |

## Workflow

### Step 1 — Determine issue details

If arguments were provided (e.g., `/issue bug "Title" "Description"`), parse them:
- Arg 1: type (bug/feature/ux/dx/security)
- Arg 2: title (quoted string)
- Arg 3: description (optional, quoted string)

If NO arguments were provided:
- Analyze the current conversation for issue candidates
- Look for bugs discovered, features discussed, UX problems identified, or DX gaps found
- Propose 1-3 issue candidates and ask the user which to create
- If only one obvious candidate, confirm with the user before creating

### Step 2 — Build the issue

Map the type to its title prefix and labels from the table above.

**Body template:**

```markdown
## Problem

[Clear description of the issue]

## Expected behavior

[What should happen instead]

## Files involved

- `path/to/file.ts` — [brief reason]
```

For **feature** type, use this body instead:

```markdown
## Problem

[What limitation or need this addresses]

## Proposed solution

[How this could be implemented]

## Acceptance criteria

- [ ] [Criterion 1]
- [ ] [Criterion 2]
```

### Step 3 — Create the issue

Run from the `obsidian-eagle-plugin/` directory:

```bash
cd /Users/beomsu/Documents/GitHub/Obsidian/obsidian-eagle-plugin

gh issue create \
  --title "[Prefix] Title here" \
  --label "label1,label2" \
  --body "$(cat <<'EOF'
## Problem

...

## Expected behavior

...

## Files involved

- ...
EOF
)"
```

### Step 4 — Report

Output the created issue URL and a one-line summary.

## Notes

- Always `cd` into `obsidian-eagle-plugin/` before running `gh` commands (it has its own git remote)
- If the user provides a description, use it as-is in the Problem section
- Keep titles concise (under 80 characters, not counting the prefix)
- The `[UX/Bug]` hybrid prefix is allowed when both categories apply — use labels `bug,ux`
