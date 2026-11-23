import React, { useEffect, useId, useRef, useState } from 'react';
import { CalculatorTab } from '../types';

interface TabBarProps {
  tabs: CalculatorTab[];
  activeTabId: string;
  canCloseActiveTab: boolean;
  isTabWorthArchiving?: (tab: CalculatorTab) => boolean;
  isTauri?: boolean;
  updateAvailableVersion?: string | null;
  isInstallingUpdate?: boolean;
  onInstallUpdate?: () => void;
  onSelectTab: (tabId: string) => void;
  onAddTab: () => void;
  onCloseTab: (tabId: string) => void;
  onRenameTab: (tabId: string, newTitle: string) => void;
  onFlipToSettings: () => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  canCloseActiveTab,
  isTabWorthArchiving,
  isTauri = false,
  updateAvailableVersion = null,
  isInstallingUpdate = false,
  onInstallUpdate,
  onSelectTab,
  onAddTab,
  onCloseTab,
  onRenameTab,
  onFlipToSettings,
}) => {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const renameInputRef = useRef<HTMLInputElement>(null);
  const updateTipId = `update-tip-${useId().replace(/:/g, '')}`;

  useEffect(() => {
    if (updateAvailableVersion && !isInstallingUpdate && typeof window !== 'undefined') {
      const wireFn = (window as unknown as { __wireInterestHints?: () => void })
        .__wireInterestHints;
      wireFn?.();
    }
  }, [updateAvailableVersion, isInstallingUpdate]);

  const updateTipCoords = (btn: HTMLButtonElement) => {
    const popoverEl = document.getElementById(updateTipId);
    if (!popoverEl) return;
    const r = btn.getBoundingClientRect();
    const topPos = r.bottom + 6;
    const rightPos = Math.max(10, window.innerWidth - r.right - 12);
    popoverEl.style.setProperty('--tip-top', `${topPos}px`);
    popoverEl.style.setProperty('--tip-right', `${rightPos}px`);
  };

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
          {updateAvailableVersion &&
            onInstallUpdate &&
            (isInstallingUpdate ? (
              <span
                className="update-spinner-slot"
                title={`Installing on/c v${updateAvailableVersion}…`}
              >
                <progress
                  aria-label={`Installing update version ${updateAvailableVersion}`}
                  className="loading-spinner update-spinner"
                />
              </span>
            ) : (
              <>
                <button
                  type="button"
                  className="icon-btn update-alert-btn"
                  onClick={onInstallUpdate}
                  aria-label="Update to latest version"
                  {...({
                    interestfor: updateTipId,
                  } as React.ButtonHTMLAttributes<HTMLButtonElement>)}
                  onPointerEnter={(e) => updateTipCoords(e.currentTarget)}
                  onFocus={(e) => updateTipCoords(e.currentTarget)}
                >
                  <svg
                    className="update-alert-glow"
                    width="15"
                    height="15"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M8 2.9v6.1"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                    />
                    <circle cx="8" cy="12.45" r="1.5" fill="currentColor" />
                  </svg>
                  <svg
                    className="update-alert-icon"
                    width="15"
                    height="15"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M8 2.9v6.1"
                      stroke="currentColor"
                      strokeWidth="2.15"
                      strokeLinecap="round"
                    />
                    <circle cx="8" cy="12.45" r="1.25" fill="currentColor" />
                  </svg>
                </button>
                <div
                  id={updateTipId}
                  className="update-hint-popover"
                  {...({ popover: 'hint' } as React.HTMLAttributes<HTMLDivElement>)}
                >
                  Update to latest version
                </div>
              </>
            ))}

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
            className="icon-btn"
            data-tour-target="settings-btn"
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
            const canCloseThisTab =
              tabs.length > 1 ||
              (isSelected ? canCloseActiveTab : Boolean(isTabWorthArchiving?.(tab)));
            return (
              <div
                key={tab.id}
                className={`tab-pill ${isSelected ? 'is-selected' : ''} ${canCloseThisTab ? 'is-closable' : ''}`}
              >
                <button
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
                    if (e.button === 1 && canCloseThisTab) {
                      e.preventDefault();
                      onCloseTab(tab.id);
                    }
                  }}
                  onKeyDown={(e) => handleTabKeyDown(e, idx)}
                  title={`${tab.title} — Double-click to rename${canCloseThisTab ? ', middle-click to archive & close' : ''}`}
                >
                  <span className="tab-btn-label">{tab.title}</span>
                </button>
                {canCloseThisTab && (
                  <button
                    type="button"
                    className="tab-close-btn"
                    onClick={() => onCloseTab(tab.id)}
                    title={`Close & archive ${tab.title}${isSelected ? ' (⌘W)' : ''}`}
                    aria-label={`Close ${tab.title}`}
                    {...({ focusgroup: 'none' } as React.ButtonHTMLAttributes<HTMLButtonElement>)}
                  >
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path
                        d="M4.2 4.2l7.6 7.6M11.8 4.2l-7.6 7.6"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>

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
