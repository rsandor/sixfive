import type {
  Diagnostic,
  DiagnosticCode,
  DiagnosticSeverity,
} from "./diagnostic";
import type { PunctLexeme, Span, Token } from "./token";

export interface LexResult {
  tokens: Token[];
  diagnostics: Diagnostic[];
}

const SINGLE_CHAR_PUNCT: ReadonlySet<string> = new Set([
  ":",
  ",",
  "{",
  "}",
  "(",
  ")",
  "#",
  "@",
  "=",
  "+",
  "-",
  "*",
  "/",
  "%",
  "~",
  "!",
  "<",
  ">",
  "&",
  "^",
  "|",
]);

function isHexDigit(c: string): boolean {
  return (
    (c >= "0" && c <= "9") || (c >= "a" && c <= "f") || (c >= "A" && c <= "F")
  );
}

function isAsciiAlpha(c: string): boolean {
  return (c >= "A" && c <= "Z") || (c >= "a" && c <= "z");
}

function isAsciiDigit(c: string): boolean {
  return c >= "0" && c <= "9";
}

function isIdentStart(c: string): boolean {
  return isAsciiAlpha(c) || c === "_";
}

function isIdentCont(c: string): boolean {
  return isAsciiAlpha(c) || isAsciiDigit(c) || c === "_";
}

