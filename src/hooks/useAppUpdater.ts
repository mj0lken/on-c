import { useCallback, useEffect, useRef, useState } from 'react';
import type { Update } from '@tauri-apps/plugin-updater';

const INITIAL_CHECK_DELAY_MS = 1_600;
const PERIODIC_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1_000;
const CHECK_TIMEOUT_MS = 15_000;
const INSTALL_TIMEOUT_MS = 120_000;

export interface UseAppUpdaterOptions {
  isTauri: boolean;
  onNotify: (message: string) => void;
}

export interface AppUpdaterState {
  availableVersion: string | null;
  isInstalling: boolean;
  installUpdate: () => Promise<void>;
}

export function normalizeMockUpdateVersion(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/^v/i, '');
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(trimmed) ? trimmed : null;
}

export function useAppUpdater({ isTauri, onNotify }: UseAppUpdaterOptions): AppUpdaterState {
  const [availableVersion, setAvailableVersion] = useState<string | null>(() => {
    if (!isTauri && import.meta.env.DEV && typeof window !== 'undefined') {
      return normalizeMockUpdateVersion(
        new URLSearchParams(window.location.search).get('mockUpdate')
      );
    }
    return null;
  });
  const [isInstalling, setIsInstalling] = useState(false);

  const updateRef = useRef<Update | null>(null);
  const isCheckingRef = useRef(false);
  const isInstallingRef = useRef(false);
  const mountedRef = useRef(true);

  const checkForUpdate = useCallback(async () => {
    if (!isTauri || isCheckingRef.current || isInstallingRef.current) return;
    isCheckingRef.current = true;
    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check({ timeout: CHECK_TIMEOUT_MS });
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
      }
    } catch {
      // Silent when offline or before a release manifest is reachable.
    } finally {
      isCheckingRef.current = false;
    }
  }, [isTauri]);

  useEffect(() => {
    mountedRef.current = true;
    if (!isTauri) {
      return () => {
        mountedRef.current = false;
      };
    }

    const initialTimer = window.setTimeout(() => {
      void checkForUpdate();
    }, INITIAL_CHECK_DELAY_MS);

    const intervalTimer = window.setInterval(() => {
      void checkForUpdate();
    }, PERIODIC_CHECK_INTERVAL_MS);

    const handleOnline = () => {
      void checkForUpdate();
    };
    window.addEventListener('online', handleOnline);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(initialTimer);
      window.clearInterval(intervalTimer);
      window.removeEventListener('online', handleOnline);
      const pending = updateRef.current;
      updateRef.current = null;
      if (pending) {
        void pending.close().catch(() => {});
      }
    };
  }, [isTauri, checkForUpdate]);

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
      setAvailableVersion(null);
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
  }, [availableVersion, isTauri, onNotify]);

  return {
    availableVersion,
    isInstalling,
    installUpdate,
  };
}
