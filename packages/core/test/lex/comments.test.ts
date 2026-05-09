import { expect, test } from "bun:test";
import { lex } from "@sixfive/core/lex";
import { d, eof, t } from "./test-helpers";

test("modern // line comment", () => {
  expect(lex("// foo")).toEqual({
    tokens: [t("trivia", "// foo", 0, 1, 1), eof(6, 1, 7)],
    diagnostics: [],
  });
});

test("legacy ; line comment emits warning", () => {
  expect(lex("; foo")).toEqual({
    tokens: [t("trivia", "; foo", 0, 1, 1, { legacy: true }), eof(5, 1, 6)],
    diagnostics: [
      d("warning", "legacy-comments", "Legacy `;` line comment", 0, 5, 1, 1),
    ],
  });
});

test("block comment", () => {
  expect(lex("/* foo */")).toEqual({
    tokens: [t("trivia", "/* foo */", 0, 1, 1), eof(9, 1, 10)],
    diagnostics: [],
  });
});

test("nested block comments", () => {
  expect(lex("/* /* */ */")).toEqual({
    tokens: [t("trivia", "/* /* */ */", 0, 1, 1), eof(11, 1, 12)],
    diagnostics: [],
  });
});

test("doc-comment block", () => {
  expect(lex("/** doc */")).toEqual({
    tokens: [t("doc-comment", "/** doc */", 0, 1, 1), eof(10, 1, 11)],
    diagnostics: [],
  });
});

test("doc-comment line", () => {
  expect(lex("/// foo")).toEqual({
    tokens: [t("doc-comment", "/// foo", 0, 1, 1), eof(7, 1, 8)],
    diagnostics: [],
  });
});

test("consecutive /// lines merge into one doc-comment", () => {
  const src = "/// a\n/// b";
  expect(lex(src)).toEqual({
    tokens: [t("doc-comment", src, 0, 1, 1), eof(11, 2, 6)],
    diagnostics: [],
  });
});

test("/// run with leading whitespace continues merging", () => {
  const src = "/// a\n  /// b";
  expect(lex(src)).toEqual({
    tokens: [t("doc-comment", src, 0, 1, 1), eof(13, 2, 8)],
    diagnostics: [],
  });
});

test("blank line breaks the /// run", () => {
  expect(lex("/// a\n\n/// b")).toEqual({
    tokens: [
      t("doc-comment", "/// a", 0, 1, 1),
      t("newline", "\n", 5, 1, 6),
      t("newline", "\n", 6, 2, 1),
      t("doc-comment", "/// b", 7, 3, 1),
      eof(12, 3, 6),
    ],
    diagnostics: [],
  });
});

test("non-/// content breaks the /// run", () => {
  const src = "/// a\nfoo";
  expect(lex(src)).toEqual({
    tokens: [
      t("doc-comment", "/// a", 0, 1, 1),
      t("newline", "\n", 5, 1, 6),
      t("ident", "foo", 6, 2, 1),
      eof(9, 2, 4),
    ],
    diagnostics: [],
  });
});

test("/*** is a regular block, not a doc comment", () => {
  expect(lex("/*** body */")).toEqual({
    tokens: [t("trivia", "/*** body */", 0, 1, 1), eof(12, 1, 13)],
    diagnostics: [],
  });
});

test("/**/ is a regular empty block, not a doc comment", () => {
  expect(lex("/**/")).toEqual({
    tokens: [t("trivia", "/**/", 0, 1, 1), eof(4, 1, 5)],
    diagnostics: [],
  });
});

test("//// is a regular line comment", () => {
  expect(lex("//// also")).toEqual({
    tokens: [t("trivia", "//// also", 0, 1, 1), eof(9, 1, 10)],
    diagnostics: [],
  });
});

test("unterminated block comment", () => {
  expect(lex("/* foo")).toEqual({
    tokens: [t("trivia", "/* foo", 0, 1, 1), eof(6, 1, 7)],
    diagnostics: [
      d(
        "error",
        "unterminated-block-comment",
        "Unterminated block comment",
        0,
        6,
        1,
        1,
      ),
    ],
  });
});
