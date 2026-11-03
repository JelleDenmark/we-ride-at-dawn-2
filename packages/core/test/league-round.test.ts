import { describe, it, expect, vi, beforeEach } from 'vitest';
import { xorshift128 } from '../src/prng';
import { scoreRound } from '../src/league';
import { randomBoard } from './lib/random-board';
import {
  buildEntrants, buildResults, isSunday, seasonTotals, standingsMessage, championMessage, clearMessage, runRound,
  type BoardRow, type Fetch,
} from '../scripts/lib/league-round';

const rng = xorshift128(7);
const rows: BoardRow[] = ['Ash', 'Bone', 'Cinder'].map((name, i) => ({
  player_id: `p${i}`, name, board: randomBoard(rng), cleared_at: null,
}));

describe('league round', () => {
  it('drops illegal boards and scores with id = player_id', () => {
    const bad: BoardRow = { player_id: 'bad', name: 'Cheat', board: { units: [{ defId: 'nope', tier: 1 }] } as never, cleared_at: null };
    const { entrants, dropped } = buildEntrants([...rows, bad]);
    expect(entrants.map((e) => e.id)).toEqual(['p0', 'p1', 'p2']);
    expect(dropped).toHaveLength(1);
    const res = buildResults('s#d', 's', rows, scoreRound(entrants, '2026-11-03'));
    expect(res.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(res[0].board).toBe(rows.find((r) => r.player_id === res[0].player_id)!.board);
  });

  it('detects Sunday', () => {
    expect(isSunday('2026-11-08')).toBe(true);
    expect(isSunday('2026-11-07')).toBe(false);
  });

  it('formats messages', () => {
    const res = buildResults('s#d', 's', rows, scoreRound(buildEntrants(rows).entrants, 'x'));
    const msg = standingsMessage('2026-11-03', res);
    expect(msg).toContain('1. ');
    expect(msg).not.toMatch(/p0|p1|https?:/);
    expect(championMessage({ name: 'Ash', points: 9 })).toContain('Ash');
    expect(clearMessage(['A', 'B', 'C'])).toContain('A, B and C');
    expect(seasonTotals([...res, ...res])[0].points).toBe(res[0].points * 2);
  });

  describe('runRound with fake fetch', () => {
    let posts: { url: string; body?: string }[];
    let closed: boolean;
    const fake: Fetch = (async (url: string, init?: RequestInit) => {
      posts.push({ url, body: init?.body as string });
      const json = (v: unknown) => new Response(JSON.stringify(v), { status: 200 });
      if (url.includes('league_rounds?round_id')) return json(closed ? [{ closed_at: 'x' }] : []);
      if (url.includes('league_boards')) return json(rows);
      if (url.includes('closed_at=not.is.null')) return json([]);
      if (url.includes('league_results?season')) return json([]);
      return new Response('', { status: 201 });
    }) as Fetch;
    beforeEach(() => { posts = []; closed = false; vi.stubEnv('DISCORD_BOT_TOKEN', 'tok'); vi.spyOn(console, 'log').mockImplementation(() => {}); vi.spyOn(console, 'table').mockImplementation(() => {}); });

    it('closed round is a no-op', async () => {
      closed = true;
      const r = await runRound(fake, 'k', { season: '2026-11-02', rideDate: '2026-11-03', dry: false });
      expect(r.status).toBe('already-closed');
      expect(posts.every((p) => !p.body)).toBe(true);
    });

    it('dry writes nothing', async () => {
      await runRound(fake, 'k', { season: '2026-11-02', rideDate: '2026-11-03', dry: true });
      expect(posts.filter((p) => p.body)).toHaveLength(0);
    });

    it('real run writes results, round, and posts standings (champion only on Sunday)', async () => {
      await runRound(fake, 'k', { season: '2026-11-02', rideDate: '2026-11-03', dry: false });
      const writes = posts.filter((p) => p.body).map((p) => p.url);
      expect(writes.some((u) => u.includes('league_results'))).toBe(true);
      expect(writes.some((u) => u.includes('league_rounds'))).toBe(true);
      expect(writes.filter((u) => u.includes('discord.com'))).toHaveLength(1);
      posts = [];
      await runRound(fake, 'k', { season: '2026-11-02', rideDate: '2026-11-08', dry: false });
      expect(posts.filter((p) => p.url.includes('discord.com'))).toHaveLength(2);
    });
  });
});
