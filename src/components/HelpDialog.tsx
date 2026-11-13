import React, {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { HELP_CATEGORIES, HELP_ITEMS } from '../data/helpCatalog';
import { useToolbarFocusFallback } from '../hooks/useToolbarFocusFallback';
import { HelpCategoryId, HelpItem } from '../types';

export interface HelpDialogHandle {
  setDemoFilter: (query: string, categories?: HelpCategoryId[]) => void;
}

interface HelpDialogProps {
  isOpen: boolean;
  nonModalDemo?: boolean;
  onClose: () => void;
  onInsertExample: (example: string) => void;
}

export const HelpDialog = forwardRef<HelpDialogHandle, HelpDialogProps>(
  ({ isOpen, nonModalDemo = false, onClose, onInsertExample }, ref) => {
    const instancePrefix = useId().replace(/:/g, '');
    const dialogRef = useRef<HTMLDialogElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const topicsBarRef = useRef<HTMLDivElement>(null);
    const openedAsModalRef = useRef(false);

    const [query, setQuery] = useState('');
    const [selectedCategories, setSelectedCategories] = useState<Set<HelpCategoryId>>(
      () => new Set()
    );

    useImperativeHandle(
      ref,
      () => ({
        setDemoFilter: (nextQuery: string, categories?: HelpCategoryId[]) => {
          setQuery(nextQuery);
          if (categories !== undefined) {
            setSelectedCategories(new Set(categories));
          }
        },
      }),
      []
    );

    // Sync open state with native <dialog> (`show()` during automated inline tour, `showModal()` for manual user open)
    useEffect(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;

      if (isOpen) {
        if (!dialog.open) {
          if (nonModalDemo) {
            openedAsModalRef.current = false;
            dialog.show();
          } else {
            openedAsModalRef.current = true;
            dialog.showModal();
            requestAnimationFrame(() => {
              searchInputRef.current?.focus({ preventScroll: true });
            });
          }
        }
      } else if (dialog.open) {
        openedAsModalRef.current = false;
        dialog.close();
      }
    }, [isOpen, nonModalDemo]);

    // Modern-web-guidance `light-dismiss-a-dialog` & `dialog` fallback + close listener
    useEffect(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;

      const handleNativeClose = () => {
        dialog.returnValue = '';
        openedAsModalRef.current = false;
        onClose();
      };
      dialog.addEventListener('close', handleNativeClose);

      let removeClickFallback: (() => void) | undefined;
      if (!('closedBy' in HTMLDialogElement.prototype)) {
        const handleBackdropClick = (event: MouseEvent) => {
          if (event.target !== dialog) return;
          const rect = dialog.getBoundingClientRect();
          const isDialogContent =
            rect.top <= event.clientY &&
            event.clientY <= rect.top + rect.height &&
            rect.left <= event.clientX &&
            event.clientX <= rect.left + rect.width;
          if (isDialogContent) return;
          dialog.close();
        };
        dialog.addEventListener('click', handleBackdropClick);
        removeClickFallback = () => dialog.removeEventListener('click', handleBackdropClick);
      }

      return () => {
        dialog.removeEventListener('close', handleNativeClose);
        removeClickFallback?.();
      };
    }, [onClose]);

    // Allow Escape dismissal when open in non-modal inline demo mode
    useEffect(() => {
      if (!isOpen) return;
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && dialogRef.current?.open && !openedAsModalRef.current) {
          e.preventDefault();
          dialogRef.current.close();
        }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [isOpen]);

    useToolbarFocusFallback(topicsBarRef, 'button.topic-chip');

    // Per modern-web-guidance `scrollability-affordance-hints`: IntersectionObserver fallback when scroll-driven animations are unsupported
    useEffect(() => {
      const scroller = topicsBarRef.current;
      if (!scroller || !isOpen) return;
      if (typeof CSS !== 'undefined' && CSS.supports('animation-timeline', 'scroll()')) return;

      const first = scroller.firstElementChild;
      const last = scroller.lastElementChild;
      if (!first || !last) return;

      const observer = new IntersectionObserver(
        (entries) => {
          for (const { target, intersectionRatio } of entries) {
            scroller.classList.toggle(
              target === first ? 'more-start' : 'more-end',
              intersectionRatio < 1
            );
          }
        },
        { root: scroller, threshold: 1, rootMargin: '1px' }
      );

      observer.observe(first);
      observer.observe(last);
      return () => observer.disconnect();
    }, [isOpen]);

    const toggleCategory = (catId: HelpCategoryId, btn: HTMLButtonElement) => {
      setSelectedCategories((prev) => {
        const next = new Set(prev);
        if (next.has(catId)) next.delete(catId);
        else next.add(catId);
        return next;
      });
      btn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    };

    const clearCategories = (btn?: HTMLButtonElement) => {
      setSelectedCategories(new Set());
      btn?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    };

    const filteredItems = useMemo(() => {
      const q = query.trim().toLowerCase();
      return HELP_ITEMS.filter((item) => {
        if (selectedCategories.size > 0 && !selectedCategories.has(item.category)) {
          return false;
        }
        if (!q) return true;
        const haystack = [
          item.title,
          item.syntax,
          item.exampleInput,
          item.exampleOutput,
          item.description,
          ...item.keywords,
        ]
          .join(' ')
          .toLowerCase();
        return q.split(/\s+/).every((term) => haystack.includes(term));
      });
    }, [query, selectedCategories]);

    // Re-wire interestfor ARIA attributes whenever filtered rows change
    useEffect(() => {
      if (isOpen && typeof window !== 'undefined') {
        const wireFn = (window as unknown as { __wireInterestHints?: () => void })
          .__wireInterestHints;
        wireFn?.();
      }
    }, [isOpen, filteredItems]);

    const handleUseItem = (item: HelpItem) => {
      if (item.exampleInput === '/help') {
        dialogRef.current?.close();
        return;
      }
      onInsertExample(item.exampleInput);
      dialogRef.current?.close();
    };

    // Update fallback coordinates for engines without CSS `position-area` anchor positioning
    const updateFallbackCoords = (btn: HTMLButtonElement, tipId: string) => {
      const popoverEl = document.getElementById(tipId);
      if (!popoverEl) return;
      const r = btn.getBoundingClientRect();
      const spaceBelow = window.innerHeight - r.bottom;
      const topPos = spaceBelow < 130 ? Math.max(8, r.top - 96) : r.bottom + 6;
      const rightPos = Math.max(10, window.innerWidth - r.right);
      popoverEl.style.setProperty('--tip-top', `${topPos}px`);
      popoverEl.style.setProperty('--tip-right', `${rightPos}px`);
    };

    return (
      <dialog
        ref={dialogRef}
        id="help-dialog"
        className={`help-dialog ${nonModalDemo ? 'is-inline-demo' : ''}`}
        aria-label="Syntax Reference"
        {...({ closedby: 'any' } as React.DialogHTMLAttributes<HTMLDialogElement>)}
      >
        <div className="help-dialog-inner">
          {/* Row 1: Calm borderless search bar + close */}
          <div className="help-compact-bar">
            <search className="help-search-box">
              <svg
                className="help-search-icon"
                width="13"
                height="13"
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
                className="help-search-input"
                data-tour-target="help-search"
                placeholder="Search syntax (ans, sek, %, sin, ---)…"
                aria-label="Search syntax and operations"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query.length > 0 && (
                <button
                  type="button"
                  className="search-clear-btn"
                  aria-label="Clear syntax search"
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

            <form method="dialog" className="help-close-form">
              <button
                type="submit"
                className="icon-btn help-close-btn"
                data-tour-target="help-close"
                aria-label="Close help"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M4 4l8 8M12 4l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </form>
          </div>

          {/* Row 2: Sleek compact multi-select topic strip directly beneath search */}
          <div
            ref={topicsBarRef}
            className="help-topics-bar"
            role="toolbar"
            aria-label="Filter syntax topics"
            {...({ focusgroup: 'toolbar wrap' } as React.HTMLAttributes<HTMLDivElement>)}
          >
            <button
              type="button"
              className="topic-chip"
              aria-pressed={selectedCategories.size === 0}
              onClick={(e) => clearCategories(e.currentTarget)}
              onFocus={(e) =>
                e.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' })
              }
            >
              All
            </button>
            {HELP_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className="topic-chip"
                data-tour-target={`help-topic-${cat.id}`}
                aria-pressed={selectedCategories.has(cat.id)}
                title={cat.shortDesc}
                onClick={(e) => toggleCategory(cat.id, e.currentTarget)}
                onFocus={(e) =>
                  e.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' })
                }
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Compact Syntax-Only List + (i) Hover Toggletips */}
          <div className="help-results">
            {filteredItems.length === 0 ? (
              <div className="help-empty">
                <span>No matching syntax.</span>
                <button
                  type="button"
                  className="multiselect-clear-link"
                  onClick={() => {
                    setQuery('');
                    clearCategories();
                  }}
                >
                  Reset
                </button>
              </div>
            ) : (
              filteredItems.map((item) => {
                const tipId = `hint-${instancePrefix}-${item.id}`;
                return (
                  <div key={item.id} className="help-compact-row">
                    <span className="help-row-title">{item.title}</span>

                    <div className="help-row-right">
                      <button
                        type="button"
                        className="help-syntax-pill"
                        onClick={() => handleUseItem(item)}
                        title="Click to insert example into sheet"
                      >
                        {item.syntax}
                      </button>

                      <button
                        type="button"
                        className="help-info-btn"
                        aria-label={`Explanation and example for ${item.title}`}
                        popoverTarget={tipId}
                        popoverTargetAction="show"
                        {...({
                          interestfor: tipId,
                        } as React.ButtonHTMLAttributes<HTMLButtonElement>)}
                        onPointerEnter={(e) => updateFallbackCoords(e.currentTarget, tipId)}
                        onFocus={(e) => updateFallbackCoords(e.currentTarget, tipId)}
                      >
                        i
                      </button>

                      <div
                        id={tipId}
                        role="tooltip"
                        className="help-info-popover"
                        {...({ popover: 'hint' } as React.HTMLAttributes<HTMLDivElement>)}
                      >
                        <p className="hint-desc">{item.description}</p>
                        <div className="hint-example">
                          <span className="hint-expr">{item.exampleInput}</span>
                          <span className="hint-arrow" aria-hidden="true">
                            →
                          </span>
                          <span className="hint-res">{item.exampleOutput}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </dialog>
    );
  }
);
HelpDialog.displayName = 'HelpDialog';
