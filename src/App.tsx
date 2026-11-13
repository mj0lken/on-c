import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ArchivedTab,
  CalculatorSettings,
  CalculatorTab,
  HelpCategoryId,
  SheetRow,
  ThemePreference,
} from './types';
import {
  ExchangeRatesState,
  fetchLiveExchangeRates,
  getInitialRates,
} from './engine/currencies';
import {
  createArchivedTab,
  isTabWorthArchiving,
  pruneExpiredArchives,
} from './engine/archive';
import {
  createFreshSheetTab,
  generateUniqueShortCode,
  resolveTabTitle,
} from './engine/tabNaming';
import {
  ACTIVE_TAB_KEY,
  ARCHIVED_TABS_KEY,
  CALC_COLOR_SCHEME_KEY,
  loadSavedActiveTabId,
  loadSavedArchivedTabs,
  loadSavedSettings,
  loadSavedTabs,
  markVisitorEdited,
  persistJson,
  persistString,
  SETTINGS_STORAGE_KEY,
  syncMetaColorScheme,
  TABS_STORAGE_KEY,
} from './engine/storage';
import { computeSheetTotalText, evaluateSheet } from './engine/evaluator';
import { TabBar } from './components/TabBar';
import { CalculatorSheet, CalculatorSheetHandle } from './components/CalculatorSheet';
import { SettingsBack } from './components/SettingsBack';
import { HelpDialog, HelpDialogHandle } from './components/HelpDialog';
import { SymbolToolbar, SymbolToolbarHandle } from './components/SymbolToolbar';
import { ExportMenu } from './components/ExportMenu';

interface HistorySnapshot {
  rows: SheetRow[];
  nextAutoVarIndex: number;
}

export interface AppHandle {
  prepareTourSheet: (initialRows: SheetRow[], useDedicatedTab: boolean) => void;
  setTourRows: (rows: SheetRow[], typingRowId?: string | null) => void;
  setTourTypingRowId: (rowId: string | null) => void;
  insertExpressionFromSite: (example: string) => void;
  openCharPickerForTour: () => void;
  setCharSearchForTour: (query: string) => void;
  closeCharPickerForTour: () => void;
  openHelpForTour: () => void;
  setHelpFilterForTour: (query: string, categories?: HelpCategoryId[]) => void;
  closeHelpForTour: () => void;
  setFlippedForTour: (flipped: boolean) => void;
  setSettingsPatchForTour: (patch: Partial<CalculatorSettings>) => void;
  setThemeFromSite: (theme: ThemePreference) => void;
  getCalcTheme: () => ThemePreference;
  focusLastRow: () => void;
}

export interface AppProps {
  embeddedInSite?: boolean;
  onUserInteract?: () => void;
  onCalcThemeChange?: (theme: ThemePreference) => void;
}

const LIVE_TOUR_TAB_ID = 'tab-live-tour';

