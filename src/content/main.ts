// Content-script entry point. This is the only module in the content bundle
// with side effects: it reads settings, mounts the bar into a Shadow DOM host,
// shifts the page, and keeps both in sync with navigation and settings.

import type { Settings } from '../core/settings';
import { isDenied } from '../core/site-rules';
import { formatUrl } from '../core/url-format';
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
  // Navigate to what was typed, with one normalization: a missing scheme.
  const target = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  location.assign(target);
}

function mount(settings: Settings): void {
  if (host) return;

  bar = renderBar({
    onCopy: () => void copyUrl(),
    onNavigate: navigate,
    onHide: () => {
      hiddenForThisPage = true;
      unmount();
    },
  });
  bar.setTheme(resolveTheme(settings.theme));

  host = document.createElement('div');
  host.id = HOST_ID;
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = STYLES;
  shadow.append(style, bar.element);

  document.documentElement.append(host);
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
  if (applies(settings)) {
    mount(settings);
    bar?.setTheme(resolveTheme(settings.theme));
  } else {
    unmount();
  }
}

async function run(): Promise<void> {
  try {
    sync(await store.load());
    store.subscribe(sync);
  } catch (err) {
    // Never leave the page half-modified if anything unexpected fails.
    unmount();
    console.error('[full-address-bar]', err);
  }
}

void run();
