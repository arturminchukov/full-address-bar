// Pushes the page down so the fixed bar never covers content. Isolated here
// because it is the one strategy most likely to need revisiting: sites with
// their own `position: fixed; top: 0` header will render underneath the bar.

export interface PageShift {
  apply(heightPx: number): void;
  revert(): void;
}

export function createPageShift(doc: Document): PageShift {
  const root = doc.documentElement;
  let previous: { value: string; priority: string } | null = null;

  return {
    apply(heightPx) {
      // Remember the page's own inline margin once, not on every re-apply.
      previous ??= {
        value: root.style.getPropertyValue('margin-top'),
        priority: root.style.getPropertyPriority('margin-top'),
      };
      root.style.setProperty('margin-top', `${heightPx}px`, 'important');
    },
    revert() {
      if (!previous) return;
      root.style.removeProperty('margin-top');
      if (previous.value) {
        root.style.setProperty('margin-top', previous.value, previous.priority);
      }
      previous = null;
    },
  };
}
