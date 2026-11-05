/**
 * Turns new player feedback (the Discord "Feedback & Support" panel, stored in
 * Supabase `public.feedback`) into GitHub issues, so every session can read it.
 * The repo is public: issues carry the feedback text and type only, never the
 * Discord name or ids.
 */
export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export interface FeedbackRow {
  id: string;
  created_at: string;
  type: string;
  content: Record<string, string>;
}

/** 2.0 launch day. Older rows are from the old game. */
export const SINCE = '2026-11-03T00:00:00Z';

const LABELS: Record<string, string> = {
  bug_what: 'What happened',
  bug_steps: 'Steps',
  bug_device: 'Device / browser',
  fb_text: 'Feedback',
  q_text: 'Question',
};
const KIND: Record<string, string> = { bug: 'Bug', feedback: 'Feedback', question: 'Question' };

export function issueFor(row: FeedbackRow): { title: string; body: string; labels: string[] } {
  const kind = KIND[row.type] ?? 'Feedback';
  const answers = Object.entries(row.content ?? {}).filter(([, v]) => v && String(v).trim());
  const first = String(answers[0]?.[1] ?? '').replace(/\s+/g, ' ').trim();
  const title = `${kind}: ${first.length > 70 ? first.slice(0, 67) + '...' : first || '(empty)'}`;
  const body = [
    ...answers.map(([k, v]) => `**${LABELS[k] ?? k}**\n${String(v).trim()}`),
    '',
    `_From the Discord feedback panel, ${row.created_at.slice(0, 10)}. Feedback id ${row.id}._`,
  ].join('\n\n');
  return { title, body, labels: ['needs-triage', `player-${row.type === 'bug' ? 'bug' : row.type === 'question' ? 'question' : 'feedback'}`] };
}

export async function fileFeedback(
  f: Fetch,
  o: { supabaseUrl: string; supabaseKey: string; githubToken: string; repo: string; dry: boolean }
): Promise<number> {
  const sb = { apikey: o.supabaseKey, 'Content-Type': 'application/json' } as Record<string, string>;
  if (o.supabaseKey.startsWith('eyJ')) sb.Authorization = `Bearer ${o.supabaseKey}`;
  const res = await f(
    `${o.supabaseUrl}/rest/v1/feedback?status=eq.open&created_at=gte.${encodeURIComponent(SINCE)}&select=id,created_at,type,content&order=created_at`,
    { headers: sb }
  );
  if (!res.ok) throw new Error(`GET feedback ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as FeedbackRow[];
  console.log(`${rows.length} new feedback row(s).`);
  const gh = {
    Authorization: `Bearer ${o.githubToken}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'wrad2-feedback',
    'Content-Type': 'application/json',
  };
  for (const row of rows) {
    const issue = issueFor(row);
    if (o.dry) { console.log(`[dry] ${issue.title}`); continue; }
    const r = await f(`https://api.github.com/repos/${o.repo}/issues`, { method: 'POST', headers: gh, body: JSON.stringify(issue) });
    if (!r.ok) throw new Error(`POST issue ${r.status} ${await r.text()}`);
    const { number } = (await r.json()) as { number: number };
    // Mark it filed only after the issue exists, so a failure retries next run.
    const p = await f(`${o.supabaseUrl}/rest/v1/feedback?id=eq.${row.id}`, {
      method: 'PATCH',
      headers: { ...sb, Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'filed' }),
    });
    if (!p.ok) throw new Error(`PATCH feedback ${p.status} ${await p.text()}`);
    console.log(`Filed #${number}: ${issue.title}`);
  }
  return rows.length;
}
