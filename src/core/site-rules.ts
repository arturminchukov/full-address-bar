// Deny-list matching. An entry suppresses the bar on that host and on every
// subdomain of it; the list is empty by default, so the bar is shown
// everywhere until the user opts a site out.

/**
 * Reduce user input (a bare host, a pasted URL, stray whitespace) to a
 * storable hostname, or null when it cannot be one.
 */
export function normalizeHost(input: string): string | null {
  let value = input.trim().toLowerCase();
  if (!value) return null;

  const schemeEnd = value.indexOf('://');
  if (schemeEnd !== -1) value = value.slice(schemeEnd + 3);

  // Everything from the first path, query or fragment separator is not host.
  value = value.split(/[/?#]/, 1)[0];
  // Credentials, then port.
  value = value.slice(value.lastIndexOf('@') + 1).split(':', 1)[0];
  value = value.replace(/^\.+/, '').replace(/\.+$/, '');

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
