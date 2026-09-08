import { describe, expect, it } from 'vitest';
import { isDenied, normalizeHost } from './site-rules';

describe('normalizeHost', () => {
  it('lowercases a bare host', () => {
    expect(normalizeHost('Example.COM')).toBe('example.com');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeHost('  example.com  ')).toBe('example.com');
  });

  it('extracts the host from a full URL', () => {
    expect(normalizeHost('https://sub.example.com/path?q=1')).toBe('sub.example.com');
  });

  it('drops a trailing slash and path from a bare host', () => {
    expect(normalizeHost('example.com/path')).toBe('example.com');
  });

  it('strips leading dots', () => {
    expect(normalizeHost('.example.com')).toBe('example.com');
  });

  it('keeps a port out of the stored host', () => {
    expect(normalizeHost('localhost:3000')).toBe('localhost');
  });

  it('rejects empty and whitespace-only input', () => {
    expect(normalizeHost('')).toBeNull();
    expect(normalizeHost('   ')).toBeNull();
  });

  it('rejects input with inner spaces', () => {
    expect(normalizeHost('exa mple.com')).toBeNull();
  });

  it('keeps a bracketed IPv6 literal intact', () => {
    expect(normalizeHost('[2001:db8::1]')).toBe('[2001:db8::1]');
    expect(normalizeHost('[::1]')).toBe('[::1]');
  });

  it('strips scheme, port and path around an IPv6 literal', () => {
    expect(normalizeHost('http://[2001:db8::1]:8080/path?q=1')).toBe('[2001:db8::1]');
  });

  it('returns null for a scheme that carries no host', () => {
    expect(normalizeHost('about:blank')).toBeNull();
    expect(normalizeHost('mailto:someone@example.com')).toBeNull();
  });

  it('still reads a bare host:port as a host', () => {
    expect(normalizeHost('example.com:8080/path')).toBe('example.com');
  });
});

describe('isDenied', () => {
  it('is false for an empty list', () => {
    expect(isDenied('example.com', [])).toBe(false);
  });

  it('matches the exact host', () => {
    expect(isDenied('example.com', ['example.com'])).toBe(true);
  });

  it('matches a subdomain of a listed host', () => {
    expect(isDenied('app.example.com', ['example.com'])).toBe(true);
    expect(isDenied('a.b.example.com', ['example.com'])).toBe(true);
  });

  it('does not match a lookalike host', () => {
    expect(isDenied('notexample.com', ['example.com'])).toBe(false);
    expect(isDenied('example.com.evil.net', ['example.com'])).toBe(false);
  });

  it('does not match a parent of a listed host', () => {
    expect(isDenied('example.com', ['app.example.com'])).toBe(false);
  });

  it('is case insensitive on both sides', () => {
    expect(isDenied('APP.Example.com', ['example.COM'])).toBe(true);
  });

  it('ignores unnormalizable entries', () => {
    expect(isDenied('example.com', ['', '  ', 'example.com'])).toBe(true);
  });

  it('does not confuse distinct IPv6 hosts', () => {
    expect(isDenied('[2001:db8::1]', ['[2001:db8::9999]'])).toBe(false);
    expect(isDenied('[::2]', ['[::1]'])).toBe(false);
  });

  it('matches an IPv6 host against its own entry', () => {
    expect(isDenied('[2001:db8::1]', ['[2001:db8::1]'])).toBe(true);
  });
});
