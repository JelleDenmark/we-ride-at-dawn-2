// Roster v2 rules, tested against the LIVE stats (no legacy pins): tier-matched
// pups, fixed litters, hollow revives, linear buff scaling, Moe's target,
// Rot-Chemist's burst and Gutter Runt's scavenging.
import { describe, expect, it } from 'vitest';
import { simulate, RULES, type BattleEvent } from '../src/sim';
import { simulateDuel } from '../src/duel';
import type { Gauntlet } from '../src/gauntlet';
import { UNIT_DEFS, poisonStacksForTier, type UnitDef } from '../src/data/units';
import { raidScrap, scrapForDepth } from '../src/shop';

const dummy = (attack: number, health: number, extra: Partial<UnitDef> = {}): UnitDef => ({
  id: 'dummy', name: 'Dummy', attack, health, cost: 0, ...extra,
});
const gauntletOf = (...waves: UnitDef[][]): Gauntlet => ({
  date: 'test', seed: 0, waves: waves.map((units) => ({ units })),
});
const ofType = <T extends BattleEvent['type']>(events: BattleEvent[], type: T) =>
  events.filter((e): e is Extract<BattleEvent, { type: T }> => e.type === type);

describe('pups and litters', () => {
  it('a Rat-Piper pipes in a pup of its own tier', () => {
    for (const tier of [1, 2, 3]) {
      const { events } = simulate({ units: [{ defId: 'rat-piper', tier }] }, gauntletOf([dummy(0, 1)]));
      const pups = ofType(events, 'summon');
      expect(pups).toHaveLength(1);
      expect(pups[0].unit.tier).toBe(tier);
      // Pup is 1/1 base, so a t-tier pup is 3^(tier-1) / 3^(tier-1).
      expect(pups[0].unit.attack).toBe(3 ** (tier - 1));
      expect(pups[0].unit.health).toBe(3 ** (tier - 1));
    }
  });

  it('the litter size is fixed: tier changes the pups, not how many', () => {
    for (const tier of [1, 2, 3]) {
      const { events } = simulate(
        { units: [{ defId: 'brood-mother', tier }], combatCap: 8 },
        gauntletOf([dummy(1000, 100000)])
      );
      const litter = ofType(events, 'summon');
      expect(litter).toHaveLength(3);
      expect(litter.every((s) => s.unit.tier === tier)).toBe(true);
    }
  });
});

describe('Bone-Priest revive is hollow', () => {
  it('raises the fallen ally at half max health, rounded up', () => {
    const { events } = simulate(
      { units: [{ defId: 'dire-rat' }, { defId: 'bone-priest' }] },
      gauntletOf([dummy(5, 100)])
    );
    const revive = ofType(events, 'revive')[0];
    expect(revive.unit.defId).toBe('dire-rat');
    expect(revive.unit.health).toBe(Math.ceil(UNIT_DEFS['dire-rat'].health * RULES.reviveFraction));
    expect(revive.unit.health).toBe(2);
  });

  it('a revived Brood-Mother does not birth a second litter', () => {
    const { events } = simulate(
      { units: [{ defId: 'brood-mother' }, { defId: 'bone-priest' }], combatCap: 8 },
      gauntletOf([dummy(3, 200)])
    );
    const revive = ofType(events, 'revive')[0];
    expect(revive.unit.defId).toBe('brood-mother');
    const motherId = revive.unit.instanceId;
    expect(events.filter((e) => e.type === 'death' && e.unitId === motherId)).toHaveLength(2);
    expect(ofType(events, 'summon')).toHaveLength(3); // her first death only
  });

  it('a revived Rot-Chemist does not burst again', () => {
    const { events } = simulate(
      { units: [{ defId: 'rot-chemist' }, { defId: 'bone-priest' }] },
      gauntletOf([dummy(5, 300)])
    );
    const revive = ofType(events, 'revive')[0];
    expect(revive.unit.defId).toBe('rot-chemist');
    expect(ofType(events, 'poisonTick')).toHaveLength(1); // one burst, one foe
  });
});

