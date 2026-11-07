/** Nightly league round: pure scoring + Supabase REST + Discord messages. fetch is injected for tests. */
import { scoreRound, validateBoard, type LeagueEntrant, type RoundStanding } from '../../src/league';
import { weekdayFor } from '../../src/shop';
import type { Lineup } from '../../src/data/units';

export const SUPABASE_URL = 'https://wvrllhiktnkvbpclmrpq.supabase.co';
const DISCORD_API = 'https://discord.com/api/v10';
// Mandatory: without it Cloudflare answers Discord REST with error 1010.
const USER_AGENT = 'DiscordBot (https://github.com/JelleDenmark/we-ride-at-dawn, 1.0)';
const DEFAULT_CHANNEL_ID = '1524165668004560896';

export type Fetch = typeof fetch;
declare const process: { env: Record<string, string | undefined> };

export interface BoardRow {
  player_id: string;
  name: string;
  board: Lineup;
  cleared_at: string | null;
}

export interface ResultRow {
  round_id: string;
  season: string;
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

export const roundIdFor = (season: string, rideDate: string) => `${season}#${rideDate}`;
export const isSunday = (rideDate: string) => weekdayFor(rideDate) === 7;

/** Legal boards become entrants (id = player_id); the rest are dropped by name. */
export function buildEntrants(rows: BoardRow[]): { entrants: LeagueEntrant[]; dropped: string[] } {
  const entrants: LeagueEntrant[] = [];
  const dropped: string[] = [];
  for (const r of rows) {
    const v = r.board && Array.isArray(r.board.units) ? validateBoard(r.board) : { ok: false as const, reason: 'no board' };
    if (v.ok && r.board.units.length > 0) entrants.push({ id: r.player_id, board: r.board });
    else dropped.push(`${r.name}: ${v.ok ? 'empty board' : v.reason}`);
  }
  // Seat order = player_id ascending. The app's replay seats pairs the same
  // way, so a replayed duel is byte-identical to the scored one.
  entrants.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { entrants, dropped };
}

export function buildResults(
  roundId: string, season: string, rows: BoardRow[], standings: RoundStanding[]
): ResultRow[] {
  const byId = new Map(rows.map((r) => [r.player_id, r]));
  return standings.map((s, i) => {
    const r = byId.get(s.id)!;
    return {
      round_id: roundId, season, player_id: s.id, name: r.name, board: r.board,
      points: s.points, wins: s.wins, draws: s.draws, losses: s.losses,
      // league_results.health_diff is an int column; health can be fractional
      // (revived rats come back at half health). Rank uses the exact value.
      health_diff: Math.round(s.healthDiff), rank: i + 1,
    };
  });
}

/** Season totals from result rows, same order rule as a night: points, health, id. */
export function seasonTotals(rows: ResultRow[]) {
  const m = new Map<string, { player_id: string; name: string; points: number; health_diff: number; round: string }>();
  for (const r of rows) {
    const t = m.get(r.player_id);
    if (!t) m.set(r.player_id, { player_id: r.player_id, name: r.name, points: r.points, health_diff: r.health_diff, round: r.round_id });
    else {
      t.points += r.points; t.health_diff += r.health_diff;
      if (r.round_id > t.round) { t.name = r.name; t.round = r.round_id; }
    }
  }
  return [...m.values()].sort(
    (a, b) => b.points - a.points || b.health_diff - a.health_diff || (a.player_id < b.player_id ? -1 : 1)
  );
}

/* ---------- Discord text ---------- */

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export function standingsMessage(rideDate: string, rows: ResultRow[]): string {
  if (rows.length < 2) return 'The gutters were quiet tonight. Not enough rats to duel.';
  const lines = rows.slice(0, 10).map(
    (r, i) => `${i + 1}. ${r.name}, ${r.points} pts (${r.wins}W ${r.draws}D ${r.losses}L, ${signed(r.health_diff)})`
  );
  return [`**Night of ${rideDate}. The boards have fought.**`, ...lines].join('\n');
}

export function championMessage(champion: { name: string; points: number } | undefined): string {
  if (!champion) return 'The week ends. Nobody rode. The crown rots.';
  return `**The week is done. ${champion.name} takes the crown with ${champion.points} pts.** The gutters bow. Monday, we start again.`;
}

export function clearMessage(names: string[]): string {
  if (names.length === 1) return `**${names[0]} cleared the gauntlet.** Every wave, dead. A badge is theirs.`;
  return `**${joinNames(names)} cleared the gauntlet.** Every wave, dead. Badges for all.`;
}

function joinNames(n: string[]) {
  return n.length <= 2 ? n.join(' and ') : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`;
}

export async function discordPost(f: Fetch, content: string): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) { console.log('No DISCORD_BOT_TOKEN set, skipping Discord post.'); return; }
  const channel = process.env.DISCORD_CHANNEL_ID || DEFAULT_CHANNEL_ID;
  try {
    const res = await f(`${DISCORD_API}/channels/${channel}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json', 'User-Agent': USER_AGENT },
      body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
    });
    if (!res.ok) console.error(`Discord post failed: ${res.status} ${await res.text()}`);
  } catch (e) {
    console.error('Discord post failed:', e);
  }
}

