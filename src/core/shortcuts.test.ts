import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SHORTCUTS, formatShortcut, matchesShortcut, parseShortcuts, shortcutFromEvent,
} from './shortcuts';

const altL = { code: 'KeyL', altKey: true, ctrlKey: false, shiftKey: false, metaKey: false };

describe('shortcuts', () => {
  it('records physical keys rather than Option-modified characters', () => {
    expect(shortcutFromEvent(altL)).toEqual(DEFAULT_SHORTCUTS.toggle);
    expect(matchesShortcut(altL, DEFAULT_SHORTCUTS.toggle)).toBe(true);
    expect(matchesShortcut({ ...altL, shiftKey: true }, DEFAULT_SHORTCUTS.toggle)).toBe(false);
    expect(matchesShortcut({ ...altL, shiftKey: true }, DEFAULT_SHORTCUTS.edit)).toBe(true);
  });

  it('requires a modifier and a supported non-modifier key', () => {
    expect(shortcutFromEvent({ ...altL, altKey: false })).toBeNull();
    expect(shortcutFromEvent({ ...altL, altKey: false, shiftKey: true })).toBeNull();
    expect(shortcutFromEvent({ ...altL, code: 'AltLeft' })).toBeNull();
    expect(shortcutFromEvent({ ...altL, code: 'Escape' })).toBeNull();
    expect(shortcutFromEvent({ ...altL, code: 'Digit1' })).not.toBeNull();
  });

  it('does not intercept IME or AltGraph text input', () => {
    expect(matchesShortcut({ ...altL, isComposing: true }, DEFAULT_SHORTCUTS.toggle)).toBe(false);
    expect(shortcutFromEvent({ ...altL, getModifierState: () => true })).toBeNull();
  });

  it('accepts custom bindings and defaults missing or corrupt values', () => {
    const custom = { ...altL, code: 'KeyK', ctrlKey: true, altKey: false };
    expect(parseShortcuts({ toggle: custom }).toggle).toEqual(custom);
    expect(parseShortcuts({ toggle: { code: 'KeyL' } })).toEqual(DEFAULT_SHORTCUTS);
    expect(parseShortcuts(null)).toEqual(DEFAULT_SHORTCUTS);
    expect(parseShortcuts({ edit: { ...altL, altKey: 'yes' } })).toEqual(DEFAULT_SHORTCUTS);
  });

  it('falls back to distinct defaults for duplicate bindings', () => {
    expect(parseShortcuts({ toggle: altL, edit: altL })).toEqual(DEFAULT_SHORTCUTS);
  });

  it('does not share mutable defaults', () => {
    const settings = parseShortcuts(undefined);
    settings.toggle.code = 'KeyX';
    expect(parseShortcuts(undefined).toggle.code).toBe('KeyL');
  });

  it('formats readable platform-specific hints', () => {
    expect(formatShortcut(DEFAULT_SHORTCUTS.toggle, false)).toBe('Alt+L');
    expect(formatShortcut(DEFAULT_SHORTCUTS.edit, true)).toBe('⌥⇧L');
    expect(formatShortcut({ ...altL, altKey: false, ctrlKey: true, code: 'Digit1' }, false)).toBe('Ctrl+1');
  });
});
