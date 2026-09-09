import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, parseSettings } from './settings';

describe('parseSettings', () => {
  it('returns the defaults for undefined', () => {
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it('returns the defaults for a non-object', () => {
    expect(parseSettings('nope')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('fills missing fields from the defaults', () => {
    expect(parseSettings({ enabled: false })).toEqual({
      enabled: false,
      theme: 'auto',
      position: 'top',
      autoHide: false,
      deniedHosts: [],
    });
  });

  it('accepts both positions', () => {
    expect(parseSettings({ position: 'bottom' }).position).toBe('bottom');
    expect(parseSettings({ position: 'top' }).position).toBe('top');
  });

  it('rejects an unknown position', () => {
    expect(parseSettings({ position: 'left' }).position).toBe('top');
    expect(parseSettings({ position: 1 }).position).toBe('top');
  });

  it('reads the auto-hide flag and rejects a wrongly typed one', () => {
    expect(parseSettings({ autoHide: true }).autoHide).toBe(true);
    expect(parseSettings({ autoHide: 'yes' }).autoHide).toBe(false);
  });

  it('rejects a wrongly typed enabled flag', () => {
    expect(parseSettings({ enabled: 'yes' }).enabled).toBe(true);
  });

  it('rejects an unknown theme', () => {
    expect(parseSettings({ theme: 'solarized' }).theme).toBe('auto');
  });

  it('accepts every known theme', () => {
    expect(parseSettings({ theme: 'light' }).theme).toBe('light');
    expect(parseSettings({ theme: 'dark' }).theme).toBe('dark');
    expect(parseSettings({ theme: 'auto' }).theme).toBe('auto');
  });

  it('keeps only string entries in deniedHosts', () => {
    expect(parseSettings({ deniedHosts: ['a.com', 42, null, 'b.com'] }).deniedHosts).toEqual([
      'a.com',
      'b.com',
    ]);
  });

  it('replaces a non-array deniedHosts with an empty list', () => {
    expect(parseSettings({ deniedHosts: 'a.com' }).deniedHosts).toEqual([]);
  });

  it('does not share the default array between results', () => {
    const a = parseSettings(undefined);
    a.deniedHosts.push('x.com');
    expect(parseSettings(undefined).deniedHosts).toEqual([]);
  });
});