describe('ability buffs scale 1/2/3', () => {
  it('Gnawer: +3 / +6 / +9 attack to the rat behind', () => {
    for (const tier of [1, 2, 3]) {
      const { events } = simulate(
        { units: [{ defId: 'gnawer', tier }, { defId: 'dire-rat', tier: 3 }] },
        gauntletOf([dummy(1000, 100000)])
      );
      const buff = ofType(events, 'buff')[0];
      expect(buff.attack).toBe(3 * tier);
    }
  });

  it('MD Rattyfock: +1 / +2 / +3 attack to every rat behind', () => {
    for (const tier of [1, 2, 3]) {
      const { events } = simulate(
        { units: [{ defId: 'md-rattyfock', tier }, { defId: 'gutter-runt' }, { defId: 'dire-rat' }] },
        gauntletOf([dummy(0, 1)])
      );
      const buffs = ofType(events, 'buff');
      expect(buffs).toHaveLength(2);
      expect(buffs.every((b) => b.attack === tier && b.health === 0)).toBe(true);
    }
  });

  it('Press-Kin: +1/+1, +2/+2, +3/+3 to both neighbours', () => {
    for (const tier of [1, 2, 3]) {
      const { events } = simulate(
        { units: [{ defId: 'gutter-runt' }, { defId: 'press-kin', tier }, { defId: 'gutter-runt' }] },
        gauntletOf([dummy(0, 1)])
      );
      const buffs = ofType(events, 'buff');
      expect(buffs).toHaveLength(2);
      expect(buffs.every((b) => b.attack === tier && b.health === tier)).toBe(true);
    }
  });

  it('Corpse-Glutton gains x tier (unchanged)', () => {
    const { events } = simulate(
      { units: [{ defId: 'gutter-runt' }, { defId: 'corpse-glutton', tier: 2 }] },
      gauntletOf([dummy(50, 10000)])
    );
    const buff = ofType(events, 'buff')[0];
    expect(buff.attack).toBe(2);
    expect(buff.health).toBe(2);
  });
});

describe('Draughtsman Moe hunts the hardest hitter', () => {
  it('poisons the highest-attack foe, not the front one', () => {
    const foes = [dummy(1, 500), dummy(7, 500), dummy(3, 500)];
    const { events } = simulate({ units: [{ defId: 'draughtsman-moe' }] }, gauntletOf(foes));
    const enemies = ofType(events, 'waveStart')[0].enemies;
    const applied = ofType(events, 'poisonApplied')[0];
    expect(applied.targetId).toBe(enemies[1].instanceId);
  });

  it('on an attack tie the foe nearest the front is hunted', () => {
    const { events } = simulate(
      { units: [{ defId: 'draughtsman-moe' }] },
      gauntletOf([dummy(2, 500), dummy(5, 500), dummy(5, 500)])
    );
    const enemies = ofType(events, 'waveStart')[0].enemies;
    expect(ofType(events, 'poisonApplied')[0].targetId).toBe(enemies[1].instanceId);
  });

  it('applies the tier poison table', () => {
    for (const tier of [1, 2, 3]) {
      const { events } = simulate(
        { units: [{ defId: 'draughtsman-moe', tier }] },
        gauntletOf([dummy(2, 500)])
      );
      expect(ofType(events, 'poisonApplied')[0].stacks).toBe(poisonStacksForTier(tier));
    }
  });
});

describe('Rot-Chemist burst', () => {
  const killer = (extra: Partial<UnitDef> = {}) => dummy(1000, 100000, extra);

  it('hits every living foe for 1 / 3 / 9 on faint', () => {
    for (const [tier, amount] of [[1, 1], [2, 3], [3, 9]] as const) {
      const { events } = simulate(
        { units: [{ defId: 'rot-chemist', tier }] },
        gauntletOf([killer(), killer(), killer()])
      );
      const ticks = ofType(events, 'poisonTick');
      expect(ticks).toHaveLength(3);
      expect(ticks.every((t) => t.amount === amount)).toBe(true);
    }
  });

  it('ignores armor', () => {
    const { events } = simulate(
      { units: [{ defId: 'rot-chemist', tier: 3 }] },
      gauntletOf([killer({ damageReduction: 6 })])
    );
    expect(ofType(events, 'poisonTick')[0].amount).toBe(9);
  });

  it('is seat-symmetric against a summoner dying on the same tick', () => {
    const a = { units: [{ defId: 'rot-chemist', tier: 1 }], combatCap: 6 };
    const b = { units: [{ defId: 'brood-mother', tier: 1 }], combatCap: 6 };
    const ab = simulateDuel(a, b).result.winner;
    const ba = simulateDuel(b, a).result.winner;
    const flipped = ab === 'a' ? 'b' : ab === 'b' ? 'a' : 'draw';
    expect(ba).toBe(flipped);
  });
});

describe('Gutter Runt scavenging', () => {
  it('raidScrap is the depth income when nobody scavenges', () => {
    expect(raidScrap(8, [])).toBe(scrapForDepth(8));
    expect(raidScrap(8, [{ defId: 'gnawer' }, { defId: 'dire-rat', tier: 3 }])).toBe(scrapForDepth(8));
    expect(raidScrap(8)).toBe(scrapForDepth(8));
  });

  it('adds a flat scavenge, and only one scavenger counts', () => {
    const per = UNIT_DEFS['gutter-runt'].scavenge!;
    expect(raidScrap(8, [{ defId: 'gutter-runt' }])).toBe(scrapForDepth(8) + per);
    const board = [{ defId: 'gutter-runt' }, { defId: 'gutter-runt', tier: 3 }, { defId: 'gnawer' }];
    expect(raidScrap(8, board)).toBe(scrapForDepth(8) + per);
  });
});
