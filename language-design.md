# sixfive — language design

Greenfield 6502 assembler. NMOS only. Opinionated surface syntax aimed at
engineers fluent in Rust/TS/Go.

## Design goals

- **Modern eyes first.** Read like a current systems language, not a 1980s
  listing. Drop dot-prefix directives, end-keyword blocks, column rules.
- **Visual hierarchy without noise.** Three tiers: instructions, directives,
  meta. Each looks distinct without sigil clutter.
- **Editor-friendly.** Structured doc comments + tags so an LSP can hover
  call sites with input/output/clobber info.
- **Opinionated.** One way to do each thing. Soft migration only where the
  cost is near-zero (e.g. `;` warned, not rejected).
- **NMOS only.** No 65C02/65C816/illegal-opcode accommodations.

## Syntax reference

### Lexical

- **Line comment.** `//` preferred. `;` accepted, warns
  (`legacy_comments`). Suppress per-file with `@allow legacy_comments`.
- **Block comment.** `/* ... */`. **Nests** (Rust-style).
- **Doc comment.** `/** ... */` block, `///` line. Attaches only to the
  next `proc` or `macro`. Multiple `///` lines stack into one block.
- **Numbers.** `$FF` hex, `%1010` binary, `42` decimal. `_` separators
  allowed (`$DEAD_BEEF`).
- **Strings.** `"..."` double-quoted, escape with `\`.
- **Identifiers.** `[A-Za-z_][A-Za-z0-9_]*`. Case-sensitive.

### Declarations

- **Constant.** `const NAME = expr` — compile-time value, no storage.
- **Reserve.** `label: res N` — N uninitialized bytes.
- **Fill.** `label: fill N, value` — N bytes of `value`.
- **Byte data.** `label: byte expr, expr, ...`
- **Word data.** `label: word expr, expr, ...` (little-endian).
- **ASCII data.** `label: ascii "...", expr, ...` — string + trailing
  bytes mixed freely.
- **Label.** `name:` on its own line or before any statement.

Every data decl (`res`/`fill`/`byte`/`word`/`ascii`) requires a leading
label. Adjacent labels alias the same address:

```
entry:
start:  byte 0
```

`entry` and `start` resolve to the same address.

### Address / layout

- **Org.** `org $C000` — set PC. Canonical form.
- **Section.** `section "name"` — logical group; linker maps to address.
  Re-entering the same name appends to that section.
- **Byte extract.** `low(expr)` low byte, `high(expr)` high byte. No
  prefix `<`/`>` form.

Sections are the preferred layout primitive. `org` is an escape hatch
for cases where a full section model is overkill.

### Blocks

- **Proc.** `proc name { ... }` — subroutine. Inner labels are private
  to the proc; reachable from outside as `name.inner_label`.
- **Macro.** `macro Name(arg, ...) { ... }` — inline expansion. Inner
  labels are gensym'd per expansion (hygienic). Non-argument symbol
  references resolve at the call site.
- **If / else.** `if expr { ... } else { ... }` — assemble-time gate on
  `const` expressions. Body shares the enclosing label scope.
- **Repeat.** `repeat N { ... }` — emit body N times, no index. Body
  shares enclosing scope.
- **For.** `for i in 0..N { ... }` — exclusive range. `0..=N` inclusive.
  `i` is a compile-time const usable in expressions. Body shares
  enclosing scope.

`for` and `repeat` bodies may contain instructions, data directives
(`byte`/`word`/`ascii`), or both. A label preceding the block binds to
the first emitted byte.

### Expressions

C-style operators with C precedence (high to low):

```
unary       - ~ !
mul         * / %
add         + -
shift       << >>
relational  < <= > >=
equality    == !=
bitwise     &  then  ^  then  |
logical     &&  then  ||
```

Operands: integer literals, `const` symbols, label/data symbols,
`for`-bound names, calls to `low(...)`, `high(...)`, `sizeof(...)`.

`sizeof(symbol)` returns the byte count of a `byte`/`word`/`ascii`/
`res`/`fill` declaration. Compile-time constant.

### Operand → addressing mode

Resolved implicitly from operand shape:

| Operand form          | Mode                |
|-----------------------|---------------------|
| `#expr`               | immediate           |
| `expr`                | zp or abs by symbol |
| `expr,X` / `expr,Y`   | indexed zp/abs      |
| `(expr,X)`            | indexed indirect    |
| `(expr),Y`            | indirect indexed    |
| `(expr)`              | indirect (JMP only) |

Branch / relative modes are inferred from the instruction.

### Meta

`@`-prefixed. Talks to the assembler, never emits code/data.

- `@cpu 6502` — target CPU (currently the only legal value).
- `@assert expr` — compile fails if `expr` is false.
- `@align N` — pad to N-byte boundary.
- `@allow feature` — opt into legacy behaviors per file.

### Doc tags

Structured tags inside `/** */` or `///`. Attach only to `proc` or
`macro`. Surfaced by the LSP at call sites.

