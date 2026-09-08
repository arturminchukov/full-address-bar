// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderBar, type BarCallbacks } from './bar';

function setup(overrides: Partial<BarCallbacks> = {}) {
  const calls = { copy: 0, navigate: [] as string[], hide: 0 };
  const bar = renderBar({
    onCopy: () => {
      calls.copy += 1;
    },
    onNavigate: (value) => {
      calls.navigate.push(value);
    },
    onHide: () => {
      calls.hide += 1;
    },
    ...overrides,
  });
  document.body.append(bar.element);
  bar.setUrl('https://example.com/путь', 'https://example.com/%D0%BF%D1%83%D1%82%D1%8C');

  const text = bar.element.querySelector('.fab-url') as HTMLElement;
  const input = bar.element.querySelector('.fab-input') as HTMLInputElement;
  const close = bar.element.querySelector('.fab-close') as HTMLButtonElement;
  return { bar, calls, text, input, close };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('renderBar', () => {
  it('shows the decoded URL and hides the input initially', () => {
    const { text, input } = setup();
    expect(text.textContent).toBe('https://example.com/путь');
    expect(input.hidden).toBe(true);
    expect(text.hidden).toBe(false);
  });

  it('copies on a single click, after the double-click window', () => {
    const { text, calls } = setup();
    text.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(calls.copy).toBe(0);
    vi.advanceTimersByTime(250);
    expect(calls.copy).toBe(1);
  });

  it('does not copy when the click becomes a double click', () => {
    const { text, calls, input } = setup();
    text.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    text.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    vi.advanceTimersByTime(250);
    expect(calls.copy).toBe(0);
    expect(input.hidden).toBe(false);
  });

  it('opens edit mode prefilled with the raw URL', () => {
    const { text, input } = setup();
    text.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(input.hidden).toBe(false);
    expect(input.value).toBe('https://example.com/%D0%BF%D1%83%D1%82%D1%8C');
  });

  it('navigates on Enter with the entered value', () => {
    const { text, input, calls } = setup();
    text.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    input.value = 'https://other.test/x';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(calls.navigate).toEqual(['https://other.test/x']);
  });

  it('does not navigate on Enter with an empty value', () => {
    const { text, input, calls } = setup();
    text.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    input.value = '   ';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(calls.navigate).toEqual([]);
  });

  it('reverts to display mode on Escape', () => {
    const { text, input, calls } = setup();
    text.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    input.value = 'typed but abandoned';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(input.hidden).toBe(true);
    expect(text.hidden).toBe(false);
    expect(calls.navigate).toEqual([]);
  });

  it('reverts to display mode on blur', () => {
    const { text, input } = setup();
    text.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    input.dispatchEvent(new FocusEvent('blur'));
    expect(input.hidden).toBe(true);
    expect(text.hidden).toBe(false);
  });

  it('does not overwrite the input while the user is editing', () => {
    const { bar, text, input } = setup();
    text.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    input.value = 'half-typed';
    bar.setUrl('https://later.test/', 'https://later.test/');
    expect(input.value).toBe('half-typed');
  });

  it('reports the close button', () => {
    const { close, calls } = setup();
    close.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(calls.hide).toBe(1);
  });

  it('cancels a pending copy when the bar is closed', () => {
    const { text, close, calls } = setup();
    text.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    close.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    vi.advanceTimersByTime(250);
    expect(calls.hide).toBe(1);
    expect(calls.copy).toBe(0);
  });

  it('shows a transient hint', () => {
    const { bar } = setup();
    const hint = bar.element.querySelector('.fab-hint') as HTMLElement;
    bar.showHint('Copied');
    expect(hint.textContent).toBe('Copied');
    expect(hint.hidden).toBe(false);
    vi.advanceTimersByTime(1500);
    expect(hint.hidden).toBe(true);
  });

  it('applies the theme as a data attribute', () => {
    const { bar } = setup();
    bar.setTheme('dark');
    expect(bar.element.dataset.theme).toBe('dark');
  });
});
