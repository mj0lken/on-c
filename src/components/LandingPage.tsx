import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App, AppHandle } from '../App';
import {
  getAppRouteHref,
  getHomeRouteHref,
  isAppRouteLocation,
} from '../engine/routing';
import {
  applyPageThemeToMeta,
  CALC_COLOR_SCHEME_KEY,
  deriveCalcThemeFromPageTheme,
  derivePageThemeFromCalcTheme,
  loadPageTheme,
  loadSavedAppSize,
  loadSavedSettings,
  PAGE_COLOR_SCHEME_KEY,
  persistAppSize,
  resolveEffectiveScheme,
  SavedAppSize,
} from '../engine/storage';
import { useLiveTutorial } from '../hooks/useLiveTutorial';
import { ThemePreference } from '../types';
import { TutorialCursor } from './TutorialCursor';

const BREW_COMMAND = 'brew install --cask mj0lken/tap/on-c';
const RELEASES_URL = 'https://github.com/mj0lken/on-c/releases/latest';
const REPO_URL = 'https://github.com/mj0lken/on-c';
const NUMI_URL = 'https://numi.app';

const DEFAULT_APP_SIZE: SavedAppSize = { width: 520, height: 580 };
const MIN_APP_WIDTH = 360;
const MIN_APP_HEIGHT = 400;

let cachedSupportsDisplayTransition: boolean | undefined;

/**
 * Probes whether the current browser actually animates discrete `display` transitions
 * (guards against Firefox bug 1882408 where `CSS.supports('transition-behavior', 'allow-discrete')`
 * returns `true` without transitioning `display`).
 */
function canTransitionDisplay(): boolean {
  if (cachedSupportsDisplayTransition !== undefined) {
    return cachedSupportsDisplayTransition;
  }
  if (
    typeof window === 'undefined' ||
    !window.CSS?.supports?.('transition-behavior', 'allow-discrete') ||
    !document.body
  ) {
    return false;
  }
  const probe = document.createElement('div');
  probe.style.cssText = 'transition: display 1s allow-discrete !important; display: block;';
  document.body.appendChild(probe);
  void getComputedStyle(probe).display;
  probe.style.display = 'none';
  cachedSupportsDisplayTransition = getComputedStyle(probe).display === 'block';
  probe.remove();
  return cachedSupportsDisplayTransition;
}

function legacyCopyText(text: string): boolean {
  if (typeof document === 'undefined' || !document.body) return false;
  const field = Object.assign(document.createElement('textarea'), { value: text });
  field.setAttribute('readonly', '');
  field.style.cssText = 'position:fixed;inset-block-start:0;opacity:0';
  document.body.append(field);
  field.select();
  try {
    return document.execCommand('copy');
  } finally {
    field.remove();
  }
}

function clampAppSize(width: number, height: number): SavedAppSize {
  const maxW =
    typeof window !== 'undefined' ? Math.max(MIN_APP_WIDTH, window.innerWidth - 32) : 1200;
  const maxH =
    typeof window !== 'undefined' ? Math.max(MIN_APP_HEIGHT, window.innerHeight - 32) : 960;
  return {
    width: Math.round(Math.min(Math.max(MIN_APP_WIDTH, width), maxW)),
    height: Math.round(Math.min(Math.max(MIN_APP_HEIGHT, height), maxH)),
  };
}

