-- Roster v2 launch steps, started from Postgres (pg_cron + pg_net), because
-- Claude's scheduled wake-ups did not fire reliably (2026-11-13). Each job starts
-- .github/workflows/v2-launch.yml once and then removes itself. Every step is
-- safe to repeat (see the workflow). Run by hand in the Supabase SQL editor.
-- Uses the same Vault token as the nightly round: 'github_pat'.
-- Times are UTC (pg_cron): Copenhagen = UTC+1 in November.

create or replace function public.wrad2_launch(inputs jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://api.github.com/repos/JelleDenmark/we-ride-at-dawn-2/actions/workflows/v2-launch.yml/dispatches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'github_pat'),
      'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'wrad2-pg-cron'),
    body := jsonb_build_object('ref', 'master', 'inputs', inputs));
end $$;
-- Not callable through the public API.
revoke all on function public.wrad2_launch(jsonb) from public, anon, authenticated;

-- Sat 14 Nov 12:07 Copenhagen: teaser 1
select cron.schedule('wrad2-v2-teaser-sat', '7 11 14 11 *', $j$
  select public.wrad2_launch('{"step":"post","file":"v2-teaser-sat.json"}');
  select cron.unschedule('wrad2-v2-teaser-sat');
$j$);
-- Sun 15 Nov 17:13: teaser 2
select cron.schedule('wrad2-v2-teaser-sun', '13 16 15 11 *', $j$
  select public.wrad2_launch('{"step":"post","file":"v2-teaser-sun.json"}');
  select cron.unschedule('wrad2-v2-teaser-sun');
$j$);
-- Sun 15 Nov 22:40: deploy v2 (after the 21:40 final round)
select cron.schedule('wrad2-v2-deploy', '40 21 15 11 *', $j$
  select public.wrad2_launch('{"step":"deploy"}');
  select cron.unschedule('wrad2-v2-deploy');
$j$);
-- Sun 15 Nov 23:40: deploy retry (no-op if v2 is already live)
select cron.schedule('wrad2-v2-deploy-retry', '40 22 15 11 *', $j$
  select public.wrad2_launch('{"step":"deploy"}');
  select cron.unschedule('wrad2-v2-deploy-retry');
$j$);
-- Mon 16 Nov 06:10: patch notes (only if v2 is live)
select cron.schedule('wrad2-v2-notes', '10 5 16 11 *', $j$
  select public.wrad2_launch('{"step":"post","file":"patch-2.1.json","require_v2":"true"}');
  select cron.unschedule('wrad2-v2-notes');
$j$);
-- Mon 16 Nov 18:07: first-duel reminder (only if v2 is live)
select cron.schedule('wrad2-v2-first-duel', '7 17 16 11 *', $j$
  select public.wrad2_launch('{"step":"post","file":"v2-first-duel.json","require_v2":"true"}');
  select cron.unschedule('wrad2-v2-first-duel');
$j$);

-- Check: select jobname, schedule from cron.job where jobname like 'wrad2-v2-%';
