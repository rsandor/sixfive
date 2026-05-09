export type TokenKind =
  | "ident"
  | "int"
  | "str"
  | "doc-comment"
  | "punct"
  | "newline"
  | "trivia"
  | "eof";

export type PunctLexeme =
  | ":"
  | ","
  | "{"
  | "}"
  | "("
  | ")"
  | "#"
  | "@"
  | "="
  | ".."
  | "..="
  | "+"
  | "-"
  | "*"
  | "/"
  | "%"
  | "~"
  | "!"
  | "<<"
  | ">>"
  | "<"
  | "<="
  | ">"
  | ">="
  | "=="
  | "!="
  | "&"
  | "^"
  | "|"
  | "&&"
  | "||";

export interface Span {
  start: number;
  end: number;
  line: number;
  col: number;
}

export interface Token {
  kind: TokenKind;
  span: Span;
  text: string;
  value?: number;
  string?: string;
  punct?: PunctLexeme;
  legacy?: boolean;
}
