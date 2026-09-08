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

// One or more consecutive %XX escapes: a full UTF-8 code point never spans
// two separate runs, so decoding run by run is safe.
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

export function formatUrl(raw: string): UrlDisplay {
  if (raw.length > MAX_DECODE_LENGTH) return { raw, display: raw };
  return { raw, display: decodePercent(raw) };
}
