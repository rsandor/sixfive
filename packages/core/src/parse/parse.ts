import type { Node } from "@sixfive/core/ast";
import type { Token } from "@sixfive/core/lex/token";
import type { Diagnostic } from "@sixfive/core/parse/diagnostic";

export interface ParseResult {
  program: Extract<Node, { kind: "program" }>;
  diagnostics: Diagnostic[];
}

// Stub. Returns an empty Program spanning the input. Replaced by the real
// parser once stmt/expr/operand modules land.
export function parse(tokens: Token[]): ParseResult {
  const first = tokens[0];
  const last = tokens[tokens.length - 1] ?? first;
  const start = first
    ? { line: first.span.line, col: first.span.col, offset: first.span.start }
    : { line: 1, col: 1, offset: 0 };
  const end = last
    ? { line: last.span.line, col: last.span.col, offset: last.span.end }
    : start;
  return {
    program: {
      kind: "program",
      span: { start, end },
      children: [],
    },
    diagnostics: [],
  };
}
