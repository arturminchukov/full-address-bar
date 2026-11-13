import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEdgeReveal } from "./edge-reveal";

function setup(isPinned = () => false) {
  const view = new EventTarget();
  Object.assign(view, { innerHeight: 800, scrollY: 0 });
  const states: boolean[] = [];
  const reveal = createEdgeReveal(view as unknown as Window, {
    setHidden: (hidden) => states.push(hidden),
    isPinned,
  });
  const move = (clientY: number) => {
    const event = new Event("mousemove");
    Object.assign(event, { clientY });
    view.dispatchEvent(event);
  };
  return { view, states, reveal, move };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("edge reveal", () => {
  it("hides the initial preview without requiring a scroll", () => {
    const { reveal, states } = setup();
    reveal.start("top");
    vi.advanceTimersByTime(1800);
    expect(states).toEqual([true]);
  });

  it.each(["top", "bottom"] as const)("reveals at the %s edge and hides after leaving", (position) => {
    const { reveal, states, move } = setup();
    reveal.start(position);
    vi.advanceTimersByTime(1800);
    move(position === "top" ? 2 : 799);
    expect(states).toEqual([true, false]);
    move(400);
    vi.advanceTimersByTime(300);
    expect(states).toEqual([true, false]);
    vi.advanceTimersByTime(200);
    expect(states).toEqual([true, false, true]);
    reveal.stop();
  });

  it("holds the bar during interaction then hides after interaction ends", () => {
    let pinned = true;
    const { reveal, states } = setup(() => pinned);
    reveal.start("top");
    vi.advanceTimersByTime(3000);
    expect(states).toEqual([]);
    pinned = false;
    vi.advanceTimersByTime(500);
    expect(states).toEqual([true]);
  });

  it("does not reveal on page scrolling", () => {
    const { reveal, view, states } = setup();
    reveal.start("top");
    vi.advanceTimersByTime(1800);
    view.dispatchEvent(new Event("scroll"));
    expect(states).toEqual([true]);
  });

  it("does not restart the preview on unrelated settings updates", () => {
    const { reveal, states } = setup();
    reveal.start("top");
    vi.advanceTimersByTime(1800);
    reveal.start("top");
    expect(states).toEqual([true]);
  });

  it("cleans up timers and listeners on stop", () => {
    const { reveal, move, states } = setup();
    reveal.start("top");
    reveal.stop();
    vi.advanceTimersByTime(5000);
    move(2);
    expect(states).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
