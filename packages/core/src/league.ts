import { UNIT_DEFS, type Lineup } from './data/units';
import { RELIC_DEFS } from './data/relics';
import { BOARD_CAP } from './sim';
import { MAX_TIER, MAX_RELICS_PER_RAT } from './shop';
import { simulateDuel } from './duel';
import { xorshift128 } from './prng';
import { fnv1a } from './seed';

/**
 * The nightly round. Every board duels every other board once; 3 points for a
 * win, 1 for a draw, 0 for a loss. Most points by Sunday wins the season.
 */
export const WIN_POINTS = 3;
export const DRAW_POINTS = 1;

export interface LeagueEntrant {
  id: string;
  board: Lineup;
}

export interface RoundStanding {
  id: string;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  /** Surviving health margin summed over the round. The tiebreak. */
  healthDiff: number;
}

/**
 * A repeated board should not replay an identical fight, so each night's seed
 * gives every rat -1, 0 or +1 attack before the duel. The combat engine is
 * untouched and the fight stays replayable: same (board, night seed) always
 * gives the same shifted board.
 */
export function applyNightVariation(board: Lineup, nightSeed: string, boardId: string): Lineup {
  const rng = xorshift128(fnv1a(`${nightSeed}:${boardId}`));
  return {
    ...board,
    units: board.units.map((u) => ({ ...u, attackMod: rng.int(3) - 1 })),
  };
}

/** Round robin. Standings sort by points, then health margin, then id. */
export function scoreRound(entrants: LeagueEntrant[], nightSeed?: string): RoundStanding[] {
  const boards = entrants.map((e) => (nightSeed ? applyNightVariation(e.board, nightSeed, e.id) : e.board));
  const n = entrants.length;
  const st = entrants.map((e) => ({ id: e.id, points: 0, wins: 0, draws: 0, losses: 0, healthDiff: 0 }));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const { result } = simulateDuel(boards[i], boards[j]);
      const diff = result.healthA - result.healthB;
      st[i].healthDiff += diff;
      st[j].healthDiff -= diff;
      if (result.winner === 'a') {
        st[i].points += WIN_POINTS; st[i].wins++; st[j].losses++;
      } else if (result.winner === 'b') {
        st[j].points += WIN_POINTS; st[j].wins++; st[i].losses++;
      } else {
        st[i].points += DRAW_POINTS; st[j].points += DRAW_POINTS; st[i].draws++; st[j].draws++;
      }
    }
  }
  return st.sort(
    (a, b) => b.points - a.points || b.healthDiff - a.healthDiff || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/** Structural legality only: real units, real relics, tiers and counts in range. */
export function validateBoard(board: Lineup): { ok: true } | { ok: false; reason: string } {
  if (board.units.length > BOARD_CAP) return { ok: false, reason: `too many units (${board.units.length})` };
  for (const u of board.units) {
    const def = UNIT_DEFS[u.defId];
    if (!def || !(def.cost > 0)) return { ok: false, reason: `not a buyable unit "${u.defId}"` };
    const tier = u.tier ?? 1;
    if (!Number.isInteger(tier) || tier < 1 || tier > MAX_TIER) return { ok: false, reason: `bad tier ${tier}` };
    if (u.attackMod !== undefined) return { ok: false, reason: 'board carries a night modifier' };
    if ((u.relicIds ?? []).length > MAX_RELICS_PER_RAT) return { ok: false, reason: 'too many relics on one rat' };
    const seen = new Set<string>();
    for (const id of u.relicIds ?? []) {
      if (RELIC_DEFS[id]?.scope !== 'unit' || seen.has(id)) return { ok: false, reason: `bad relic "${id}"` };
      seen.add(id);
    }
  }
  const seen = new Set<string>();
  for (const id of board.teamRelicIds ?? []) {
    if (RELIC_DEFS[id]?.scope !== 'team' || seen.has(id)) return { ok: false, reason: `bad team relic "${id}"` };
    seen.add(id);
  }
  return { ok: true };
}
