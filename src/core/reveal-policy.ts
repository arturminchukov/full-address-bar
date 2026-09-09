// Decides when an auto-hiding bar is visible. Pure on purpose: this is the
// part with the awkward rules, and it is far easier to get right against a
// table of numbers than against a live page.

import type { Position } from './settings';

/**
 * How close to the edge the pointer must come to bring the bar back.
 *
 * Deliberately small, and deliberately not a hit area: the reveal is measured
 * from pointer coordinates rather than by putting an element at the edge,
 * because such an element would swallow clicks meant for the site's own
 * buttons sitting there.
 */
export const REVEAL_THRESHOLD_PX = 4;

/** Scrolling less than this is noise — a trackpad twitch, a rubber-band. */
const SCROLL_EPSILON_PX = 4;

export interface PointerProbe {
  /** Pointer offset from the top of the viewport. */
  y: number;
  viewportHeight: number;
  position: Position;
}

/** Is the pointer against the edge the bar lives on? */
export function pointerAtEdge(
  probe: PointerProbe,
  threshold: number = REVEAL_THRESHOLD_PX,
): boolean {
  if (probe.position === 'top') return probe.y <= threshold;
  return probe.y >= probe.viewportHeight - threshold;
}

export interface ScrollProbe {
  scrollY: number;
  previousScrollY: number;
}

/**
 * Whether a scroll should reveal or conceal the bar, or leave it as it is.
 *
 * Scrolling down conceals, scrolling up reveals, and the top of the page
 * always reveals — otherwise a page that loads scrolled down would start with
 * no bar and no obvious way to ask for one.
 */
export function scrollIntent(probe: ScrollProbe): 'reveal' | 'conceal' | 'keep' {
  if (probe.scrollY <= 0) return 'reveal';
  const delta = probe.scrollY - probe.previousScrollY;
  if (Math.abs(delta) < SCROLL_EPSILON_PX) return 'keep';
  return delta > 0 ? 'conceal' : 'reveal';
}
