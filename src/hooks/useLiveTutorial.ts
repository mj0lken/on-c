import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppHandle } from '../App';
import { hasSavedVisitorData, markTourCompleted } from '../engine/storage';
import { SheetRow } from '../types';

export type TourStepId = 'math' | 'currency' | 'char' | 'help' | 'settings';

export interface TourStepMeta {
  id: TourStepId;
  label: string;
  shortHint: string;
}

export interface TourCursorPatch {
  visible?: boolean;
  targetSelector?: string | null;
  alignX?: number;
  alignY?: number;
  offsetX?: number;
  offsetY?: number;
  click?: boolean;
  bumpTopLayer?: boolean;
}

export interface TourCursorState {
  visible: boolean;
  targetSelector: string | null;
  alignX: number;
  alignY: number;
  offsetX: number;
  offsetY: number;
  clicking: boolean;
  clickSeq: number;
  topLayerBumpSeq: number;
}

export const TOUR_STEPS: ReadonlyArray<TourStepMeta> = [
  { id: 'math', label: 'Math & ans', shortHint: 'Headings, expressions & ans chaining' },
  { id: 'currency', label: 'Currency', shortHint: 'Live FX conversion & block sum' },
  { id: 'char', label: '/char', shortHint: 'Click /char for searchable math symbols' },
  { id: 'help', label: '/help', shortHint: 'Click /help for searchable syntax reference' },
  { id: 'settings', label: 'Settings', shortHint: 'Click gear icon for 180° preferences & archive' },
];

interface TimelineFrame {
  step: TourStepId;
  delayMs: number;
  cursor?: TourCursorPatch;
  run: (app: AppHandle) => void;
}

function cloneRows(rows: ReadonlyArray<SheetRow>): SheetRow[] {
  return rows.map((r) => ({ ...r }));
}

const MATH_FINISHED_ROWS: SheetRow[] = [
  { id: 't-1', text: '# Studio Trip' },
  { id: 't-2', text: '120 + 45 * 3', autoVar: 'ans1' },
  { id: 't-3', text: 'ans - 15% // discount' },
  { id: 't-4', text: '---' },
];

const CURRENCY_FINISHED_ROWS: SheetRow[] = [
  ...MATH_FINISHED_ROWS,
  { id: 't-5', text: '# Expenses in EUR' },
  { id: 't-6', text: 'Flight: $850 in EUR' },
  { id: 't-7', text: 'Hotel: 4 200 SEK in EUR' },
  { id: 't-8', text: 'sum' },
  { id: 't-9', text: '---' },
];

const CHAR_FINISHED_ROWS: SheetRow[] = [
  ...CURRENCY_FINISHED_ROWS,
  { id: 't-10', text: 'Ramp angle: sin 30°' },
];

const FINAL_TOUR_ROWS: SheetRow[] = [
  ...CHAR_FINISHED_ROWS,
  { id: 't-11', text: '' },
];

function appendTypingFrames(
  frames: TimelineFrame[],
  step: TourStepId,
  prefixRows: ReadonlyArray<SheetRow>,
  rowId: string,
  targetText: string,
  startFromText = '',
  charDelayMs = 34,
  afterLinePauseMs = 320,
  autoVar?: string
): SheetRow[] {
  for (let i = startFromText.length + 1; i <= targetText.length; i++) {
    const partial = targetText.slice(0, i);
    const snapshot: SheetRow[] = [
      ...cloneRows(prefixRows),
      { id: rowId, text: partial, ...(i === targetText.length && autoVar ? { autoVar } : {}) },
    ];
    frames.push({
      step,
      delayMs: i === targetText.length ? afterLinePauseMs : charDelayMs,
      run: (app) => app.setTourRows(snapshot, rowId),
    });
  }
  return [
    ...cloneRows(prefixRows),
    { id: rowId, text: targetText, ...(autoVar ? { autoVar } : {}) },
  ];
}

