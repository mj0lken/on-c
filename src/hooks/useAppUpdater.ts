import { useCallback, useEffect, useRef, useState } from 'react';
import type { Update } from '@tauri-apps/plugin-updater';

const INITIAL_CHECK_DELAY_MS = 1_600;
const PERIODIC_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1_000;
const CHECK_TIMEOUT_MS = 15_000;
const INSTALL_TIMEOUT_MS = 120_000;
const MIN_MANUAL_CHECK_MS = 400;
const CHECK_RESULT_DISPLAY_MS = 6_000;

export type UpdateCheckResult = 'idle' | 'up-to-date' | 'error';

export interface UseAppUpdaterOptions {
  isTauri: boolean;
  onNotify: (message: string) => void;
}

export interface AppUpdaterState {
  currentVersion: string;
  availableVersion: string | null;
  isChecking: boolean;
  isInstalling: boolean;
  lastCheckResult: UpdateCheckResult;
  canCheckForUpdates: boolean;
  checkForUpdates: () => Promise<void>;
  installUpdate: () => Promise<void>;
}

export function resolveInitialAppVersion(): string {
  const raw = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0';
  const cleaned = raw.trim().replace(/^v/i, '');
  return cleaned || '1.0.0';
}

export function normalizeMockUpdateVersion(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/^v/i, '');
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(trimmed) ? trimmed : null;
}

