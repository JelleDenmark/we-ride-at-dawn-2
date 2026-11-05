import { describe, it, expect } from 'vitest';
import { issueFor, fileFeedback, SINCE } from '../scripts/lib/feedback-issues';

const row = { id: 'abc', created_at: '2026-11-05T10:00:00Z', type: 'bug', content: { bug_what: 'Replay froze on the duel', bug_steps: 'Opened last night', bug_device: '' } };

describe('feedback to issues', () => {
  it('builds an issue with no player identity', () => {
    const i = issueFor(row);
    expect(i.title).toBe('Bug: Replay froze on the duel');
    expect(i.body).toContain('**What happened**');
    expect(i.body).not.toContain('Device');
    expect(i.labels).toEqual(['needs-triage', 'player-bug']);
  });

  it('files each row, then marks it filed; dry run writes nothing', async () => {
    const calls: string[] = [];
    const f = async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url.includes('/rest/v1/feedback?status')) return new Response(JSON.stringify([row]));
      if (url.includes('api.github.com')) return new Response(JSON.stringify({ number: 7 }));
      return new Response(null, { status: 204 });
    };
    const o = { supabaseUrl: 'https://x', supabaseKey: 'sb_secret_1', githubToken: 't', repo: 'o/r', dry: false };
    expect(await fileFeedback(f, o)).toBe(1);
    expect(calls[0]).toContain(encodeURIComponent(SINCE));
    expect(calls.map((c) => c.split(' ')[0])).toEqual(['GET', 'POST', 'PATCH']);
    calls.length = 0;
    await fileFeedback(f, { ...o, dry: true });
    expect(calls).toHaveLength(1);
  });
});
