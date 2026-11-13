import {
  ArchivedTab,
  ArchiveRetentionDays,
  CalculatorSettings,
  CalculatorTab,
  SheetRow,
  ThemePreference,
} from '../types';
import { pruneExpiredArchives } from './archive';
import {
  generateUniqueShortCode,
  normalizeLoadedTabs,
  resolveTabTitle,
} from './tabNaming';

export const TABS_STORAGE_KEY = 'onc-tabs-v1';
export const ACTIVE_TAB_KEY = 'onc-active-tab-v1';
export const ARCHIVED_TABS_KEY = 'onc-archived-tabs-v1';
export const SETTINGS_STORAGE_KEY = 'onc-settings-v1';
export const COLOR_SCHEME_KEY = 'onc-color-scheme';

export const DEFAULT_SETTINGS: CalculatorSettings = {
  theme: 'light',
  precision: 2,
  defaultCurrency: 'USD',
  angleUnit: 'deg',
  thousandsSeparator: 'space',
  fontSize: 'md',
  archiveRetentionDays: 30,
};

export function createStarterTabs(): CalculatorTab[] {
  const shortCode = generateUniqueShortCode();
  const rows: SheetRow[] = [
    { id: 'r-1', text: '1 + 2', autoVar: 'ans1' },
    { id: 'r-2', text: 'ans + 4' },
    { id: 'r-3', text: 'ans + 5' },
    { id: 'r-4', text: '---' },
    { id: 'r-5', text: 'Flight: $420' },
    { id: 'r-6', text: 'Hotel: 280 EUR in USD' },
    { id: 'r-7', text: 'sum + 12% // incl. tax' },
    { id: 'r-8', text: '---' },
    { id: 'r-9', text: '6 ft 2 in cm' },
    { id: 'r-10', text: 'ans1 * sqrt 144' },
    { id: 'r-11', text: '' },
  ];
  return [
    {
      id: 'tab-welcome',
      shortCode,
      isCustomTitle: false,
      title: resolveTabTitle(rows, shortCode, undefined, false),
      nextAutoVarIndex: 2,
      rows,
    },
  ];
}

export function loadSavedSettings(): CalculatorSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    const savedScheme = localStorage.getItem(COLOR_SCHEME_KEY) as ThemePreference | null;
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CalculatorSettings>;
      const retention: ArchiveRetentionDays =
        parsed.archiveRetentionDays === 7 ||
        parsed.archiveRetentionDays === 30 ||
        parsed.archiveRetentionDays === 90
          ? parsed.archiveRetentionDays
          : DEFAULT_SETTINGS.archiveRetentionDays;
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        archiveRetentionDays: retention,
        theme:
          savedScheme === 'light' || savedScheme === 'dark' || savedScheme === 'system'
            ? savedScheme
            : parsed.theme ?? DEFAULT_SETTINGS.theme,
      };
    }
    if (savedScheme === 'light' || savedScheme === 'dark' || savedScheme === 'system') {
      return { ...DEFAULT_SETTINGS, theme: savedScheme };
    }
  } catch {
    // Ignore storage read failure
  }
  return DEFAULT_SETTINGS;
}

export function loadSavedArchivedTabs(retentionDays: ArchiveRetentionDays): ArchivedTab[] {
  try {
    const raw = localStorage.getItem(ARCHIVED_TABS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ArchivedTab[];
      if (Array.isArray(parsed)) {
        const valid = parsed.filter(
          (item) =>
            item &&
            typeof item.archiveId === 'string' &&
            typeof item.archivedAtEpochMs === 'number' &&
            item.tab &&
            Array.isArray(item.tab.rows)
        );
        const pruned = pruneExpiredArchives(valid, retentionDays);
        const migratedTabs = normalizeLoadedTabs(pruned.map((p) => p.tab));
        return pruned.map((entry, idx) => ({
          ...entry,
          tab: migratedTabs[idx],
        }));
      }
    }
  } catch {
    // Ignore storage read failure
  }
  return [];
}

export function loadSavedTabs(archivedTabs: ArchivedTab[] = []): CalculatorTab[] {
  try {
    const raw = localStorage.getItem(TABS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CalculatorTab[];
      if (Array.isArray(parsed) && parsed.length > 0 && Array.isArray(parsed[0].rows)) {
        return normalizeLoadedTabs(parsed, archivedTabs);
      }
    }
  } catch {
    // Ignore storage read failure
  }
  return createStarterTabs();
}

export function loadSavedActiveTabId(tabs: ReadonlyArray<CalculatorTab>): string {
  try {
    const savedId = localStorage.getItem(ACTIVE_TAB_KEY);
    if (savedId && tabs.some((t) => t.id === savedId)) {
      return savedId;
    }
    return tabs[0]?.id ?? 'tab-welcome';
  } catch {
    return tabs[0]?.id ?? 'tab-welcome';
  }
}

export function persistJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota or private-mode errors
  }
}

export function persistString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage quota or private-mode errors
  }
}

export function syncMetaColorScheme(theme: ThemePreference): void {
  if (typeof document !== 'undefined') {
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) {
      meta.setAttribute('content', theme === 'system' ? 'light dark' : theme);
    }
  }
  persistString(COLOR_SCHEME_KEY, theme);
}
