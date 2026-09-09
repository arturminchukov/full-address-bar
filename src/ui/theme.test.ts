// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveTheme } from './theme';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubPrefersDark(matches: boolean) {
  const query = vi.fn(() => ({ matches }));
  vi.stubGlobal('matchMedia', query);
  return query;
}

describe('resolveTheme', () => {
  it('passes an explicit theme through', () => {
    stubPrefersDark(true);
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('follows the OS preference for auto', () => {
    const dark = stubPrefersDark(true);
    expect(resolveTheme('auto')).toBe('dark');
    // The stub ignores its argument, so assert the query we actually asked for.
    expect(dark).toHaveBeenCalledWith('(prefers-color-scheme: dark)');

    const light = stubPrefersDark(false);
    expect(resolveTheme('auto')).toBe('light');
    expect(light).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
  });

  it('falls back to light when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(resolveTheme('auto')).toBe('light');
  });
});
