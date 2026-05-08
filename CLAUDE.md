# CLAUDE.md

6502 assembly toolkit. TypeScript, compiled with Bun into standalone
executables. Bun workspaces monorepo under `packages/` (one dir per tool +
shared core).

Current scope: NMOS 6502. Only `@sixfive/core` exists today; tool
packages are added ad-hoc.

## Layout

- `packages/<pkg>/src/` — sources
- `packages/<pkg>/test/` — tests (not co-located)
- `dist/<tool>` — compiled standalone binaries (root, not per-package)

## Commands

- Tests: `bun test`
- Compile a tool: `bun build --compile`

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
- Naming: never abbreviate. Spell identifiers in full
  (`Instruction`, not `Instr`; `address`, not `addr`;
  `register`, not `reg`). Established 6502 jargon is fine
  (`mnemonic`, `opcode`, `zp`, `abs`, `pc`, `sp`).
- Never read files in `./.tmp/`. Scratch dir, contents off-limits to
  agents (including globs/greps that traverse it).
- Exports: named only. No `default` exports. No barrel `index.ts`
  re-exports — import direct from the source file.
- Style: functional by default. Classes are allowed when they fit the
  domain (parse trees, ASTs, stateful machines).
- `@sixfive/core` is treated as a public-ish API. Break carefully and
  batch breaking changes.

## Lint, format, CI

- Lint + format: Biome. CI fails on violations.
- CI runs on every push and PR: `bun test`, `tsc --noEmit`, Biome check.

## 6502 reference

`docs/6502-reference.md` = canonical NMOS 6502 spec. Built for grep.

- Read before touching opcodes, addressing modes, cycles, flags, or
  interrupts.
- Lookup: §4 hex→opcode, §6 mnemonic→opcodes, §3 modes, §5 semantics,
  §2 quirks.
- §5 pseudo-code is the spec. Code disagrees → code wrong.
- Check §2 for edge cases. Don't re-derive from memory.
- Scope: NMOS only. No 65C02, 65C816, or illegal opcodes.
- Edit only on verified errata.
