# NMOS 6502 Reference (Agent Form)

Optimized for grep + machine reading. Every fact one line away. No prose
unless load-bearing. Scope: official NMOS 6502 only. Undocumented /
illegal opcodes (SLO, RLA, LAX, SAX, etc.) out of scope.

## 1. Schema

### 1.1 Register set

```
A   8-bit accumulator
X   8-bit index
Y   8-bit index
SP  8-bit stack pointer; stack lives at $0100..$01FF; SP indexes within
PC  16-bit program counter
P   8-bit status flags: N V - B D I Z C  (bit 7..0)
```

Stack: descending. Push = `mem[$0100|SP] = v; SP = (SP-1)&0xFF`.
Pull   = `SP = (SP+1)&0xFF; v = mem[$0100|SP]`.

### 1.2 Status flags (P)

```
bit 7  N  negative   = result bit 7
bit 6  V  overflow   = signed overflow (ADC/SBC); BIT loads bit 6 of M
bit 5  -  unused     reads as 1
bit 4  B  break      not a real flag; only set in pushed P byte (PHP/BRK)
bit 3  D  decimal    BCD mode for ADC/SBC
bit 2  I  interrupt  1 = IRQ masked
bit 1  Z  zero       result == 0
bit 0  C  carry      ADC out, SBC in (active-low borrow), shift bit
```

### 1.3 Field abbreviations (used in tables)

```
b      = instruction byte length (opcode + operand)
c      = base cycle count
+p     = +1 cycle if effective addr crosses page boundary from base
+t     = +1 cycle if branch taken
flags  = flags affected; '-' = none; lowercase = conditional/special
sem    = semantics, pseudo-code
```

### 1.4 Addressing-mode abbreviations

```
impl   implied                    1 byte
acc    accumulator (operand = A)  1 byte
imm    immediate                  2 bytes  operand = literal
zp     zero page                  2 bytes  ea = op8
zpx    zero page,X                2 bytes  ea = (op8 + X) & 0xFF
zpy    zero page,Y                2 bytes  ea = (op8 + Y) & 0xFF
abs    absolute                   3 bytes  ea = op16
abx    absolute,X                 3 bytes  ea = op16 + X
aby    absolute,Y                 3 bytes  ea = op16 + Y
ind    indirect (JMP only)        3 bytes  ea = read16_buggy(op16)
izx    (indirect,X)               2 bytes  ea = read16_zp((op8+X)&0xFF)
izy    (indirect),Y               2 bytes  ea = read16_zp(op8) + Y
rel    relative (branches)        2 bytes  target = PC + sign_ext(op8)
```

`op8`/`op16` = operand bytes after opcode. `PC` at branch dispatch
already points past instruction.

### 1.5 Memory access primitives

```
read16_zp(a)      = mem[a] | (mem[(a+1)&0xFF] << 8)
                    # always wraps within zero page
read16_buggy(a)   = mem[a] | (mem[(a&0xFF00)|((a+1)&0xFF)] << 8)
                    # JMP indirect: high byte does NOT cross page
read16(a)         = mem[a] | (mem[a+1] << 8)   # normal little-endian
sign_ext(b)       = b - 0x100 if b & 0x80 else b
page_cross(a, b)  = (a & 0xFF00) != (b & 0xFF00)
```

## 2. Quirks (load-bearing edge cases)

- `JMP ($xxFF)` reads high byte from `$xx00`, not `$xxFF+1`. Page-wrap
  bug. Never crosses page even if low byte is `$FF`.
- `BRK` is 1-byte opcode but pushes `PC+2`. Treat as 2-byte for
  disassembly: signature byte at `PC+1` is software-defined, ignored
  by hardware.
- `JSR` pushes `PC+2`, which is the address of the LAST byte of the
  3-byte JSR (not the next instruction). `RTS` pulls and adds 1.
- `RTI` pulls P then PC; does NOT add 1 to PC (unlike RTS).
- `PHP` and `BRK` push P with B (bit 4) = 1. IRQ and NMI push P with
  B = 0. Bit 5 always pushed as 1.
- `PLP` and `RTI` ignore bits 4 and 5 when pulling: B unchanged-as-zero
  in P, bit 5 forced to 1.
