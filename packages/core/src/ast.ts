type Pos = { line: number; col: number; offset: number };
type Span = { start: Pos; end: Pos };

type Base<K extends string> = {
  kind: K;
  span: Span;
};

// ---- Expressions --------------------------------------------------------

export type BinaryOp =
  | "*"
  | "/"
  | "%"
  | "+"
  | "-"
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

export type UnaryOp = "-" | "~" | "!";

export type Expr =
  | (Base<"lit-int"> & { value: number })
  | (Base<"lit-str"> & { value: string })
  | (Base<"ref"> & { name: string })
  | (Base<"unary"> & { op: UnaryOp; rhs: Expr })
  | (Base<"binary"> & { op: BinaryOp; lhs: Expr; rhs: Expr })
  | (Base<"call"> & { callee: string; args: Expr[] })
  | (Base<"paren"> & { inner: Expr })
  | (Base<"range"> & { lo: Expr; hi: Expr; inclusive: boolean });

// ---- Operands -----------------------------------------------------------

export type Operand =
  | { mode: "implied" }
  | { mode: "accumulator" }
  | { mode: "immediate"; value: Expr }
  | { mode: "zp"; value: Expr }
  | { mode: "zp-x"; value: Expr }
  | { mode: "zp-y"; value: Expr }
  | { mode: "abs"; value: Expr }
  | { mode: "abs-x"; value: Expr }
  | { mode: "abs-y"; value: Expr }
  | { mode: "indirect"; value: Expr }
  | { mode: "ind-x"; value: Expr }
  | { mode: "ind-y"; value: Expr }
  | { mode: "relative"; target: Expr };

// ---- Statements / declarations ------------------------------------------

type Program = Base<"program"> & {
  children: Node[];
};

type Label = Base<"label"> & {
  name: string;
  children: [];
};

type Instruction = Base<"instr"> & {
  mnemonic: string;
  operand: Operand;
  children: [];
};

type DataByte = Base<"data-byte"> & {
  label: string;
  values: Expr[];
  children: [];
};

type DataWord = Base<"data-word"> & {
  label: string;
  values: Expr[];
  children: [];
};

type DataAscii = Base<"data-ascii"> & {
  label: string;
  parts: Expr[];
  children: [];
};

type DataRes = Base<"data-res"> & {
  label: string;
  count: Expr;
  children: [];
};

type DataFill = Base<"data-fill"> & {
  label: string;
  count: Expr;
  value: Expr;
  children: [];
};

type ConstDecl = Base<"const-decl"> & {
  name: string;
  value: Expr;
  children: [];
};

type Section = Base<"section"> & {
  name: string;
  children: [];
};

type Origin = Base<"origin"> & {
  address: Expr;
  children: [];
};

type Proc = Base<"proc"> & {
  name: string;
  doc?: string;
  children: Node[];
};

type Macro = Base<"macro"> & {
  name: string;
  params: string[];
  doc?: string;
  children: Node[];
};

type If = Base<"if"> & {
  cond: Expr;
  thenBranch: Node[];
  elseBranch?: Node[];
};

type Repeat = Base<"repeat"> & {
  count: Expr;
  children: Node[];
};

type For = Base<"for"> & {
  binder: string;
  range: Expr;
  children: Node[];
};

type Meta = Base<"meta"> & {
  name: "cpu" | "assert" | "align" | "allow";
  args: Expr[];
  children: [];
};

type CallStmt = Base<"call-stmt"> & {
  callee: string;
  args: Expr[];
  children: [];
};

export type Node =
  | Program
  | Label
  | Instruction
  | DataByte
  | DataWord
  | DataAscii
  | DataRes
  | DataFill
  | ConstDecl
  | Section
  | Origin
  | Proc
  | Macro
  | If
  | Repeat
  | For
  | Meta
  | CallStmt;
