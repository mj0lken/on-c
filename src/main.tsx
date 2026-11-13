import React from 'react';
import ReactDOM from 'react-dom/client';
import { RootShell } from './RootShell';
import './styles/app.css';
import './styles/landing.css';

// Per modern-web-guidance `interest-triggered-tooltips`: wire ARIA + `popover="hint"` fallback before loading polyfills
const ownedHintTriggers = new WeakSet<Element>();

function wireInterestHints() {
  if (typeof document === 'undefined') return;
  for (const trigger of document.querySelectorAll<HTMLElement>('[interestfor]')) {
    const id = trigger.getAttribute('interestfor');
    if (!id) continue;
    const hint = document.getElementById(id);
    if (!hint || hint.getAttribute('popover') !== 'hint') continue;

    const triggerName = (
      trigger.getAttribute('aria-label') ??
      trigger.textContent ??
      trigger.getAttribute('title') ??
      ''
    )
      .replace(/\s+/g, ' ')
      .trim();
    const hintText = (hint.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (triggerName && triggerName === hintText) continue;

    if (!hint.hasAttribute('role')) {
      hint.setAttribute('role', 'tooltip');
    }

    if (!triggerName && !trigger.hasAttribute('aria-labelledby')) {
      trigger.setAttribute('aria-labelledby', id);
    } else if (trigger.getAttribute('popovertarget') === id) {
      if (!trigger.hasAttribute('aria-expanded') || ownedHintTriggers.has(trigger)) {
        const isOpen = hint.matches(':popover-open');
        trigger.setAttribute('aria-expanded', String(isOpen));
        ownedHintTriggers.add(trigger);
      }
    } else if (!trigger.hasAttribute('aria-describedby')) {
      trigger.setAttribute('aria-describedby', id);
    }
  }
}

if (typeof document !== 'undefined') {
  (window as unknown as { __wireInterestHints?: () => void }).__wireInterestHints =
    wireInterestHints;

  // Capture-phase `toggle` listener to keep `aria-expanded` synced
  document.addEventListener(
    'toggle',
    (ev) => {
      const target = ev.target;
      if (!(target instanceof HTMLElement) || !target.id) return;
      const open = target.matches(':popover-open');
      for (const trig of document.querySelectorAll(
        `[interestfor="${CSS.escape(target.id)}"]`
      )) {
        if (ownedHintTriggers.has(trig)) {
          trig.setAttribute('aria-expanded', String(open));
        }
      }
    },
    true
  );

  // Fallback where `popover="hint"` resolves to `"manual"` so click-opened toggletips still light-dismiss
  const probe = document.createElement('div');
  probe.setAttribute('popover', 'hint');
  if ((probe as HTMLElement & { popover?: string }).popover !== 'hint') {
    document.addEventListener(
      'beforetoggle',
      (ev) => {
        const toggleEv = ev as ToggleEvent;
        const target = toggleEv.target;
        if (!(target instanceof HTMLElement) || !target.id) return;
        const isToggletip =
          target.getAttribute('popover') === 'hint' &&
          document.querySelector(`[popovertarget="${CSS.escape(target.id)}"]`);
        if (toggleEv.newState === 'open' && isToggletip) {
          target.setAttribute('popover', 'auto');
        }
      },
      true
    );
  }
}

// Per modern-web-guidance `viewport-aware-dropdowns` / `toolbar`: conditionally load popover polyfill only when missing
if (typeof HTMLElement !== 'undefined' && !Object.hasOwn(HTMLElement.prototype, 'popover')) {
  void import('@oddbird/popover-polyfill');
}

// Conditionally load `interestfor` polyfill when native support is missing
if (
  typeof HTMLButtonElement !== 'undefined' &&
  !('interestForElement' in HTMLButtonElement.prototype)
) {
  void import('interestfor');
}

// Per modern-web-guidance `tabs`: conditionally load focusgroup polyfill only when missing
if (typeof HTMLElement !== 'undefined' && !Object.hasOwn(HTMLElement.prototype, 'focusGroup')) {
  void import('@microsoft/focusgroup-polyfill').then((mod) => {
    if (typeof mod.polyfill === 'function') {
      mod.polyfill(document.documentElement);
    }
  });
}

// Per modern-web-guidance `calculate-event-differentials`: conditionally load `temporal-polyfill` before mounting when native `Temporal` is absent
void (async () => {
  if (typeof (globalThis as Record<string, unknown>).Temporal === 'undefined') {
    const mod = await import('temporal-polyfill');
    (globalThis as Record<string, unknown>).Temporal = mod.Temporal;
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <RootShell />
    </React.StrictMode>
  );
})();
