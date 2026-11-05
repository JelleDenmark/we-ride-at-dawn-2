/**
 * Files new Discord-panel feedback as GitHub issues (see lib/feedback-issues.ts).
 *   SUPABASE_SERVICE_ROLE_KEY=... GITHUB_TOKEN=... GITHUB_REPOSITORY=owner/repo npm run feedback -- --dry
 */
import { fileFeedback } from './lib/feedback-issues';
import { SUPABASE_URL } from './lib/league-round';

const dry = process.argv.slice(2).includes('--dry');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const githubToken = process.env.GITHUB_TOKEN;
if (!supabaseKey || !githubToken) {
  console.error('SUPABASE_SERVICE_ROLE_KEY and GITHUB_TOKEN are required.');
  process.exit(1);
}
await fileFeedback(fetch, {
  supabaseUrl: SUPABASE_URL, supabaseKey, githubToken,
  repo: process.env.GITHUB_REPOSITORY ?? 'JelleDenmark/we-ride-at-dawn-2', dry,
});
