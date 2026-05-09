import { expect, test } from "bun:test";
import { lex } from "@sixfive/core/lex";
import { d, eof, t } from "./test-helpers";

test("simple identifier", () => {
  expect(lex("foo")).toEqual({
    tokens: [t("ident", "foo", 0, 1, 1), eof(3, 1, 4)],
    diagnostics: [],
  });
});

test("leading underscore", () => {
  expect(lex("_foo")).toEqual({
    tokens: [t("ident", "_foo", 0, 1, 1), eof(4, 1, 5)],
    diagnostics: [],
  });
});

test("digits in tail but not at start", () => {
  expect(lex("foo123")).toEqual({
    tokens: [t("ident", "foo123", 0, 1, 1), eof(6, 1, 7)],
    diagnostics: [],
  });
});

test("identifiers are case-sensitive", () => {
  expect(lex("Foo FOO foo")).toEqual({
    tokens: [
      t("ident", "Foo", 0, 1, 1),
      t("trivia", " ", 3, 1, 4),
      t("ident", "FOO", 4, 1, 5),
      t("trivia", " ", 7, 1, 8),
      t("ident", "foo", 8, 1, 9),
      eof(11, 1, 12),
    ],
    diagnostics: [],
  });
});

test("non-ASCII characters are not identifier starters", () => {
  expect(lex("é")).toEqual({
    tokens: [eof(1, 1, 2)],
    diagnostics: [
      d("error", "unexpected-char", 'Unexpected character: "é"', 0, 1, 1, 1),
    ],
  });
});

test("digit-then-ident does not start an identifier", () => {
  expect(lex("3foo")).toEqual({
    tokens: [
      t("int", "3", 0, 1, 1, { value: 3 }),
      t("ident", "foo", 1, 1, 2),
      eof(4, 1, 5),
    ],
    diagnostics: [],
  });
});
