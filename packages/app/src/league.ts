import type { Lineup } from '@wrad/core';
import { SUPABASE_URL, SUPABASE_ANON_KEY, deviceId } from './telemetry';
import { CHANNEL } from './env';

// Dev builds ride a parallel, prefixed season so testing never touches the
// public league.
export function leagueSeason(seasonId: string): string {
  return CHANNEL === 'dev' ? `dev-${seasonId}` : seasonId;
}

const TITLE_ADJ = ['Gutter', 'Sump', 'Midden', 'Drain', 'Warren', 'Blight', 'Rot', 'Grime', 'Cinder', 'Mange'];
const TITLE_NOUN = ['Warlord', 'Baron', 'Reeve', 'Marshal', 'Tyrant', 'Chief', 'Fang', 'Boss'];

export function defaultName(): string {
  const a = TITLE_ADJ[Math.floor(Math.random() * TITLE_ADJ.length)];
  const n = TITLE_NOUN[Math.floor(Math.random() * TITLE_NOUN.length)];
  return `${a}-${n}`;
}

export interface StandingRow {
  player_id: string;
  name: string;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  health_diff: number;
  nights: number;
}

export interface ResultRow {
  round_id: string;
  player_id: string;
  name: string;
  board: Lineup;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  health_diff: number;
  rank: number;
}

/** The latest closed round: `${season}#${rideDate}`; the night seed is the ride date. */
export interface Round {
  roundId: string;
  nightSeed: string;
  results: ResultRow[];
}

const HEADERS = { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
const PID_KEY = 'wrad2:playerid';

export function cachedPlayerId(): string | null {
  try {
    return localStorage.getItem(PID_KEY);
  } catch {
    return null;
  }
}

function rest(path: string): string {
  return `${SUPABASE_URL}/rest/v1/${path}`;
}

/** Upsert this device's board. Returns the public player id, or null on any failure. */
export async function submitBoard(args: {
  seasonId: string;
  name: string;
  board: Lineup;
  bestDepth: number;
}): Promise<string | null> {
  try {
    const res = await fetch(rest('rpc/league_submit_board'), {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        p_device_id: deviceId(),
        p_season: leagueSeason(args.seasonId),
        p_name: args.name,
        p_board: args.board,
        p_best_depth: args.bestDepth,
      }),
      keepalive: true,
    });
    if (!res.ok) return null;
    const id = (await res.json()) as unknown;
    if (typeof id !== 'string' || !id) return null;
    try {
      localStorage.setItem(PID_KEY, id);
    } catch {
      // Non-fatal.
    }
    return id;
  } catch {
    return null;
  }
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(rest(path), { headers: HEADERS });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export async function fetchStandings(seasonId: string): Promise<StandingRow[]> {
  const rows = await getJson<StandingRow[]>(
    `league_standings?season=eq.${encodeURIComponent(leagueSeason(seasonId))}` +
      `&order=points.desc,health_diff.desc,player_id.asc&limit=100`
  );
  return rows ?? [];
}

/** Results of the latest closed round of the season, best rank first. Null if none yet. */
export async function fetchLatestRound(seasonId: string): Promise<Round | null> {
  const season = encodeURIComponent(leagueSeason(seasonId));
  const latest = await getJson<{ round_id: string }[]>(
    `league_results?season=eq.${season}&select=round_id&order=round_id.desc&limit=1`
  );
  const roundId = latest?.[0]?.round_id;
  if (!roundId) return null;
  const results = await getJson<ResultRow[]>(
    `league_results?round_id=eq.${encodeURIComponent(roundId)}&order=rank.asc`
  );
  if (!results || results.length === 0) return null;
  return { roundId, nightSeed: roundId.split('#').pop() ?? roundId, results };
}

/** A player's most recent snapshotted board (for opening a board from the standings). */
export async function fetchBoardOf(seasonId: string, playerId: string): Promise<ResultRow | null> {
  const rows = await getJson<ResultRow[]>(
    `league_results?season=eq.${encodeURIComponent(leagueSeason(seasonId))}` +
      `&player_id=eq.${encodeURIComponent(playerId)}&order=round_id.desc&limit=1`
  );
  return rows?.[0] ?? null;
}
