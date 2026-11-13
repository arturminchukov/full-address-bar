// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, type Settings } from "../core/settings";

const storage = vi.hoisted(() => ({
  listener: vi.fn() as (settings: Settings) => void,
  initial: {} as Settings,
}));
vi.mock("../integration/settings-storage", () => ({
  createSettingsStore: () => ({
    load: async () => storage.initial,
    save: async (patch: Partial<Settings>) => {
      storage.initial = { ...storage.initial, ...patch };
      storage.listener(storage.initial);
    },
    subscribe: (listener: (settings: Settings) => void) => {
      storage.listener = listener;
      return () => {};
    },
  }),
}));

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  document.documentElement.style.cssText = "margin-top: 5px; margin-bottom: 7px";
  storage.initial = { ...DEFAULT_SETTINGS };
});
afterEach(() => {
  storage.listener({ ...DEFAULT_SETTINGS, enabled: false });
  vi.useRealTimers();
  document.documentElement.removeAttribute("style");
  document.body.replaceChildren();
});
async function mount() {
  await import("./main");
  await vi.advanceTimersByTimeAsync(0);
  const shadow = document.getElementById("full-address-bar-host")!.shadowRoot!;
  return {
    bar: shadow.querySelector<HTMLElement>(".fab-bar")!,
    input: shadow.querySelector<HTMLInputElement>(".fab-input")!,
  };
}

it.each(["top", "bottom"] as const)("never alters page styles when pinned at %s", async (position) => {
  storage.initial = { ...DEFAULT_SETTINGS, autoHide: false, position };
  const before = document.documentElement.getAttribute("style");
  await mount();
  expect(document.documentElement.getAttribute("style")).toBe(before);
  storage.listener({ ...storage.initial, position: position === "top" ? "bottom" : "top" });
  expect(document.documentElement.getAttribute("style")).toBe(before);
});

it("opens the hidden editor with the shortcut and Escape restores page focus", async () => {
  const pageInput = document.createElement("input");
  document.body.append(pageInput);
  pageInput.focus();
  const { bar, input } = await mount();
  window.dispatchEvent(new Event("scroll"));
  expect(bar.dataset.hidden).toBe("true");
  document.dispatchEvent(new KeyboardEvent("keydown", {
    code: "KeyL", altKey: true, shiftKey: true, bubbles: true, cancelable: true,
  }));
  expect(bar.dataset.hidden).toBe("false");
  expect(input.hidden).toBe(false);
  expect(input.getRootNode()).toHaveProperty("activeElement", input);
  vi.advanceTimersByTime(3000);
  expect(bar.dataset.hidden).toBe("false");
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }));
  expect(bar.dataset.hidden).toBe("true");
  expect(document.activeElement).toBe(pageInput);
});

function press(code = "KeyL", options: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", {
    code, altKey: true, bubbles: true, cancelable: true, composed: true, ...options,
  });
  document.dispatchEvent(event);
  return event;
}

it("keeps a hover-revealed bar visible after pointer leave and window blur", async () => {
  const { bar } = await mount();
  window.dispatchEvent(new Event("scroll"));
  window.dispatchEvent(new MouseEvent("mousemove", { clientY: 2 }));
  window.dispatchEvent(new MouseEvent("mousemove", { clientY: 400 }));
  window.dispatchEvent(new Event("blur"));
  vi.advanceTimersByTime(10000);
  expect(bar.dataset.hidden).toBe("false");
  window.dispatchEvent(new Event("scroll"));
  expect(bar.dataset.hidden).toBe("true");
});

it("toggles visibility without editing and ignores held keys", async () => {
  const { bar, input } = await mount();
  expect(press().defaultPrevented).toBe(true);
  expect(bar.dataset.hidden).toBe("true");
  press("KeyL", { repeat: true });
  expect(bar.dataset.hidden).toBe("true");
  press();
  expect(bar.dataset.hidden).toBe("false");
  expect(input.hidden).toBe(true);
  vi.advanceTimersByTime(10000);
  expect(bar.dataset.hidden).toBe("false");
});

it("toggle cancels an edit and restores focus; reopening uses the current URL", async () => {
  const pageInput = document.createElement("input");
  document.body.append(pageInput);
  pageInput.focus();
  const { bar, input } = await mount();
  press("KeyL", { shiftKey: true });
  input.value = "abandoned";
  press();
  expect(bar.dataset.hidden).toBe("true");
  expect(input.hidden).toBe(true);
  expect(document.activeElement).toBe(pageInput);
  press("KeyL", { shiftKey: true });
  expect(input.value).toBe(location.href);
});

it("page-container scrolling closes an edit but editor scrolling does not", async () => {
  const { bar, input } = await mount();
  press("KeyL", { shiftKey: true });
  input.dispatchEvent(new Event("scroll", { composed: true }));
  expect(bar.dataset.hidden).toBe("false");
  const container = document.createElement("div");
  document.body.append(container);
  container.dispatchEvent(new Event("scroll"));
  expect(bar.dataset.hidden).toBe("true");
  expect(input.hidden).toBe(true);
});

