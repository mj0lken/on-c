import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppHandle } from '../App';
import {
  hasSavedVisitorData,
  markTourCompleted,
} from '../engine/storage';
import { SheetRow } from '../types';

export type TourStepId = 'math' | 'currency' | 'char' | 'help' | 'settings';

export interface TourStepMeta {
  id: TourStepId;
  label: string;
  shortHint: string;
}

export const TOUR_STEPS: ReadonlyArray<TourStepMeta> = [
  { id: 'math', label: 'Math & ans', shortHint: 'Headings, expressions & ans chaining' },
  { id: 'currency', label: 'Currency', shortHint: 'Live FX conversion & block sum' },
  { id: 'char', label: '/char', shortHint: 'Searchable math & unit characters' },
  { id: 'help', label: '/help', shortHint: 'Instant searchable syntax reference' },
  { id: 'settings', label: 'Settings', shortHint: '180° flip preferences & 30-day archive' },
];

interface TimelineFrame {
  step: TourStepId;
  delayMs: number;
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
  charDelayMs = 36,
  afterLinePauseMs = 360,
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
      run: (app) => app.setTourRows(snapshot),
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
    delayMs: 320,
    run: (app) => {
      app.closeCharPickerForTour();
      app.closeHelpForTour();
      app.setFlippedForTour(false);
      app.setTourRows([{ id: 't-1', text: '# ' }]);
    },
  });

  let rows = appendTypingFrames(
    frames,
    'math',
    [],
    't-1',
    '# Studio Trip',
    '# ',
    38,
    360
  );
  rows = appendTypingFrames(
    frames,
    'math',
    rows,
    't-2',
    '120 + 45 * 3',
    '',
    34,
    400,
    'ans1'
  );
  rows = appendTypingFrames(
    frames,
    'math',
    rows,
    't-3',
    'ans - 15% // discount',
    '',
    32,
    440
  );
  rows = appendTypingFrames(frames, 'math', rows, 't-4', '---', '', 55, 320);

  // --- STEP 2: CURRENCY ---
  stepStartIndex.currency = frames.length;
  frames.push({
    step: 'currency',
    delayMs: 180,
    run: (app) => {
      app.closeCharPickerForTour();
      app.closeHelpForTour();
      app.setFlippedForTour(false);
      app.setTourRows(cloneRows(MATH_FINISHED_ROWS));
    },
  });

  rows = cloneRows(MATH_FINISHED_ROWS);
  rows = appendTypingFrames(
    frames,
    'currency',
    rows,
    't-5',
    '# Expenses in EUR',
    '',
    28,
    240
  );
  rows = appendTypingFrames(
    frames,
    'currency',
    rows,
    't-6',
    'Flight: $850 in EUR',
    '',
    34,
    400
  );
  rows = appendTypingFrames(
    frames,
    'currency',
    rows,
    't-7',
    'Hotel: 4 200 SEK in EUR',
    '',
    34,
    400
  );
  rows = appendTypingFrames(frames, 'currency', rows, 't-8', 'sum', '', 65, 460);
  rows = appendTypingFrames(frames, 'currency', rows, 't-9', '---', '', 55, 300);

  // --- STEP 3: /char QUICK SYMBOLS ---
  stepStartIndex.char = frames.length;
  frames.push({
    step: 'char',
    delayMs: 180,
    run: (app) => {
      app.closeCharPickerForTour();
      app.closeHelpForTour();
      app.setFlippedForTour(false);
      app.setTourRows(cloneRows(CURRENCY_FINISHED_ROWS));
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
    36,
    240
  );

  // Type `/char` visibly then open the `/char` popover
  const charCmd = '/char';
  for (let i = 1; i <= charCmd.length; i++) {
    const partial = `Ramp angle: sin 30${charCmd.slice(0, i)}`;
    const snap: SheetRow[] = [
      ...cloneRows(CURRENCY_FINISHED_ROWS),
      { id: 't-10', text: partial },
    ];
    frames.push({
      step: 'char',
      delayMs: i === charCmd.length ? 260 : 52,
      run: (app) => app.setTourRows(snap),
    });
  }

  frames.push({
    step: 'char',
    delayMs: 420,
    run: (app) => {
      app.setTourRows([
        ...cloneRows(CURRENCY_FINISHED_ROWS),
        { id: 't-10', text: 'Ramp angle: sin 30' },
      ]);
      app.openCharPickerForTour();
    },
  });

  for (const q of ['d', 'de', 'deg']) {
    frames.push({
      step: 'char',
      delayMs: q === 'deg' ? 880 : 95,
      run: (app) => app.setCharSearchForTour(q),
    });
  }

  frames.push({
    step: 'char',
    delayMs: 700,
    run: (app) => {
      app.closeCharPickerForTour();
      app.setTourRows(cloneRows(CHAR_FINISHED_ROWS));
    },
  });

  // --- STEP 4: /help SYNTAX REFERENCE ---
  stepStartIndex.help = frames.length;
  frames.push({
    step: 'help',
    delayMs: 180,
    run: (app) => {
      app.closeCharPickerForTour();
      app.closeHelpForTour();
      app.setFlippedForTour(false);
      app.setTourRows([...cloneRows(CHAR_FINISHED_ROWS), { id: 't-11', text: '' }]);
    },
  });

  const helpCmd = '/help';
  for (let i = 1; i <= helpCmd.length; i++) {
    const snap: SheetRow[] = [
      ...cloneRows(CHAR_FINISHED_ROWS),
      { id: 't-11', text: helpCmd.slice(0, i) },
    ];
    frames.push({
      step: 'help',
      delayMs: i === helpCmd.length ? 260 : 55,
      run: (app) => app.setTourRows(snap),
    });
  }

  frames.push({
    step: 'help',
    delayMs: 520,
    run: (app) => {
      app.setTourRows(cloneRows(FINAL_TOUR_ROWS));
      app.openHelpForTour();
      app.setHelpFilterForTour('', []);
    },
  });

  frames.push({
    step: 'help',
    delayMs: 560,
    run: (app) => app.setHelpFilterForTour('', ['currency']),
  });

  for (const q of ['s', 'se', 'sek']) {
    frames.push({
      step: 'help',
      delayMs: q === 'sek' ? 1150 : 90,
      run: (app) => app.setHelpFilterForTour(q, ['currency']),
    });
  }

  frames.push({
    step: 'help',
    delayMs: 460,
    run: (app) => app.closeHelpForTour(),
  });

  // --- STEP 5: SETTINGS (180° 3D FLIP) ---
  stepStartIndex.settings = frames.length;
  frames.push({
    step: 'settings',
    delayMs: 220,
    run: (app) => {
      app.closeCharPickerForTour();
      app.closeHelpForTour();
      app.setTourRows(cloneRows(FINAL_TOUR_ROWS));
    },
  });

  frames.push({
    step: 'settings',
    delayMs: 2300,
    run: (app) => app.setFlippedForTour(true),
  });

  frames.push({
    step: 'settings',
    delayMs: 650,
    run: (app) => app.setFlippedForTour(false),
  });

  return { frames, stepStartIndex };
}

export interface LiveTutorialController {
  activeStep: TourStepId;
  isPlaying: boolean;
  isFinished: boolean;
  hasVisitorDataOnMount: boolean;
  togglePlayPause: () => void;
  replayFromStart: () => void;
  jumpToStep: (step: TourStepId) => void;
  yieldToVisitor: () => void;
}

export function useLiveTutorial(appRef: RefObject<AppHandle | null>): LiveTutorialController {
  const { frames, stepStartIndex } = useMemo(buildTutorialTimeline, []);

  const [hasVisitorDataOnMount] = useState<boolean>(() => hasSavedVisitorData());
  const [prefersReducedMotion] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  const shouldAutoStart = !hasVisitorDataOnMount && !prefersReducedMotion;

  const [activeStep, setActiveStep] = useState<TourStepId>('math');
  const [isPlaying, setIsPlaying] = useState<boolean>(shouldAutoStart);
  const [isFinished, setIsFinished] = useState<boolean>(hasVisitorDataOnMount);
  const [runEpoch, setRunEpoch] = useState<number>(0);

  const frameIdxRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const useDedicatedTabRef = useRef<boolean>(hasVisitorDataOnMount);
  const sheetPreparedRef = useRef<boolean>(false);

  const clearScheduledFrame = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      clearScheduledFrame();
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
        markTourCompleted();
        return;
      }

      const frame = frames[idx];
      setActiveStep(frame.step);
      frame.run(app);
      frameIdxRef.current = idx + 1;

      timerRef.current = window.setTimeout(tick, frame.delayMs);
    };

    const initialDelay = frameIdxRef.current === 0 ? 520 : 80;
    timerRef.current = window.setTimeout(tick, initialDelay);

    return clearScheduledFrame;
  }, [isPlaying, runEpoch, appRef, frames, clearScheduledFrame]);

  const yieldToVisitor = useCallback(() => {
    clearScheduledFrame();
    setIsPlaying((prev) => {
      if (prev) {
        useDedicatedTabRef.current = true;
      }
      return false;
    });
    useDedicatedTabRef.current = true;
  }, [clearScheduledFrame]);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      clearScheduledFrame();
      setIsPlaying(false);
      return;
    }
    if (frameIdxRef.current >= frames.length || isFinished) {
      frameIdxRef.current = 0;
      sheetPreparedRef.current = false;
      setIsFinished(false);
    }
    setIsPlaying(true);
  }, [isPlaying, isFinished, frames.length, clearScheduledFrame]);

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
    togglePlayPause,
    replayFromStart,
    jumpToStep,
    yieldToVisitor,
  };
}
