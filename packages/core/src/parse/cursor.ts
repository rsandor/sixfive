import type { PunctLexeme, Token } from "@sixfive/core/lex/token";
import type { Diagnostic, ParseDiagnosticCode } from "./diagnostic";
import { STATEMENT_ANCHORS } from "./keywords";

export interface Mark {
  i: number;
}

function isTrivia(t: Token): boolean {
  return t.kind === "trivia";
}

function isAnchor(t: Token): boolean {
  if (t.kind === "punct" && t.punct === "@") return true;
  if (t.kind === "ident") return STATEMENT_ANCHORS.has(t.text);
  return false;
}

// Token cursor used by every parser function. Trivia (whitespace, line
// comments, block comments) is always invisible. Newlines are visible by
// default — they terminate statements — but `peekSkippingNewlines` lets
// bracketed contexts ignore them.
export class Cursor {
  private i = 0;
  private readonly diags: Diagnostic[] = [];
  private readonly eof: Token;

  constructor(private readonly tokens: readonly Token[]) {
    const last = tokens[tokens.length - 1];
    this.eof =
      last !== undefined && last.kind === "eof"
        ? last
        : {
            kind: "eof",
            text: "",
            span: { start: 0, end: 0, line: 1, col: 1 },
          };
  }

  diagnostics(): readonly Diagnostic[] {
    return this.diags;
  }

  // Next significant token (skips trivia). Newlines and eof are visible.
  peek(): Token {
    let i = this.i;
    while (i < this.tokens.length && isTrivia(this.tokens[i] as Token)) i++;
    return this.tokens[i] ?? this.eof;
  }

  // 0-indexed lookahead: peekN(0) === peek().
  peekN(n: number): Token {
    let i = this.i;
    let remaining = n;
    while (true) {
      while (i < this.tokens.length && isTrivia(this.tokens[i] as Token)) i++;
      if (remaining === 0) return this.tokens[i] ?? this.eof;
      if (i >= this.tokens.length) return this.eof;
      i++;
      remaining--;
    }
  }

  // Used inside `(...)`/`{...}` and after a trailing `,` — newlines are
  // not statement boundaries in those contexts.
  peekSkippingNewlines(): Token {
    let i = this.i;
    while (i < this.tokens.length) {
      const t = this.tokens[i] as Token;
      if (t.kind === "trivia" || t.kind === "newline") {
        i++;
        continue;
      }
      return t;
    }
    return this.eof;
  }

  // Consume the token returned by peek().
  bump(): Token {
    while (
      this.i < this.tokens.length &&
      isTrivia(this.tokens[this.i] as Token)
    ) {
      this.i++;
    }
    if (this.i >= this.tokens.length) return this.eof;
    const t = this.tokens[this.i] as Token;
    this.i++;
    return t;
  }

  eatPunct(lexeme: PunctLexeme): boolean {
    const t = this.peek();
    if (t.kind === "punct" && t.punct === lexeme) {
      this.bump();
      return true;
    }
    return false;
  }

  eatIdent(text: string): boolean {
    const t = this.peek();
    if (t.kind === "ident" && t.text === text) {
      this.bump();
      return true;
    }
    return false;
  }

  // On match: consume, return the consumed token. On miss: emit a
  // diagnostic, do NOT consume, return the unconsumed peek (its span is
  // useful for further error context).
  expectPunct(lexeme: PunctLexeme, code: ParseDiagnosticCode): Token {
    const t = this.peek();
    if (t.kind === "punct" && t.punct === lexeme) {
      this.bump();
      return t;
    }
    this.pushDiag(code, `Expected '${lexeme}'`, t);
    return t;
  }

  expectIdent(text: string, code: ParseDiagnosticCode): Token {
    const t = this.peek();
    if (t.kind === "ident" && t.text === text) {
      this.bump();
      return t;
    }
    this.pushDiag(code, `Expected '${text}'`, t);
    return t;
  }

  atNewline(): boolean {
    return this.peek().kind === "newline";
  }

  atEof(): boolean {
    return this.peek().kind === "eof";
  }

  // Panic-mode resync. Skip until a newline followed by an anchor (or
  // eof). Leaves cursor positioned AT the anchor, ready for the next
  // statement-dispatch attempt.
  syncToStatement(): void {
    while (!this.atEof()) {
      if (this.peek().kind === "newline") {
        this.bump();
        const next = this.peek();
        if (next.kind === "eof" || isAnchor(next)) return;
        continue;
      }
      this.bump();
    }
  }

  mark(): Mark {
    return { i: this.i };
  }

  reset(m: Mark): void {
    this.i = m.i;
  }

  private pushDiag(
    code: ParseDiagnosticCode,
    message: string,
    at: Token,
  ): void {
    this.diags.push({
      severity: "error",
      code,
      message,
      span: at.span,
    });
  }
}
