-- League backend (We Ride at Dawn 2.0). New tables only, all prefixed league_.
-- Apply by hand (SQL editor / CLI). Re-run safe.
--
-- device_id is never stored: the RPC hashes it to player_id = md5(device_id)
-- and keeps only that. Boards are not anon-readable (no sniping the live board);
-- the public sees boards through league_results snapshots after each duel.

create table if not exists public.league_boards (
  player_id   text not null,
  season      text not null,
  name        text not null,
  board       jsonb not null,
  best_depth  int not null default 0,
  cleared_at  timestamptz,
  updated_at  timestamptz not null default now(),
  primary key (season, player_id)
);

create table if not exists public.league_rounds (
  round_id    text primary key,          -- ${season}#${rideDate}
  season      text not null,
  ride_date   text not null,
  night_seed  text not null,             -- = rideDate
  closed_at   timestamptz
);

create table if not exists public.league_results (
  round_id    text not null,
  season      text not null,
  player_id   text not null,
  name        text not null,
  board       jsonb not null,            -- as scored, WITHOUT night variation
  points      int not null,
  wins        int not null,
  draws       int not null,
  losses      int not null,
  health_diff int not null,
  rank        int not null,
  primary key (round_id, player_id)
);
create index if not exists league_results_season_idx on public.league_results (season);

create or replace view public.league_standings as
select
  season,
  player_id,
  (array_agg(name order by round_id desc))[1] as name,
  sum(points)::int      as points,
  sum(wins)::int        as wins,
  sum(draws)::int       as draws,
  sum(losses)::int      as losses,
  sum(health_diff)::int as health_diff,
  count(*)::int         as nights
from public.league_results
group by season, player_id;

-- RLS: boards closed to anon; rounds/results readable; writes only via RPC / service role.
alter table public.league_boards  enable row level security;
alter table public.league_rounds  enable row level security;
alter table public.league_results enable row level security;

drop policy if exists league_rounds_read  on public.league_rounds;
drop policy if exists league_results_read on public.league_results;
create policy league_rounds_read  on public.league_rounds  for select to anon using (true);
create policy league_results_read on public.league_results for select to anon using (true);

revoke all on public.league_boards, public.league_rounds, public.league_results, public.league_standings from anon, authenticated;
grant select on public.league_rounds, public.league_results, public.league_standings to anon;

create or replace function public.league_submit_board(
  p_device_id text, p_season text, p_name text, p_board jsonb, p_best_depth int
) returns text
language plpgsql security definer set search_path = public as $$
declare
  pid text;
  nm  text := left(coalesce(nullif(btrim(p_name), ''), 'Rat'), 24);
  d   int  := greatest(coalesce(p_best_depth, 0), 0);
begin
  if p_device_id is null or length(p_device_id) < 8 or length(p_device_id) > 100 then
    raise exception 'bad device id';
  end if;
  if p_season is null or p_season !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'bad season';
  end if;
  if p_board is null or jsonb_typeof(p_board -> 'units') <> 'array'
     or jsonb_array_length(p_board -> 'units') > 20 or length(p_board::text) > 20000 then
    raise exception 'bad board';
  end if;
  pid := md5(p_device_id);
  insert into public.league_boards (player_id, season, name, board, best_depth, cleared_at, updated_at)
  values (pid, p_season, nm, p_board, d, case when d >= 20 then now() end, now())
  on conflict (season, player_id) do update set
    name       = excluded.name,
    board      = excluded.board,
    best_depth = greatest(league_boards.best_depth, excluded.best_depth),
    cleared_at = coalesce(league_boards.cleared_at,
                   case when greatest(league_boards.best_depth, excluded.best_depth) >= 20 then now() end),
    updated_at = now();
  return pid;
end $$;

revoke all on function public.league_submit_board(text, text, text, jsonb, int) from public;
grant execute on function public.league_submit_board(text, text, text, jsonb, int) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Optional: trigger the nightly round from Postgres (more reliable than a
-- GitHub schedule). Needs pg_cron + pg_net and a GitHub token (actions:write)
-- stored as vault secret 'gh_dispatch_token'. Uncomment and edit OWNER/REPO.
--
-- select cron.schedule('league-nightly-trigger', '40 20 * * *', $cron$
--   select net.http_post(
--     url := 'https://api.github.com/repos/JelleDenmark/we-ride-at-dawn-2/actions/workflows/league-nightly.yml/dispatches',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'gh_dispatch_token'),
--       'Accept', 'application/vnd.github+json',
--       'User-Agent', 'wrad-pg-cron'),
--     body := '{"ref":"master"}'::jsonb);
-- $cron$);
-- To remove: select cron.unschedule('league-nightly-trigger');