| Tag | Applies to | Meaning |
|---|---|---|
| `@param NAME desc` | macro | Named macro argument. |
| `@in REG=desc` | proc | Register/flag or zero-page input. |
| `@out REG=desc` | proc | Register/flag or zero-page output. |
| `@clobbers REGS` | proc, macro | Regs/flags trashed by the call. |
| `@preserves REGS` | proc, macro | Regs guaranteed unchanged. |
| `@cycles N` | proc, macro | Cycle budget (worst case). |
| `@deprecated msg` | any | Flag for removal; warns on use. |

`REG` / `REGS` = `A`, `X`, `Y`, `C`, `Z`, `N`, `V`, `D`, `I`, or
zero-page symbols. Comma-separated where multiple.

### Style conventions

Not enforced; recommended for free visual hierarchy.

- **UPPERCASE** mnemonics (`LDA`, `STA`).
- **lowercase** directives (`byte`, `proc`, `for`).
- **PascalCase** macros (`SetPtr`).
- **SCREAMING_SNAKE** constants (`SCREEN_W`).
- **snake_case** procs and labels (`clear_screen`).

## Open questions

Spec is intentionally silent on:

- **Banks.** No bank model yet.
- **Forward refs / symbol-size resolution.** How `LDA foo` picks zp vs
  abs when `foo` is a forward reference.
- **`const` value domain + `if` truthiness.** Int-only? Bool? String?
- **Macro argument form.** Token-only, expression, or by-value.

## Example

```
// =========================================================================
// demo.s — sixfive syntax showcase
// =========================================================================

@cpu 6502

/*
 * Memory map:
 *   $0000-$00FF  zero page
 *   $0200-$02FF  BSS
 *   $0400-$07FF  screen
 *   $C000-$FFFF  ROM
 */

// ---- Constants ----------------------------------------------------------

const DEBUG    = 1
const SCREEN   = $0400
const SCREEN_W = 40
const SPRITES  = 8

// ---- Zero page ----------------------------------------------------------

section "zp"

ptr:        res 2
counter:    res 1
tmp:        res 1

// ---- BSS ----------------------------------------------------------------

section "bss"

sprite_x:   res SPRITES
sprite_y:   res SPRITES
buffer:     res 256

// ---- Macros -------------------------------------------------------------

/**
 * Load a 16-bit address into zero-page pointer `ptr`.
 * @param    addr  Absolute address (literal or label).
 * @clobbers A
 */
macro SetPtr(addr) {
    LDA #low(addr)
    STA ptr
    LDA #high(addr)
    STA ptr+1
}

/**
 * Store an immediate byte to a memory location.
 * @param    value  Byte to store (0..255).
 * @param    addr   Destination address.
 * @clobbers A
 */
macro StoreImm(value, addr) {
    LDA #value
    STA addr
}

// ---- Code ---------------------------------------------------------------

section "code"
org $C000

/**
 * Reset entry point.
 * @clobbers A, X
 */
proc reset {
    SEI
    CLD
    LDX #$FF
    TXS

    StoreImm(0, counter)

    JSR clear_screen
    JSR draw_message
    JSR init_sprites

main_loop:
    JSR update
    JMP main_loop
}

/**
 * Fill the screen buffer with spaces.
 * @clobbers A, X, Y
 * @cycles   4100
 */
proc clear_screen {
    SetPtr(SCREEN)
    LDX #4
    LDY #0
    LDA #$20
page:
    STA (ptr),Y
    INY
    BNE page
    INC ptr+1
    DEX
    BNE page
    RTS
}

/**
 * Copy null-terminated string at `message` into screen RAM.
 * @clobbers  A, X
 * @preserves Y
 */
proc draw_message {
    LDX #0
copy:
    LDA message,X
    BEQ done
    STA SCREEN,X
    INX
    BNE copy
done:
    RTS
}

/**
 * Initialize sprite tables to a horizontal row.
 * @clobbers A
 */
proc init_sprites {
    for i in 0..SPRITES {
        LDA #i * 16
        STA sprite_x + i
        LDA #100
        STA sprite_y + i
    }
    RTS
}

/**
 * Per-frame update.
 * @clobbers A, X
 */
proc update {
    if DEBUG {
        INC counter
    } else {
        NOP
    }

    LDX #0
loop:
    INC sprite_x,X
    INX
    CPX #SPRITES
    BNE loop
    RTS
}

/** Stub NMI handler. */
proc nmi { RTI }

/** Stub IRQ handler. */
proc irq { RTI }

// ---- Read-only data -----------------------------------------------------

section "rodata"

message:        ascii "HELLO 6502", 0

bit_masks:      for i in 0..8  { byte 1 << i }
squares:        for i in 0..16 { byte i * i }

sprite_tiles:   word $2000, $2010, $2020, $2030,
                     $2040, $2050, $2060, $2070

padding:        fill 16, $FF
nop_sled:       repeat 32 { NOP }

// ---- Vectors ------------------------------------------------------------

section "vectors"
org $FFFA

nmi_vec:    word nmi        // $FFFA NMI
reset_vec:  word reset      // $FFFC reset
irq_vec:    word irq        // $FFFE IRQ

// ---- Compile-time checks ------------------------------------------------

@assert sizeof(message) <= SCREEN_W
@assert sizeof(sprite_tiles) == SPRITES * 2
```
