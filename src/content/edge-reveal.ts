// Pointer-only reveal: never insert a hit target or change the page layout.
import { pointerAtEdge } from "../core/reveal-policy";
import type { Position } from "../core/settings";

export interface EdgeReveal {
  start(position: Position): void;
  reveal(): void;
  collapse(): void;
  isHidden(): boolean;
  stop(): void;
}

export interface EdgeRevealDeps {
  setHidden(hidden: boolean): void;
  ignoreScroll?(event: Event): boolean;
}

export function createEdgeReveal(view: Window, deps: EdgeRevealDeps): EdgeReveal {
  let position: Position = "top";
  let hidden = false;
  let running = false;
  let atEdge = false;

  const setHidden = (next: boolean) => {
    if (hidden === next) return;
    hidden = next;
    deps.setHidden(next);
  };
  const onPointerMove = (event: MouseEvent) => {
    const next = pointerAtEdge({ y: event.clientY, viewportHeight: view.innerHeight, position });
    // A manual collapse must survive small movements while still at the edge.
    if (next && !atEdge) setHidden(false);
    atEdge = next;
  };
  const onScroll = (event: Event) => {
    if (!deps.ignoreScroll?.(event)) setHidden(true);
  };

  return {
    start(next) {
      if (position !== next) atEdge = false;
      position = next;
      if (running) return;
      running = true;
      view.addEventListener("mousemove", onPointerMove, { passive: true });
      // Capture also sees scrolling in nested page containers.
      view.addEventListener("scroll", onScroll, { passive: true, capture: true });
    },
    reveal: () => setHidden(false),
    collapse: () => setHidden(true),
    isHidden: () => hidden,
    stop() {
      view.removeEventListener("mousemove", onPointerMove);
      view.removeEventListener("scroll", onScroll, { capture: true });
      running = false;
      atEdge = false;
      setHidden(false);
    },
  };
}
