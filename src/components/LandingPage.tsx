import React, { useCallback, useEffect, useRef, useState } from 'react';
import { App, AppHandle } from '../App';
import {
  applyPageThemeToMeta,
  loadPageTheme,
  PAGE_COLOR_SCHEME_KEY,
  resolveEffectiveScheme,
} from '../engine/storage';
import { TOUR_STEPS, useLiveTutorial } from '../hooks/useLiveTutorial';
import { ThemePreference } from '../types';

interface ShowcaseCardData {
  title: string;
  description: string;
  lines: Array<{ expr: string; res: string }>;
}

const SHOWCASE_CARDS: ReadonlyArray<ShowcaseCardData> = [
  {
    title: 'Natural math & ans chaining',
    description:
      'Write plain-English labels alongside percentages and expressions. Reference the previous result with ans, or click any older output to create ans1.',
    lines: [
      { expr: 'MacBook Air: 1299 - 8%', res: '1 195.08' },
      { expr: 'AppleCare: ans * 12%', res: '143.41' },
      { expr: 'sum // total setup', res: '1 338.49' },
    ],
  },
  {
    title: 'Live currencies & physical units',
    description:
      'Convert between 30+ currencies with live ECB reference rates (plus offline fallback), lengths, weights, data sizes, temperatures, and calendar dates.',
    lines: [
      { expr: 'Flight: $780 in EUR', res: '€720.12' },
      { expr: 'Hotel: 42 000 JPY in EUR', res: '€258.30' },
      { expr: '6 ft 2 in cm', res: '187.96 cm' },
    ],
  },
  {
    title: '# Auto-named sheets & --- dividers',
    description:
      'Start line 1 with # to name your tab automatically. Use # headings or blank lines to scope sum and avg blocks, and --- for clean visual dividers.',
    lines: [
      { expr: '# Tokyo Trip', res: 'Tab title' },
      { expr: '---', res: 'Visual rule' },
      { expr: 'avg // block average', res: '489.21' },
    ],
  },
  {
    title: '/char, /help & .md export',
    description:
      'Type /char anywhere to filter symbols like °, √, π, and ∛ without leaving the keyboard, /help for syntax search, or export Markdown & CSV tables.',
    lines: [
      { expr: 'sin 30° + sqrt 144', res: '12.5' },
      { expr: '/char', res: 'Open symbols' },
      { expr: '/help', res: 'Syntax guide' },
    ],
  },
];

const BREW_COMMAND = 'brew install --cask mj0lken/tap/on-c';
const RELEASES_URL = 'https://github.com/mj0lken/on-c/releases/latest';
const REPO_URL = 'https://github.com/mj0lken/on-c';

