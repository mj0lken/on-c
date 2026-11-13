import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { EvaluatedRow, SheetRow } from '../types';
import { isBareHeadingPrompt } from '../engine/tabNaming';
import { isCharCommand, isHelpCommand } from '../engine/tokenizer';

interface CursorState {
  rowIndex: number;
  start: number;
  end: number;
}

export interface CalculatorSheetHandle {
  insertAtCursor: (snippet: string) => void;
  focusCurrentCursor: () => void;
  focusRow: (rowIndex: number, caretPos?: number) => void;
}

const SHEET_NAME_SUGGESTIONS = [
  'Trip Budget',
  'Monthly Expenses',
  'Project Estimate',
  'Tax Breakdown',
  'Home Renovation',
];

function pickSuggestionForTab(tabId: string): string {
  let hash = 0;
  for (let i = 0; i < tabId.length; i++) {
    hash = (hash * 31 + tabId.charCodeAt(i)) >>> 0;
  }
  return SHEET_NAME_SUGGESTIONS[hash % SHEET_NAME_SUGGESTIONS.length];
}

interface CalculatorSheetProps {
  tabId: string;
  rows: SheetRow[];
  evaluatedRows: EvaluatedRow[];
  nextAutoVarIndex: number;
  onUpdateRows: (newRows: SheetRow[], newNextAutoVarIndex?: number, pushHistory?: boolean) => void;
  onOpenHelp: () => void;
  onOpenCharPicker: () => void;
  onNotify: (message: string) => void;
}

