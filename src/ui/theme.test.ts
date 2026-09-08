// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveTheme } from './theme';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubPrefersDark(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches })),
  );
}

describe('resolveTheme', () => {
  it('passes an explicit theme through', () => {
    stubPrefersDark(true);
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('follows the OS preference for auto', () => {
    stubPrefersDark(true);
    expect(resolveTheme('auto')).toBe('dark');
    stubPrefersDark(false);
    expect(resolveTheme('auto')).toBe('light');
  });

  it('falls back to light when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(resolveTheme('auto')).toBe('light');
  });
});