/**
 * Scheduled runs score from 21:30 Copenhagen time until the 06:00 rollover.
 * Before 06:00 the ride date is still the previous evening's (currentRideDate),
 * so a late run scores the right round. The window used to close at midnight,
 * and GitHub started every scheduled run of season 1 between 00:48 and 02:08
 * Copenhagen time (4-5 h late), so no round of that season was ever scored.
 * The reliable trigger is a dispatch at ~21:50 (see STATE.md); this is the
 * fallback. Trade-off: a board changed between 22:00 and a late run counts.
 */
export function inRoundWindow(now: Date): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Copenhagen', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')!.value);
  const m = Number(parts.find((p) => p.type === 'minute')!.value);
  const mins = h * 60 + m;
  return mins >= 21 * 60 + 30 || mins < 6 * 60;
}

/* ---------- Supabase REST ---------- */

export function makeDb(f: Fetch, key: string, base = SUPABASE_URL) {
  // Legacy service_role keys are JWTs and also go in Authorization. New
  // `sb_secret_` keys are not JWTs and must only be sent as `apikey`.
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  const get = async <T>(path: string): Promise<T> => {
    const res = await f(`${base}/rest/v1/${path}`, { headers });
    if (!res.ok) throw new Error(`GET ${path.split('?')[0]} ${res.status} ${await res.text()}`);
    return (await res.json()) as T;
  };
  const upsert = async (table: string, rows: unknown[], onConflict: string) => {
    const res = await f(`${base}/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows),
    });
    if (!res.ok) throw new Error(`POST ${table} ${res.status} ${await res.text()}`);
  };
  const enc = encodeURIComponent;
  return {
    boards: (season: string) =>
      get<BoardRow[]>(`league_boards?season=eq.${enc(season)}&select=player_id,name,board,cleared_at&order=player_id`),
    round: async (id: string) =>
      (await get<{ closed_at: string | null }[]>(`league_rounds?round_id=eq.${enc(id)}&select=closed_at`))[0],
    lastClosedAt: async (season: string) =>
      (await get<{ closed_at: string }[]>(`league_rounds?season=eq.${enc(season)}&closed_at=not.is.null&select=closed_at&order=closed_at.desc&limit=1`))[0]
        ?.closed_at ?? null,
    seasonResults: (season: string) => get<ResultRow[]>(`league_results?season=eq.${enc(season)}&select=*`),
    writeResults: (rows: ResultRow[]) => upsert('league_results', rows, 'round_id,player_id'),
    writeRound: (row: object) => upsert('league_rounds', [row], 'round_id'),
  };
}

/* ---------- The round ---------- */

export interface RoundOpts { season: string; rideDate: string; dry: boolean; now?: Date; /** false for the dev season: score it, post nothing. */ notify?: boolean }

export async function runRound(f: Fetch, key: string, o: RoundOpts) {
  const db = makeDb(f, key);
  const roundId = roundIdFor(o.season, o.rideDate);
  const existing = await db.round(roundId);
  if (existing?.closed_at) {
    console.log(`Round ${roundId} already closed. Nothing to do.`);
    return { status: 'already-closed' as const };
  }

  const rows = await db.boards(o.season);
  const { entrants, dropped } = buildEntrants(rows);
  for (const d of dropped) console.log(`Dropped illegal board, ${d}`);
  const standings = scoreRound(entrants, o.rideDate);
  const kept = new Set(entrants.map((e) => e.id));
  const results = buildResults(roundId, o.season, rows.filter((r) => kept.has(r.player_id)), standings);

  console.log(`Round ${roundId}: ${entrants.length} boards.`);
  console.table(results.map((r) => ({ rank: r.rank, name: r.name, pts: r.points, W: r.wins, D: r.draws, L: r.losses, hp: r.health_diff })));
  if (o.dry) { console.log('Dry run, nothing written.'); return { status: 'dry' as const, results }; }

  const prevClosed = await db.lastClosedAt(o.season);
  const now = o.now ?? new Date();
  if (results.length) await db.writeResults(results);
  await db.writeRound({
    round_id: roundId, season: o.season, ride_date: o.rideDate, night_seed: o.rideDate, closed_at: now.toISOString(),
  });

  if (o.notify === false) return { status: 'closed' as const, results };
  // No standings post until at least two boards duel (no noise before launch).
  if (results.length >= 2) await discordPost(f, standingsMessage(o.rideDate, results));
  if (isSunday(o.rideDate)) {
    const totals = seasonTotals(await db.seasonResults(o.season));
    await discordPost(f, championMessage(totals[0]));
  }
  const cleared = rows
    .filter((r) => r.cleared_at && (!prevClosed || r.cleared_at > prevClosed))
    .map((r) => r.name);
  if (cleared.length) await discordPost(f, clearMessage(cleared));
  return { status: 'closed' as const, results };
}
