import { HighlightSpan } from '../types';
import { resolveCurrency, SYMBOL_TO_CURRENCY } from './currencies';
import { resolveUnit } from './units';

export const FUNCTION_NAMES = new Set([
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
  'sum',
  'total',
  'avg',
  'average',
  'mean',
]);

export const KEYWORD_WORDS = new Set([
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
  'bin',
  'binary',
  'oct',
  'octal',
  'dec',
  'decimal',
  'today',
  'now',
  'tomorrow',
  'yesterday',
]);

export const CONSTANTS_SET = new Set(['pi', 'e', 'tau', 'phi']);

const MULTI_CHAR_CURRENCY_SYMBOLS = Object.keys(SYMBOL_TO_CURRENCY)
  .filter((s) => s.length > 1)
  .sort((a, b) => b.length - a.length);

const SINGLE_CHAR_CURRENCY_SYMBOLS = new Set(
  Object.keys(SYMBOL_TO_CURRENCY).filter((s) => s.length === 1)
);

export function isSeparatorLine(raw: string): boolean {
  return /^\s*-{3,}\s*$/.test(raw);
}

export function isHelpCommand(raw: string): boolean {
  return /^\s*\/help\s*$/i.test(raw);
}

export function isCharCommand(raw: string): boolean {
  return /^\s*\/char\s*$/i.test(raw);
}

/**
 * Produces a lossless array of HighlightSpans whose concatenated text equals `line` exactly.
 */
