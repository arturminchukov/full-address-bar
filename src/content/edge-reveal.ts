// Pointer-only reveal: never insert a hit target or change the page layout.
import { pointerAtEdge } from "../core/reveal-policy";
import type { Position } from "../core/settings";

export interface EdgeReveal {
  start(position: Position): void;
  reveal(): void;
  collapse(): void;
  stop(): void;
}

export interface EdgeRevealDeps {
  setHidden(hidden: boolean): void;
  isPinned?(): boolean;
}

export function createEdgeReveal(view: Window, deps: EdgeRevealDeps): EdgeReveal {
  let position: Position = "top";
  let hidden = false;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const setHidden = (next: boolean) => {
    if (hidden === next) return;
    hidden = next;
    deps.setHidden(next);
  };
  const scheduleHide = (delay = 450) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      if (deps.isPinned?.()) scheduleHide();
      else setHidden(true);
    }, delay);
  };
  const reveal = () => {
    setHidden(false);
    scheduleHide();
  };
  const onPointerMove = (event: MouseEvent) => {
    if (pointerAtEdge({ y: event.clientY, viewportHeight: view.innerHeight, position })) {
      reveal();
    } else if (!hidden && timer === undefined) {
      scheduleHide();
    }
  };
  const onPointerLeave = () => {
    if (!hidden) scheduleHide();
  };

  return {
    start(next) {
      position = next;
      if (running) return;
      running = true;
      view.addEventListener("mousemove", onPointerMove, { passive: true });
      view.addEventListener("blur", onPointerLeave);
      scheduleHide(1800);
    },
    reveal,
    collapse() {
      clearTimeout(timer);
      timer = undefined;
      setHidden(true);
    },
    stop() {
      clearTimeout(timer);
      timer = undefined;
      view.removeEventListener("mousemove", onPointerMove);
      view.removeEventListener("blur", onPointerLeave);
      running = false;
      setHidden(false);
    },
  };
}
