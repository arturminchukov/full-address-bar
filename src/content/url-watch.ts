// Reports URL changes within a single page load. `history.pushState` cannot be
// patched from the content script's isolated world, so SPA navigations are
// caught by a cheap poll on top of the two native events.

const DEFAULT_INTERVAL_MS = 250;

/** Subscribe to URL changes. Returns an unsubscribe function. */
export function watchUrl(
  target: Window,
  onChange: (href: string) => void,
  intervalMs: number = DEFAULT_INTERVAL_MS,
): () => void {
  let last = target.location.href;

  const check = () => {
    const href = target.location.href;
    if (href === last) return;
    last = href;
    onChange(href);
  };

  target.addEventListener('popstate', check);
  target.addEventListener('hashchange', check);
  const timer = setInterval(check, intervalMs);

  return () => {
    clearInterval(timer);
    target.removeEventListener('popstate', check);
    target.removeEventListener('hashchange', check);
  };
}
