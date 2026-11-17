import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CURRENCIES, CurrencyInfo } from '../engine/currencies';

/** Group 1: the big ones, with SEK at the bottom. */
const MAJOR_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'CHF', 'CAD', 'AUD', 'SEK'];

/** Group 2: crypto. */
const CRYPTO_CURRENCIES = ['BTC', 'ETH', 'SOL'];

/** Group 3: other commonly used currencies (rough global usage order). */
const COMMON_CURRENCIES = [
  'NOK', 'DKK', 'NZD', 'HKD', 'SGD', 'INR', 'KRW', 'BRL', 'MXN', 'ZAR',
  'PLN', 'CZK', 'HUF', 'ISK', 'TRY', 'ILS', 'AED', 'SAR', 'THB', 'TWD',
  'PHP', 'IDR', 'MYR',
];

const PINNED = [...MAJOR_CURRENCIES, ...CRYPTO_CURRENCIES, ...COMMON_CURRENCIES];
/** Last code of each pinned tier gets a divider under it. */
const GROUP_ENDS = new Set([
  MAJOR_CURRENCIES.at(-1),
  CRYPTO_CURRENCIES.at(-1),
  COMMON_CURRENCIES.at(-1),
]);

const getSortedCurrencies = (): CurrencyInfo[] => [
  ...PINNED.filter((c) => CURRENCIES[c]).map((c) => CURRENCIES[c]),
  ...Object.values(CURRENCIES)
    .filter((c) => !PINNED.includes(c.code))
    .sort((a, b) => a.code.localeCompare(b.code)),
];

interface CurrencyBrowserProps {
  id?: string;
}

/** Browse-only, searchable list of every supported currency; clicking a row copies its ticker. */
export const CurrencyBrowser: React.FC<CurrencyBrowserProps> = ({ id }) => {
  const uid = useId().replace(/:/g, '');
  const popoverId = `currency-browser-${uid}`;
  const btnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const copiedTimerRef = useRef<number | undefined>(undefined);

  const copyTicker = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      return;
    }
    setCopiedCode(code);
    window.clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = window.setTimeout(() => setCopiedCode(null), 1200);
  };

  useEffect(() => () => window.clearTimeout(copiedTimerRef.current), []);

  // CURRENCIES grows at runtime when the FX feed registers new codes; recompute on open.
  const [catalogVersion, setCatalogVersion] = useState(0);
  const sorted = useMemo(getSortedCurrencies, [catalogVersion]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((c) => {
      const hay = `${c.code} ${c.name} ${c.symbol}`.toLowerCase();
      return q.split(/\s+/).every((term) => hay.includes(term));
    });
  }, [query, sorted]);

  useEffect(() => {
    const pop = popoverRef.current;
    const btn = btnRef.current;
    if (!pop || !btn) return;
    const handleToggle = (ev: Event) => {
      if ((ev as ToggleEvent).newState !== 'open') return;
      setQuery('');
      setCatalogVersion((v) => v + 1);
      if (!CSS.supports('position-area', 'block-start')) {
        const t = btn.getBoundingClientRect();
        const m = pop.getBoundingClientRect();
        const fitsBelow = t.bottom + m.height + 6 <= window.innerHeight - 8;
        pop.style.top = `${fitsBelow ? t.bottom + 6 : Math.max(8, t.top - m.height - 6)}px`;
        pop.style.left = `${Math.max(10, Math.min(t.right - m.width, window.innerWidth - m.width - 10))}px`;
      }
      requestAnimationFrame(() => searchInputRef.current?.focus({ preventScroll: true }));
    };
    pop.addEventListener('toggle', handleToggle);
    return () => pop.removeEventListener('toggle', handleToggle);
  }, []);

  return (
    <>
      <button
        ref={btnRef}
        id={id}
        type="button"
        className="setting-select currency-browser-btn"
        {...({ popovertarget: popoverId } as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        Browse ({sorted.length})
      </button>
      <div
        ref={popoverRef}
        id={popoverId}
        className="symbol-more-popover currency-browser-popover"
        aria-label="Search currencies"
        {...({ popover: 'auto' } as React.HTMLAttributes<HTMLDivElement>)}
      >
        <search className="symbol-search-wrap">
          <svg className="symbol-search-icon" width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.8" />
            <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            spellCheck={false}
            autoComplete="off"
            className="symbol-search-input"
            placeholder="Search currencies (sek, yen, franc)…"
            aria-label="Search currencies"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </search>
        <ul className="symbol-list" aria-label="Supported currencies" tabIndex={0}>
          {filtered.length === 0 ? (
            <li className="symbol-empty">No matching currency</li>
          ) : (
            filtered.map((c) => (
              <li key={c.code} className={!query && GROUP_ENDS.has(c.code) ? 'is-group-end' : undefined}>
                <button
                  type="button"
                  className="symbol-list-item currency-copy-row"
                  title={`Copy ${c.code}`}
                  aria-label={`${c.name}, copy ticker ${c.code}`}
                  onClick={() => void copyTicker(c.code)}
                >
                  <span className="symbol-item-glyph">{c.symbol}</span>
                  <span className="symbol-item-name">{c.name}</span>
                  <span className="symbol-item-example currency-ticker">
                    {copiedCode === c.code ? 'Copied' : c.code}
                    <svg className="currency-copy-icon" width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      {copiedCode === c.code ? (
                        <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      ) : (
                        <>
                          <rect x="5" y="5" width="8.5" height="8.5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                          <path d="M10.5 3.5V3A1.5 1.5 0 0 0 9 1.5H3A1.5 1.5 0 0 0 1.5 3v6A1.5 1.5 0 0 0 3 10.5h.5" stroke="currentColor" strokeWidth="1.4" />
                        </>
                      )}
                    </svg>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </>
  );
};
