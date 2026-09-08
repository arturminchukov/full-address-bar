// Deny-list writes, kept out of popup.ts so they can be tested: popup.ts runs
// its side effects on import and needs document and chrome.tabs to exist.
// Every write re-reads the stored value first, because the popup can issue a
// second write before the previous refresh lands, and computing from a stale
// snapshot would silently undo it.

import type { SettingsStore } from '../integration/settings-storage';

export async function removeDeniedHost(store: SettingsStore, host: string): Promise<void> {
  const current = await store.load();
  await store.save({ deniedHosts: current.deniedHosts.filter((h) => h !== host) });
}

export async function addDeniedHost(store: SettingsStore, host: string): Promise<void> {
  const current = await store.load();
  if (current.deniedHosts.includes(host)) return;
  await store.save({ deniedHosts: [...current.deniedHosts, host] });
}
