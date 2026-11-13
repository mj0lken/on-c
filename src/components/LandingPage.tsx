import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App, AppHandle } from '../App';
import {
  getAppRouteHref,
  isAppRouteLocation,
} from '../engine/routing';
import {
  applyPageThemeToMeta,
  CALC_COLOR_SCHEME_KEY,
  deriveCalcThemeFromPageTheme,
  derivePageThemeFromCalcTheme,
  loadPageTheme,
  loadSavedSettings,
  PAGE_COLOR_SCHEME_KEY,
  resolveEffectiveScheme,
} from '../engine/storage';
import { TOUR_STEPS, useLiveTutorial } from '../hooks/useLiveTutorial';
import { ThemePreference } from '../types';
import { TutorialCursor } from './TutorialCursor';

const BREW_COMMAND = 'brew install --cask mj0lken/tap/on-c';
const RELEASES_URL = 'https://github.com/mj0lken/on-c/releases/latest';
const REPO_URL = 'https://github.com/mj0lken/on-c';

let cachedSupportsDisplayTransition: boolean | undefined;

/**
 * Runtime probe per `animate-element-entry-exit` (guards against Firefox bug 1882408 where
 * `CSS.supports('transition-behavior', 'allow-discrete')` is true without transitioning `display`).
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

export const LandingPage: React.FC = () => {
  const pageRootRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<AppHandle>(null);
  const privacyDrawerRef = useRef<HTMLDivElement>(null);
  const calcThemeRef = useRef<ThemePreference>(loadSavedSettings().theme);

  const [isAppMode, setIsAppMode] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? isAppRouteLocation(window.location.pathname, window.location.search)
      : false
  );

  const [pageTheme, setPageTheme] = useState<'light' | 'dark'>(loadPageTheme);
  const [osIsDark, setOsIsDark] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
  );
  const [copiedBrew, setCopiedBrew] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);

  const appRouteHref = useMemo(() => getAppRouteHref(), []);

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

  // Apply page theme to `<meta name="color-scheme">` & persist
  useEffect(() => {
    applyPageThemeToMeta(pageTheme);
  }, [pageTheme]);

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

  const handleCopyBrew = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(BREW_COMMAND);
      setCopiedBrew(true);
      window.setTimeout(() => setCopiedBrew(false), 1800);
    } catch {
      // Ignore clipboard permission errors
    }
  }, []);

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
      // Preserve native modifier clicks (e.g. Cmd+Click to open `/app` in a new tab)
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

  return (
    <div
      ref={pageRootRef}
      className={`landing-page ${isAppMode ? 'is-app-mode' : ''}`}
    >
      {/* Top Bar: Brand + GitHub + Moon/Sun Icon Toggle (fades away in `/app` mode) */}
      <div className="fade-collapse-shell site-header-shell" inert={isAppMode}>
        <div className="fade-collapse-inner">
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
        </div>
      </div>

      {/* Hero + Calculator Stage (calculator stays live & glides into centered focus on `/app`) */}
      <section
        id="top"
        className="site-hero"
        aria-label={isAppMode ? 'on/c calculator' : 'Live web calculator and interactive tour'}
      >
        <div className="fade-collapse-shell hero-intro-shell" inert={isAppMode}>
          <div className="fade-collapse-inner hero-intro-inner">
            <h1 className="hero-headline">
              Beautiful calculator that blends math with text.
            </h1>
            <p className="hero-subhead">
              Type naturally—chain <code>ans</code> variables, convert currencies, insert{' '}
              <code>/char</code> symbols, and organize sheets. Use <strong>on/c</strong> right here
              in your browser or install the native macOS app.
            </p>

            <div className="hero-actions">
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

              <button
                type="button"
                className="hero-brew-pill"
                onClick={() => void handleCopyBrew()}
                title="Copy Homebrew install command"
              >
                <span>{BREW_COMMAND}</span>
                <span className="brew-copy-tag">{copiedBrew ? 'Copied ✓' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="hero-calculator-wrap">
          <div className="hero-calculator-frame">
            <App
              ref={appRef}
              embeddedInSite
              onUserInteract={tutorial.yieldToVisitor}
              onCalcThemeChange={handleCalcThemeChange}
            />
          </div>

          <div className="fade-collapse-shell tour-chrome-shell" inert={isAppMode}>
            <div className="fade-collapse-inner tour-chrome-inner">
              {/* WCAG 2.2.2 Accessible Tour Bar: Play/Pause/Replay icon button + Steps + App mode */}
              <div className="tour-bar" role="region" aria-label="Interactive live demo controls">
                <div className="tour-bar-left">
                  <button
                    type="button"
                    className="tour-ctrl-btn tour-icon-btn"
                    onClick={handleTourPrimaryControl}
                    aria-label={tourActionLabel}
                    title={tourActionLabel}
                  >
                    {tutorial.isPlaying ? (
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                        <rect x="3.5" y="3" width="3" height="10" rx="0.9" />
                        <rect x="9.5" y="3" width="3" height="10" rx="0.9" />
                      </svg>
                    ) : tutorial.isFinished ? (
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
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
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                        <path d="M4.6 3.1a.8.8 0 0 1 1.2-.7l7.1 4.9a.8.8 0 0 1 0 1.4l-7.1 4.9a.8.8 0 0 1-1.2-.7V3.1Z" />
                      </svg>
                    )}
                  </button>
                </div>

                <div className="tour-bar-steps" role="group" aria-label="Demo chapters">
                  {TOUR_STEPS.map((step) => {
                    const isCurrent = tutorial.activeStep === step.id;
                    return (
                      <button
                        key={step.id}
                        type="button"
                        className={`tour-step-btn ${isCurrent ? 'is-current' : ''}`}
                        title={step.shortHint}
                        onClick={() => tutorial.jumpToStep(step.id)}
                      >
                        {step.label}
                      </button>
                    );
                  })}
                </div>

                <div className="tour-bar-right">
                  <a
                    href={appRouteHref}
                    className="tour-ctrl-btn app-mode-btn"
                    onClick={handleEnterAppMode}
                    title="Focus calculator and fade away page chrome (/app)"
                  >
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path
                        d="M10 2.5h3.5V6M6 13.5H2.5V10M13.5 2.5 9.3 6.7M2.5 13.5l4.2-4.2"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span>App mode</span>
                  </a>
                </div>
              </div>

              <p className="tour-caption">
                {tutorial.isPlaying
                  ? 'Watching live demo — click or type anywhere in the calculator to take over immediately.'
                  : 'Live web calculator — all sheets, archives & settings save automatically in your browser.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Minimal Footer with Expandable Privacy Panel (`animate-element-entry-exit`) */}
      <div className="fade-collapse-shell site-footer-shell" inert={isAppMode}>
        <div className="fade-collapse-inner">
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
                      <strong>Offline-capable FX</strong> — fetches public ECB reference rates
                      anonymously and falls back seamlessly to cached rates offline.
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="site-footer">
              <span>
                <strong>on/c</strong> · Free &amp; open source under the MIT License
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
