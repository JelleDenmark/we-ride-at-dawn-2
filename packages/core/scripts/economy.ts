/**
 * Weekly economy sim: a bot plays a whole 7-day week with the real shop
 * functions and the real raid sim, at a given number of raids per day, and we
 * report the day its board is FINISHED.
 *
 * FINISHED = 8 seats (BOARD_CAP), every rat at max tier (T3), every rat
 * carrying 2 unit relics, and 1 team relic.
 *
 * The bot: buys relics only onto T2+ rats, buys the 8th seat once the board is
 * full, buys units it already holds first (merge progress) and only ever
 * builds around the first 4 species it buys, rerolls only with a reserve. It spends before
 * every raid (a player who raids that often is checking the shop).
 *
 * Run:  npx tsx scripts/economy.ts   (from packages/core)
 * Env:  SEASONS (default 12), RAIDS (comma list, default 6,14,24)
 */
import { generateGauntlet } from '../src/gauntlet';
import { simulate, BOARD_CAP } from '../src/sim';
import { RELIC_DEFS } from '../src/data/relics';
import { UNIT_DEFS } from '../src/data/units';
import {
  newBuild, advanceAfterDawn, interestFor, scrapForDepth, recordDepth, lineupFromBuild,
  buyUnit, sellBenchUnit, buyRelic, buyBoardSlot, rerollShop, autoRerollShop, isShopDead, effectiveBoardCap,
  nextSlotPrice, MAX_TIER, SEASON_DAYS, DAILY_SCRAP, MILESTONES, INCOME_CAP, INCOME_CAP_DEPTH,
  type BuildState,
} from '../src/shop';

const RELICS_PER_RAT = 2;
const TEAM_RELICS = 1;
const RESERVE = 12; // scrap kept in hand before a reroll
const FOCUS = 2; // distinct unit species the bot builds around
let focus = new Set<string>();

const unitRelics = (u: { relicIds: string[] }) => u.relicIds.filter((id) => RELIC_DEFS[id]?.scope === 'unit').length;

function finished(s: BuildState): boolean {
  return (
    s.board.length >= BOARD_CAP &&
    s.board.every((u) => u.tier >= MAX_TIER && unitRelics(u) >= RELICS_PER_RAT) &&
    s.teamRelicIds.length >= TEAM_RELICS
  );
}

function step(s: BuildState): BuildState | null {
  // relics onto T2+ rats
  for (let i = 0; i < s.shop.slots.length; i++) {
    const slot = s.shop.slots[i];
    if (slot.kind !== 'relic') continue;
    const def = RELIC_DEFS[slot.relicId];
    if (s.scrap < def.cost) continue;
    if (def.scope === 'team') {
      if (s.board.filter((u) => u.tier >= 2).length < 3) continue;
      const r = buyRelic(s, i);
      if (r.ok) return r.state;
      continue;
    }
    const targets = s.board
      .map((u, idx) => ({ u, idx }))
      .filter(({ u }) => u.tier >= 2 && unitRelics(u) < RELICS_PER_RAT && !u.relicIds.includes(def.id))
      .sort((a, b) => b.u.tier - a.u.tier || unitRelics(a.u) - unitRelics(b.u));
    if (targets.length === 0) continue;
    const r = buyRelic(s, i, targets[0].idx);
    if (r.ok) return r.state;
  }
  // the 8th seat once the board is full
  if (effectiveBoardCap(s) < BOARD_CAP && s.board.length >= effectiveBoardCap(s)) {
    const price = nextSlotPrice(s);
    if (price !== undefined && s.scrap >= price) {
      const r = buyBoardSlot(s);
      if (r.ok) return r.state;
    }
  }
  // units: held species first, then costliest
  const held = new Map<string, number>();
  for (const u of [...s.board, ...s.bench]) held.set(u.defId, (held.get(u.defId) ?? 0) + 1);
  const picks: { i: number; held: number; cost: number }[] = [];
  s.shop.slots.forEach((slot, i) => {
    if (slot.kind !== 'unit') return;
    const h = held.get(slot.defId) ?? 0;
    if (!focus.has(slot.defId) && focus.size >= FOCUS) return;
    const probe = buyUnit(s, i);
    if (!probe.ok) return;
    picks.push({ i, held: h, cost: s.scrap - probe.state.scrap });
  });
  picks.sort((a, b) => b.held - a.held || b.cost - a.cost);
  if (picks.length > 0) {
    const r = buyUnit(s, picks[0].i);
    if (r.ok) {
      const slot = s.shop.slots[picks[0].i];
      if (slot.kind === 'unit') focus.add(slot.defId);
      return r.state;
    }
  }
  // room problem: a wanted copy is on offer but there is no space — sell a stray
  const wanted = s.shop.slots.find((sl) => sl.kind === 'unit' && focus.has(sl.defId) && s.scrap >= UNIT_DEFS[sl.defId].cost);
  if (wanted && wanted.kind === 'unit') {
    const strays = s.bench
      .map((u, idx) => ({ u, idx }))
      .filter(({ u }) => u.defId !== wanted.defId && u.tier < MAX_TIER)
      .sort((a, b) => a.u.tier - b.u.tier);
    if (strays.length > 0) {
      const r = sellBenchUnit(s, strays[0].idx);
      if (r.ok) return r.state;
    }
  }
  if (isShopDead(s)) {
    const r = autoRerollShop(s);
    if (r.ok) return r.state;
  }
  const saving = effectiveBoardCap(s) < BOARD_CAP && s.board.length >= effectiveBoardCap(s);
  if (!saving && s.scrap >= RESERVE + 2 && !finished(s)) {
    const r = rerollShop(s);
    if (r.ok) return r.state;
  }
  return null;
}

