import {
  CalcValue,
  CalculatorSettings,
  EvaluatedRow,
  SheetRow,
  ThousandsSeparator,
} from '../types';
import { convertCurrency, CURRENCIES } from './currencies';
import { evaluateExpressionString, FutureReferenceError } from './parser';
import { highlightLine, isCharCommand, isHelpCommand, isSeparatorLine } from './tokenizer';
import { UNITS_BY_ID } from './units';

const RESERVED_VAR_NAMES = new Set([
  'ans',
  'prev',
  'sum',
  'total',
  'avg',
  'average',
  'mean',
  'pi',
  'e',
  'tau',
  'phi',
  'in',
  'to',
  'as',
  'of',
  'off',
  'on',
  'today',
  'now',
  'tomorrow',
  'yesterday',
]);

function applyThousands(intPart: string, sep: ThousandsSeparator): string {
  if (sep === 'none') return intPart;
  const char = sep === 'space' ? ' ' : ',';
  const sign = intPart.startsWith('-') ? '-' : '';
  const digits = sign ? intPart.slice(1) : intPart;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, char);
  return sign + grouped;
}

export function formatNumberRaw(
  value: number,
  maxDecimals: number,
  sep: ThousandsSeparator,
  minDecimals = 0
): string {
  if (!Number.isFinite(value)) return '';
  if (Object.is(value, -0) || Math.abs(value) < 1e-12) value = 0;

  const abs = Math.abs(value);
  if (abs > 0 && (abs >= 1e15 || abs < 1e-7)) {
    return value.toExponential(Math.min(maxDecimals, 6)).replace(/\.?0+e/, 'e');
  }

  const fixed = value.toFixed(Math.max(0, Math.min(10, maxDecimals)));
  const [rawInt, rawFrac = ''] = fixed.split('.');
  const intFormatted = applyThousands(rawInt, sep);

  if (maxDecimals === 0) return intFormatted;

  let trimmedFrac = rawFrac.replace(/0+$/, '');
  while (trimmedFrac.length < minDecimals) {
    trimmedFrac += '0';
  }

  return trimmedFrac.length > 0 ? `${intFormatted}.${trimmedFrac}` : intFormatted;
}

