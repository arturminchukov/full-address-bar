import { describe, expect, it } from 'vitest';
import { decodePercent, formatUrl, toNavigableUrl } from './url-format';

describe('decodePercent', () => {
  it('decodes a percent-encoded UTF-8 run', () => {
    expect(decodePercent('/%D0%BF%D1%83%D1%82%D1%8C')).toBe('/путь');
  });

  it('decodes runs inside a query string', () => {
    expect(decodePercent('?q=%D0%B4%D0%BE%D0%BC&page=2')).toBe('?q=дом&page=2');
  });

  it('leaves a malformed escape untouched', () => {
    expect(decodePercent('/a%ZZb')).toBe('/a%ZZb');
  });

  it('leaves an invalid UTF-8 sequence untouched', () => {
    expect(decodePercent('/%E0%A4%A')).toBe('/%E0%A4%A');
    expect(decodePercent('/%FF')).toBe('/%FF');
  });

  it('does not turn + into a space', () => {
    expect(decodePercent('?q=a+b')).toBe('?q=a+b');
  });

  it('returns an unescaped string unchanged', () => {
    expect(decodePercent('https://example.com/a/b')).toBe('https://example.com/a/b');
  });

  it('leaves a whole run encoded when one byte in it is invalid', () => {
    // Pins behaviour we chose to keep: a run is the decoding unit, so one bad
    // byte leaves its entire contiguous run percent-encoded.
    expect(decodePercent('/%D0%BF%FF%D0%BF')).toBe('/%D0%BF%FF%D0%BF');
  });
});

describe('formatUrl', () => {
  it('keeps the raw value alongside the display value', () => {
    const raw = 'https://example.com/%D0%B0?q=%D0%B1#%D0%B2';
    expect(formatUrl(raw)).toEqual({
      raw,
      display: 'https://example.com/а?q=б#в',
    });
  });

  it('passes non-http schemes through the same decoder', () => {
    expect(formatUrl('file:///Users/me/%D1%84.txt').display).toBe('file:///Users/me/ф.txt');
    expect(formatUrl('about:blank').display).toBe('about:blank');
  });

  it('skips decoding for very long values', () => {
    const raw = 'data:text/plain,' + '%D0%B0'.repeat(1000);
    expect(raw.length).toBeGreaterThan(4096);
    expect(formatUrl(raw).display).toBe(raw);
  });

  it('keeps a bidi override escaped instead of rendering it', () => {
    expect(formatUrl('https://evil.test/%E2%80%AEabc').display).toBe(
      'https://evil.test/%E2%80%AEabc',
    );
    expect(formatUrl('https://evil.test/%E2%80%AEabc').display).not.toContain('\u202E');
  });

  it('keeps a zero-width space escaped', () => {
    expect(formatUrl('https://evil.test/a%E2%80%8Bb').display).toBe(
      'https://evil.test/a%E2%80%8Bb',
    );
  });

  it('still decodes ordinary non-ASCII text', () => {
    expect(formatUrl('https://example.com/%D0%BF%D1%83%D1%82%D1%8C').display).toBe(
      'https://example.com/путь',
    );
  });

  it('handles the empty string', () => {
    expect(formatUrl('')).toEqual({ raw: '', display: '' });
  });
});

describe('toNavigableUrl', () => {
  it('keeps an absolute URL', () => {
    expect(toNavigableUrl('https://example.com/a?q=1')).toBe('https://example.com/a?q=1');
  });

  it('assumes https for a bare host', () => {
    expect(toNavigableUrl('example.com')).toBe('https://example.com/');
  });

  it('treats a bare host:port as a host, not a scheme', () => {
    expect(toNavigableUrl('localhost:3000')).toBe('https://localhost:3000/');
    expect(toNavigableUrl('127.0.0.1:8080')).toBe('https://127.0.0.1:8080/');
  });

  it('refuses schemes that are not navigations', () => {
    expect(toNavigableUrl('javascript:alert(1)')).toBeNull();
    expect(toNavigableUrl('data:text/html,<b>x</b>')).toBeNull();
  });

  it('refuses a scheme that is not navigable', () => {
    // "localhost:abc" parses as an unknown scheme; navigating to it does
    // nothing at all, so it must be reported as invalid instead.
    expect(toNavigableUrl('localhost:abc')).toBeNull();
    expect(toNavigableUrl('chrome://settings')).toBeNull();
  });

  it('keeps the schemes worth navigating to', () => {
    expect(toNavigableUrl('https://example.com/')).toBe('https://example.com/');
    expect(toNavigableUrl('mailto:a@b.com')).toBe('mailto:a@b.com');
  });

  it('refuses a value that is not a URL', () => {
    expect(toNavigableUrl('?q=1')).toBeNull();
    expect(toNavigableUrl('   ')).toBeNull();
  });
});
