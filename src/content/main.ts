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

async function copyUrl(): Promise<void> {
  try {
    await navigator.clipboard.writeText(location.href);
    bar?.showHint('Copied');
  } catch {
    bar?.showHint('Copy failed');
  }
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
  // change must still be able to bring the bar back.
  store.subscribe(sync);
  sync(await store.load());
}

void run();