export const LandingPage: React.FC = () => {
  const appRef = useRef<AppHandle>(null);
  const heroCalcRef = useRef<HTMLDivElement>(null);

  const [pageTheme, setPageTheme] = useState<ThemePreference>(loadPageTheme);
  const [osIsDark, setOsIsDark] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false
  );
  const [copiedBrew, setCopiedBrew] = useState(false);

  const tutorial = useLiveTutorial(appRef);

  // Keep OS `prefers-color-scheme` tracked for accurate toggle inversion (`dark-mode` + `dark-mode-toggle`)
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setOsIsDark(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // Apply initial page theme to `<meta name="color-scheme">` & sync across browser tabs
  useEffect(() => {
    applyPageThemeToMeta(pageTheme);
  }, [pageTheme]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === PAGE_COLOR_SCHEME_KEY && e.newValue) {
        const v = e.newValue as ThemePreference;
        if (v === 'light' || v === 'dark' || v === 'system') {
          setPageTheme(v);
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const handleTogglePageTheme = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (e.altKey) {
        setPageTheme('system');
        return;
      }
      const currentRendered = resolveEffectiveScheme(pageTheme, osIsDark);
      const nextScheme: ThemePreference = currentRendered === 'light' ? 'dark' : 'light';
      setPageTheme(nextScheme);
    },
    [pageTheme, osIsDark]
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

  const handleTrySnippet = useCallback(
    (expr: string) => {
      tutorial.yieldToVisitor();
      heroCalcRef.current?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
        block: 'center',
      });
      appRef.current?.insertExpressionFromSite(expr);
    },
    [tutorial]
  );

  return (
    <div className="landing-page">
      {/* Top Bar: Brand + Minimal Links + Top-Right Page Theme Changer */}
      <header className="site-header">
        <a href="#top" className="site-brand" aria-label="on/c home">
          <span className="site-brand-badge" aria-hidden="true">
            on<span className="site-brand-slash">/</span>c
          </span>
          <span>
            on<span className="site-brand-slash">/</span>c
          </span>
        </a>

        <nav className="site-nav" aria-label="Primary">
          <a href="#features" className="site-nav-link site-nav-hide-mobile">
            Features
          </a>
          <a href="#privacy" className="site-nav-link site-nav-hide-mobile">
            Privacy
          </a>
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
            title="Switch page background theme (⌥Click to follow system)"
          >
            <span className="theme-switch-option theme-opt-when-light">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M13.4 9.8A5.8 5.8 0 0 1 6.2 2.6a5.8 5.8 0 1 0 7.2 7.2Z"
                  stroke="currentColor"
                  strokeWidth="1.45"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Dark page</span>
              <span className="sr-only"> (switch website background to dark mode)</span>
            </span>

            <span className="theme-switch-option theme-opt-when-dark">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.45" />
                <path
                  d="M8 1.6v1.5M8 12.9v1.5M1.6 8h1.5M12.9 8h1.5M3.5 3.5l1.1 1.1M11.4 11.4l1.1 1.1M12.5 3.5l-1.1 1.1M4.6 11.4l-1.1 1.1"
                  stroke="currentColor"
                  strokeWidth="1.45"
                  strokeLinecap="round"
                />
              </svg>
              <span>Light page</span>
              <span className="sr-only"> (switch website background to light mode)</span>
            </span>
          </button>
        </nav>
      </header>

      {/* Hero: Headline + Download/Brew + Live Web App + Seamless 5-Step Live Tutorial */}
      <section id="top" className="site-hero" aria-label="Live web calculator and interactive tour">
        <h1 className="hero-headline">
          Beautiful calculator that blends math with text.
        </h1>
        <p className="hero-subhead">
          Type naturally—chain <code>ans</code> variables, convert currencies, insert{' '}
          <code>/char</code> symbols, and organize sheets. Use <strong>on/c</strong> right here in
          your browser or install the native macOS app.
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

        <div ref={heroCalcRef} className="hero-calculator-wrap">
          <div className="hero-calculator-frame">
            <App
              ref={appRef}
              embeddedInSite
              onUserInteract={tutorial.yieldToVisitor}
            />
          </div>

          {/* WCAG 2.2.2 Accessible Tour Bar: Pause/Play (no aria-pressed when label swaps) + Step Jumpers */}
          <div className="tour-bar" role="region" aria-label="Interactive live demo controls">
            <div className="tour-bar-left">
              <button
                type="button"
                className="tour-ctrl-btn"
                onClick={tutorial.togglePlayPause}
              >
                <span
                  className={`tour-live-dot ${tutorial.isPlaying ? 'is-active' : ''}`}
                  aria-hidden="true"
                />
                <span>{tutorial.isPlaying ? 'Pause' : 'Play tour'}</span>
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
              <button
                type="button"
                className="tour-ctrl-btn"
                onClick={tutorial.replayFromStart}
                title="Replay full live tour from the beginning"
              >
                Replay
              </button>
            </div>
          </div>

          <p className="tour-caption">
            {tutorial.isPlaying
              ? 'Watching live demo — click or type anywhere in the calculator to take over immediately.'
              : 'Live web calculator — all sheets, archives & settings save automatically in your browser.'}
          </p>
        </div>
      </section>

      {/* Numi-Style Interactive Syntax Showcase */}
      <section id="features" className="site-section" aria-labelledby="features-heading">
        <div className="section-header">
          <span className="section-eyebrow">Live Syntax</span>
          <h2 id="features-heading" className="section-title">
            Designed like a quiet notepad. Built for real numbers.
          </h2>
          <p className="section-desc">
            Click any line below to insert and evaluate it directly inside the live calculator
            above—or flip the calculator via the gear icon to customize decimals, themes, and
            30-day tab retention.
          </p>
        </div>

        <div className="showcase-grid">
          {SHOWCASE_CARDS.map((card) => (
            <article key={card.title} className="showcase-card">
              <div>
                <h3 className="showcase-card-title">{card.title}</h3>
                <p className="showcase-card-copy">{card.description}</p>
              </div>

              <div className="showcase-snippet" role="group" aria-label={`${card.title} examples`}>
                {card.lines.map((line) => (
                  <button
                    key={line.expr}
                    type="button"
                    className="showcase-line-btn"
                    onClick={() => handleTrySnippet(line.expr)}
                    title={`Try "${line.expr}" in the calculator above`}
                  >
                    <span className="showcase-expr">{line.expr}</span>
                    <span className="showcase-res">{line.res}</span>
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Local-Only Privacy Section */}
      <section id="privacy" className="site-section" aria-labelledby="privacy-heading">
        <div className="privacy-panel">
          <div>
            <span className="section-eyebrow">Local-First Privacy</span>
            <h2 id="privacy-heading" className="section-title">
              Saved in your browser. Zero data collected.
            </h2>
            <p className="section-desc">
              Every sheet, tab, archived calculation, and preference you create in the web app stays
              exclusively inside your own browser’s <code className="privacy-code">localStorage</code>.
              We never see, transmit, or store your notes.
            </p>
          </div>

          <ul className="privacy-points">
            <li className="privacy-point">
              <span className="privacy-check" aria-hidden="true">✓</span>
              <span>
                <strong>No accounts, cookies, or telemetry</strong> — zero analytics scripts, zero
                tracking pixels, and zero server-side logging.
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
                <strong>Offline-capable FX</strong> — fetches public ECB reference rates anonymously
                and falls back seamlessly to cached rates offline.
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="site-footer">
        <span>
          <strong>on/c</strong> · Free &amp; open source under the MIT License
        </span>

        <div className="site-footer-links">
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
      </footer>
    </div>
  );
};
