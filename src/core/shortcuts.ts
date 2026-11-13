// Pure shortcut validation, matching and labels shared by the popup and bar.
export interface Shortcut {
  code: string;
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

export interface Shortcuts {
  toggle: Shortcut;
  edit: Shortcut;
}

interface KeyStroke extends Shortcut {
  isComposing?: boolean;
  getModifierState?(key: string): boolean;
}

export const DEFAULT_SHORTCUTS: Shortcuts = {
  toggle: { code: 'KeyL', altKey: true, ctrlKey: false, shiftKey: false, metaKey: false },
  edit: { code: 'KeyL', altKey: true, ctrlKey: false, shiftKey: true, metaKey: false },
};

function isShortcut(value: unknown): value is Shortcut {
  if (!value || typeof value !== 'object') return false;
  const key = value as Partial<Shortcut>;
  return typeof key.code === 'string' && /^(Key[A-Z]|Digit[0-9]|F([1-9]|1[0-2]))$/.test(key.code)
    && typeof key.altKey === 'boolean' && typeof key.ctrlKey === 'boolean'
    && typeof key.shiftKey === 'boolean' && typeof key.metaKey === 'boolean'
    && (key.altKey || key.ctrlKey || key.metaKey);
}

export function shortcutFromEvent(event: KeyStroke): Shortcut | null {
  if (event.isComposing || event.getModifierState?.('AltGraph') || !isShortcut(event)) return null;
  const { code, altKey, ctrlKey, shiftKey, metaKey } = event;
  return { code, altKey, ctrlKey, shiftKey, metaKey };
}

export function sameShortcut(a: Shortcut, b: Shortcut): boolean {
  return a.code === b.code && a.altKey === b.altKey && a.ctrlKey === b.ctrlKey
    && a.shiftKey === b.shiftKey && a.metaKey === b.metaKey;
}

export function matchesShortcut(event: KeyStroke, shortcut: Shortcut): boolean {
  const key = shortcutFromEvent(event);
  return key !== null && sameShortcut(key, shortcut);
}

export function parseShortcuts(value: unknown): Shortcuts {
  const raw = value && typeof value === 'object' ? value as Partial<Shortcuts> : {};
  const toggle = isShortcut(raw.toggle) ? raw.toggle : DEFAULT_SHORTCUTS.toggle;
  const edit = isShortcut(raw.edit) ? raw.edit : DEFAULT_SHORTCUTS.edit;
  if (sameShortcut(toggle, edit)) return parseShortcuts(undefined);
  return { toggle: { ...toggle }, edit: { ...edit } };
}

export function formatShortcut(shortcut: Shortcut, mac: boolean): string {
  const keys = [
    shortcut.ctrlKey ? (mac ? '⌃' : 'Ctrl') : '',
    shortcut.altKey ? (mac ? '⌥' : 'Alt') : '',
    shortcut.shiftKey ? (mac ? '⇧' : 'Shift') : '',
    shortcut.metaKey ? (mac ? '⌘' : 'Meta') : '',
    shortcut.code.replace(/^(Key|Digit)/, ''),
  ];
  return keys.filter(Boolean).join(mac ? '' : '+');
}
