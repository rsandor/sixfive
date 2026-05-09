import { expect, test } from "bun:test";
import { lex } from "@sixfive/core/lex";
import { d, eof, t } from "./test-helpers";

test("hex literal lowercase", () => {
  expect(lex("$ab")).toEqual({
    tokens: [t("int", "$ab", 0, 1, 1, { value: 0xab }), eof(3, 1, 4)],
    diagnostics: [],
  });
});

test("hex literal mixed case with underscores", () => {
  expect(lex("$DE_AD")).toEqual({
    tokens: [t("int", "$DE_AD", 0, 1, 1, { value: 0xdead }), eof(6, 1, 7)],
    diagnostics: [],
  });
});

test("binary literal", () => {
  expect(lex("%101")).toEqual({
    tokens: [t("int", "%101", 0, 1, 1, { value: 0b101 }), eof(4, 1, 5)],
    diagnostics: [],
  });
});

test("binary literal with underscore separators", () => {
  expect(lex("%101_010")).toEqual({
    tokens: [t("int", "%101_010", 0, 1, 1, { value: 0b101010 }), eof(8, 1, 9)],
    diagnostics: [],
  });
});

test("decimal literal", () => {
  expect(lex("123")).toEqual({
    tokens: [t("int", "123", 0, 1, 1, { value: 123 }), eof(3, 1, 4)],
    diagnostics: [],
  });
});

test("decimal literal with underscore separators", () => {
  expect(lex("1_000_000")).toEqual({
    tokens: [t("int", "1_000_000", 0, 1, 1, { value: 1000000 }), eof(9, 1, 10)],
    diagnostics: [],
  });
});

test("zero is a valid decimal literal", () => {
  expect(lex("0")).toEqual({
    tokens: [t("int", "0", 0, 1, 1, { value: 0 }), eof(1, 1, 2)],
    diagnostics: [],
  });
});

test("hex with leading underscore is invalid", () => {
  expect(lex("$_a")).toEqual({
    tokens: [t("int", "$_a", 0, 1, 1, { value: 0 }), eof(3, 1, 4)],
    diagnostics: [
      d("error", "invalid-number", "Invalid hex literal", 0, 3, 1, 1),
    ],
  });
});

test("hex with trailing underscore is invalid", () => {
  expect(lex("$a_")).toEqual({
    tokens: [t("int", "$a_", 0, 1, 1, { value: 0 }), eof(3, 1, 4)],
    diagnostics: [
      d("error", "invalid-number", "Invalid hex literal", 0, 3, 1, 1),
    ],
  });
});

test("bare $ with no following hex digits is invalid", () => {
  expect(lex("$x")).toEqual({
    tokens: [
      t("int", "$", 0, 1, 1, { value: 0 }),
      t("ident", "x", 1, 1, 2),
      eof(2, 1, 3),
    ],
    diagnostics: [
      d("error", "invalid-number", "Invalid hex literal", 0, 1, 1, 1),
    ],
  });
});

test("binary with leading underscore is invalid", () => {
  expect(lex("%_1")).toEqual({
    tokens: [t("int", "%_1", 0, 1, 1, { value: 0 }), eof(3, 1, 4)],
    diagnostics: [
      d("error", "invalid-number", "Invalid binary literal", 0, 3, 1, 1),
    ],
  });
});

test("binary with trailing underscore is invalid", () => {
  expect(lex("%1_")).toEqual({
    tokens: [t("int", "%1_", 0, 1, 1, { value: 0 }), eof(3, 1, 4)],
    diagnostics: [
      d("error", "invalid-number", "Invalid binary literal", 0, 3, 1, 1),
    ],
  });
});

test("decimal with trailing underscore is invalid", () => {
  expect(lex("1_")).toEqual({
    tokens: [t("int", "1_", 0, 1, 1, { value: 0 }), eof(2, 1, 3)],
    diagnostics: [
      d("error", "invalid-number", "Invalid decimal literal", 0, 2, 1, 1),
    ],
  });
});

test("bare % not followed by binary digit lexes as punct", () => {
  expect(lex("%2")).toEqual({
    tokens: [
      t("punct", "%", 0, 1, 1, { punct: "%" }),
      t("int", "2", 1, 1, 2, { value: 2 }),
      eof(2, 1, 3),
    ],
    diagnostics: [],
  });
});
