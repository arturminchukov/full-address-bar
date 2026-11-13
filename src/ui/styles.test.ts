// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { STYLES } from './styles';

afterEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
});

it('reserves most of the inline bar for the URL instead of long shortcut hints', () => {
  const style = document.createElement('style');
  style.textContent = STYLES;
  document.head.append(style);
  const bar = document.createElement('div');
  bar.className = 'fab-bar';
  const shortcuts = document.createElement('span');
  shortcuts.className = 'fab-shortcuts';
  const symbol = document.createElement('span');
  symbol.className = 'fab-shortcut-symbol';
  symbol.textContent = '⌥';
  const label = document.createElement('span');
  label.append('Show/hide ', symbol, 'L');
  shortcuts.append(label);
  bar.append(shortcuts);
  document.body.append(bar);
  const budget = getComputedStyle(shortcuts).maxWidth;
  expect(budget.endsWith('%')).toBe(true);
  expect(parseFloat(budget)).toBeGreaterThan(0);
  expect(parseFloat(budget)).toBeLessThanOrEqual(40);
  expect(getComputedStyle(bar).flexWrap).toBe('nowrap');
  expect(getComputedStyle(shortcuts).fontSize).toBe('12px');
  expect(getComputedStyle(symbol).fontSize).toBe('12px');
  expect(getComputedStyle(symbol).fontFamily).toContain('system-ui');
  expect(getComputedStyle(symbol).fontWeight).toBe('600');
});
