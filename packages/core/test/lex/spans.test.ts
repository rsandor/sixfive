import { expect, test } from "bun:test";
import { lex } from "@sixfive/core/lex";
import { d, eof, t } from "./test-helpers";

test("EOF span on simple input", () => {
  expect(lex("abc")).toEqual({
    tokens: [t("ident", "abc", 0, 1, 1), eof(3, 1, 4)],
    diagnostics: [],
  });
});

test("EOF span on empty input", () => {
  expect(lex("")).toEqual({
    tokens: [eof(0, 1, 1)],
    diagnostics: [],
  });
});

test("EOF span after trailing newline is on next line", () => {
  expect(lex("abc\n")).toEqual({
    tokens: [
      t("ident", "abc", 0, 1, 1),
      t("newline", "\n", 3, 1, 4),
      eof(4, 2, 1),
    ],
    diagnostics: [],
  });
});

test("col resets to 1 after newline", () => {
  expect(lex("abc\ndef")).toEqual({
    tokens: [
      t("ident", "abc", 0, 1, 1),
      t("newline", "\n", 3, 1, 4),
      t("ident", "def", 4, 2, 1),
      eof(7, 2, 4),
    ],
    diagnostics: [],
  });
});

test("tab counts as one column for tracking", () => {
  expect(lex("\tabc")).toEqual({
    tokens: [
      t("trivia", "\t", 0, 1, 1),
      t("ident", "abc", 1, 1, 2),
      eof(4, 1, 5),
    ],
    diagnostics: [],
  });
});

test("multi-byte UTF-8 inside a string", () => {
  expect(lex('"é"')).toEqual({
    tokens: [t("str", '"é"', 0, 1, 1, { string: "é" }), eof(3, 1, 4)],
    diagnostics: [],
  });
});

test("error span for unexpected character", () => {
  expect(lex("?")).toEqual({
    tokens: [eof(1, 1, 2)],
    diagnostics: [
      d("error", "unexpected-char", 'Unexpected character: "?"', 0, 1, 1, 1),
    ],
  });
});

test("CRLF span covers both bytes; next token starts at col 1", () => {
  expect(lex("a\r\nb")).toEqual({
    tokens: [
      t("ident", "a", 0, 1, 1),
      t("newline", "\r\n", 1, 1, 2),
      t("ident", "b", 3, 2, 1),
      eof(4, 2, 2),
    ],
    diagnostics: [],
  });
});