export function useAppUpdater({ isTauri, onNotify }: UseAppUpdaterOptions): AppUpdaterState {
  const [currentVersion, setCurrentVersion] = useState<string>(resolveInitialAppVersion);
  const [availableVersion, setAvailableVersion] = useState<string | null>(() => {
    if (!isTauri && import.meta.env.DEV && typeof window !== 'undefined') {
      return normalizeMockUpdateVersion(
        new URLSearchParams(window.location.search).get('mockUpdate')
      );
    }
    return null;
  });
  const [isChecking, setIsChecking] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [lastCheckResult, setLastCheckResult] = useState<UpdateCheckResult>('idle');

  const updateRef = useRef<Update | null>(null);
  const isCheckingRef = useRef(false);
  const isInstallingRef = useRef(false);
  const mountedRef = useRef(true);
  const checkResultTimerRef = useRef<number | null>(null);

  const canCheckForUpdates = isTauri || Boolean(import.meta.env.DEV);

  const setTransientCheckResult = useCallback((result: UpdateCheckResult) => {
    setLastCheckResult(result);
    if (checkResultTimerRef.current) {
      window.clearTimeout(checkResultTimerRef.current);
      checkResultTimerRef.current = null;
    }
    if (result !== 'idle' && typeof window !== 'undefined') {
      checkResultTimerRef.current = window.setTimeout(() => {
        if (mountedRef.current) {
          setLastCheckResult('idle');
        }
      }, CHECK_RESULT_DISPLAY_MS);
    }
  }, []);

  const runUpdateCheck = useCallback(
    async (manual: boolean) => {
      if (isCheckingRef.current || isInstallingRef.current) return;
      if (!isTauri && !(manual && import.meta.env.DEV)) return;

      isCheckingRef.current = true;
      if (manual) {
        setIsChecking(true);
        setTransientCheckResult('idle');
      }

      const startedAt = Date.now();
      const waitMinManualFloor = async () => {
        if (!manual) return;
        const elapsed = Date.now() - startedAt;
        if (elapsed < MIN_MANUAL_CHECK_MS) {
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, MIN_MANUAL_CHECK_MS - elapsed);
          });
        }
      };

      try {
        if (!isTauri && import.meta.env.DEV) {
          await waitMinManualFloor();
          if (!mountedRef.current) return;
          const mockNext =
            typeof window !== 'undefined'
              ? normalizeMockUpdateVersion(
                  new URLSearchParams(window.location.search).get('mockCheckUpdate')
                )
              : null;
          if (mockNext && mockNext !== currentVersion) {
            setAvailableVersion(mockNext);
            onNotify(`Update v${mockNext} available`);
          } else {
            setTransientCheckResult('up-to-date');
            onNotify(`on/c v${currentVersion} is up to date`);
          }
          return;
        }

        const { check } = await import('@tauri-apps/plugin-updater');
        const update = await check({ timeout: CHECK_TIMEOUT_MS });
        await waitMinManualFloor();

        if (!mountedRef.current) {
          if (update) await update.close().catch(() => {});
          return;
        }

        if (update) {
          const previous = updateRef.current;
          if (previous && previous !== update) {
            await previous.close().catch(() => {});
          }
          updateRef.current = update;
          setAvailableVersion(update.version);
          if (manual) {
            onNotify(`Update v${update.version} available`);
          }
        } else if (manual) {
          setTransientCheckResult('up-to-date');
          onNotify(`on/c v${currentVersion} is up to date`);
        }
      } catch {
        await waitMinManualFloor();
        if (manual && mountedRef.current) {
          setTransientCheckResult('error');
          onNotify('Could not check for updates');
        }
      } finally {
        isCheckingRef.current = false;
        if (manual && mountedRef.current) {
          setIsChecking(false);
        }
      }
    },
    [currentVersion, isTauri, onNotify, setTransientCheckResult]
  );

  const checkForUpdates = useCallback(async () => {
    await runUpdateCheck(true);
  }, [runUpdateCheck]);

  useEffect(() => {
    mountedRef.current = true;
    if (!isTauri) {
      return () => {
        mountedRef.current = false;
        if (checkResultTimerRef.current) {
          window.clearTimeout(checkResultTimerRef.current);
        }
      };
    }

    void import('@tauri-apps/api/app')
      .then(({ getVersion }) => getVersion())
      .then((ver) => {
        if (mountedRef.current && ver) {
          setCurrentVersion(ver.trim().replace(/^v/i, ''));
        }
      })
      .catch(() => {
        // Keep compile-time fallback version if unavailable.
      });

    const initialTimer = window.setTimeout(() => {
      void runUpdateCheck(false);
    }, INITIAL_CHECK_DELAY_MS);

    const intervalTimer = window.setInterval(() => {
      void runUpdateCheck(false);
    }, PERIODIC_CHECK_INTERVAL_MS);

    const handleOnline = () => {
      void runUpdateCheck(false);
    };
    window.addEventListener('online', handleOnline);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(initialTimer);
      window.clearInterval(intervalTimer);
      if (checkResultTimerRef.current) {
        window.clearTimeout(checkResultTimerRef.current);
      }
      window.removeEventListener('online', handleOnline);
      const pending = updateRef.current;
      updateRef.current = null;
      if (pending) {
        void pending.close().catch(() => {});
      }
    };
  }, [isTauri, runUpdateCheck]);

  const installUpdate = useCallback(async () => {
    if (isInstallingRef.current || !availableVersion) return;

    if (!isTauri && import.meta.env.DEV) {
      isInstallingRef.current = true;
      setIsInstalling(true);
      onNotify(`Updating to v${availableVersion}…`);
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 1_600);
      });
      if (!mountedRef.current) return;
      isInstallingRef.current = false;
      setIsInstalling(false);
      setCurrentVersion(availableVersion);
      setAvailableVersion(null);
      setTransientCheckResult('up-to-date');
      onNotify(`Updated to v${availableVersion}`);
      return;
    }

    isInstallingRef.current = true;
    setIsInstalling(true);
    onNotify(`Updating to v${availableVersion}…`);

    try {
      let currentUpdate = updateRef.current;
      if (!currentUpdate) {
        const { check } = await import('@tauri-apps/plugin-updater');
        currentUpdate = await check({ timeout: CHECK_TIMEOUT_MS });
        updateRef.current = currentUpdate;
      }

      if (!currentUpdate) {
        isInstallingRef.current = false;
        setIsInstalling(false);
        setAvailableVersion(null);
        setTransientCheckResult('up-to-date');
        onNotify('Already up to date');
        return;
      }

      await currentUpdate.downloadAndInstall(undefined, {
        timeout: INSTALL_TIMEOUT_MS,
      });

      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch {
      if (mountedRef.current) {
        isInstallingRef.current = false;
        setIsInstalling(false);
      }
      onNotify('Auto-update unavailable here — opening release page');
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('open_release_page');
      } catch {
        // Ignore if running outside Tauri
      }
    }
  }, [availableVersion, isTauri, onNotify, setTransientCheckResult]);

  return {
    currentVersion,
    availableVersion,
    isChecking,
    isInstalling,
    lastCheckResult,
    canCheckForUpdates,
    checkForUpdates,
    installUpdate,
  };
}
