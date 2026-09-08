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
});
