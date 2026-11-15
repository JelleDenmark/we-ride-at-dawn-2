/**
 * The weekly balance check. One script, run before each Monday reset:
 *
 *   npm run duel-sim -w @wrad/core                  # full report, tiers 1-3
 *   npm run duel-sim -w @wrad/core -- swing         # unit win swing only
 *   TIERS=2 SEEDS=1 npm run duel-sim -w @wrad/core  # quicker
 *   SET="draughtsman-moe.stacks=2,dire-rat.health=4" npm run duel-sim -w @wrad/core
 *
 * Boards are up to 7 rats with no relics, scored over NIGHTS night-variation
 * seeds. evolve and matrix spend a scrap BUDGET (a rat at tier t costs
 * cost x 3^(t-1), the copies a merge needs): 40 = early week, 150 = midweek,
 * 400 = late week. Read it as a comparison between versions, not a prediction.
 *  swing    : win-rate gap between random boards with and without each rat.
 *  evolve   : hill-climbs boards against each other (pooled over SEEDS runs);
 *             reports each rat's share of the winning boards and which strategy
 *             those boards play. Goal: several strategies, no rat on ~every board.
 *  matrix   : fixed strategy boards against each other. Goal: each has a loss.
 * SET=rat.field=value overrides a stat (attack, health, cost, damageReduction,
 * scavenge) or an ability field (count, stacks, maxGains, amount); use
 * rat.fx.attack / rat.fx.health for the ability's own attack/health, and
 * rules.reviveFraction for the revive rule.
 */
import { UNIT_DEFS, type Lineup } from '../src/data/units';
import { simulateDuel } from '../src/duel';
import { applyNightVariation } from '../src/league';
import { COMBAT_CAP_BONUS, RULES } from '../src/sim';
import { xorshift128, type Rng } from '../src/prng';

for (const kv of (process.env.SET ?? '').split(',').filter(Boolean)) {
  const [lhs, v] = kv.split('=');
  const [id, field, sub] = lhs.split('.');
  if (id === 'rules') { (RULES as Record<string, number>)[field] = Number(v); continue; }
  const def = UNIT_DEFS[id] as unknown as Record<string, unknown> & { ability?: { effect: Record<string, unknown> } };
  if (!def) throw new Error(`SET: unknown rat ${id}`);
  if (field === 'fx' && def.ability && sub) def.ability.effect[sub] = Number(v);
  else if (field in def) def[field] = Number(v);
  else if (def.ability && field in def.ability.effect) def.ability.effect[field] = Number(v);
  else if (field === 'damageReduction' || field === 'scavenge') def[field] = Number(v);
  else throw new Error(`SET: ${id} has no field ${field}`);
}

const SIZE = 7;
const NIGHTS = Number(process.env.NIGHTS ?? 3);
const SEEDS = (process.env.SEEDLIST ?? '22,7,91').split(',').map(Number).slice(0, Number(process.env.SEEDS ?? 3));
const BUDGETS = (process.env.BUDGETS ?? '40,150,400').split(',').map(Number);
const IDS = Object.values(UNIT_DEFS).filter((u) => u.cost > 0).map((u) => u.id).sort();

export const STRATEGY: Record<string, string> = {
  'gutter-runt': 'swarm', 'rat-piper': 'swarm', 'brood-mother': 'swarm',
  'plague-bearer': 'plague', 'draughtsman-moe': 'plague', 'rot-chemist': 'plague',
  gnawer: 'sacrifice', 'bone-priest': 'sacrifice', 'corpse-glutton': 'sacrifice',
  'dire-rat': 'bruiser', 'md-rattyfock': 'bruiser', 'press-kin': 'bruiser', 'ward-weaver': 'bruiser',
};
const BOARDS: Record<string, string[]> = {
  swarm: ['rat-piper', 'rat-piper', 'brood-mother', 'brood-mother', 'corpse-glutton', 'rat-piper', 'brood-mother'],
  plague: ['dire-rat', 'plague-bearer', 'plague-bearer', 'rot-chemist', 'draughtsman-moe', 'draughtsman-moe', 'ward-weaver'],
  sacrifice: ['gnawer', 'gnawer', 'corpse-glutton', 'gnawer', 'bone-priest', 'corpse-glutton', 'bone-priest'],
  bruiser: ['dire-rat', 'md-rattyfock', 'press-kin', 'dire-rat', 'press-kin', 'dire-rat', 'ward-weaver'],
};

/** A board: rats in fight order with their tiers. */
type Board = { id: string; tier: number }[];
const lineup = (b: Board): Lineup => ({ units: b.map((u) => ({ defId: u.id, tier: u.tier })), combatCap: b.length + COMBAT_CAP_BONUS });
const price = (b: Board) => b.reduce((s, u) => s + UNIT_DEFS[u.id].cost * 3 ** (u.tier - 1), 0);
const atTier = (ids: string[], tier: number): Board => ids.map((id) => ({ id, tier }));
/** a's score against b, 1 win / 0.5 draw / 0 loss, averaged over night seeds. */
function score(a: Board, b: Board): number {
  let s = 0;
  for (let n = 0; n < NIGHTS; n++) {
    const w = simulateDuel(applyNightVariation(lineup(a), `n${n}`, 'a'), applyNightVariation(lineup(b), `n${n}`, 'b')).result.winner;
    s += w === 'a' ? 1 : w === 'draw' ? 0.5 : 0;
  }
  return s / NIGHTS;
}
const randomIds = (rng: Rng) => Array.from({ length: SIZE }, () => IDS[rng.int(IDS.length)]);
/** The strategy a board plays: 3+ rats of one strategy and no tie, else mixed. */
function classify(b: Board): string {
  const c: Record<string, number> = {};
  for (const { id } of b) c[STRATEGY[id]] = (c[STRATEGY[id]] ?? 0) + 1;
  const e = Object.entries(c).sort((x, y) => y[1] - x[1]);
  return e[0][1] >= 3 && !(e[1] && e[1][1] === e[0][1]) ? e[0][0] : 'mixed';
}

