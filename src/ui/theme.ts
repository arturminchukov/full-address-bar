// Resolves the stored theme preference to the concrete theme to render.

import type { Theme } from '../core/settings';

export function prefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme !== 'auto') return theme;
  return prefersDark() ? 'dark' : 'light';
}
