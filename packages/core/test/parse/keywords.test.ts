import { expect, test } from "bun:test";
import {
  isMnemonic,
  KEYWORDS,
  NMOS_MNEMONICS,
  STATEMENT_ANCHORS,
} from "@sixfive/core/parse/keywords";

test("KEYWORDS holds language keywords, not mnemonics", () => {
  expect(KEYWORDS.has("proc")).toBe(true);
  expect(KEYWORDS.has("macro")).toBe(true);
  expect(KEYWORDS.has("for")).toBe(true);
  expect(KEYWORDS.has("in")).toBe(true);
  expect(KEYWORDS.has("byte")).toBe(true);
  expect(KEYWORDS.has("LDA")).toBe(false);
  expect(KEYWORDS.has("lda")).toBe(false);
  expect(KEYWORDS.has("foo")).toBe(false);
});

test("STATEMENT_ANCHORS is a strict subset of KEYWORDS", () => {
  expect(STATEMENT_ANCHORS.size).toBeLessThan(KEYWORDS.size);
  for (const a of STATEMENT_ANCHORS) {
    expect(KEYWORDS.has(a)).toBe(true);
  }
});

test("STATEMENT_ANCHORS excludes continuation keywords", () => {
  // `else` continues an `if`; `in` continues a `for`. Neither starts a
  // statement on its own.
  expect(STATEMENT_ANCHORS.has("else")).toBe(false);
  expect(STATEMENT_ANCHORS.has("in")).toBe(false);
});

test("STATEMENT_ANCHORS excludes data-decl keywords (labels are anchors)", () => {
  expect(STATEMENT_ANCHORS.has("byte")).toBe(false);
  expect(STATEMENT_ANCHORS.has("word")).toBe(false);
  expect(STATEMENT_ANCHORS.has("ascii")).toBe(false);
  expect(STATEMENT_ANCHORS.has("res")).toBe(false);
  expect(STATEMENT_ANCHORS.has("fill")).toBe(false);
});

test("NMOS_MNEMONICS contains exactly 56 entries, all lowercase", () => {
  expect(NMOS_MNEMONICS.size).toBe(56);
  for (const m of NMOS_MNEMONICS) {
    expect(m).toBe(m.toLowerCase());
    expect(m.length).toBe(3);
  }
});

test("NMOS_MNEMONICS spot-check across alphabet", () => {
  // Range coverage: at least one from each starting letter present in §6.
  for (const m of [
    "adc",
    "brk",
    "cli",
    "dey",
    "eor",
    "inx",
    "jmp",
    "lda",
    "nop",
    "ora",
    "pla",
    "rti",
    "sec",
    "tya",
  ]) {
    expect(NMOS_MNEMONICS.has(m)).toBe(true);
  }
});

test("NMOS_MNEMONICS rejects non-NMOS opcodes (65C02 / illegal)", () => {
  // 65C02 additions
  expect(NMOS_MNEMONICS.has("phx")).toBe(false);
  expect(NMOS_MNEMONICS.has("phy")).toBe(false);
  expect(NMOS_MNEMONICS.has("stz")).toBe(false);
  expect(NMOS_MNEMONICS.has("bra")).toBe(false);
  // illegal NMOS
  expect(NMOS_MNEMONICS.has("slo")).toBe(false);
  expect(NMOS_MNEMONICS.has("lax")).toBe(false);
});

test("isMnemonic accepts upper / lower / mixed case", () => {
  expect(isMnemonic("LDA")).toBe(true);
  expect(isMnemonic("lda")).toBe(true);
  expect(isMnemonic("Lda")).toBe(true);
  expect(isMnemonic("foo")).toBe(false);
  expect(isMnemonic("")).toBe(false);
});