- Zero-page indexed (`zpx`/`zpy`): index addition wraps within `$00..
  $FF`. `LDA $FF,X` with X=1 reads `$00`, NOT `$0100`.
- Indirect-X (`izx`): pointer fetch wraps in zero page. `LDA ($FF,X)`
  with X=0 reads pointer low at `$FF`, high at `$00`.
- Indirect-Y (`izy`): pointer fetch wraps in zero page (low at `op8`,
  high at `(op8+1)&0xFF`); the +Y add can cross a page (+p applies).
- Read-modify-write at `abx`/`aby` always pays the worst-case cycle
  (no page-cross optimization). Listed cycle counts are absolute, no
  `+p`. Same for STA `abx`/`aby`/`izy`.
- Branches: +1 cycle if taken, +1 more if target crosses page (so
  taken+cross = base+2). Encoded here as `+t+p`.
- Decimal mode (D=1): ADC and SBC do BCD. NMOS leaves N, V, Z
  UNDEFINED in decimal mode; only C is meaningful. (65C02 fixes this.)
- `TXS` does NOT affect flags. (All other transfers do: TAX TAY TSX
  TXA TYA set N,Z.)
- `BIT` loads N from `M&0x80`, V from `M&0x40`, Z from `(A&M)==0`.
  A is unchanged. Operand bits 7..6 → N,V regardless of A.
- `CMP`/`CPX`/`CPY`: C = (reg >= M); Z = (reg == M); N = bit 7 of
  (reg - M). Performs subtract, discards result.
- IRQ vector `$FFFE/$FFFF`. NMI `$FFFA/$FFFB`. RESET `$FFFC/$FFFD`.
  BRK uses IRQ vector. RESET takes 7 cycles, sets I=1.
- Reset state on real hardware: A,X,Y undefined; SP decremented by 3
  (no actual writes); P has I=1, others undefined.

## 3. Addressing-mode formulas (operand → effective address / value)

```
mode  read                                write           branch?
----  ----                                -----           -------
impl  -                                   -               no
acc   v = A                               A = v           no
imm   v = op8                             (illegal)       no
zp    v = mem[op8]                        mem[op8] = v    no
zpx   ea = (op8 + X) & 0xFF;  v = mem[ea] mem[ea] = v     no
zpy   ea = (op8 + Y) & 0xFF;  v = mem[ea] mem[ea] = v     no
abs   v = mem[op16]                       mem[op16] = v   no  (JMP/JSR uses op16 directly)
abx   ea = op16 + X;          v = mem[ea] mem[ea] = v     no  (+p on read-only ops)
aby   ea = op16 + Y;          v = mem[ea] mem[ea] = v     no  (+p on read-only ops)
ind   ea = read16_buggy(op16); jump to ea (JMP only)      no
izx   ptr = (op8 + X) & 0xFF
      ea  = read16_zp(ptr);   v = mem[ea] mem[ea] = v     no
izy   ea  = read16_zp(op8) + Y;
                              v = mem[ea] mem[ea] = v     no  (+p on read-only ops)
rel   target = (PC + sign_ext(op8)) & 0xFFFF              yes
```

`PC` value at relative-branch resolution = address of instruction
after the branch (already advanced past 2 bytes).

## 4. Flat opcode table (hex-sorted, 151 official)

Reverse lookup: `grep '^\$XX '`. Forward: `grep ' MNEMONIC '`.

