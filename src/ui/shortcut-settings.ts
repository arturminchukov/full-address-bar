// Shared shortcut recorder. Callers provide persistence; this module only owns UI.
import {
  formatShortcut, parseShortcuts, sameShortcut, shortcutFromEvent,
  type Shortcut, type Shortcuts,
} from '../core/shortcuts';
import { el } from './dom';

export interface ShortcutSettingsDeps {
  load(): Promise<Shortcuts>;
  save(shortcuts: Shortcuts): Promise<void>;
}

export function bindShortcutSettings(
  root: ParentNode,
  deps: ShortcutSettingsDeps,
  mac: boolean,
) {
  const fields = {
    toggle: root.querySelector<HTMLInputElement>('#shortcut-toggle')!,
    edit: root.querySelector<HTMLInputElement>('#shortcut-edit')!,
  };
  const reset = root.querySelector<HTMLButtonElement>('#shortcut-reset')!;
  const status = root.querySelector<HTMLElement>('#shortcut-status')!;
  let current = parseShortcuts(undefined);
  let recording: keyof Shortcuts | null = null;
  let saving = false;

  function render(shortcuts: Shortcuts): void {
    current = shortcuts;
    for (const action of ['toggle', 'edit'] as const) {
      if (recording !== action) fields[action].value = formatShortcut(shortcuts[action], mac);
    }
  }

  function cancel(): void {
    if (recording) fields[recording].blur();
    status.textContent = '';
  }

  async function save(action?: keyof Shortcuts, shortcut?: Shortcut): Promise<void> {
    if (saving) return;
    saving = true;
    reset.disabled = true;
    status.textContent = '';
    try {
      let next = parseShortcuts(undefined);
      if (action && shortcut) {
        const shortcuts = await deps.load();
        const other = action === 'toggle' ? 'edit' : 'toggle';
        if (sameShortcut(shortcut, shortcuts[other])) {
          status.textContent = 'This shortcut is already assigned to the other action.';
          return;
        }
        next = { ...shortcuts, [action]: shortcut };
      }
      await deps.save(next);
      render(next);
      if (action) fields[action].blur();
      status.textContent = 'Shortcuts saved.';
    } catch {
      render(current);
      status.textContent = 'Could not save shortcuts. Please try again.';
    } finally {
      saving = false;
      reset.disabled = false;
    }
  }

  for (const action of ['toggle', 'edit'] as const) {
    const field = fields[action];
    field.addEventListener('focus', () => {
      recording = action;
      field.value = '';
      status.textContent = 'Press a new shortcut, or Escape to cancel.';
    });
    field.addEventListener('blur', () => {
      if (recording === action) recording = null;
      field.value = formatShortcut(current[action], mac);
    });
    field.addEventListener('keydown', (event) => {
      if (event.key === 'Tab') return;
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') {
        cancel();
        return;
      }
      if (event.repeat || event.isComposing || saving) return;
      if (/^(Alt|Control|Shift|Meta)/.test(event.code)) return;
      const shortcut = shortcutFromEvent(event);
      if (!shortcut) {
        status.textContent = 'Use Ctrl, Alt/Option or Command/Meta with a letter, number or F1–F12.';
        return;
      }
      void save(action, shortcut);
    });
  }
  reset.addEventListener('click', () => { void save(); });
  render(current);
  return { render, cancel, isRecording: () => recording !== null };
}

export function renderShortcutSettings(deps: ShortcutSettingsDeps, mac: boolean) {
  const row = (action: keyof Shortcuts, label: string) => el('div', {
    class: 'fab-shortcut-row',
  }, [
    el('label', { for: `shortcut-${action}`, text: label }),
    el('input', {
      id: `shortcut-${action}`, class: 'fab-shortcut-input', type: 'text', readonly: true,
      placeholder: 'Press shortcut…', 'aria-describedby': 'shortcut-help shortcut-status',
    }),
  ]);
  const element = el('div', {
    class: 'fab-shortcut-settings', role: 'group', 'aria-label': 'Keyboard shortcuts',
  }, [
    el('div', { class: 'fab-menu-group', text: 'Keyboard shortcuts' }),
    row('toggle', 'Show / hide bar'),
    row('edit', 'Edit URL'),
    el('button', {
      id: 'shortcut-reset', class: 'fab-shortcut-reset', type: 'button', text: 'Reset shortcuts',
    }),
    el('p', {
      id: 'shortcut-help', class: 'fab-shortcut-help',
      text: 'Click a field and press a new combination. Browser and system shortcuts may take priority.',
    }),
    el('p', { id: 'shortcut-status', role: 'status', 'aria-live': 'polite' }),
  ]);
  return { element, ...bindShortcutSettings(element, deps, mac) };
}
