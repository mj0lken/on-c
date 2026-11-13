import React, { useEffect, useRef, useState } from 'react';
import { CalculatorTab } from '../types';

interface TabBarProps {
  tabs: CalculatorTab[];
  activeTabId: string;
  canCloseActiveTab: boolean;
  isTauri?: boolean;
  onSelectTab: (tabId: string) => void;
  onAddTab: () => void;
  onCloseTab: (tabId: string) => void;
  onRenameTab: (tabId: string, newTitle: string) => void;
  onOpenHelp: () => void;
  onFlipToSettings: () => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  canCloseActiveTab,
  isTauri = false,
  onSelectTab,
  onAddTab,
  onCloseTab,
  onRenameTab,
  onOpenHelp,
  onFlipToSettings,
}) => {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const renameInputRef = useRef<HTMLInputElement>(null);

  const handleWindowAction = async (action: 'close' | 'minimize' | 'zoom') => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      if (action === 'close') await win.close();
      else if (action === 'minimize') await win.minimize();
      else await win.toggleMaximize();
    } catch {
      // No-op in web browser
    }
  };

  useEffect(() => {
    const activeBtn = tabRefs.current.get(activeTabId);
    if (activeBtn) {
      try {
        activeBtn.scrollIntoView({
          block: 'nearest',
          inline: 'nearest',
          ...({ container: 'nearest' } as ScrollIntoViewOptions),
        });
      } catch {
        activeBtn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    }
  }, [activeTabId, tabs.length]);

  useEffect(() => {
    if (editingTabId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [editingTabId]);

  const commitRename = () => {
    if (editingTabId) {
      onRenameTab(editingTabId, draftTitle.trim());
      setEditingTabId(null);
    }
  };

  const handleTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight') {
      const next = tabs[(index + 1) % tabs.length];
      if (next) {
        e.preventDefault();
        onSelectTab(next.id);
        tabRefs.current.get(next.id)?.focus();
      }
    } else if (e.key === 'ArrowLeft') {
      const prev = tabs[(index - 1 + tabs.length) % tabs.length];
      if (prev) {
        e.preventDefault();
        onSelectTab(prev.id);
        tabRefs.current.get(prev.id)?.focus();
      }
    }
  };

  return (
    <header className="calc-header" data-tauri-drag-region>
      {/* Row 1: Numi-style borderless title bar with centered "on/c" wordmark */}
      <div className="titlebar-row" data-tauri-drag-region>
        <div className="titlebar-left" data-tauri-drag-region>
          {isTauri && (
            <div className="window-dots" aria-label="Window controls">
              <button
                type="button"
                className="win-dot win-dot-close"
                onClick={() => void handleWindowAction('close')}
                title="Close window"
                aria-label="Close window"
              />
              <button
                type="button"
                className="win-dot win-dot-min"
                onClick={() => void handleWindowAction('minimize')}
                title="Minimize window"
                aria-label="Minimize window"
              />
              <button
                type="button"
                className="win-dot win-dot-zoom"
                onClick={() => void handleWindowAction('zoom')}
                title="Zoom window"
                aria-label="Zoom window"
              />
            </div>
          )}
        </div>

        <span className="onc-wordmark" data-tauri-drag-region>
          on/c
        </span>

        <div className="titlebar-right">
          <button
            type="button"
            className="icon-btn"
            onClick={onAddTab}
            title="New sheet tab (⌘T)"
            aria-label="New sheet tab"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M8 3v10M3 8h10"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <button
            type="button"
            className="icon-btn help-cmd-btn"
            onClick={onOpenHelp}
            title="Syntax Reference (/help)"
            aria-label="/help — Syntax Reference"
          >
            /help
          </button>

          <button
            type="button"
            className="icon-btn"
            onClick={onFlipToSettings}
            title="Preferences (⌘,)"
            aria-label="Preferences"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.9" />
              <path
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Row 2: Borderless minimal tabs strip */}
      <div className="tabs-strip">
        <div
          className="tablist-scroller"
          role="tablist"
          aria-label="Calculator sheets"
          {...({ focusgroup: 'tablist nomemory' } as React.HTMLAttributes<HTMLDivElement>)}
        >
          {tabs.map((tab, idx) => {
            const isSelected = tab.id === activeTabId;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  if (el) tabRefs.current.set(tab.id, el);
                  else tabRefs.current.delete(tab.id);
                }}
                type="button"
                role="tab"
                id={`tab-${tab.id}`}
                className="tab-btn"
                aria-selected={isSelected}
                {...(isSelected
                  ? ({ focusgroupstart: '' } as React.ButtonHTMLAttributes<HTMLButtonElement>)
                  : {})}
                onClick={() => onSelectTab(tab.id)}
                onFocus={() => {
                  if (editingTabId === null && !isSelected) {
                    onSelectTab(tab.id);
                  }
                }}
                onDoubleClick={() => {
                  setEditingTabId(tab.id);
                  setDraftTitle(tab.title);
                }}
                onAuxClick={(e) => {
                  if (e.button === 1 && (tabs.length > 1 || canCloseActiveTab)) {
                    e.preventDefault();
                    onCloseTab(tab.id);
                  }
                }}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                title={`${tab.title} — Double-click to rename${tabs.length > 1 || canCloseActiveTab ? ', middle-click to archive & close' : ''}`}
              >
                <span className="tab-btn-label">{tab.title}</span>
              </button>
            );
          })}
        </div>

        {canCloseActiveTab && (
          <button
            type="button"
            className="tab-close-btn"
            onClick={() => onCloseTab(activeTabId)}
            title="Close & archive tab (⌘W)"
            aria-label="Close active tab"
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}

        {editingTabId && (
          <div className="tab-rename-overlay">
            <input
              ref={renameInputRef}
              type="text"
              className="tab-rename-input"
              value={draftTitle}
              placeholder={
                tabs.find((t) => t.id === editingTabId)?.shortCode ?? 'Auto title'
              }
              aria-label="Rename sheet tab"
              maxLength={32}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitRename();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setEditingTabId(null);
                }
              }}
            />
          </div>
        )}
      </div>
    </header>
  );
};
