import type { Lineup } from './data/units';
import type { Gauntlet } from './gauntlet';
import { simulate, type BattleEvent, type UnitView } from './sim';

/** A duel brings its own opponent, so the gauntlet is empty. */
const NO_GAUNTLET: Gauntlet = {
  date: 'duel',
  seed: 0,
  theme: { primary: 'swarm', secondary: 'swarm', pivotWave: 1 },
  waves: [],
};

/**
 * One board-vs-board duel: the nightly fight. A single wave, both boards at
 * full tiers with their own relics and team relics, no wave scaling. The
 * engine is symmetric across the two seats, so `winner` belongs to the boards,
 * not to which one was passed first (test/duel.test.ts checks this).
 *
 * Deterministic: the same (a, b) always gives a byte-identical event log, so
 * the replay can re-run exactly what the nightly job scored.
 */
export interface DuelResult {
  winner: 'a' | 'b' | 'draw';
  survivorsA: UnitView[];
  survivorsB: UnitView[];
  /** Total health left on each side. The margin used as the round tiebreak. */
  healthA: number;
  healthB: number;
}

/**
 * Winner rules: one side wiped -> the other wins; both wiped -> draw; both
 * standing at the stalemate guard -> more surviving health, then more
 * surviving attack, else draw.
 */
export function simulateDuel(a: Lineup, b: Lineup): { events: BattleEvent[]; result: DuelResult } {
  const { events, result, enemySurvivors } = simulate(a, NO_GAUNTLET, b);
  const survivorsA = result.survivors;
  const survivorsB = enemySurvivors;
  const healthA = survivorsA.reduce((s, u) => s + u.health, 0);
  const healthB = survivorsB.reduce((s, u) => s + u.health, 0);

  let winner: DuelResult['winner'];
  if (survivorsA.length > 0 && survivorsB.length === 0) winner = 'a';
  else if (survivorsB.length > 0 && survivorsA.length === 0) winner = 'b';
  else if (survivorsA.length === 0) winner = 'draw';
  else if (healthA !== healthB) winner = healthA > healthB ? 'a' : 'b';
  else {
    const atkA = survivorsA.reduce((s, u) => s + u.attack, 0);
    const atkB = survivorsB.reduce((s, u) => s + u.attack, 0);
    winner = atkA > atkB ? 'a' : atkB > atkA ? 'b' : 'draw';
  }
  return { events, result: { winner, survivorsA, survivorsB, healthA, healthB } };
}
