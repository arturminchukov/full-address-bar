// Content-script entry point. This is the only module in the content bundle
// with side effects: it reads settings, mounts the bar into a Shadow DOM host,
// shifts the page, and keeps both in sync with navigation and settings.

import type { Settings } from '../core/settings';
import { isDenied } from '../core/site-rules';
import { formatUrl, toNavigableUrl } from '../core/url-format';
import { createSettingsStore } from '../integration/settings-storage';
import { BAR_HEIGHT, renderBar, type BarHandle } from '../ui/bar';
import { STYLES } from '../ui/styles';
import { resolveTheme } from '../ui/theme';
import { createPageShift } from './page-shift';
import { watchUrl } from './url-watch';

const HOST_ID = 'full-address-bar-host';

const store = createSettingsStore();
const shift = createPageShift(document);

let host: HTMLElement | null = null;
let bar: BarHandle | null = null;
let stopWatching: (() => void) | null = null;
// Set by the close button: the bar stays down for this page load only.
let hiddenForThisPage = false;

function currentUrl(): void {
  if (!bar) return;
  const { raw, display } = formatUrl(location.href);
  bar.setUrl(display, raw);
}

// `navigator.clipboard` only exists in a secure context, so on every plain
// http:// page the primary interaction would fail without this fallback.
function copyWithExecCommand(value: string): boolean {
  const field = document.createElement('textarea');
  field.value = value;
  field.setAttribute('readonly', '');
  field.style.setProperty('position', 'fixed', 'important');
  field.style.setProperty('top', '-1000px', 'important');
  field.style.setProperty('opacity', '0', 'important');
  document.body?.append(field);
  try {
    field.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    field.remove();
  }
}

async function copyUrl(): Promise<void> {
  const value = location.href;
  try {
    if (!navigator.clipboard) throw new Error('no clipboard API');
    await navigator.clipboard.writeText(value);
    bar?.showHint('Copied');
    return;
  } catch {
    // Fall through to the legacy path below.
  }
  bar?.showHint(copyWithExecCommand(value) ? 'Copied' : 'Copy failed');
}

function navigate(value: string): void {
  const target = toNavigableUrl(value);
  if (!target) {
    bar?.showHint('Invalid address');
    return;
  }
  location.assign(target);
}

function mount(settings: Settings): void {
  if (host) return;

  const handle = renderBar({
    onCopy: () => void copyUrl(),
    onNavigate: navigate,
    onHide: () => {
      hiddenForThisPage = true;
      unmount();
    },
  });
  handle.setTheme(resolveTheme(settings.theme));

  const element = document.createElement('div');
  element.id = HOST_ID;
  // A page rule setting transform/filter/contain/will-change on divs would
  // make this host a containing block and break the bar's position: fixed.
  element.style.setProperty('all', 'initial', 'important');
  const shadow = element.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = STYLES;
  shadow.append(style, handle.element);
  document.documentElement.append(element);

  // Publish state only once the DOM work has succeeded: a failure above must
  // leave nothing wedged behind, so a later settings change can retry.
  host = element;
  bar = handle;
  // Shift only after a successful mount, so a failure leaves the page intact.
  shift.apply(BAR_HEIGHT);

  currentUrl();
  stopWatching = watchUrl(window, () => currentUrl());
}

function unmount(): void {
  stopWatching?.();
  stopWatching = null;
  shift.revert();
  host?.remove();
  host = null;
  bar = null;
}

function applies(settings: Settings): boolean {
  if (hiddenForThisPage) return false;
  if (!settings.enabled) return false;
  return !isDenied(location.hostname, settings.deniedHosts);
}

function sync(settings: Settings): void {
  try {
    if (applies(settings)) {
      mount(settings);
      bar?.setTheme(resolveTheme(settings.theme));
    } else {
      unmount();
    }
  } catch (err) {
    // Never leave the page half-modified, and never wedge the module: unmount
    // clears the state so a later settings change can try again.
    unmount();
    console.error('[full-address-bar]', err);
  }
}

async function run(): Promise<void> {
  // Subscribe before the first mount: if that mount fails, a later settings
  // change must still be able to bring the bar back. Anything the
  // subscription delivers while the initial load is still in flight is newer
  // than that load, so it wins.
  let newest: Settings | null = null;
  store.subscribe((settings) => {
    newest = settings;
    sync(settings);
  });
  const initial = await store.load();
  sync(newest ?? initial);
}

void run();
