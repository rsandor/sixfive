// Reserved identifiers in the surface language. Used by the parser to
// pick a statement form before falling through to instruction / call.
export const KEYWORDS: ReadonlySet<string> = new Set([
  "const",
  "section",
  "org",
  "proc",
  "macro",
  "if",
  "else",
  "repeat",
  "for",
  "in",
  "byte",
  "word",
  "ascii",
  "res",
  "fill",
]);

// Subset of KEYWORDS that may begin a top-level / block-level statement.
// Used by panic-mode resync to decide where a broken statement ends and
// the next one begins. Does NOT include `else`, `in` (continuations) or
// `byte`/`word`/`ascii`/`res`/`fill` (require a leading label, so the
// label itself is the anchor).
export const STATEMENT_ANCHORS: ReadonlySet<string> = new Set([
  "const",
  "section",
  "org",
  "proc",
  "macro",
  "if",
  "for",
  "repeat",
]);

// 56 NMOS 6502 mnemonics from docs/6502-reference.md §6. Stored
// lower-cased; lookup must lowercase the candidate (mnemonics are
// conventionally uppercase but the spec is case-sensitive on idents).
export const NMOS_MNEMONICS: ReadonlySet<string> = new Set([
  "adc",
  "and",
  "asl",
  "bcc",
  "bcs",
  "beq",
  "bit",
  "bmi",
  "bne",
  "bpl",
  "brk",
  "bvc",
  "bvs",
  "clc",
  "cld",
  "cli",
  "clv",
  "cmp",
  "cpx",
  "cpy",
  "dec",
  "dex",
  "dey",
  "eor",
  "inc",
  "inx",
  "iny",
  "jmp",
  "jsr",
  "lda",
  "ldx",
  "ldy",
  "lsr",
  "nop",
  "ora",
  "pha",
  "php",
  "pla",
  "plp",
  "rol",
  "ror",
  "rti",
  "rts",
  "sbc",
  "sec",
  "sed",
  "sei",
  "sta",
  "stx",
  "sty",
  "tax",
  "tay",
  "tsx",
  "txa",
  "txs",
  "tya",
]);

export function isMnemonic(text: string): boolean {
  return NMOS_MNEMONICS.has(text.toLowerCase());
}
