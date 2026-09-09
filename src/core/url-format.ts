// Turns a raw URL into the string shown in the bar. The bar displays a
// percent-decoded URL for readability, but every consumer that needs a usable
// address (copy, navigation) uses the raw value.

export interface UrlDisplay {
  /** The address exactly as the browser reports it. */
  raw: string;
  /** Percent-decoded for display only; not guaranteed to be a valid URL. */
  display: string;
}

// Above this length decoding costs more than it helps (long data: URLs).
const MAX_DECODE_LENGTH = 4096;

// One or more consecutive %XX escapes. A run is the safe unit to decode: a
// single UTF-8 code point is always written as consecutive escapes, so it can
// never straddle two runs. The cost is deliberate: one invalid byte anywhere
// in a run makes `decodeURIComponent` throw for the whole run, so that entire
// run stays percent-encoded rather than being partially decoded.
const PERCENT_RUN = /(?:%[0-9A-Fa-f]{2})+/g;

/**
 * Decode percent-escapes, leaving anything malformed exactly as it was.
 * Unlike `decodeURIComponent` this never throws, and unlike form decoding it
 * does not treat `+` as a space.
 */
export function decodePercent(value: string): string {
  return value.replace(PERCENT_RUN, (run) => {
    try {
      return decodeURIComponent(run);
    } catch {
      return run;
    }
  });
}

// Characters that must never reach the display: C0/C1 controls, zero-width
// and bidi marks. A decoded U+202E would render the rest of the address
// reversed, which is exactly the spoofing the bar is supposed to prevent.
const UNSAFE_DISPLAY =
  // eslint-disable-next-line no-control-regex -- matching control chars is the point
  /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g;

function keepDisplaySafe(value: string): string {
  return value.replace(UNSAFE_DISPLAY, (char) => encodeURIComponent(char));
}

export function formatUrl(raw: string): UrlDisplay {
  if (raw.length > MAX_DECODE_LENGTH) return { raw, display: keepDisplaySafe(raw) };
  return { raw, display: keepDisplaySafe(decodePercent(raw)) };
}

// A scheme already present on a value. The lookahead keeps a bare
// "localhost:3000" out of this branch: what follows a port is only digits.
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:(?!\d+(?:[/?#]|$))/i;

/** True when the value starts with a real URL scheme rather than a host:port. */
export function hasScheme(value: string): boolean {
  return HAS_SCHEME.test(value);
}

// Schemes the bar refuses to navigate to. Typing one into an address field is
// never a navigation, and `javascript:` would execute in the page's context.
const BLOCKED_SCHEMES = /^(?:javascript|data|vbscript):/i;

// Schemes worth navigating to. `new URL` accepts any unknown scheme, so
// without this allowlist "localhost:abc" parses and then navigates nowhere,
// with no feedback at all.
const NAVIGABLE_PROTOCOLS = new Set(['http:', 'https:', 'file:', 'ftp:', 'mailto:']);

/**
 * Turn a value typed into the bar into a URL worth navigating to, or null
 * when it is not one. A value with no scheme is assumed to be https.
 */
export function toNavigableUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || BLOCKED_SCHEMES.test(trimmed)) return null;
  const candidate = hasScheme(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    return NAVIGABLE_PROTOCOLS.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
