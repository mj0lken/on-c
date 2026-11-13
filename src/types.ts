export type ThemePreference = 'light' | 'dark' | 'system';
export type AngleUnit = 'deg' | 'rad';
export type ThousandsSeparator = 'comma' | 'space' | 'none';
export type FontSizeOption = 'sm' | 'md' | 'lg';
export type DisplayBase = 'dec' | 'hex' | 'bin' | 'oct';
export type ArchiveRetentionDays = 7 | 30 | 90;

export interface CalculatorSettings {
  theme: ThemePreference;
  precision: number;
  defaultCurrency: string;
  angleUnit: AngleUnit;
  thousandsSeparator: ThousandsSeparator;
  fontSize: FontSizeOption;
  archiveRetentionDays: ArchiveRetentionDays;
}

export type ValueKind = 'number' | 'percent' | 'currency' | 'unit' | 'date';

export interface CalcValue {
  kind: ValueKind;
  amount: number;
  currency?: string;
  unit?: string;
  displayBase?: DisplayBase;
}

export interface SheetRow {
  id: string;
  text: string;
  /** Persistent variable generated when user clicks an older answer (e.g., "ans1", "ans2") */
  autoVar?: string;
}

export type RowKind =
  | 'empty'
  | 'separator'
  | 'heading'
  | 'comment'
  | 'command'
  | 'expression';

export interface HighlightSpan {
  type:
    | 'number'
    | 'operator'
    | 'keyword'
    | 'unit'
    | 'currency'
    | 'variable'
    | 'ans'
    | 'function'
    | 'comment'
    | 'heading'
    | 'label'
    | 'paren'
    | 'separator'
    | 'command'
    | 'text';
  text: string;
}

export interface EvaluatedRow {
  rowId: string;
  lineIndex: number;
  kind: RowKind;
  value: CalcValue | null;
  formatted: string | null;
  assignedVar?: string;
  autoVar?: string;
  isLatestAns: boolean;
  refError?: string;
  highlights: HighlightSpan[];
}

export interface CalculatorTab {
  id: string;
  title: string;
  /** Unambiguous 3-character fallback identifier (e.g. "#k4m") */
  shortCode?: string;
  /** True when the user explicitly renamed the tab via double-click */
  isCustomTitle?: boolean;
  rows: SheetRow[];
  nextAutoVarIndex: number;
}

export interface ArchivedTab {
  archiveId: string;
  tab: CalculatorTab;
  archivedAtEpochMs: number;
  archivedTimeZone: string;
}

export type HelpCategoryId =
  | 'math'
  | 'ans-vars'
  | 'currency'
  | 'percent'
  | 'units'
  | 'functions'
  | 'aggregates'
  | 'bitwise'
  | 'formatting';

export interface HelpCategoryMeta {
  id: HelpCategoryId;
  label: string;
  shortDesc: string;
}

export interface HelpItem {
  id: string;
  title: string;
  category: HelpCategoryId;
  syntax: string;
  exampleInput: string;
  exampleOutput: string;
  description: string;
  keywords: string[];
}
