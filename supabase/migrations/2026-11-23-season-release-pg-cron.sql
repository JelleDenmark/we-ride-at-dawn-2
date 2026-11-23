-- Permanent weekly reset releases (see .github/workflows/season-release.yml).
-- Run once by hand in the Supabase SQL editor. Re-run safe. Times are UTC
-- (pg_cron); they land after the Sunday round and after the Monday 06:00
-- Copenhagen reset in both winter and summer time.
-- Uses the Vault token 'github_pat' (same as the nightly round).

create or replace function public.wrad2_release(step text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://api.github.com/repos/JelleDenmark/we-ride-at-dawn-2/actions/workflows/season-release.yml/dispatches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'github_pat'),
      'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'wrad2-pg-cron'),
    body := jsonb_build_object('ref', 'master', 'inputs', jsonb_build_object('step', step)));
end $$;
revoke all on function public.wrad2_release(text) from public, anon, authenticated;

select cron.unschedule(jobname) from cron.job
  where jobname in ('wrad2-release-deploy', 'wrad2-release-deploy-retry', 'wrad2-release-notes');
-- Sunday 21:40 UTC (22:40 Copenhagen in winter): deploy next-season, if any.
select cron.schedule('wrad2-release-deploy', '40 21 * * 0', $j$ select public.wrad2_release('deploy'); $j$);
-- Sunday 22:40 UTC: retry (no-op once merged).
select cron.schedule('wrad2-release-deploy-retry', '40 22 * * 0', $j$ select public.wrad2_release('deploy'); $j$);
-- Monday 05:10 UTC (06:10 Copenhagen in winter): post the new season's notes, if any.
select cron.schedule('wrad2-release-notes', '10 5 * * 1', $j$ select public.wrad2_release('notes'); $j$);

-- Check: select jobname, schedule from cron.job where jobname like 'wrad2-release-%';
