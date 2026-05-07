# sixfive

A modern 6502 assembly toolkit.

## Overview

`sixfive` is a collection of command-line tools for 6502 assembly
development. Tools are written in TypeScript, compiled with
[Bun](https://bun.sh) into standalone executables, and installable
individually.

## Project layout

```
sixfive/
├── package.json          # bun workspaces root
├── tsconfig.base.json
├── bun.lockb
├── README.md
├── .gitignore
├── packages/             # one dir per tool + shared core
├── scripts/              # build/release helpers
└── .github/workflows/
```