function buildTutorialTimeline(): {
  frames: TimelineFrame[];
  stepStartIndex: Record<TourStepId, number>;
} {
  const frames: TimelineFrame[] = [];
  const stepStartIndex: Record<TourStepId, number> = {
    math: 0,
    currency: 0,
    char: 0,
    help: 0,
    settings: 0,
  };

  // --- STEP 1: MATH & ANS ---
  stepStartIndex.math = frames.length;
  frames.push({
    step: 'math',
    delayMs: 420,
    cursor: {
      visible: true,
      targetSelector: '[data-tour-row="t-1"]',
      alignX: 0.16,
      alignY: 0.55,
      offsetX: 0,
      offsetY: 0,
    },
    run: (app) => {
      app.closeCharPickerForTour();
      app.closeHelpForTour();
      app.setFlippedForTour(false);
      app.setTourRows([{ id: 't-1', text: '# ' }], null);
    },
  });

  frames.push({
    step: 'math',
    delayMs: 220,
    cursor: {
      visible: true,
      targetSelector: '[data-tour-row="t-1"]',
      alignX: 0.16,
      alignY: 0.55,
      click: true,
    },
    run: (app) => app.setTourTypingRowId('t-1'),
  });

  // Gently park cursor aside so the sheet text & results remain unobstructed while typing
  frames.push({
    step: 'math',
    delayMs: 120,
    cursor: {
      visible: true,
      targetSelector: '[data-tour-target="sheet"]',
      alignX: 0.68,
      alignY: 0.58,
    },
    run: () => {},
  });

  let rows = appendTypingFrames(
    frames,
    'math',
    [],
    't-1',
    '# Studio Trip',
    '# ',
    36,
    320
  );
  rows = appendTypingFrames(
    frames,
    'math',
    rows,
    't-2',
    '120 + 45 * 3',
    '',
    32,
    360,
    'ans1'
  );
  rows = appendTypingFrames(
    frames,
    'math',
    rows,
    't-3',
    'ans - 15% // discount',
    '',
    30,
    400
  );
  rows = appendTypingFrames(frames, 'math', rows, 't-4', '---', '', 50, 280);

  // --- STEP 2: CURRENCY ---
  stepStartIndex.currency = frames.length;
  frames.push({
    step: 'currency',
    delayMs: 320,
    cursor: {
      visible: true,
      targetSelector: '[data-tour-row="t-4"]',
      alignX: 0.18,
      alignY: 0.9,
      offsetY: 12,
    },
    run: (app) => {
      app.closeCharPickerForTour();
      app.closeHelpForTour();
      app.setFlippedForTour(false);
      app.setTourRows(cloneRows(MATH_FINISHED_ROWS), 't-4');
    },
  });

  frames.push({
    step: 'currency',
    delayMs: 180,
    cursor: {
      visible: true,
      targetSelector: '[data-tour-target="sheet"]',
      alignX: 0.66,
      alignY: 0.72,
      click: true,
    },
    run: () => {},
  });

  rows = cloneRows(MATH_FINISHED_ROWS);
  rows = appendTypingFrames(
    frames,
    'currency',
    rows,
    't-5',
    '# Expenses in EUR',
    '',
    26,
    220
  );
  rows = appendTypingFrames(
    frames,
    'currency',
    rows,
    't-6',
    'Flight: $850 in EUR',
    '',
    32,
    360
  );
  rows = appendTypingFrames(
    frames,
    'currency',
    rows,
    't-7',
    'Hotel: 4 200 SEK in EUR',
    '',
    32,
    360
  );
  rows = appendTypingFrames(frames, 'currency', rows, 't-8', 'sum', '', 60, 420);
  rows = appendTypingFrames(frames, 'currency', rows, 't-9', '---', '', 50, 260);

  // --- STEP 3: /char QUICK SYMBOLS (CURSOR CLICKS /char BUTTON) ---
  stepStartIndex.char = frames.length;
  frames.push({
    step: 'char',
    delayMs: 220,
    cursor: {
      visible: true,
      targetSelector: '[data-tour-target="sheet"]',
      alignX: 0.62,
      alignY: 0.76,
    },
    run: (app) => {
      app.closeCharPickerForTour();
      app.closeHelpForTour();
      app.setFlippedForTour(false);
      app.setTourRows(cloneRows(CURRENCY_FINISHED_ROWS), null);
    },
  });

  rows = cloneRows(CURRENCY_FINISHED_ROWS);
  rows = appendTypingFrames(
    frames,
    'char',
    rows,
    't-10',
    'Ramp angle: sin 30',
    '',
    34,
    240
  );

  // Glide cursor deliberately down-left to the `/char` button
  frames.push({
    step: 'char',
    delayMs: 520,
    cursor: {
      visible: true,
      targetSelector: '[data-tour-target="char-btn"]',
      alignX: 0.5,
      alignY: 0.55,
      offsetX: 0,
      offsetY: 0,
    },
    run: () => {},
  });

  // Click `/char` button -> opens searchable symbol popover
  frames.push({
    step: 'char',
    delayMs: 260,
    cursor: {
      visible: true,
      targetSelector: '[data-tour-target="char-btn"]',
      alignX: 0.5,
      alignY: 0.55,
      click: true,
    },
    run: () => {},
  });

  frames.push({
    step: 'char',
    delayMs: 380,
    cursor: {
      visible: true,
      targetSelector: '[data-tour-target="char-search"]',
      alignX: 0.36,
      alignY: 0.55,
      bumpTopLayer: true,
    },
    run: (app) => {
      app.openCharPickerForTour();
    },
  });

  frames.push({
    step: 'char',
    delayMs: 180,
    cursor: {
      visible: true,
      targetSelector: '[data-tour-target="char-search"]',
      alignX: 0.36,
      alignY: 0.55,
      click: true,
    },
    run: () => {},
  });

  for (const q of ['d', 'de', 'deg']) {
    frames.push({
      step: 'char',
      delayMs: q === 'deg' ? 480 : 95,
      run: (app) => app.setCharSearchForTour(q),
    });
  }

  // Glide cursor down to the `° Degrees` row in `/char` and click it
  frames.push({
    step: 'char',
    delayMs: 420,
    cursor: {
      visible: true,
      targetSelector: '[data-tour-target="char-item-deg"]',
      alignX: 0.42,
      alignY: 0.55,
    },
    run: () => {},
  });

  frames.push({
    step: 'char',
    delayMs: 240,
    cursor: {
      visible: true,
      targetSelector: '[data-tour-target="char-item-deg"]',
      alignX: 0.42,
      alignY: 0.55,
      click: true,
    },
    run: () => {},
  });

  frames.push({
    step: 'char',
    delayMs: 680,
    cursor: {
      visible: true,
      targetSelector: '[data-tour-row="t-10"]',
      alignX: 0.45,
      alignY: 0.55,
    },
    run: (app) => {
      app.closeCharPickerForTour();
      app.setTourRows(cloneRows(CHAR_FINISHED_ROWS), null);
    },
  });

  // --- STEP 4: /help SYNTAX REFERENCE (CURSOR CLICKS /help BUTTON) ---
  stepStartIndex.help = frames.length;
  frames.push({
    step: 'help',
    delayMs: 560,
    cursor: {
      visible: true,
      targetSelector: '[data-tour-target="help-btn"]',
      alignX: 0.5,
      alignY: 0.55,
      offsetX: 0,
      offsetY: 0,
    },
    run: (app) => {
      app.closeCharPickerForTour();
      app.closeHelpForTour();
      app.setFlippedForTour(false);
      app.setTourRows(cloneRows(FINAL_TOUR_ROWS), null);
    },
  });

  // Click `/help` button -> opens inline syntax reference
  frames.push({
    step: 'help',
    delayMs: 250,
    cursor: {
      visible: true,
      targetSelector: '[data-tour-target="help-btn"]',
      alignX: 0.5,
      alignY: 0.55,
      click: true,
    },
    run: () => {},
  });

  frames.push({
    step: 'help',
    delayMs: 420,
    cursor: {
      visible: true,
      targetSelector: '[data-tour-target="help-topic-currency"]',
      alignX: 0.5,
      alignY: 0.55,
      bumpTopLayer: true,
    },
    run: (app) => {
      app.openHelpForTour();
      app.setHelpFilterForTour('', []);
    },
  });

  // Click `Currencies` topic chip
  frames.push({
    step: 'help',
    delayMs: 240,
    cursor: {
      visible: true,
      targetSelector: '[data-tour-target="help-topic-currency"]',
      alignX: 0.5,
      alignY: 0.55,
      click: true,
    },
    run: (app) => app.setHelpFilterForTour('', ['currency']),
  });

  // Glide to `/help` search input and type `sek`
  frames.push({
    step: 'help',
    delayMs: 360,
    cursor: {
      visible: true,
      targetSelector: '[data-tour-target="help-search"]',
      alignX: 0.35,
      alignY: 0.55,
    },
    run: () => {},
  });

  frames.push({
    step: 'help',
    delayMs: 180,
    cursor: {
      visible: true,
      targetSelector: '[data-tour-target="help-search"]',
      alignX: 0.35,
      alignY: 0.55,
      click: true,
    },
    run: () => {},
  });

  for (const q of ['s', 'se', 'sek']) {
    frames.push({
      step: 'help',
      delayMs: q === 'sek' ? 920 : 90,
      run: (app) => app.setHelpFilterForTour(q, ['currency']),
    });
  }

  // Glide to `×` close button and click it
  frames.push({
    step: 'help',
    delayMs: 400,
    cursor: {
      visible: true,
      targetSelector: '[data-tour-target="help-close"]',
      alignX: 0.5,
      alignY: 0.55,
    },
    run: () => {},
  });

  frames.push({
    step: 'help',
    delayMs: 220,
    cursor: {
      visible: true,
      targetSelector: '[data-tour-target="help-close"]',
      alignX: 0.5,
      alignY: 0.55,
      click: true,
    },
    run: () => {},
  });

  frames.push({
    step: 'help',
    delayMs: 320,
    run: (app) => app.closeHelpForTour(),
  });

  // --- STEP 5: SETTINGS (CURSOR CLICKS GEAR ICON -> 180° 3D FLIP) ---
  stepStartIndex.settings = frames.length;
  frames.push({
    step: 'settings',
    delayMs: 520,
    cursor: {
      visible: true,
      targetSelector: '[data-tour-target="settings-btn"]',
      alignX: 0.5,
      alignY: 0.55,
      offsetX: 0,
      offsetY: 0,
    },
    run: (app) => {
      app.closeCharPickerForTour();
      app.closeHelpForTour();
      app.setFlippedForTour(false);
      app.setTourRows(cloneRows(FINAL_TOUR_ROWS), null);
    },
  });

  // Click gear icon -> flips 180° to Settings back-face
  frames.push({
    step: 'settings',
    delayMs: 260,
    cursor: {
      visible: true,
      targetSelector: '[data-tour-target="settings-btn"]',
      alignX: 0.5,
      alignY: 0.55,
      click: true,
    },
    run: () => {},
  });

  frames.push({
    step: 'settings',
    delayMs: 720,
    cursor: {
      visible: true,
      targetSelector: '[data-tour-target="settings-theme-group"]',
      alignX: 0.5,
      alignY: 0.7,
    },
    run: (app) => app.setFlippedForTour(true),
  });

  // Pause so visitor sees Theme, Decimals, Auto-Delete (7d/30d/90d), and Archived Sheets
  frames.push({
    step: 'settings',
    delayMs: 1350,
    cursor: {
      visible: true,
      targetSelector: '[data-tour-target="settings-theme-group"]',
      alignX: 0.5,
      alignY: 0.7,
    },
    run: () => {},
  });

  // Glide cursor up to `← Back` and click it to rotate 180° back to sheet
  frames.push({
    step: 'settings',
    delayMs: 460,
    cursor: {
      visible: true,
      targetSelector: '[data-tour-target="settings-back"]',
      alignX: 0.5,
      alignY: 0.55,
    },
    run: () => {},
  });

  frames.push({
    step: 'settings',
    delayMs: 240,
    cursor: {
      visible: true,
      targetSelector: '[data-tour-target="settings-back"]',
      alignX: 0.5,
      alignY: 0.55,
      click: true,
    },
    run: () => {},
  });

  frames.push({
    step: 'settings',
    delayMs: 650,
    cursor: {
      visible: false,
      targetSelector: null,
    },
    run: (app) => {
      app.setFlippedForTour(false);
      app.setTourTypingRowId(null);
    },
  });

  return { frames, stepStartIndex };
}

