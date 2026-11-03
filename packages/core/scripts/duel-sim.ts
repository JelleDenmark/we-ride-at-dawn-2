/**
 * The weekly balance check. One script, run before each Monday:
 *
 *   npm run duel-sim -w @wrad/core                 # all three reports
 *   npm run duel-sim -w @wrad/core -- swing        # unit win swing only
 *   npm run duel-sim -w @wrad/core -- evolve       # evolved-board census
 *   npm run duel-sim -w @wrad/core -- matrix       # strategy matchups
 *
 * Boards are 7 units at one tier, no relics, the same setup the design page's
 * roster test used. Everything is seeded, so a run is repeatable.
 *
 *  swing  : win-rate gap between random boards with and without each unit.
 *  evolve : hill-climbs boards against each other, then reports how often each
 *           unit (and the Brood-Mother/Bone-Priest/Corpse-Glutton trio) shows
 *           up on the winning boards. Season check: no unit on more than ~60%.
 *  matrix : fixed Swarm / Plague / Sacrifice / Bruiser boards against each other.
 */
import { UNIT_DEFS, type Lineup } from '../src/data/units';
import { simulateDuel } from '../src/duel';
import { applyNightVariation } from '../src/league';
import { xorshift128, type Rng } from '../src/prng';

const TIER = Number(process.env.TIER ?? 2);
const SIZE = 7;
// Experiment knobs (env): EXCLUDE=draughtsman-moe,... drops units from the pool;
// CAP=n sets Corpse-Glutton's growth cap for this run.
const EXCLUDE = (process.env.EXCLUDE ?? '').split(',').filter(Boolean);
const IDS = Object.values(UNIT_DEFS).filter((u) => u.cost > 0 && !EXCLUDE.includes(u.id)).map((u) => u.id).sort();
if (process.env.CAP) {
  const fx = UNIT_DEFS['corpse-glutton'].ability!.effect;
  if (fx.kind === 'gainStats') fx.maxGains = Number(process.env.CAP);
}
// NIGHTS: each duel is averaged over this many night-variation seeds (-1/0/+1 attack per rat).
const NIGHTS = Number(process.env.NIGHTS ?? 4);
const TRIO = ['brood-mother', 'bone-priest', 'corpse-glutton'];

const board = (ids: string[], tier = TIER): Lineup => ({
  units: ids.map((defId) => ({ defId, tier })),
  combatCap: ids.length + 2,
});
const randomIds = (rng: Rng): string[] => Array.from({ length: SIZE }, () => IDS[rng.int(IDS.length)]);

/** Score for `a` against `b`: 1 win, 0.5 draw, 0 loss, averaged over NIGHTS night seeds. */
const score = (a: string[], b: string[]): number => {
  let t = 0;
  for (let n = 0; n < NIGHTS; n++) {
    const seed = `n${n}`;
    const w = simulateDuel(applyNightVariation(board(a), seed, 'a'), applyNightVariation(board(b), seed, 'b')).result.winner;
    t += w === 'a' ? 1 : w === 'draw' ? 0.5 : 0;
  }
  return t / NIGHTS;
};
const pct = (x: number) => (x * 100).toFixed(1).padStart(5);

function swing(): void {
  const rng = xorshift128(11);
  const N = Number(process.env.N ?? 4000);
  const opp = Array.from({ length: 200 }, () => randomIds(rng));
  const withU: Record<string, number[]> = {};
  const without: Record<string, number[]> = {};
  for (const id of IDS) { withU[id] = []; without[id] = []; }
  for (let i = 0; i < N; i++) {
    const b = randomIds(rng);
    let s = 0;
    for (let k = 0; k < 10; k++) s += score(b, opp[rng.int(opp.length)]);
    s /= 10;
    const has = new Set(b);
    for (const id of IDS) (has.has(id) ? withU : without)[id].push(s);
  }
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  console.log(`\nUnit win swing (points), tier ${TIER}, ${N} random ${SIZE}-unit boards`);
  const rows = IDS.map((id) => ({ id, d: (mean(withU[id]) - mean(without[id])) * 100 })).sort((a, b) => b.d - a.d);
  for (const r of rows) console.log(`  ${r.id.padEnd(16)} ${r.d >= 0 ? '+' : ''}${r.d.toFixed(1)}`);
}

