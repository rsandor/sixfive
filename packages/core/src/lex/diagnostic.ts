import type { Span } from "./token";

export type DiagnosticSeverity = "error" | "warning";

export type DiagnosticCode =
  | "legacy-comments"
  | "unterminated-string"
  | "unterminated-block-comment"
  | "invalid-escape"
  | "invalid-number"
  | "unexpected-char";

export interface Diagnostic {
  severity: DiagnosticSeverity;
  code: DiagnosticCode;
  message: string;
  span: Span;
}
