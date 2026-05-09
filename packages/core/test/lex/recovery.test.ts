import { expect, test } from "bun:test";
import { lex } from "@sixfive/core/lex";
import { d, eof, t } from "./test-helpers";

test("recovery from unterminated string at newline", () => {
  expect(lex('"foo\nbar')).toEqual({
    tokens: [
      t("str", '"foo', 0, 1, 1, { string: "foo" }),
      t("newline", "\n", 4, 1, 5),
      t("ident", "bar", 5, 2, 1),
      eof(8, 2, 4),
    ],
    diagnostics: [
      d(
        "error",
        "unterminated-string",
        "Unterminated string literal",
        0,
        4,
        1,
        1,
      ),
    ],
  });
});

test("recovery from unterminated block comment runs through EOF", () => {
  expect(lex("/* nope")).toEqual({
    tokens: [t("trivia", "/* nope", 0, 1, 1), eof(7, 1, 8)],
    diagnostics: [
      d(
        "error",
        "unterminated-block-comment",
        "Unterminated block comment",
        0,
        7,
        1,
        1,
      ),
    ],
  });
});

test("recovery from invalid escape continues lexing the string", () => {
  const src = '"a\\qb"';
  expect(lex(src)).toEqual({
    tokens: [t("str", src, 0, 1, 1, { string: "aqb" }), eof(6, 1, 7)],
    diagnostics: [
      d("error", "invalid-escape", "Invalid escape sequence \\q", 2, 4, 1, 3),
    ],
  });
});

test("recovery from invalid number continues with next token", () => {
  expect(lex("1_ foo")).toEqual({
    tokens: [
      t("int", "1_", 0, 1, 1, { value: 0 }),
      t("trivia", " ", 2, 1, 3),
      t("ident", "foo", 3, 1, 4),
      eof(6, 1, 7),
    ],
    diagnostics: [
      d("error", "invalid-number", "Invalid decimal literal", 0, 2, 1, 1),
    ],
  });
});

test("recovery from unexpected character skips one byte", () => {
  expect(lex("?abc")).toEqual({
    tokens: [t("ident", "abc", 1, 1, 2), eof(4, 1, 5)],
    diagnostics: [
      d("error", "unexpected-char", 'Unexpected character: "?"', 0, 1, 1, 1),
    ],
  });
});
