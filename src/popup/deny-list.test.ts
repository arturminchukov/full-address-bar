import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSettingsStore } from '../integration/settings-storage';

// Minimal stand-in for chrome.storage: enough for the store's get/set.
function fakeStorageArea() {
  const data: Record<string, unknown> = {};
  return {
    local: {
      get: vi.fn(async (key: string) => ({ [key]: data[key] })),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(data, items);
      }),
    },
  };
}

beforeEach(() => {
  vi.stubGlobal('chrome', { storage: fakeStorageArea() });
});

describe('deny-list writes', () => {
  it('keeps both hosts when two removals are computed from fresh state', async () => {
    const store = createSettingsStore();
    await store.save({ deniedHosts: ['a.com', 'b.com', 'c.com'] });

    // What the popup does: re-read, then write, for each removal in turn.
    for (const host of ['a.com', 'b.com']) {
      const current = await store.load();
      await store.save({ deniedHosts: current.deniedHosts.filter((h) => h !== host) });
    }

    expect((await store.load()).deniedHosts).toEqual(['c.com']);
  });

  it('loses a removal when both writes start from the same snapshot', async () => {
    const store = createSettingsStore();
    await store.save({ deniedHosts: ['a.com', 'b.com', 'c.com'] });

    // The old behavior, kept as an executable record of what the fix prevents.
    const stale = await store.load();
    await store.save({ deniedHosts: stale.deniedHosts.filter((h) => h !== 'a.com') });
    await store.save({ deniedHosts: stale.deniedHosts.filter((h) => h !== 'b.com') });

    expect((await store.load()).deniedHosts).toEqual(['a.com', 'c.com']);
  });
});
