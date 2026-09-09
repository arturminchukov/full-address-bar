// Builds the bar DOM and wires its interactions. Knows nothing about storage,
// the page, or navigation: every effect goes out through a callback.

import type { Position, Theme } from "../core/settings";
import { el } from "./dom";

/** Bar height in px. The page shift must match this exactly. */
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
  /** Slide the bar out of view, or bring it back. */
  setHidden(hidden: boolean): void;
  /** True while the menu is open, so callers can hold the bar visible. */
  isMenuOpen(): boolean;
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

  const bar = el("div", { class: "fab-bar", role: "toolbar" }, [
    text,
    input,
    hint,
    collapseButton,
    menuButton,
    menu,
  ]);
  bar.dataset.position = "top";
  bar.dataset.hidden = "false";

  let raw = "";
  let editing = false;
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

  const startEditing = () => {
    editing = true;
    input.value = raw;
    text.hidden = true;
    input.hidden = false;
    input.focus();
    input.select();
  };

  const closeMenu = () => {
    menu.hidden = true;
    menuButton.setAttribute("aria-expanded", "false");
  };

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

    menu.replaceChildren(
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
        label: "Hide while scrolling",
        checked: autoHide,
        onSelect: () => callbacks.onSetAutoHide(!autoHide),
      }),
      el("div", { class: "fab-menu-sep" }),
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

  return {
    element: bar,
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
    setTheme(theme) {
      bar.dataset.theme = theme;
    },
    setPosition(next) {
      position = next;
      bar.dataset.position = next;
      collapseButton.textContent = next === "top" ? "⌃" : "⌄";
      if (!menu.hidden) buildMenu();
    },
    setAutoHide(next) {
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
