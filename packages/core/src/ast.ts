type Pos = { line: number; col: number; offset: number };
type Span = { start: Pos; end: Pos };
type SymbolRef = { name: string };
type Value = number | SymbolRef;

type Base<K extends string> = {
  kind: K;
  span: Span;
};

type Program = Base<"program"> & {
  children: Node[];
};

type Label = Base<"label"> & {
  name: string;
  children: [];
};

type Operand =
  | { mode: "implied" }
  | { mode: "accumulator" }
  | { mode: "immediate"; value: Value }
  | { mode: "zp"; value: Value }
  | { mode: "zp-x"; value: Value }
  | { mode: "zp-y"; value: Value }
  | { mode: "abs"; value: Value }
  | { mode: "abs-x"; value: Value }
  | { mode: "abs-y"; value: Value }
  | { mode: "indirect"; value: Value }
  | { mode: "ind-x"; value: Value }
  | { mode: "ind-y"; value: Value }
  | { mode: "relative"; target: Value };

type Instruction = Base<"instr"> & {
  mnemonic: string;
  operand: Operand;
  children: [];
};

type DataByte = Base<"data-byte"> & {
  values: Value[];
  children: [];
};

type DataWord = Base<"data-word"> & {
  values: Value[];
  children: [];
};

type Repeat = Base<"repeat"> & {
  count: number;
  children: Node[];
};

type Origin = Base<"origin"> & {
  address: Value;
  children: [];
};

export type Node =
  | Program
  | Label
  | Instruction
  | DataByte
  | DataWord
  | Repeat
  | Origin;
