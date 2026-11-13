import { CalculatorTab, EvaluatedRow } from '../types';
import { isBareHeadingPrompt } from './tabNaming';

export function buildExportFilename(title: string, ext: 'md' | 'csv'): string {
  const raw = title.trim();
  const base = /^#[a-z0-9]{3,5}$/i.test(raw) ? `sheet-${raw.slice(1)}` : raw || 'sheet';
  const safe = base
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return `${safe || 'sheet'}.${ext}`;
}

/**
 * Formats a sheet as clean Markdown (.md):
 * - Preserves `# Heading` rows as native Markdown headings (or adds `# <tab.title>` at top)
 * - Preserves `---` visual separators as native Markdown horizontal rules
 * - Aligns calculation expressions and right-hand results inside fenced `text` blocks
 * - Appends `**Total: ...**` when present
 */
export function formatSheetAsMarkdown(
  tab: CalculatorTab,
  evaluatedRows: ReadonlyArray<EvaluatedRow>,
  totalText: string | null
): string {
  const blocks: string[] = [];
  let calcLines: Array<{ left: string; right: string | null }> = [];

  const flushCalcLines = () => {
    if (calcLines.length === 0) return;
    // Trim leading/trailing blank lines inside a block
    while (calcLines.length > 0 && calcLines[0].left.length === 0 && !calcLines[0].right) {
      calcLines.shift();
    }
    while (
      calcLines.length > 0 &&
      calcLines[calcLines.length - 1].left.length === 0 &&
      !calcLines[calcLines.length - 1].right
    ) {
      calcLines.pop();
    }
    if (calcLines.length === 0) return;

    const maxLeft = calcLines.reduce(
      (max, item) => (item.right ? Math.max(max, item.left.length) : max),
      0
    );
    const padWidth = Math.max(maxLeft + 2, 12);

    const rendered = calcLines.map(({ left, right }) => {
      if (!right) return left;
      return `${left.padEnd(padWidth, ' ')} = ${right}`;
    });

    blocks.push(['```text', ...rendered, '```'].join('\n'));
    calcLines = [];
  };

  const firstNonEmptyIdx = tab.rows.findIndex(
    (r) => r.text.trim().length > 0 && !isBareHeadingPrompt(r.text)
  );
  const startsWithHeading =
    firstNonEmptyIdx >= 0 && evaluatedRows[firstNonEmptyIdx]?.kind === 'heading';

  if (!startsWithHeading) {
    const cleanHeader = tab.title.startsWith('#') ? `Sheet ${tab.title}` : tab.title;
    blocks.push(`# ${cleanHeader}`);
  }

  tab.rows.forEach((row, idx) => {
    const trimmed = row.text.trim();
    const ev = evaluatedRows[idx];

    // Skip untouched `# ` starter prompt
    if (idx === 0 && isBareHeadingPrompt(row.text)) {
      return;
    }

    if (ev?.kind === 'heading') {
      flushCalcLines();
      blocks.push(trimmed);
      return;
    }

    if (ev?.kind === 'separator') {
      flushCalcLines();
      blocks.push('---');
      return;
    }

    if (ev?.kind === 'command') {
      return;
    }

    if (trimmed.length === 0) {
      if (calcLines.length > 0) {
        calcLines.push({ left: '', right: null });
      }
      return;
    }

    calcLines.push({
      left: row.text.trimEnd(),
      right: ev?.formatted ?? null,
    });
  });

  flushCalcLines();

  if (totalText) {
    blocks.push(`**Total: ${totalText}**`);
  }

  return blocks.join('\n\n') + '\n';
}

function escapeCsvCell(val: string): string {
  if (/[",\r\n]/.test(val)) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

/**
 * Formats a sheet as UTF-8 CSV (with BOM so Excel/Numbers preserve °, €, ², etc.).
 */
export function formatSheetAsCsv(
  tab: CalculatorTab,
  evaluatedRows: ReadonlyArray<EvaluatedRow>,
  totalText: string | null
): string {
  const lines: string[] = ['Line,Expression,Result,Variable'];

  tab.rows.forEach((row, idx) => {
    const trimmed = row.text.trim();
    const ev = evaluatedRows[idx];
    if (trimmed.length === 0 || (idx === 0 && isBareHeadingPrompt(row.text)) || ev?.kind === 'command') {
      return;
    }
    const resultStr = ev?.kind === 'separator' ? '---' : ev?.formatted ?? '';
    const varStr = ev?.assignedVar ?? (ev?.isLatestAns ? 'ans' : ev?.autoVar ?? '');
    lines.push(
      [
        String(idx + 1),
        escapeCsvCell(row.text.trimEnd()),
        escapeCsvCell(resultStr),
        escapeCsvCell(varStr),
      ].join(',')
    );
  });

  if (totalText) {
    lines.push(['', 'Total', escapeCsvCell(totalText), ''].join(','));
  }

  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

/**
 * Formats a sheet as aligned plain text suitable for pasting into Notes, Slack, email, or on/c.
 */
export function formatSheetForClipboard(
  tab: CalculatorTab,
  evaluatedRows: ReadonlyArray<EvaluatedRow>,
  totalText: string | null
): string {
  const activeRows = tab.rows
    .map((row, idx) => ({ row, ev: evaluatedRows[idx], idx }))
    .filter(({ row, ev, idx }) => {
      if (idx === 0 && isBareHeadingPrompt(row.text)) return false;
      if (ev?.kind === 'command') return false;
      return true;
    });

  // Trim trailing blank lines
  while (activeRows.length > 0 && activeRows[activeRows.length - 1].row.text.trim().length === 0) {
    activeRows.pop();
  }

  const maxLeft = activeRows.reduce((max, { row, ev }) => {
    if (ev?.formatted) {
      return Math.max(max, row.text.trimEnd().length);
    }
    return max;
  }, 0);
  const padWidth = Math.max(maxLeft + 2, 10);

  const out = activeRows.map(({ row, ev }) => {
    if (ev?.kind === 'separator') return '---';
    const left = row.text.trimEnd();
    if (ev?.formatted) {
      return `${left.padEnd(padWidth, ' ')} = ${ev.formatted}`;
    }
    return left;
  });

  if (totalText && out.length > 0) {
    out.push('---');
    out.push(`${'Total'.padEnd(padWidth, ' ')} = ${totalText}`);
  }

  return out.join('\n');
}

export async function triggerSheetFileExport(
  filename: string,
  content: string,
  mimeType: string,
  isTauri: boolean
): Promise<string> {
  if (isTauri) {
    const { invoke } = await import('@tauri-apps/api/core');
    const savedPath = await invoke<string>('save_export_file', { filename, content });
    return `Saved ${savedPath}`;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  return `Exported ${filename}`;
}
