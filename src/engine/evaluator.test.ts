import { describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import { CalculatorSettings, CalculatorTab, SheetRow } from '../types';
import { getInitialRates } from './currencies';
import { computeSheetTotalText, evaluateSheet } from './evaluator';
import {
  createArchivedTab,
  getArchiveStatusInfo,
  isTabWorthArchiving,
  pruneExpiredArchives,
} from './archive';
import {
  createFreshSheetTab,
  deriveAutoTabTitle,
  generateUniqueShortCode,
  isBareHeadingPrompt,
  normalizeLoadedTabs,
  resolveTabTitle,
} from './tabNaming';
import {
  buildExportFilename,
  formatSheetAsCsv,
  formatSheetAsMarkdown,
  formatSheetForClipboard,
} from './exporter';

if (typeof (globalThis as Record<string, unknown>).Temporal === 'undefined') {
  (globalThis as Record<string, unknown>).Temporal = Temporal;
}

const defaultSettings: CalculatorSettings = {
  theme: 'light',
  precision: 4,
  defaultCurrency: 'USD',
  angleUnit: 'deg',
  thousandsSeparator: 'comma',
  fontSize: 'md',
  archiveRetentionDays: 30,
};

const fixedRates = {
  ...getInitialRates().rates,
  USD: 1,
  EUR: 0.9,
  SEK: 10,
  CAD: 1.4,
  JPY: 150,
};

function makeRows(lines: Array<string | { text: string; autoVar?: string }>): SheetRow[] {
  return lines.map((entry, idx) =>
    typeof entry === 'string'
      ? { id: `r${idx + 1}`, text: entry }
      : { id: `r${idx + 1}`, text: entry.text, autoVar: entry.autoVar }
  );
}

describe('on/c Numi evaluation engine', () => {
  it('chains TI-style ans dynamically line by line', () => {
    const rows = makeRows(['1+2', 'ans+4', 'ans+5']);
    const res = evaluateSheet(rows, defaultSettings, fixedRates);

    expect(res[0].formatted).toBe('3');
    expect(res[0].isLatestAns).toBe(false);

    expect(res[1].formatted).toBe('7');
    expect(res[1].isLatestAns).toBe(false);

    expect(res[2].formatted).toBe('12');
    expect(res[2].isLatestAns).toBe(true);
  });

  it('treats --- as purely visual separator without affecting ans or sum', () => {
    const rows = makeRows(['10 + 5', '---', 'ans * 2', '-----', 'sum']);
    const res = evaluateSheet(rows, defaultSettings, fixedRates);

    expect(res[0].formatted).toBe('15');
    expect(res[1].kind).toBe('separator');
    expect(res[1].formatted).toBeNull();
    expect(res[2].formatted).toBe('30');
    expect(res[3].kind).toBe('separator');
    expect(res[4].formatted).toBe('45');
  });

  it('allows referencing older row autoVar (ans1) below it, and blocks referencing from earlier rows', () => {
    const validRows = makeRows([
      { text: '1 + 2', autoVar: 'ans1' },
      'ans + 4',
      'ans + ans1',
    ]);
    const validRes = evaluateSheet(validRows, defaultSettings, fixedRates);
    expect(validRes[0].formatted).toBe('3');
    expect(validRes[1].formatted).toBe('7');
    expect(validRes[2].formatted).toBe('10');

    const invalidRows = makeRows([
      'ans2 + 10',
      '5 * 5',
      { text: '100', autoVar: 'ans2' },
    ]);
    const invalidRes = evaluateSheet(invalidRows, defaultSettings, fixedRates);
    expect(invalidRes[0].value).toBeNull();
    expect(invalidRes[0].refError).toContain('ans2');
    expect(invalidRes[2].formatted).toBe('100');
  });

  it('evaluates currencies, symbols, mixed-currency math, and conversions', () => {
    const rows = makeRows([
      '$100 in EUR',
      '500 SEK in USD',
      '$30 CAD + 10 USD',
      'Flight: $420',
      'Discounted: ans - 10% discount',
    ]);
    const res = evaluateSheet(rows, defaultSettings, fixedRates);
    expect(res[0].formatted).toBe('€90');
    expect(res[1].formatted).toBe('$50');
    expect(res[2].formatted).toBe('CA$44');
    expect(res[3].formatted).toBe('$420');
    expect(res[4].formatted).toBe('$378');
  });

  it('evaluates Numi percentage expressions and variables', () => {
    const rows = makeRows([
      '20% of 300',
      '10% off $37.99',
      '40 as a % of 200',
      'tax = 15%',
      'subtotal = $200',
      'subtotal + tax',
    ]);
    const res = evaluateSheet(rows, defaultSettings, fixedRates);
    expect(res[0].formatted).toBe('60');
    expect(res[1].formatted).toBe('$34.191');
    expect(res[2].formatted).toBe('20%');
    expect(res[3].formatted).toBe('15%');
    expect(res[4].formatted).toBe('$200');
    expect(res[5].formatted).toBe('$230');
  });

  it('evaluates physical units, compound units, and temperatures', () => {
    const rows = makeRows([
      '20 inches in cm',
      '6 ft 2 in cm',
      '1.5 GB in MB',
      '100 C in F',
      '32 °F to °C',
    ]);
    const res = evaluateSheet(rows, defaultSettings, fixedRates);
    expect(res[0].formatted).toBe('50.8 cm');
    expect(res[1].formatted).toBe('187.96 cm');
    expect(res[2].formatted).toBe('1,500 MB');
    expect(res[3].formatted).toBe('212 °F');
    expect(res[4].formatted).toBe('0 °C');
  });

  it('evaluates math operators, trig, logs, factorials, bitwise, and numeral bases', () => {
    const rows = makeRows([
      '2^3^2',
      '5! + sqrt 16',
      'sin 30',
      'cos(0 rad)',
      'log(1000) + ln(e)',
      '0xFF in dec',
      '255 in hex',
      '0b1100 & 0b1010 in bin',
      '4 << 2',
      '10 mod 3',
      'gcd(48, 18)',
      'nCr(10, 3)',
    ]);
    const res = evaluateSheet(rows, defaultSettings, fixedRates);
    expect(res[0].formatted).toBe('512');
    expect(res[1].formatted).toBe('124');
    expect(res[2].formatted).toBe('0.5');
    expect(res[3].formatted).toBe('1');
    expect(res[4].formatted).toBe('4');
    expect(res[5].formatted).toBe('255');
    expect(res[6].formatted).toBe('0xFF');
    expect(res[7].formatted).toBe('0b1000');
    expect(res[8].formatted).toBe('16');
    expect(res[9].formatted).toBe('1');
    expect(res[10].formatted).toBe('6');
    expect(res[11].formatted).toBe('120');
  });

  it('preserves exact line text across syntax highlight spans', () => {
    const lines = [
      'Price: $1,250.50 + 20% // incl VAT',
      '---',
      '# Q4 Summary',
      'ans + ans1 * sin(45°)',
      '/help',
    ];
    const res = evaluateSheet(makeRows(lines), defaultSettings, fixedRates);
    res.forEach((r, idx) => {
      const joined = r.highlights.map((h) => h.text).join('');
      expect(joined).toBe(lines[idx]);
    });
  });

  it('handles natural-language descriptive words like Numi (e.g. 2 singel + 0.7 gul)', () => {
    const rows = makeRows([
      '2 singel + 0.7 gul + 0.7 vitsvart',
      'har 32',
      'typoVar + 5',
    ]);
    const res = evaluateSheet(rows, defaultSettings, fixedRates);
    expect(res[0].formatted).toBe('3.4');
    expect(res[1].formatted).toBe('32');
    expect(res[2].formatted).toBeNull();
  });

  it('evaluates quick-insert math symbols (°, √, ∛, ², ³, ‰, ⊕) and preserves m² area units', () => {
    const rows = makeRows([
      '12²',
      '4³',
      '∛27',
      '25‰ of 1000',
      'sin 30°',
      '10 m² in sq ft',
    ]);
    const res = evaluateSheet(rows, defaultSettings, fixedRates);
    expect(res[0].formatted).toBe('144');
    expect(res[1].formatted).toBe('64');
    expect(res[2].formatted).toBe('3');
    expect(res[3].formatted).toBe('25');
    expect(res[4].formatted).toBe('0.5');
    expect(res[5].formatted).toBe('107.6391 ft²');
  });

  it('archives non-empty closed tabs and prunes according to 7d / 30d / 90d retention', () => {
    const blankDefaultTab: CalculatorTab = {
      id: 't-blank',
      title: 'Sheet 2',
      nextAutoVarIndex: 1,
      rows: [{ id: 'r1', text: '   ' }],
    };
    const populatedTab: CalculatorTab = {
      id: 't-budget',
      title: 'Trip Budget',
      nextAutoVarIndex: 2,
      rows: [
        { id: 'r1', text: 'Flight: $420' },
        { id: 'r2', text: 'Hotel: 280 EUR in USD' },
      ],
    };

    expect(isTabWorthArchiving(blankDefaultTab)).toBe(false);
    expect(isTabWorthArchiving(populatedTab)).toBe(true);

    const t0 = Temporal.Instant.from('2026-05-01T12:00:00Z').epochMilliseconds;
    const archived = createArchivedTab(populatedTab, t0);

    // Immediately after archiving with 30-day retention
    const freshInfo = getArchiveStatusInfo(archived, 30, t0);
    expect(freshInfo.isExpired).toBe(false);
    expect(freshInfo.nonEmptyLineCount).toBe(2);
    expect(freshInfo.previewText).toContain('Flight: $420');
    expect(freshInfo.remainingText).toContain('30');
    expect(freshInfo.isoRemaining).toBe('P30D');

    // 10 days later: expired under 7d, still active under 30d and 90d
    const tPlus10d = Temporal.Instant.from('2026-05-11T12:00:00Z').epochMilliseconds;
    expect(pruneExpiredArchives([archived], 7, tPlus10d)).toHaveLength(0);
    expect(pruneExpiredArchives([archived], 30, tPlus10d)).toHaveLength(1);
    expect(pruneExpiredArchives([archived], 90, tPlus10d)).toHaveLength(1);

    // 45 days later: expired under 7d and 30d, still active under 90d
    const tPlus45d = Temporal.Instant.from('2026-06-15T12:00:00Z').epochMilliseconds;
    expect(pruneExpiredArchives([archived], 30, tPlus45d)).toHaveLength(0);
    expect(pruneExpiredArchives([archived], 90, tPlus45d)).toHaveLength(1);

    // 20 minutes before 30-day expiry: still active (not truncated early to 0 hours)
    const t20MinLeft = Temporal.Instant.from('2026-05-31T11:40:00Z').epochMilliseconds;
    const finalHourInfo = getArchiveStatusInfo(archived, 30, t20MinLeft);
    expect(finalHourInfo.isExpired).toBe(false);
    expect(finalHourInfo.remainingText).toContain('20');
  });

  it('generates collision-free 3-char IDs and auto-titles tabs from Line 1 # Heading or Label:', () => {
    const code1 = generateUniqueShortCode();
    const code2 = generateUniqueShortCode([{ shortCode: code1, title: code1 }]);
    expect(code1).toMatch(/^#[2-9bcdfghjkmnpqrstvwxyz]{3}$/);
    expect(code2).toMatch(/^#[2-9bcdfghjkmnpqrstvwxyz]{3}$/);
    expect(code2).not.toBe(code1);

    // Line 1 `# Heading` auto-titles the tab
    expect(deriveAutoTabTitle(makeRows(['# Trip Budget // draft', '420 + 280']))).toBe(
      'Trip Budget'
    );

    // Line 1 `Label: <expr>` auto-titles the tab
    expect(deriveAutoTabTitle(makeRows(['Monthly Rent: $1,850', 'ans * 12']))).toBe('Monthly Rent');

    // Plain math on Line 1 keeps shortCode fallback even if a later row has a label
    expect(deriveAutoTabTitle(makeRows(['1 + 2', '---', 'Flight: $420']))).toBeNull();
    expect(resolveTabTitle(makeRows(['1 + 2']), '#k4m', undefined, false)).toBe('#k4m');

    // Custom manual title overrides auto-title until cleared
    expect(
      resolveTabTitle(makeRows(['# Trip Budget']), '#k4m', 'Q4 Taxes', true)
    ).toBe('Q4 Taxes');

    // Migrates duplicate legacy `Sheet 2` tabs to unique 3-char IDs or Line-1 titles
    const migrated = normalizeLoadedTabs([
      { id: 'a', title: 'Sheet 2', nextAutoVarIndex: 1, rows: makeRows(['']) },
      { id: 'b', title: 'Sheet 2', nextAutoVarIndex: 1, rows: makeRows(['']) },
      { id: 'c', title: 'Sheet 3', nextAutoVarIndex: 1, rows: makeRows(['# Groceries', '12 + 8']) },
      { id: 'd', title: 'Saved Custom', nextAutoVarIndex: 1, rows: makeRows(['10 * 5']) },
    ]);
    expect(migrated[0].title).not.toBe(migrated[1].title);
    expect(migrated[0].title).toMatch(/^#[2-9bcdfghjkmnpqrstvwxyz]{3}$/);
    expect(migrated[1].title).toMatch(/^#[2-9bcdfghjkmnpqrstvwxyz]{3}$/);
    expect(migrated[2].title).toBe('Groceries');
    expect(migrated[2].isCustomTitle).toBe(false);
    expect(migrated[3].title).toBe('Saved Custom');
    expect(migrated[3].isCustomTitle).toBe(true);
  });

  it('ignores untouched `# ` starter rows for archiving and exports .md, .csv, and aligned text', () => {
    const untouchedNewTab = createFreshSheetTab();
    expect(untouchedNewTab.rows).toHaveLength(1);
    expect(untouchedNewTab.rows[0].text).toBe('# ');
    expect(isBareHeadingPrompt(untouchedNewTab.rows[0].text)).toBe(true);
    expect(isBareHeadingPrompt('# Trip Budget')).toBe(false);
    expect(isTabWorthArchiving(untouchedNewTab)).toBe(false);
    expect(buildExportFilename('#k4m', 'md')).toBe('sheet-k4m.md');
    expect(buildExportFilename('Trip Budget / Q4', 'md')).toBe('Trip Budget - Q4.md');

    const rows = makeRows([
      '# Trip Budget',
      'Flight: $420',
      'Hotel: $280',
      '---',
      'sum + 10%',
    ]);
    const evalRows = evaluateSheet(rows, defaultSettings, fixedRates);
    const totalText = computeSheetTotalText(evalRows, defaultSettings, fixedRates);
    expect(totalText).toBe('$1,470');

    const tab: CalculatorTab = {
      id: 't-exp',
      shortCode: '#k4m',
      title: 'Trip Budget',
      isCustomTitle: false,
      nextAutoVarIndex: 1,
      rows,
    };

    const md = formatSheetAsMarkdown(tab, evalRows, totalText);
    expect(md).toContain('# Trip Budget');
    expect(md).toContain('```text');
    expect(md).toContain('Flight: $420');
    expect(md).toContain('= $420');
    expect(md).toContain('\n\n---\n\n');
    expect(md).toContain('**Total: $1,470**');

    const csv = formatSheetAsCsv(tab, evalRows, '$1,470');
    expect(csv.startsWith('\uFEFFLine,Expression,Result,Variable\r\n')).toBe(true);
    expect(csv).toContain('2,Flight: $420,$420,');
    expect(csv).toContain('5,sum + 10%,$770,ans');
    expect(csv).toContain(',Total,"$1,470",');

    const clip = formatSheetForClipboard(tab, evalRows, '$1,470');
    expect(clip).toContain('# Trip Budget');
    expect(clip).toContain('Flight: $420');
    expect(clip).toContain('= $770');
    expect(clip).toContain('Total');
  });
});
