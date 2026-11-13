// @vitest-environment jsdom
import popupHtml from './popup.html?raw';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, parseSettings, type Settings } from '../core/settings';

const storage = vi.hoisted(() => ({ settings: {} as Settings, fail: false }));
vi.mock('../integration/settings-storage', () => ({
  createSettingsStore: () => ({
    load: async () => storage.settings,
    save: async (patch: Partial<Settings>) => {
      if (storage.fail) throw new Error('storage unavailable');
      storage.settings = { ...storage.settings, ...patch };
    },
  }),
}));
vi.mock('../integration/browser-api', () => ({ api: undefined }));

beforeEach(async () => {
  vi.resetModules();
  storage.settings = parseSettings(undefined);
  storage.fail = false;
  const template = new DOMParser().parseFromString(popupHtml, 'text/html');
  document.body.replaceChildren(...template.body.childNodes);
  await import('./popup');
});
afterEach(() => document.body.replaceChildren());

function field(action: 'toggle' | 'edit') {
  const input = document.getElementById(`shortcut-${action}`) as HTMLInputElement;
  expect(input).not.toBeNull();
  return input;
}
function record(input: HTMLInputElement, options: KeyboardEventInit = {}) {
  input.focus();
  const event = new KeyboardEvent('keydown', {
    key: 'k', code: 'KeyK', altKey: true, bubbles: true, cancelable: true, ...options,
  });
  input.dispatchEvent(event);
  return event;
}
function error() {
  return document.getElementById('shortcut-status')!.textContent;
}

it('renders both shortcut fields in the real popup', () => {
  expect(field('toggle').value).toMatch(/L/);
  expect(field('edit').value).toMatch(/L/);
  expect(field('toggle').readOnly).toBe(true);
  expect(document.getElementById('shortcut-reset')).not.toBeNull();
});

it('records a shortcut, persists it and updates its label', async () => {
  const input = field('toggle');
  expect(record(input).defaultPrevented).toBe(true);
  await vi.waitFor(() => expect(storage.settings.shortcuts.toggle.code).toBe('KeyK'));
  expect(input.value).toContain('K');
  expect(storage.settings.shortcuts.edit).toEqual(DEFAULT_SETTINGS.shortcuts.edit);
  expect(storage.settings.enabled).toBe(true);
});

it('rejects duplicate shortcuts without changing settings', async () => {
  record(field('edit'), { key: 'l', code: 'KeyL' });
  await vi.waitFor(() => expect(error()).toContain('already assigned'));
  expect(storage.settings.shortcuts).toEqual(DEFAULT_SETTINGS.shortcuts);
});

it('does not assign bare keys, modifier keys, repeats or composition', async () => {
  record(field('toggle'), { altKey: false });
  expect(error()).toContain('Ctrl');
  record(field('toggle'), { key: 'Alt', code: 'AltLeft' });
  record(field('toggle'), { repeat: true });
  record(field('toggle'), { isComposing: true });
  await Promise.resolve();
  expect(storage.settings.shortcuts).toEqual(DEFAULT_SETTINGS.shortcuts);
});

it('Escape cancels recording and Tab retains normal focus navigation', () => {
  const input = field('toggle');
  record(input, { key: 'Escape', code: 'Escape', altKey: false });
  expect(document.activeElement).not.toBe(input);
  expect(storage.settings.shortcuts).toEqual(DEFAULT_SETTINGS.shortcuts);
  expect(record(input, { key: 'Tab', code: 'Tab', altKey: false }).defaultPrevented).toBe(false);
});

it('resets both shortcuts to defaults', async () => {
  record(field('toggle'));
  await vi.waitFor(() => expect(storage.settings.shortcuts.toggle.code).toBe('KeyK'));
  document.getElementById('shortcut-reset')!.click();
  await vi.waitFor(() => expect(storage.settings.shortcuts).toEqual(DEFAULT_SETTINGS.shortcuts));
  expect(field('toggle').value).toContain('L');
});

it('shows a save error without claiming a shortcut was changed', async () => {
  storage.fail = true;
  record(field('toggle'));
  await vi.waitFor(() => expect(error()).toContain('Could not save'));
  expect(storage.settings.shortcuts).toEqual(DEFAULT_SETTINGS.shortcuts);
});
