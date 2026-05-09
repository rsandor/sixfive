import { expect, test } from "bun:test";
import { lex } from "@sixfive/core/lex";
import { eof, t } from "./test-helpers";

test("whitespace run produces single trivia token", () => {
  expect(lex("   ")).toEqual({
    tokens: [t("trivia", "   ", 0, 1, 1), eof(3, 1, 4)],
    diagnostics: [],
  });
});

test("tab and space mix produces single trivia token", () => {
  expect(lex(" \t ")).toEqual({
    tokens: [t("trivia", " \t ", 0, 1, 1), eof(3, 1, 4)],
    diagnostics: [],
  });
});

test("LF newline", () => {
  expect(lex("\n")).toEqual({
    tokens: [t("newline", "\n", 0, 1, 1), eof(1, 2, 1)],
    diagnostics: [],
  });
});

test("CRLF newline is a single newline token", () => {
  expect(lex("\r\n")).toEqual({
    tokens: [t("newline", "\r\n", 0, 1, 1), eof(2, 2, 1)],
    diagnostics: [],
  });
});

test("bare CR is a single newline token", () => {
  expect(lex("\r")).toEqual({
    tokens: [t("newline", "\r", 0, 1, 1), eof(1, 2, 1)],
    diagnostics: [],
  });
});

test("multiple newlines produce multiple newline tokens", () => {
  expect(lex("\n\n")).toEqual({
    tokens: [
      t("newline", "\n", 0, 1, 1),
      t("newline", "\n", 1, 2, 1),
      eof(2, 3, 1),
    ],
    diagnostics: [],
  });
});

test("mixed whitespace, newlines, and identifier", () => {
  expect(lex("  \n  foo")).toEqual({
    tokens: [
      t("trivia", "  ", 0, 1, 1),
      t("newline", "\n", 2, 1, 3),
      t("trivia", "  ", 3, 2, 1),
      t("ident", "foo", 5, 2, 3),
      eof(8, 2, 6),
    ],
    diagnostics: [],
  });
});
