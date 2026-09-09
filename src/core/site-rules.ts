// Deny-list matching. An entry suppresses the bar on that host and on every
// subdomain of it; the list is empty by default, so the bar is shown
// everywhere until the user opts a site out.

import { hasScheme } from './url-format';

// A bracketed IPv6 literal, which is what location.hostname reports for one.
const IPV6_LITERAL = /^\[[0-9a-f:.]+\]/;

/**
 * Reduce user input (a bare host, a pasted URL, stray whitespace) to a
 * storable hostname, or null when it cannot be one.
 */
export function normalizeHost(input: string): string | null {
  let value = input.trim().toLowerCase();
  if (!value) return null;

  const schemeEnd = value.indexOf('://');
  if (schemeEnd !== -1) value = value.slice(schemeEnd + 3);
  // A scheme with no "//" (about:blank, mailto:) carries no host at all.
  else if (hasScheme(value)) return null;

  // Everything from the first path, query or fragment separator is not host.
  value = value.split(/[/?#]/, 1)[0];
  // Credentials, then port — but an IPv6 literal is colons all the way down,
  // so it keeps its brackets and only a trailing :port is cut.
  value = value.slice(value.lastIndexOf('@') + 1);
  const ipv6 = IPV6_LITERAL.exec(value);
  if (ipv6) value = ipv6[0];
  else value = value.split(':', 1)[0].replace(/^\.+/, '').replace(/\.+$/, '');

  if (!value || /\s/.test(value)) return null;
  return value;
}

export function isDenied(hostname: string, deniedHosts: readonly string[]): boolean {
  const host = normalizeHost(hostname);
  if (!host) return false;
  return deniedHosts.some((entry) => {
    const denied = normalizeHost(entry);
    if (!denied) return false;
    return host === denied || host.endsWith(`.${denied}`);
  });
}
