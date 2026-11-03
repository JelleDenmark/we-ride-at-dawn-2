import './lib/legacy-stats';
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

describe('Corpse-Glutton growth cap', () => {
  it('stops growing after 4 allies fall', async () => {
    const { UNIT_DEFS } = await import('../src/data/units');
    const fx = UNIT_DEFS['corpse-glutton'].ability!.effect;
    expect(fx.kind === 'gainStats' && fx.maxGains).toBe(4);
    // Glutton behind six gutter-runts against a heavy board: runts fall, Glutton
    // grows, but never past its base stats + 4 gains.
    const a = { units: [...Array(6).fill({ defId: 'gutter-runt' }), { defId: 'corpse-glutton' }], combatCap: 9 };
    const b = { units: [{ defId: 'dire-rat', tier: 3 }], combatCap: 3 };
    const { events } = simulateDuel(a, b);
    const buffs = events.filter((e) => e.type === 'buff');
    expect(buffs.length).toBeLessThanOrEqual(4);
  });
});
