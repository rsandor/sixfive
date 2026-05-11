import { expect, test } from "bun:test";
import type { Expr, Node } from "@sixfive/core/ast";

const span = {
  start: { line: 1, col: 1, offset: 0 },
  end: { line: 1, col: 2, offset: 1 },
};

const zero: Expr = { kind: "lit-int", span, value: 0 };

type Operand = Extract<Node, { kind: "instr" }>["operand"];

function describeExpr(e: Expr): string {
  switch (e.kind) {
    case "lit-int":
      return `lit-int/${e.value}`;
    case "lit-str":
      return `lit-str/${e.value}`;
    case "ref":
      return `ref/${e.name}`;
    case "unary":
      return `unary/${e.op}`;
    case "binary":
      return `binary/${e.op}`;
    case "call":
      return `call/${e.callee}/${e.args.length}`;
    case "paren":
      return "paren";
    case "range":
      return `range/${e.inclusive ? "incl" : "excl"}`;
  }
}

function describe(node: Node): string {
  switch (node.kind) {
    case "program":
      return `program/${node.children.length}`;
    case "label":
      return `label/${node.name}`;
    case "instr":
      return `instr/${node.mnemonic}/${node.operand.mode}`;
    case "data-byte":
      return `data-byte/${node.label}/${node.values.length}`;
    case "data-word":
      return `data-word/${node.label}/${node.values.length}`;
    case "data-ascii":
      return `data-ascii/${node.label}/${node.parts.length}`;
    case "data-res":
      return `data-res/${node.label}`;
    case "data-fill":
      return `data-fill/${node.label}`;
    case "const-decl":
      return `const-decl/${node.name}`;
    case "section":
      return `section/${node.name}`;
    case "origin":
      return `origin/${describeExpr(node.address)}`;
    case "proc":
      return `proc/${node.name}/${node.children.length}`;
    case "macro":
      return `macro/${node.name}/${node.params.length}/${node.children.length}`;
    case "if":
      return `if/${node.thenBranch.length}/${node.elseBranch?.length ?? 0}`;
    case "repeat":
      return `repeat/${node.children.length}`;
    case "for":
      return `for/${node.binder}/${node.children.length}`;
    case "meta":
      return `meta/${node.name}/${node.args.length}`;
    case "call-stmt":
      return `call-stmt/${node.callee}/${node.args.length}`;
  }
}

function operandBytes(operand: Operand): number {
  switch (operand.mode) {
    case "implied":
    case "accumulator":
      return 1;
    case "immediate":
    case "zp":
    case "zp-x":
    case "zp-y":
    case "ind-x":
    case "ind-y":
    case "relative":
      return 2;
    case "abs":
    case "abs-x":
    case "abs-y":
    case "indirect":
      return 3;
  }
}

test("kind discriminator narrows each variant", () => {
  const lda: Node = {
    kind: "instr",
    span,
    children: [],
    mnemonic: "lda",
    operand: {
      mode: "immediate",
      value: { kind: "lit-int", span, value: 0x42 },
    },
  };
  expect(describe(lda)).toBe("instr/lda/immediate");
  expect(describe({ kind: "program", span, children: [lda] })).toBe(
    "program/1",
  );
  expect(describe({ kind: "label", span, children: [], name: "start" })).toBe(
    "label/start",
  );
  expect(
    describe({
      kind: "data-byte",
      span,
      children: [],
      label: "table",
      values: [zero, zero, zero],
    }),
  ).toBe("data-byte/table/3");
  expect(
    describe({
      kind: "data-word",
      span,
      children: [],
      label: "vec",
      values: [{ kind: "ref", span, name: "target" }],
    }),
  ).toBe("data-word/vec/1");
  expect(
    describe({
      kind: "data-ascii",
      span,
      children: [],
      label: "msg",
      parts: [{ kind: "lit-str", span, value: "hi" }, zero],
    }),
  ).toBe("data-ascii/msg/2");
  expect(
    describe({
      kind: "data-res",
      span,
      children: [],
      label: "buf",
      count: zero,
    }),
  ).toBe("data-res/buf");
  expect(
    describe({
      kind: "data-fill",
      span,
      children: [],
      label: "pad",
      count: zero,
      value: zero,
    }),
  ).toBe("data-fill/pad");
  expect(
    describe({
      kind: "const-decl",
      span,
      children: [],
      name: "DEBUG",
      value: zero,
    }),
  ).toBe("const-decl/DEBUG");
  expect(describe({ kind: "section", span, children: [], name: "code" })).toBe(
    "section/code",
  );
  expect(
    describe({
      kind: "origin",
      span,
      children: [],
      address: { kind: "lit-int", span, value: 0xc000 },
    }),
  ).toBe("origin/lit-int/49152");
  expect(describe({ kind: "proc", span, children: [lda], name: "reset" })).toBe(
    "proc/reset/1",
  );
  expect(
    describe({
      kind: "macro",
      span,
      children: [lda],
      name: "SetPtr",
      params: ["addr"],
    }),
  ).toBe("macro/SetPtr/1/1");
  expect(
    describe({
      kind: "if",
      span,
      cond: zero,
      thenBranch: [lda],
      elseBranch: [lda, lda],
    }),
  ).toBe("if/1/2");
  expect(describe({ kind: "if", span, cond: zero, thenBranch: [lda] })).toBe(
    "if/1/0",
  );
  expect(
    describe({
      kind: "repeat",
      span,
      children: [lda],
      count: zero,
    }),
  ).toBe("repeat/1");
  expect(
    describe({
      kind: "for",
      span,
      children: [lda],
      binder: "i",
      range: { kind: "range", span, lo: zero, hi: zero, inclusive: false },
    }),
  ).toBe("for/i/1");
  expect(
    describe({
      kind: "meta",
      span,
      children: [],
      name: "cpu",
      args: [zero],
    }),
  ).toBe("meta/cpu/1");
  expect(
    describe({
      kind: "call-stmt",
      span,
      children: [],
      callee: "StoreImm",
      args: [zero, { kind: "ref", span, name: "counter" }],
    }),
  ).toBe("call-stmt/StoreImm/2");
});

