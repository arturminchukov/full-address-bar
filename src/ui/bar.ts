// Builds the bar DOM and wires its interactions. Knows nothing about storage,
// the page, or navigation: every effect goes out through a callback.

import type { Position, Theme } from "../core/settings";
import { formatShortcut, type Shortcuts } from "../core/shortcuts";
import { el } from "./dom";
import { renderShortcutSettings } from "./shortcut-settings";

/** Bar height in px, kept in sync with the stylesheet. */
export const BAR_HEIGHT = 28;

// A single click copies; a double click edits. The copy waits out this window
// so a double click can cancel it.
const CLICK_DELAY_MS = 250;
const HINT_MS = 1500;

// The bar ellipsises a long URL, so the full address lives in the tooltip —
// with the interaction hint appended, since the title can only be one string.
const INTERACTION_HINT = "Click to copy · double-click to edit";

export interface BarCallbacks {
  onCopy(): void;
  onNavigate(value: string): void;
  /** Hide the bar for this page load. */
  onHide(): void;
  onSetPosition(position: Position): void;
  onSetAutoHide(autoHide: boolean): void;
  onCollapse(): void;
  onLoadShortcuts(): Promise<Shortcuts>;
  onSetShortcuts(shortcuts: Shortcuts): Promise<void>;
  /** Add this site to the deny-list for good. */
  onDenySite(): void;
}

export interface BarHandle {
  element: HTMLElement;
  /** `display` is shown; `raw` prefills the edit field. */
  setUrl(display: string, raw: string): void;
  showHint(text: string): void;
  setTheme(theme: Exclude<Theme, "auto">): void;
  setPosition(position: Position): void;
  setAutoHide(autoHide: boolean): void;
  setShortcuts(shortcuts: Shortcuts): void;
  isRecordingShortcut(): boolean;
  /** Remove the bar from rendering, or bring it back. */
  setHidden(hidden: boolean): void;
  /** True while the menu is open, so callers can hold the bar visible. */
  isMenuOpen(): boolean;
  isInteracting(): boolean;
  edit(): void;
  dismiss(): void;
}

interface MenuItemSpec {
  label: string;
  /** Shown at the right edge when the item represents the current state. */
  checked?: boolean;
  onSelect(): void;
}

