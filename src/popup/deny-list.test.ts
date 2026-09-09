import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSettingsStore } from '../integration/settings-storage';
import { addDeniedHost, removeDeniedHost } from './deny-list';

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

// `integration/browser-api` resolves the namespace when it is first evaluated,
// which happens on import — before any beforeEach — so the global has to exist
// by then; each test then gets fresh storage swapped into it.
const chrome = vi.hoisted(() => {
  const stub = { storage: {} };
  (globalThis as unknown as { chrome: typeof stub }).chrome = stub;
  return stub;
});

beforeEach(() => {
  chrome.storage = fakeStorageArea();
});

describe('deny-list writes', () => {
  it('removes each host when removals are applied in turn', async () => {
    const store = createSettingsStore();
    await store.save({ deniedHosts: ['a.com', 'b.com', 'c.com'] });

    await removeDeniedHost(store, 'a.com');
    await removeDeniedHost(store, 'b.com');

    expect((await store.load()).deniedHosts).toEqual(['c.com']);
  });

  it('adds a host without duplicating one already listed', async () => {
    const store = createSettingsStore();
    await store.save({ deniedHosts: ['a.com'] });

    await addDeniedHost(store, 'b.com');
    await addDeniedHost(store, 'a.com');

    expect((await store.load()).deniedHosts).toEqual(['a.com', 'b.com']);
  });

  it('loses a removal when both writes start from the same snapshot', async () => {
    const store = createSettingsStore();
    await store.save({ deniedHosts: ['a.com', 'b.com', 'c.com'] });

    // The old behavior, kept as an executable record of what the helpers prevent.
    const stale = await store.load();
    await store.save({ deniedHosts: stale.deniedHosts.filter((h) => h !== 'a.com') });
    await store.save({ deniedHosts: stale.deniedHosts.filter((h) => h !== 'b.com') });

    expect((await store.load()).deniedHosts).toEqual(['a.com', 'c.com']);
  });
});