export function formatCalcValue(val: CalcValue, settings: CalculatorSettings): string {
  if (val.displayBase && val.displayBase !== 'dec') {
    const n = Math.trunc(val.amount);
    const sign = n < 0 ? '-' : '';
    const abs = Math.abs(n);
    if (val.displayBase === 'hex') return `${sign}0x${abs.toString(16).toUpperCase()}`;
    if (val.displayBase === 'bin') return `${sign}0b${abs.toString(2)}`;
    if (val.displayBase === 'oct') return `${sign}0o${abs.toString(8)}`;
  }

  if (val.kind === 'date') {
    const d = new Date(val.amount);
    const hasTime = d.getHours() !== 12 || d.getMinutes() !== 0;
    if (hasTime) {
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  if (val.kind === 'percent') {
    return `${formatNumberRaw(val.amount, settings.precision, settings.thousandsSeparator)}%`;
  }

  if (val.kind === 'currency' && val.currency) {
    const info = CURRENCIES[val.currency];
    const isInt = Math.abs(val.amount - Math.round(val.amount)) < 1e-9;
    const defaultDec = info?.decimals ?? 2;
    const maxDec = Math.max(defaultDec, settings.precision);
    const minDec = isInt ? 0 : Math.min(2, defaultDec);

    const sign = val.amount < 0 ? '-' : '';
    const numStr = formatNumberRaw(
      Math.abs(val.amount),
      maxDec,
      settings.thousandsSeparator,
      minDec
    );

    if (!info) return `${sign}${numStr} ${val.currency}`;
    if (info.symbolPosition === 'prefix') {
      return `${sign}${info.symbol}${numStr}`;
    }
    if (info.symbolPosition === 'suffix') {
      return `${sign}${numStr} ${info.symbol}`;
    }
    return `${sign}${numStr} ${info.code}`;
  }

  if (val.kind === 'unit' && val.unit) {
    const uDef = UNITS_BY_ID[val.unit];
    const numStr = formatNumberRaw(val.amount, settings.precision, settings.thousandsSeparator);
    if (!uDef) return `${numStr} ${val.unit}`;
    if (uDef.symbol === '°') return `${numStr}°`;
    return `${numStr} ${uDef.symbol}`;
  }

  return formatNumberRaw(val.amount, settings.precision, settings.thousandsSeparator);
}

function stripInlineComment(line: string): string {
  const idx = line.indexOf('//');
  return idx >= 0 ? line.slice(0, idx) : line;
}

function extractAssignmentOrLabel(codePart: string): {
  assignedVar?: string;
  exprText: string;
} {
  // Check assignment: `varName = expression`
  const assignMatch = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)\s*(.+)$/.exec(codePart);
  if (assignMatch) {
    const candidate = assignMatch[1];
    if (!RESERVED_VAR_NAMES.has(candidate.toLowerCase()) && !/^ans\d+$/i.test(candidate)) {
      return { assignedVar: candidate, exprText: assignMatch[2] };
    }
  }

  // Check Numi label prefix: `Flight ticket: $420`
  const labelMatch = /^\s*[A-Za-z][^=:]*:\s*(.+)$/.exec(codePart);
  if (labelMatch) {
    return { exprText: labelMatch[1] };
  }

  return { exprText: codePart };
}

export function evaluateSheet(
  rows: SheetRow[],
  settings: CalculatorSettings,
  rates: Record<string, number>,
  now?: Date
): EvaluatedRow[] {
  // Pre-collect row-defined variables (`autoVar` and `assignedVar`) with their defining row indices
  // so we can strictly block backward/forward references to current or later rows!
  const varRowMap = new Map<string, number[]>();
  const registerRowVar = (name: string, rowIdx: number) => {
    const key = name.toLowerCase();
    const list = varRowMap.get(key) ?? [];
    list.push(rowIdx);
    varRowMap.set(key, list);
  };

  for (let idx = 0; idx < rows.length; idx++) {
    const r = rows[idx];
    if (r.autoVar) {
      registerRowVar(r.autoVar, idx);
    }
    const clean = stripInlineComment(r.text);
    const { assignedVar } = extractAssignmentOrLabel(clean);
    if (assignedVar) {
      registerRowVar(assignedVar, idx);
    }
  }

  const results: EvaluatedRow[] = [];
  const activeVars = new Map<string, CalcValue>();
  const knownHighlightVars = new Set<string>();
  let runningAns: CalcValue | null = null;
  let lastOutputRowIdx = -1;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const raw = row.text;
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      results.push({
        rowId: row.id,
        lineIndex: i,
        kind: 'empty',
        value: null,
        formatted: null,
        autoVar: row.autoVar,
        isLatestAns: false,
        highlights: [],
      });
      continue;
    }

    if (isSeparatorLine(raw)) {
      // Purely visual separator: does NOT alter `runningAns` or variables!
      results.push({
        rowId: row.id,
        lineIndex: i,
        kind: 'separator',
        value: null,
        formatted: null,
        autoVar: row.autoVar,
        isLatestAns: false,
        highlights: highlightLine(raw, knownHighlightVars, settings.defaultCurrency),
      });
      continue;
    }

    if (isHelpCommand(raw) || isCharCommand(raw)) {
      results.push({
        rowId: row.id,
        lineIndex: i,
        kind: 'command',
        value: null,
        formatted: isCharCommand(raw) ? 'Open Symbols ↵' : 'Open Help ↵',
        autoVar: row.autoVar,
        isLatestAns: false,
        highlights: highlightLine(raw, knownHighlightVars, settings.defaultCurrency),
      });
      continue;
    }

    if (trimmed.startsWith('#')) {
      results.push({
        rowId: row.id,
        lineIndex: i,
        kind: 'heading',
        value: null,
        formatted: null,
        autoVar: row.autoVar,
        isLatestAns: false,
        highlights: highlightLine(raw, knownHighlightVars, settings.defaultCurrency),
      });
      continue;
    }

    if (trimmed.startsWith('//')) {
      results.push({
        rowId: row.id,
        lineIndex: i,
        kind: 'comment',
        value: null,
        formatted: null,
        autoVar: row.autoVar,
        isLatestAns: false,
        highlights: highlightLine(raw, knownHighlightVars, settings.defaultCurrency),
      });
      continue;
    }

    const codePart = stripInlineComment(raw);
    const { assignedVar, exprText } = extractAssignmentOrLabel(codePart);

    // Determine variables defined ONLY on current or future rows (`>= i`) and not yet in `activeVars`
    const forbiddenFutureVars = new Set<string>();
    for (const [varKey, indices] of varRowMap.entries()) {
      const hasEarlierDef = indices.some((idx) => idx < i) && activeVars.has(varKey);
      const hasCurrentOrLaterDef = indices.some((idx) => idx >= i);
      if (!hasEarlierDef && hasCurrentOrLaterDef) {
        forbiddenFutureVars.add(varKey);
      }
    }

    const getBlockValues = (): CalcValue[] => {
      const block: CalcValue[] = [];
      for (let k = i - 1; k >= 0; k--) {
        const prevRow = results[k];
        if (prevRow.kind === 'empty' || prevRow.kind === 'heading') {
          break;
        }
        // `separator` (`---`) and `comment` (`//`) are purely visual and do not break or pollute the block
        if (prevRow.value) {
          block.unshift(prevRow.value);
        }
      }
      return block;
    };

    let evaluated: CalcValue | null = null;
    let refError: string | undefined;

    try {
      evaluated = evaluateExpressionString(exprText, {
        ans: runningAns,
        variables: activeVars,
        forbiddenFutureVars,
        getBlockValues,
        rates,
        defaultCurrency: settings.defaultCurrency,
        angleUnit: settings.angleUnit,
        now,
      });

      // Numi-style trailing descriptive noun fallback: e.g. `ans - 5% discount` or `$120 / 4 people`
      if (!evaluated) {
        const strippedTrailingWord = exprText.replace(/\s+[A-Za-z]{2,}\s*$/, '');
        if (strippedTrailingWord !== exprText && /[0-9%$€£¥+\-*/^()]/.test(strippedTrailingWord)) {
          evaluated = evaluateExpressionString(strippedTrailingWord, {
            ans: runningAns,
            variables: activeVars,
            forbiddenFutureVars,
            getBlockValues,
            rates,
            defaultCurrency: settings.defaultCurrency,
            angleUnit: settings.angleUnit,
            now,
          });
        }
      }
    } catch (err) {
      if (err instanceof FutureReferenceError) {
        refError = err.message;
      }
    }

    if (evaluated) {
      runningAns = evaluated;
      lastOutputRowIdx = i;

      if (assignedVar) {
        activeVars.set(assignedVar, evaluated);
        activeVars.set(assignedVar.toLowerCase(), evaluated);
        knownHighlightVars.add(assignedVar);
        knownHighlightVars.add(assignedVar.toLowerCase());
      }
      if (row.autoVar) {
        activeVars.set(row.autoVar, evaluated);
        activeVars.set(row.autoVar.toLowerCase(), evaluated);
        knownHighlightVars.add(row.autoVar);
        knownHighlightVars.add(row.autoVar.toLowerCase());
      }
    }

    const highlights = highlightLine(raw, knownHighlightVars, settings.defaultCurrency);

    results.push({
      rowId: row.id,
      lineIndex: i,
      kind: 'expression',
      value: evaluated,
      formatted: evaluated ? formatCalcValue(evaluated, settings) : null,
      assignedVar,
      autoVar: row.autoVar,
      isLatestAns: false,
      refError,
      highlights,
    });
  }

  if (lastOutputRowIdx >= 0) {
    results[lastOutputRowIdx].isLatestAns = true;
  }

  return results;
}

/**
 * Computes the Numi-style bottom-right `Total: ...` value across all numeric/currency rows.
 */
export function computeSheetTotalText(
  evaluatedRows: ReadonlyArray<EvaluatedRow>,
  settings: CalculatorSettings,
  rates: Record<string, number>
): string | null {
  const values = evaluatedRows
    .map((r) => r.value)
    .filter((v): v is CalcValue => v !== null && v.kind !== 'date' && v.kind !== 'percent');
  if (values.length === 0) return null;

  const hasCurrency = values.some((v) => v.kind === 'currency');
  if (hasCurrency) {
    const targetCurr =
      values.find((v) => v.kind === 'currency')?.currency ?? settings.defaultCurrency;
    let sum = 0;
    for (const v of values) {
      if (v.kind === 'currency' && v.currency) {
        sum += convertCurrency(v.amount, v.currency, targetCurr, rates);
      } else if (v.kind === 'number') {
        sum += v.amount;
      }
    }
    return formatCalcValue({ kind: 'currency', amount: sum, currency: targetCurr }, settings);
  }

  const totalNum = values.reduce((acc, v) => acc + v.amount, 0);
  return formatCalcValue({ kind: 'number', amount: totalNum }, settings);
}
