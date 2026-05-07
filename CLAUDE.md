# CLAUDE.md

6502 assembly toolkit. TypeScript, compiled with Bun into standalone
executables. Bun workspaces monorepo under `packages/` (one dir per tool +
shared core).

Current scope: NMOS 6502 and 65C816. Only `@sixfive/core` exists today;
tool packages are added ad-hoc.

## Layout

- `packages/<pkg>/src/` — sources
- `packages/<pkg>/test/` — tests (not co-located)
- `dist/<tool>` — compiled standalone binaries (root, not per-package)

## Commands

- Tests: `bun test`
- Compile a tool: `bun build --compile`
- Root dispatch scripts: TBD

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
- Filenames: `kebab-case.ts`.
- Exports: named only. No `default` exports. No barrel `index.ts`
  re-exports — import direct from the source file.
- Style: functional by default. Classes are allowed when they fit the
  domain (parse trees, ASTs, stateful machines).
- `@sixfive/core` is treated as a public-ish API. Break carefully and
  batch breaking changes.

## Lint, format, CI

- Lint + format: Biome. CI fails on violations.
- CI runs on every push and PR: `bun test`, `tsc --noEmit`, Biome check.
