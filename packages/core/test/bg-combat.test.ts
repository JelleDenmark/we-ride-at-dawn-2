import './lib/legacy-stats';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { UNIT_DEFS, type Lineup, type UnitDef } from '../src/data/units';
import { RULES, simulate, type BattleEvent } from '../src/sim';
import { simulateDuel } from '../src/duel';
import { generateGauntlet } from '../src/gauntlet';
import { xorshift128 } from '../src/prng';
import { randomBoard } from './lib/random-board';

// Test-only rats (cost 0, so the shop and random boards never see them).
const TEST_DEFS: UnitDef[] = [
  { id: 't-hitter', name: 'Hitter', attack: 1, health: 100, cost: 0 },
  { id: 't-fodder', name: 'Fodder', attack: 0, health: 40, cost: 0 },
  { id: 't-taunt', name: 'Taunt', attack: 0, health: 40, cost: 0, taunt: true },
  { id: 't-weak', name: 'Weak', attack: 0, health: 3, cost: 0 },
  { id: 't-sniper', name: 'Sniper', attack: 1, health: 100, cost: 0, targeting: 'weakest' },
  { id: 't-cleaver', name: 'Cleaver', attack: 2, health: 100, cost: 0, cleave: true },
  { id: 't-wall', name: 'Wall', attack: 1, health: 1000, cost: 0 },
  {
    id: 't-summoner', name: 'Summoner', attack: 1, health: 1, cost: 0,
    ability: { trigger: 'faint', effect: { kind: 'summon', unitId: 'pup', count: 1 } },
  },
];

beforeAll(() => {
  for (const d of TEST_DEFS) UNIT_DEFS[d.id] = d;
  RULES.combat = 'bg';
});
afterAll(() => {
  for (const d of TEST_DEFS) delete UNIT_DEFS[d.id];
  RULES.combat = 'queue';
});

const board = (...ids: string[]): Lineup => ({ units: ids.map((defId) => ({ defId })), combatCap: ids.length + 2 });
const waveStart = (events: BattleEvent[]) => events.find((e) => e.type === 'waveStart') as Extract<BattleEvent, { type: 'waveStart' }>;
const clashes = (events: BattleEvent[]) => events.filter((e): e is Extract<BattleEvent, { type: 'clash' }> => e.type === 'clash');
/** First `n` horde-side attackers, one per round (the first clash of each round). */
const hordeAttackers = (events: BattleEvent[], n: number) => clashes(events).filter((_, i) => i % 2 === 0).slice(0, n).map((c) => c.hordeId);

describe('bg combat: rules switch', () => {
  it('queue stays the default', async () => {
    RULES.combat = 'queue';
    const clash = clashes(simulateDuel(board('t-hitter'), board('t-hitter')).events);
    // queue mode: one clash event per tick, the two fronts.
    expect(clash.length).toBeGreaterThan(0);
    expect(clash.every((c) => c.hordeId === 1)).toBe(true);
    RULES.combat = 'bg';
  });
});

describe('bg combat: duel fairness', () => {
  it('a mirror always draws', () => {
    const rng = xorshift128(1);
    for (let i = 0; i < 300; i++) {
      const b = randomBoard(rng);
      expect(simulateDuel(b, b, 'night').result.winner).toBe('draw');
    }
  });

  it('swapping seats never changes who wins', () => {
    const rng = xorshift128(2);
    const bad: number[] = [];
    for (let i = 0; i < 1500; i++) {
      const a = randomBoard(rng);
      const b = randomBoard(rng);
      const seed = `n${i % 7}`;
      const ab = simulateDuel(a, b, seed).result.winner;
      const ba = simulateDuel(b, a, seed).result.winner;
      const flipped = ab === 'a' ? 'b' : ab === 'b' ? 'a' : 'draw';
      if (ba !== flipped) bad.push(i);
    }
    expect(bad).toEqual([]);
  });

  it('is deterministic: same inputs, byte-identical events', () => {
    const rng = xorshift128(3);
    for (let i = 0; i < 50; i++) {
      const a = randomBoard(rng);
      const b = randomBoard(rng);
      expect(JSON.stringify(simulateDuel(a, b, 'n'))).toBe(JSON.stringify(simulateDuel(a, b, 'n')));
    }
  });

  it('the seed changes the dice but only through the seed', () => {
    const rng = xorshift128(4);
    const a = randomBoard(rng);
    const b = randomBoard(rng);
    const logs = new Set(['x', 'y', 'z', 'w', 'v'].map((s) => JSON.stringify(simulateDuel(a, b, s).events)));
    expect(logs.size).toBeGreaterThan(1);
  });
});

describe('bg combat: attack order', () => {
  it('each side cycles left to right over its living rats', () => {
    const { events } = simulateDuel(board('t-hitter', 't-hitter', 't-hitter'), board('t-wall'), 's');
    const ids = waveStart(events).enemies.length; // enemies exist
    expect(ids).toBe(1);
    expect(hordeAttackers(events, 7)).toEqual([1, 2, 3, 1, 2, 3, 1]);
  });

  it('a summoned rat joins the order at its board position', () => {
    // [summoner, hitter] vs a wall. The summoner attacks and falls in round 1,
    // its pup takes its slot and attacks next, then the hitter, then the pup again.
    const pupDef = UNIT_DEFS.pup;
    const base = pupDef.health;
    pupDef.health = 100; // a pup that outlives the rounds we watch
    let events: BattleEvent[];
    try {
      events = simulateDuel(board('t-summoner', 't-hitter'), board('t-wall'), 's').events;
    } finally {
      pupDef.health = base;
    }
    const pup = (events.find((e) => e.type === 'summon') as Extract<BattleEvent, { type: 'summon' }>).unit.instanceId;
    const hitter = 2;
    expect(hordeAttackers(events, 5)).toEqual([1, pup, hitter, pup, hitter]);
  });
});

