import { expect, test } from "bun:test";
import { lex } from "@sixfive/core/lex";
import { d, eof, t } from "./test-helpers";

test("simple string", () => {
  expect(lex('"hello"')).toEqual({
    tokens: [t("str", '"hello"', 0, 1, 1, { string: "hello" }), eof(7, 1, 8)],
    diagnostics: [],
  });
});

test("empty string", () => {
  expect(lex('""')).toEqual({
    tokens: [t("str", '""', 0, 1, 1, { string: "" }), eof(2, 1, 3)],
    diagnostics: [],
  });
});

test("all escape sequences", () => {
  const src = '"\\n\\r\\t\\0\\\\\\""';
  const decoded = '\n\r\t\0\\"';
  expect(lex(src)).toEqual({
    tokens: [
      t("str", src, 0, 1, 1, { string: decoded }),
      eof(src.length, 1, src.length + 1),
    ],
    diagnostics: [],
  });
});

test("hex byte escapes", () => {
  const src = '"\\x41\\x00"';
  expect(lex(src)).toEqual({
    tokens: [t("str", src, 0, 1, 1, { string: "A\0" }), eof(10, 1, 11)],
    diagnostics: [],
  });
});

test("UTF-8 passthrough", () => {
  expect(lex('"héllo"')).toEqual({
    tokens: [t("str", '"héllo"', 0, 1, 1, { string: "héllo" }), eof(7, 1, 8)],
    diagnostics: [],
  });
});

test("unterminated string at EOF", () => {
  expect(lex('"foo')).toEqual({
    tokens: [t("str", '"foo', 0, 1, 1, { string: "foo" }), eof(4, 1, 5)],
    diagnostics: [
      d(
        "error",
        "unterminated-string",
        "Unterminated string literal at end of input",
        0,
        4,
        1,
        1,
      ),
    ],
  });
});

test("unterminated string at newline", () => {
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

test("invalid escape sequence", () => {
  const src = '"\\q"';
  expect(lex(src)).toEqual({
    tokens: [t("str", src, 0, 1, 1, { string: "q" }), eof(4, 1, 5)],
    diagnostics: [
      d("error", "invalid-escape", "Invalid escape sequence \\q", 1, 3, 1, 2),
    ],
  });
});

test("invalid \\xNN escape with non-hex digits", () => {
  const src = '"\\xZZ"';
  expect(lex(src)).toEqual({
    tokens: [t("str", src, 0, 1, 1, { string: "xZZ" }), eof(6, 1, 7)],
    diagnostics: [
      d("error", "invalid-escape", "Invalid \\xNN escape", 1, 3, 1, 2),
    ],
  });
});
