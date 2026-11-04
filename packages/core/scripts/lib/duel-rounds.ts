import { simulate } from '../../src/sim';
import { simulateDuel } from '../../src/duel';
import type { Lineup } from '../../src/data/units';
import { RULES } from '../../src/sim';

export { simulate };

/** Rounds one duel lasts: clash events, halved in bg mode (both attackers swing each round). */
export function simulateDuelRounds(a: Lineup, b: Lineup, seed: string): number {
  const { events } = simulateDuel(a, b, seed);
  const clashes = events.filter((e) => e.type === 'clash').length;
  return RULES.combat === 'bg' ? clashes / 2 : clashes;
}
