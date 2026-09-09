import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type Settings } from '../core/settings';

type Changes = Record<string, { newValue?: unknown; oldValue?: unknown }>;
type Listener = (changes: Changes, areaName: string) => void;

// Minimal stand-in for chrome.storage: get/set plus a driveable onChanged.
function fakeStorage(initial: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = { ...initial };
  const listeners: Listener[] = [];
  return {
    data,
    emit(changes: Changes, areaName: string) {
      for (const listener of [...listeners]) listener(changes, areaName);
    },
    listenerCount: () => listeners.length,
    api: {
      storage: {
        local: {
          get: vi.fn(async (key: string) => ({ [key]: data[key] })),
          set: vi.fn(async (items: Record<string, unknown>) => {
            Object.assign(data, items);
          }),
        },
        onChanged: {
          addListener: (listener: Listener) => {
            listeners.push(listener);
          },
          removeListener: (listener: Listener) => {
            const at = listeners.indexOf(listener);
            if (at !== -1) listeners.splice(at, 1);
          },
        },
      },
    },
  };
}

// `browser-api` resolves the namespace when the module is first evaluated, so
// every case has to stub the globals and then import the module fresh.
async function loadStore(globals: { chrome?: unknown; browser?: unknown }) {
  vi.resetModules();
  vi.stubGlobal('chrome', globals.chrome);
  vi.stubGlobal('browser', globals.browser);
  const mod = await import('./settings-storage');
  return { store: mod.createSettingsStore(), key: mod.SETTINGS_KEY };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('createSettingsStore', () => {
  it('falls back to defaults when there is no extension API at all', async () => {
    const { store } = await loadStore({});
    expect(await store.load()).toEqual(DEFAULT_SETTINGS);
  });

  it('falls back to defaults for a corrupted stored value', async () => {
    const storage = fakeStorage({ 'fab-settings': 'not an object' });
    const { store } = await loadStore({ chrome: storage.api });
    expect(await store.load()).toEqual(DEFAULT_SETTINGS);
  });

  it('merges a patch over the stored value instead of replacing it', async () => {
    const storage = fakeStorage();
    const { store, key } = await loadStore({ chrome: storage.api });

    await store.save({ deniedHosts: ['a.com'], theme: 'dark' });
    await store.save({ enabled: false });

    expect(storage.data[key]).toEqual({
      enabled: false,
      theme: 'dark',
      position: 'top',
      autoHide: false,
      deniedHosts: ['a.com'],
    });
    expect(await store.load()).toEqual({
      enabled: false,
      theme: 'dark',
      position: 'top',
      autoHide: false,
      deniedHosts: ['a.com'],
    });
  });

  it('reports a local change and ignores other areas', async () => {
    const storage = fakeStorage();
    const { store, key } = await loadStore({ chrome: storage.api });

    const seen: Settings[] = [];
    const unsubscribe = store.subscribe((settings) => seen.push(settings));

    storage.emit({ [key]: { newValue: { enabled: false } } }, 'sync');
    expect(seen).toEqual([]);

    storage.emit({ [key]: { newValue: { enabled: false } } }, 'local');
    expect(seen).toEqual([{ ...DEFAULT_SETTINGS, enabled: false }]);

    storage.emit({ 'other-key': { newValue: 1 } }, 'local');
    expect(seen).toHaveLength(1);

    unsubscribe();
    expect(storage.listenerCount()).toBe(0);
  });

  // Regression: Firefox's `chrome` alias is callback-flavoured, so awaiting it
  // yields undefined and every read silently returns defaults. `browser` wins.
  it('prefers browser over chrome when both are present', async () => {
    const browser = fakeStorage({
      'fab-settings': { enabled: true, theme: 'dark', deniedHosts: ['from-browser.test'] },
    });
    const chrome = fakeStorage({
      'fab-settings': { enabled: true, theme: 'light', deniedHosts: ['from-chrome.test'] },
    });

    const { store } = await loadStore({ chrome: chrome.api, browser: browser.api });

    expect((await store.load()).deniedHosts).toEqual(['from-browser.test']);
    expect(browser.api.storage.local.get).toHaveBeenCalled();
    expect(chrome.api.storage.local.get).not.toHaveBeenCalled();
  });
});