export const LandingPage: React.FC = () => {
  const pageRootRef = useRef<HTMLDivElement>(null);
  const calcFrameRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<AppHandle>(null);
  const privacyDrawerRef = useRef<HTMLDivElement>(null);
  const calcThemeRef = useRef<ThemePreference>(loadSavedSettings().theme);

  const copyTimerRef = useRef<number | null>(null);
  const lastCopyMessageRef = useRef<string>('');
  const resizeDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    latest: SavedAppSize;
  } | null>(null);

  const [isAppMode, setIsAppMode] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? isAppRouteLocation(window.location.pathname, window.location.search)
      : false
  );

  const [pageTheme, setPageTheme] = useState<'light' | 'dark'>(loadPageTheme);
  const [osIsDark, setOsIsDark] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
  );

  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [copyStatusText, setCopyStatusText] = useState<string>('');
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);

  const [appSize, setAppSize] = useState<SavedAppSize>(
    () => loadSavedAppSize() ?? DEFAULT_APP_SIZE
  );
  const [isResizing, setIsResizing] = useState(false);

  const appRouteHref = useMemo(() => getAppRouteHref(), []);
  const homeRouteHref = useMemo(() => getHomeRouteHref(), []);

  const tutorial = useLiveTutorial(appRef, isAppMode);

  // Sync browser Back / Forward navigation between `/` and `/app` smoothly without remounting `<App />`
  useEffect(() => {
    const onPopState = () => {
      const nextAppMode = isAppRouteLocation(window.location.pathname, window.location.search);
      setIsAppMode(nextAppMode);
      if (nextAppMode) {
        tutorial.yieldToVisitor();
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [tutorial]);

  // Keep OS `prefers-color-scheme` tracked; if calculator theme is `system`, keep page contrasted
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => {
      setOsIsDark(e.matches);
      if (calcThemeRef.current === 'system') {
        setPageTheme(derivePageThemeFromCalcTheme('system', e.matches));
      }
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // Apply page theme to `<meta name="color-scheme">`, `<html data-color-scheme>`, & persist
  useEffect(() => {
    applyPageThemeToMeta(pageTheme, osIsDark);
  }, [pageTheme, osIsDark]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  // Cross-tab storage sync for coupled page + calculator themes
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === PAGE_COLOR_SCHEME_KEY && (e.newValue === 'light' || e.newValue === 'dark')) {
        setPageTheme(e.newValue);
      } else if (
        e.key === CALC_COLOR_SCHEME_KEY &&
        (e.newValue === 'light' || e.newValue === 'dark' || e.newValue === 'system')
      ) {
        calcThemeRef.current = e.newValue;
        setPageTheme(derivePageThemeFromCalcTheme(e.newValue, osIsDark));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [osIsDark]);

  // Changing theme on the page flips BOTH page and calculator themes
  const handleTogglePageTheme = useCallback(() => {
    const currentPage = resolveEffectiveScheme(pageTheme, osIsDark);
    const nextPage: 'light' | 'dark' = currentPage === 'light' ? 'dark' : 'light';
    const nextCalc = deriveCalcThemeFromPageTheme(nextPage);
    calcThemeRef.current = nextCalc;
    setPageTheme(nextPage);
    appRef.current?.setThemeFromSite(nextCalc);
  }, [pageTheme, osIsDark]);

  // Changing theme inside Calculator Settings flips BOTH calculator and page themes
  const handleCalcThemeChange = useCallback(
    (nextCalcTheme: ThemePreference) => {
      calcThemeRef.current = nextCalcTheme;
      const nextPage = derivePageThemeFromCalcTheme(nextCalcTheme, osIsDark);
      setPageTheme(nextPage);
    },
    [osIsDark]
  );

  const reportCopyOutcome = useCallback((ok: boolean) => {
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
    let message = ok ? 'Copied' : 'Copy failed';
    if (message === lastCopyMessageRef.current) {
      message += '\u00A0';
    }
    lastCopyMessageRef.current = message;
    setCopyStatusText('');
    setCopyState(ok ? 'copied' : 'failed');
    requestAnimationFrame(() => {
      setCopyStatusText(message);
    });
    copyTimerRef.current = window.setTimeout(() => {
      setCopyState('idle');
      setCopyStatusText('');
      copyTimerRef.current = null;
    }, 1800);
  }, []);

  const handleCopyBrew = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(BREW_COMMAND);
      reportCopyOutcome(true);
    } catch {
      reportCopyOutcome(legacyCopyText(BREW_COMMAND));
    }
  }, [reportCopyOutcome]);

  const closePrivacyDrawerAnimated = useCallback(async () => {
    const el = privacyDrawerRef.current;
    setIsPrivacyOpen(false);
    if (!el || el.hidden) return;

    if (canTransitionDisplay()) {
      el.hidden = true;
      return;
    }

    el.setAttribute('data-closing', '');
    const animations = el.getAnimations();
    if (animations.length > 0) {
      await Promise.race([
        Promise.allSettled(animations.map((a) => a.finished)),
        new Promise((r) => window.setTimeout(r, 600)),
      ]);
    }
    if (el.hasAttribute('data-closing')) {
      el.removeAttribute('data-closing');
      el.hidden = true;
    }
  }, []);

  const handleTogglePrivacy = useCallback(() => {
    const el = privacyDrawerRef.current;
    if (!el) return;

    if (isPrivacyOpen) {
      void closePrivacyDrawerAnimated();
      return;
    }

    el.removeAttribute('data-closing');
    el.hidden = false;
    setIsPrivacyOpen(true);

    requestAnimationFrame(() => {
      el.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
        block: 'nearest',
      });
    });
  }, [isPrivacyOpen, closePrivacyDrawerAnimated]);

  const handleEnterAppMode = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
        return;
      }
      e.preventDefault();
      tutorial.yieldToVisitor();
      if (isPrivacyOpen) {
        void closePrivacyDrawerAnimated();
      }
      if (!isAppRouteLocation(window.location.pathname, window.location.search)) {
        window.history.pushState({}, '', appRouteHref);
      }
      setIsAppMode(true);
      requestAnimationFrame(() => {
        appRef.current?.focusLastRow();
      });
    },
    [appRouteHref, isPrivacyOpen, closePrivacyDrawerAnimated, tutorial]
  );

  const handleExitAppMode = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
        return;
      }
      e.preventDefault();
      if (isAppRouteLocation(window.location.pathname, window.location.search)) {
        window.history.pushState({}, '', homeRouteHref);
      }
      setIsAppMode(false);
    },
    [homeRouteHref]
  );

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isAppMode || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const frame = calcFrameRef.current;
      const rect = frame?.getBoundingClientRect();
      const startW = rect ? rect.width : appSize.width;
      const startH = rect ? rect.height : appSize.height;
      const initial = clampAppSize(startW, startH);

      e.currentTarget.setPointerCapture(e.pointerId);
      resizeDragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startW: initial.width,
        startH: initial.height,
        latest: initial,
      };
      setIsResizing(true);
    },
    [isAppMode, appSize.width, appSize.height]
  );

  const handleResizePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = resizeDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    // Symmetric resize around screen center keeps the corner locked 1:1 under the pointer
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const next = clampAppSize(drag.startW + dx * 2, drag.startH + dy * 2);
    drag.latest = next;
    setAppSize(next);
  }, []);

  const finishResizeDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = resizeDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    persistAppSize(drag.latest);
    resizeDragRef.current = null;
    setIsResizing(false);
  }, []);

  const handleResizeReset = useCallback(() => {
    const reset = clampAppSize(DEFAULT_APP_SIZE.width, DEFAULT_APP_SIZE.height);
    setAppSize(reset);
    persistAppSize(reset);
  }, []);

  const handleResizeKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const step = e.shiftKey ? 48 : 24;
      let next: SavedAppSize | null = null;
      if (e.key === 'ArrowRight') {
        next = clampAppSize(appSize.width + step, appSize.height);
      } else if (e.key === 'ArrowLeft') {
        next = clampAppSize(appSize.width - step, appSize.height);
      } else if (e.key === 'ArrowDown') {
        next = clampAppSize(appSize.width, appSize.height + step);
      } else if (e.key === 'ArrowUp') {
        next = clampAppSize(appSize.width, appSize.height - step);
      } else if (e.key === 'Home' || e.key === '0') {
        next = clampAppSize(DEFAULT_APP_SIZE.width, DEFAULT_APP_SIZE.height);
      }
      if (next) {
        e.preventDefault();
        setAppSize(next);
        persistAppSize(next);
      }
    },
    [appSize.width, appSize.height]
  );

  const tourActionLabel = tutorial.isPlaying
    ? 'Pause tutorial'
    : tutorial.isFinished
      ? 'Replay tutorial'
      : 'Play tutorial';

  const handleTourPrimaryControl = useCallback(() => {
    if (tutorial.isPlaying) {
      tutorial.togglePlayPause();
    } else if (tutorial.isFinished) {
      tutorial.replayFromStart();
    } else {
      tutorial.togglePlayPause();
    }
  }, [tutorial]);

  const calcFrameStyle = useMemo<React.CSSProperties | undefined>(
    () =>
      isAppMode
        ? ({
            '--calc-app-w': `${appSize.width}px`,
            '--calc-app-h': `${appSize.height}px`,
          } as React.CSSProperties)
        : undefined,
    [isAppMode, appSize.width, appSize.height]
  );

  return (
    <div
      ref={pageRootRef}
      className={`landing-page ${isAppMode ? 'is-app-mode' : ''}`}
      data-page-theme={pageTheme}
    >
      {/* Top-Left Minimize Icon in Expanded (`/app`) Mode */}
      {isAppMode && (
        <a
          href={homeRouteHref}
          className="app-minimize-btn"
          onClick={handleExitAppMode}
          aria-label="Minimize app mode"
          title="Minimize to landing page"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M6.4 2.6v3.8H2.6M9.6 13.4V9.6h3.8M2.2 2.2l4.2 4.2M13.8 13.8 9.6 9.6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      )}

      {/* Top Band: Site Header + "Simply. Math" Headline (fades away in `/app` mode) */}
      <div className="landing-top-band" inert={isAppMode}>
        <div className="landing-band-inner landing-top-inner">
          <header className="site-header">
            <a href="#top" className="site-brand" aria-label="on/c home">
              on<span className="site-brand-slash">/</span>c
            </a>

            <nav className="site-nav" aria-label="Primary">
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="site-nav-link"
              >
                GitHub
              </a>

              <button
                type="button"
                className="page-theme-toggle"
                onClick={handleTogglePageTheme}
                title="Flip page & calculator themes"
              >
                <span className="theme-switch-option theme-opt-when-light">
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path
                      d="M13.4 9.8A5.8 5.8 0 0 1 6.2 2.6a5.8 5.8 0 1 0 7.2 7.2Z"
                      stroke="currentColor"
                      strokeWidth="1.45"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="sr-only">Switch to dark page and light calculator</span>
                </span>

                <span className="theme-switch-option theme-opt-when-dark">
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.45" />
                    <path
                      d="M8 1.6v1.5M8 12.9v1.5M1.6 8h1.5M12.9 8h1.5M3.5 3.5l1.1 1.1M11.4 11.4l1.1 1.1M12.5 3.5l-1.1 1.1M4.6 11.4l-1.1 1.1"
                      stroke="currentColor"
                      strokeWidth="1.45"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="sr-only">Switch to light page and dark calculator</span>
                </span>
              </button>
            </nav>
          </header>

          <div className="hero-title-wrap">
            <h1 className="hero-headline">
              Simply. <span className="hero-headline-thin">Math</span>
            </h1>
          </div>
        </div>
      </div>

      {/* Center Stage: Calculator (always centered in viewport; resizable in `/app` mode) */}
      <section
        id="top"
        className="landing-center-stage"
        aria-label={isAppMode ? 'on/c calculator' : 'Live web calculator'}
      >
        <div
          ref={calcFrameRef}
          className={`hero-calculator-frame ${isResizing ? 'is-resizing' : ''}`}
          style={calcFrameStyle}
        >
          <App
            ref={appRef}
            embeddedInSite
            onUserInteract={tutorial.yieldToVisitor}
            onCalcThemeChange={handleCalcThemeChange}
          />

          {isAppMode && (
            <div
              role="button"
              tabIndex={0}
              className="calc-resize-handle"
              aria-label="Resize calculator"
              title="Drag to resize · Double-click to reset"
              onPointerDown={handleResizePointerDown}
              onPointerMove={handleResizePointerMove}
              onPointerUp={finishResizeDrag}
              onPointerCancel={finishResizeDrag}
              onDoubleClick={handleResizeReset}
              onKeyDown={handleResizeKeyDown}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path
                  d="M10.5 3.5 3.5 10.5M10.5 7.5l-3 3"
                  stroke="currentColor"
                  strokeWidth="1.35"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          )}
        </div>
      </section>

      {/* Bottom Band: Play/Pause/Loop + Expand Icons, Download + Brew Stack, & Footer */}
      <div className="landing-bottom-band" inert={isAppMode}>
        <div className="landing-band-inner landing-bottom-inner">
          <div className="calc-under-controls" role="group" aria-label="Calculator controls">
            <button
              type="button"
              className="calc-under-icon-btn"
              onClick={handleTourPrimaryControl}
              aria-label={tourActionLabel}
              title={tourActionLabel}
            >
              {tutorial.isPlaying ? (
                <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <rect x="3.5" y="3" width="3" height="10" rx="0.9" />
                  <rect x="9.5" y="3" width="3" height="10" rx="0.9" />
                </svg>
              ) : tutorial.isFinished ? (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M2.8 8a5.2 5.2 0 1 0 1.4-3.6L2.6 6"
                    stroke="currentColor"
                    strokeWidth="1.55"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M2.5 2.8V6h3.2"
                    stroke="currentColor"
                    strokeWidth="1.55"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M4.6 3.1a.8.8 0 0 1 1.2-.7l7.1 4.9a.8.8 0 0 1 0 1.4l-7.1 4.9a.8.8 0 0 1-1.2-.7V3.1Z" />
                </svg>
              )}
            </button>

            <a
              href={appRouteHref}
              className="calc-under-icon-btn"
              onClick={handleEnterAppMode}
              aria-label="Expand calculator to app mode"
              title="Expand (/app)"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M10 2.5h3.5V6M6 13.5H2.5V10M13.5 2.5 9.3 6.7M2.5 13.5l4.2-4.2"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </div>

          <div className="hero-install-stack">
            <a
              href={RELEASES_URL}
              className="hero-cta-primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M11.6 8.5c0-1.7 1.4-2.5 1.5-2.6-.8-1.2-2.1-1.3-2.5-1.4-1.1-.1-2.1.6-2.6.6-.6 0-1.4-.6-2.3-.6-1.2 0-2.3.7-2.9 1.8-1.3 2.2-.3 5.4.9 7.2.6.9 1.3 1.8 2.2 1.8.9 0 1.3-.6 2.4-.6 1.1 0 1.4.6 2.4.6 1 0 1.6-.9 2.2-1.7.7-1 1-2 1-2.1-.1 0-2.3-.9-2.3-3ZM9.8 3.2c.5-.6.8-1.4.7-2.2-.7 0-1.6.5-2.1 1.1-.4.5-.8 1.4-.7 2.2.8.1 1.6-.4 2.1-1.1Z" />
              </svg>
              <span>Download for macOS</span>
            </a>

            <div className="brew-copy-wrap">
              <button
                type="button"
                className="hero-brew-pill"
                data-copied={copyState === 'copied' ? '' : undefined}
                data-failed={copyState === 'failed' ? '' : undefined}
                onClick={() => void handleCopyBrew()}
                aria-label={`Copy Homebrew command: ${BREW_COMMAND}`}
                title="Copy Homebrew install command"
              >
                <code className="brew-cmd-text">{BREW_COMMAND}</code>
                <span className="brew-copy-icon" aria-hidden="true">
                  {copyState === 'copied' ? (
                    <svg width="13.5" height="13.5" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M3.2 8.4 6.5 11.7 12.8 4.6"
                        stroke="currentColor"
                        strokeWidth="1.65"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg width="13.5" height="13.5" viewBox="0 0 16 16" fill="none">
                      <rect
                        x="5.5"
                        y="5.5"
                        width="8"
                        height="8"
                        rx="1.6"
                        stroke="currentColor"
                        strokeWidth="1.35"
                      />
                      <path
                        d="M10.5 5.5V3.9A1.4 1.4 0 0 0 9.1 2.5H3.9A1.4 1.4 0 0 0 2.5 3.9v5.2a1.4 1.4 0 0 0 1.4 1.4h1.6"
                        stroke="currentColor"
                        strokeWidth="1.35"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                </span>
              </button>
              <span className="sr-only" role="status">
                {copyStatusText}
              </span>
            </div>
          </div>

          <footer className="site-footer-wrap">
            <div
              ref={privacyDrawerRef}
              id="footer-privacy-drawer"
              className="footer-privacy-drawer"
              hidden
            >
              <div className="privacy-panel">
                <div>
                  <span className="section-eyebrow">Local-First Privacy</span>
                  <h2 className="section-title">
                    Saved in your browser. Zero data collected.
                  </h2>
                  <p className="section-desc">
                    Every sheet, tab, archived calculation, and preference you create in the web app
                    stays exclusively inside your own browser’s{' '}
                    <code className="privacy-code">localStorage</code>. We never see, transmit, or
                    store your notes.
                  </p>
                </div>

                <ul className="privacy-points">
                  <li className="privacy-point">
                    <span className="privacy-check" aria-hidden="true">✓</span>
                    <span>
                      <strong>No accounts, cookies, or telemetry</strong> — zero analytics scripts,
                      zero tracking pixels, and zero server-side logging.
                    </span>
                  </li>
                  <li className="privacy-point">
                    <span className="privacy-check" aria-hidden="true">✓</span>
                    <span>
                      <strong>Safe 30-day local archive</strong> — closed tabs remain restorable in
                      Settings (<code className="privacy-code">7d</code> /{' '}
                      <code className="privacy-code">30d</code> /{' '}
                      <code className="privacy-code">90d</code>) right on your device.
                    </span>
                  </li>
                  <li className="privacy-point">
                    <span className="privacy-check" aria-hidden="true">✓</span>
                    <span>
                      <strong>Offline-capable FX</strong> — fetches public daily reference rates
                      anonymously and falls back seamlessly to cached rates offline.
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="site-footer">
              <span>
                <strong>on/c</strong> · Inspired by{' '}
                <a
                  href={NUMI_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="site-footer-inline-link"
                >
                  Numi
                </a>{' '}
                · Free &amp; open source under the MIT License
              </span>

              <div className="site-footer-links">
                <button
                  type="button"
                  className={`site-footer-btn ${isPrivacyOpen ? 'is-open' : ''}`}
                  aria-expanded={isPrivacyOpen}
                  aria-controls="footer-privacy-drawer"
                  onClick={handleTogglePrivacy}
                >
                  Privacy
                </button>
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="site-footer-link"
                >
                  GitHub Repo
                </a>
                <a
                  href={RELEASES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="site-footer-link"
                >
                  macOS Releases
                </a>
                <a
                  href={`${REPO_URL}/issues`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="site-footer-link"
                >
                  Report an Issue
                </a>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* Animated Tutorial Pointer Cursor (`popover="manual"` top-layer overlay) */}
      <TutorialCursor cursor={tutorial.cursor} scopeRef={pageRootRef} />
    </div>
  );
};
