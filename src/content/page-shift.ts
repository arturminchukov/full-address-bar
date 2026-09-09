// Pushes the page away from the edge the bar sits on, so the bar never covers
// content. Isolated here because it is the one strategy most likely to need
// revisiting: sites with their own `position: fixed` header pinned to that
// edge will render underneath the bar.
//
// Only used when the bar does not auto-hide. A bar that both moved the page
// and slid away on scroll would make the content jump on every scroll, so the
// auto-hiding bar sits over the page instead.

import type { Position } from '../core/settings';

export interface PageShift {
  apply(heightPx: number, position: Position): void;
  revert(): void;
}

const PROPERTY: Record<Position, 'margin-top' | 'margin-bottom'> = {
  top: 'margin-top',
  bottom: 'margin-bottom',
};

export function createPageShift(doc: Document): PageShift {
  const root = doc.documentElement;
  // The page's own inline margin, remembered per property so a switch between
  // edges cannot strand the one we are no longer using.
  let previous: { property: string; value: string; priority: string } | null = null;

  const restore = () => {
    if (!previous) return;
    root.style.removeProperty(previous.property);
    if (previous.value) {
      root.style.setProperty(previous.property, previous.value, previous.priority);
    }
    previous = null;
  };

  return {
    apply(heightPx, position) {
      const property = PROPERTY[position];
      // Moving to the other edge: put the old one back before taking the new.
      if (previous && previous.property !== property) restore();
      previous ??= {
        property,
        value: root.style.getPropertyValue(property),
        priority: root.style.getPropertyPriority(property),
      };
      root.style.setProperty(property, `${heightPx}px`, 'important');
    },
    revert: restore,
  };
}
