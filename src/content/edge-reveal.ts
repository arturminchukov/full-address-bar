// Hides the bar while the page scrolls down and brings it back on scroll up.
// or when the pointer reaches the bar's edge.
//
// The reveal is measured from pointer coordinates rather than by placing a
// strip at the edge of the viewport. A strip would be a hit area, and it would
// sit exactly where sites like to put their own buttons — swallowing clicks
// meant for them. Listening for pointer movement costs the page nothing and
// leaves every element at the edge clickable.

import { pointerAtEdge, scrollIntent } from "../core/reveal-policy";
import type { Position } from "../core/settings";

export interface EdgeReveal {
  /** Start watching. Safe to call again to change the edge. */
  start(position: Position): void;
  /** Hide immediately without changing the auto-hide setting. */
  collapse(): void;
  stop(): void;
}

export interface EdgeRevealDeps {
  /** Called with true when the bar should be hidden. */
  setHidden(hidden: boolean): void;
  /** Something else is holding the bar open — an open menu, say. */
  isPinned?(): boolean;
}

export function createEdgeReveal(
  view: Window,
  deps: EdgeRevealDeps,
): EdgeReveal {
  let position: Position = "top";
  let lastScrollY = 0;
  let hidden = false;
  let running = false;

  const setHidden = (next: boolean) => {
    if (next && deps.isPinned?.()) return;
    if (next === hidden) return;
    hidden = next;
    deps.setHidden(next);
  };

  const reveal = () => {
    setHidden(false);
  };

  const onScroll = () => {
    const intent = scrollIntent({
      scrollY: view.scrollY,
      previousScrollY: lastScrollY,
    });
    lastScrollY = view.scrollY;
    if (intent === "reveal") reveal();
    else if (intent === "conceal") setHidden(true);
  };

  const onPointerMove = (event: MouseEvent) => {
    const atEdge = pointerAtEdge({
      y: event.clientY,
      viewportHeight: view.innerHeight,
      position,
    });
    if (atEdge) reveal();
  };

  return {
    start(next) {
      position = next;
      if (running) return;
      running = true;
      lastScrollY = view.scrollY;
      view.addEventListener("scroll", onScroll, { passive: true });
      view.addEventListener("mousemove", onPointerMove, { passive: true });
      // A page opened part-way down starts hidden; the top always shows.
      setHidden(view.scrollY > 0);
    },

    collapse() {
      setHidden(true);
    },

    stop() {
      if (running) {
        view.removeEventListener("scroll", onScroll);
        view.removeEventListener("mousemove", onPointerMove);
        running = false;
      }
      // Whoever stops the watcher gets the bar back in its visible state.
      if (hidden) {
        hidden = false;
        deps.setHidden(false);
      }
    },
  };
}