```
$00 BRK impl  b=1 c=7      flags=I=1  sem="brk()"
$01 ORA izx   b=2 c=6      flags=NZ   sem="A=A|m"
$05 ORA zp    b=2 c=3      flags=NZ   sem="A=A|m"
$06 ASL zp    b=2 c=5      flags=NZC  sem="m=asl(m)"
$08 PHP impl  b=1 c=3      flags=-    sem="push(P|0x30)"
$09 ORA imm   b=2 c=2      flags=NZ   sem="A=A|m"
$0A ASL acc   b=1 c=2      flags=NZC  sem="A=asl(A)"
$0D ORA abs   b=3 c=4      flags=NZ   sem="A=A|m"
$0E ASL abs   b=3 c=6      flags=NZC  sem="m=asl(m)"
$10 BPL rel   b=2 c=2+t+p  flags=-    sem="if !N: PC=target"
$11 ORA izy   b=2 c=5+p    flags=NZ   sem="A=A|m"
$15 ORA zpx   b=2 c=4      flags=NZ   sem="A=A|m"
$16 ASL zpx   b=2 c=6      flags=NZC  sem="m=asl(m)"
$18 CLC impl  b=1 c=2      flags=C=0  sem="C=0"
$19 ORA aby   b=3 c=4+p    flags=NZ   sem="A=A|m"
$1D ORA abx   b=3 c=4+p    flags=NZ   sem="A=A|m"
$1E ASL abx   b=3 c=7      flags=NZC  sem="m=asl(m)"
$20 JSR abs   b=3 c=6      flags=-    sem="push16(PC-1); PC=op16"
$21 AND izx   b=2 c=6      flags=NZ   sem="A=A&m"
$24 BIT zp    b=2 c=3      flags=NVZ  sem="bit(m)"
$25 AND zp    b=2 c=3      flags=NZ   sem="A=A&m"
$26 ROL zp    b=2 c=5      flags=NZC  sem="m=rol(m)"
$28 PLP impl  b=1 c=4      flags=all  sem="P=(pull()&0xCF)|0x20"
$29 AND imm   b=2 c=2      flags=NZ   sem="A=A&m"
$2A ROL acc   b=1 c=2      flags=NZC  sem="A=rol(A)"
$2C BIT abs   b=3 c=4      flags=NVZ  sem="bit(m)"
$2D AND abs   b=3 c=4      flags=NZ   sem="A=A&m"
$2E ROL abs   b=3 c=6      flags=NZC  sem="m=rol(m)"
$30 BMI rel   b=2 c=2+t+p  flags=-    sem="if N: PC=target"
$31 AND izy   b=2 c=5+p    flags=NZ   sem="A=A&m"
$35 AND zpx   b=2 c=4      flags=NZ   sem="A=A&m"
$36 ROL zpx   b=2 c=6      flags=NZC  sem="m=rol(m)"
$38 SEC impl  b=1 c=2      flags=C=1  sem="C=1"
$39 AND aby   b=3 c=4+p    flags=NZ   sem="A=A&m"
$3D AND abx   b=3 c=4+p    flags=NZ   sem="A=A&m"
$3E ROL abx   b=3 c=7      flags=NZC  sem="m=rol(m)"
$40 RTI impl  b=1 c=6      flags=all  sem="P=(pull()&0xCF)|0x20; PC=pull16()"
$41 EOR izx   b=2 c=6      flags=NZ   sem="A=A^m"
$45 EOR zp    b=2 c=3      flags=NZ   sem="A=A^m"
$46 LSR zp    b=2 c=5      flags=NZC  sem="m=lsr(m)"
$48 PHA impl  b=1 c=3      flags=-    sem="push(A)"
$49 EOR imm   b=2 c=2      flags=NZ   sem="A=A^m"
$4A LSR acc   b=1 c=2      flags=NZC  sem="A=lsr(A)"
$4C JMP abs   b=3 c=3      flags=-    sem="PC=op16"
$4D EOR abs   b=3 c=4      flags=NZ   sem="A=A^m"
$4E LSR abs   b=3 c=6      flags=NZC  sem="m=lsr(m)"
$50 BVC rel   b=2 c=2+t+p  flags=-    sem="if !V: PC=target"
$51 EOR izy   b=2 c=5+p    flags=NZ   sem="A=A^m"
$55 EOR zpx   b=2 c=4      flags=NZ   sem="A=A^m"
$56 LSR zpx   b=2 c=6      flags=NZC  sem="m=lsr(m)"
$58 CLI impl  b=1 c=2      flags=I=0  sem="I=0"
$59 EOR aby   b=3 c=4+p    flags=NZ   sem="A=A^m"
$5D EOR abx   b=3 c=4+p    flags=NZ   sem="A=A^m"
$5E LSR abx   b=3 c=7      flags=NZC  sem="m=lsr(m)"
$60 RTS impl  b=1 c=6      flags=-    sem="PC=pull16()+1"
$61 ADC izx   b=2 c=6      flags=NZCV sem="A=adc(A,m)"
$65 ADC zp    b=2 c=3      flags=NZCV sem="A=adc(A,m)"
$66 ROR zp    b=2 c=5      flags=NZC  sem="m=ror(m)"
$68 PLA impl  b=1 c=4      flags=NZ   sem="A=pull()"
$69 ADC imm   b=2 c=2      flags=NZCV sem="A=adc(A,m)"
$6A ROR acc   b=1 c=2      flags=NZC  sem="A=ror(A)"
$6C JMP ind   b=3 c=5      flags=-    sem="PC=read16_buggy(op16)"
$6D ADC abs   b=3 c=4      flags=NZCV sem="A=adc(A,m)"
$6E ROR abs   b=3 c=6      flags=NZC  sem="m=ror(m)"
$70 BVS rel   b=2 c=2+t+p  flags=-    sem="if V: PC=target"
$71 ADC izy   b=2 c=5+p    flags=NZCV sem="A=adc(A,m)"
$75 ADC zpx   b=2 c=4      flags=NZCV sem="A=adc(A,m)"
$76 ROR zpx   b=2 c=6      flags=NZC  sem="m=ror(m)"
$78 SEI impl  b=1 c=2      flags=I=1  sem="I=1"
$79 ADC aby   b=3 c=4+p    flags=NZCV sem="A=adc(A,m)"
$7D ADC abx   b=3 c=4+p    flags=NZCV sem="A=adc(A,m)"
$7E ROR abx   b=3 c=7      flags=NZC  sem="m=ror(m)"
$81 STA izx   b=2 c=6      flags=-    sem="m=A"
$84 STY zp    b=2 c=3      flags=-    sem="m=Y"
$85 STA zp    b=2 c=3      flags=-    sem="m=A"
$86 STX zp    b=2 c=3      flags=-    sem="m=X"
$88 DEY impl  b=1 c=2      flags=NZ   sem="Y=(Y-1)&0xFF"
$8A TXA impl  b=1 c=2      flags=NZ   sem="A=X"
$8C STY abs   b=3 c=4      flags=-    sem="m=Y"
$8D STA abs   b=3 c=4      flags=-    sem="m=A"
$8E STX abs   b=3 c=4      flags=-    sem="m=X"
$90 BCC rel   b=2 c=2+t+p  flags=-    sem="if !C: PC=target"
$91 STA izy   b=2 c=6      flags=-    sem="m=A"
$94 STY zpx   b=2 c=4      flags=-    sem="m=Y"
$95 STA zpx   b=2 c=4      flags=-    sem="m=A"
$96 STX zpy   b=2 c=4      flags=-    sem="m=X"
$98 TYA impl  b=1 c=2      flags=NZ   sem="A=Y"
$99 STA aby   b=3 c=5      flags=-    sem="m=A"
$9A TXS impl  b=1 c=2      flags=-    sem="SP=X"
$9D STA abx   b=3 c=5      flags=-    sem="m=A"
$A0 LDY imm   b=2 c=2      flags=NZ   sem="Y=m"
$A1 LDA izx   b=2 c=6      flags=NZ   sem="A=m"
$A2 LDX imm   b=2 c=2      flags=NZ   sem="X=m"
$A4 LDY zp    b=2 c=3      flags=NZ   sem="Y=m"
$A5 LDA zp    b=2 c=3      flags=NZ   sem="A=m"
$A6 LDX zp    b=2 c=3      flags=NZ   sem="X=m"
$A8 TAY impl  b=1 c=2      flags=NZ   sem="Y=A"
$A9 LDA imm   b=2 c=2      flags=NZ   sem="A=m"
$AA TAX impl  b=1 c=2      flags=NZ   sem="X=A"
$AC LDY abs   b=3 c=4      flags=NZ   sem="Y=m"
$AD LDA abs   b=3 c=4      flags=NZ   sem="A=m"
$AE LDX abs   b=3 c=4      flags=NZ   sem="X=m"
$B0 BCS rel   b=2 c=2+t+p  flags=-    sem="if C: PC=target"
$B1 LDA izy   b=2 c=5+p    flags=NZ   sem="A=m"
$B4 LDY zpx   b=2 c=4      flags=NZ   sem="Y=m"
$B5 LDA zpx   b=2 c=4      flags=NZ   sem="A=m"
$B6 LDX zpy   b=2 c=4      flags=NZ   sem="X=m"
$B8 CLV impl  b=1 c=2      flags=V=0  sem="V=0"
$B9 LDA aby   b=3 c=4+p    flags=NZ   sem="A=m"
$BA TSX impl  b=1 c=2      flags=NZ   sem="X=SP"
$BC LDY abx   b=3 c=4+p    flags=NZ   sem="Y=m"
$BD LDA abx   b=3 c=4+p    flags=NZ   sem="A=m"
$BE LDX aby   b=3 c=4+p    flags=NZ   sem="X=m"
$C0 CPY imm   b=2 c=2      flags=NZC  sem="cmp(Y,m)"
$C1 CMP izx   b=2 c=6      flags=NZC  sem="cmp(A,m)"
$C4 CPY zp    b=2 c=3      flags=NZC  sem="cmp(Y,m)"
$C5 CMP zp    b=2 c=3      flags=NZC  sem="cmp(A,m)"
$C6 DEC zp    b=2 c=5      flags=NZ   sem="m=(m-1)&0xFF"
$C8 INY impl  b=1 c=2      flags=NZ   sem="Y=(Y+1)&0xFF"
$C9 CMP imm   b=2 c=2      flags=NZC  sem="cmp(A,m)"
$CA DEX impl  b=1 c=2      flags=NZ   sem="X=(X-1)&0xFF"
$CC CPY abs   b=3 c=4      flags=NZC  sem="cmp(Y,m)"
$CD CMP abs   b=3 c=4      flags=NZC  sem="cmp(A,m)"
$CE DEC abs   b=3 c=6      flags=NZ   sem="m=(m-1)&0xFF"
$D0 BNE rel   b=2 c=2+t+p  flags=-    sem="if !Z: PC=target"
$D1 CMP izy   b=2 c=5+p    flags=NZC  sem="cmp(A,m)"
$D5 CMP zpx   b=2 c=4      flags=NZC  sem="cmp(A,m)"
$D6 DEC zpx   b=2 c=6      flags=NZ   sem="m=(m-1)&0xFF"
$D8 CLD impl  b=1 c=2      flags=D=0  sem="D=0"
$D9 CMP aby   b=3 c=4+p    flags=NZC  sem="cmp(A,m)"
$DD CMP abx   b=3 c=4+p    flags=NZC  sem="cmp(A,m)"
$DE DEC abx   b=3 c=7      flags=NZ   sem="m=(m-1)&0xFF"
$E0 CPX imm   b=2 c=2      flags=NZC  sem="cmp(X,m)"
$E1 SBC izx   b=2 c=6      flags=NZCV sem="A=sbc(A,m)"
$E4 CPX zp    b=2 c=3      flags=NZC  sem="cmp(X,m)"
$E5 SBC zp    b=2 c=3      flags=NZCV sem="A=sbc(A,m)"
$E6 INC zp    b=2 c=5      flags=NZ   sem="m=(m+1)&0xFF"
$E8 INX impl  b=1 c=2      flags=NZ   sem="X=(X+1)&0xFF"
$E9 SBC imm   b=2 c=2      flags=NZCV sem="A=sbc(A,m)"
$EA NOP impl  b=1 c=2      flags=-    sem="-"
$EC CPX abs   b=3 c=4      flags=NZC  sem="cmp(X,m)"
$ED SBC abs   b=3 c=4      flags=NZCV sem="A=sbc(A,m)"
$EE INC abs   b=3 c=6      flags=NZ   sem="m=(m+1)&0xFF"
$F0 BEQ rel   b=2 c=2+t+p  flags=-    sem="if Z: PC=target"
$F1 SBC izy   b=2 c=5+p    flags=NZCV sem="A=sbc(A,m)"
$F5 SBC zpx   b=2 c=4      flags=NZCV sem="A=sbc(A,m)"
$F6 INC zpx   b=2 c=6      flags=NZ   sem="m=(m+1)&0xFF"
$F8 SED impl  b=1 c=2      flags=D=1  sem="D=1"
$F9 SBC aby   b=3 c=4+p    flags=NZCV sem="A=sbc(A,m)"
$FD SBC abx   b=3 c=4+p    flags=NZCV sem="A=sbc(A,m)"
$FE INC abx   b=3 c=7      flags=NZ   sem="m=(m+1)&0xFF"
```

