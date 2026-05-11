# Parser implementation plan

Plan of record for the sixfive grammar parser. Consumes the lexer's
`Token[]`, produces a `Program` AST + `Diagnostic[]`. Hand-written
recursive descent + Pratt expressions. Zero runtime deps.

## Resolved questions

- **Newlines.** Significant at statement boundaries. Ignored inside
  `(...)` and `{...}`, and after a trailing `,` in any list. The cursor
  exposes both `peek()` (skips trivia, keeps `newline`) and
  `peekSkippingNewlines()`; bracket/paren parsers use the latter.
- **`Expr` shape.** One discriminated union, mirroring `Node`. Variants:
  `lit-int`, `lit-str`, `ref` (symbol/for-bound name), `unary`, `binary`,
  `call`, `paren`, `range`. Each carries `Span`.
- **`Value` deprecation.** `Value` and `SymbolRef` are removed.
  `Operand.value` becomes `Expr`. Symbol resolution is a later pass.

## Out of scope for the parser

- `zp` vs `abs` selection. Parser emits `abs` for the bare-`expr` operand
  shape; semantic analysis narrows once symbol values are known.
- Macro vs intrinsic call dispatch. Parser emits a generic `call` node;
  semantic analysis maps `low`/`high`/`sizeof` and macro names.
- Doc-tag parsing inside `/** */`. Parser captures the raw text on the
  attached `proc`/`macro`; tag extraction is a later pass.
- Constant folding, evaluation of `if`/`for` bounds. Parser is purely
  syntactic.

## Phase 1 — AST extension (prerequisite, separate PR)

Edit `packages/core/src/ast.ts`. No parser code in this phase.

Add `Expr` union:

```
type Expr =
  | { kind: "lit-int";  span; value: number }
  | { kind: "lit-str";  span; value: string }
  | { kind: "ref";      span; name: string }
  | { kind: "unary";    span; op: "-"|"~"|"!"; rhs: Expr }
  | { kind: "binary";   span; op: BinOp; lhs: Expr; rhs: Expr }
  | { kind: "call";     span; callee: string; args: Expr[] }
  | { kind: "paren";    span; inner: Expr }
  | { kind: "range";    span; lo: Expr; hi: Expr; inclusive: boolean }
```

`BinOp` covers every operator in the spec table (`*`, `/`, `%`, `+`, `-`,
`<<`, `>>`, `<`, `<=`, `>`, `>=`, `==`, `!=`, `&`, `^`, `|`, `&&`, `||`).

Add `Node` variants:

- `const-decl` — `name: string; value: Expr`
- `data-res` — required `label`; `count: Expr`
- `data-fill` — required `label`; `count: Expr; value: Expr`
- `data-ascii` — required `label`; `parts: (Expr)[]` (string lits and
  byte exprs mix)
