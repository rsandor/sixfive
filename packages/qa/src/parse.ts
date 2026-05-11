#!/usr/bin/env bun
import type { Expr, Node, Operand } from "@sixfive/core/ast";
import { lex } from "@sixfive/core/lex";
import { parse } from "@sixfive/core/parse";
import type { Diagnostic as ParseDiagnostic } from "@sixfive/core/parse/diagnostic";

const usage = (): void => {
  console.error("usage: qa-parse [--spans] [--docs] <file>");
};

const argv = process.argv.slice(2);
let showSpans = false;
let showDocs = false;
let sourcePath: string | null = null;
for (const argument of argv) {
  if (argument === "--spans") {
    showSpans = true;
  } else if (argument === "--docs") {
    showDocs = true;
  } else if (sourcePath === null) {
    sourcePath = argument;
  } else {
    usage();
    process.exit(2);
  }
}
if (sourcePath === null) {
  usage();
  process.exit(2);
}

let source: string;
try {
  source = await Bun.file(sourcePath).text();
} catch (e) {
  const message = e instanceof Error ? e.message : String(e);
  console.error(`qa-parse: cannot read ${sourcePath}: ${message}`);
  process.exit(2);
}

const useColor = process.stdout.isTTY === true;
const RESET = "\x1b[0m";
const ansi = (code: string, text: string): string =>
  useColor ? `\x1b[${code}m${text}${RESET}` : text;

const COLOR = {
  statement: "36",
  data: "32",
  expression: "33",
  meta: "35",
  structure: "1",
  name: "1;36",
  dim: "90",
  error: "31;1",
  warning: "33",
};

const BRANCH_MID = "├─ ";
const BRANCH_LAST = "└─ ";
const INDENT_THROUGH = "│  ";
const INDENT_BLANK = "   ";
const RIGHT_COLUMN = 50;

const { tokens, diagnostics: lexDiagnostics } = lex(source);
const lexErrors = lexDiagnostics.filter((d) => d.severity === "error");
if (lexErrors.length > 0) {
  for (const d of lexErrors) {
    const location = `${sourcePath}:${d.span.line}:${d.span.col}`;
    const head = ansi(COLOR.error, "error");
    const code = ansi(COLOR.dim, `[${d.code}]`);
    console.error(`${location}: ${head}${code}: ${d.message}`);
  }
  process.exit(1);
}

const { program, diagnostics: parseDiagnostics } = parse(tokens);

const warningsByOffset = new Map<number, ParseDiagnostic>();
for (const d of parseDiagnostics) {
  if (d.severity === "warning") warningsByOffset.set(d.span.start, d);
}

type ASTSpan = Node["span"];

const slice = (span: ASTSpan): string =>
  source.slice(span.start.offset, span.end.offset);

const lineMark = (span: ASTSpan): string => {
  if (showSpans) {
    return ansi(
      COLOR.dim,
      `L${span.start.line}:${span.start.col}→L${span.end.line}:${span.end.col}`,
    );
  }
  return ansi(COLOR.dim, `L${span.start.line}`);
};

const ANSI_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");
const visibleLength = (s: string): number => s.replace(ANSI_PATTERN, "").length;

const eachWithLast = <T>(
  items: T[],
  visit: (item: T, isLast: boolean) => void,
): void => {
  for (let i = 0; i < items.length; i++) {
    visit(items[i] as T, i === items.length - 1);
  }
};

const printLine = (
  prefix: string,
  branch: string,
  body: string,
  mark: string,
  warning?: ParseDiagnostic,
): void => {
  const left = `${prefix}${branch}${body}`;
  const padLength =
    mark === "" ? 0 : Math.max(2, RIGHT_COLUMN - visibleLength(left));
  const pad = " ".repeat(padLength);
  const warningSuffix = warning
    ? `  ${ansi(COLOR.warning, `! ${warning.code}`)}`
    : "";
  console.log(`${left}${pad}${mark}${warningSuffix}`);
};

