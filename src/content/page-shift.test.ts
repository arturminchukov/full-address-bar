// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createPageShift } from './page-shift';

afterEach(() => {
  document.documentElement.removeAttribute('style');
});

describe('createPageShift', () => {
  it('pushes the document down by the given height', () => {
    createPageShift(document).apply(28);
    expect(document.documentElement.style.getPropertyValue('margin-top')).toBe('28px');
    expect(document.documentElement.style.getPropertyPriority('margin-top')).toBe('important');
  });

  it('restores an absent inline margin on revert', () => {
    const shift = createPageShift(document);
    shift.apply(28);
    shift.revert();
    expect(document.documentElement.style.getPropertyValue('margin-top')).toBe('');
  });

  it('restores a pre-existing inline margin on revert', () => {
    document.documentElement.style.marginTop = '10px';
    const shift = createPageShift(document);
    shift.apply(28);
    expect(document.documentElement.style.getPropertyValue('margin-top')).toBe('28px');
    shift.revert();
    expect(document.documentElement.style.getPropertyValue('margin-top')).toBe('10px');
  });

  it('is idempotent: applying twice still reverts to the original', () => {
    document.documentElement.style.marginTop = '10px';
    const shift = createPageShift(document);
    shift.apply(28);
    shift.apply(28);
    shift.revert();
    expect(document.documentElement.style.getPropertyValue('margin-top')).toBe('10px');
  });

  it('reverting without applying does nothing', () => {
    document.documentElement.style.marginTop = '10px';
    createPageShift(document).revert();
    expect(document.documentElement.style.getPropertyValue('margin-top')).toBe('10px');
  });
});