Unlisted opcodes ($02 $03 $04 $07 $0B $0C $0F $12 $13 $14 $17 $1A $1B
$1C $1F $22 $23 $27 $2B $2F $32 $33 $34 $37 $3A $3B $3C $3F $42 $43
$44 $47 $4B $4F $52 $53 $54 $57 $5A $5B $5C $5F $62 $63 $64 $67 $6B
$6F $72 $73 $74 $77 $7A $7B $7C $7F $80 $82 $83 $87 $89 $8B $8F $92
$93 $97 $9B $9C $9E $9F $A3 $A7 $AB $AF $B2 $B3 $B7 $BB $BF $C2 $C3
$C7 $CB $CF $D2 $D3 $D4 $D7 $DA $DB $DC $DF $E2 $E3 $E7 $EB $EF $F2
$F3 $F4 $F7 $FA $FB $FC $FF) are unofficial. Behavior varies by die
revision. Out of scope here.

## 5. Helper semantic primitives

Defined once. Referenced from `sem` strings above.

```
asl(v):   C = (v >> 7) & 1
          v = (v << 1) & 0xFF
          set_nz(v)
          return v

lsr(v):   C = v & 1
          v = v >> 1
          N = 0; Z = (v == 0)
          return v

rol(v):   c_in = C
          C = (v >> 7) & 1
          v = ((v << 1) | c_in) & 0xFF
          set_nz(v)
          return v

ror(v):   c_in = C
          C = v & 1
          v = (v >> 1) | (c_in << 7)
          set_nz(v)
          return v

adc(a, m):
  if D == 0:                        # binary mode
      s   = a + m + C
      Z   = (s & 0xFF) == 0
      N   = (s >> 7) & 1
      V   = ((~(a ^ m)) & (a ^ s) & 0x80) != 0
      C   = s > 0xFF
      return s & 0xFF
  else:                             # decimal mode (NMOS)
      lo  = (a & 0x0F) + (m & 0x0F) + C
      if lo > 9: lo += 6
      hi  = (a >> 4) + (m >> 4) + (1 if lo > 0x0F else 0)
      # NMOS: N, V, Z computed from intermediate binary sum, undefined
      bin = (a + m + C) & 0xFF
      Z   = bin == 0
      N   = (hi >> 3) & 1           # bit 7 of result before final fixup
      V   = (((hi << 4) ^ a) & 0x80) and not ((a ^ m) & 0x80)
      if hi > 9: hi += 6
      C   = hi > 0x0F
      return ((hi << 4) | (lo & 0x0F)) & 0xFF

sbc(a, m):
  # Equivalent to adc(a, m ^ 0xFF) in binary mode.
  # Decimal mode: NMOS does BCD subtract; N,V,Z undefined; C=borrow-out
  # (1 = no borrow). Implementations should mirror adc shape with
  # subtraction fixups.
  return adc_or_bcd_sub(a, m ^ 0xFF)

cmp(r, m):
  t = r - m                         # 9-bit
  C = r >= m
  Z = (r & 0xFF) == (m & 0xFF)
  N = (t >> 7) & 1

bit(m):
  N = (m >> 7) & 1
  V = (m >> 6) & 1
  Z = (A & m) == 0
  # A unchanged

brk():
  PC  = PC + 1                      # skip signature byte
  push16(PC)
  push(P | 0x30)                    # B=1, bit5=1
  I   = 1
  PC  = read16(0xFFFE)

set_nz(v):
  Z = (v & 0xFF) == 0
  N = (v >> 7) & 1
```