it("applies shortcut settings live, updates hints and stops matching old bindings", async () => {
  const { bar, input } = await mount();
  const shortcuts = {
    toggle: { ...DEFAULT_SETTINGS.shortcuts.toggle, code: "KeyK" },
    edit: { ...DEFAULT_SETTINGS.shortcuts.edit, code: "KeyJ" },
  };
  storage.listener({ ...storage.initial, shortcuts });
  expect(press().defaultPrevented).toBe(false);
  expect(bar.dataset.hidden).toBe("false");
  press("KeyK");
  expect(bar.dataset.hidden).toBe("true");
  press("KeyJ", { shiftKey: true });
  expect(bar.dataset.hidden).toBe("false");
  expect(input.hidden).toBe(false);
  const hints = bar.querySelector(".fab-shortcuts")!.textContent;
  expect(hints).toContain("K");
  expect(hints).toContain("J");
});

it("does not hide on scrolling in always-visible mode but still supports toggling", async () => {
  storage.initial = { ...DEFAULT_SETTINGS, autoHide: false };
  const { bar } = await mount();
  window.dispatchEvent(new Event("scroll"));
  expect(bar.dataset.hidden).toBe("false");
  press();
  expect(bar.dataset.hidden).toBe("true");
  storage.listener({ ...storage.initial, theme: "dark" });
  expect(bar.dataset.hidden).toBe("true");
  press();
  expect(bar.dataset.hidden).toBe("false");
});

it("records a shortcut in the bar menu without triggering the existing shortcut", async () => {
  const { bar, input } = await mount();
  bar.querySelector<HTMLButtonElement>(".fab-menu-btn")!.click();
  const field = bar.querySelector<HTMLInputElement>("#shortcut-toggle");
  expect(field).not.toBeNull();
  field!.focus();
  field!.dispatchEvent(new KeyboardEvent("keydown", {
    key: "l", code: "KeyL", altKey: true, bubbles: true, composed: true, cancelable: true,
  }));
  await vi.advanceTimersByTimeAsync(0);
  expect(bar.dataset.hidden).toBe("false");
  expect(input.hidden).toBe(true);
  expect(bar.querySelector<HTMLElement>(".fab-menu")!.hidden).toBe(false);

  field!.focus();
  field!.dispatchEvent(new KeyboardEvent("keydown", {
    key: "k", code: "KeyK", altKey: true, bubbles: true, composed: true, cancelable: true,
  }));
  await vi.advanceTimersByTimeAsync(0);
  expect(storage.initial.shortcuts.toggle.code).toBe("KeyK");
  expect(bar.querySelector(".fab-shortcuts")!.textContent).toContain("K");
  expect(press().defaultPrevented).toBe(false);
  press("KeyK");
  expect(bar.dataset.hidden).toBe("true");
});

it("Escape cancels shortcut recording without dismissing the bar or menu", async () => {
  const { bar } = await mount();
  bar.querySelector<HTMLButtonElement>(".fab-menu-btn")!.click();
  const field = bar.querySelector<HTMLInputElement>("#shortcut-edit");
  expect(field).not.toBeNull();
  field!.focus();
  field!.dispatchEvent(new KeyboardEvent("keydown", {
    key: "Escape", code: "Escape", bubbles: true, composed: true, cancelable: true,
  }));
  expect(bar.dataset.hidden).toBe("false");
  expect(bar.querySelector<HTMLElement>(".fab-menu")!.hidden).toBe(false);
  expect(field!.value).toContain("L");
});

it("updates menu shortcut fields from external settings without losing recording focus", async () => {
  const { bar } = await mount();
  bar.querySelector<HTMLButtonElement>(".fab-menu-btn")!.click();
  const field = bar.querySelector<HTMLInputElement>("#shortcut-toggle");
  expect(field).not.toBeNull();
  field!.focus();
  storage.listener({ ...storage.initial, theme: "dark" });
  expect(field!.getRootNode()).toHaveProperty("activeElement", field);
  field!.dispatchEvent(new KeyboardEvent("keydown", {
    key: "l", code: "KeyL", altKey: true, shiftKey: true,
    bubbles: true, composed: true, cancelable: true,
  }));
  await vi.advanceTimersByTimeAsync(0);
  expect(bar.querySelector("#shortcut-status")!.textContent).toContain("already assigned");
});

it.each([
  { position: "bottom" as const },
  { autoHide: false },
])("keeps shortcut recording focused through menu settings changes: %j", async (patch) => {
  const { bar } = await mount();
  bar.querySelector<HTMLButtonElement>(".fab-menu-btn")!.click();
  const field = bar.querySelector<HTMLInputElement>("#shortcut-toggle")!;
  field.focus();
  const observer = new MutationObserver(() => {});
  observer.observe(bar.querySelector(".fab-menu")!, { childList: true, subtree: true });
  storage.initial = { ...storage.initial, ...patch };
  storage.listener(storage.initial);
  const removed = observer.takeRecords().flatMap((record) => [...record.removedNodes]);
  observer.disconnect();
  expect(removed.some((node) => node.contains(field))).toBe(false);
  expect(field.getRootNode()).toHaveProperty("activeElement", field);
  field.dispatchEvent(new KeyboardEvent("keydown", {
    key: "k", code: "KeyK", altKey: true, bubbles: true, composed: true, cancelable: true,
  }));
  await vi.advanceTimersByTimeAsync(0);
  expect(storage.initial.shortcuts.toggle.code).toBe("KeyK");
  expect(bar.dataset.hidden).toBe("false");
});

it("leaves composing and unmatched keys to the page", async () => {
  const { bar } = await mount();
  expect(press("KeyL", { isComposing: true }).defaultPrevented).toBe(false);
  expect(press("KeyL", { ctrlKey: true }).defaultPrevented).toBe(false);
  expect(bar.dataset.hidden).toBe("false");
});
