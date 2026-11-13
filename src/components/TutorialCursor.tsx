import React, { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { TourCursorState } from '../hooks/useLiveTutorial';

interface TutorialCursorProps {
  cursor: TourCursorState;
  scopeRef: RefObject<HTMLElement | null>;
}

interface Coords {
  x: number;
  y: number;
}

export const TutorialCursor: React.FC<TutorialCursorProps> = ({ cursor, scopeRef }) => {
  const layerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<Coords | null>(null);

  const computeCoords = useCallback(() => {
    if (!cursor.visible || !cursor.targetSelector) return;
    const root = scopeRef.current ?? document;
    const target =
      root.querySelector<HTMLElement>(cursor.targetSelector) ??
      document.querySelector<HTMLElement>(cursor.targetSelector);
    if (!target) return;

    const rect = target.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const x = rect.left + rect.width * cursor.alignX + cursor.offsetX;
    const y = rect.top + rect.height * cursor.alignY + cursor.offsetY;
    setCoords({ x, y });
  }, [
    cursor.visible,
    cursor.targetSelector,
    cursor.alignX,
    cursor.alignY,
    cursor.offsetX,
    cursor.offsetY,
    scopeRef,
  ]);

  // Keep cursor promoted in `#top-layer` via `popover="manual"` so it paints above `/char` popover & `/help` dialog
  useEffect(() => {
    const el = layerRef.current as (HTMLDivElement & {
      showPopover?: () => void;
      hidePopover?: () => void;
    }) | null;
    if (!el || typeof el.showPopover !== 'function') return;

    if (cursor.visible) {
      try {
        if (el.matches(':popover-open')) {
          el.hidePopover?.();
        }
        el.showPopover();
      } catch {
        // Ignore if unsupported
      }
    } else {
      try {
        if (el.matches(':popover-open')) {
          el.hidePopover?.();
        }
      } catch {
        // Ignore
      }
    }
  }, [cursor.visible, cursor.topLayerBumpSeq]);

  // Recompute target coordinates when step target changes, after layout/popover paint, or on scroll/resize
  useEffect(() => {
    computeCoords();
    const raf1 = requestAnimationFrame(() => {
      computeCoords();
      requestAnimationFrame(computeCoords);
    });
    const delayed = window.setTimeout(computeCoords, 120);

    if (!cursor.visible) {
      return () => {
        cancelAnimationFrame(raf1);
        window.clearTimeout(delayed);
      };
    }

    const onViewportChange = () => computeCoords();
    window.addEventListener('scroll', onViewportChange, { passive: true, capture: true });
    window.addEventListener('resize', onViewportChange, { passive: true });
    return () => {
      cancelAnimationFrame(raf1);
      window.clearTimeout(delayed);
      window.removeEventListener('scroll', onViewportChange, { capture: true });
      window.removeEventListener('resize', onViewportChange);
    };
  }, [computeCoords, cursor.visible, cursor.topLayerBumpSeq]);

  // Highlight clicked button briefly right as the tutorial cursor presses down
  useEffect(() => {
    if (!cursor.clicking || !cursor.targetSelector) return;
    const root = scopeRef.current ?? document;
    const target =
      root.querySelector<HTMLElement>(cursor.targetSelector) ??
      document.querySelector<HTMLElement>(cursor.targetSelector);
    if (!target) return;

    target.setAttribute('data-tour-pressed', 'true');
    const timer = window.setTimeout(() => {
      target.removeAttribute('data-tour-pressed');
    }, 220);
    return () => {
      window.clearTimeout(timer);
      target.removeAttribute('data-tour-pressed');
    };
  }, [cursor.clicking, cursor.clickSeq, cursor.targetSelector, scopeRef]);

  const isShown = cursor.visible && coords !== null;

  return (
    <div
      ref={layerRef}
      className="tour-cursor-layer"
      aria-hidden="true"
      {...({ popover: 'manual' } as React.HTMLAttributes<HTMLDivElement>)}
    >
      <div
        className={[
          'tour-cursor-pointer',
          isShown ? 'is-visible' : '',
          cursor.clicking ? 'is-clicking' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={
          coords
            ? ({
                '--tour-x': `${Math.round(coords.x)}px`,
                '--tour-y': `${Math.round(coords.y)}px`,
              } as React.CSSProperties)
            : undefined
        }
      >
        <span key={cursor.clickSeq} className="tour-cursor-ripple" />
        <svg
          className="tour-cursor-svg"
          width="22"
          height="26"
          viewBox="0 0 22 26"
          fill="none"
        >
          <path
            d="M2.2 1.8L18.4 14.2L11.2 15.1L14.8 22.8L11.7 24.2L8.1 16.5L2.6 21.1L2.2 1.8Z"
            fill="#16171a"
            stroke="#ffffff"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
};
