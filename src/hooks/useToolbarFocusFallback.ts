import { RefObject, useEffect } from 'react';

/**
 * Installs a spec-aligned roving-tabindex keyboard fallback for `role="toolbar"` containers
 * ONLY when native `focusgroup` (`'focusGroup' in HTMLElement.prototype`) is unavailable.
 */
export function useToolbarFocusFallback(
  containerRef: RefObject<HTMLElement | null>,
  itemSelector: string
): void {
  useEffect(() => {
    const bar = containerRef.current;
    if (!bar || (typeof HTMLElement !== 'undefined' && 'focusGroup' in HTMLElement.prototype)) {
      return;
    }

    const getItems = () =>
      Array.from(bar.querySelectorAll<HTMLButtonElement>(itemSelector)).filter(
        (btn) => !btn.disabled
      );

    const initItems = getItems();
    initItems.forEach((btn, idx) => {
      btn.tabIndex = idx === 0 ? 0 : -1;
    });

    const handleFocusIn = (ev: FocusEvent) => {
      const items = getItems();
      if (ev.target instanceof HTMLButtonElement && items.includes(ev.target)) {
        items.forEach((btn) => {
          btn.tabIndex = btn === ev.target ? 0 : -1;
        });
      }
    };

    const handleKeyDown = (ev: KeyboardEvent) => {
      const items = getItems();
      const idx = items.indexOf(document.activeElement as HTMLButtonElement);
      if (idx < 0 || items.length === 0) return;

      const vertical = bar.getAttribute('aria-orientation') === 'vertical';
      const rtl = getComputedStyle(bar).direction === 'rtl';

      let nextIdx: number | null = null;
      if (ev.key === 'Home') {
        nextIdx = 0;
      } else if (ev.key === 'End') {
        nextIdx = items.length - 1;
      } else if (vertical) {
        if (ev.key === 'ArrowDown') nextIdx = (idx + 1) % items.length;
        else if (ev.key === 'ArrowUp') nextIdx = (idx - 1 + items.length) % items.length;
      } else {
        if (ev.key === 'ArrowRight') {
          nextIdx = (idx + (rtl ? -1 : 1) + items.length) % items.length;
        } else if (ev.key === 'ArrowLeft') {
          nextIdx = (idx + (rtl ? 1 : -1) + items.length) % items.length;
        }
      }

      if (nextIdx !== null) {
        ev.preventDefault();
        items.forEach((btn, i) => {
          btn.tabIndex = i === nextIdx ? 0 : -1;
        });
        items[nextIdx]?.focus();
      }
    };

    bar.addEventListener('focusin', handleFocusIn);
    bar.addEventListener('keydown', handleKeyDown);
    return () => {
      bar.removeEventListener('focusin', handleFocusIn);
      bar.removeEventListener('keydown', handleKeyDown);
    };
  }, [containerRef, itemSelector]);
}
