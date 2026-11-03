import { describe, it, expect } from 'vitest';
import { simulateDuel } from '../src/duel';
import { scoreRound, applyNightVariation } from '../src/league';
import { randomBoard } from './lib/random-board';
import { xorshift128 } from '../src/prng';

describe('duel', () => {
  it('a mirror always draws', () => {
    const rng = xorshift128(1);
    for (let i = 0; i < 300; i++) {
      const b = randomBoard(rng);
      expect(simulateDuel(b, b).result.winner).toBe('draw');
    }
  });

  it('swapping seats never changes who wins', () => {
    const rng = xorshift128(2);
    const bad: number[] = [];
    for (let i = 0; i < 1500; i++) {
      const a = randomBoard(rng);
      const b = randomBoard(rng);
      const ab = simulateDuel(a, b).result.winner;
      const ba = simulateDuel(b, a).result.winner;
      const flipped = ab === 'a' ? 'b' : ab === 'b' ? 'a' : 'draw';
      if (ba !== flipped) bad.push(i);
    }
    expect(bad).toEqual([]);
  });

  it('is deterministic', () => {
    const rng = xorshift128(3);
    const a = randomBoard(rng);
    const b = randomBoard(rng);
    expect(JSON.stringify(simulateDuel(a, b))).toBe(JSON.stringify(simulateDuel(a, b)));
  });
});

describe('nightly round', () => {
  it('night variation shifts each rat by -1, 0 or +1 and is repeatable', () => {
    const board = randomBoard(xorshift128(4));
    const x = applyNightVariation(board, '2026-11-03', 'p1');
    expect(JSON.stringify(x)).toBe(JSON.stringify(applyNightVariation(board, '2026-11-03', 'p1')));
    for (const u of x.units) expect([-1, 0, 1]).toContain(u.attackMod);
  });

  it('scores 3 per win and 1 per draw, every pair once', () => {
    const rng = xorshift128(5);
    const entrants = ['a', 'b', 'c', 'd'].map((id) => ({ id, board: randomBoard(rng) }));
    const table = scoreRound(entrants, '2026-11-03');
    expect(table.reduce((s, r) => s + r.wins + r.draws + r.losses, 0)).toBe(12);
    for (const r of table) expect(r.points).toBe(r.wins * 3 + r.draws);
  });
});
