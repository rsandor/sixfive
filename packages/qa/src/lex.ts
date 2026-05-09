#!/usr/bin/env bun
import { lex } from "@sixfive/core/lex";
import type { Diagnostic } from "@sixfive/core/lex/diagnostic";
import type { Token } from "@sixfive/core/lex/token";

const args = process.argv.slice(2);
if (args.length !== 1) {
  console.error("usage: qa-lex <file>");
  process.exit(2);
}

const path = args[0] as string;

let source: string;
try {
  source = await Bun.file(path).text();
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`qa-lex: cannot read ${path}: ${msg}`);
  process.exit(2);
}

const { tokens, diagnostics } = lex(source);

const useColor = process.stdout.isTTY === true;
const RESET = "\x1b[0m";
const ansi = (code: string, s: string): string =>
  useColor ? `\x1b[${code}m${s}${RESET}` : s;

const errors = diagnostics.filter((d) => d.severity === "error");
if (errors.length > 0) {
  for (const d of errors) {
    const loc = `${path}:${d.span.line}:${d.span.col}`;
    const head = ansi("31;1", "error");
    const code = ansi("90", `[${d.code}]`);
    console.error(`${loc}: ${head}${code}: ${d.message}`);
  }
  process.exit(1);
}

const warningsByStart = new Map<number, Diagnostic>();
for (const d of diagnostics) {
  if (d.severity === "warning") warningsByStart.set(d.span.start, d);
}

type Classified = { label: string; color: string | null };

function classify(tok: Token): Classified | null {
  switch (tok.kind) {
    case "ident":
      return { label: "IDENT", color: "36" };
    case "int":
      return { label: "INT", color: "33" };
    case "str":
      return { label: "STR", color: "32" };
    case "punct":
      return { label: "PUNCT", color: "90" };
    case "doc-comment":
      return { label: "DOC", color: "35" };
    case "trivia": {
      const t = tok.text;
      if (t.startsWith("//") || t.startsWith("/*") || t.startsWith(";")) {
        return { label: "COMMENT", color: "90" };
      }
      return null;
    }
    case "newline":
      return null;
    case "eof":
      return { label: "EOF", color: "1" };
  }
}

function escapeForDisplay(s: string): string {
  let out = "";
  for (const ch of s) {
    if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else out += ch;
  }
  return out;
}

function decodedSuffix(tok: Token): string | null {
  if (tok.kind === "int") {
    const v = tok.value ?? 0;
    const hex = `0x${v.toString(16).toUpperCase()}`;
    const dec = String(v);
    if (tok.text.startsWith("$")) return `→ ${dec}`;
    if (tok.text.startsWith("%")) return `→ ${dec} (${hex})`;
    return `→ ${hex}`;
  }
  if (tok.kind === "str") {
    const decoded = tok.string ?? "";
    const closed = tok.text.endsWith('"') && tok.text.length >= 2;
    const inner = tok.text.slice(1, closed ? -1 : tok.text.length);
    if (decoded !== inner) return `→ ${JSON.stringify(decoded)}`;
    return null;
  }
  return null;
}

type Row = { tok: Token; label: string; color: string | null; lexeme: string };

const rows: Row[] = [];
let eofRow: Row | null = null;
for (const tok of tokens) {
  const c = classify(tok);
  if (c === null) continue;
  const lexeme = tok.kind === "eof" ? "" : escapeForDisplay(tok.text);
  const row: Row = { tok, label: c.label, color: c.color, lexeme };
  if (tok.kind === "eof") eofRow = row;
  else rows.push(row);
}

const labelWidth = Math.max(
  ...rows.map((r) => r.label.length),
  eofRow ? eofRow.label.length : 0,
);

const byLine = new Map<number, Row[]>();
for (const r of rows) {
  const ln = r.tok.span.line;
  let arr = byLine.get(ln);
  if (arr === undefined) {
    arr = [];
    byLine.set(ln, arr);
  }
  arr.push(r);
}

const sortedLines = [...byLine.keys()].sort((a, b) => a - b);

for (const ln of sortedLines) {
  const group = byLine.get(ln) as Row[];
  const lexWidth = Math.max(...group.map((r) => r.lexeme.length));
  console.log(ansi("1", `L${ln}:`));
  for (const r of group) {
    const labelText = r.label.padEnd(labelWidth);
    const labelStr = r.color ? ansi(r.color, labelText) : labelText;
    const lexStr = r.lexeme.padEnd(lexWidth);
    const pos = `${r.tok.span.line}:${r.tok.span.col}`;
    const dec = decodedSuffix(r.tok);
    const decStr = dec ? `  ${ansi("90", dec)}` : "";
    const warn = warningsByStart.get(r.tok.span.start);
    const warnStr = warn ? `  ${ansi("33", `! ${warn.code}`)}` : "";
    console.log(`  ${labelStr}  ${lexStr}  ${pos}${decStr}${warnStr}`);
  }
}

if (eofRow) {
  const labelText = eofRow.label.padEnd(labelWidth);
  const labelStr = eofRow.color ? ansi(eofRow.color, labelText) : labelText;
  const pos = `${eofRow.tok.span.line}:${eofRow.tok.span.col}`;
  console.log(`${labelStr}  ${pos}`);
}