describe('bg combat: targeting', () => {
  it('attackers must pick a taunt while one lives', () => {
    const { events } = simulateDuel(board('t-hitter', 't-hitter', 't-hitter'), board('t-fodder', 't-taunt', 't-fodder'), 's');
    const taunt = waveStart(events).enemies[1].instanceId;
    const horde = clashes(events).filter((_, i) => i % 2 === 0).slice(0, 30);
    expect(horde.length).toBe(30);
    expect(horde.every((c) => c.enemyId === taunt)).toBe(true);
  });

  it('without a taunt the target is random across the board', () => {
    const { events } = simulateDuel(board('t-hitter', 't-hitter', 't-hitter'), board('t-fodder', 't-fodder', 't-fodder'), 's');
    const hit = new Set(clashes(events).filter((_, i) => i % 2 === 0).slice(0, 30).map((c) => c.enemyId));
    expect(hit.size).toBe(3);
  });

  it('a sniper ignores taunt and takes the weakest rat', () => {
    const { events } = simulateDuel(board('t-sniper'), board('t-taunt', 't-fodder', 't-weak'), 's');
    const weak = waveStart(events).enemies[2].instanceId;
    expect(clashes(events)[0].enemyId).toBe(weak);
  });

  it('a strongest sniper picks the highest attack', () => {
    UNIT_DEFS['t-hunter'] = { id: 't-hunter', name: 'Hunter', attack: 1, health: 100, cost: 0, targeting: 'strongest' };
    UNIT_DEFS['t-brute'] = { id: 't-brute', name: 'Brute', attack: 9, health: 100, cost: 0 };
    try {
      const { events } = simulateDuel(board('t-hunter'), board('t-taunt', 't-brute', 't-fodder'), 's');
      expect(clashes(events)[0].enemyId).toBe(waveStart(events).enemies[1].instanceId);
    } finally {
      delete UNIT_DEFS['t-hunter'];
      delete UNIT_DEFS['t-brute'];
    }
  });
});

describe('bg combat: cleave', () => {
  it('hits the target and both neighbours, who do not hit back', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const { events } = simulateDuel(board('t-cleaver'), board('t-fodder', 't-fodder', 't-fodder', 't-fodder', 't-fodder'), seed);
      const foes = waveStart(events).enemies.map((e) => e.instanceId);
      const target = clashes(events)[0].enemyId;
      const at = foes.indexOf(target);
      const firstRound = events.slice(0, events.findIndex((e) => e.type === 'death' || e.type === 'poisonTick' || (e.type === 'clash' && e !== clashes(events)[0] && e !== clashes(events)[1])));
      const damaged = firstRound.filter((e) => e.type === 'damage' && foes.includes(e.targetId)).map((e) => (e as { targetId: number }).targetId);
      // The target and its neighbours, plus the enemy attacker (foes[0]) that the cleaver
      // answers as an ordinary target of its own swing.
      const expected = foes.filter((_, i) => Math.abs(i - at) <= 1 || i === 0);
      expect([...new Set(damaged)].sort()).toEqual(expected.sort());
      // Fodder has no attack, so the cleaver only ever takes the 1-per-armor-floor answers: at most
      // one answer (from the target) plus the enemy attacker's own swing.
      const onCleaver = firstRound.filter((e) => e.type === 'damage' && e.targetId === 1);
      expect(onCleaver.length).toBeLessThanOrEqual(2);
    }
  });
});

describe('bg combat: abilities', () => {
  it('Ward-Weaver style block charges absorb a hit taken by any rat', () => {
    UNIT_DEFS['t-ward'] = { id: 't-ward', name: 'Ward', attack: 0, health: 100, cost: 0, ability: { trigger: 'startOfWave', effect: { kind: 'blockFrontHits' } } };
    try {
      // Ward at the back; the attacker's target is random, yet the first hit on the side is absorbed.
      const { events } = simulateDuel(board('t-fodder', 't-fodder', 't-ward'), board('t-wall'), 's');
      const first = events.findIndex((e) => e.type === 'shieldAbsorbed');
      expect(first).toBeGreaterThan(-1);
      const hitBeforeAbsorb = events.slice(0, first).some((e) => e.type === 'damage' && e.targetId <= 3);
      expect(hitBeforeAbsorb).toBe(false);
    } finally {
      delete UNIT_DEFS['t-ward'];
    }
  });

  it('poisonFrontEnemy poisons a random enemy, ignoring taunt', () => {
    const hit = new Set<number>();
    for (let i = 0; i < 40; i++) {
      const { events } = simulateDuel(board('plague-bearer'), board('t-taunt', 't-fodder', 't-fodder'), `p${i}`);
      const e = events.find((x) => x.type === 'poisonApplied') as { targetId: number };
      hit.add(e.targetId);
    }
    expect(hit.size).toBeGreaterThan(1);
  });
});

describe('bg combat: PvE raids', () => {
  it('runs the gauntlet deterministically', () => {
    const g = generateGauntlet('2026-11-03', 1, 7);
    const lineup: Lineup = { units: ['dire-rat', 'ward-weaver', 'plague-bearer'].map((defId) => ({ defId, tier: 2 })), combatCap: 5 };
    const a = simulate(lineup, g);
    const b = simulate(lineup, g);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.result.wavesCleared).toBeGreaterThan(0);
  });
});
