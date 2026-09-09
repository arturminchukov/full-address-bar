// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createPageShift } from './page-shift';

afterEach(() => {
  document.documentElement.removeAttribute('style');
});

describe('createPageShift', () => {
  it('pushes the document down by the given height', () => {
    createPageShift(document).apply(28, 'top');
    expect(document.documentElement.style.getPropertyValue('margin-top')).toBe('28px');
    expect(document.documentElement.style.getPropertyPriority('margin-top')).toBe('important');
  });

  it('restores an absent inline margin on revert', () => {
    const shift = createPageShift(document);
    shift.apply(28, 'top');
    shift.revert();
    expect(document.documentElement.style.getPropertyValue('margin-top')).toBe('');
  });

  it('restores a pre-existing inline margin on revert', () => {
    document.documentElement.style.marginTop = '10px';
    const shift = createPageShift(document);
    shift.apply(28, 'top');
    expect(document.documentElement.style.getPropertyValue('margin-top')).toBe('28px');
    shift.revert();
    expect(document.documentElement.style.getPropertyValue('margin-top')).toBe('10px');
  });

  it('is idempotent: applying twice still reverts to the original', () => {
    document.documentElement.style.marginTop = '10px';
    const shift = createPageShift(document);
    shift.apply(28, 'top');
    shift.apply(28, 'top');
    shift.revert();
    expect(document.documentElement.style.getPropertyValue('margin-top')).toBe('10px');
  });

  it('reverting without applying does nothing', () => {
    document.documentElement.style.marginTop = '10px';
    createPageShift(document).revert();
    expect(document.documentElement.style.getPropertyValue('margin-top')).toBe('10px');
  });
});

describe('createPageShift — bottom edge', () => {
  it('pushes the document up by the given height', () => {
    createPageShift(document).apply(28, 'bottom');
    expect(document.documentElement.style.getPropertyValue('margin-bottom')).toBe('28px');
    expect(document.documentElement.style.getPropertyValue('margin-top')).toBe('');
  });

  it('restores a pre-existing inline margin on revert', () => {
    document.documentElement.style.marginBottom = '7px';
    const shift = createPageShift(document);
    shift.apply(28, 'bottom');
    shift.revert();
    expect(document.documentElement.style.getPropertyValue('margin-bottom')).toBe('7px');
  });

  it('releases the old edge when the position changes', () => {
    const shift = createPageShift(document);
    shift.apply(28, 'top');
    shift.apply(28, 'bottom');
    expect(document.documentElement.style.getPropertyValue('margin-top')).toBe('');
    expect(document.documentElement.style.getPropertyValue('margin-bottom')).toBe('28px');
    shift.revert();
    expect(document.documentElement.style.getPropertyValue('margin-bottom')).toBe('');
  });

  it('restores each edge’s own margin across a switch', () => {
    document.documentElement.style.marginTop = '5px';
    document.documentElement.style.marginBottom = '9px';
    const shift = createPageShift(document);
    shift.apply(28, 'top');
    shift.apply(28, 'bottom');
    expect(document.documentElement.style.getPropertyValue('margin-top')).toBe('5px');
    shift.revert();
    expect(document.documentElement.style.getPropertyValue('margin-bottom')).toBe('9px');
  });
});
