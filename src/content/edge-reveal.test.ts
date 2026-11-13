import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEdgeReveal } from "./edge-reveal";

function setup() {
  const view = new EventTarget();
  Object.assign(view, { innerHeight: 800 });
  const states: boolean[] = [];
  const reveal = createEdgeReveal(view as unknown as Window, {
    setHidden: (hidden) => states.push(hidden),
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
  it("keeps the initial bar visible until scrolling", () => {
    const { reveal, view, states } = setup();
    reveal.start("top");
    vi.advanceTimersByTime(10000);
    view.dispatchEvent(new Event("blur"));
    expect(states).toEqual([]);
    view.dispatchEvent(new Event("scroll"));
    expect(states).toEqual([true]);
  });

  it.each(["top", "bottom"] as const)("reveals at the %s edge until scrolling", (position) => {
    const { reveal, view, states, move } = setup();
    reveal.start(position);
    view.dispatchEvent(new Event("scroll"));
    move(position === "top" ? 2 : 799);
    expect(states).toEqual([true, false]);
    move(400);
    view.dispatchEvent(new Event("blur"));
    vi.advanceTimersByTime(10000);
    expect(states).toEqual([true, false]);
    view.dispatchEvent(new Event("scroll"));
    expect(states).toEqual([true, false, true]);
    reveal.stop();
  });

  it("does not reveal on further page scrolling", () => {
    const { reveal, view, states } = setup();
    reveal.start("top");
    view.dispatchEvent(new Event("scroll"));
    view.dispatchEvent(new Event("scroll"));
    expect(states).toEqual([true]);
  });

  it("holds a programmatic reveal until scrolling", () => {
    const { reveal, view, states } = setup();
    reveal.start("top");
    reveal.collapse();
    reveal.reveal();
    vi.advanceTimersByTime(10000);
    expect(states).toEqual([true, false]);
    view.dispatchEvent(new Event("scroll"));
    expect(states).toEqual([true, false, true]);
  });

  it("requires leaving the edge before revealing again after collapse", () => {
    const { reveal, move, states } = setup();
    reveal.start("top");
    move(2);
    reveal.collapse();
    move(3);
    expect(states).toEqual([true]);
    move(400);
    move(2);
    expect(states).toEqual([true, false]);
  });

  it("does not reset hidden state on unrelated settings updates", () => {
    const { reveal, states } = setup();
    reveal.start("top");
    reveal.collapse();
    reveal.start("top");
    expect(states).toEqual([true]);
  });

  it("cleans up listeners on stop", () => {
    const { reveal, view, move, states } = setup();
    reveal.start("top");
    reveal.stop();
    vi.advanceTimersByTime(5000);
    view.dispatchEvent(new Event("scroll"));
    move(2);
    expect(states).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
