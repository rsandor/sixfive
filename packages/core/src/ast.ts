type Pos = { line: number; col: number; offset: number };

type Span = { start: Pos; end: Pos };

type Ref = number | { name: string };

type Operand =
  | { mode: "implied" }
  | { mode: "accumulator" }
  | { mode: "immediate"; value: Ref }
  | { mode: "zp"; value: Ref }
  | { mode: "zp-x"; value: Ref }
  | { mode: "zp-y"; value: Ref }
  | { mode: "abs"; value: Ref }
  | { mode: "abs-x"; value: Ref }
  | { mode: "abs-y"; value: Ref }
  | { mode: "indirect"; value: Ref }
  | { mode: "ind-x"; value: Ref }
  | { mode: "ind-y"; value: Ref }
  | { mode: "relative"; target: Ref };

type ProgramNode = {
  kind: "program";
  span: Span;
  children: Node[];
};

type LabelNode = {
  kind: "label";
  span: Span;
  children: [];
  name: string;
};

type InstructionNode = {
  kind: "instruction";
  span: Span;
  children: [];
  mnemonic: string;
  operand: Operand;
};

type DataByteNode = {
  kind: "data-byte";
  span: Span;
  children: [];
  values: Ref[];
};

type DataWordNode = {
  kind: "data-word";
  span: Span;
  children: [];
  values: Ref[];
};

type RepeatNode = {
  kind: "repeat";
  span: Span;
  children: Node[];
  count: number;
};

type OriginNode = {
  kind: "origin";
  span: Span;
  children: [];
  address: Ref;
};

export type Node =
  | ProgramNode
  | LabelNode
  | InstructionNode
  | DataByteNode
  | DataWordNode
  | RepeatNode
  | OriginNode;
