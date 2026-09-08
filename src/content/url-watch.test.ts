// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { watchUrl } from './url-watch';

// A minimal stand-in for `window`: the poll reads `location.href` off it and
// the listeners are registered on it, which is all watchUrl uses.
function fakeWindow(href: string) {
  const listeners = new Map<string, () => void>();
  return {
    location: { href },
    addEventListener(type: string, fn: () => void) {
      listeners.set(type, fn);
    },
    removeEventListener(type: string) {
      listeners.delete(type);
    },
    fire(type: string) {
      listeners.get(type)?.();
    },
    has(type: string) {
      return listeners.has(type);
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('watchUrl', () => {
  it('does not report the initial URL', () => {
    const win = fakeWindow('https://a.test/');
    const seen: string[] = [];
    watchUrl(win as unknown as Window, (href) => seen.push(href), 250);
    expect(seen).toEqual([]);
  });

  it('reports a change picked up by polling', () => {
    const win = fakeWindow('https://a.test/');
    const seen: string[] = [];
    watchUrl(win as unknown as Window, (href) => seen.push(href), 250);
    win.location.href = 'https://a.test/next';
    vi.advanceTimersByTime(250);
    expect(seen).toEqual(['https://a.test/next']);
  });

  it('reports at most once per distinct URL', () => {
    const win = fakeWindow('https://a.test/');
    const seen: string[] = [];
    watchUrl(win as unknown as Window, (href) => seen.push(href), 250);
    win.location.href = 'https://a.test/next';
    vi.advanceTimersByTime(1000);
    expect(seen).toEqual(['https://a.test/next']);
  });

  it('reports immediately on popstate and hashchange', () => {
    const win = fakeWindow('https://a.test/');
    const seen: string[] = [];
    watchUrl(win as unknown as Window, (href) => seen.push(href), 250);
    win.location.href = 'https://a.test/#one';
    win.fire('hashchange');
    win.location.href = 'https://a.test/two';
    win.fire('popstate');
    expect(seen).toEqual(['https://a.test/#one', 'https://a.test/two']);
  });

  it('stops polling and unsubscribes when disposed', () => {
    const win = fakeWindow('https://a.test/');
    const seen: string[] = [];
    const stop = watchUrl(win as unknown as Window, (href) => seen.push(href), 250);
    stop();
    win.location.href = 'https://a.test/next';
    vi.advanceTimersByTime(1000);
    expect(seen).toEqual([]);
    expect(win.has('popstate')).toBe(false);
    expect(win.has('hashchange')).toBe(false);
  });
});