function makeRowId(): string {
  return `row-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export const CalculatorSheet = forwardRef<CalculatorSheetHandle, CalculatorSheetProps>(
  (
    {
      tabId,
      rows,
      evaluatedRows,
      nextAutoVarIndex,
      onUpdateRows,
      onOpenHelp,
      onOpenCharPicker,
      onNotify,
    },
    ref
  ) => {
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(Math.max(0, rows.length - 1));
  const [rejectedRowId, setRejectedRowId] = useState<string | null>(null);
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null);

  const cursorRef = useRef<CursorState>({
    rowIndex: Math.max(0, rows.length - 1),
    start: rows[rows.length - 1]?.text.length ?? 0,
    end: rows[rows.length - 1]?.text.length ?? 0,
  });

  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const pendingFocusRef = useRef<{ rowId: string; start: number; end: number } | null>(null);

  // Apply pending programmatic focus & selection after row split/merge/insert
  useEffect(() => {
    const pending = pendingFocusRef.current;
    if (!pending) return;
    const input = inputRefs.current.get(pending.rowId);
    if (input) {
      input.focus({ preventScroll: true });
      input.setSelectionRange(pending.start, pending.end);
      const idx = rows.findIndex((r) => r.id === pending.rowId);
      if (idx >= 0) {
        setFocusedRowIndex(idx);
        cursorRef.current = { rowIndex: idx, start: pending.start, end: pending.end };
      }
      pendingFocusRef.current = null;
    }
  }, [rows]);

  // Reset cursor when switching tabs
  useEffect(() => {
    const lastIdx = Math.max(0, rows.length - 1);
    const len = rows[lastIdx]?.text.length ?? 0;
    setFocusedRowIndex(lastIdx);
    cursorRef.current = { rowIndex: lastIdx, start: len, end: len };
  }, [tabId]);

  useImperativeHandle(
    ref,
    () => ({
      insertAtCursor: (snippet: string) => {
        const safeRowIdx = Math.min(Math.max(0, cursorRef.current.rowIndex), rows.length - 1);
        const targetRow = rows[safeRowIdx];
        if (!targetRow) return;
        const safeStart = Math.min(cursorRef.current.start, targetRow.text.length);
        const safeEnd = Math.min(cursorRef.current.end, targetRow.text.length);
        const nextText = targetRow.text.slice(0, safeStart) + snippet + targetRow.text.slice(safeEnd);
        const nextPos = safeStart + snippet.length;
        const nextRows = rows.map((r, i) => (i === safeRowIdx ? { ...r, text: nextText } : r));
        pendingFocusRef.current = { rowId: targetRow.id, start: nextPos, end: nextPos };
        onUpdateRows(nextRows, undefined, true);
      },
      focusCurrentCursor: () => {
        const safeRowIdx = Math.min(Math.max(0, cursorRef.current.rowIndex), rows.length - 1);
        const targetRow = rows[safeRowIdx];
        if (!targetRow) return;
        const input = inputRefs.current.get(targetRow.id);
        if (input) {
          const pos = Math.min(cursorRef.current.start, targetRow.text.length);
          input.focus({ preventScroll: true });
          input.setSelectionRange(pos, pos);
          setFocusedRowIndex(safeRowIdx);
        }
      },
      focusRow: (rowIndex: number, caretPos?: number) => {
        const safeRowIdx = Math.min(Math.max(0, rowIndex), rows.length - 1);
        const targetRow = rows[safeRowIdx];
        if (!targetRow) return;
        const pos = Math.min(caretPos ?? targetRow.text.length, targetRow.text.length);
        cursorRef.current = { rowIndex: safeRowIdx, start: pos, end: pos };
        pendingFocusRef.current = { rowId: targetRow.id, start: pos, end: pos };
        const input = inputRefs.current.get(targetRow.id);
        if (input) {
          input.focus({ preventScroll: true });
          input.setSelectionRange(pos, pos);
          setFocusedRowIndex(safeRowIdx);
          pendingFocusRef.current = null;
        }
      },
    }),
    [rows, onUpdateRows]
  );

  const syncCursorFromInput = (rowIndex: number, el: HTMLInputElement) => {
    cursorRef.current = {
      rowIndex,
      start: el.selectionStart ?? el.value.length,
      end: el.selectionEnd ?? el.value.length,
    };
  };

  const handleTextChange = (rowIndex: number, newValue: string, inputEl: HTMLInputElement) => {
    // Immediate `/help` command trigger!
    if (isHelpCommand(newValue)) {
      const cleanedRows = rows.map((r, i) => (i === rowIndex ? { ...r, text: '' } : r));
      onUpdateRows(cleanedRows, undefined, false);
      pendingFocusRef.current = { rowId: rows[rowIndex].id, start: 0, end: 0 };
      onOpenHelp();
      return;
    }

    // Immediate `/char` command trigger (both standalone `/char` and inline e.g. `sin 30/char`)
    const caret = inputEl.selectionStart ?? newValue.length;
    const beforeCaret = newValue.slice(0, caret);
    const afterCaret = newValue.slice(caret);
    if (/\/char$/i.test(beforeCaret) && !/^[A-Za-z0-9_]/.test(afterCaret)) {
      const strippedText = beforeCaret.slice(0, -5) + afterCaret;
      const strippedCaret = caret - 5;
      cursorRef.current = { rowIndex, start: strippedCaret, end: strippedCaret };
      const cleanedRows = rows.map((r, i) => (i === rowIndex ? { ...r, text: strippedText } : r));
      onUpdateRows(cleanedRows, undefined, false);
      onOpenCharPicker();
      return;
    }
    if (isCharCommand(newValue)) {
      cursorRef.current = { rowIndex, start: 0, end: 0 };
      const cleanedRows = rows.map((r, i) => (i === rowIndex ? { ...r, text: '' } : r));
      onUpdateRows(cleanedRows, undefined, false);
      onOpenCharPicker();
      return;
    }

    const updated = rows.map((r, i) => (i === rowIndex ? { ...r, text: newValue } : r));
    syncCursorFromInput(rowIndex, inputEl);
    onUpdateRows(updated, undefined, true);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, rowIndex: number) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text.includes('\n')) return; // Let single-line paste run natively

    e.preventDefault();
    const el = e.currentTarget;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const currentText = rows[rowIndex].text;
    const before = currentText.slice(0, start);
    const after = currentText.slice(end);

    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const newSegment: SheetRow[] = lines.map((line, i) => {
      if (i === 0) {
        return {
          ...rows[rowIndex],
          text: lines.length === 1 ? before + line + after : before + line,
        };
      }
      if (i === lines.length - 1) {
        return { id: makeRowId(), text: line + after };
      }
      return { id: makeRowId(), text: line };
    });

    const nextRows = [
      ...rows.slice(0, rowIndex),
      ...newSegment,
      ...rows.slice(rowIndex + 1),
    ];
    const lastInserted = newSegment[newSegment.length - 1];
    const caretPos = lastInserted.text.length - after.length;
    pendingFocusRef.current = { rowId: lastInserted.id, start: caretPos, end: caretPos };
    onUpdateRows(nextRows, undefined, true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number) => {
    const el = e.currentTarget;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const currentRow = rows[rowIndex];

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isHelpCommand(currentRow.text)) {
        const cleaned = rows.map((r, i) => (i === rowIndex ? { ...r, text: '' } : r));
        onUpdateRows(cleaned, undefined, false);
        onOpenHelp();
        return;
      }

      if (isCharCommand(currentRow.text)) {
        cursorRef.current = { rowIndex, start: 0, end: 0 };
        const cleaned = rows.map((r, i) => (i === rowIndex ? { ...r, text: '' } : r));
        onUpdateRows(cleaned, undefined, false);
        onOpenCharPicker();
        return;
      }

      // Pressing Enter on an untouched `# ` starter prompt dismisses the empty heading cleanly
      if (rowIndex === 0 && rows.length === 1 && isBareHeadingPrompt(currentRow.text)) {
        pendingFocusRef.current = { rowId: currentRow.id, start: 0, end: 0 };
        onUpdateRows([{ ...currentRow, text: '' }], undefined, false);
        return;
      }

      const before = currentRow.text.slice(0, start);
      const after = currentRow.text.slice(end);
      const createdRow: SheetRow = { id: makeRowId(), text: after };

      const nextRows = [
        ...rows.slice(0, rowIndex),
        { ...currentRow, text: before },
        createdRow,
        ...rows.slice(rowIndex + 1),
      ];
      pendingFocusRef.current = { rowId: createdRow.id, start: 0, end: 0 };
      onUpdateRows(nextRows, undefined, true);
      return;
    }

    // Single-keystroke Backspace right behind untouched `# ` clears Row 1 cleanly
    if (
      e.key === 'Backspace' &&
      rowIndex === 0 &&
      currentRow.text === '# ' &&
      start === 2 &&
      end === 2
    ) {
      e.preventDefault();
      pendingFocusRef.current = { rowId: currentRow.id, start: 0, end: 0 };
      onUpdateRows(
        rows.map((r, i) => (i === 0 ? { ...r, text: '' } : r)),
        undefined,
        false
      );
      return;
    }

    if (e.key === 'Backspace' && start === 0 && end === 0 && rowIndex > 0) {
      e.preventDefault();
      const prevRow = rows[rowIndex - 1];
      const joinOffset = prevRow.text.length;
      const mergedPrev: SheetRow = {
        ...prevRow,
        text: prevRow.text + currentRow.text,
        autoVar: prevRow.autoVar ?? currentRow.autoVar,
      };
      const nextRows = [
        ...rows.slice(0, rowIndex - 1),
        mergedPrev,
        ...rows.slice(rowIndex + 1),
      ];
      pendingFocusRef.current = { rowId: mergedPrev.id, start: joinOffset, end: joinOffset };
      onUpdateRows(nextRows, undefined, true);
      return;
    }

    if (e.key === 'Delete' && start === currentRow.text.length && end === currentRow.text.length && rowIndex < rows.length - 1) {
      e.preventDefault();
      const nextRow = rows[rowIndex + 1];
      const merged: SheetRow = {
        ...currentRow,
        text: currentRow.text + nextRow.text,
        autoVar: currentRow.autoVar ?? nextRow.autoVar,
      };
      const nextRows = [
        ...rows.slice(0, rowIndex),
        merged,
        ...rows.slice(rowIndex + 2),
      ];
      pendingFocusRef.current = { rowId: merged.id, start, end: start };
      onUpdateRows(nextRows, undefined, true);
      return;
    }

    if (e.key === 'ArrowUp' && rowIndex > 0) {
      e.preventDefault();
      const target = rows[rowIndex - 1];
      const pos = Math.min(start, target.text.length);
      pendingFocusRef.current = { rowId: target.id, start: pos, end: pos };
      const input = inputRefs.current.get(target.id);
      if (input) {
        input.focus();
        input.setSelectionRange(pos, pos);
        setFocusedRowIndex(rowIndex - 1);
        cursorRef.current = { rowIndex: rowIndex - 1, start: pos, end: pos };
        pendingFocusRef.current = null;
      }
      return;
    }

    if (e.key === 'ArrowDown' && rowIndex < rows.length - 1) {
      e.preventDefault();
      const target = rows[rowIndex + 1];
      const pos = Math.min(start, target.text.length);
      const input = inputRefs.current.get(target.id);
      if (input) {
        input.focus();
        input.setSelectionRange(pos, pos);
        setFocusedRowIndex(rowIndex + 1);
        cursorRef.current = { rowIndex: rowIndex + 1, start: pos, end: pos };
      }
      return;
    }

    if (e.key === 'ArrowLeft' && start === 0 && end === 0 && rowIndex > 0) {
      e.preventDefault();
      const target = rows[rowIndex - 1];
      const pos = target.text.length;
      const input = inputRefs.current.get(target.id);
      if (input) {
        input.focus();
        input.setSelectionRange(pos, pos);
        setFocusedRowIndex(rowIndex - 1);
        cursorRef.current = { rowIndex: rowIndex - 1, start: pos, end: pos };
      }
      return;
    }

    if (
      e.key === 'ArrowRight' &&
      start === currentRow.text.length &&
      end === currentRow.text.length &&
      rowIndex < rows.length - 1
    ) {
      e.preventDefault();
      const target = rows[rowIndex + 1];
      const input = inputRefs.current.get(target.id);
      if (input) {
        input.focus();
        input.setSelectionRange(0, 0);
        setFocusedRowIndex(rowIndex + 1);
        cursorRef.current = { rowIndex: rowIndex + 1, start: 0, end: 0 };
      }
    }
  };

  const copyFormattedAnswer = async (evalRow: EvaluatedRow) => {
    if (!evalRow.formatted) return;
    try {
      await navigator.clipboard.writeText(evalRow.formatted);
      setCopiedRowId(evalRow.rowId);
      setTimeout(() => {
        setCopiedRowId((prev) => (prev === evalRow.rowId ? null : prev));
      }, 1100);
    } catch {
      // Ignore clipboard permission errors
    }
  };

  const handleAnswerClick = (e: React.MouseEvent, clickedIndex: number, evalRow: EvaluatedRow) => {
    // Alt/Option-click copies the raw formatted value directly
    if (e.altKey) {
      void copyFormattedAnswer(evalRow);
      return;
    }

    const { rowIndex: targetRowIndex, start, end } = cursorRef.current;

    // Enforce: cannot reference backwards into rows at or before the clicked answer!
    if (targetRowIndex <= clickedIndex) {
      setRejectedRowId(evalRow.rowId);
      onNotify('Move cursor to a row below this answer to reference it');
      setTimeout(() => {
        setRejectedRowId((prev) => (prev === evalRow.rowId ? null : prev));
      }, 500);
      return;
    }

    // Determine whether clicked answer is the immediately preceding output above targetRowIndex AND latest ans
    let isImmediatePrevOutput = true;
    for (let k = clickedIndex + 1; k < targetRowIndex; k++) {
      if (evaluatedRows[k]?.value !== null) {
        isImmediatePrevOutput = false;
        break;
      }
    }

    let updatedNextIdx = nextAutoVarIndex;
    let varTokenToInsert: string;
    const nextRows = [...rows];

    if (evalRow.isLatestAns && isImmediatePrevOutput) {
      varTokenToInsert = 'ans';
    } else if (evalRow.assignedVar) {
      varTokenToInsert = evalRow.assignedVar;
    } else if (rows[clickedIndex].autoVar) {
      varTokenToInsert = rows[clickedIndex].autoVar!;
    } else {
      // Create a unique persistent variable for this older answer (ans1, ans2, ...)
      const existingNames = new Set(
        rows
          .flatMap((r, idx) => [r.autoVar?.toLowerCase(), evaluatedRows[idx]?.assignedVar?.toLowerCase()])
          .filter(Boolean) as string[]
      );
      let candidateIdx = updatedNextIdx;
      while (existingNames.has(`ans${candidateIdx}`)) {
        candidateIdx++;
      }
      varTokenToInsert = `ans${candidateIdx}`;
      updatedNextIdx = candidateIdx + 1;
      nextRows[clickedIndex] = {
        ...nextRows[clickedIndex],
        autoVar: varTokenToInsert,
      };
    }

    const cursorRow = nextRows[targetRowIndex];
    const safeStart = Math.min(start, cursorRow.text.length);
    const safeEnd = Math.min(end, cursorRow.text.length);
    const before = cursorRow.text.slice(0, safeStart);
    const after = cursorRow.text.slice(safeEnd);

    const needsLeadingSpace = before.length > 0 && /[A-Za-z0-9_%°$'"]$/.test(before);
    const needsTrailingSpace = after.length > 0 && /^[A-Za-z0-9_$]/.test(after);
    const inserted = `${needsLeadingSpace ? ' ' : ''}${varTokenToInsert}${needsTrailingSpace ? ' ' : ''}`;

    const newRowText = before + inserted + after;
    const newCaret = before.length + inserted.length;

    nextRows[targetRowIndex] = {
      ...cursorRow,
      text: newRowText,
    };

    pendingFocusRef.current = {
      rowId: cursorRow.id,
      start: newCaret,
      end: newCaret,
    };

    onUpdateRows(nextRows, updatedNextIdx, true);
  };

  const handleEmptyCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const lastIdx = rows.length - 1;
    const lastRow = rows[lastIdx];
    if (!lastRow) return;

    if (lastRow.text.trim().length === 0) {
      const input = inputRefs.current.get(lastRow.id);
      if (input) {
        const len = lastRow.text.length;
        input.focus();
        input.setSelectionRange(len, len);
        setFocusedRowIndex(lastIdx);
        cursorRef.current = { rowIndex: lastIdx, start: len, end: len };
      }
    } else {
      const newRow: SheetRow = { id: makeRowId(), text: '' };
      pendingFocusRef.current = { rowId: newRow.id, start: 0, end: 0 };
      onUpdateRows([...rows, newRow], undefined, true);
    }
  };

  return (
    <div
      className="sheet-scroller"
      role="tabpanel"
      aria-labelledby={`tab-${tabId}`}
      onClick={handleEmptyCanvasClick}
    >
      <div className="sheet-rows" onClick={handleEmptyCanvasClick}>
        {rows.map((row, idx) => {
          const ev = evaluatedRows[idx];
          const isFocused = focusedRowIndex === idx;
          const isSeparator = ev?.kind === 'separator';
          const isHeading = ev?.kind === 'heading';
          const isRejected = rejectedRowId === row.id;
          const isCopied = copiedRowId === row.id;

          return (
            <div
              key={row.id}
              className={[
                'calc-row',
                isFocused ? 'is-focused' : '',
                isSeparator ? 'is-separator-row' : '',
                isHeading ? 'is-heading-row' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => {
                if (isSeparator && !isFocused) {
                  const input = inputRefs.current.get(row.id);
                  if (input) {
                    const len = row.text.length;
                    input.focus();
                    input.setSelectionRange(len, len);
                  }
                }
              }}
            >
              {isSeparator && <div className="visual-separator-rule" aria-hidden="true" />}

              <div className={`expr-cell ${isSeparator && !isFocused ? 'separator-unfocused' : ''}`}>
                <div className="expr-highlight-layer" aria-hidden="true">
                  {ev && ev.highlights.length > 0 ? (
                    <>
                      {ev.highlights.map((span, sIdx) => (
                        <span key={sIdx} className={`tok tok-${span.type}`}>
                          {span.text}
                        </span>
                      ))}
                      {idx === 0 && isBareHeadingPrompt(row.text) && (
                        <span className="tok-placeholder">
                          {row.text.endsWith(' ') ? '' : ' '}
                          {`Sheet name (e.g. ${pickSuggestionForTab(tabId)})…`}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="tok-placeholder">
                      {idx === 0 && rows.length === 1 && row.text.length === 0
                        ? 'Type a calculation, /char, or /help…'
                        : '\u200B'}
                    </span>
                  )}
                </div>

                <input
                  ref={(el) => {
                    if (el) inputRefs.current.set(row.id, el);
                    else inputRefs.current.delete(row.id);
                  }}
                  type="text"
                  className="expr-input"
                  value={row.text}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoComplete="off"
                  autoCorrect="off"
                  aria-label={`Line ${idx + 1} expression`}
                  onFocus={(e) => {
                    setFocusedRowIndex(idx);
                    syncCursorFromInput(idx, e.currentTarget);
                  }}
                  onClick={(e) => syncCursorFromInput(idx, e.currentTarget)}
                  onSelect={(e) => syncCursorFromInput(idx, e.currentTarget)}
                  onKeyUp={(e) => syncCursorFromInput(idx, e.currentTarget)}
                  onChange={(e) => handleTextChange(idx, e.target.value, e.currentTarget)}
                  onKeyDown={(e) => handleKeyDown(e, idx)}
                  onPaste={(e) => handlePaste(e, idx)}
                />
              </div>

              {!isSeparator && (
                <div className="result-cell">
                  {ev?.refError ? (
                    <span className="result-ref-error" title={ev.refError}>
                      ↑ can’t ref below
                    </span>
                  ) : ev?.kind === 'command' ? (
                    <button
                      type="button"
                      className="result-chip result-command-chip"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        if (isCharCommand(row.text)) {
                          cursorRef.current = { rowIndex: idx, start: 0, end: 0 };
                          const cleaned = rows.map((r, i) => (i === idx ? { ...r, text: '' } : r));
                          onUpdateRows(cleaned, undefined, false);
                          onOpenCharPicker();
                        } else {
                          onOpenHelp();
                        }
                      }}
                    >
                      {ev.formatted}
                    </button>
                  ) : ev?.formatted ? (
                    <div className={`result-group ${isRejected ? 'is-rejected' : ''}`}>
                      {ev.isLatestAns ? (
                        <span className="var-badge var-badge-ans" title="Latest output (ans)">
                          ans
                        </span>
                      ) : ev.autoVar ? (
                        <span
                          className="var-badge var-badge-old"
                          title={`Row variable (${ev.autoVar})`}
                        >
                          {ev.autoVar}
                        </span>
                      ) : null}

                      <button
                        type="button"
                        className="result-chip"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => handleAnswerClick(e, idx, ev)}
                        title={
                          focusedRowIndex > idx
                            ? `Click to insert ${ev.isLatestAns ? 'ans' : ev.assignedVar ?? ev.autoVar ?? 'variable'} at cursor · ⌥Click to copy`
                            : 'Move cursor to a row below to reference · ⌥Click to copy'
                        }
                      >
                        <span className="result-value-text">
                          {isCopied ? 'Copied' : ev.formatted}
                        </span>
                      </button>

                      <button
                        type="button"
                        className="copy-mini-btn"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => void copyFormattedAnswer(ev)}
                        title="Copy result to clipboard"
                        aria-label={`Copy ${ev.formatted}`}
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <rect
                            x="5.5"
                            y="5.5"
                            width="8"
                            height="8"
                            rx="1.5"
                            stroke="currentColor"
                            strokeWidth="1.4"
                          />
                          <path
                            d="M3.5 10.5H3A1.5 1.5 0 011.5 9V3A1.5 1.5 0 013 1.5h6A1.5 1.5 0 0110.5 3v.5"
                            stroke="currentColor"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
  }
);
CalculatorSheet.displayName = 'CalculatorSheet';
