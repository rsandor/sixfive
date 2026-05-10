import { expect, test } from "bun:test";
import { lex } from "@sixfive/core/lex";
import { Cursor } from "@sixfive/core/parse/cursor";

function cur(src: string): Cursor {
  return new Cursor(lex(src).tokens);
}

test("peek skips trivia and returns the next significant token", () => {
  const c = cur("   foo");
  expect(c.peek().text).toBe("foo");
});

test("peek keeps newlines visible", () => {
  const c = cur("foo\nbar");
  c.bump();
  expect(c.peek().kind).toBe("newline");
});

test("peek returns eof at end of input", () => {
  const c = cur("");
  expect(c.peek().kind).toBe("eof");
  c.bump();
  expect(c.peek().kind).toBe("eof");
});

test("bump advances past trivia then one significant token", () => {
  const c = cur("  foo  bar");
  c.bump();
  expect(c.peek().text).toBe("bar");
});

test("peekN looks ahead by N significant tokens without advancing", () => {
  const c = cur("a b c d");
  expect(c.peekN(0).text).toBe("a");
  expect(c.peekN(1).text).toBe("b");
  expect(c.peekN(2).text).toBe("c");
  expect(c.peekN(3).text).toBe("d");
  expect(c.peek().text).toBe("a");
});

test("peekN past end returns eof", () => {
  const c = cur("a b");
  expect(c.peekN(5).kind).toBe("eof");
});

test("peekSkippingNewlines skips newlines but does not advance", () => {
  const c = cur("foo\n\n   bar");
  c.bump();
  expect(c.peek().kind).toBe("newline");
  expect(c.peekSkippingNewlines().text).toBe("bar");
  expect(c.peek().kind).toBe("newline");
});

test("eatPunct: true and consume on match, false and hold on miss", () => {
  const c = cur(",foo");
  expect(c.eatPunct(",")).toBe(true);
  expect(c.peek().text).toBe("foo");
  expect(c.eatPunct(",")).toBe(false);
  expect(c.peek().text).toBe("foo");
});

test("eatIdent matches by exact text", () => {
  const c = cur("proc bar");
  expect(c.eatIdent("macro")).toBe(false);
  expect(c.eatIdent("proc")).toBe(true);
  expect(c.peek().text).toBe("bar");
});

test("expectPunct on miss emits diagnostic, does not consume", () => {
  const c = cur("foo");
  c.expectPunct(",", "expected-punct");
  expect(c.peek().text).toBe("foo");
  const diags = c.diagnostics();
  expect(diags.length).toBe(1);
  expect(diags[0]?.code).toBe("expected-punct");
  expect(diags[0]?.severity).toBe("error");
});

test("expectPunct on match consumes and emits no diagnostic", () => {
  const c = cur(",rest");
  c.expectPunct(",", "expected-punct");
  expect(c.peek().text).toBe("rest");
  expect(c.diagnostics().length).toBe(0);
});

test("expectIdent: same contract as expectPunct", () => {
  const ok = cur("proc rest");
  ok.expectIdent("proc", "expected-ident");
  expect(ok.peek().text).toBe("rest");
  expect(ok.diagnostics().length).toBe(0);

  const miss = cur("foo");
  miss.expectIdent("proc", "expected-ident");
  expect(miss.peek().text).toBe("foo");
  expect(miss.diagnostics().length).toBe(1);
});

test("syncToStatement lands on the next anchor keyword", () => {
  const c = cur("garbage tokens here\nproc reset { }");
  c.syncToStatement();
  expect(c.peek().text).toBe("proc");
});

test("syncToStatement lands on @ meta marker after a newline", () => {
  const c = cur("x y z\n@cpu 6502");
  c.syncToStatement();
  const t = c.peek();
  expect(t.kind).toBe("punct");
  if (t.kind === "punct") expect(t.punct).toBe("@");
});

test("syncToStatement walks past mid-statement junk to the next anchor", () => {
  const c = cur("LDA #5 ?? bogus\n  blah\nfor i in 0..4 { }");
  c.syncToStatement();
  expect(c.peek().text).toBe("for");
});

test("syncToStatement runs to eof when no anchor follows", () => {
  const c = cur("just garbage here\n   more garbage");
  c.syncToStatement();
  expect(c.atEof()).toBe(true);
});

test("syncToStatement ignores ident tokens that aren't anchors", () => {
  // `byte` is a keyword but not a statement anchor (data decls require a
  // leading label, so the label is the anchor). Sync should not stop on
  // a bare `byte` line.
  const c = cur("err\nbyte 1, 2\nproc x { }");
  c.syncToStatement();
  expect(c.peek().text).toBe("proc");
});

test("mark/reset round-trips position", () => {
  const c = cur("a b c");
  c.bump();
  const m = c.mark();
  c.bump();
  expect(c.peek().text).toBe("c");
  c.reset(m);
  expect(c.peek().text).toBe("b");
});

test("atNewline / atEof reflect peek classification", () => {
  const c = cur("a\nb");
  expect(c.atNewline()).toBe(false);
  expect(c.atEof()).toBe(false);
  c.bump();
  expect(c.atNewline()).toBe(true);
  c.bump();
  c.bump();
  expect(c.atEof()).toBe(true);
});

test("constructor synthesizes eof if the token stream lacks one", () => {
  // Bypass lex(); construct a Cursor over a tokens-without-eof array.
  const c = new Cursor([]);
  expect(c.peek().kind).toBe("eof");
  expect(c.atEof()).toBe(true);
});