const expressionInline = (e: Expr): string | null => {
  switch (e.kind) {
    case "lit-int": {
      const text = slice(e.span);
      const decimal = String(e.value);
      const hex = `0x${e.value.toString(16).toUpperCase()}`;
      let suffix: string;
      if (text.startsWith("$")) suffix = `→ ${decimal}`;
      else if (text.startsWith("%")) suffix = `→ ${decimal} (${hex})`;
      else suffix = `→ ${hex}`;
      const tag = ansi(COLOR.expression, "lit-int");
      return `${tag} ${text} ${ansi(COLOR.dim, suffix)}`;
    }
    case "lit-str": {
      const text = slice(e.span);
      const decoded = e.value;
      const closed = text.endsWith('"') && text.length >= 2;
      const inner = text.slice(1, closed ? -1 : text.length);
      const tag = ansi(COLOR.expression, "lit-str");
      if (decoded !== inner) {
        const suffix = ansi(COLOR.dim, `→ ${JSON.stringify(decoded)}`);
        return `${tag} ${text} ${suffix}`;
      }
      return `${tag} ${text}`;
    }
    case "ref":
      return `${ansi(COLOR.expression, "ref")} ${ansi(COLOR.name, e.name)}`;
    default:
      return null;
  }
};

const renderExpression = (e: Expr, prefix: string, isLast: boolean): void => {
  const branch = isLast ? BRANCH_LAST : BRANCH_MID;
  const childPrefix = prefix + (isLast ? INDENT_BLANK : INDENT_THROUGH);
  const inline = expressionInline(e);
  const mark = lineMark(e.span);
  const warning = warningsByOffset.get(e.span.start.offset);

  if (inline !== null) {
    printLine(prefix, branch, inline, mark, warning);
    return;
  }
  switch (e.kind) {
    case "unary":
      printLine(
        prefix,
        branch,
        `${ansi(COLOR.expression, "unary")} ${e.op}`,
        mark,
        warning,
      );
      renderExpression(e.rhs, childPrefix, true);
      return;
    case "binary":
      printLine(
        prefix,
        branch,
        `${ansi(COLOR.expression, "binary")} ${e.op}`,
        mark,
        warning,
      );
      renderExpression(e.lhs, childPrefix, false);
      renderExpression(e.rhs, childPrefix, true);
      return;
    case "call":
      printLine(
        prefix,
        branch,
        `${ansi(COLOR.expression, "call")} ${ansi(COLOR.name, e.callee)}`,
        mark,
        warning,
      );
      eachWithLast(e.args, (argument, last) =>
        renderExpression(argument, childPrefix, last),
      );
      return;
    case "paren":
      printLine(prefix, branch, ansi(COLOR.expression, "paren"), mark, warning);
      renderExpression(e.inner, childPrefix, true);
      return;
    case "range":
      printLine(
        prefix,
        branch,
        `${ansi(COLOR.expression, "range")} ${e.inclusive ? "..=" : ".."}`,
        mark,
        warning,
      );
      renderExpression(e.lo, childPrefix, false);
      renderExpression(e.hi, childPrefix, true);
      return;
    case "lit-int":
    case "lit-str":
    case "ref":
      throw new Error("unreachable: trivial leaf handled inline");
  }
};

type Sigil = { prefix: string; suffix: string };
const SIGIL: Record<Operand["mode"], Sigil> = {
  implied: { prefix: "", suffix: "" },
  accumulator: { prefix: "", suffix: "" },
  immediate: { prefix: "#", suffix: "" },
  zp: { prefix: "", suffix: "" },
  "zp-x": { prefix: "", suffix: ",X" },
  "zp-y": { prefix: "", suffix: ",Y" },
  abs: { prefix: "", suffix: "" },
  "abs-x": { prefix: "", suffix: ",X" },
  "abs-y": { prefix: "", suffix: ",Y" },
  indirect: { prefix: "(", suffix: ")" },
  "ind-x": { prefix: "(", suffix: ",X)" },
  "ind-y": { prefix: "(", suffix: "),Y" },
  relative: { prefix: "", suffix: "" },
};

