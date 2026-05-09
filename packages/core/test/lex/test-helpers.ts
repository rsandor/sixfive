import type {
  Diagnostic,
  DiagnosticCode,
  DiagnosticSeverity,
} from "@sixfive/core/lex/diagnostic";
import type { PunctLexeme, Token, TokenKind } from "@sixfive/core/lex/token";

interface Extras {
  value?: number;
  string?: string;
  punct?: PunctLexeme;
  legacy?: boolean;
}

export function t(
  kind: TokenKind,
  text: string,
  start: number,
  line: number,
  col: number,
  extras?: Extras,
): Token {
  const tok: Token = {
    kind,
    span: { start, end: start + text.length, line, col },
    text,
  };
  if (extras?.value !== undefined) tok.value = extras.value;
  if (extras?.string !== undefined) tok.string = extras.string;
  if (extras?.punct !== undefined) tok.punct = extras.punct;
  if (extras?.legacy !== undefined) tok.legacy = extras.legacy;
  return tok;
}

export function eof(start: number, line: number, col: number): Token {
  return {
    kind: "eof",
    span: { start, end: start, line, col },
    text: "",
  };
}

export function d(
  severity: DiagnosticSeverity,
  code: DiagnosticCode,
  message: string,
  start: number,
  end: number,
  line: number,
  col: number,
): Diagnostic {
  return {
    severity,
    code,
    message,
    span: { start, end, line, col },
  };
}
