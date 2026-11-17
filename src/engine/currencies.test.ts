import { describe, expect, it } from 'vitest';
import {
  ExchangeRatesState,
  FX_MIN_INTERVAL_MS,
  isAutoSyncDue,
  isWithinMinInterval,
  registerCurrencies,
  resolveCurrency,
} from './currencies';

const HOUR = 60 * 60 * 1000;
const state = (updatedAgoMs: number | null, nextInMs: number | null, now: number): ExchangeRatesState => ({
  rates: {},
  source: 'cached',
  updatedAt: updatedAgoMs === null ? null : new Date(now - updatedAgoMs).toISOString(),
  nextUpdateAt: nextInMs === null ? null : new Date(now + nextInMs).toISOString(),
});

describe('FX sync schedule', () => {
  const now = Date.UTC(2026, 10, 17, 12);

  it('syncs when nothing has been fetched yet', () => {
    expect(isAutoSyncDue(state(null, null, now), now)).toBe(true);
  });

  it('never syncs within 12h of the last fetch, even if the provider has updated', () => {
    expect(isAutoSyncDue(state(FX_MIN_INTERVAL_MS - HOUR, -HOUR, now), now)).toBe(false);
    expect(isWithinMinInterval(state(FX_MIN_INTERVAL_MS - HOUR, null, now), now)).toBe(true);
  });

  it('waits for the provider publish time (+1h) after 12h have passed', () => {
    expect(isAutoSyncDue(state(13 * HOUR, 2 * HOUR, now), now)).toBe(false);
    expect(isAutoSyncDue(state(13 * HOUR, -1, now), now)).toBe(true);
  });

  it('falls back to 24h after the last fetch without a provider schedule', () => {
    expect(isAutoSyncDue(state(23 * HOUR, null, now), now)).toBe(false);
    expect(isAutoSyncDue(state(25 * HOUR, null, now), now)).toBe(true);
  });
});

describe('runtime-registered currencies', () => {
  it('resolves new ISO codes only when typed in uppercase', () => {
    registerCurrencies(['THB', 'ALL', 'VND']);
    expect(resolveCurrency('VND')).toBe('VND');
    expect(resolveCurrency('ALL')).toBe('ALL');
    expect(resolveCurrency('all')).toBeNull();
    // curated currencies keep case-insensitive matching
    expect(resolveCurrency('sek')).toBe('SEK');
  });
});