const operandValue = (op: Operand): Expr | null => {
  switch (op.mode) {
    case "implied":
    case "accumulator":
      return null;
    case "relative":
      return op.target;
    default:
      return op.value;
  }
};

const operandLeafText = (e: Expr): string => {
  switch (e.kind) {
    case "lit-int": {
      const text = slice(e.span);
      const decimal = String(e.value);
      const hex = `0x${e.value.toString(16).toUpperCase()}`;
      let suffix: string;
      if (text.startsWith("$")) suffix = `→ ${decimal}`;
      else if (text.startsWith("%")) suffix = `→ ${decimal} (${hex})`;
      else suffix = `→ ${hex}`;
      return `${text} ${ansi(COLOR.dim, suffix)}`;
    }
    case "lit-str":
      return slice(e.span);
    case "ref":
      return ansi(COLOR.name, e.name);
    default:
      throw new Error("unreachable: not a trivial leaf");
  }
};

const renderInstruction = (
  node: Extract<Node, { kind: "instr" }>,
  prefix: string,
  isLast: boolean,
): void => {
  const branch = isLast ? BRANCH_LAST : BRANCH_MID;
  const childPrefix = prefix + (isLast ? INDENT_BLANK : INDENT_THROUGH);
  const mnemonic = ansi(COLOR.statement, node.mnemonic);
  const op = node.operand;
  const mark = lineMark(node.span);
  const warning = warningsByOffset.get(node.span.start.offset);

  if (op.mode === "implied") {
    printLine(
      prefix,
      branch,
      `${mnemonic} ${ansi(COLOR.dim, "implied")}`,
      mark,
      warning,
    );
    return;
  }
  if (op.mode === "accumulator") {
    printLine(
      prefix,
      branch,
      `${mnemonic} A ${ansi(COLOR.dim, "accumulator")}`,
      mark,
      warning,
    );
    return;
  }
  const value = operandValue(op);
  if (value === null) return;
  const inline = expressionInline(value);
  if (inline !== null) {
    const leaf = operandLeafText(value);
    const sigil = SIGIL[op.mode];
    printLine(
      prefix,
      branch,
      `${mnemonic} ${sigil.prefix}${leaf}${sigil.suffix}`,
      mark,
      warning,
    );
    return;
  }
  printLine(
    prefix,
    branch,
    `${mnemonic} ${ansi(COLOR.dim, op.mode)}`,
    mark,
    warning,
  );
  renderExpression(value, childPrefix, true);
};

const renderDocumentation = (
  doc: string,
  prefix: string,
  isLast: boolean,
): void => {
  const branch = isLast ? BRANCH_LAST : BRANCH_MID;
  const oneLine = doc.replace(/\s+/g, " ").trim();
  const truncated =
    oneLine.length > 60 ? `${oneLine.slice(0, 57)}...` : oneLine;
  printLine(
    prefix,
    branch,
    `${ansi(COLOR.dim, "doc")} ${ansi(COLOR.dim, JSON.stringify(truncated))}`,
    "",
  );
};

const renderSlotHeader = (
  prefix: string,
  branch: string,
  label: string,
): void => {
  printLine(prefix, branch, ansi(COLOR.dim, label), "");
};