const INITIAL_CURSOR_STATE: TourCursorState = {
  visible: false,
  targetSelector: null,
  alignX: 0.5,
  alignY: 0.55,
  offsetX: 0,
  offsetY: 0,
  clicking: false,
  clickSeq: 0,
  topLayerBumpSeq: 0,
};

export interface LiveTutorialController {
  activeStep: TourStepId;
  isPlaying: boolean;
  isFinished: boolean;
  hasVisitorDataOnMount: boolean;
  cursor: TourCursorState;
  togglePlayPause: () => void;
  replayFromStart: () => void;
  jumpToStep: (step: TourStepId) => void;
  yieldToVisitor: () => void;
}

export function useLiveTutorial(
  appRef: RefObject<AppHandle | null>,
  suppressAutoStart = false
): LiveTutorialController {
  const { frames, stepStartIndex } = useMemo(buildTutorialTimeline, []);

  const [hasVisitorDataOnMount] = useState<boolean>(() => hasSavedVisitorData());
  const [prefersReducedMotion] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  const shouldAutoStart = !suppressAutoStart && !hasVisitorDataOnMount && !prefersReducedMotion;

  const [activeStep, setActiveStep] = useState<TourStepId>('math');
  const [isPlaying, setIsPlaying] = useState<boolean>(shouldAutoStart);
  const [isFinished, setIsFinished] = useState<boolean>(hasVisitorDataOnMount);
  const [runEpoch, setRunEpoch] = useState<number>(0);
  const [cursor, setCursor] = useState<TourCursorState>(INITIAL_CURSOR_STATE);

  const frameIdxRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const clickResetTimerRef = useRef<number | null>(null);
  const useDedicatedTabRef = useRef<boolean>(hasVisitorDataOnMount);
  const sheetPreparedRef = useRef<boolean>(false);

  const clearScheduledFrame = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (clickResetTimerRef.current !== null) {
      window.clearTimeout(clickResetTimerRef.current);
      clickResetTimerRef.current = null;
    }
  }, []);

  const hideCursorAndCaret = useCallback(() => {
    setCursor((prev) => ({ ...prev, visible: false, clicking: false }));
    appRef.current?.setTourTypingRowId(null);
  }, [appRef]);

  useEffect(() => {
    if (!isPlaying) {
      clearScheduledFrame();
      hideCursorAndCaret();
      return;
    }

    const tick = () => {
      const app = appRef.current;
      if (!app) {
        timerRef.current = window.setTimeout(tick, 120);
        return;
      }

      if (!sheetPreparedRef.current) {
        sheetPreparedRef.current = true;
        app.prepareTourSheet([{ id: 't-1', text: '# ' }], useDedicatedTabRef.current);
      }

      const idx = frameIdxRef.current;
      if (idx >= frames.length) {
        setIsPlaying(false);
        setIsFinished(true);
        hideCursorAndCaret();
        markTourCompleted();
        return;
      }

      const frame = frames[idx];
      setActiveStep(frame.step);

      frame.run(app);

      if (frame.cursor) {
        const patch = frame.cursor;
        setCursor((prev) => ({
          visible: patch.visible ?? prev.visible,
          targetSelector:
            patch.targetSelector !== undefined ? patch.targetSelector : prev.targetSelector,
          alignX: patch.alignX ?? prev.alignX,
          alignY: patch.alignY ?? prev.alignY,
          offsetX: patch.offsetX !== undefined ? patch.offsetX : prev.offsetX,
          offsetY: patch.offsetY !== undefined ? patch.offsetY : prev.offsetY,
          clicking: Boolean(patch.click),
          clickSeq: patch.click ? prev.clickSeq + 1 : prev.clickSeq,
          topLayerBumpSeq: patch.bumpTopLayer
            ? prev.topLayerBumpSeq + 1
            : prev.topLayerBumpSeq,
        }));

        if (patch.click) {
          if (clickResetTimerRef.current !== null) {
            window.clearTimeout(clickResetTimerRef.current);
          }
          clickResetTimerRef.current = window.setTimeout(() => {
            setCursor((prev) => ({ ...prev, clicking: false }));
          }, 210);
        }
      }

      frameIdxRef.current = idx + 1;
      timerRef.current = window.setTimeout(tick, frame.delayMs);
    };

    const initialDelay = frameIdxRef.current === 0 ? 480 : 60;
    timerRef.current = window.setTimeout(tick, initialDelay);

    return clearScheduledFrame;
  }, [isPlaying, runEpoch, appRef, frames, clearScheduledFrame, hideCursorAndCaret]);

  const yieldToVisitor = useCallback(() => {
    clearScheduledFrame();
    hideCursorAndCaret();
    setIsPlaying((prev) => {
      if (prev) {
        useDedicatedTabRef.current = true;
      }
      return false;
    });
    useDedicatedTabRef.current = true;
  }, [clearScheduledFrame, hideCursorAndCaret]);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      clearScheduledFrame();
      hideCursorAndCaret();
      setIsPlaying(false);
      return;
    }
    if (frameIdxRef.current >= frames.length || isFinished) {
      frameIdxRef.current = 0;
      sheetPreparedRef.current = false;
      setIsFinished(false);
    }
    setIsPlaying(true);
  }, [isPlaying, isFinished, frames.length, clearScheduledFrame, hideCursorAndCaret]);

  const replayFromStart = useCallback(() => {
    clearScheduledFrame();
    frameIdxRef.current = 0;
    sheetPreparedRef.current = false;
    setIsFinished(false);
    setActiveStep('math');
    setRunEpoch((n) => n + 1);
    setIsPlaying(true);
  }, [clearScheduledFrame]);

  const jumpToStep = useCallback(
    (step: TourStepId) => {
      clearScheduledFrame();
      const app = appRef.current;
      if (app && !sheetPreparedRef.current) {
        sheetPreparedRef.current = true;
        app.prepareTourSheet([{ id: 't-1', text: '# ' }], useDedicatedTabRef.current);
      }
      frameIdxRef.current = stepStartIndex[step];
      setIsFinished(false);
      setActiveStep(step);
      setRunEpoch((n) => n + 1);
      setIsPlaying(true);
    },
    [appRef, stepStartIndex, clearScheduledFrame]
  );

  return {
    activeStep,
    isPlaying,
    isFinished,
    hasVisitorDataOnMount,
    cursor,
    togglePlayPause,
    replayFromStart,
    jumpToStep,
    yieldToVisitor,
  };
}
