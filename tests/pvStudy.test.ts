import { describe, expect, it } from 'vitest';
import {
  clampPvIndex,
  pvAnimationDuration,
  pvStepGap,
  replayPvPosition,
  sanitizePvLine,
} from '../src/lib/pvStudy';

describe('v0.8.7 principal-variation study helpers', () => {
  it('sanitizes UCI lines and keeps promotions', () => {
    expect(sanitizePvLine(['e2e4', 'e7e5', 'bad', 'a7a8q'])).toEqual(['e2e4', 'e7e5', 'a7a8q']);
  });

  it('clamps navigation indices', () => {
    expect(clampPvIndex(-4, 8)).toBe(0);
    expect(clampPvIndex(3, 8)).toBe(3);
    expect(clampPvIndex(99, 8)).toBe(8);
  });

  it('rebuilds a PV deterministically at any requested ply', () => {
    const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const line = ['e2e4', 'e7e5', 'g1f3', 'b8c6'];
    const replayed = replayPvPosition(start, line, 3);

    expect(replayed.index).toBe(3);
    expect(replayed.lastMove).toEqual({ from: 'g1', to: 'f3' });
    expect(replayed.fen.split(' ')[1]).toBe('b');
  });

  it('makes faster playback use shorter animation and pause gaps', () => {
    expect(pvAnimationDuration(2)).toBeLessThan(pvAnimationDuration(1));
    expect(pvStepGap(2)).toBeLessThan(pvStepGap(1));
    expect(pvAnimationDuration(0.5)).toBeGreaterThan(pvAnimationDuration(1));
  });
});
