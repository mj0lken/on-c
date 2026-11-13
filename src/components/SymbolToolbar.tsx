import React, {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { MATH_SYMBOLS, MAX_INLINE_SYMBOLS, MathSymbolItem } from '../data/mathSymbols';
import { useToolbarFocusFallback } from '../hooks/useToolbarFocusFallback';

export interface SymbolToolbarHandle {
  openPicker: (options?: { focusSearch?: boolean }) => void;
  closePicker: () => void;
  setSearchQuery: (nextQuery: string) => void;
}

interface SymbolToolbarProps {
  onInsertSymbol: (symbol: string) => void;
  onRestoreSheetFocus?: () => void;
}

export const SymbolToolbar = forwardRef<SymbolToolbarHandle, SymbolToolbarProps>(
  ({ onInsertSymbol, onRestoreSheetFocus }, ref) => {
    const uid = useId().replace(/:/g, '');
    const popoverId = `more-symbols-${uid}`;
    const toolbarRef = useRef<HTMLDivElement>(null);
    const moreBtnRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const pickedSymbolRef = useRef(false);
    const openedProgrammaticallyRef = useRef(false);
    const suppressAutoFocusRef = useRef(false);

    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');

    const inlineSymbols = MATH_SYMBOLS.slice(0, MAX_INLINE_SYMBOLS);
    const hasMore = MATH_SYMBOLS.length > MAX_INLINE_SYMBOLS;

    const filteredSymbols = useMemo(() => {
      const q = query.trim().toLowerCase();
      if (!q) return MATH_SYMBOLS;
      return MATH_SYMBOLS.filter((item) => {
        const hay = [item.glyph, item.name, item.example, ...item.keywords]
          .join(' ')
          .toLowerCase();
        return q.split(/\s+/).every((term) => hay.includes(term));
      });
    }, [query]);

    useImperativeHandle(
      ref,
      () => ({
        openPicker: (options) => {
          const pop = popoverRef.current;
          if (!pop) return;
          const shouldFocus = options?.focusSearch !== false;
          openedProgrammaticallyRef.current = shouldFocus;
          suppressAutoFocusRef.current = !shouldFocus;
          try {
            if (!pop.matches(':popover-open')) {
              const showWithSource = pop as HTMLElement & {
                showPopover: (opts?: { source?: HTMLElement }) => void;
              };
              if (moreBtnRef.current) {
                try {
                  showWithSource.showPopover({ source: moreBtnRef.current });
                } catch {
                  pop.showPopover();
                }
              } else {
                pop.showPopover();
              }
            } else if (shouldFocus) {
              requestAnimationFrame(() => {
                searchInputRef.current?.focus({ preventScroll: true });
              });
            }
          } catch {
            // Ignore if already open
          }
        },
        closePicker: () => {
          const pop = popoverRef.current;
          if (!pop) return;
          openedProgrammaticallyRef.current = false;
          suppressAutoFocusRef.current = false;
          try {
            if (pop.matches(':popover-open')) {
              pop.hidePopover();
            }
          } catch {
            // Ignore if already closed
          }
        },
        setSearchQuery: (nextQuery: string) => {
          setQuery(nextQuery);
        },
      }),
      []
    );

    useToolbarFocusFallback(toolbarRef, 'button.sym-btn');

    // Sync `aria-expanded`, anchor fallback, position fallback, and search focus
    useEffect(() => {
      const pop = popoverRef.current;
      const moreBtn = moreBtnRef.current;
      if (!pop || !moreBtn) return;

      if (
        typeof ToggleEvent !== 'undefined' &&
        !('source' in ToggleEvent.prototype) &&
        typeof CSS !== 'undefined' &&
        CSS.supports('anchor-name', '--a')
      ) {
        const anchorName = `--sym-anchor-${uid}`;
        moreBtn.style.setProperty('anchor-name', anchorName);
        pop.style.setProperty('position-anchor', anchorName);
      }

      const handleToggle = (ev: Event) => {
        const toggleEv = ev as ToggleEvent;
        const openNow = toggleEv.newState === 'open';
        setIsOpen(openNow);

        if (openNow) {
          pickedSymbolRef.current = false;
          setQuery('');
          if (!CSS.supports('position-area', 'block-start')) {
            const t = moreBtn.getBoundingClientRect();
            const m = pop.getBoundingClientRect();
            const fitsAbove = t.top - m.height - 6 >= 8;
            pop.style.top = `${
              fitsAbove
                ? t.top - m.height - 6
                : Math.min(window.innerHeight - m.height - 8, t.bottom + 6)
            }px`;
            pop.style.left = `${Math.max(10, Math.min(t.left, window.innerWidth - m.width - 10))}px`;
          }
          const skipFocus = suppressAutoFocusRef.current;
          suppressAutoFocusRef.current = false;
          if (!skipFocus) {
            requestAnimationFrame(() => {
              searchInputRef.current?.focus({ preventScroll: true });
            });
          }
        } else {
          suppressAutoFocusRef.current = false;
          const shouldRestore = !pickedSymbolRef.current && openedProgrammaticallyRef.current;
          openedProgrammaticallyRef.current = false;
          if (shouldRestore) {
            requestAnimationFrame(() => {
              onRestoreSheetFocus?.();
            });
          }
        }
      };

      pop.addEventListener('toggle', handleToggle);
      return () => pop.removeEventListener('toggle', handleToggle);
    }, [onRestoreSheetFocus, uid]);

    const handlePickSymbol = (item: MathSymbolItem) => {
      pickedSymbolRef.current = true;
      if (popoverRef.current?.matches(':popover-open')) {
        try {
          popoverRef.current.hidePopover();
        } catch {
          // Ignore if already hidden
        }
      }
      onInsertSymbol(item.insert);
    };

    return (
      <>
        <div
          ref={toolbarRef}
          className="symbol-toolbar"
          role="toolbar"
          aria-label="Quick math symbols"
          {...({ focusgroup: 'toolbar wrap' } as React.HTMLAttributes<HTMLDivElement>)}
        >
          {hasMore && (
            <>
              <button
                ref={moreBtnRef}
                type="button"
                className="sym-btn sym-more-btn"
                data-tour-target="char-btn"
                title="Search symbols & operators (/char)"
                aria-label="/char — Search math symbols"
                aria-expanded={isOpen}
                popoverTarget={popoverId}
              >
                /char
              </button>
              <span
                className="sym-toolbar-sep"
                role="separator"
                aria-orientation="vertical"
              />
            </>
          )}

          <div className="symbol-inline-group" role="group" aria-label="Popular math characters">
            {inlineSymbols.map((item) => (
              <button
                key={item.id}
                type="button"
                className="sym-btn"
                title={`${item.name} (${item.example})`}
                aria-label={`${item.glyph} — Insert ${item.name}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                onClick={() => onInsertSymbol(item.insert)}
              >
                {item.glyph}
              </button>
            ))}
          </div>
        </div>

        {hasMore && (
          <div
            ref={popoverRef}
            id={popoverId}
            className="symbol-more-popover"
            aria-label="Search mathematical symbols and operators"
            {...({ popover: 'auto' } as React.HTMLAttributes<HTMLDivElement>)}
          >
            <search className="symbol-search-wrap">
              <svg
                className="symbol-search-icon"
                width="12"
                height="12"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.8" />
                <path
                  d="M13.5 13.5L17 17"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                spellCheck={false}
                autoComplete="off"
                className="symbol-search-input"
                data-tour-target="char-search"
                placeholder="Search symbols (deg, root, pi, eur)…"
                aria-label="Search symbols and operators"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filteredSymbols.length > 0) {
                    e.preventDefault();
                    handlePickSymbol(filteredSymbols[0]);
                  } else if (e.key === 'ArrowDown' && filteredSymbols.length > 0) {
                    e.preventDefault();
                    itemRefs.current[0]?.focus({ preventScroll: true });
                  }
                }}
              />
              {query.length > 0 && (
                <button
                  type="button"
                  className="search-clear-btn"
                  aria-label="Clear symbol search"
                  onClick={() => {
                    setQuery('');
                    searchInputRef.current?.focus({ preventScroll: true });
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path
                      d="M4 4l8 8M12 4l-8 8"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              )}
            </search>

            <div className="symbol-list">
              {filteredSymbols.length === 0 ? (
                <div className="symbol-empty">No matching symbol</div>
              ) : (
                filteredSymbols.map((item, index) => (
                  <button
                    key={item.id}
                    ref={(el) => {
                      itemRefs.current[index] = el;
                    }}
                    type="button"
                    className="symbol-list-item"
                    data-tour-target={`char-item-${item.id}`}
                    onClick={() => handlePickSymbol(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        const next =
                          itemRefs.current[Math.min(index + 1, filteredSymbols.length - 1)];
                        next?.focus({ preventScroll: true });
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        if (index === 0) searchInputRef.current?.focus({ preventScroll: true });
                        else itemRefs.current[index - 1]?.focus({ preventScroll: true });
                      }
                    }}
                  >
                    <span className="symbol-item-glyph">{item.glyph}</span>
                    <span className="symbol-item-name">{item.name}</span>
                    <span className="symbol-item-example">{item.example}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </>
    );
  }
);
SymbolToolbar.displayName = 'SymbolToolbar';
