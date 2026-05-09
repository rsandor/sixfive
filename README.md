# sixfive

A modern 6502 assembly toolkit.

## Overview

`sixfive` is a collection of command-line tools for 6502 assembly
development. Tools are written in TypeScript, compiled with
[Bun](https://bun.sh) into standalone executables, and installable
individually.

Current target: NMOS 6502.

## Project layout

```
sixfive/
├── package.json          # bun workspaces root
├── tsconfig.json
├── bun.lock
├── biome.json
├── README.md
├── .gitignore
├── packages/             # one dir per tool + shared core
├── dist/                 # compiled binaries
└── .github/workflows/
```

## Install

_Coming soon._

## Usage

_Coming soon._

## Tools

### qa-lex

Lexer dump for a 6502 assembly source file. Prints tokens grouped by
line, with kind, lexeme, position, and decoded value where applicable.
Errors go to stderr; exit `1` on lex errors, `2` on bad usage.

Build:

```
bun build --compile packages/qa/src/lex.ts --outfile dist/qa-lex
```

Use:

```
./dist/qa-lex <file>
```

Run without compiling:

```
bun packages/qa/src/lex.ts <file>
```