const renderNode = (node: Node, prefix: string, isLast: boolean): void => {
  const branch = isLast ? BRANCH_LAST : BRANCH_MID;
  const childPrefix = prefix + (isLast ? INDENT_BLANK : INDENT_THROUGH);
  const mark = lineMark(node.span);
  const warning = warningsByOffset.get(node.span.start.offset);

  switch (node.kind) {
    case "program":
      throw new Error("unreachable: program is the root");

    case "label":
      printLine(
        prefix,
        branch,
        `${ansi(COLOR.statement, "label")} «${ansi(COLOR.name, node.name)}»`,
        mark,
        warning,
      );
      return;

    case "instr":
      renderInstruction(node, prefix, isLast);
      return;

    case "data-byte":
    case "data-word": {
      printLine(
        prefix,
        branch,
        `${ansi(COLOR.data, node.kind)} «${ansi(COLOR.name, node.label)}»`,
        mark,
        warning,
      );
      eachWithLast(node.values, (v, last) =>
        renderExpression(v, childPrefix, last),
      );
      return;
    }

    case "data-ascii": {
      printLine(
        prefix,
        branch,
        `${ansi(COLOR.data, "data-ascii")} «${ansi(COLOR.name, node.label)}»`,
        mark,
        warning,
      );
      eachWithLast(node.parts, (p, last) =>
        renderExpression(p, childPrefix, last),
      );
      return;
    }

    case "data-res":
      printLine(
        prefix,
        branch,
        `${ansi(COLOR.data, "data-res")} «${ansi(COLOR.name, node.label)}»`,
        mark,
        warning,
      );
      renderExpression(node.count, childPrefix, true);
      return;

    case "data-fill": {
      printLine(
        prefix,
        branch,
        `${ansi(COLOR.data, "data-fill")} «${ansi(COLOR.name, node.label)}»`,
        mark,
        warning,
      );
      const countInline = expressionInline(node.count);
      if (countInline !== null) {
        printLine(
          childPrefix,
          BRANCH_MID,
          `${ansi(COLOR.dim, "count")}  ${countInline}`,
          "",
        );
      } else {
        renderSlotHeader(childPrefix, BRANCH_MID, "count");
        renderExpression(node.count, childPrefix + INDENT_THROUGH, true);
      }
      const valueInline = expressionInline(node.value);
      if (valueInline !== null) {
        printLine(
          childPrefix,
          BRANCH_LAST,
          `${ansi(COLOR.dim, "value")}  ${valueInline}`,
          "",
        );
      } else {
        renderSlotHeader(childPrefix, BRANCH_LAST, "value");
        renderExpression(node.value, childPrefix + INDENT_BLANK, true);
      }
      return;
    }

    case "const-decl": {
      const inline = expressionInline(node.value);
      if (inline !== null) {
        printLine(
          prefix,
          branch,
          `${ansi(COLOR.structure, "const")} «${ansi(COLOR.name, node.name)}» = ${inline}`,
          mark,
          warning,
        );
      } else {
        printLine(
          prefix,
          branch,
          `${ansi(COLOR.structure, "const")} «${ansi(COLOR.name, node.name)}»`,
          mark,
          warning,
        );
        renderExpression(node.value, childPrefix, true);
      }
      return;
    }

    case "section":
      printLine(
        prefix,
        branch,
        `${ansi(COLOR.structure, "section")} «${ansi(COLOR.name, node.name)}»`,
        mark,
        warning,
      );
      return;

    case "origin": {
      const inline = expressionInline(node.address);
      if (inline !== null) {
        printLine(
          prefix,
          branch,
          `${ansi(COLOR.structure, "origin")} ${inline}`,
          mark,
          warning,
        );
      } else {
        printLine(
          prefix,
          branch,
          ansi(COLOR.structure, "origin"),
          mark,
          warning,
        );
        renderExpression(node.address, childPrefix, true);
      }
      return;
    }

    case "proc":
      printLine(
        prefix,
        branch,
        `${ansi(COLOR.statement, "proc")} «${ansi(COLOR.name, node.name)}»`,
        mark,
        warning,
      );
      if (showDocs && node.doc !== undefined) {
        renderDocumentation(node.doc, childPrefix, node.children.length === 0);
      }
      eachWithLast(node.children, (child, last) =>
        renderNode(child, childPrefix, last),
      );
      return;

    case "macro": {
      const params =
        node.params.length > 0 ? `(${node.params.join(", ")})` : "()";
      printLine(
        prefix,
        branch,
        `${ansi(COLOR.statement, "macro")} «${ansi(COLOR.name, node.name)}» ${params}`,
        mark,
        warning,
      );
      if (showDocs && node.doc !== undefined) {
        renderDocumentation(node.doc, childPrefix, node.children.length === 0);
      }
      eachWithLast(node.children, (child, last) =>
        renderNode(child, childPrefix, last),
      );
      return;
    }

    case "if": {
      printLine(prefix, branch, ansi(COLOR.statement, "if"), mark, warning);
      const elseBranch = node.elseBranch;
      const hasElse = elseBranch !== undefined;
      renderSlotHeader(childPrefix, BRANCH_MID, "cond");
      renderExpression(node.cond, childPrefix + INDENT_THROUGH, true);
      renderSlotHeader(childPrefix, hasElse ? BRANCH_MID : BRANCH_LAST, "then");
      const thenIndent =
        childPrefix + (hasElse ? INDENT_THROUGH : INDENT_BLANK);
      eachWithLast(node.thenBranch, (child, last) =>
        renderNode(child, thenIndent, last),
      );
      if (elseBranch !== undefined) {
        renderSlotHeader(childPrefix, BRANCH_LAST, "else");
        eachWithLast(elseBranch, (child, last) =>
          renderNode(child, childPrefix + INDENT_BLANK, last),
        );
      }
      return;
    }

    case "repeat": {
      const countInline = expressionInline(node.count);
      if (countInline !== null) {
        printLine(
          prefix,
          branch,
          `${ansi(COLOR.statement, "repeat")} × ${countInline}`,
          mark,
          warning,
        );
        eachWithLast(node.children, (child, last) =>
          renderNode(child, childPrefix, last),
        );
      } else {
        printLine(
          prefix,
          branch,
          ansi(COLOR.statement, "repeat"),
          mark,
          warning,
        );
        renderSlotHeader(childPrefix, BRANCH_MID, "count");
        renderExpression(node.count, childPrefix + INDENT_THROUGH, true);
        renderSlotHeader(childPrefix, BRANCH_LAST, "body");
        eachWithLast(node.children, (child, last) =>
          renderNode(child, childPrefix + INDENT_BLANK, last),
        );
      }
      return;
    }

    case "for":
      printLine(
        prefix,
        branch,
        `${ansi(COLOR.statement, "for")} «${ansi(COLOR.name, node.binder)}»`,
        mark,
        warning,
      );
      renderSlotHeader(childPrefix, BRANCH_MID, "in");
      renderExpression(node.range, childPrefix + INDENT_THROUGH, true);
      renderSlotHeader(childPrefix, BRANCH_LAST, "body");
      eachWithLast(node.children, (child, last) =>
        renderNode(child, childPrefix + INDENT_BLANK, last),
      );
      return;

    case "meta":
      printLine(
        prefix,
        branch,
        `${ansi(COLOR.meta, "meta")} «${ansi(COLOR.name, node.name)}»`,
        mark,
        warning,
      );
      eachWithLast(node.args, (argument, last) =>
        renderExpression(argument, childPrefix, last),
      );
      return;

    case "call-stmt":
      printLine(
        prefix,
        branch,
        `${ansi(COLOR.meta, "call")} ${ansi(COLOR.name, node.callee)}`,
        mark,
        warning,
      );
      eachWithLast(node.args, (argument, last) =>
        renderExpression(argument, childPrefix, last),
      );
      return;
  }
};

const programHeader = ansi(COLOR.structure, "program");
if (showSpans) {
  const span = program.span;
  const mark = ansi(
    COLOR.dim,
    `L${span.start.line}:${span.start.col}→L${span.end.line}:${span.end.col}`,
  );
  printLine("", "", programHeader, mark);
} else {
  console.log(programHeader);
}
eachWithLast(program.children, (child, last) => renderNode(child, "", last));

const parseErrors = parseDiagnostics.filter((d) => d.severity === "error");
if (parseErrors.length > 0) {
  for (const d of parseErrors) {
    const location = `${sourcePath}:${d.span.line}:${d.span.col}`;
    const head = ansi(COLOR.error, "error");
    const code = ansi(COLOR.dim, `[${d.code}]`);
    console.error(`${location}: ${head}${code}: ${d.message}`);
  }
  process.exit(1);
}