export function highlightLine(
  line: string,
  knownVariables: Set<string>,
  defaultCurrency = 'USD'
): HighlightSpan[] {
  if (line.length === 0) return [];

  if (isSeparatorLine(line)) {
    return [{ type: 'separator', text: line }];
  }

  if (isHelpCommand(line) || isCharCommand(line)) {
    return [{ type: 'command', text: line }];
  }

  if (/^\s*#/.test(line)) {
    return [{ type: 'heading', text: line }];
  }

  if (/^\s*\/\//.test(line)) {
    return [{ type: 'comment', text: line }];
  }

  const spans: HighlightSpan[] = [];
  const pushSpan = (type: HighlightSpan['type'], text: string) => {
    if (!text) return;
    const prev = spans[spans.length - 1];
    if (prev && prev.type === type) {
      prev.text += text;
    } else {
      spans.push({ type, text });
    }
  };

  // Detect inline comment start `//`
  const commentIdx = line.indexOf('//');
  const codePart = commentIdx >= 0 ? line.slice(0, commentIdx) : line;
  const commentPart = commentIdx >= 0 ? line.slice(commentIdx) : '';

  let i = 0;

  // Detect leading `Label: ` (only if no `=` before `:`)
  const colonMatch = /^(\s*[A-Za-z][^=:]*:\s*)/.exec(codePart);
  if (colonMatch) {
    pushSpan('label', colonMatch[1]);
    i = colonMatch[1].length;
  }

  while (i < codePart.length) {
    const rest = codePart.slice(i);
    const ch = codePart[i];

    // Whitespace
    if (/\s/.test(ch)) {
      const ws = /^\s+/.exec(rest)![0];
      pushSpan('text', ws);
      i += ws.length;
      continue;
    }

    // Multi-char currency symbols (CA$, HK$, CN¥, etc.)
    let matchedCurrSym = '';
    for (const sym of MULTI_CHAR_CURRENCY_SYMBOLS) {
      if (rest.startsWith(sym)) {
        matchedCurrSym = sym;
        break;
      }
    }
    if (matchedCurrSym) {
      pushSpan('currency', matchedCurrSym);
      i += matchedCurrSym.length;
      continue;
    }

    // Single-char currency symbols ($, €, £, ¥, ₿, etc.)
    if (SINGLE_CHAR_CURRENCY_SYMBOLS.has(ch)) {
      pushSpan('currency', ch);
      i += 1;
      continue;
    }

    // Hex / Binary / Octal literals
    const baseMatch = /^(?:0x[0-9a-fA-F_]+|0b[01_]+|0o[0-7_]+)/i.exec(rest);
    if (baseMatch) {
      pushSpan('number', baseMatch[0]);
      i += baseMatch[0].length;
      continue;
    }

    // Decimal / scientific numbers (with optional thousands commas `2,800.50` or spaces `4 200.50`)
    const numMatch =
      /^(?:\d{1,3}(?:,\d{3})+(?!\d)(?:\.\d+)?|\d{1,3}(?:[ \u00A0\u202F]\d{3})+(?!\d)(?:\.\d+)?|\d+(?:_\d+)*(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?/i.exec(
        rest
      );
    if (numMatch) {
      pushSpan('number', numMatch[0]);
      i += numMatch[0].length;
      continue;
    }

    // Degree + temp symbols °C, °F, °
    if (rest.startsWith('°C') || rest.startsWith('°c') || rest.startsWith('°F') || rest.startsWith('°f')) {
      pushSpan('unit', rest.slice(0, 2));
      i += 2;
      continue;
    }
    if (ch === '°') {
      pushSpan('unit', '°');
      i += 1;
      continue;
    }

    // Multi-char operators
    if (rest.startsWith('<<') || rest.startsWith('>>') || rest.startsWith('**')) {
      pushSpan('operator', rest.slice(0, 2));
      i += 2;
      continue;
    }

    // √ and ∛ prefix roots
    if (ch === '√' || ch === '∛') {
      pushSpan('function', ch);
      i += 1;
      continue;
    }

    // Superscript powers ², ³ and permille ‰
    if (ch === '²' || ch === '³' || ch === '‰') {
      pushSpan('operator', ch);
      i += 1;
      continue;
    }

    // Single-char operators
    if ('+-*×/÷^%!&|~='.includes(ch) || ch === '−' || ch === '⊕') {
      pushSpan('operator', ch);
      i += 1;
      continue;
    }

    // Parentheses & comma
    if ('(),'.includes(ch)) {
      pushSpan('paren', ch);
      i += 1;
      continue;
    }

    // Identifiers / words (including π, τ, φ, m², km/h)
    const speedMatch = /^(?:km\/h|m\/s)\b/i.exec(rest);
    if (speedMatch) {
      pushSpan('unit', speedMatch[0]);
      i += speedMatch[0].length;
      continue;
    }

    // Area superscript units (mm², cm², m², km²) before general identifiers
    const areaSuperMatch = /^(?:mm|cm|m|km)²/i.exec(rest);
    if (areaSuperMatch) {
      pushSpan('unit', areaSuperMatch[0]);
      i += areaSuperMatch[0].length;
      continue;
    }

    const wordMatch = /^[A-Za-z_\u03C0\u03C4\u03C6][A-Za-z0-9_]*/.exec(rest);
    if (wordMatch) {
      const word = wordMatch[0];
      const lower = word.toLowerCase();

      // Check if assignment target `varName =`
      const afterWord = codePart.slice(i + word.length);
      if (/^\s*=(?!=)/.test(afterWord)) {
        pushSpan('variable', word);
      } else if (lower === 'ans' || lower === 'prev') {
        pushSpan('ans', word);
      } else if (/^ans\d+$/i.test(word) || knownVariables.has(word) || knownVariables.has(lower)) {
        pushSpan('variable', word);
      } else if (FUNCTION_NAMES.has(lower)) {
        pushSpan('function', word);
      } else if (CONSTANTS_SET.has(lower) || word === 'π' || word === 'τ' || word === 'φ') {
        pushSpan('number', word);
      } else if (resolveCurrency(word, defaultCurrency)) {
        pushSpan('currency', word);
      } else if (KEYWORD_WORDS.has(lower)) {
        pushSpan('keyword', word);
      } else if (resolveUnit(word)) {
        pushSpan('unit', word);
      } else {
        pushSpan('text', word);
      }
      i += word.length;
      continue;
    }

    // Quotes used as ft/in units after numbers
    if (ch === '"' || ch === "'") {
      pushSpan('unit', ch);
      i += 1;
      continue;
    }

    pushSpan('text', ch);
    i += 1;
  }

  if (commentPart) {
    pushSpan('comment', commentPart);
  }

  return spans;
}
