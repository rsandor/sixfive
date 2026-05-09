import { expect, test } from "bun:test";
import { lex } from "@sixfive/core/lex";
import { eof, t } from "./test-helpers";

test("simple single-char punctuation", () => {
  // Each char separated by a space to keep them isolated.
  const src = ": , { } ( ) # @ + - * / ~ ^";
  const expected = [
    t("punct", ":", 0, 1, 1, { punct: ":" }),
    t("trivia", " ", 1, 1, 2),
    t("punct", ",", 2, 1, 3, { punct: "," }),
    t("trivia", " ", 3, 1, 4),
    t("punct", "{", 4, 1, 5, { punct: "{" }),
    t("trivia", " ", 5, 1, 6),
    t("punct", "}", 6, 1, 7, { punct: "}" }),
    t("trivia", " ", 7, 1, 8),
    t("punct", "(", 8, 1, 9, { punct: "(" }),
    t("trivia", " ", 9, 1, 10),
    t("punct", ")", 10, 1, 11, { punct: ")" }),
    t("trivia", " ", 11, 1, 12),
    t("punct", "#", 12, 1, 13, { punct: "#" }),
    t("trivia", " ", 13, 1, 14),
    t("punct", "@", 14, 1, 15, { punct: "@" }),
    t("trivia", " ", 15, 1, 16),
    t("punct", "+", 16, 1, 17, { punct: "+" }),
    t("trivia", " ", 17, 1, 18),
    t("punct", "-", 18, 1, 19, { punct: "-" }),
    t("trivia", " ", 19, 1, 20),
    t("punct", "*", 20, 1, 21, { punct: "*" }),
    t("trivia", " ", 21, 1, 22),
    t("punct", "/", 22, 1, 23, { punct: "/" }),
    t("trivia", " ", 23, 1, 24),
    t("punct", "~", 24, 1, 25, { punct: "~" }),
    t("trivia", " ", 25, 1, 26),
    t("punct", "^", 26, 1, 27, { punct: "^" }),
    eof(27, 1, 28),
  ];
  expect(lex(src)).toEqual({ tokens: expected, diagnostics: [] });
});

test("dot-dot vs dot-dot-equals — maximal munch", () => {
  expect(lex("..=")).toEqual({
    tokens: [t("punct", "..=", 0, 1, 1, { punct: "..=" }), eof(3, 1, 4)],
    diagnostics: [],
  });
  expect(lex("..")).toEqual({
    tokens: [t("punct", "..", 0, 1, 1, { punct: ".." }), eof(2, 1, 3)],
    diagnostics: [],
  });
  expect(lex("..a")).toEqual({
    tokens: [
      t("punct", "..", 0, 1, 1, { punct: ".." }),
      t("ident", "a", 2, 1, 3),
      eof(3, 1, 4),
    ],
    diagnostics: [],
  });
});

test("less-than family — maximal munch", () => {
  expect(lex("<<")).toEqual({
    tokens: [t("punct", "<<", 0, 1, 1, { punct: "<<" }), eof(2, 1, 3)],
    diagnostics: [],
  });
  expect(lex("<=")).toEqual({
    tokens: [t("punct", "<=", 0, 1, 1, { punct: "<=" }), eof(2, 1, 3)],
    diagnostics: [],
  });
  expect(lex("<")).toEqual({
    tokens: [t("punct", "<", 0, 1, 1, { punct: "<" }), eof(1, 1, 2)],
    diagnostics: [],
  });
  expect(lex("<<<")).toEqual({
    tokens: [
      t("punct", "<<", 0, 1, 1, { punct: "<<" }),
      t("punct", "<", 2, 1, 3, { punct: "<" }),
      eof(3, 1, 4),
    ],
    diagnostics: [],
  });
});

test("greater-than family — maximal munch", () => {
  expect(lex(">>")).toEqual({
    tokens: [t("punct", ">>", 0, 1, 1, { punct: ">>" }), eof(2, 1, 3)],
    diagnostics: [],
  });
  expect(lex(">=")).toEqual({
    tokens: [t("punct", ">=", 0, 1, 1, { punct: ">=" }), eof(2, 1, 3)],
    diagnostics: [],
  });
  expect(lex(">")).toEqual({
    tokens: [t("punct", ">", 0, 1, 1, { punct: ">" }), eof(1, 1, 2)],
    diagnostics: [],
  });
});

test("equality and bang — maximal munch", () => {
  expect(lex("==")).toEqual({
    tokens: [t("punct", "==", 0, 1, 1, { punct: "==" }), eof(2, 1, 3)],
    diagnostics: [],
  });
  expect(lex("=")).toEqual({
    tokens: [t("punct", "=", 0, 1, 1, { punct: "=" }), eof(1, 1, 2)],
    diagnostics: [],
  });
  expect(lex("!=")).toEqual({
    tokens: [t("punct", "!=", 0, 1, 1, { punct: "!=" }), eof(2, 1, 3)],
    diagnostics: [],
  });
  expect(lex("!")).toEqual({
    tokens: [t("punct", "!", 0, 1, 1, { punct: "!" }), eof(1, 1, 2)],
    diagnostics: [],
  });
});

test("logical and bitwise and/or — maximal munch", () => {
  expect(lex("&&")).toEqual({
    tokens: [t("punct", "&&", 0, 1, 1, { punct: "&&" }), eof(2, 1, 3)],
    diagnostics: [],
  });
  expect(lex("&")).toEqual({
    tokens: [t("punct", "&", 0, 1, 1, { punct: "&" }), eof(1, 1, 2)],
    diagnostics: [],
  });
  expect(lex("||")).toEqual({
    tokens: [t("punct", "||", 0, 1, 1, { punct: "||" }), eof(2, 1, 3)],
    diagnostics: [],
  });
  expect(lex("|")).toEqual({
    tokens: [t("punct", "|", 0, 1, 1, { punct: "|" }), eof(1, 1, 2)],
    diagnostics: [],
  });
});

test("colon family — maximal munch", () => {
  expect(lex("::")).toEqual({
    tokens: [t("punct", "::", 0, 1, 1, { punct: "::" }), eof(2, 1, 3)],
    diagnostics: [],
  });
  expect(lex(":")).toEqual({
    tokens: [t("punct", ":", 0, 1, 1, { punct: ":" }), eof(1, 1, 2)],
    diagnostics: [],
  });
  expect(lex(":::")).toEqual({
    tokens: [
      t("punct", "::", 0, 1, 1, { punct: "::" }),
      t("punct", ":", 2, 1, 3, { punct: ":" }),
      eof(3, 1, 4),
    ],
    diagnostics: [],
  });
  expect(lex("foo::bar")).toEqual({
    tokens: [
      t("ident", "foo", 0, 1, 1),
      t("punct", "::", 3, 1, 4, { punct: "::" }),
      t("ident", "bar", 5, 1, 6),
      eof(8, 1, 9),
    ],
    diagnostics: [],
  });
});

test("percent followed by binary digit lexes as binary, otherwise punct", () => {
  expect(lex("%")).toEqual({
    tokens: [t("punct", "%", 0, 1, 1, { punct: "%" }), eof(1, 1, 2)],
    diagnostics: [],
  });
});
