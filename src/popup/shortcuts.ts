// Popup adapter: the shared recorder only sees shortcut values, not storage.
import type { SettingsStore } from '../integration/settings-storage';
import { bindShortcutSettings as bindRecorder } from '../ui/shortcut-settings';

export function bindShortcutSettings(root: Document, store: SettingsStore) {
  return bindRecorder(root, {
    load: async () => (await store.load()).shortcuts,
    save: (shortcuts) => store.save({ shortcuts }),
  }, /Mac|iPhone|iPad/.test(navigator.platform));
}