/** Fixed-tier swing (cost-blind): the quick per-rat signal. */
function swing(tier: number): string {
  const rng = xorshift128(11);
  const opp = Array.from({ length: 150 }, () => atTier(randomIds(rng), tier));
  const w: Record<string, number[]> = {}, wo: Record<string, number[]> = {};
  for (const id of IDS) { w[id] = []; wo[id] = []; }
  for (let i = 0; i < 2000; i++) {
    const b = randomIds(rng);
    let s = 0;
    for (let k = 0; k < 6; k++) s += score(atTier(b, tier), opp[rng.int(opp.length)]);
    for (const id of IDS) (b.includes(id) ? w : wo)[id].push(s / 6);
  }
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  return IDS.map((id) => [id, (mean(w[id]) - mean(wo[id])) * 100] as const)
    .sort((a, b) => b[1] - a[1]).map(([id, d]) => `${id} ${d >= 0 ? '+' : ''}${d.toFixed(0)}`).join(', ');
}

/** Spend at most `budget`: drop tiers, then rats, until it fits. */
function repair(b: Board, budget: number, rng: Rng): Board {
  const c = b.map((u) => ({ ...u }));
  while (price(c) > budget && c.length) {
    const i = rng.int(c.length);
    if (c[i].tier > 1) c[i].tier--;
    else c.splice(i, 1);
  }
  return c;
}
function randomBoard(rng: Rng, budget: number): Board {
  const b: Board = [];
  for (let k = 0; k < 30 && b.length < SIZE; k++) {
    const u = { id: IDS[rng.int(IDS.length)], tier: 1 + (rng.int(3) === 0 ? rng.int(3) : 0) };
    if (price([...b, u]) <= budget) b.push(u);
  }
  return b;
}
function mutate(b: Board, budget: number, rng: Rng): Board {
  const c = b.map((u) => ({ ...u }));
  const op = rng.int(4);
  const i = rng.int(Math.max(1, c.length));
  if (op === 0 || !c.length) c.splice(i, c.length ? 1 : 0, { id: IDS[rng.int(IDS.length)], tier: c[i]?.tier ?? 1 });
  else if (op === 1) c[i].tier = Math.min(3, Math.max(1, c[i].tier + (rng.int(2) ? 1 : -1)));
  else if (op === 2 && c.length > 1) { const j = rng.int(c.length); [c[i], c[j]] = [c[j], c[i]]; }
  else if (c.length < SIZE) c.splice(rng.int(c.length + 1), 0, { id: IDS[rng.int(IDS.length)], tier: 1 });
  return repair(c, budget, rng);
}
function evolve(budget: number, seed: number): Board[] {
  const rng = xorshift128(seed);
  const POP = 50, GEN = 40;
  let pop = Array.from({ length: POP }, () => randomBoard(rng, budget));
  const fit = (p: Board[]) => p.map((b, i) => p.reduce((s, o, j) => (j === i ? s : s + score(b, o)), 0));
  for (let g = 0; g < GEN; g++) {
    const f = fit(pop);
    const keep = pop.map((_, i) => i).sort((a, b) => f[b] - f[a]).slice(0, POP / 2).map((i) => pop[i]);
    pop = [...keep, ...keep.map((b) => { let c = mutate(b, budget, rng); if (rng.int(2)) c = mutate(c, budget, rng); return c; })];
  }
  const f = fit(pop);
  return pop.map((_, i) => i).sort((a, b) => f[b] - f[a]).slice(0, 17).map((i) => pop[i]);
}
/** The fixed strategy boards, tiered up evenly to fit the budget. */
function strategyBoard(ids: string[], budget: number): Board {
  let b = atTier(ids, 1);
  for (let t = 2; t <= 3; t++) for (let i = 0; i < b.length; i++) {
    const up = b.map((u, j) => (j === i ? { ...u, tier: t } : u));
    if (price(up) <= budget) b = up;
  }
  while (price(b) > budget) b = b.slice(0, -1);
  return b;
}
const show = (b: Board) => b.map((u) => `${u.id}${u.tier > 1 ? '*' + u.tier : ''}`).join(', ');

const mode = process.argv[2];
if (mode === 'swing') {
  for (const tier of (process.env.TIERS ?? '1,2,3').split(',').map(Number)) console.log(`T${tier} swing: ${swing(tier)}`);
} else {
  for (const budget of BUDGETS) {
    const top = SEEDS.flatMap((s) => evolve(budget, s));
    const share = IDS.map((id) => [id, top.filter((b) => b.some((u) => u.id === id)).length / top.length] as const).sort((a, b) => b[1] - a[1]);
    const strat: Record<string, number> = {};
    for (const b of top) strat[classify(b)] = (strat[classify(b)] ?? 0) + 1;
    const names = Object.keys(BOARDS);
    const sb = Object.fromEntries(names.map((n) => [n, strategyBoard(BOARDS[n], budget)]));
    console.log(`B${budget} rats on winning boards: ${share.map(([i, p]) => `${i} ${Math.round(p * 100)}`).join(', ')}`);
    console.log(`B${budget} strategies: ${Object.entries(strat).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${Math.round((100 * n) / top.length)}`).join(', ')}`);
    console.log(`B${budget} matrix (row vs ${names.join('/')}): ${names.map((a) => `${a} ${names.map((b) => (a === b ? '--' : score(sb[a], sb[b]).toFixed(2))).join(' ')}`).join(' | ')}`);
    console.log(`B${budget} best: ${show(top[0])}`);
  }
}
