import { describe, expect, it } from 'vitest';
import { pointerAtEdge, scrollIntent, REVEAL_THRESHOLD_PX } from './reveal-policy';

const VIEW = 800;

describe('pointerAtEdge — bar at the top', () => {
  const probe = (y: number) => ({ y, viewportHeight: VIEW, position: 'top' as const });

  it('reveals when the pointer touches the top edge', () => {
    expect(pointerAtEdge(probe(0))).toBe(true);
    expect(pointerAtEdge(probe(REVEAL_THRESHOLD_PX))).toBe(true);
  });

  it('does not reveal just past the threshold', () => {
    expect(pointerAtEdge(probe(REVEAL_THRESHOLD_PX + 1))).toBe(false);
    expect(pointerAtEdge(probe(400))).toBe(false);
  });

  it('does not reveal from the opposite edge', () => {
    expect(pointerAtEdge(probe(VIEW))).toBe(false);
  });
});

describe('pointerAtEdge — bar at the bottom', () => {
  const probe = (y: number) => ({ y, viewportHeight: VIEW, position: 'bottom' as const });

  it('reveals when the pointer touches the bottom edge', () => {
    expect(pointerAtEdge(probe(VIEW))).toBe(true);
    expect(pointerAtEdge(probe(VIEW - REVEAL_THRESHOLD_PX))).toBe(true);
  });

  it('does not reveal just past the threshold', () => {
    expect(pointerAtEdge(probe(VIEW - REVEAL_THRESHOLD_PX - 1))).toBe(false);
    expect(pointerAtEdge(probe(400))).toBe(false);
  });

  it('does not reveal from the opposite edge', () => {
    expect(pointerAtEdge(probe(0))).toBe(false);
  });
});

describe('pointerAtEdge — custom threshold', () => {
  it('honours a wider threshold', () => {
    expect(pointerAtEdge({ y: 20, viewportHeight: VIEW, position: 'top' }, 24)).toBe(true);
  });
});

describe('scrollIntent', () => {
  it('reveals at the top of the page regardless of direction', () => {
    expect(scrollIntent({ scrollY: 0, previousScrollY: 500 })).toBe('reveal');
    expect(scrollIntent({ scrollY: 0, previousScrollY: 0 })).toBe('reveal');
  });

  it('treats a negative scroll position as the top (rubber-banding)', () => {
    expect(scrollIntent({ scrollY: -30, previousScrollY: 0 })).toBe('reveal');
  });

  it('conceals while scrolling down', () => {
    expect(scrollIntent({ scrollY: 400, previousScrollY: 200 })).toBe('conceal');
  });

  it('reveals while scrolling up', () => {
    expect(scrollIntent({ scrollY: 200, previousScrollY: 400 })).toBe('reveal');
  });

  it('ignores movement below the noise threshold', () => {
    expect(scrollIntent({ scrollY: 402, previousScrollY: 400 })).toBe('keep');
    expect(scrollIntent({ scrollY: 398, previousScrollY: 400 })).toBe('keep');
    expect(scrollIntent({ scrollY: 400, previousScrollY: 400 })).toBe('keep');
  });
});
