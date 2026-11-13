import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { CalculatorTab, EvaluatedRow } from '../types';
import {
  buildExportFilename,
  formatSheetAsCsv,
  formatSheetAsMarkdown,
  formatSheetForClipboard,
  triggerSheetFileExport,
} from '../engine/exporter';

interface ExportMenuProps {
  tab: CalculatorTab;
  evaluatedRows: EvaluatedRow[];
  totalText: string | null;
  isTauri: boolean;
  onNotify: (message: string) => void;
}

export const ExportMenu: React.FC<ExportMenuProps> = ({
  tab,
  evaluatedRows,
  totalText,
  isTauri,
  onNotify,
}) => {
  const uid = useId().replace(/:/g, '');
  const triggerId = `export-trigger-${uid}`;
  const menuId = `export-menu-${uid}`;

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const pointerPressedRef = useRef(false);
  const enterOnOpenRef = useRef<'first' | 'last' | null>(null);

  const [isOpen, setIsOpen] = useState(false);

  const getEnabledItems = useCallback((): HTMLButtonElement[] => {
    const group = groupRef.current;
    if (!group) return [];
    return Array.from(group.querySelectorAll<HTMLButtonElement>('button')).filter(
      (btn) => !btn.disabled && btn.getAttribute('aria-disabled') !== 'true'
    );
  }, []);

  const closeAndRestore = useCallback((fromPointer: boolean) => {
    const pop = popoverRef.current;
    const trigger = triggerRef.current;
    if (trigger) {
      try {
        trigger.focus({ focusVisible: !fromPointer } as FocusOptions);
      } catch {
        trigger.focus();
      }
    }
    if (pop && pop.matches(':popover-open')) {
      try {
        pop.hidePopover();
      } catch {
        // Ignore if already closed
      }
    }
  }, []);

  // Per modern-web-guidance `menu`: install role="menu" / role="menuitem" + Arrow/Home/End fallback ONLY when native focusGroup is missing
  useEffect(() => {
    const group = groupRef.current;
    if (!group || 'focusGroup' in HTMLElement.prototype) return;

    group.setAttribute('role', 'menu');
    group.querySelectorAll('button:not([role])').forEach((item) => {
      item.setAttribute('role', 'menuitem');
    });

    const handleFallbackKeyDown = (event: KeyboardEvent) => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const items = getEnabledItems();
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      if (current < 0 || items.length === 0) return;

      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? items.length - 1
            : (current + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;

      event.preventDefault();
      event.stopImmediatePropagation();
      items[next]?.focus({ preventScroll: true });
    };

    group.addEventListener('keydown', handleFallbackKeyDown, true);
    return () => group.removeEventListener('keydown', handleFallbackKeyDown, true);
  }, [getEnabledItems]);

  // Sync `aria-expanded`, viewport fallback positioning when `position-area` is unsupported, and focus entry on `toggle`
  useEffect(() => {
    const pop = popoverRef.current;
    const trigger = triggerRef.current;
    if (!pop || !trigger) return;

    if (
      typeof ToggleEvent !== 'undefined' &&
      !('source' in ToggleEvent.prototype) &&
      typeof CSS !== 'undefined' &&
      CSS.supports('anchor-name', '--a')
    ) {
      const anchorName = `--export-anchor-${uid}`;
      trigger.style.setProperty('anchor-name', anchorName);
      pop.style.setProperty('position-anchor', anchorName);
    }

    const handleToggle = (ev: Event) => {
      const toggleEv = ev as ToggleEvent;
      const openNow = toggleEv.newState === 'open';
      setIsOpen(openNow);

      if (openNow) {
        if (!CSS.supports('position-area', 'block-start')) {
          const t = trigger.getBoundingClientRect();
          const m = pop.getBoundingClientRect();
          const fitsAbove = t.top - m.height - 6 >= 8;
          pop.style.top = `${
            fitsAbove ? t.top - m.height - 6 : Math.min(window.innerHeight - m.height - 8, t.bottom + 6)
          }px`;
          pop.style.left = `${Math.max(8, Math.min(t.right - m.width, window.innerWidth - m.width - 8))}px`;
        }

        const enterTarget = enterOnOpenRef.current;
        const wasPointer = pointerPressedRef.current;
        enterOnOpenRef.current = null;
        pointerPressedRef.current = false;

        if (enterTarget) {
          requestAnimationFrame(() => {
            const items = getEnabledItems();
            const target = enterTarget === 'last' ? items[items.length - 1] : items[0];
            target?.focus({ preventScroll: true });
          });
        } else if (wasPointer) {
          try {
            trigger.focus({ focusVisible: false } as FocusOptions);
          } catch {
            trigger.focus();
          }
        }
      } else {
        enterOnOpenRef.current = null;
        pointerPressedRef.current = false;
      }
    };

    pop.addEventListener('toggle', handleToggle);
    return () => pop.removeEventListener('toggle', handleToggle);
  }, [getEnabledItems, uid]);

  // Close menu when focus moves outside trigger + menu
  useEffect(() => {
    if (!isOpen) return;
    const handleFocusIn = (ev: FocusEvent) => {
      const target = ev.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      if (popoverRef.current?.matches(':popover-open')) {
        try {
          popoverRef.current.hidePopover();
        } catch {
          // Ignore
        }
      }
    };
    document.addEventListener('focusin', handleFocusIn);
    return () => document.removeEventListener('focusin', handleFocusIn);
  }, [isOpen]);

  const openMenuFromScript = (enter: 'first' | 'last' | null) => {
    const pop = popoverRef.current;
    const trigger = triggerRef.current;
    if (!pop || !trigger) return;
    enterOnOpenRef.current = enter;

    if ('commandForElement' in HTMLButtonElement.prototype) {
      trigger.click();
      return;
    }

    const showWithSource = pop as HTMLElement & {
      showPopover: (options?: { source?: HTMLElement }) => void;
    };
    try {
      showWithSource.showPopover({ source: trigger });
    } catch {
      pop.showPopover();
    }
  };

  const handleTriggerClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Keyboard click (`detail === 0`) enters the first item
    if (e.detail === 0 && !enterOnOpenRef.current) {
      enterOnOpenRef.current = 'first';
    }

    // Invoker fallback only when `commandForElement` is unsupported
    if (!('commandForElement' in HTMLButtonElement.prototype)) {
      e.preventDefault();
      const pop = popoverRef.current;
      const trigger = triggerRef.current;
      if (!pop || !trigger) return;
      if (pop.matches(':popover-open')) {
        closeAndRestore(pointerPressedRef.current);
      } else {
        if (!pointerPressedRef.current && !enterOnOpenRef.current) {
          enterOnOpenRef.current = 'first';
        }
        const showWithSource = pop as HTMLElement & {
          showPopover: (options?: { source?: HTMLElement }) => void;
        };
        try {
          showWithSource.showPopover({ source: trigger });
        } catch {
          pop.showPopover();
        }
      }
    }
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const pop = popoverRef.current;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const targetPos = e.key === 'ArrowUp' ? 'last' : 'first';
      if (pop?.matches(':popover-open')) {
        const items = getEnabledItems();
        const item = targetPos === 'last' ? items[items.length - 1] : items[0];
        item?.focus({ preventScroll: true });
      } else {
        pointerPressedRef.current = false;
        openMenuFromScript(targetPos);
      }
    } else if (e.key === 'Enter' || e.key === ' ') {
      pointerPressedRef.current = false;
      enterOnOpenRef.current = 'first';
    }
  };

  const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeAndRestore(false);
    } else if (e.key === 'Tab') {
      if (popoverRef.current?.matches(':popover-open')) {
        try {
          popoverRef.current.hidePopover();
        } catch {
          // Ignore
        }
      }
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      const items = getEnabledItems();
      const item = e.key === 'Home' ? items[0] : items[items.length - 1];
      item?.focus({ preventScroll: true });
    }
  };

  const handleItemPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    if (hit && e.currentTarget.contains(hit)) {
      try {
        e.currentTarget.focus({ focusVisible: false } as FocusOptions);
      } catch {
        e.currentTarget.focus();
      }
    }
  };

  const handleAction = async (kind: 'md' | 'csv' | 'copy', e: React.MouseEvent<HTMLButtonElement>) => {
    const fromPointer = e.detail !== 0;
    closeAndRestore(fromPointer);

    try {
      if (kind === 'md') {
        const filename = buildExportFilename(tab.title, 'md');
        const content = formatSheetAsMarkdown(tab, evaluatedRows, totalText);
        const msg = await triggerSheetFileExport(
          filename,
          content,
          'text/markdown;charset=utf-8',
          isTauri
        );
        onNotify(msg);
      } else if (kind === 'csv') {
        const filename = buildExportFilename(tab.title, 'csv');
        const content = formatSheetAsCsv(tab, evaluatedRows, totalText);
        const msg = await triggerSheetFileExport(
          filename,
          content,
          'text/csv;charset=utf-8',
          isTauri
        );
        onNotify(msg);
      } else {
        const content = formatSheetForClipboard(tab, evaluatedRows, totalText);
        if (!content.trim()) {
          onNotify('Sheet is empty');
          return;
        }
        await navigator.clipboard.writeText(content);
        onNotify('Copied aligned sheet');
      }
    } catch {
      onNotify(kind === 'copy' ? 'Clipboard copy failed' : 'Export failed');
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        className="sym-btn export-trigger-btn"
        aria-label="Export sheet"
        title="Export sheet (.md, .csv, copy)"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onPointerDown={(e) => {
          pointerPressedRef.current = true;
          e.preventDefault();
        }}
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        {...({
          commandfor: menuId,
          command: 'toggle-popover',
        } as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M8 2.2v7.3M5.2 5L8 2.2 10.8 5"
            stroke="currentColor"
            strokeWidth="1.45"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M3 9.8v2.4a1.3 1.3 0 0 0 1.3 1.3h7.4a1.3 1.3 0 0 0 1.3-1.3V9.8"
            stroke="currentColor"
            strokeWidth="1.45"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <div
        ref={popoverRef}
        id={menuId}
        className="export-menu-popover"
        onKeyDown={handleMenuKeyDown}
        {...({ popover: 'auto' } as React.HTMLAttributes<HTMLDivElement>)}
      >
        <div
          ref={groupRef}
          aria-labelledby={triggerId}
          className="export-menu-group"
          {...({ focusgroup: 'menu nomemory' } as React.HTMLAttributes<HTMLDivElement>)}
        >
          <button
            type="button"
            onPointerMove={handleItemPointerMove}
            onClick={(e) => void handleAction('md', e)}
          >
            <span>Download .md</span>
            <span className="hint" aria-hidden="true">
              Markdown
            </span>
          </button>

          <button
            type="button"
            onPointerMove={handleItemPointerMove}
            onClick={(e) => void handleAction('csv', e)}
          >
            <span>Download .csv</span>
            <span className="hint" aria-hidden="true">
              CSV
            </span>
          </button>

          <hr className="export-menu-sep" />

          <button
            type="button"
            onPointerMove={handleItemPointerMove}
            onClick={(e) => void handleAction('copy', e)}
          >
            <span>Copy to clipboard</span>
            <span className="hint" aria-hidden="true">
              Aligned
            </span>
          </button>
        </div>
      </div>
    </>
  );
};
