<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-25 | Updated: 2026-03-25 -->

# src/types/ — Type Definitions

## Purpose

Pure TypeScript type definitions and interfaces. No runtime code, no side effects, no obsidian imports.

## Key Files

| File | Purpose |
|------|---------|
| `obsidian.d.ts` | Extended Obsidian type declarations — `CanvasView`, `ClickableToken`, `NodeAdapterFs`, `NodeAdapterPath`, `ClipboardManager` shims |

## For AI Agents

- **obsidian-developer**: Define structural types and interfaces here when obsidian imports are needed.
- **obsidian-qa**: Verify no runtime code or side effects.

## Dependencies

- Imports from: **NOTHING** — leaf layer
- No `obsidian` imports allowed (define shim interfaces instead for structural typing)
