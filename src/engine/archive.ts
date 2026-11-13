import type { Temporal as TemporalNamespace } from 'temporal-polyfill';
import { ArchivedTab, ArchiveRetentionDays, CalculatorTab } from '../types';
import { isBareHeadingPrompt } from './tabNaming';

function getTemporal(): typeof TemporalNamespace {
  const T = (globalThis as unknown as { Temporal?: typeof TemporalNamespace }).Temporal;
  if (!T) {
    throw new Error('Temporal API is not initialized on globalThis.');
  }
  return T;
}

export function isTabWorthArchiving(tab: CalculatorTab): boolean {
  const hasContent = tab.rows.some((r) => {
    const trimmed = r.text.trim();
    return trimmed.length > 0 && !isBareHeadingPrompt(trimmed);
  });
  return hasContent || Boolean(tab.isCustomTitle);
}

export function createArchivedTab(tab: CalculatorTab, nowEpochMs?: number): ArchivedTab {
  const T = getTemporal();
  const tz = T.Now.timeZoneId();
  const epochMs = nowEpochMs ?? T.Now.instant().epochMilliseconds;
  return {
    archiveId: `arc-${epochMs.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    tab,
    archivedAtEpochMs: epochMs,
    archivedTimeZone: tz,
  };
}

export interface ArchiveStatusInfo {
  isExpired: boolean;
  remainingText: string;
  isoRemaining: string;
  nonEmptyLineCount: number;
  previewText: string;
}

/**
 * Computes DST-safe remaining archive retention duration and localized countdown text
 * using `Temporal.ZonedDateTime.until` and `Intl.DurationFormat` (`duration.toLocaleString`).
 */
export function getArchiveStatusInfo(
  entry: ArchivedTab,
  retentionDays: ArchiveRetentionDays,
  nowEpochMs?: number
): ArchiveStatusInfo {
  const nonEmptyLines = entry.tab.rows
    .map((r) => r.text.trim())
    .filter((line) => line.length > 0);
  const nonEmptyLineCount = nonEmptyLines.length;
  const previewText = nonEmptyLines.slice(0, 2).join(' · ') || 'Empty sheet';

  const T = getTemporal();
  const tz = entry.archivedTimeZone || T.Now.timeZoneId();
  const nowZdt =
    nowEpochMs !== undefined
      ? T.Instant.fromEpochMilliseconds(nowEpochMs).toZonedDateTimeISO(tz)
      : T.Now.zonedDateTimeISO(tz);
  const archivedZdt = T.Instant.fromEpochMilliseconds(
    entry.archivedAtEpochMs
  ).toZonedDateTimeISO(tz);
  const expiresZdt = archivedZdt.add({ days: retentionDays });

  const remaining = nowZdt.until(expiresZdt, {
    largestUnit: 'day',
    smallestUnit: 'minute',
  });

  if (remaining.sign <= 0) {
    return {
      isExpired: true,
      remainingText: 'Expired',
      isoRemaining: remaining.toString(),
      nonEmptyLineCount,
      previewText,
    };
  }

  const displayDur =
    remaining.days >= 1
      ? T.Duration.from({ days: remaining.days })
      : remaining.hours >= 1
        ? T.Duration.from({ hours: remaining.hours })
        : T.Duration.from({ minutes: Math.max(1, remaining.minutes) });

  const formatted = displayDur.toLocaleString('en-US', { style: 'short' });
  return {
    isExpired: false,
    remainingText: `${formatted} left`,
    isoRemaining: remaining.toString(),
    nonEmptyLineCount,
    previewText,
  };
}

export function pruneExpiredArchives(
  archives: ArchivedTab[],
  retentionDays: ArchiveRetentionDays,
  nowEpochMs?: number
): ArchivedTab[] {
  return archives.filter(
    (entry) => !getArchiveStatusInfo(entry, retentionDays, nowEpochMs).isExpired
  );
}
