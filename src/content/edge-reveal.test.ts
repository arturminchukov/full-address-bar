import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEdgeReveal } from "./edge-reveal";

// A stand-in for `window`: the watcher only reads scrollY/innerHeight and
// registers two listeners, so this covers everything it touches.
function fakeWindow(innerHeight = 800) {
  const listeners = new Map<string, (event: never) => void>();
  return {
    scrollY: 0,
    innerHeight,
    addEventListener(type: string, fn: (event: never) => void) {
      listeners.set(type, fn);
    },
    removeEventListener(type: string) {
      listeners.delete(type);
    },
    has: (type: string) => listeners.has(type),
    scrollTo(y: number) {
      this.scrollY = y;
      listeners.get("scroll")?.(undefined as never);
    },
    movePointerTo(clientY: number) {
      listeners.get("mousemove")?.({ clientY } as never);
    },
  };
}

function setup(innerHeight = 800, isPinned?: () => boolean) {
  const view = fakeWindow(innerHeight);
  const states: boolean[] = [];
  const reveal = createEdgeReveal(view as unknown as Window, {
    setHidden: (hidden) => states.push(hidden),
    isPinned,
  });
  return { view, states, reveal };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createEdgeReveal", () => {
  it("starts visible at the top of the page", () => {
    const { reveal, states } = setup();
    reveal.start("top");
    expect(states).toEqual([]);
  });

  it("starts hidden when the page is already scrolled", () => {
    const { view, reveal, states } = setup();
    view.scrollY = 500;
    reveal.start("top");
    expect(states).toEqual([true]);
  });

  it("hides on scroll down and shows on scroll up", () => {
    const { view, reveal, states } = setup();
    reveal.start("top");
    view.scrollTo(400);
    expect(states).toEqual([true]);
    view.scrollTo(100);
    expect(states).toEqual([true, false]);
  });

  it("shows again at the very top", () => {
    const { view, reveal, states } = setup();
    reveal.start("top");
    view.scrollTo(400);
    view.scrollTo(0);
    expect(states).toEqual([true, false]);
  });

  it("ignores scroll jitter below the noise threshold", () => {
    const { view, reveal, states } = setup();
    reveal.start("top");
    view.scrollTo(400);
    states.length = 0;
    view.scrollTo(402);
    expect(states).toEqual([]);
  });

  it("reveals when the pointer reaches the top edge", () => {
    const { view, reveal, states } = setup();
    reveal.start("top");
    view.scrollTo(400);
    view.movePointerTo(2);
    expect(states).toEqual([true, false]);
  });

  it("reveals when the pointer reaches the bottom edge", () => {
    const { view, reveal, states } = setup(800);
    reveal.start("bottom");
    view.scrollTo(400);
    view.movePointerTo(799);
    expect(states).toEqual([true, false]);
  });

  it("does not reveal from the wrong edge", () => {
    const { view, reveal, states } = setup(800);
    reveal.start("bottom");
    view.scrollTo(400);
    view.movePointerTo(2);
    expect(states).toEqual([true]);
  });

  it("stays visible after the pointer leaves the edge", () => {
    const { view, reveal, states } = setup();
    reveal.start("top");
    view.scrollTo(400);
    view.movePointerTo(2);
    states.length = 0;

    view.movePointerTo(300);
    vi.advanceTimersByTime(400);
    expect(states).toEqual([]);
  });

  it("hides again on the next downward scroll after an edge reveal", () => {
    const { view, reveal, states } = setup();
    reveal.start("top");
    view.scrollTo(400);
    view.movePointerTo(2);
    states.length = 0;

    view.scrollTo(500);
    expect(states).toEqual([true]);
  });

  it("can be collapsed manually and reveals again on upward scroll", () => {
    const { view, reveal, states } = setup();
    reveal.start("top");
    const collapsible = reveal as unknown as { collapse(): void };
    collapsible.collapse();
    expect(states).toEqual([true]);

    view.scrollTo(400);
    expect(states).toEqual([true]);
    view.scrollTo(100);
    expect(states).toEqual([true, false]);
  });

  it("stays visible while something pins it open", () => {
    const { view, reveal, states } = setup(800, () => true);
    reveal.start("top");
    view.scrollTo(400);
    expect(states).toEqual([]);
  });

  it("restores the bar and unsubscribes on stop", () => {
    const { view, reveal, states } = setup();
    reveal.start("top");
    view.scrollTo(400);
    expect(states).toEqual([true]);

    reveal.stop();
    expect(states).toEqual([true, false]);
    expect(view.has("scroll")).toBe(false);
    expect(view.has("mousemove")).toBe(false);
  });

  it("does not report a state change on stop when already visible", () => {
    const { reveal, states } = setup();
    reveal.start("top");
    reveal.stop();
    expect(states).toEqual([]);
  });

  it("switches the watched edge without re-subscribing", () => {
    const { view, reveal, states } = setup(800);
    reveal.start("top");
    reveal.start("bottom");
    view.scrollTo(400);
    states.length = 0;
    view.movePointerTo(799);
    expect(states).toEqual([false]);
  });
});