## 6. Per-mnemonic index (alphabetical)

Use to find all opcodes for a mnemonic. Cross-reference into §4.

```
ADC  $69 imm  $65 zp   $75 zpx  $6D abs  $7D abx  $79 aby  $61 izx  $71 izy
AND  $29 imm  $25 zp   $35 zpx  $2D abs  $3D abx  $39 aby  $21 izx  $31 izy
ASL  $0A acc  $06 zp   $16 zpx  $0E abs  $1E abx
BCC  $90 rel
BCS  $B0 rel
BEQ  $F0 rel
BIT  $24 zp   $2C abs
BMI  $30 rel
BNE  $D0 rel
BPL  $10 rel
BRK  $00 impl
BVC  $50 rel
BVS  $70 rel
CLC  $18 impl
CLD  $D8 impl
CLI  $58 impl
CLV  $B8 impl
CMP  $C9 imm  $C5 zp   $D5 zpx  $CD abs  $DD abx  $D9 aby  $C1 izx  $D1 izy
CPX  $E0 imm  $E4 zp   $EC abs
CPY  $C0 imm  $C4 zp   $CC abs
DEC  $C6 zp   $D6 zpx  $CE abs  $DE abx
DEX  $CA impl
DEY  $88 impl
EOR  $49 imm  $45 zp   $55 zpx  $4D abs  $5D abx  $59 aby  $41 izx  $51 izy
INC  $E6 zp   $F6 zpx  $EE abs  $FE abx
INX  $E8 impl
INY  $C8 impl
JMP  $4C abs  $6C ind
JSR  $20 abs
LDA  $A9 imm  $A5 zp   $B5 zpx  $AD abs  $BD abx  $B9 aby  $A1 izx  $B1 izy
LDX  $A2 imm  $A6 zp   $B6 zpy  $AE abs  $BE aby
LDY  $A0 imm  $A4 zp   $B4 zpx  $AC abs  $BC abx
LSR  $4A acc  $46 zp   $56 zpx  $4E abs  $5E abx
NOP  $EA impl
ORA  $09 imm  $05 zp   $15 zpx  $0D abs  $1D abx  $19 aby  $01 izx  $11 izy
PHA  $48 impl
PHP  $08 impl
PLA  $68 impl
PLP  $28 impl
ROL  $2A acc  $26 zp   $36 zpx  $2E abs  $3E abx
ROR  $6A acc  $66 zp   $76 zpx  $6E abs  $7E abx
RTI  $40 impl
RTS  $60 impl
SBC  $E9 imm  $E5 zp   $F5 zpx  $ED abs  $FD abx  $F9 aby  $E1 izx  $F1 izy
SEC  $38 impl
SED  $F8 impl
SEI  $78 impl
STA  $85 zp   $95 zpx  $8D abs  $9D abx  $99 aby  $81 izx  $91 izy
STX  $86 zp   $96 zpy  $8E abs
STY  $84 zp   $94 zpx  $8C abs
TAX  $AA impl
TAY  $A8 impl
TSX  $BA impl
TXA  $8A impl
TXS  $9A impl
TYA  $98 impl
```

Total: 56 mnemonics, 151 opcodes.

## 7. Interrupts

```
event   vector       priority   pushed P (B bit)   sets I   cycles
RESET   $FFFC/$FFFD  highest    none               yes      7
NMI     $FFFA/$FFFB  high       B=0                no       7
IRQ     $FFFE/$FFFF  low        B=0                yes      7
BRK     $FFFE/$FFFF  -          B=1                yes      7
```

NMI is edge-triggered, IRQ is level-triggered. IRQ ignored if I=1.
RESET takes 7 cycles but performs no real writes (SP decremented as
if pushing PC and P).

Hardware sequence (NMI/IRQ/BRK):
```
push high byte of return PC
push low byte of return PC
push P (B set per table above; bit 5 always 1)
I = 1
PC = read16(vector)
```

## 8. Memory map conventions

```
$0000..$00FF   zero page (1-byte addressing, fast access)
$0100..$01FF   stack (descending; SP=$FF on init/reset)
$FFFA..$FFFB   NMI vector
$FFFC..$FFFD   RESET vector
$FFFE..$FFFF   IRQ/BRK vector
```

Everything else is system-defined. The CPU itself imposes no further
structure.
