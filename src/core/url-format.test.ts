import { describe, expect, it } from 'vitest';
import { decodePercent, formatUrl } from './url-format';

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

  it('handles the empty string', () => {
    expect(formatUrl('')).toEqual({ raw: '', display: '' });
  });
});
