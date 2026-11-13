// Content-script entry point. This is the only module in the content bundle
// with side effects: it reads settings, mounts the bar into a Shadow DOM host,
// keeps the bar in sync with navigation and settings.

import { DEFAULT_SETTINGS, type Position, type Settings } from "../core/settings";
import { matchesShortcut } from "../core/shortcuts";
import { isDenied, normalizeHost } from "../core/site-rules";
import { formatUrl, toNavigableUrl } from "../core/url-format";
import { createSettingsStore } from "../integration/settings-storage";
import { renderBar, type BarHandle } from "../ui/bar";
import { STYLES } from "../ui/styles";
import { resolveTheme } from "../ui/theme";
import { createEdgeReveal } from "./edge-reveal";
import { watchUrl } from "./url-watch";

const HOST_ID = "full-address-bar-host";

const store = createSettingsStore();
let autoHide = true;
let shortcuts = DEFAULT_SETTINGS.shortcuts;

let host: HTMLElement | null = null;
let bar: BarHandle | null = null;
let stopWatching: (() => void) | null = null;
// Set from the menu: the bar stays down for this page load only.
let hiddenForThisPage = false;

// Only page scrolling hides a revealed bar; scrolling the URL editor does not.
const edgeReveal = createEdgeReveal(window, {
  setHidden: (hidden) => {
    if (hidden) bar?.dismiss();
    bar?.setHidden(hidden);
  },
  ignoreScroll: (event) => host !== null && event.composedPath().includes(host),
});

function currentUrl(): void {
  if (!bar) return;
  const { raw, display } = formatUrl(location.href);
  bar.setUrl(display, raw);
}

// `navigator.clipboard` only exists in a secure context, so on every plain
// http:// page the primary interaction would fail without this fallback.
function copyWithExecCommand(value: string): boolean {
  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.setProperty("position", "fixed", "important");
  field.style.setProperty("top", "-1000px", "important");
  field.style.setProperty("opacity", "0", "important");
  document.body?.append(field);
  try {
    field.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
  }
}

async function copyUrl(): Promise<void> {
  const value = location.href;
  try {
    if (!navigator.clipboard) throw new Error("no clipboard API");
    await navigator.clipboard.writeText(value);
    bar?.showHint("Copied");
    return;
  } catch {
    // Fall through to the legacy path below.
  }
  bar?.showHint(copyWithExecCommand(value) ? "Copied" : "Copy failed");
}

function navigate(value: string): void {
  const target = toNavigableUrl(value);
  if (!target) {
    bar?.showHint("Invalid address");
    return;
  }
  location.assign(target);
}

// The page layout is never modified, including in always-visible mode.
function applyLayout(settings: Settings): void {
  if (!bar) return;
  bar.setPosition(settings.position);
  bar.setAutoHide(settings.autoHide);

  const wasAutoHide = autoHide;
  autoHide = settings.autoHide;
  if (autoHide) edgeReveal.start(settings.position);
  else if (wasAutoHide) edgeReveal.stop();
  shortcuts = settings.shortcuts;
  bar.setShortcuts(shortcuts);
}

function denyCurrentSite(): void {
  const site = normalizeHost(location.hostname);
  if (!site) return;
  void store.load().then((settings) => {
    if (settings.deniedHosts.includes(site)) return;
    return store.save({ deniedHosts: [...settings.deniedHosts, site] });
  });
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
    onSetPosition: (position: Position) => void store.save({ position }),
    onSetAutoHide: (autoHide: boolean) => void store.save({ autoHide }),
    onCollapse: () => {
      bar?.dismiss();
      edgeReveal.collapse();
    },
    onLoadShortcuts: async () => (await store.load()).shortcuts,
    onSetShortcuts: (shortcuts) => store.save({ shortcuts }),
    onDenySite: denyCurrentSite,
  });
  handle.setTheme(resolveTheme(settings.theme));

  const element = document.createElement("div");
  element.id = HOST_ID;
  // A page rule setting transform/filter/contain/will-change on divs would
  // make this host a containing block and break the bar's position: fixed.
  element.style.setProperty("all", "initial", "important");
  // Keep the host out of document flow without creating a containing block
  // for its viewport-fixed child. Only the visible bar accepts pointer events.
  for (const [property, value] of Object.entries({
    position: "fixed", top: "0", left: "0", width: "0", height: "0",
    "z-index": "2147483647", "pointer-events": "none",
  })) element.style.setProperty(property, value, "important");
  const shadow = element.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = STYLES;
  shadow.append(style, handle.element);
  document.documentElement.append(element);

  // Publish state only once the DOM work has succeeded: a failure above must
  // leave nothing wedged behind, so a later settings change can retry.
  host = element;
  bar = handle;
  applyLayout(settings);
  document.addEventListener("keydown", onKeyDown, true);

  currentUrl();
  stopWatching = watchUrl(window, () => currentUrl());
}

function onKeyDown(event: KeyboardEvent): void {
  if (!bar || bar.isRecordingShortcut()) return;
  const toggle = matchesShortcut(event, shortcuts.toggle);
  const edit = matchesShortcut(event, shortcuts.edit);
  if (toggle || edit) {
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat) return;
    if (toggle) {
      if (edgeReveal.isHidden()) edgeReveal.reveal();
      else edgeReveal.collapse();
    } else {
      edgeReveal.reveal();
      bar.edit();
    }
  } else if (event.key === "Escape" && event.composedPath().includes(host as EventTarget)) {
    event.preventDefault();
    event.stopPropagation();
    bar.dismiss();
    if (autoHide) edgeReveal.collapse();
  }
}

function unmount(): void {
  stopWatching?.();
  stopWatching = null;
  edgeReveal.stop();
  document.removeEventListener("keydown", onKeyDown, true);
  bar?.dismiss();
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
      // Re-applied on every change, so switching edge or auto-hide from the
      // menu takes effect on an already-mounted bar.
      applyLayout(settings);
    } else {
      unmount();
    }
  } catch (err) {
    // Never leave the page half-modified, and never wedge the module: unmount
    // clears the state so a later settings change can try again.
    unmount();
    console.error("[full-address-bar]", err);
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
