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
    save: vi.fn(),
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
  vi.advanceTimersByTime(2000);
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
