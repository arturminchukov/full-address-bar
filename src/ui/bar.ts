// Builds the bar DOM and wires its interactions. Knows nothing about storage,
// the page, or navigation: every effect goes out through a callback.

import type { Theme } from '../core/settings';
import { el } from './dom';

/** Bar height in px. The page shift must match this exactly. */
export const BAR_HEIGHT = 28;

// A single click copies; a double click edits. The copy waits out this window
// so a double click can cancel it.
const CLICK_DELAY_MS = 250;
const HINT_MS = 1500;

export interface BarCallbacks {
  onCopy(): void;
  onNavigate(value: string): void;
  onHide(): void;
}

export interface BarHandle {
  element: HTMLElement;
  /** `display` is shown; `raw` prefills the edit field. */
  setUrl(display: string, raw: string): void;
  showHint(text: string): void;
  setTheme(theme: Exclude<Theme, 'auto'>): void;
}

export function renderBar(callbacks: BarCallbacks): BarHandle {
  const text = el('span', {
    class: 'fab-url',
    title: 'Click to copy · double-click to edit',
  });
  const input = el('input', {
    class: 'fab-input',
    type: 'text',
    spellcheck: 'false',
    'aria-label': 'Edit address',
    hidden: true,
  }) as HTMLInputElement;
  const hint = el('span', { class: 'fab-hint', hidden: true });
  const close = el('button', {
    class: 'fab-close',
    type: 'button',
    title: 'Hide the bar on this page',
    'aria-label': 'Hide the bar on this page',
    text: '✕',
  }) as HTMLButtonElement;

  const bar = el('div', { class: 'fab-bar', role: 'toolbar' }, [text, input, hint, close]);

  let raw = '';
  let editing = false;
  let clickTimer: ReturnType<typeof setTimeout> | undefined;
  let hintTimer: ReturnType<typeof setTimeout> | undefined;

  const stopEditing = () => {
    editing = false;
    input.hidden = true;
    text.hidden = false;
  };

  const startEditing = () => {
    editing = true;
    input.value = raw;
    text.hidden = true;
    input.hidden = false;
    input.focus();
    input.select();
  };

  text.addEventListener('click', () => {
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => callbacks.onCopy(), CLICK_DELAY_MS);
  });

  text.addEventListener('dblclick', () => {
    clearTimeout(clickTimer);
    startEditing();
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      const value = input.value.trim();
      if (!value) return;
      stopEditing();
      callbacks.onNavigate(value);
    } else if (event.key === 'Escape') {
      stopEditing();
    }
  });

  input.addEventListener('blur', stopEditing);

  close.addEventListener('click', () => callbacks.onHide());

  return {
    element: bar,
    setUrl(display, rawUrl) {
      raw = rawUrl;
      text.textContent = display;
      // Never clobber a half-typed address under the user's cursor.
      if (!editing) input.value = rawUrl;
    },
    showHint(message) {
      clearTimeout(hintTimer);
      hint.textContent = message;
      hint.hidden = false;
      hintTimer = setTimeout(() => {
        hint.hidden = true;
      }, HINT_MS);
    },
    setTheme(theme) {
      bar.dataset.theme = theme;
    },
  };
}
