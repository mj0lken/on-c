import { AngleUnit, CalcValue, DisplayBase } from '../types';
import { convertCurrency, resolveCurrency, SYMBOL_TO_CURRENCY } from './currencies';
import { areUnitsCompatible, convertUnitValue, resolveUnit, UNITS_BY_ID } from './units';

export interface EvalContext {
  ans: CalcValue | null;
  variables: Map<string, CalcValue>;
  /** Variables defined on current or later rows (to detect illegal backward/forward row ref) */
  forbiddenFutureVars: Set<string>;
  getBlockValues: () => CalcValue[];
  rates: Record<string, number>;
  defaultCurrency: string;
  angleUnit: AngleUnit;
  now?: Date;
}

export class FutureReferenceError extends Error {
  public readonly varName: string;
  constructor(varName: string) {
    super(`Cannot reference "${varName}" before its row`);
    this.varName = varName;
  }
}

type LexToken =
  | { kind: 'num'; value: number }
  | { kind: 'ident'; value: string }
  | { kind: 'currSym'; code: string; raw: string }
  | { kind: 'op'; value: string }
  | { kind: 'lparen' }
  | { kind: 'rparen' }
  | { kind: 'comma' }
  | { kind: 'degSym'; tempUnit?: 'C' | 'F' }
  | { kind: 'quoteUnit'; unitId: 'in' | 'ft' };

const MULTI_CHAR_SYMS = Object.keys(SYMBOL_TO_CURRENCY)
  .filter((s) => s.length > 1)
  .sort((a, b) => b.length - a.length);

const SINGLE_CHAR_SYMS = new Set(
  Object.keys(SYMBOL_TO_CURRENCY).filter((s) => s.length === 1)
);

function normalizePhraseOperators(input: string): string {
  return input
    .replace(/\bmultiplied\s+by\b/gi, ' * ')
    .replace(/\bdivided\s+by\b/gi, ' / ')
    .replace(/\bas\s+a\s+%\s+of\b/gi, ' __as_pct_of__ ')
    .replace(/\bas\s+%\s+of\b/gi, ' __as_pct_of__ ')
    .replace(/\bis\s+what\s+%\s+of\b/gi, ' __as_pct_of__ ')
    .replace(/\bnautical\s+miles?\b/gi, ' nmi ')
    .replace(/\bfluid\s+ounces?\b/gi, ' floz ')
    .replace(/\bfl\s+oz\b/gi, ' floz ')
    .replace(/\bsquare\s+meters?\b/gi, ' m2 ')
    .replace(/\bsq\s+m\b/gi, ' m2 ')
    .replace(/\bsquare\s+kilometers?\b/gi, ' km2 ')
    .replace(/\bsq\s+km\b/gi, ' km2 ')
    .replace(/\bsquare\s+feet\b/gi, ' ft2 ')
    .replace(/\bsquare\s+foot\b/gi, ' ft2 ')
    .replace(/\bsq\s+ft\b/gi, ' ft2 ')
    .replace(/\bsquare\s+inch(?:es)?\b/gi, ' in2 ')
    .replace(/\bsq\s+in\b/gi, ' in2 ')
    .replace(/\bmetric\s+tons?\b/gi, ' tonne ')
    .replace(/\bkm\/h\b/gi, ' kph ')
    .replace(/\bm\/s\b/gi, ' mps ');
}

