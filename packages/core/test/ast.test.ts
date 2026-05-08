import { expect, test } from "bun:test";
import type { Node } from "@sixfive/core/ast";

const span = {
  start: { line: 1, col: 1, offset: 0 },
  end: { line: 1, col: 2, offset: 1 },
};

type Operand = Extract<Node, { kind: "instr" }>["operand"];

function describe(node: Node): string {
  switch (node.kind) {
    case "program":
      return `program/${node.children.length}`;
    case "label":
      return `label/${node.name}`;
    case "instr":
      return `instr/${node.mnemonic}/${node.operand.mode}`;
    case "data-byte":
      return `data-byte/${node.values.length}`;
    case "data-word":
      return `data-word/${node.values.length}`;
    case "repeat":
      return `repeat/${node.count}/${node.children.length}`;
    case "origin":
      return typeof node.address === "number"
        ? `origin/$${node.address.toString(16)}`
        : `origin/${node.address.name}`;
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
    operand: { mode: "immediate", value: 0x42 },
  };
  expect(describe(lda)).toBe("instr/lda/immediate");
  expect(
    describe({
      kind: "program",
      span,
      children: [lda],
    }),
  ).toBe("program/1");
  expect(
    describe({
      kind: "label",
      span,
      children: [],
      name: "start",
    }),
  ).toBe("label/start");
  expect(
    describe({
      kind: "data-byte",
      span,
      children: [],
      values: [1, 2, 3],
    }),
  ).toBe("data-byte/3");
  expect(
    describe({
      kind: "data-word",
      span,
      children: [],
      values: [{ name: "vec" }],
    }),
  ).toBe("data-word/1");
  expect(
    describe({
      kind: "repeat",
      span,
      count: 4,
      children: [lda],
    }),
  ).toBe("repeat/4/1");
  expect(
    describe({
      kind: "origin",
      span,
      children: [],
      address: 0xc000,
    }),
  ).toBe("origin/$c000");
  expect(
    describe({
      kind: "origin",
      span,
      children: [],
      address: { name: "reset" },
    }),
  ).toBe("origin/reset");
});

test("operand mode discriminator covers all 13 NMOS modes", () => {
  const cases: { op: Operand; bytes: number }[] = [
    { op: { mode: "implied" }, bytes: 1 },
    { op: { mode: "accumulator" }, bytes: 1 },
    { op: { mode: "immediate", value: 0 }, bytes: 2 },
    { op: { mode: "zp", value: 0 }, bytes: 2 },
    { op: { mode: "zp-x", value: 0 }, bytes: 2 },
    { op: { mode: "zp-y", value: 0 }, bytes: 2 },
    { op: { mode: "ind-x", value: 0 }, bytes: 2 },
    { op: { mode: "ind-y", value: 0 }, bytes: 2 },
    { op: { mode: "relative", target: 0 }, bytes: 2 },
    { op: { mode: "abs", value: 0 }, bytes: 3 },
    { op: { mode: "abs-x", value: 0 }, bytes: 3 },
    { op: { mode: "abs-y", value: 0 }, bytes: 3 },
    { op: { mode: "indirect", value: 0 }, bytes: 3 },
  ];
  expect(cases).toHaveLength(13);
  for (const { op, bytes } of cases) {
    expect(operandBytes(op)).toBe(bytes);
  }
});

test("leaf children type is the empty tuple, not Node[]", () => {
  type LeafKind = "label" | "instr" | "data-byte" | "data-word" | "origin";
  type LeafChildren = Extract<Node, { kind: LeafKind }>["children"];
  type ArrayWidens = [Node[]] extends [LeafChildren] ? "yes" : "no";
  // If `LeafChildren` ever drifts to `Node[]`, this assignment fails to
  // compile — forcing the test (and the type) back into alignment.
  const widens: ArrayWidens = "no";
  expect(widens).toBe("no");
});