/** One independent hill-climb; returns its top third of boards. */
function evolveOnce(seed: number): string[][] {
  const rng = xorshift128(seed);
  const POP = Number(process.env.POP ?? 60);
  const GEN = Number(process.env.GEN ?? 40);
  let pop = Array.from({ length: POP }, () => randomIds(rng));
  const fitness = (p: string[][]) =>
    p.map((b, i) => {
      let s = 0;
      for (let j = 0; j < p.length; j++) if (j !== i) s += score(b, p[j]);
      return s / (p.length - 1);
    });
  for (let g = 0; g < GEN; g++) {
    const f = fitness(pop);
    const order = pop.map((_, i) => i).sort((a, b) => f[b] - f[a]);
    const keep = order.slice(0, POP / 2).map((i) => pop[i]);
    const kids = keep.map((b) => {
      const c = [...b];
      c[rng.int(SIZE)] = IDS[rng.int(IDS.length)];
      if (rng.int(2)) c[rng.int(SIZE)] = IDS[rng.int(IDS.length)];
      return c;
    });
    pop = [...keep, ...kids];
  }
  const f = fitness(pop);
  return pop.map((_, i) => i).sort((a, b) => f[b] - f[a]).slice(0, Math.ceil(POP / 3)).map((i) => pop[i]);
}

// SEEDS independent runs are pooled: one run's top boards are all kin, so a single
// run overstates how often a unit shows up.
function evolve(): string[][] {
  const base = Number(process.env.SEED ?? 22);
  const SEEDS = Number(process.env.SEEDS ?? 3);
  const top = Array.from({ length: SEEDS }, (_, k) => evolveOnce(base + k * 101)).flat();
  console.log(`\nEvolved boards (${SEEDS} runs from seed ${base}), top ${top.length} by round-robin win rate`);
  const freq = IDS.map((id) => ({ id, p: top.filter((b) => b.includes(id)).length / top.length }));
  for (const r of freq.sort((a, b) => b.p - a.p)) console.log(`  ${r.id.padEnd(16)} on ${pct(r.p)}% of boards`);
  const trio = top.filter((b) => TRIO.every((u) => b.includes(u))).length / top.length;
  const any = top.filter((b) => TRIO.some((u) => b.includes(u))).length / top.length;
  console.log(`  trio together: ${pct(trio)}%   any of the trio: ${pct(any)}%`);
  console.log('  best board:', top[0].join(', '));
  return top;
}

const STRATEGIES: Record<string, string[]> = {
  swarm: ['rat-piper', 'rat-piper', 'brood-mother', 'brood-mother', 'press-kin', 'dawn-runt', 'dusk-runt'],
  plague: ['plague-bearer', 'plague-bearer', 'draughtsman-moe', 'plague-bearer', 'ward-weaver', 'md-rattyfock', 'dusk-runt'],
  sacrifice: ['gnawer', 'gnawer', 'corpse-glutton', 'brood-mother', 'bone-priest', 'corpse-glutton', 'gnawer'],
  bruiser: ['dire-rat', 'dire-rat', 'ward-weaver', 'md-rattyfock', 'press-kin', 'dawn-runt', 'dusk-runt'],
};

function matrix(): void {
  const names = Object.keys(STRATEGIES);
  console.log(`\nStrategy matchups, tier ${TIER} (row's win rate against column, 1.0 = every duel won)`);
  console.log('             ' + names.map((n) => n.padStart(10)).join(''));
  for (const a of names) {
    const row = names.map((b) => (a === b ? '        --' : score(STRATEGIES[a], STRATEGIES[b]).toFixed(2).padStart(10)));
    console.log(`  ${a.padEnd(11)}${row.join('')}`);
  }
}

const cmd = process.argv[2];
if (!cmd || cmd === 'swing') swing();
if (!cmd || cmd === 'matrix') matrix();
if (!cmd || cmd === 'evolve') evolve();
