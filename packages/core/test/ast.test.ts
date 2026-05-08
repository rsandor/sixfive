import { expect, test } from "bun:test";
import type { Node } from "@sixfive/core/ast";

const zero = { line: 0, col: 0, offset: 0 };
const span = { start: zero, end: zero };

test("leaves carry empty children", () => {
  const leaves: Node[] = [
    { kind: "label", span, children: [], name: "start" },
    {
      kind: "instruction",
      span,
      children: [],
      mnemonic: "nop",
      operand: { mode: "implied" },
    },
    { kind: "data-byte", span, children: [], values: [0x01, 0x02] },
    { kind: "data-word", span, children: [], values: [{ name: "vec" }] },
    { kind: "origin", span, children: [], address: 0x0600 },
  ];

  for (const leaf of leaves) {
    expect(leaf.children).toEqual([]);
    expect(leaf.children.length).toBe(0);
  }
});