function lexExpression(raw: string, defaultCurrency: string): LexToken[] | null {
  const src = normalizePhraseOperators(raw);
  const tokens: LexToken[] = [];
  let i = 0;

  while (i < src.length) {
    const rest = src.slice(i);
    const ch = src[i];

    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    // Multi-char currency symbol
    let matchedSym = '';
    for (const sym of MULTI_CHAR_SYMS) {
      if (rest.startsWith(sym)) {
        matchedSym = sym;
        break;
      }
    }
    if (matchedSym) {
      const code = resolveCurrency(matchedSym, defaultCurrency)!;
      tokens.push({ kind: 'currSym', code, raw: matchedSym });
      i += matchedSym.length;
      continue;
    }

    if (SINGLE_CHAR_SYMS.has(ch)) {
      const code = resolveCurrency(ch, defaultCurrency)!;
      tokens.push({ kind: 'currSym', code, raw: ch });
      i += 1;
      continue;
    }

    // Hex / Binary / Octal
    const hexMatch = /^0x([0-9a-fA-F_]+)/i.exec(rest);
    if (hexMatch) {
      const val = parseInt(hexMatch[1].replace(/_/g, ''), 16);
      if (Number.isNaN(val)) return null;
      tokens.push({ kind: 'num', value: val });
      i += hexMatch[0].length;
      continue;
    }
    const binMatch = /^0b([01_]+)/i.exec(rest);
    if (binMatch) {
      const val = parseInt(binMatch[1].replace(/_/g, ''), 2);
      if (Number.isNaN(val)) return null;
      tokens.push({ kind: 'num', value: val });
      i += binMatch[0].length;
      continue;
    }
    const octMatch = /^0o([0-7_]+)/i.exec(rest);
    if (octMatch) {
      const val = parseInt(octMatch[1].replace(/_/g, ''), 8);
      if (Number.isNaN(val)) return null;
      tokens.push({ kind: 'num', value: val });
      i += octMatch[0].length;
      continue;
    }

    // Standard / scientific number (with optional thousands commas `2,800.50` or spaces `4 200.50`, but NOT function comma `gcd(12, 180)`)
    const numMatch =
      /^(?:\d{1,3}(?:,\d{3})+(?!\d)(?:\.\d+)?|\d{1,3}(?:[ \u00A0\u202F]\d{3})+(?!\d)(?:\.\d+)?|\d+(?:_\d+)*(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?/i.exec(
        rest
      );
    if (numMatch) {
      const cleaned = numMatch[0].replace(/[,_ \u00A0\u202F]/g, '');
      const val = Number(cleaned);
      if (Number.isNaN(val)) return null;
      tokens.push({ kind: 'num', value: val });
      i += numMatch[0].length;
      // Optional compact magnitude suffix like 5k, 2.5M when attached directly with NO space (avoiding `5m` = meters or `5b` = bits; allow `k` only if not `km`/`kg`/`kb`/`kph`/`kib`)
      const afterNum = src.slice(i);
      if (/^[kM]\b/.test(afterNum) && !/^(?:km|kg|kb|kib|kph|kn|kt)\b/i.test(afterNum)) {
        const mag = afterNum[0] === 'k' ? 1e3 : 1e6;
        tokens[tokens.length - 1] = { kind: 'num', value: val * mag };
        i += 1;
      }
      continue;
    }

    // Degree / temperature symbols °C, °F, °
    if (rest.startsWith('°C') || rest.startsWith('°c')) {
      tokens.push({ kind: 'degSym', tempUnit: 'C' });
      i += 2;
      continue;
    }
    if (rest.startsWith('°F') || rest.startsWith('°f')) {
      tokens.push({ kind: 'degSym', tempUnit: 'F' });
      i += 2;
      continue;
    }
    if (ch === '°') {
      tokens.push({ kind: 'degSym' });
      i += 1;
      continue;
    }

    if (ch === '(') {
      tokens.push({ kind: 'lparen' });
      i += 1;
      continue;
    }
    if (ch === ')') {
      tokens.push({ kind: 'rparen' });
      i += 1;
      continue;
    }
    if (ch === ',') {
      tokens.push({ kind: 'comma' });
      i += 1;
      continue;
    }

    if (rest.startsWith('<<') || rest.startsWith('>>') || rest.startsWith('**')) {
      tokens.push({ kind: 'op', value: rest.slice(0, 2) });
      i += 2;
      continue;
    }

    if (ch === '√') {
      tokens.push({ kind: 'ident', value: 'sqrt' });
      i += 1;
      continue;
    }

    if (ch === '∛') {
      tokens.push({ kind: 'ident', value: 'cbrt' });
      i += 1;
      continue;
    }

    if (ch === '²' || ch === '³' || ch === '‰') {
      tokens.push({ kind: 'op', value: ch });
      i += 1;
      continue;
    }

    if ('+-*×/÷^%!&|~'.includes(ch) || ch === '−' || ch === '⊕') {
      const norm =
        ch === '×' ? '*' : ch === '÷' ? '/' : ch === '−' ? '-' : ch === '⊕' ? 'xor' : ch;
      tokens.push({ kind: 'op', value: norm });
      i += 1;
      continue;
    }

    if (ch === '"' && tokens.length > 0 && tokens[tokens.length - 1].kind === 'num') {
      tokens.push({ kind: 'quoteUnit', unitId: 'in' });
      i += 1;
      continue;
    }
    if (ch === "'" && tokens.length > 0 && tokens[tokens.length - 1].kind === 'num') {
      tokens.push({ kind: 'quoteUnit', unitId: 'ft' });
      i += 1;
      continue;
    }

    const areaSuperMatch = /^(?:mm|cm|m|km)²/i.exec(rest);
    if (areaSuperMatch) {
      tokens.push({ kind: 'ident', value: areaSuperMatch[0] });
      i += areaSuperMatch[0].length;
      continue;
    }

    const wordMatch = /^[A-Za-z_\u03C0\u03C4\u03C6][A-Za-z0-9_]*/.exec(rest);
    if (wordMatch) {
      tokens.push({ kind: 'ident', value: wordMatch[0] });
      i += wordMatch[0].length;
      continue;
    }

    // Unrecognized character in expression
    return null;
  }

  return tokens;
}

function makeNumber(amount: number, displayBase?: DisplayBase): CalcValue {
  return displayBase ? { kind: 'number', amount, displayBase } : { kind: 'number', amount };
}

function factorial(n: number): number {
  if (n < 0 || !Number.isFinite(n)) return NaN;
  if (Math.abs(n - Math.round(n)) > 1e-9) return NaN;
  const k = Math.round(n);
  if (k > 170) return Infinity;
  let res = 1;
  for (let i = 2; i <= k; i++) res *= i;
  return res;
}

function gcdTwo(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

class ExpressionParser {
  private pos = 0;

  constructor(
    private readonly tokens: LexToken[],
    private readonly ctx: EvalContext
  ) {}

  public parseFull(): CalcValue | null {
    if (this.tokens.length === 0) return null;
    const val = this.parseConversion();
    if (!val || !Number.isFinite(val.amount)) return null;
    if (this.pos < this.tokens.length) return null;
    return val;
  }

  private peek(offset = 0): LexToken | undefined {
    return this.tokens[this.pos + offset];
  }

  private consume(): LexToken {
    return this.tokens[this.pos++];
  }

  private matchIdent(...names: string[]): string | null {
    const tok = this.peek();
    if (tok?.kind === 'ident') {
      const low = tok.value.toLowerCase();
      if (names.includes(low)) {
        this.pos++;
        return low;
      }
    }
    return null;
  }

  private matchOp(...ops: string[]): string | null {
    const tok = this.peek();
    if (tok?.kind === 'op' && ops.includes(tok.value)) {
      this.pos++;
      return tok.value;
    }
    return null;
  }

  // Level 1: `expr in/to/as target` & `exprA __as_pct_of__ exprB`
  private parseConversion(): CalcValue | null {
    let left = this.parseBitOr();
    if (!left) return null;

    if (this.matchIdent('__as_pct_of__')) {
      const right = this.parseBitOr();
      if (!right) return null;
      const ratio = this.divideValues(left, right);
      if (!ratio) return null;
      return { kind: 'percent', amount: ratio.amount * 100 };
    }

    while (true) {
      const next = this.peek();
      if (
        next?.kind === 'ident' &&
        ['in', 'to', 'as'].includes(next.value.toLowerCase()) &&
        this.peek(1) !== undefined
      ) {
        const savedPos = this.pos;
        this.pos++; // consume in/to/as
        const converted = this.tryConvertTarget(left);
        if (converted) {
          left = converted;
          continue;
        }
        this.pos = savedPos;
      }
      break;
    }

    return left;
  }

  private tryConvertTarget(val: CalcValue): CalcValue | null {
    const t = this.peek();
    if (!t) return null;

    // `in %` / `in percent`
    if (t.kind === 'op' && t.value === '%') {
      this.pos++;
      if (val.kind === 'percent') return val;
      return { kind: 'percent', amount: val.amount * 100 };
    }
    if (t.kind === 'ident') {
      const low = t.value.toLowerCase();
      if (low === 'percent' || low === 'percentage') {
        this.pos++;
        if (val.kind === 'percent') return val;
        return { kind: 'percent', amount: val.amount * 100 };
      }
      if (low === 'hex' || low === 'hexadecimal') {
        this.pos++;
        return makeNumber(Math.trunc(val.amount), 'hex');
      }
      if (low === 'bin' || low === 'binary') {
        this.pos++;
        return makeNumber(Math.trunc(val.amount), 'bin');
      }
      if (low === 'oct' || low === 'octal') {
        this.pos++;
        return makeNumber(Math.trunc(val.amount), 'oct');
      }
      if (low === 'dec' || low === 'decimal') {
        this.pos++;
        return makeNumber(val.amount, 'dec');
      }

      // Currency target (`in EUR`, `to sek`)
      const curr = resolveCurrency(t.value, this.ctx.defaultCurrency);
      if (curr) {
        this.pos++;
        const sourceCode = val.kind === 'currency' && val.currency ? val.currency : this.ctx.defaultCurrency;
        return {
          kind: 'currency',
          amount: convertCurrency(val.amount, sourceCode, curr, this.ctx.rates),
          currency: curr,
        };
      }

      // Unit target (`in cm`, `to miles`, `in F`)
      const unitDef = resolveUnit(t.value);
      if (unitDef) {
        this.pos++;
        if (val.kind === 'unit' && val.unit) {
          const conv = convertUnitValue(val.amount, val.unit, unitDef.id);
          if (conv === null) return null;
          return { kind: 'unit', amount: conv, unit: unitDef.id };
        }
        if (val.kind === 'date') return null;
        return { kind: 'unit', amount: val.amount, unit: unitDef.id };
      }
    }

    if (t.kind === 'currSym') {
      this.pos++;
      const sourceCode = val.kind === 'currency' && val.currency ? val.currency : this.ctx.defaultCurrency;
      return {
        kind: 'currency',
        amount: convertCurrency(val.amount, sourceCode, t.code, this.ctx.rates),
        currency: t.code,
      };
    }

    if (t.kind === 'degSym') {
      this.pos++;
      const targetId = t.tempUnit ?? 'deg';
      if (val.kind === 'unit' && val.unit) {
        const conv = convertUnitValue(val.amount, val.unit, targetId);
        if (conv === null) return null;
        return { kind: 'unit', amount: conv, unit: targetId };
      }
      return { kind: 'unit', amount: val.amount, unit: targetId };
    }

    return null;
  }

  // Level 2: Bitwise OR `|`
  private parseBitOr(): CalcValue | null {
    let left = this.parseBitXor();
    if (!left) return null;
    while (this.matchOp('|')) {
      const right = this.parseBitXor();
      if (!right) return null;
      left = makeNumber(Math.trunc(left.amount) | Math.trunc(right.amount), left.displayBase);
    }
    return left;
  }

  // Level 3: Bitwise XOR `xor`
  private parseBitXor(): CalcValue | null {
    let left = this.parseBitAnd();
    if (!left) return null;
    while (this.matchOp('xor') || this.matchIdent('xor')) {
      const right = this.parseBitAnd();
      if (!right) return null;
      left = makeNumber(Math.trunc(left.amount) ^ Math.trunc(right.amount), left.displayBase);
    }
    return left;
  }

  // Level 4: Bitwise AND `&`
  private parseBitAnd(): CalcValue | null {
    let left = this.parseShift();
    if (!left) return null;
    while (this.matchOp('&')) {
      const right = this.parseShift();
      if (!right) return null;
      left = makeNumber(Math.trunc(left.amount) & Math.trunc(right.amount), left.displayBase);
    }
    return left;
  }

  // Level 5: Shifts `<<`, `>>`
  private parseShift(): CalcValue | null {
    let left = this.parseAdditive();
    if (!left) return null;
    while (true) {
      const op = this.matchOp('<<', '>>');
      if (!op) break;
      const right = this.parseAdditive();
      if (!right) return null;
      const res =
        op === '<<'
          ? Math.trunc(left.amount) << Math.trunc(right.amount)
          : Math.trunc(left.amount) >> Math.trunc(right.amount);
      left = makeNumber(res, left.displayBase);
    }
    return left;
  }

  // Level 6: Additive `+`, `-`, `plus`, `and`, `with`, `minus`, `subtract`, `without`
  private parseAdditive(): CalcValue | null {
    let left = this.parsePercentagePhrase();
    if (!left) return null;

    while (true) {
      let sign = 0;
      if (this.matchOp('+') || this.matchIdent('plus', 'and', 'with')) {
        sign = 1;
      } else if (this.matchOp('-') || this.matchIdent('minus', 'subtract', 'without')) {
        sign = -1;
      }
      if (sign === 0) break;

      const right = this.parsePercentagePhrase();
      if (!right) return null;
      const combined = this.addOrSubValues(left, right, sign);
      if (!combined) return null;
      left = combined;
    }

    return left;
  }

  // Level 7: `20% of 150`, `10% off 37.99`, `20% on 150`
  private parsePercentagePhrase(): CalcValue | null {
    let left = this.parseMultiplicative();
    if (!left) return null;

    while (true) {
      const kw = this.matchIdent('of', 'off', 'on');
      if (!kw) break;
      const right = this.parsePercentagePhrase();
      if (!right) return null;

      const rate: number = left.kind === 'percent' ? left.amount / 100 : left.amount;
      if (kw === 'of') {
        left = { ...right, amount: rate * right.amount };
      } else if (kw === 'off') {
        left = { ...right, amount: right.amount * (1 - rate) };
      } else {
        left = { ...right, amount: right.amount * (1 + rate) };
      }
    }

    return left;
  }

  // Level 8: Multiplicative `*`, `/`, `mod`, implicit multiplication
  private parseMultiplicative(): CalcValue | null {
    let left = this.parsePower();
    if (!left) return null;

    while (true) {
      if (this.matchOp('*') || this.matchIdent('times', 'mul')) {
        const right = this.parsePower();
        if (!right) return null;
        const prod = this.multiplyValues(left, right);
        if (!prod) return null;
        left = prod;
        continue;
      }

      if (this.matchOp('/') || this.matchIdent('over')) {
        const right = this.parsePower();
        if (!right) return null;
        const quot = this.divideValues(left, right);
        if (!quot) return null;
        left = quot;
        continue;
      }

      if (this.matchIdent('mod', 'modulo')) {
        const right = this.parsePower();
        if (!right || right.amount === 0) return null;
        left = { ...left, amount: left.amount % right.amount };
        continue;
      }

      // Implicit multiplication: `2 pi`, `3(4+5)`, `(2+3)(4+5)`
      if (this.canImplicitMultiply(left)) {
        const right = this.parsePower();
        if (!right) return null;
        const prod = this.multiplyValues(left, right);
        if (!prod) return null;
        left = prod;
        continue;
      }

      break;
    }

    return left;
  }

  private canImplicitMultiply(left: CalcValue): boolean {
    const next = this.peek();
    if (!next) return false;
    if (next.kind === 'lparen') return true;
    if (left.kind === 'number' && next.kind === 'ident') {
      const low = next.value.toLowerCase();
      if (
        ['pi', 'π', 'e', 'tau', 'τ', 'phi', 'φ', 'ans', 'prev', 'sqrt', 'cbrt', 'sin', 'cos', 'tan', 'ln', 'log'].includes(
          low
        ) ||
        /^ans\d+$/i.test(low) ||
        this.ctx.variables.has(next.value) ||
        this.ctx.variables.has(low) ||
        this.ctx.forbiddenFutureVars.has(low)
      ) {
        return true;
      }
    }
    return false;
  }

  // Level 9: Power `^`, `**` (right-associative)
  private parsePower(): CalcValue | null {
    const base = this.parseUnary();
    if (!base) return null;
    if (this.matchOp('^', '**')) {
      const exp = this.parsePower();
      if (!exp) return null;
      const expNum = exp.kind === 'percent' ? exp.amount / 100 : exp.amount;
      return makeNumber(Math.pow(base.amount, expNum));
    }
    return base;
  }

  // Level 10: Unary `-`, `+`, `~`, prefix functions (`sqrt 16`, `sin 45°`, `sin(45)`)
  private parseUnary(): CalcValue | null {
    if (this.matchOp('-')) {
      const inner = this.parseUnary();
      if (!inner) return null;
      return { ...inner, amount: -inner.amount };
    }
    if (this.matchOp('+')) {
      return this.parseUnary();
    }
    if (this.matchOp('~')) {
      const inner = this.parseUnary();
      if (!inner) return null;
      return makeNumber(~Math.trunc(inner.amount), inner.displayBase);
    }

    const tok = this.peek();
    if (tok?.kind === 'ident') {
      const fnName = tok.value.toLowerCase();
      if (this.isCallableFunction(fnName)) {
        this.pos++;
        return this.parseFunctionApplication(fnName);
      }
    }

    return this.parsePostfix();
  }

  private isCallableFunction(low: string): boolean {
    return [
      'sin',
      'cos',
      'tan',
      'asin',
      'acos',
      'atan',
      'arcsin',
      'arccos',
      'arctan',
      'atan2',
      'sinh',
      'cosh',
      'tanh',
      'sqrt',
      'cbrt',
      'root',
      'abs',
      'sign',
      'exp',
      'pow',
      'ln',
      'log',
      'log10',
      'log2',
      'round',
      'floor',
      'ceil',
      'trunc',
      'fact',
      'gcd',
      'lcm',
      'ncr',
      'choose',
      'npr',
      'min',
      'max',
      'clamp',
    ].includes(low);
  }

  private parseFunctionApplication(fn: string): CalcValue | null {
    const args: CalcValue[] = [];
    if (this.peek()?.kind === 'lparen') {
      this.consume(); // (
      if (this.peek()?.kind !== 'rparen') {
        while (true) {
          const arg = this.parseConversion();
          if (!arg) return null;
          args.push(arg);
          if (this.peek()?.kind === 'comma') {
            this.consume();
            continue;
          }
          break;
        }
      }
      if (this.peek()?.kind !== 'rparen') return null;
      this.consume(); // )
    } else {
      // Numi-style prefix function without parens: `sqrt 16`, `sin 45°`, `log 2 (8)`
      const firstArg = this.parsePower();
      if (!firstArg) return null;
      args.push(firstArg);
      // Support Numi `log 2 (8)` => base 2 of 8
      if (fn === 'log' && this.peek()?.kind === 'lparen') {
        this.consume();
        const secondArg = this.parseConversion();
        if (!secondArg || this.peek()?.kind !== 'rparen') return null;
        this.consume();
        return makeNumber(Math.log(secondArg.amount) / Math.log(firstArg.amount));
      }
    }

    const x = args[0]?.amount ?? NaN;
    const y = args[1]?.amount ?? NaN;
    if (args.length === 0) return null;

    const toRadians = (v: CalcValue): number => {
      if (v.kind === 'unit' && v.unit === 'deg') return (v.amount * Math.PI) / 180;
      if (v.kind === 'unit' && v.unit === 'rad') return v.amount;
      return this.ctx.angleUnit === 'deg' ? (v.amount * Math.PI) / 180 : v.amount;
    };

    const fromRadians = (rad: number): CalcValue => {
      if (this.ctx.angleUnit === 'deg') {
        return { kind: 'unit', amount: (rad * 180) / Math.PI, unit: 'deg' };
      }
      return makeNumber(rad);
    };

    switch (fn) {
      case 'sqrt':
        return x < 0 ? null : makeNumber(Math.sqrt(x));
      case 'cbrt':
        return makeNumber(Math.cbrt(x));
      case 'root':
        return args.length >= 2 && y !== 0 ? makeNumber(Math.pow(x, 1 / y)) : null;
      case 'abs':
        return { ...args[0], amount: Math.abs(x) };
      case 'sign':
        return makeNumber(Math.sign(x));
      case 'exp':
        return makeNumber(Math.exp(x));
      case 'pow':
        return args.length >= 2 ? makeNumber(Math.pow(x, y)) : null;
      case 'ln':
        return x > 0 ? makeNumber(Math.log(x)) : null;
      case 'log10':
        return x > 0 ? makeNumber(Math.log10(x)) : null;
      case 'log2':
        return x > 0 ? makeNumber(Math.log2(x)) : null;
      case 'log':
        if (x <= 0) return null;
        if (args.length >= 2) {
          if (y <= 0 || y === 1) return null;
          return makeNumber(Math.log(x) / Math.log(y));
        }
        return makeNumber(Math.log10(x));
      case 'sin':
        return makeNumber(cleanTrigZero(Math.sin(toRadians(args[0]))));
      case 'cos':
        return makeNumber(cleanTrigZero(Math.cos(toRadians(args[0]))));
      case 'tan':
        return makeNumber(cleanTrigZero(Math.tan(toRadians(args[0]))));
      case 'sinh':
        return makeNumber(Math.sinh(x));
      case 'cosh':
        return makeNumber(Math.cosh(x));
      case 'tanh':
        return makeNumber(Math.tanh(x));
      case 'asin':
      case 'arcsin':
        return x >= -1 && x <= 1 ? fromRadians(Math.asin(x)) : null;
      case 'acos':
      case 'arccos':
        return x >= -1 && x <= 1 ? fromRadians(Math.acos(x)) : null;
      case 'atan':
      case 'arctan':
        return fromRadians(Math.atan(x));
      case 'atan2':
        return args.length >= 2 ? fromRadians(Math.atan2(x, y)) : null;
      case 'round': {
        const decimals = args.length >= 2 ? Math.trunc(y) : 0;
        const factor = Math.pow(10, decimals);
        return { ...args[0], amount: Math.round(x * factor) / factor };
      }
      case 'floor':
        return { ...args[0], amount: Math.floor(x) };
      case 'ceil':
        return { ...args[0], amount: Math.ceil(x) };
      case 'trunc':
        return { ...args[0], amount: Math.trunc(x) };
      case 'fact':
        return makeNumber(factorial(x));
      case 'gcd':
        if (args.length < 2) return null;
        return makeNumber(args.reduce((acc, cur) => gcdTwo(acc, cur.amount), args[0].amount));
      case 'lcm': {
        if (args.length < 2) return null;
        const lcmVal = args.reduce((acc, cur) => {
          const g = gcdTwo(acc, cur.amount);
          return g === 0 ? 0 : Math.abs((acc * cur.amount) / g);
        }, args[0].amount);
        return makeNumber(lcmVal);
      }
      case 'ncr':
      case 'choose': {
        if (args.length < 2) return null;
        const n = Math.round(x);
        const r = Math.round(y);
        if (r < 0 || n < 0 || r > n) return null;
        return makeNumber(factorial(n) / (factorial(r) * factorial(n - r)));
      }
      case 'npr': {
        if (args.length < 2) return null;
        const n = Math.round(x);
        const r = Math.round(y);
        if (r < 0 || n < 0 || r > n) return null;
        return makeNumber(factorial(n) / factorial(n - r));
      }
      case 'min':
        return { ...args[0], amount: Math.min(...args.map((a) => a.amount)) };
      case 'max':
        return { ...args[0], amount: Math.max(...args.map((a) => a.amount)) };
      case 'clamp':
        return args.length >= 3
          ? { ...args[0], amount: Math.min(Math.max(x, y), args[2].amount) }
          : null;
      default:
        return null;
    }
  }

  // Level 11: Postfix (`!`, `%`, units, currencies, compound units like `6 ft 2 in cm`)
  private parsePostfix(): CalcValue | null {
    let atom = this.parsePrimary();
    if (!atom) return null;

    while (true) {
      const next = this.peek();
      if (!next) break;

      // Factorial `!`
      if (next.kind === 'op' && next.value === '!') {
        this.pos++;
        atom = makeNumber(factorial(atom.amount));
        continue;
      }

      // Superscript powers `²` and `³`
      if (next.kind === 'op' && (next.value === '²' || next.value === '³')) {
        const p = next.value === '²' ? 2 : 3;
        this.pos++;
        atom = makeNumber(Math.pow(atom.amount, p), atom.displayBase);
        continue;
      }

      // `%` — either binary modulo (`10 % 3`) or postfix percentage (`20%`, `20% of 150`, `100 + 20%`)
      if (next.kind === 'op' && next.value === '%') {
        const afterPct = this.peek(1);
        const looksLikeModuloOperand =
          afterPct !== undefined &&
          (afterPct.kind === 'num' ||
            afterPct.kind === 'lparen' ||
            (afterPct.kind === 'ident' &&
              !['of', 'off', 'on', 'in', 'to', 'as', 'plus', 'and', 'with', 'minus', 'subtract', 'without', 'times', 'over', '__as_pct_of__'].includes(
                afterPct.value.toLowerCase()
              )));

        this.pos++;
        if (looksLikeModuloOperand) {
          const rhs = this.parsePower();
          if (!rhs || rhs.amount === 0) return null;
          atom = { ...atom, amount: atom.amount % rhs.amount };
        } else {
          atom = { kind: 'percent', amount: atom.amount };
        }
        continue;
      }

      // `‰` permille (1‰ = 0.1%)
      if (next.kind === 'op' && next.value === '‰') {
        this.pos++;
        atom = { kind: 'percent', amount: atom.amount / 10 };
        continue;
      }

      // Postfix currency symbol `50$` or `40€`
      if (next.kind === 'currSym' && atom.kind === 'number') {
        this.pos++;
        atom = { kind: 'currency', amount: atom.amount, currency: next.code };
        continue;
      }

      // Degree / °C / °F suffix
      if (next.kind === 'degSym' && atom.kind === 'number') {
        this.pos++;
        atom = { kind: 'unit', amount: atom.amount, unit: next.tempUnit ?? 'deg' };
        continue;
      }

      // Quote unit `6' 2"` or `12"`
      if (next.kind === 'quoteUnit' && atom.kind === 'number') {
        this.pos++;
        atom = { kind: 'unit', amount: atom.amount, unit: next.unitId };
        atom = this.tryConsumeCompoundUnit(atom);
        continue;
      }

      // Postfix currency code (`50 USD`, `$30 CAD`) or unit (`20 cm`, `6 ft 2 in cm`)
      if (next.kind === 'ident') {
        const low = next.value.toLowerCase();

        // Clarifying currency code on `$30 CAD` or `30 USD`
        const curr = resolveCurrency(next.value, this.ctx.defaultCurrency);
        if (curr && (atom.kind === 'number' || (atom.kind === 'currency' && atom.currency === 'USD'))) {
          this.pos++;
          atom = { kind: 'currency', amount: atom.amount, currency: curr };
          continue;
        }

        // Careful with `in`: `in` is conversion keyword when followed by a target (`20 km in miles`),
        // EXCEPT when `in` is at end of expression or followed by an operator or `in`/`to`/`as` (`20 in in cm` -> 20 inches in cm).
        if (low === 'in') {
          const afterIn = this.peek(1);
          const isInchUnit =
            afterIn === undefined ||
            afterIn.kind === 'rparen' ||
            afterIn.kind === 'comma' ||
            afterIn.kind === 'op' ||
            (afterIn.kind === 'ident' && ['in', 'to', 'as', 'plus', 'minus', 'and', 'with', 'without'].includes(afterIn.value.toLowerCase()));

          if (isInchUnit && atom.kind === 'number') {
            this.pos++;
            atom = { kind: 'unit', amount: atom.amount, unit: 'in' };
            continue;
          }
          break;
        }

        // Do not consume binary keywords as units
        if (
          [
            'to',
            'as',
            'of',
            'off',
            'on',
            'plus',
            'and',
            'with',
            'minus',
            'subtract',
            'without',
            'times',
            'mul',
            'over',
            'mod',
            'modulo',
            'xor',
            '__as_pct_of__',
          ].includes(low)
        ) {
          break;
        }

        const u = resolveUnit(next.value);
        if (u && atom.kind === 'number') {
          this.pos++;
          atom = { kind: 'unit', amount: atom.amount, unit: u.id };
          atom = this.tryConsumeCompoundUnit(atom);
          continue;
        }
      }

      break;
    }

    return atom;
  }

  /**
   * Handles compound units like `6 ft 2 in`, `6 ft 2 in cm`, `2 h 30 min`, `5 lb 8 oz`.
   */
  private tryConsumeCompoundUnit(first: CalcValue): CalcValue {
    if (first.kind !== 'unit' || !first.unit) return first;
    const nTok = this.peek(0);
    const uTok = this.peek(1);
    if (nTok?.kind !== 'num') return first;

    let secondUnitId: string | null = null;
    if (uTok?.kind === 'quoteUnit') {
      secondUnitId = uTok.unitId;
    } else if (uTok?.kind === 'ident') {
      if (uTok.value.toLowerCase() === 'in' && first.unit === 'ft') {
        secondUnitId = 'in';
      } else {
        const u2 = resolveUnit(uTok.value);
        if (u2) secondUnitId = u2.id;
      }
    }

    if (!secondUnitId || !areUnitsCompatible(first.unit, secondUnitId)) {
      return first;
    }

    const def1 = UNITS_BY_ID[first.unit];
    const def2 = UNITS_BY_ID[secondUnitId];
    if (!def1 || !def2 || def1.toBase <= def2.toBase) {
      return first;
    }

    this.pos += 2; // consume number + second unit
    const firstInSecond = convertUnitValue(first.amount, first.unit, secondUnitId);
    if (firstInSecond === null) return first;
    const combined: CalcValue = {
      kind: 'unit',
      amount: firstInSecond + nTok.value,
      unit: secondUnitId,
    };

    // Support Numi shorthand `6 ft 2 in cm` (where `in` did double duty before `cm`!)
    const afterCompound = this.peek();
    if (secondUnitId === 'in' && afterCompound?.kind === 'ident') {
      const targetUnit = resolveUnit(afterCompound.value);
      if (targetUnit && targetUnit.category === 'length' && !['in'].includes(afterCompound.value.toLowerCase())) {
        const conv = convertUnitValue(combined.amount, 'in', targetUnit.id);
        if (conv !== null) {
          this.pos++;
          return { kind: 'unit', amount: conv, unit: targetUnit.id };
        }
      }
    }

    return combined;
  }

  // Level 12: Primary (`123`, `$50`, `(expr)`, `ans`, `sum`, `avg`, `pi`, `today`, `varName`)
  private parsePrimary(): CalcValue | null {
    const tok = this.peek();
    if (!tok) return null;

    if (tok.kind === 'num') {
      this.pos++;
      return makeNumber(tok.value);
    }

    // Prefix currency symbol `$50` or `€(20 + 30)`
    if (tok.kind === 'currSym') {
      this.pos++;
      const inner = this.parseUnary();
      if (!inner) return null;
      // If inner already got clarified e.g. `$30 CAD`, keep `CAD`
      if (inner.kind === 'currency' && inner.currency && inner.currency !== 'USD') {
        return inner;
      }
      return { kind: 'currency', amount: inner.amount, currency: tok.code };
    }

    if (tok.kind === 'lparen') {
      this.pos++;
      const inner = this.parseConversion();
      if (!inner || this.peek()?.kind !== 'rparen') return null;
      this.pos++;
      return inner;
    }

    if (tok.kind === 'ident') {
      const raw = tok.value;
      const low = raw.toLowerCase();

      if (low === 'ans' || low === 'prev') {
        this.pos++;
        return this.ctx.ans ? { ...this.ctx.ans } : null;
      }

      if (low === 'pi' || raw === 'π') {
        this.pos++;
        return makeNumber(Math.PI);
      }
      if (low === 'tau' || raw === 'τ') {
        this.pos++;
        return makeNumber(Math.PI * 2);
      }
      if (low === 'e') {
        this.pos++;
        return makeNumber(Math.E);
      }
      if (low === 'phi' || raw === 'φ') {
        this.pos++;
        return makeNumber((1 + Math.sqrt(5)) / 2);
      }

      // Dates
      const nowDate = this.ctx.now ?? new Date();
      if (low === 'now') {
        this.pos++;
        return { kind: 'date', amount: nowDate.getTime() };
      }
      if (low === 'today' || low === 'tomorrow' || low === 'yesterday') {
        this.pos++;
        const d = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), 12, 0, 0, 0);
        if (low === 'tomorrow') d.setDate(d.getDate() + 1);
        if (low === 'yesterday') d.setDate(d.getDate() - 1);
        return { kind: 'date', amount: d.getTime() };
      }

      // Aggregates `sum`, `total`, `avg`, `average`, `mean`
      if (['sum', 'total', 'avg', 'average', 'mean'].includes(low)) {
        this.pos++;
        return this.computeAggregate(low === 'sum' || low === 'total' ? 'sum' : 'avg');
      }

      // Check illegal backward/future row variable reference
      if (this.ctx.forbiddenFutureVars.has(low)) {
        this.pos++;
        throw new FutureReferenceError(raw);
      }

      // Known variable in scope (defined strictly on an earlier row)
      const found = this.ctx.variables.get(raw) ?? this.ctx.variables.get(low);
      if (found) {
        this.pos++;
        return { ...found };
      }
    }

    return null;
  }

  private computeAggregate(mode: 'sum' | 'avg'): CalcValue | null {
    const vals = this.ctx.getBlockValues();
    if (vals.length === 0) return null;
    let acc: CalcValue = { ...vals[0] };
    for (let i = 1; i < vals.length; i++) {
      const next = this.addOrSubValues(acc, vals[i], 1);
      if (!next) {
        acc = makeNumber(acc.amount + vals[i].amount);
      } else {
        acc = next;
      }
    }
    if (mode === 'avg') {
      acc = { ...acc, amount: acc.amount / vals.length };
    }
    return acc;
  }

  private addOrSubValues(left: CalcValue, right: CalcValue, sign: number): CalcValue | null {
    // Percent +/- Percent => Percent (`10% + 5%` => `15%`)
    if (left.kind === 'percent' && right.kind === 'percent') {
      return { kind: 'percent', amount: left.amount + sign * right.amount };
    }

    // X +/- P% => X * (1 +/- P/100)
    if (right.kind === 'percent' && left.kind !== 'date') {
      const factor = 1 + sign * (right.amount / 100);
      return { ...left, amount: left.amount * factor };
    }

    // Date +/- time unit (`today + 2 weeks`)
    if (left.kind === 'date' && right.kind === 'unit' && right.unit) {
      const u = UNITS_BY_ID[right.unit];
      if (u?.category === 'time') {
        const deltaMs = right.amount * u.toBase * 1000 * sign;
        return { kind: 'date', amount: left.amount + deltaMs };
      }
      return null;
    }

    // Date - Date => days
    if (left.kind === 'date' && right.kind === 'date' && sign === -1) {
      const days = (left.amount - right.amount) / 86_400_000;
      return { kind: 'unit', amount: days, unit: 'day' };
    }

    // Currency +/- Currency
    if (left.kind === 'currency' && left.currency) {
      if (right.kind === 'currency' && right.currency) {
        const rhsInLeft = convertCurrency(right.amount, right.currency, left.currency, this.ctx.rates);
        return { kind: 'currency', amount: left.amount + sign * rhsInLeft, currency: left.currency };
      }
      if (right.kind === 'number') {
        return { kind: 'currency', amount: left.amount + sign * right.amount, currency: left.currency };
      }
    }
    if (left.kind === 'number' && right.kind === 'currency' && right.currency) {
      return { kind: 'currency', amount: left.amount + sign * right.amount, currency: right.currency };
    }

    // Unit +/- Unit
    if (left.kind === 'unit' && left.unit) {
      if (right.kind === 'unit' && right.unit) {
        if (UNITS_BY_ID[left.unit]?.category === 'temperature') {
          if (left.unit === right.unit) {
            return { kind: 'unit', amount: left.amount + sign * right.amount, unit: left.unit };
          }
          return null;
        }
        const rhsConv = convertUnitValue(right.amount, right.unit, left.unit);
        if (rhsConv === null) return null;
        return { kind: 'unit', amount: left.amount + sign * rhsConv, unit: left.unit };
      }
      if (right.kind === 'number') {
        return { kind: 'unit', amount: left.amount + sign * right.amount, unit: left.unit };
      }
    }
    if (left.kind === 'number' && right.kind === 'unit' && right.unit) {
      return { kind: 'unit', amount: left.amount + sign * right.amount, unit: right.unit };
    }

    return makeNumber(left.amount + sign * right.amount, left.displayBase);
  }

  private multiplyValues(left: CalcValue, right: CalcValue): CalcValue | null {
    if (left.kind === 'date' || right.kind === 'date') return null;

    if (left.kind === 'percent' && right.kind === 'percent') {
      return { kind: 'percent', amount: (left.amount * right.amount) / 100 };
    }
    if (right.kind === 'percent') {
      return { ...left, amount: left.amount * (right.amount / 100) };
    }
    if (left.kind === 'percent') {
      return { ...right, amount: (left.amount / 100) * right.amount };
    }

    if (left.kind === 'currency' && right.kind === 'number') {
      return { kind: 'currency', amount: left.amount * right.amount, currency: left.currency };
    }
    if (left.kind === 'number' && right.kind === 'currency') {
      return { kind: 'currency', amount: left.amount * right.amount, currency: right.currency };
    }

    if (left.kind === 'unit' && right.kind === 'number') {
      return { kind: 'unit', amount: left.amount * right.amount, unit: left.unit };
    }
    if (left.kind === 'number' && right.kind === 'unit') {
      return { kind: 'unit', amount: left.amount * right.amount, unit: right.unit };
    }

    // Length * Length -> Area (`10 m * 5 m` => `50 m²`, `10 ft * 12 ft` => `120 ft²`)
    if (left.kind === 'unit' && right.kind === 'unit' && left.unit && right.unit) {
      const uL = UNITS_BY_ID[left.unit];
      const uR = UNITS_BY_ID[right.unit];
      if (uL?.category === 'length' && uR?.category === 'length') {
        const rInL = convertUnitValue(right.amount, right.unit, left.unit);
        if (rInL !== null) {
          const areaMap: Record<string, string> = { cm: 'cm2', m: 'm2', km: 'km2', in: 'in2', ft: 'ft2' };
          const areaId = areaMap[left.unit];
          if (areaId) {
            return { kind: 'unit', amount: left.amount * rInL, unit: areaId };
          }
          const inMeters = left.amount * uL.toBase * (right.amount * uR.toBase);
          return { kind: 'unit', amount: inMeters, unit: 'm2' };
        }
      }
    }

    return makeNumber(left.amount * right.amount, left.displayBase);
  }

  private divideValues(left: CalcValue, right: CalcValue): CalcValue | null {
    if (right.amount === 0 || left.kind === 'date' || right.kind === 'date') return null;

    if (right.kind === 'percent') {
      return { ...left, amount: left.amount / (right.amount / 100) };
    }

    // Currency / Currency => dimensionless ratio
    if (left.kind === 'currency' && left.currency && right.kind === 'currency' && right.currency) {
      const rhsInLeft = convertCurrency(right.amount, right.currency, left.currency, this.ctx.rates);
      if (rhsInLeft === 0) return null;
      return makeNumber(left.amount / rhsInLeft);
    }

    // Compatible Unit / Unit => dimensionless ratio
    if (left.kind === 'unit' && left.unit && right.kind === 'unit' && right.unit) {
      if (areUnitsCompatible(left.unit, right.unit)) {
        const rhsInLeft = convertUnitValue(right.amount, right.unit, left.unit);
        if (rhsInLeft === null || rhsInLeft === 0) return null;
        return makeNumber(left.amount / rhsInLeft);
      }
      // Distance / Time => Speed (`100 km / 2 h` => `50 km/h`)
      const uL = UNITS_BY_ID[left.unit];
      const uR = UNITS_BY_ID[right.unit];
      if (uL?.category === 'length' && uR?.category === 'time') {
        if (left.unit === 'km' && right.unit === 'h') {
          return { kind: 'unit', amount: left.amount / right.amount, unit: 'kph' };
        }
        if (left.unit === 'mi' && right.unit === 'h') {
          return { kind: 'unit', amount: left.amount / right.amount, unit: 'mph' };
        }
        const mps = (left.amount * uL.toBase) / (right.amount * uR.toBase);
        return { kind: 'unit', amount: mps, unit: 'mps' };
      }
    }

    if (left.kind === 'currency' && right.kind === 'number') {
      return { kind: 'currency', amount: left.amount / right.amount, currency: left.currency };
    }
    if (left.kind === 'unit' && right.kind === 'number') {
      return { kind: 'unit', amount: left.amount / right.amount, unit: left.unit };
    }
    if (left.kind === 'percent' && right.kind === 'number') {
      return { kind: 'percent', amount: left.amount / right.amount };
    }

    return makeNumber(left.amount / right.amount, left.displayBase);
  }
}

function cleanTrigZero(n: number): number {
  return Math.abs(n) < 1e-12 ? 0 : n;
}

const KNOWN_KEYWORDS_AND_BASES = new Set([
  'in',
  'to',
  'as',
  'of',
  'off',
  'on',
  'plus',
  'and',
  'with',
  'minus',
  'subtract',
  'without',
  'times',
  'mul',
  'over',
  'mod',
  'modulo',
  'xor',
  'hex',
  'hexadecimal',
  'bin',
  'binary',
  'oct',
  'octal',
  'dec',
  'decimal',
  'percent',
  'percentage',
  'ans',
  'prev',
  'sum',
  'total',
  'avg',
  'average',
  'mean',
  'pi',
  'π',
  'tau',
  'τ',
  'e',
  'phi',
  'φ',
  'today',
  'now',
  'tomorrow',
  'yesterday',
  '__as_pct_of__',
]);

const CALLABLE_FN_SET = new Set([
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'arcsin',
  'arccos',
  'arctan',
  'atan2',
  'sinh',
  'cosh',
  'tanh',
  'sqrt',
  'cbrt',
  'root',
  'abs',
  'sign',
  'exp',
  'pow',
  'ln',
  'log',
  'log10',
  'log2',
  'round',
  'floor',
  'ceil',
  'trunc',
  'fact',
  'gcd',
  'lcm',
  'ncr',
  'choose',
  'npr',
  'min',
  'max',
  'clamp',
]);

function filterDescriptiveWords(tokens: LexToken[], ctx: EvalContext): LexToken[] {
  const isKnownIdent = (raw: string): boolean => {
    const low = raw.toLowerCase();
    if (KNOWN_KEYWORDS_AND_BASES.has(low) || CALLABLE_FN_SET.has(low)) return true;
    if (/^ans\d+$/i.test(low)) return true;
    if (ctx.variables.has(raw) || ctx.variables.has(low)) return true;
    if (ctx.forbiddenFutureVars.has(low)) return true;
    if (resolveCurrency(raw, ctx.defaultCurrency) !== null) return true;
    if (resolveUnit(raw) !== null) return true;
    return false;
  };

  // Strip leading unknown annotation words (e.g. `har 32` -> `32`)
  let startIdx = 0;
  while (
    startIdx < tokens.length &&
    tokens[startIdx].kind === 'ident' &&
    !isKnownIdent((tokens[startIdx] as { kind: 'ident'; value: string }).value)
  ) {
    const next = tokens[startIdx + 1];
    // Only strip leading word if followed by a number, currency symbol, `(`, or another descriptive word
    if (
      next &&
      (next.kind === 'num' ||
        next.kind === 'currSym' ||
        next.kind === 'lparen' ||
        (next.kind === 'ident' && !['+', '-', '*', '/', '^'].includes(next.value)))
    ) {
      startIdx++;
    } else {
      break;
    }
  }

  const out: LexToken[] = [];
  for (let i = startIdx; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.kind === 'ident' && !isKnownIdent(tok.value)) {
      const prev = out[out.length - 1];
      // Strip descriptive words attached right after a number, `%`, `)`, unit, or currency (e.g. `2 singel + 0.7 gul`)
      if (
        prev &&
        (prev.kind === 'num' ||
          prev.kind === 'rparen' ||
          prev.kind === 'currSym' ||
          prev.kind === 'degSym' ||
          prev.kind === 'quoteUnit' ||
          (prev.kind === 'op' && prev.value === '%') ||
          prev.kind === 'ident')
      ) {
        continue;
      }
    }
    out.push(tok);
  }
  return out;
}

export function evaluateExpressionString(rawExpr: string, ctx: EvalContext): CalcValue | null {
  const trimmed = rawExpr.trim();
  if (!trimmed) return null;
  const rawTokens = lexExpression(trimmed, ctx.defaultCurrency);
  if (!rawTokens || rawTokens.length === 0) return null;
  const tokens = filterDescriptiveWords(rawTokens, ctx);
  if (tokens.length === 0) return null;
  const parser = new ExpressionParser(tokens, ctx);
  return parser.parseFull();
}
