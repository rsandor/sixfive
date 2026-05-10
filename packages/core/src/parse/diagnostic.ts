import type {
  DiagnosticSeverity,
  DiagnosticCode as LexDiagnosticCode,
} from "@sixfive/core/lex/diagnostic";
import type { Span } from "@sixfive/core/lex/token";

export type { DiagnosticSeverity };

export type ParseDiagnosticCode =
  | "unexpected-token"
  | "expected-punct"
  | "expected-ident"
  | "missing-label"
  | "indirect-outside-jmp"
  | "unknown-meta"
  | "trailing-tokens"
  | "unterminated-block"
  | "duplicate-else";

export type DiagnosticCode = LexDiagnosticCode | ParseDiagnosticCode;

export interface Diagnostic {
  severity: DiagnosticSeverity;
  code: DiagnosticCode;
  message: string;
  span: Span;
}
