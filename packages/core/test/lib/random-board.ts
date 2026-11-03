import { UNIT_DEFS, type Lineup } from '../../src/data/units';
import { RELIC_DEFS } from '../../src/data/relics';
import type { Rng } from '../../src/prng';

const BUYABLE = Object.values(UNIT_DEFS).filter((u) => u.cost > 0).map((u) => u.id).sort();
const UNIT_RELICS = Object.values(RELIC_DEFS).filter((r) => r.scope === 'unit').map((r) => r.id).sort();
const TEAM_RELICS = Object.values(RELIC_DEFS).filter((r) => r.scope === 'team').map((r) => r.id).sort();

/** A random legal board: 3-7 units, tiers 1-3, up to 3 relics each, 0-1 team relic. */
export function randomBoard(rng: Rng): Lineup {
  const n = 3 + rng.int(5);
  const units = Array.from({ length: n }, () => {
    const relicIds: string[] = [];
    const k = rng.int(4);
    for (let i = 0; i < k; i++) {
      const id = UNIT_RELICS[rng.int(UNIT_RELICS.length)];
      if (!relicIds.includes(id)) relicIds.push(id);
    }
    return { defId: BUYABLE[rng.int(BUYABLE.length)], tier: 1 + rng.int(3), relicIds };
  });
  const teamRelicIds = rng.int(2) ? [TEAM_RELICS[rng.int(TEAM_RELICS.length)]] : [];
  return { units, teamRelicIds, combatCap: n + 2 };
}