test("expr kind discriminator narrows each variant", () => {
  const cases: { e: Expr; expected: string }[] = [
    { e: { kind: "lit-int", span, value: 42 }, expected: "lit-int/42" },
    { e: { kind: "lit-str", span, value: "hi" }, expected: "lit-str/hi" },
    { e: { kind: "ref", span, name: "x" }, expected: "ref/x" },
    { e: { kind: "unary", span, op: "-", rhs: zero }, expected: "unary/-" },
    {
      e: { kind: "binary", span, op: "+", lhs: zero, rhs: zero },
      expected: "binary/+",
    },
    {
      e: { kind: "call", span, callee: "low", args: [zero] },
      expected: "call/low/1",
    },
    { e: { kind: "paren", span, inner: zero }, expected: "paren" },
    {
      e: { kind: "range", span, lo: zero, hi: zero, inclusive: true },
      expected: "range/incl",
    },
  ];
  for (const { e, expected } of cases) {
    expect(describeExpr(e)).toBe(expected);
  }
});

test("operand mode discriminator covers all 13 NMOS modes", () => {
  const cases: { op: Operand; bytes: number }[] = [
    { op: { mode: "implied" }, bytes: 1 },
    { op: { mode: "accumulator" }, bytes: 1 },
    { op: { mode: "immediate", value: zero }, bytes: 2 },
    { op: { mode: "zp", value: zero }, bytes: 2 },
    { op: { mode: "zp-x", value: zero }, bytes: 2 },
    { op: { mode: "zp-y", value: zero }, bytes: 2 },
    { op: { mode: "ind-x", value: zero }, bytes: 2 },
    { op: { mode: "ind-y", value: zero }, bytes: 2 },
    { op: { mode: "relative", target: zero }, bytes: 2 },
    { op: { mode: "abs", value: zero }, bytes: 3 },
    { op: { mode: "abs-x", value: zero }, bytes: 3 },
    { op: { mode: "abs-y", value: zero }, bytes: 3 },
    { op: { mode: "indirect", value: zero }, bytes: 3 },
  ];
  for (const { op, bytes } of cases) {
    expect(operandBytes(op)).toBe(bytes);
  }
});

test("leaf children type is the empty tuple, not Node[]", () => {
  type LeafKind =
    | "label"
    | "instr"
    | "data-byte"
    | "data-word"
    | "data-ascii"
    | "data-res"
    | "data-fill"
    | "const-decl"
    | "section"
    | "origin"
    | "meta"
    | "call-stmt";
  type LeafChildren = Extract<Node, { kind: LeafKind }>["children"];
  type ArrayWidens = [Node[]] extends [LeafChildren] ? "yes" : "no";
  // If `LeafChildren` ever drifts to `Node[]`, this assignment fails to
  // compile — forcing the test (and the type) back into alignment.
  const widens: ArrayWidens = "no";
  expect(widens).toBe("no");
});
