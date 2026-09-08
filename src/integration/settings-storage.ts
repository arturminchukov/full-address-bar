// The single I/O boundary for settings: reads, writes and change
// notifications, all validated through core/settings so a corrupted value can
// never reach the UI. Falls back to defaults when extension storage is
// unavailable (e.g. running the bar on a plain page during development).

import { parseSettings, type Settings } from '../core/settings';

export const SETTINGS_KEY = 'fab-settings';

export interface SettingsStore {
  load(): Promise<Settings>;
  save(patch: Partial<Settings>): Promise<void>;
  /** Subscribe to external changes. Returns an unsubscribe function. */
  subscribe(fn: (settings: Settings) => void): () => void;
}

export function createSettingsStore(): SettingsStore {
  const area = globalThis.chrome?.storage?.local;

  async function load(): Promise<Settings> {
    if (!area) return parseSettings(undefined);
    try {
      const stored = await area.get(SETTINGS_KEY);
      return parseSettings(stored?.[SETTINGS_KEY]);
    } catch {
      return parseSettings(undefined);
    }
  }

  return {
    load,

    async save(patch) {
      if (!area) return;
      const current = await load();
      const next: Settings = { ...current, ...patch };
      await area.set({ [SETTINGS_KEY]: next });
    },

    subscribe(fn) {
      const onChanged = globalThis.chrome?.storage?.onChanged;
      if (!onChanged) return () => undefined;
      const listener = (
        changes: Record<string, chrome.storage.StorageChange>,
        areaName: string,
      ) => {
        if (areaName !== 'local' || !(SETTINGS_KEY in changes)) return;
        fn(parseSettings(changes[SETTINGS_KEY].newValue));
      };
      onChanged.addListener(listener);
      return () => onChanged.removeListener(listener);
    },
  };
}
