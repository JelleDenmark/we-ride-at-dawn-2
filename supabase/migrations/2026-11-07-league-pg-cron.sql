-- Nightly league round trigger from Postgres (pg_cron + pg_net), replacing
-- GitHub's schedule, which ran every night of season 1 4-5 hours late.
-- Same set-up WRAD1 used for its PvP round (WRAD1 issue #185, job
-- 'wrad-pvp-nightly-trigger', unscheduled 2026-11-06 when WRAD1 retired).
-- Run by hand in the Supabase SQL editor. Re-run safe.
--
-- Needs: a GitHub token that may run workflows on JelleDenmark/we-ride-at-dawn-2
-- (fine-grained: repository access to we-ride-at-dawn-2, permission
-- "Actions: Read and write"), stored in Supabase Vault as 'gh_dispatch_token'.
-- WRAD1's token may already be in Vault; list names with:
--   select name, updated_at from vault.secrets;
-- If it is, give that token access to we-ride-at-dawn-2 on GitHub and use its
-- name below. Otherwise create one:
--   select vault.create_secret('<token>', 'gh_dispatch_token');
--
-- pg_cron runs in UTC. Two dispatches with scheduled=true: one lands at 21:40
-- Copenhagen in winter (20:40 UTC) and one in summer (19:40 UTC). The other is
-- skipped by the round's 21:30-06:00 window or is a no-op on a closed round.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobname) from cron.job where jobname = 'league-nightly-trigger';

select cron.schedule('league-nightly-trigger', '40 19,20 * * *', $cron$
  select net.http_post(
    url := 'https://api.github.com/repos/JelleDenmark/we-ride-at-dawn-2/actions/workflows/league-nightly.yml/dispatches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'gh_dispatch_token'),
      'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'wrad2-pg-cron'),
    body := '{"ref":"master","inputs":{"scheduled":"true"}}'::jsonb);
$cron$);

-- Check it fired (after 19:40/20:40 UTC): GitHub should show a workflow_dispatch
-- run of "League nightly round". Postgres side:
--   select status_code, content, created from net._http_response order by created desc limit 5;
-- (204 = dispatched; 401/403/404 = token missing, expired or without access.)
-- To remove: select cron.unschedule('league-nightly-trigger');