export function lex(source: string): LexResult {
  let pos = 0;
  let line = 1;
  let col = 1;
  const tokens: Token[] = [];
  const diagnostics: Diagnostic[] = [];

  type Mark = { pos: number; line: number; col: number };

  function mark(): Mark {
    return { pos, line, col };
  }

  function spanOf(start: Mark, endPos: number = pos): Span {
    return {
      start: start.pos,
      end: endPos,
      line: start.line,
      col: start.col,
    };
  }

  function pushDiag(
    severity: DiagnosticSeverity,
    code: DiagnosticCode,
    message: string,
    span: Span,
  ): void {
    diagnostics.push({ severity, code, message, span });
  }

  function lexNewline(): void {
    const start = mark();
    const c = source[pos];
    if (c === "\r") {
      pos++;
      if (source[pos] === "\n") pos++;
    } else {
      pos++;
    }
    line++;
    col = 1;
    tokens.push({
      kind: "newline",
      span: spanOf(start),
      text: source.slice(start.pos, pos),
    });
  }

  function lexWhitespace(): void {
    const start = mark();
    while (pos < source.length) {
      const c = source[pos];
      if (c === " " || c === "\t") {
        pos++;
        col++;
      } else break;
    }
    tokens.push({
      kind: "trivia",
      span: spanOf(start),
      text: source.slice(start.pos, pos),
    });
  }

  function lexLineComment(legacy: boolean): void {
    const start = mark();
    while (pos < source.length) {
      const c = source[pos];
      if (c === "\n" || c === "\r") break;
      pos++;
      col++;
    }
    const tok: Token = {
      kind: "trivia",
      span: spanOf(start),
      text: source.slice(start.pos, pos),
    };
    if (legacy) {
      tok.legacy = true;
      pushDiag(
        "warning",
        "legacy-comments",
        "Legacy `;` line comment",
        spanOf(start),
      );
    }
    tokens.push(tok);
  }

  function lexDocLine(): void {
    const start = mark();
    let endPos = pos;
    while (true) {
      pos += 3;
      col += 3;
      while (pos < source.length) {
        const c = source[pos];
        if (c === "\n" || c === "\r") break;
        pos++;
        col++;
      }
      endPos = pos;

      let look = pos;
      let lookLine = line;
      let lookCol = col;
      if (source[look] === "\r") {
        look++;
        if (source[look] === "\n") look++;
        lookLine++;
        lookCol = 1;
      } else if (source[look] === "\n") {
        look++;
        lookLine++;
        lookCol = 1;
      } else break;

      let ws = look;
      let wsCol = lookCol;
      while (source[ws] === " " || source[ws] === "\t") {
        ws++;
        wsCol++;
      }
      if (ws >= source.length || source[ws] === "\n" || source[ws] === "\r") {
        break;
      }
      if (
        source[ws] === "/" &&
        source[ws + 1] === "/" &&
        source[ws + 2] === "/" &&
        source[ws + 3] !== "/"
      ) {
        pos = ws;
        line = lookLine;
        col = wsCol;
        continue;
      }
      break;
    }
    tokens.push({
      kind: "doc-comment",
      span: spanOf(start, endPos),
      text: source.slice(start.pos, endPos),
    });
  }

  function lexBlockComment(isDoc: boolean): void {
    const start = mark();
    if (isDoc) {
      pos += 3;
      col += 3;
    } else {
      pos += 2;
      col += 2;
    }
    let depth = 1;
    while (pos < source.length && depth > 0) {
      const c = source[pos];
      if (c === "/" && source[pos + 1] === "*") {
        depth++;
        pos += 2;
        col += 2;
        continue;
      }
      if (c === "*" && source[pos + 1] === "/") {
        depth--;
        pos += 2;
        col += 2;
        continue;
      }
      if (c === "\n") {
        pos++;
        line++;
        col = 1;
        continue;
      }
      if (c === "\r") {
        pos++;
        if (source[pos] === "\n") pos++;
        line++;
        col = 1;
        continue;
      }
      pos++;
      col++;
    }
    if (depth > 0) {
      pushDiag(
        "error",
        "unterminated-block-comment",
        "Unterminated block comment",
        spanOf(start),
      );
      tokens.push({
        kind: "trivia",
        span: spanOf(start),
        text: source.slice(start.pos, pos),
      });
      return;
    }
    tokens.push({
      kind: isDoc ? "doc-comment" : "trivia",
      span: spanOf(start),
      text: source.slice(start.pos, pos),
    });
  }

  function lexHex(): void {
    const start = mark();
    pos++;
    col++;
    const runStart = pos;
    while (pos < source.length) {
      const c = source[pos];
      if (c !== undefined && (isHexDigit(c) || c === "_")) {
        pos++;
        col++;
      } else break;
    }
    const run = source.slice(runStart, pos);
    const invalid =
      run.length === 0 || run[0] === "_" || run[run.length - 1] === "_";
    let value = 0;
    if (!invalid) value = Number(`0x${run.replace(/_/g, "")}`);
    if (invalid) {
      pushDiag("error", "invalid-number", "Invalid hex literal", spanOf(start));
    }
    tokens.push({
      kind: "int",
      span: spanOf(start),
      text: source.slice(start.pos, pos),
      value,
    });
  }

  function lexBinary(): void {
    const start = mark();
    pos++;
    col++;
    const runStart = pos;
    while (pos < source.length) {
      const c = source[pos];
      if (c === "0" || c === "1" || c === "_") {
        pos++;
        col++;
      } else break;
    }
    const run = source.slice(runStart, pos);
    const invalid =
      run.length === 0 || run[0] === "_" || run[run.length - 1] === "_";
    let value = 0;
    if (!invalid) value = Number(`0b${run.replace(/_/g, "")}`);
    if (invalid) {
      pushDiag(
        "error",
        "invalid-number",
        "Invalid binary literal",
        spanOf(start),
      );
    }
    tokens.push({
      kind: "int",
      span: spanOf(start),
      text: source.slice(start.pos, pos),
      value,
    });
  }

  function lexDecimal(): void {
    const start = mark();
    while (pos < source.length) {
      const c = source[pos];
      if (c !== undefined && (isAsciiDigit(c) || c === "_")) {
        pos++;
        col++;
      } else break;
    }
    const text = source.slice(start.pos, pos);
    const invalid = text[text.length - 1] === "_";
    let value = 0;
    if (!invalid) value = Number(text.replace(/_/g, ""));
    if (invalid) {
      pushDiag(
        "error",
        "invalid-number",
        "Invalid decimal literal",
        spanOf(start),
      );
    }
    tokens.push({
      kind: "int",
      span: spanOf(start),
      text,
      value,
    });
  }

  function lexString(): void {
    const start = mark();
    pos++;
    col++;
    let decoded = "";
    while (pos < source.length) {
      const c = source[pos];
      if (c === '"') {
        pos++;
        col++;
        tokens.push({
          kind: "str",
          span: spanOf(start),
          text: source.slice(start.pos, pos),
          string: decoded,
        });
        return;
      }
      if (c === "\n" || c === "\r") {
        pushDiag(
          "error",
          "unterminated-string",
          "Unterminated string literal",
          spanOf(start),
        );
        tokens.push({
          kind: "str",
          span: spanOf(start),
          text: source.slice(start.pos, pos),
          string: decoded,
        });
        return;
      }
      if (c === "\\") {
        const escStart = mark();
        pos++;
        col++;
        if (pos >= source.length) break;
        const next = source[pos];
        if (next === "n") {
          decoded += "\n";
          pos++;
          col++;
        } else if (next === "r") {
          decoded += "\r";
          pos++;
          col++;
        } else if (next === "t") {
          decoded += "\t";
          pos++;
          col++;
        } else if (next === "0") {
          decoded += "\0";
          pos++;
          col++;
        } else if (next === "\\") {
          decoded += "\\";
          pos++;
          col++;
        } else if (next === '"') {
          decoded += '"';
          pos++;
          col++;
        } else if (next === "x") {
          pos++;
          col++;
          const h1 = source[pos];
          const h2 = source[pos + 1];
          if (
            h1 !== undefined &&
            h2 !== undefined &&
            isHexDigit(h1) &&
            isHexDigit(h2)
          ) {
            decoded += String.fromCharCode(Number.parseInt(h1 + h2, 16));
            pos += 2;
            col += 2;
          } else {
            pushDiag(
              "error",
              "invalid-escape",
              "Invalid \\xNN escape",
              spanOf(escStart),
            );
            decoded += "x";
          }
        } else if (next === "\n" || next === "\r") {
          pushDiag(
            "error",
            "invalid-escape",
            "Invalid escape before line terminator",
            spanOf(escStart),
          );
        } else if (next !== undefined) {
          decoded += next;
          pos++;
          col++;
          pushDiag(
            "error",
            "invalid-escape",
            `Invalid escape sequence \\${next}`,
            spanOf(escStart),
          );
        }
        continue;
      }
      decoded += c;
      pos++;
      col++;
    }
    pushDiag(
      "error",
      "unterminated-string",
      "Unterminated string literal at end of input",
      spanOf(start),
    );
    tokens.push({
      kind: "str",
      span: spanOf(start),
      text: source.slice(start.pos, pos),
      string: decoded,
    });
  }

  function lexIdent(): void {
    const start = mark();
    while (pos < source.length) {
      const c = source[pos];
      if (c !== undefined && isIdentCont(c)) {
        pos++;
        col++;
      } else break;
    }
    tokens.push({
      kind: "ident",
      span: spanOf(start),
      text: source.slice(start.pos, pos),
    });
  }

  function tryPunct(): boolean {
    const start = mark();
    const c = source[pos];
    if (c === undefined) return false;
    const c1 = source[pos + 1];
    const c2 = source[pos + 2];

    let lexeme: PunctLexeme | null = null;
    let len = 0;

    if (c === "." && c1 === "." && c2 === "=") {
      lexeme = "..=";
      len = 3;
    } else if (c === "." && c1 === ".") {
      lexeme = "..";
      len = 2;
    } else if (c === "<" && c1 === "<") {
      lexeme = "<<";
      len = 2;
    } else if (c === ">" && c1 === ">") {
      lexeme = ">>";
      len = 2;
    } else if (c === "<" && c1 === "=") {
      lexeme = "<=";
      len = 2;
    } else if (c === ">" && c1 === "=") {
      lexeme = ">=";
      len = 2;
    } else if (c === "=" && c1 === "=") {
      lexeme = "==";
      len = 2;
    } else if (c === "!" && c1 === "=") {
      lexeme = "!=";
      len = 2;
    } else if (c === "&" && c1 === "&") {
      lexeme = "&&";
      len = 2;
    } else if (c === "|" && c1 === "|") {
      lexeme = "||";
      len = 2;
    } else if (c === ":" && c1 === ":") {
      lexeme = "::";
      len = 2;
    } else if (SINGLE_CHAR_PUNCT.has(c)) {
      lexeme = c as PunctLexeme;
      len = 1;
    }

    if (lexeme === null) return false;
    pos += len;
    col += len;
    tokens.push({
      kind: "punct",
      span: spanOf(start),
      text: source.slice(start.pos, pos),
      punct: lexeme,
    });
    return true;
  }

  while (pos < source.length) {
    const c = source[pos];

    if (c === "\n" || c === "\r") {
      lexNewline();
      continue;
    }
    if (c === " " || c === "\t") {
      lexWhitespace();
      continue;
    }
    if (c === "/") {
      const c1 = source[pos + 1];
      const c2 = source[pos + 2];
      const c3 = source[pos + 3];
      if (c1 === "/") {
        if (c2 === "/" && c3 !== "/") {
          lexDocLine();
          continue;
        }
        lexLineComment(false);
        continue;
      }
      if (c1 === "*") {
        if (c2 === "*" && c3 !== "/" && c3 !== "*") {
          lexBlockComment(true);
          continue;
        }
        lexBlockComment(false);
        continue;
      }
      tryPunct();
      continue;
    }
    if (c === ";") {
      lexLineComment(true);
      continue;
    }
    if (c === "$") {
      lexHex();
      continue;
    }
    if (c === "%") {
      const c1 = source[pos + 1];
      if (c1 === "0" || c1 === "1" || c1 === "_") {
        lexBinary();
        continue;
      }
      tryPunct();
      continue;
    }
    if (c !== undefined && isAsciiDigit(c)) {
      lexDecimal();
      continue;
    }
    if (c === '"') {
      lexString();
      continue;
    }
    if (c !== undefined && isIdentStart(c)) {
      lexIdent();
      continue;
    }
    if (tryPunct()) continue;

    const start = mark();
    pos++;
    col++;
    pushDiag(
      "error",
      "unexpected-char",
      `Unexpected character: ${JSON.stringify(c)}`,
      spanOf(start),
    );
  }

  tokens.push({
    kind: "eof",
    span: { start: source.length, end: source.length, line, col },
    text: "",
  });

  return { tokens, diagnostics };
}
