import React, { useEffect, useState } from 'react';
import {
  AngleUnit,
  ArchivedTab,
  ArchiveRetentionDays,
  CalculatorSettings,
  FontSizeOption,
  ThemePreference,
  ThousandsSeparator,
} from '../types';
import { CURRENCIES, ExchangeRatesState } from '../engine/currencies';
import { getArchiveStatusInfo } from '../engine/archive';

interface SettingsBackProps {
  settings: CalculatorSettings;
  fxState: ExchangeRatesState;
  isRefreshingFx: boolean;
  archivedTabs: ArchivedTab[];
  onUpdateSettings: (patch: Partial<CalculatorSettings>) => void;
  onRefreshRates: () => void;
  onRestoreArchivedTab: (archiveId: string) => void;
  onDeleteArchivedTab: (archiveId: string) => void;
  onFlipBack: () => void;
}

const PRIMARY_CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'SEK',
  'NOK',
  'DKK',
  'CHF',
  'JPY',
  'CAD',
  'AUD',
  'CNY',
  'INR',
];

export const SettingsBack: React.FC<SettingsBackProps> = ({
  settings,
  fxState,
  isRefreshingFx,
  archivedTabs,
  onUpdateSettings,
  onRefreshRates,
  onRestoreArchivedTab,
  onDeleteArchivedTab,
  onFlipBack,
}) => {
  const [osIsDark, setOsIsDark] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
  );

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setOsIsDark(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const precisionChoices = [0, 2, 4, 6, 8];
  const retentionChoices: Array<{ value: ArchiveRetentionDays; label: string }> = [
    { value: 7, label: '7 days' },
    { value: 30, label: '30 days' },
    { value: 90, label: '90 days' },
  ];

  const activeArchives = archivedTabs
    .map((entry) => ({
      entry,
      status: getArchiveStatusInfo(entry, settings.archiveRetentionDays),
    }))
    .filter(({ status }) => !status.isExpired);

  return (
    <div className="settings-back-panel">
      <header className="titlebar-row settings-titlebar" data-tauri-drag-region>
        <div className="titlebar-left" data-tauri-drag-region />
        <span className="onc-wordmark" data-tauri-drag-region>
          on/c
        </span>
        <div className="titlebar-right">
          <button
            type="button"
            className="flip-back-btn"
            data-tour-target="settings-back"
            onClick={onFlipBack}
            title="Rotate 180° back to calculator (Esc)"
          >
            ← Back
          </button>
        </div>
      </header>

      <div className="settings-body">
        {/* 1. Theme */}
        <section className="setting-row">
          <div className="setting-info">
            <span className="setting-label">Theme</span>
            <span className="setting-desc">Light red accent or Numi dark</span>
          </div>
          <div
            className="segmented-control"
            data-tour-target="settings-theme-group"
            role="radiogroup"
            aria-label="Appearance theme"
          >
            {(
              [
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'system', label: `Auto (${osIsDark ? 'Dark' : 'Light'})` },
              ] as Array<{ value: ThemePreference; label: string }>
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={settings.theme === opt.value}
                className={`seg-btn ${settings.theme === opt.value ? 'is-active' : ''}`}
                onClick={() => onUpdateSettings({ theme: opt.value })}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* 2. Decimal Precision */}
        <section className="setting-row">
          <div className="setting-info">
            <span className="setting-label">Decimals</span>
            <span className="setting-desc">Max decimal places</span>
          </div>
          <div className="segmented-control" role="radiogroup" aria-label="Decimal precision">
            {precisionChoices.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={settings.precision === p}
                className={`seg-btn seg-btn-compact ${settings.precision === p ? 'is-active' : ''}`}
                onClick={() => onUpdateSettings({ precision: p })}
              >
                {p}
              </button>
            ))}
          </div>
        </section>

        {/* 3. Default Currency & FX */}
        <section className="setting-row">
          <div className="setting-info">
            <label htmlFor="default-currency-select" className="setting-label">
              Currency
            </label>
            <span className="setting-desc">
              {fxState.source === 'live'
                ? 'Live FX active'
                : fxState.source === 'cached'
                  ? 'Cached FX rates'
                  : 'Offline FX rates'}
            </span>
          </div>
          <div className="setting-inline-controls">
            <select
              id="default-currency-select"
              className="setting-select"
              value={settings.defaultCurrency}
              onChange={(e) => onUpdateSettings({ defaultCurrency: e.target.value })}
            >
              {PRIMARY_CURRENCIES.map((code) => {
                const info = CURRENCIES[code];
                return (
                  <option key={code} value={code}>
                    {code} ({info.symbol})
                  </option>
                );
              })}
            </select>
            <button
              type="button"
              className="secondary-btn"
              onClick={onRefreshRates}
              disabled={isRefreshingFx}
              title="Refresh live exchange rates"
            >
              {isRefreshingFx ? '…' : 'Sync'}
            </button>
          </div>
        </section>

        {/* 4. Angles */}
        <section className="setting-row">
          <div className="setting-info">
            <span className="setting-label">Angles</span>
            <span className="setting-desc">Default trig unit</span>
          </div>
          <div className="segmented-control" role="radiogroup" aria-label="Angle unit">
            {(
              [
                { value: 'deg', label: 'Deg (°)' },
                { value: 'rad', label: 'Rad' },
              ] as Array<{ value: AngleUnit; label: string }>
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={settings.angleUnit === opt.value}
                className={`seg-btn ${settings.angleUnit === opt.value ? 'is-active' : ''}`}
                onClick={() => onUpdateSettings({ angleUnit: opt.value })}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* 5. Thousands Grouping */}
        <section className="setting-row">
          <div className="setting-info">
            <span className="setting-label">Grouping</span>
            <span className="setting-desc">Thousands separator</span>
          </div>
          <div className="segmented-control" role="radiogroup" aria-label="Thousands separator">
            {(
              [
                { value: 'space', label: '10 000' },
                { value: 'comma', label: '10,000' },
                { value: 'none', label: '10000' },
              ] as Array<{ value: ThousandsSeparator; label: string }>
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={settings.thousandsSeparator === opt.value}
                className={`seg-btn seg-btn-compact ${
                  settings.thousandsSeparator === opt.value ? 'is-active' : ''
                }`}
                onClick={() => onUpdateSettings({ thousandsSeparator: opt.value })}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* 6. Font Size */}
        <section className="setting-row">
          <div className="setting-info">
            <span className="setting-label">Text Size</span>
            <span className="setting-desc">Editor scale</span>
          </div>
          <div className="segmented-control" role="radiogroup" aria-label="Editor text size">
            {(
              [
                { value: 'sm', label: 'S' },
                { value: 'md', label: 'M' },
                { value: 'lg', label: 'L' },
              ] as Array<{ value: FontSizeOption; label: string }>
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={settings.fontSize === opt.value}
                className={`seg-btn seg-btn-compact ${
                  settings.fontSize === opt.value ? 'is-active' : ''
                }`}
                onClick={() => onUpdateSettings({ fontSize: opt.value })}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* 7. Archive Auto-Delete Retention */}
        <section className="setting-row">
          <div className="setting-info">
            <span className="setting-label">Auto-Delete</span>
            <span className="setting-desc">Closed tab retention</span>
          </div>
          <div
            className="segmented-control"
            role="radiogroup"
            aria-label="Archive auto-delete retention"
          >
            {retentionChoices.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={settings.archiveRetentionDays === opt.value}
                className={`seg-btn seg-btn-compact ${
                  settings.archiveRetentionDays === opt.value ? 'is-active' : ''
                }`}
                onClick={() => onUpdateSettings({ archiveRetentionDays: opt.value })}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* 8. Archived Sheets (Restorable & Deletable) */}
        <section className="archive-section" aria-label="Archived sheets">
          <div className="archive-section-header">
            <span className="setting-label">
              Archived Sheets{activeArchives.length > 0 ? ` (${activeArchives.length})` : ''}
            </span>
            <span className="setting-desc">
              Auto-deletes after {settings.archiveRetentionDays} days
            </span>
          </div>

          {activeArchives.length === 0 ? (
            <div className="archive-empty">
              Closed sheets move here for {settings.archiveRetentionDays} days before auto-deleting.
            </div>
          ) : (
            <ul className="archive-list">
              {activeArchives.map(({ entry, status }) => (
                <li key={entry.archiveId} className="archive-item">
                  <div className="archive-item-main">
                    <div className="archive-item-top">
                      <span className="archive-item-title">{entry.tab.title}</span>
                      <span className="archive-item-meta">
                        {status.nonEmptyLineCount}{' '}
                        {status.nonEmptyLineCount === 1 ? 'line' : 'lines'} ·{' '}
                        <time dateTime={status.isoRemaining}>{status.remainingText}</time>
                      </span>
                    </div>
                    <div className="archive-item-preview">{status.previewText}</div>
                  </div>
                  <div className="archive-item-actions">
                    <button
                      type="button"
                      className="archive-restore-btn"
                      onClick={() => onRestoreArchivedTab(entry.archiveId)}
                      aria-label={`Restore ${entry.tab.title}`}
                    >
                      Restore
                    </button>
                    <button
                      type="button"
                      className="archive-delete-btn"
                      onClick={() => onDeleteArchivedTab(entry.archiveId)}
                      aria-label={`Delete ${entry.tab.title} permanently`}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <footer className="calc-footer">
        <span className="footer-muted">⌘T new tab · ⌘W archive tab · /help reference</span>
      </footer>
    </div>
  );
};