export function renderBar(callbacks: BarCallbacks): BarHandle {
  const text = el("span", { class: "fab-url" });
  const input = el("input", {
    class: "fab-input",
    type: "text",
    spellcheck: "false",
    "aria-label": "Edit address",
    hidden: true,
  }) as HTMLInputElement;
  const hint = el("span", { class: "fab-hint", hidden: true });
  const shortcuts = el("span", { class: "fab-shortcuts", hidden: true });
  const collapseButton = el("button", {
    class: "fab-collapse-btn",
    type: "button",
    title: "Collapse bar",
    "aria-label": "Collapse bar",
    text: "⌃",
  }) as HTMLButtonElement;
  const menuButton = el("button", {
    class: "fab-menu-btn",
    type: "button",
    title: "Bar settings",
    "aria-label": "Bar settings",
    "aria-expanded": "false",
    text: "⋯",
  }) as HTMLButtonElement;
  const menu = el("div", { class: "fab-menu", role: "menu", hidden: true });
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  const shortcutSettings = renderShortcutSettings({
    load: () => callbacks.onLoadShortcuts(),
    save: async (next) => {
      await callbacks.onSetShortcuts(next);
      setShortcuts(next);
    },
  }, mac);

  function setShortcuts(next: Shortcuts): void {
    const toggle = formatShortcut(next.toggle, mac);
    const edit = formatShortcut(next.edit, mac);
    const label = (action: string, shortcut: string) => el("span", {}, [
      `${action} `,
      ...shortcut.split(/([⌥⇧⌃⌘]+)/).map((part) =>
        /^[⌥⇧⌃⌘]+$/.test(part)
          ? el("span", { class: "fab-shortcut-symbol", text: part })
          : part,
      ),
    ]);
    shortcuts.replaceChildren(label("Show/hide", toggle), label("Edit", edit));
    shortcuts.hidden = false;
    shortcuts.title = `Show/hide ${toggle} · Edit ${edit}`;
    collapseButton.title = `Collapse bar (${toggle})`;
    shortcutSettings.render(next);
  }

  const bar = el("div", { class: "fab-bar", role: "toolbar" }, [
    text,
    input,
    hint,
    shortcuts,
    collapseButton,
    menuButton,
    menu,
  ]);
  bar.dataset.position = "top";
  bar.dataset.hidden = "false";

  let raw = "";
  let editing = false;
  let hovered = false;
  let previousFocus: HTMLElement | null = null;
  let position: Position = "top";
  let autoHide = false;
  collapseButton.hidden = true;
  let clickTimer: ReturnType<typeof setTimeout> | undefined;
  let hintTimer: ReturnType<typeof setTimeout> | undefined;

  const stopEditing = () => {
    editing = false;
    input.hidden = true;
    text.hidden = false;
  };

  const focusedControl = () => {
    const active = (bar.getRootNode() as Document | ShadowRoot).activeElement;
    return active instanceof HTMLElement && bar.contains(active) ? active : null;
  };

  const rememberPageFocus = () => {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) {
      active = active.shadowRoot.activeElement;
    }
    if (!previousFocus && !focusedControl() && active instanceof HTMLElement) {
      previousFocus = active;
    }
  };

  // Pointer default actions move focus before click handlers run.
  bar.addEventListener("pointerdown", rememberPageFocus, true);
  bar.addEventListener("focusout", (event) => {
    if (!(event.relatedTarget instanceof Node) || !bar.contains(event.relatedTarget)) {
      previousFocus = null;
    }
  });

  const startEditing = () => {
    if (!editing) rememberPageFocus();
    editing = true;
    input.value = raw;
    text.hidden = true;
    input.hidden = false;
    input.focus();
    input.select();
  };

  const closeMenu = () => {
    shortcutSettings.cancel();
    menu.hidden = true;
    menuButton.setAttribute("aria-expanded", "false");
  };

  // Dynamic choices can be rebuilt without detaching the focused recorder.
  const menuOptions = el("div");
  const menuActions = el("div");
  menu.append(
    menuOptions,
    el("div", { class: "fab-menu-sep" }),
    shortcutSettings.element,
    el("div", { class: "fab-menu-sep" }),
    menuActions,
  );

  const buildMenu = () => {
    const item = (spec: MenuItemSpec): HTMLElement => {
      const node = el(
        "button",
        {
          class: "fab-menu-item",
          type: "button",
          role: "menuitem",
        },
        [
          el("span", { text: spec.label }),
          el("span", { class: "fab-menu-mark", text: spec.checked ? "✓" : "" }),
        ],
      );
      node.addEventListener("click", () => {
        closeMenu();
        spec.onSelect();
      });
      return node;
    };

    menuOptions.replaceChildren(
      el("div", { class: "fab-menu-group", text: "Position" }),
      item({
        label: "Top of the page",
        checked: position === "top",
        onSelect: () => callbacks.onSetPosition("top"),
      }),
      item({
        label: "Bottom of the page",
        checked: position === "bottom",
        onSelect: () => callbacks.onSetPosition("bottom"),
      }),
      el("div", { class: "fab-menu-sep" }),
      item({
        label: "Always show (overlays page)",
        checked: !autoHide,
        onSelect: () => callbacks.onSetAutoHide(!autoHide),
      }),
    );
    menuActions.replaceChildren(
      item({ label: "Hide on this page", onSelect: () => callbacks.onHide() }),
      item({
        label: "Turn off on this site",
        onSelect: () => callbacks.onDenySite(),
      }),
    );
  };

  const openMenu = () => {
    buildMenu();
    menu.hidden = false;
    menuButton.setAttribute("aria-expanded", "true");
  };

  text.addEventListener("click", () => {
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => callbacks.onCopy(), CLICK_DELAY_MS);
  });

  text.addEventListener("dblclick", () => {
    clearTimeout(clickTimer);
    startEditing();
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      const value = input.value.trim();
      if (!value) return;
      stopEditing();
      callbacks.onNavigate(value);
    } else if (event.key === "Escape") {
      stopEditing();
    }
  });

  input.addEventListener("blur", stopEditing);

  collapseButton.addEventListener("click", () => {
    clearTimeout(clickTimer);
    callbacks.onCollapse();
  });

  menuButton.addEventListener("click", () => {
    // Opening the menu cancels a pending copy: the click that opened it was
    // aimed at the button, not at the URL.
    clearTimeout(clickTimer);
    if (menu.hidden) openMenu();
    else closeMenu();
  });

  // A click anywhere else in the bar dismisses the menu. Clicks outside the
  // shadow root are the page's own business and are watched by the caller.
  bar.addEventListener("click", (event) => {
    if (menu.hidden) return;
    const target = event.target as Node;
    if (!menu.contains(target) && target !== menuButton) closeMenu();
  });

  bar.addEventListener("pointerenter", () => { hovered = true; });
  bar.addEventListener("pointerleave", () => { hovered = false; });

  return {
    element: bar,
    edit: startEditing,
    dismiss() {
      const active = focusedControl();
      const restoreFocus = previousFocus;
      clearTimeout(clickTimer);
      stopEditing();
      closeMenu();
      hovered = false;
      if (active) {
        if (restoreFocus?.isConnected) restoreFocus.focus({ preventScroll: true });
        focusedControl()?.blur();
      }
      previousFocus = null;
    },
    isInteracting() {
      return hovered || editing || !menu.hidden || bar.matches(":focus-within");
    },
    setUrl(display, rawUrl) {
      raw = rawUrl;
      text.textContent = display;
      text.title = `${display}\n${INTERACTION_HINT}`;
      // Never clobber a half-typed address under the user's cursor.
      if (!editing) input.value = rawUrl;
    },
    showHint(message) {
      clearTimeout(hintTimer);
      hint.textContent = message;
      hint.hidden = false;
      hintTimer = setTimeout(() => {
        hint.hidden = true;
      }, HINT_MS);
    },
    setShortcuts,
    isRecordingShortcut: () => !menu.hidden && shortcutSettings.isRecording(),
    setTheme(theme) {
      bar.dataset.theme = theme;
    },
    setPosition(next) {
      if (position === next) return;
      position = next;
      bar.dataset.position = next;
      collapseButton.textContent = next === "top" ? "⌃" : "⌄";
      if (!menu.hidden) buildMenu();
    },
    setAutoHide(next) {
      if (autoHide === next) return;
      autoHide = next;
      collapseButton.hidden = !next;
      if (!menu.hidden) buildMenu();
    },
    setHidden(hidden) {
      // A hidden bar cannot hold an open menu: the menu would slide away with
      // it and keep swallowing the next click.
      if (hidden && !menu.hidden) closeMenu();
      bar.dataset.hidden = String(hidden);
    },
    isMenuOpen() {
      return !menu.hidden;
    },
  };
}