- `section` — `name: string`
- `proc` — `name: string; doc?: string; children: Node[]`
- `macro` — `name: string; params: string[]; doc?: string; children`
- `if` — `cond: Expr; thenBranch: Node[]; elseBranch?: Node[]`
  (`then` is reserved by Biome's `noThenProperty` lint — thenable risk)
- `for` — `binder: string; range: Expr (range-kind); children`
- `meta` — `name: "cpu"|"assert"|"align"|"allow"; args: Expr[]`
- `call-stmt` — `callee: string; args: Expr[]` (statement-position macro
  invocation, e.g. `StoreImm(0, counter)`)

Adjust existing variants:

- `Operand.value` / `Operand.target` → `Expr`.
- `data-byte`, `data-word`: require `label: string`; `values: Expr[]`.
- `label` keeps its standalone form for bare labels on their own line.
- `repeat`: `count: Expr` (was `number`).
- `origin`: `address: Expr` (was `Value`).

Update `ast.test.ts` to match. The existing leaf-tuple test stays.

## Phase 2 onwards — parser

### Layout

```
packages/core/src/parse/
  parse.ts        entry: lex result → { program, diagnostics }
  cursor.ts       Token[] wrapper; peek/bump/expect/eat/sync
  keywords.ts     KEYWORDS set + NMOS_MNEMONICS set
  diagnostic.ts   parse DiagnosticCode union (extends lex codes)
  expr.ts         Pratt expression parser
  operand.ts      operand-shape recognizer
  stmt.ts         statement dispatch + each statement form
packages/core/test/parse/
  cursor.test.ts
  expr.test.ts
  operand.test.ts
  stmt-*.test.ts   (one file per statement form)
  recovery.test.ts
```

Add `./parse` to `packages/core/package.json` exports once `parse.ts`
exists.

### Cursor

Class. Holds `tokens: Token[]`, `i: number`, `diagnostics: Diagnostic[]`.

```
peek(): Token                  // skips trivia; keeps newline + eof
peekN(n): Token
peekSkippingNewlines(): Token
bump(): Token                  // consumes peek()
eatPunct(p): boolean
eatIdent(text): boolean
expectPunct(p, code): Token    // pushes diagnostic on miss, returns peek
expectIdent(text, code): Token
atNewline(): boolean
atEof(): boolean
syncToStatement(): void        // panic-mode resync
mark()/reset(m)                // checkpoint for backtracking-free lookahead
```

Trivia is always skipped. `newline` is significant at statement
boundaries only — `peekSkippingNewlines` is used inside any
`(`/`{`-bounded context and after a `,`.

### Keywords and mnemonics

`keywords.ts` exports two `ReadonlySet<string>`s:

- `KEYWORDS` — `const section org proc macro if else repeat for in
  byte word ascii res fill`
- `NMOS_MNEMONICS` — the 56 NMOS mnemonics, lower-cased. Source of
  truth: `docs/6502-reference.md` §6. Match case-insensitively (spec is
  case-sensitive on identifiers but mnemonics are conventionally
  uppercase; lookup uppercases the candidate).

### Statement dispatch (stmt.ts)

After `syncToStatement`-style leading-newline skipping, dispatch on the
first non-trivia token:

| First token                       | Form                            |
|-----------------------------------|---------------------------------|
| `punct @`                         | meta directive                  |
| `doc-comment`                     | buffer; attach to next proc/mac |
| `ident "const"`                   | const decl                      |
| `ident "section"`                 | section                         |
| `ident "org"`                     | org                             |
| `ident "proc"`                    | proc block                      |
| `ident "macro"`                   | macro block                     |
| `ident "if"`                      | if/else                         |
| `ident "repeat"`                  | repeat block                    |
| `ident "for"`                     | for loop                        |
| `ident X` then `punct :`          | label (re-dispatch on tail)     |
| `ident X` ∈ NMOS_MNEMONICS        | instruction                     |
| `ident X` then `punct (`          | call-stmt (macro invocation)    |
| else                              | error + sync                    |

After `IDENT :`, look at the next non-newline token: if it's `res`/
`fill`/`byte`/`word`/`ascii` → required-label data decl; if mnemonic →
labelled instruction; if newline/eof → bare label; otherwise error.

Adjacent labels (spec example: `entry:\nstart: byte 0`) emit two
sibling nodes; address aliasing is a semantic concern.

### Operand recognizer (operand.ts)

Direct table from spec §"Operand → addressing mode":

| Lookahead                  | Mode                      |
|----------------------------|---------------------------|
| `#` then expr              | `immediate`               |
| `(` expr `,X)`             | `ind-x`                   |
| `(` expr `)` `,Y`          | `ind-y`                   |
| `(` expr `)`               | `indirect` (JMP only)     |
| expr `,X`                  | `abs-x` (zp narrowed late)|
| expr `,Y`                  | `abs-y`                   |
| bare `A` / `a`             | `accumulator` (shifts)    |
| expr                       | `abs`                     |
| nothing before newline/eof | `implied`                 |
| relative target            | `relative` (branch insns) |

Branch instructions get `relative` directly because the mnemonic table
flags them. `(expr)` outside `JMP` produces an error diagnostic but
still returns `indirect` to keep the AST shape stable.

### Pratt expressions (expr.ts)

Atoms: `int` / `str` literal, ident (→ `ref`, or `call` if followed by
`(`), parenthesized expr.

Precedence table (high → low; rbp = lbp+1 for left-associative):

```
prefix    -  ~  !                          rbp 110
infix     *  /  %                          lbp 100
infix     +  -                             lbp  90
infix     <<  >>                           lbp  80
infix     <  <=  >  >=                     lbp  70
infix     ==  !=                           lbp  60
infix     &                                lbp  50
infix     ^                                lbp  40
infix     |                                lbp  30
infix     &&                               lbp  20
infix     ||                               lbp  10
```

`..` and `..=` are parsed only by `for` (not in the Pratt table) — the
`for` parser reads `expr ".."|"..=" expr` directly and emits a `range`
node.

Inside `(`/`{` contexts the expression parser uses
`peekSkippingNewlines` so trailing operators can wrap.

### Diagnostics

`parse/diagnostic.ts` re-exports `Diagnostic`/`DiagnosticSeverity` from
lex and adds parse codes:

```
"unexpected-token" | "expected-punct" | "expected-ident" |
"missing-label" | "indirect-outside-jmp" | "unknown-meta" |
"trailing-tokens" | "unterminated-block" | "duplicate-else"
```

### Error recovery

Panic mode at statement granularity. On a parse error inside a
statement: push diagnostic, then `syncToStatement` — skip tokens until
the cursor is at a newline followed by either an anchor keyword
(`proc`, `macro`, `section`, `const`, `org`, `if`, `for`, `repeat`),
a `@` punct, or eof. Inside `{ ... }` blocks, `}` is also a sync point;
inside `( ... )`, `)` is.

Parser always returns a `Program` — partial children if recovery
triggered. Tests assert both the surviving AST shape and the diagnostic
list (matching the lexer's contract).

## Build order

AST already extended in phase 1.

1. Cursor + keywords + diagnostic codes. **[done]**
2. Pratt expressions (drives most operator coverage).
3. Operand recognizer.
4. Instructions.
5. Labels + data decls (`byte` / `word` / `ascii` / `res` / `fill`).
6. `const`, `org`, `section`.
7. Meta directives (`@cpu` / `@assert` / `@align` / `@allow`).
8. `proc` and `macro` blocks; doc-comment attachment.
9. Control flow: `if` / `else`, `repeat`, `for`.
10. Recovery hardening — golden tests for malformed inputs covering
    every statement form's sync behavior.
11. Wire `parse.ts` entry (replace stub) + add `./parse` to
    `packages/core/package.json` exports.

## Scope and PR grouping

1. **Expr + operand** (steps 2-3). Self-contained, no statement
   dispatch yet. ~700 LOC. Foundation — every later PR uses it.
2. **Flat statements** (steps 4-7): instructions, data decls,
   const/org/section, meta. Everything single-line / no nested
   blocks. ~900 LOC. Yields a usable parser for a `qa-parse` dump.
3. **Block forms** (steps 8-9): proc/macro/if/repeat/for. ~1000 LOC.
   Recursion + scoping concerns isolated to one review.
4. **Recovery + entry wiring** (steps 10-11). ~400 LOC, mostly test.
   Closing PR — golden tests across every form, replace `parse.ts`
   stub, add `./parse` export.

## Testing

- One test file per parser module under `test/parse/`.
- Each test feeds source through `lex()` then `parse()`; asserts AST
  + diagnostics. No mocking the lexer.
- Recovery tests assert both the surviving AST shape and the exact
  diagnostic list — same contract as `test/lex/recovery.test.ts`.
- No tautological tests (per project convention): exercise observable
  behavior, not constructor echo.

## Public API

After phase 2 lands, `@sixfive/core` exports:

```
"./parse":            "./src/parse/parse.ts"
"./parse/diagnostic": "./src/parse/diagnostic.ts"
```

`parse.ts` exposes:

```
export interface ParseResult {
  program: Program;
  diagnostics: Diagnostic[];
}
export function parse(source: string): ParseResult;
export function parseTokens(lex: LexResult): ParseResult;
```

The two-arg form lets callers reuse a `LexResult` (e.g. for an LSP that
already lexed for syntax highlighting).