export const App = forwardRef<AppHandle, AppProps>(
  ({ embeddedInSite = false, onUserInteract, onCalcThemeChange }, ref) => {
    const [settings, setSettings] = useState<CalculatorSettings>(loadSavedSettings);
    const [archivedTabs, setArchivedTabs] = useState<ArchivedTab[]>(() =>
      loadSavedArchivedTabs(settings.archiveRetentionDays)
    );
    const [tabs, setTabs] = useState<CalculatorTab[]>(() => loadSavedTabs(archivedTabs));
    const [activeTabId, setActiveTabId] = useState<string>(() => loadSavedActiveTabId(tabs));
    const [fxState, setFxState] = useState<ExchangeRatesState>(getInitialRates);
    const [isRefreshingFx, setIsRefreshingFx] = useState(false);

    const [isFlipped, setIsFlipped] = useState(false);
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const [isTourHelpMode, setIsTourHelpMode] = useState(false);
    const [tourTypingRowId, setTourTypingRowId] = useState<string | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const isTauri = useMemo(
      () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window,
      []
    );

    const undoStacksRef = useRef<Map<string, HistorySnapshot[]>>(new Map());
    const redoStacksRef = useRef<Map<string, HistorySnapshot[]>>(new Map());
    const toastTimerRef = useRef<number | null>(null);
    const tourTargetTabIdRef = useRef<string | null>(null);
    const sheetRef = useRef<CalculatorSheetHandle>(null);
    const symbolToolbarRef = useRef<SymbolToolbarHandle>(null);
    const helpDialogRef = useRef<HelpDialogHandle>(null);

    const showToast = useCallback((msg: string) => {
      setToastMessage(msg);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => {
        setToastMessage(null);
      }, 2200);
    }, []);

    useEffect(() => {
      syncMetaColorScheme(settings.theme, isTauri);
    }, [settings.theme, isTauri]);

    useEffect(() => {
      const onStorage = (e: StorageEvent) => {
        if (e.key === CALC_COLOR_SCHEME_KEY && e.newValue) {
          const val = e.newValue as ThemePreference;
          if (val === 'light' || val === 'dark' || val === 'system') {
            setSettings((prev) => ({ ...prev, theme: val }));
          }
        }
      };
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    }, []);

    useEffect(() => {
      persistJson(TABS_STORAGE_KEY, tabs);
    }, [tabs]);

    useEffect(() => {
      persistString(ACTIVE_TAB_KEY, activeTabId);
    }, [activeTabId]);

    useEffect(() => {
      persistJson(SETTINGS_STORAGE_KEY, settings);
    }, [settings]);

    useEffect(() => {
      persistJson(ARCHIVED_TABS_KEY, archivedTabs);
    }, [archivedTabs]);

    useEffect(() => {
      const prune = () =>
        setArchivedTabs((prev) => {
          const next = pruneExpiredArchives(prev, settings.archiveRetentionDays);
          return next.length === prev.length ? prev : next;
        });
      prune();
      const timer = window.setInterval(prune, 60_000);
      return () => window.clearInterval(timer);
    }, [settings.archiveRetentionDays]);

    const handleRefreshRates = useCallback(
      async (notifyUser = false) => {
        setIsRefreshingFx(true);
        const updated = await fetchLiveExchangeRates();
        setIsRefreshingFx(false);
        if (updated) {
          setFxState(updated);
          if (notifyUser) showToast('Updated live FX rates');
        } else if (notifyUser) {
          showToast('Using cached / offline FX rates');
        }
      },
      [showToast]
    );

    useEffect(() => {
      void handleRefreshRates(false);
    }, [handleRefreshRates]);

    const activeTab = useMemo(
      () => tabs.find((t) => t.id === activeTabId) ?? tabs[0],
      [tabs, activeTabId]
    );

    const evaluatedRows = useMemo(
      () => evaluateSheet(activeTab.rows, settings, fxState.rates),
      [activeTab.rows, settings, fxState.rates]
    );

    const sheetTotalText = useMemo(
      () => computeSheetTotalText(evaluatedRows, settings, fxState.rates),
      [evaluatedRows, settings, fxState.rates]
    );

    const updateActiveTabRows = useCallback(
      (newRows: SheetRow[], newNextAutoVarIndex?: number, pushHistory = true) => {
        setTabs((prevTabs) =>
          prevTabs.map((t) => {
            if (t.id !== activeTab.id) return t;
            if (pushHistory) {
              const stack = undoStacksRef.current.get(t.id) ?? [];
              stack.push({ rows: t.rows, nextAutoVarIndex: t.nextAutoVarIndex });
              if (stack.length > 80) stack.shift();
              undoStacksRef.current.set(t.id, stack);
              redoStacksRef.current.set(t.id, []);
            }
            const safeRows =
              newRows.length > 0 ? newRows : [{ id: `row-${Date.now()}`, text: '' }];
            const shortCode = t.shortCode ?? generateUniqueShortCode(prevTabs, archivedTabs);
            return {
              ...t,
              shortCode,
              title: resolveTabTitle(safeRows, shortCode, t.title, t.isCustomTitle),
              rows: safeRows,
              nextAutoVarIndex: newNextAutoVarIndex ?? t.nextAutoVarIndex,
            };
          })
        );
      },
      [activeTab.id, archivedTabs]
    );

    const applyHistorySnapshot = useCallback(
      (snapshot: HistorySnapshot) => {
        setTabs((prev) =>
          prev.map((t) => {
            if (t.id !== activeTab.id) return t;
            const shortCode = t.shortCode ?? generateUniqueShortCode(prev, archivedTabs);
            return {
              ...t,
              shortCode,
              title: resolveTabTitle(snapshot.rows, shortCode, t.title, t.isCustomTitle),
              rows: snapshot.rows,
              nextAutoVarIndex: snapshot.nextAutoVarIndex,
            };
          })
        );
      },
      [activeTab.id, archivedTabs]
    );

    const handleUndo = useCallback(() => {
      const stack = undoStacksRef.current.get(activeTab.id);
      if (!stack || stack.length === 0) return;
      const snapshot = stack.pop()!;
      const redoStack = redoStacksRef.current.get(activeTab.id) ?? [];
      redoStack.push({ rows: activeTab.rows, nextAutoVarIndex: activeTab.nextAutoVarIndex });
      redoStacksRef.current.set(activeTab.id, redoStack);
      applyHistorySnapshot(snapshot);
    }, [activeTab, applyHistorySnapshot]);

    const handleRedo = useCallback(() => {
      const redoStack = redoStacksRef.current.get(activeTab.id);
      if (!redoStack || redoStack.length === 0) return;
      const snapshot = redoStack.pop()!;
      const stack = undoStacksRef.current.get(activeTab.id) ?? [];
      stack.push({ rows: activeTab.rows, nextAutoVarIndex: activeTab.nextAutoVarIndex });
      undoStacksRef.current.set(activeTab.id, stack);
      applyHistorySnapshot(snapshot);
    }, [activeTab, applyHistorySnapshot]);

    const focusFreshHeadingRow = useCallback(() => {
      requestAnimationFrame(() => {
        sheetRef.current?.focusRow(0, 2);
      });
    }, []);

    const handleAddTab = useCallback(() => {
      const newTab = createFreshSheetTab(tabs, archivedTabs);
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
      setIsFlipped(false);
      focusFreshHeadingRow();
    }, [tabs, archivedTabs, focusFreshHeadingRow]);

    const canCloseActiveTab = useMemo(
      () => tabs.length > 1 || isTabWorthArchiving(activeTab),
      [tabs.length, activeTab]
    );

    const handleCloseTab = useCallback(
      (tabId: string) => {
        const targetTab = tabs.find((t) => t.id === tabId);
        if (!targetTab) return;
        const worthArchiving = isTabWorthArchiving(targetTab);
        if (tabs.length <= 1 && !worthArchiving) return;

        let nextArchivedList = archivedTabs;
        if (worthArchiving) {
          const archived = createArchivedTab(targetTab);
          nextArchivedList = [
            archived,
            ...pruneExpiredArchives(archivedTabs, settings.archiveRetentionDays),
          ];
          setArchivedTabs(nextArchivedList);
          showToast(`Archived "${targetTab.title}" (${settings.archiveRetentionDays}d)`);
        }

        undoStacksRef.current.delete(tabId);
        redoStacksRef.current.delete(tabId);

        if (tabs.length <= 1) {
          const freshTab = createFreshSheetTab([], nextArchivedList);
          setTabs([freshTab]);
          setActiveTabId(freshTab.id);
          focusFreshHeadingRow();
          return;
        }

        const idx = tabs.findIndex((t) => t.id === tabId);
        const filtered = tabs.filter((t) => t.id !== tabId);
        setTabs(filtered);
        if (tabId === activeTabId) {
          const fallback = filtered[Math.max(0, idx - 1)] ?? filtered[0];
          setActiveTabId(fallback.id);
        }
      },
      [
        tabs,
        archivedTabs,
        activeTabId,
        settings.archiveRetentionDays,
        showToast,
        focusFreshHeadingRow,
      ]
    );

    const handleRestoreArchivedTab = useCallback(
      (archiveId: string) => {
        const entry = archivedTabs.find((a) => a.archiveId === archiveId);
        if (!entry) return;

        const remainingArchives = archivedTabs.filter((a) => a.archiveId !== archiveId);
        const idTaken = tabs.some((t) => t.id === entry.tab.id);
        const codeTaken =
          !entry.tab.shortCode ||
          tabs.some((t) => t.shortCode?.toLowerCase() === entry.tab.shortCode?.toLowerCase());
        const shortCode = codeTaken
          ? generateUniqueShortCode(tabs, remainingArchives)
          : entry.tab.shortCode!;

        const restoredTab: CalculatorTab = {
          ...entry.tab,
          id: idTaken ? `tab-${Date.now().toString(36)}` : entry.tab.id,
          shortCode,
          title: resolveTabTitle(
            entry.tab.rows,
            shortCode,
            entry.tab.title,
            entry.tab.isCustomTitle
          ),
        };

        setArchivedTabs(remainingArchives);
        setTabs((prev) => {
          if (prev.length === 1 && !isTabWorthArchiving(prev[0])) {
            return [restoredTab];
          }
          return [...prev, restoredTab];
        });
        setActiveTabId(restoredTab.id);
        setIsFlipped(false);
        showToast(`Restored "${restoredTab.title}"`);
      },
      [archivedTabs, tabs, showToast]
    );

    const handleDeleteArchivedTab = useCallback((archiveId: string) => {
      setArchivedTabs((prev) => prev.filter((a) => a.archiveId !== archiveId));
    }, []);

    const handleRenameTab = useCallback(
      (tabId: string, newTitle: string) => {
        const clean = newTitle.trim();
        setTabs((prev) =>
          prev.map((t) => {
            if (t.id !== tabId) return t;
            const shortCode = t.shortCode ?? generateUniqueShortCode(prev, archivedTabs);
            if (clean.length === 0) {
              return {
                ...t,
                shortCode,
                isCustomTitle: false,
                title: resolveTabTitle(t.rows, shortCode, undefined, false),
              };
            }
            if (!t.isCustomTitle && clean === t.title) {
              return { ...t, shortCode, isCustomTitle: false };
            }
            return {
              ...t,
              shortCode,
              isCustomTitle: true,
              title: clean,
            };
          })
        );
      },
      [archivedTabs]
    );

    const handleInsertExample = useCallback(
      (example: string) => {
        if (example === '/char') {
          setIsFlipped(false);
          requestAnimationFrame(() => {
            symbolToolbarRef.current?.openPicker();
          });
          return;
        }
        if (example === '/help') {
          setIsFlipped(false);
          setIsTourHelpMode(false);
          setIsHelpOpen(true);
          return;
        }
        const rows = activeTab.rows;
        const last = rows[rows.length - 1];
        const nextRows =
          last && last.text.trim().length === 0
            ? [
                ...rows.slice(0, -1),
                { ...last, text: example },
                { id: `row-${Date.now()}`, text: '' },
              ]
            : [
                ...rows,
                { id: `row-${Date.now()}-ex`, text: example },
                { id: `row-${Date.now()}`, text: '' },
              ];
        updateActiveTabRows(nextRows, undefined, true);
        setIsFlipped(false);
      },
      [activeTab.rows, updateActiveTabRows]
    );

    useImperativeHandle(
      ref,
      () => ({
        prepareTourSheet: (initialRows: SheetRow[], useDedicatedTab: boolean) => {
          setIsFlipped(false);
          setIsHelpOpen(false);
          setIsTourHelpMode(false);
          symbolToolbarRef.current?.closePicker();

          const safeRows = initialRows.length > 0 ? initialRows : [{ id: 't-1', text: '# ' }];

          if (!useDedicatedTab) {
            const targetId = tabs[0]?.id ?? 'tab-welcome';
            tourTargetTabIdRef.current = targetId;
            setTabs((prev) =>
              prev.map((t, idx) => {
                if (idx !== 0) return t;
                const shortCode = t.shortCode ?? generateUniqueShortCode(prev, archivedTabs);
                return {
                  ...t,
                  shortCode,
                  isCustomTitle: false,
                  title: resolveTabTitle(safeRows, shortCode, undefined, false),
                  rows: safeRows,
                };
              })
            );
            setActiveTabId(targetId);
            return;
          }

          tourTargetTabIdRef.current = LIVE_TOUR_TAB_ID;
          setTabs((prev) => {
            const existing = prev.find((t) => t.id === LIVE_TOUR_TAB_ID);
            if (existing) {
              const shortCode =
                existing.shortCode ?? generateUniqueShortCode(prev, archivedTabs);
              return prev.map((t) =>
                t.id === LIVE_TOUR_TAB_ID
                  ? {
                      ...t,
                      shortCode,
                      isCustomTitle: false,
                      title: resolveTabTitle(safeRows, shortCode, undefined, false),
                      rows: safeRows,
                    }
                  : t
              );
            }
            const shortCode = generateUniqueShortCode(prev, archivedTabs);
            const demoTab: CalculatorTab = {
              id: LIVE_TOUR_TAB_ID,
              shortCode,
              isCustomTitle: false,
              title: resolveTabTitle(safeRows, shortCode, undefined, false),
              nextAutoVarIndex: 1,
              rows: safeRows,
            };
            return [...prev, demoTab];
          });
          setActiveTabId(LIVE_TOUR_TAB_ID);
        },
        setTourRows: (rows: SheetRow[], typingRowId?: string | null) => {
          const targetId = tourTargetTabIdRef.current ?? activeTab.id;
          const safeRows = rows.length > 0 ? rows : [{ id: 't-1', text: '' }];
          if (typingRowId !== undefined) {
            setTourTypingRowId(typingRowId);
          }
          setTabs((prev) =>
            prev.map((t) => {
              if (t.id !== targetId) return t;
              const shortCode = t.shortCode ?? generateUniqueShortCode(prev, archivedTabs);
              return {
                ...t,
                shortCode,
                title: resolveTabTitle(safeRows, shortCode, t.title, t.isCustomTitle),
                rows: safeRows,
              };
            })
          );
        },
        setTourTypingRowId: (rowId: string | null) => {
          setTourTypingRowId(rowId);
        },
        insertExpressionFromSite: (example: string) => {
          markVisitorEdited();
          setTourTypingRowId(null);
          handleInsertExample(example);
          requestAnimationFrame(() => {
            sheetRef.current?.focusCurrentCursor();
          });
        },
        openCharPickerForTour: () => {
          symbolToolbarRef.current?.openPicker({ focusSearch: false });
        },
        setCharSearchForTour: (query: string) => {
          symbolToolbarRef.current?.setSearchQuery(query);
        },
        closeCharPickerForTour: () => {
          symbolToolbarRef.current?.closePicker();
        },
        openHelpForTour: () => {
          setIsTourHelpMode(true);
          setIsHelpOpen(true);
        },
        setHelpFilterForTour: (query: string, categories?: HelpCategoryId[]) => {
          helpDialogRef.current?.setDemoFilter(query, categories);
        },
        closeHelpForTour: () => {
          setIsHelpOpen(false);
          setIsTourHelpMode(false);
          helpDialogRef.current?.setDemoFilter('', []);
        },
        setFlippedForTour: (flipped: boolean) => {
          setIsFlipped(flipped);
        },
        setSettingsPatchForTour: (patch: Partial<CalculatorSettings>) => {
          setSettings((prev) => ({ ...prev, ...patch }));
        },
        setThemeFromSite: (theme: ThemePreference) => {
          setSettings((prev) => ({ ...prev, theme }));
        },
        getCalcTheme: () => settings.theme,
        focusLastRow: () => {
          const lastIdx = Math.max(0, activeTab.rows.length - 1);
          sheetRef.current?.focusRow(lastIdx);
        },
      }),
      [
        tabs,
        archivedTabs,
        activeTab.id,
        activeTab.rows.length,
        settings.theme,
        handleInsertExample,
      ]
    );

    useEffect(() => {
      const onKeyDown = (e: KeyboardEvent) => {
        const mod = e.metaKey || e.ctrlKey;

        if (e.key === 'Escape' && isFlipped && !isHelpOpen) {
          e.preventDefault();
          setIsFlipped(false);
          return;
        }

        if (mod && e.key.toLowerCase() === 't') {
          e.preventDefault();
          markVisitorEdited();
          onUserInteract?.();
          handleAddTab();
          return;
        }

        if (
          mod &&
          e.key.toLowerCase() === 'w' &&
          canCloseActiveTab &&
          !isFlipped &&
          !isHelpOpen
        ) {
          e.preventDefault();
          markVisitorEdited();
          onUserInteract?.();
          handleCloseTab(activeTabId);
          return;
        }

        if (mod && e.key === ',') {
          e.preventDefault();
          onUserInteract?.();
          setIsFlipped((v) => !v);
          return;
        }

        if ((mod && e.key === '/') || e.key === 'F1') {
          e.preventDefault();
          onUserInteract?.();
          setIsTourHelpMode(false);
          setIsHelpOpen(true);
          return;
        }

        if (mod && !e.altKey && e.key.toLowerCase() === 'z' && !isFlipped && !isHelpOpen) {
          e.preventDefault();
          onUserInteract?.();
          if (e.shiftKey) handleRedo();
          else handleUndo();
          return;
        }

        if (mod && /^[1-9]$/.test(e.key)) {
          const idx = Number(e.key) - 1;
          if (tabs[idx]) {
            e.preventDefault();
            onUserInteract?.();
            setActiveTabId(tabs[idx].id);
          }
        }
      };

      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }, [
      isFlipped,
      isHelpOpen,
      tabs,
      activeTabId,
      canCloseActiveTab,
      handleAddTab,
      handleCloseTab,
      handleUndo,
      handleRedo,
      onUserInteract,
    ]);

    const handleStageTrustedInteract = useCallback(
      (e: React.SyntheticEvent) => {
        if (e.nativeEvent.isTrusted) {
          markVisitorEdited();
          setTourTypingRowId(null);
          onUserInteract?.();
        }
      },
      [onUserInteract]
    );

    const handleUpdateSettings = useCallback(
      (patch: Partial<CalculatorSettings>) => {
        setSettings((prev) => ({ ...prev, ...patch }));
        if (patch.theme !== undefined) {
          onCalcThemeChange?.(patch.theme);
        }
      },
      [onCalcThemeChange]
    );

    const openManualHelp = useCallback(() => {
      setIsTourHelpMode(false);
      setIsHelpOpen(true);
    }, []);

    return (
      <div
        className={[
          'app-stage',
          'calculator-theme-scope',
          `font-scale-${settings.fontSize}`,
          isTauri ? 'is-tauri' : '',
          embeddedInSite ? 'is-embedded-site' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        data-calc-theme={settings.theme}
        onPointerDownCapture={handleStageTrustedInteract}
        onKeyDownCapture={handleStageTrustedInteract}
      >
        <div className="calc-perspective">
          <div className={`calc-flipper ${isFlipped ? 'is-flipped' : ''}`}>
            {/* FRONT FACE: Calculator */}
            <main
              className="calc-face calc-face-front"
              aria-label="on/c Calculator"
              inert={isFlipped}
            >
              <TabBar
                tabs={tabs}
                activeTabId={activeTab.id}
                canCloseActiveTab={canCloseActiveTab}
                isTauri={isTauri}
                onSelectTab={setActiveTabId}
                onAddTab={handleAddTab}
                onCloseTab={handleCloseTab}
                onRenameTab={handleRenameTab}
                onOpenHelp={openManualHelp}
                onFlipToSettings={() => setIsFlipped(true)}
              />

              <CalculatorSheet
                ref={sheetRef}
                tabId={activeTab.id}
                rows={activeTab.rows}
                evaluatedRows={evaluatedRows}
                nextAutoVarIndex={activeTab.nextAutoVarIndex}
                tourTypingRowId={tourTypingRowId}
                onUpdateRows={updateActiveTabRows}
                onOpenHelp={openManualHelp}
                onOpenCharPicker={() => symbolToolbarRef.current?.openPicker()}
                onNotify={showToast}
              />

              <footer className="calc-footer">
                <SymbolToolbar
                  ref={symbolToolbarRef}
                  onInsertSymbol={(sym) => sheetRef.current?.insertAtCursor(sym)}
                  onRestoreSheetFocus={() => sheetRef.current?.focusCurrentCursor()}
                />

                <div className="footer-right">
                  <div className="footer-status">
                    {toastMessage ? (
                      <span className="status-toast" role="status" aria-live="polite">
                        {toastMessage}
                      </span>
                    ) : sheetTotalText ? (
                      <span className="footer-total">Total: {sheetTotalText}</span>
                    ) : (
                      <span className="footer-muted">Type /help for syntax</span>
                    )}
                  </div>

                  <ExportMenu
                    tab={activeTab}
                    evaluatedRows={evaluatedRows}
                    totalText={sheetTotalText}
                    isTauri={isTauri}
                    onNotify={showToast}
                  />
                </div>
              </footer>
            </main>

            {/* BACK FACE: Settings (180° Y-axis rotated) */}
            <aside
              className="calc-face calc-face-back"
              aria-label="Calculator Preferences"
              inert={!isFlipped}
            >
              <SettingsBack
                settings={settings}
                fxState={fxState}
                isRefreshingFx={isRefreshingFx}
                archivedTabs={archivedTabs}
                onUpdateSettings={handleUpdateSettings}
                onRefreshRates={() => void handleRefreshRates(true)}
                onRestoreArchivedTab={handleRestoreArchivedTab}
                onDeleteArchivedTab={handleDeleteArchivedTab}
                onFlipBack={() => setIsFlipped(false)}
              />
            </aside>
          </div>

          {isHelpOpen && isTourHelpMode && (
            <div
              className="calc-inline-scrim"
              aria-hidden="true"
              onClick={() => {
                setIsHelpOpen(false);
                setIsTourHelpMode(false);
              }}
            />
          )}

          <HelpDialog
            ref={helpDialogRef}
            isOpen={isHelpOpen}
            nonModalDemo={isTourHelpMode}
            onClose={() => {
              setIsHelpOpen(false);
              setIsTourHelpMode(false);
            }}
            onInsertExample={handleInsertExample}
          />
        </div>
      </div>
    );
  }
);
App.displayName = 'App';