function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

interface WeekResult { finishedDay: number | null; depthByDay: number[]; t3ByDay: number[]; best: number; scrapSpent: number }

function playWeek(monday: string, raidsPerDay: number): WeekResult {
  let s = newBuild(monday, 1);
  focus = new Set();
  let finishedDay: number | null = null;
  const depthByDay: number[] = [];
  const t3ByDay: number[] = [];
  let guard = 0;
  for (let day = 1; day <= SEASON_DAYS; day++) {
    const gaunt = generateGauntlet(s.date, s.day);
    let lastDepth = 0;
    for (let r = 0; r < raidsPerDay; r++) {
      for (let n = 0; n < 200 && guard++ < 1e6; n++) {
        const next = step(s);
        if (!next) break;
        s = next;
      }
      if (finishedDay === null && finished(s)) finishedDay = day;
      lastDepth = s.board.length > 0 ? simulate(lineupFromBuild(s), gaunt).result.wavesCleared : 0;
      s = { ...s, scrap: s.scrap + scrapForDepth(lastDepth) };
      s = recordDepth(s, lastDepth).state;
    }
    depthByDay.push(lastDepth);
    t3ByDay.push(s.board.filter((u) => u.tier >= MAX_TIER).length);
    if (day < SEASON_DAYS) {
      const interest = interestFor(s.scrap);
      s = advanceAfterDawn(s, addDays(s.date, 1));
      s.scrap += interest;
    }
  }
  return { finishedDay, depthByDay, t3ByDay, best: s.bestDepth, scrapSpent: 0 };
}

const SEASONS = Number(process.env.SEASONS ?? 12);
const PROFILES = (process.env.RAIDS ?? '6,14,24').split(',').map(Number);
const mondays = Array.from({ length: SEASONS }, (_, k) => addDays('2026-07-06', 7 * k));

console.log(
  `income ${INCOME_CAP}/raid at depth ${INCOME_CAP_DEPTH} · start scrap ${DAILY_SCRAP} · milestones ${MILESTONES.map((m) => `${m.depth}:${m.scrap}`).join(' ')} · ${SEASONS} seasons`
);
for (const raids of PROFILES) {
  const res = mondays.map((m) => playWeek(m, raids));
  const days = res.map((r) => r.finishedDay);
  const dist = Array.from({ length: SEASON_DAYS }, (_, d) => days.filter((x) => x === d + 1).length);
  const never = days.filter((x) => x === null).length;
  const sorted = days.map((x) => x ?? 99).sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  const avg = (f: (r: WeekResult) => number[], d: number) => res.reduce((a, r) => a + f(r)[d], 0) / res.length;
  console.log(`\n${raids} raids/day  finish-day median ${med === 99 ? 'never' : med}  earliest ${sorted[0] === 99 ? '-' : sorted[0]}`);
  console.log('  finished on day  ' + dist.map((n, i) => `d${i + 1}:${n}`).join(' ') + ` never:${never}`);
  console.log('  depth at end of day  ' + [0, 1, 2, 3, 4, 5, 6].map((d) => `d${d + 1}:${avg((r) => r.depthByDay, d).toFixed(1)}`).join(' '));
  console.log('  T3 rats at end of day ' + [0, 1, 2, 3, 4, 5, 6].map((d) => `d${d + 1}:${avg((r) => r.t3ByDay, d).toFixed(1)}`).join(' '));
  console.log(`  full clears: ${res.filter((r) => r.best >= 20).length}/${SEASONS}  avg best depth ${(res.reduce((a, r) => a + r.best, 0) / SEASONS).toFixed(1)}`);
}
