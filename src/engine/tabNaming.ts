import { ArchivedTab, CalculatorTab, SheetRow } from '../types';

/**
 * Visually unambiguous lowercase base-28 alphabet:
 * Excludes 0/o, 1/i/l (lookalikes) and vowels a/e/i/o/u (prevents accidental 3-letter words).
 * 28^3 = 21,952 unique 3-character IDs.
 */
const SHORT_ID_ALPHABET = '23456789bcdfghjkmnpqrstvwxyz';
const LEGACY_SHEET_TITLE_RE = /^Sheet\s+\d+$/i;

export function isLegacyDefaultTitle(title: string): boolean {
  return LEGACY_SHEET_TITLE_RE.test(title.trim());
}

/**
 * Returns true when a row contains only an untouched `#` / `# ` heading starter prompt.
 */
export function isBareHeadingPrompt(text: string): boolean {
  return /^\s*#+\s*$/.test(text);
}

/**
 * Creates a fresh sheet tab pre-populated with `# ` on Line 1 and a unique `#3char` fallback ID.
 */
export function createFreshSheetTab(
  existingTabs: ReadonlyArray<Pick<CalculatorTab, 'shortCode' | 'title'>> = [],
  archivedTabs: ReadonlyArray<Pick<ArchivedTab, 'tab'>> = []
): CalculatorTab {
  const shortCode = generateUniqueShortCode(existingTabs, archivedTabs);
  const stamp = Date.now().toString(36);
  const suffix = Math.random().toString(36).slice(2, 5);
  return {
    id: `tab-${stamp}-${suffix}`,
    shortCode,
    isCustomTitle: false,
    title: shortCode,
    nextAutoVarIndex: 1,
    rows: [{ id: `row-${stamp}-${suffix}`, text: '# ' }],
  };
}

/**
 * Generates a unique 3-character `#xyz` tab code not already used by any active or archived tab.
 */
export function generateUniqueShortCode(
  existingTabs: ReadonlyArray<Pick<CalculatorTab, 'shortCode' | 'title'>> = [],
  archivedTabs: ReadonlyArray<Pick<ArchivedTab, 'tab'>> = [],
  rng: () => number = Math.random
): string {
  const taken = new Set<string>();
  for (const t of existingTabs) {
    if (t.shortCode) taken.add(t.shortCode.toLowerCase());
    taken.add(t.title.trim().toLowerCase());
  }
  for (const a of archivedTabs) {
    if (a.tab.shortCode) taken.add(a.tab.shortCode.toLowerCase());
    taken.add(a.tab.title.trim().toLowerCase());
  }

  for (let attempt = 0; attempt < 128; attempt++) {
    let chars = '';
    for (let i = 0; i < 3; i++) {
      const idx = Math.floor(rng() * SHORT_ID_ALPHABET.length) % SHORT_ID_ALPHABET.length;
      chars += SHORT_ID_ALPHABET[idx];
    }
    const candidate = `#${chars}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }

  return `#${Date.now().toString(36).slice(-3)}`;
}

/**
 * Extracts an automatic tab title from the first non-empty row if it starts with
 * a `# Heading` or `Label: <expression>`. Never truncates in script (CSS handles visual overflow).
 */
export function deriveAutoTabTitle(rows: ReadonlyArray<SheetRow>): string | null {
  const firstNonEmpty = rows.find((r) => r.text.trim().length > 0);
  if (!firstNonEmpty) return null;

  // Strip trailing inline `// comment` before inspecting heading or label
  const withoutComment = firstNonEmpty.text.replace(/\s*\/\/.*$/, '').trim();
  if (!withoutComment) return null;

  // 1. `# Heading` on first non-empty line
  const headingMatch = withoutComment.match(/^#+\s*(.+)$/);
  if (headingMatch) {
    const cleanHeading = headingMatch[1].trim();
    if (cleanHeading.length > 0) {
      return cleanHeading;
    }
  }

  // 2. `Label: <expression>` on first non-empty line (avoids matching `http://` or numeric `10:20`)
  const labelMatch = withoutComment.match(
    /^([A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F0-9 _.'&()-]{0,48}?)\s*:\s*(?!\/)\S/
  );
  if (labelMatch) {
    const cleanLabel = labelMatch[1].trim();
    if (cleanLabel.length > 0) {
      return cleanLabel;
    }
  }

  return null;
}

/**
 * Resolves the effective display title for a tab:
 * - Preserves `customTitle` when `isCustomTitle` is true.
 * - Otherwise uses `deriveAutoTabTitle(rows)` if available, falling back to `shortCode`.
 */
export function resolveTabTitle(
  rows: ReadonlyArray<SheetRow>,
  shortCode: string,
  currentTitle?: string,
  isCustomTitle?: boolean
): string {
  if (isCustomTitle && currentTitle && currentTitle.trim().length > 0) {
    return currentTitle.trim();
  }
  return deriveAutoTabTitle(rows) ?? shortCode;
}

/**
 * Normalizes / migrates tabs loaded from localStorage so legacy `Sheet N` tabs
 * receive stable unique `#3char` codes and automatic Line-1 titles without duplicates.
 */
export function normalizeLoadedTabs(
  tabs: CalculatorTab[],
  archivedTabs: ReadonlyArray<Pick<ArchivedTab, 'tab'>> = []
): CalculatorTab[] {
  const normalized: CalculatorTab[] = [];

  for (const tab of tabs) {
    const hasExplicitCustom =
      tab.isCustomTitle === true ||
      (tab.isCustomTitle === undefined &&
        Boolean(tab.title?.trim()) &&
        !isLegacyDefaultTitle(tab.title) &&
        !/^#[2-9bcdfghjkmnpqrstvwxyz]{3}$/i.test(tab.title.trim()));

    const shortCode =
      tab.shortCode && /^#[a-z0-9]{3,5}$/i.test(tab.shortCode)
        ? tab.shortCode
        : generateUniqueShortCode([...normalized, ...tabs], archivedTabs);

    const nextTitle = resolveTabTitle(tab.rows, shortCode, tab.title, hasExplicitCustom);

    normalized.push({
      ...tab,
      shortCode,
      isCustomTitle: hasExplicitCustom,
      title: nextTitle,
    });
  }

  return normalized;
}
