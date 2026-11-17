import React, { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { UNIT_CATEGORIES, UNIT_LIST_PUBLIC, unitDisplayName } from '../engine/units';
import { CURRENCIES } from '../engine/currencies';
import { useToolbarFocusFallback } from '../hooks/useToolbarFocusFallback';

type CategoryId = (typeof UNIT_CATEGORIES)[number]['id'] | 'bases' | 'currency';

interface UnitEntry {
  key: string;
  symbol: string;
  name: string;
  aliases: string;
  category: CategoryId;
}

const CATEGORIES: Array<{ id: CategoryId; label: string; example: string }> = [
  ...UNIT_CATEGORIES,
  { id: 'bases', label: 'Number bases', example: '255 in hex' },
  { id: 'currency', label: 'Currencies', example: '200 SEK in USD' },
];

const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label])) as Record<CategoryId, string>;


const BASE_ENTRIES: UnitEntry[] = [
  { key: 'hex', symbol: 'hex', name: 'Hexadecimal', aliases: '0xFF · in hex', category: 'bases' },
  { key: 'bin', symbol: 'bin', name: 'Binary', aliases: '0b1010 · in binary', category: 'bases' },
  { key: 'oct', symbol: 'oct', name: 'Octal', aliases: '0o17 · in octal', category: 'bases' },
];

const buildEntries = (): UnitEntry[] => [
  ...UNIT_CATEGORIES.flatMap((cat) =>
    UNIT_LIST_PUBLIC.filter((u) => u.category === cat.id).map((u) => ({
      key: `${cat.id}-${u.id}`,
      symbol: u.symbol,
      name: unitDisplayName(u),
      aliases: [...new Set(u.aliases.filter((a) => a !== u.symbol && a.length <= 12))].slice(0, 4).join(', '),
      category: cat.id as CategoryId,
    }))
  ),
  ...BASE_ENTRIES,
  ...Object.values(CURRENCIES).map((c) => ({
    key: `currency-${c.code}`,
    symbol: c.code,
    name: c.name,
    aliases: c.symbol !== c.code ? c.symbol : '',
    category: 'currency' as CategoryId,
  })),
];

/** `/units` reference: searchable, category-filtered list of every convertible unit; click copies the symbol. */
export interface UnitsMenuHandle {
  open: () => void;
}

export const UnitsMenu = forwardRef<UnitsMenuHandle>((_props, ref) => {
  const uid = useId().replace(/:/g, '');
  const popoverId = `units-menu-${uid}`;
  const btnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const copiedTimerRef = useRef<number | undefined>(undefined);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<CategoryId | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [openCount, setOpenCount] = useState(0);

  useToolbarFocusFallback(chipsRef, 'button.topic-chip');

  useImperativeHandle(ref, () => ({
    open: () => {
      const pop = popoverRef.current;
      if (!pop || pop.matches(':popover-open')) return;
      try {
        (pop as HTMLElement & { showPopover: (o?: { source?: HTMLElement }) => void }).showPopover(
          btnRef.current ? { source: btnRef.current } : undefined
        );
      } catch {
        pop.showPopover();
      }
    },
  }));

  // Currencies are registered at runtime by the FX feed, so rebuild when opened.
  const entries = useMemo(buildEntries, [openCount]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (active && e.category !== active) return false;
      if (!q) return true;
      const hay = `${e.symbol} ${e.name} ${e.aliases} ${CATEGORY_LABEL[e.category]}`.toLowerCase();
      return q.split(/\s+/).every((t) => hay.includes(t));
    });
  }, [entries, query, active]);

  useEffect(() => () => window.clearTimeout(copiedTimerRef.current), []);

  useEffect(() => {
    const pop = popoverRef.current;
    const btn = btnRef.current;
    if (!pop || !btn) return;
    const onToggle = (ev: Event) => {
      if ((ev as ToggleEvent).newState !== 'open') return;
      setQuery('');
      setOpenCount((n) => n + 1);
      requestAnimationFrame(() => searchInputRef.current?.focus({ preventScroll: true }));
    };
    pop.addEventListener('toggle', onToggle);
    return () => pop.removeEventListener('toggle', onToggle);
  }, []);

  const copy = async (entry: UnitEntry) => {
    try {
      await navigator.clipboard.writeText(entry.symbol);
    } catch {
      return;
    }
    setCopiedKey(entry.key);
    window.clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = window.setTimeout(() => setCopiedKey(null), 1200);
  };

  const activeMeta = CATEGORIES.find((c) => c.id === active);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="sym-btn sym-more-btn"
        title="Units you can convert between (/units)"
        aria-label="/units — Browse convertible units"
        popoverTarget={popoverId}
      >
        /units
      </button>
      <div
        ref={popoverRef}
        id={popoverId}
        className="symbol-more-popover units-menu-popover"
        aria-label="Convertible units"
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
            placeholder="Search units (km, cup, GB, °F)…"
            aria-label="Search units"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </search>

        <div
          ref={chipsRef}
          className="help-topics-bar units-topics-bar"
          role="toolbar"
          aria-label="Unit categories"
          {...({ focusgroup: 'toolbar wrap' } as React.HTMLAttributes<HTMLDivElement>)}
        >
          <button type="button" className="topic-chip" aria-pressed={active === null} onClick={() => setActive(null)}>
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`topic-chip units-chip tok-unit-${c.id}`}
              aria-pressed={active === c.id}
              title={`e.g. ${c.example}`}
              onClick={() => setActive(active === c.id ? null : c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>

        {activeMeta && (
          <div className="units-hint">
            Converts within {activeMeta.label.toLowerCase()} · e.g. <code>{activeMeta.example}</code>
          </div>
        )}

        <ul className="symbol-list units-list" aria-label="Units">
          {filtered.length === 0 ? (
            <li className="symbol-empty">No matching unit</li>
          ) : (
            filtered.map((e, i) => {
              const groupStart = !active && !query && (i === 0 || filtered[i - 1].category !== e.category);
              return (
                <React.Fragment key={e.key}>
                  {groupStart && (
                    <li className={`units-group-label tok-unit-${e.category}`} aria-hidden="true">
                      {CATEGORY_LABEL[e.category]}
                    </li>
                  )}
                  <li>
                    <button
                      type="button"
                      className="symbol-list-item currency-copy-row"
                      title={`Copy ${e.symbol}`}
                      onClick={() => void copy(e)}
                    >
                      <span className={`symbol-item-glyph units-glyph tok-unit-${e.category}`}>{e.symbol}</span>
                      <span className="symbol-item-name">
                        {e.name}
                        {e.aliases && <span className="units-aliases"> · {e.aliases}</span>}
                      </span>
                      <span className="symbol-item-example currency-ticker">
                        {copiedKey === e.key ? 'Copied' : CATEGORY_LABEL[e.category]}
                        <svg className="currency-copy-icon" width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          {copiedKey === e.key ? (
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
                </React.Fragment>
              );
            })
          )}
        </ul>
      </div>
    </>
  );
});
UnitsMenu.displayName = 'UnitsMenu';
