# CLAUDE.md

6502 assembly toolkit. TypeScript, compiled with Bun into standalone
executables. Bun workspaces monorepo under `packages/` (one dir per tool +
shared core).

## Rules

- Markdown files: hard-wrap at 80 characters per line.
- Markdown files: terse. No superfluous language. No extra detail unless
  the user asks for it.
- Package manager: `bun` exclusively. Never `npm`, `yarn`, or `pnpm`.
- Cross-package imports: use the workspace name
  (e.g. `@sixfive/core`), never relative paths (`../../core`).
- TypeScript: `strict: true`. No `any` without an inline comment
  justifying it.
- Runtime dependencies: zero. Tools must run with only Bun's standard
  library. No runtime deps in any `packages/*/package.json`.
- Dev dependencies: ask for explicit approval before adding any.

