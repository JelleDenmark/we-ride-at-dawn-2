# State (replaced each session)

Updated 2026-11-23. The design page (Claude Docs, https://claude.ai/artifact/L64C6UcKBkCQ9obFk2pSyQ)
is the only design document. Claude owns development and balance and makes those decisions; Jesper
relays player feedback and decides the game idea, gameplay loop and rat theme. Roster/balance method:
`.claude/skills/roster-review/SKILL.md`.

**Live:** https://jelledenmark.github.io/we-ride-at-dawn-2/ (master), /dev/ (dev). Pages deploys on
push to either. Roster v2 (13 rats) since season 3 (2026-11-16). Season 4 (2026-11-23) runs v2
unchanged.

**Next reset (2026-11-30, season 5): 3-copy board limit** on branch `next-season` (e21289d): at most
3 copies of the same rat on the board; a 4th waits on the bench; validateBoard drops boards with more.
Notes: `scripts/discord/notes/2026-11-30.json`. Ships automatically (see Ops).

## Ops (all automatic; Claude's timed wake-ups are unreliable, don't depend on them)
- **Nightly round:** Supabase pg_cron `league-nightly-trigger` dispatches league-nightly.yml with
  scheduled=true at 19:40 and 20:40 UTC (one lands at 21:40 Copenhagen year-round). GitHub's own
  cron entries are a late fallback; scheduled runs score 21:30-05:59 Copenhagen; a closed round is a
  no-op; fewer than 2 boards = no duel, no post. Token: Vault secret `github_pat`.
- **Season releases:** season-release.yml, started by pg_cron (migration 2026-11-23): Sunday 21:40
  UTC merges `next-season` after the final round closes (+ retry 22:40); Monday 05:10 UTC posts
  `scripts/discord/notes/<season>.json` once. **Needs the 2026-11-23 SQL run once in Supabase.**
- **Discord posts:** commit a payload to `scripts/discord/` and run "Discord post", or v2-launch.yml
  step=post (posts once, marker in `scripts/discord/sent/`).
- **Data for reviews:** "League report" workflow (input season): last round's boards (public data)
  and each player's best depth and full-clear time.
- **Feedback:** #wrad "Feedback & Support" panel → Supabase public.feedback → GitHub issues every
  6 h (feedback-to-issues.yml, needs-triage). Read open issues before any balance change.
- **CI:** core tests on every push (ci.yml). Art test: every rat/summon/enemy needs
  `packages/app/src/replay/art/<id>.svg`.
- Secrets: SUPABASE_SERVICE_ROLE_KEY (sb_secret_, apikey header only), DISCORD_BOT_TOKEN.
  Supabase keep-alive lives here (WRAD1 retired 2026-11-06 and redirects here; its discord-feedback
  edge function still serves the #wrad panel: don't delete it).
- Claude scheduled tasks bound to the working session: daily ops check 09:41, monthly roster review
  on the 3rd. Fresh scheduled sessions cannot attach this repo.

## Balance log
- **Reset review 2026-11-23 (decided):** no change for season 4; 3-copy limit for season 5.
  Season 3 top board: 7x Dire-Rat ★3 + Ward-Weaver ★3, 3 relics each (Fat Tick, Gore-Cleaver,
  Marrow-Snap, Tail-Charm); won all 7 nights. Same-value maxed round-robin: it beats plague, swarm,
  sacrifice, mixed and bruiser boards. Every single Dire-Rat number tried (armor 1, armor at ★3 = 2
  or 4, health 3, attack 3, attack 3 + armor 1) left it on top, and so did the bg engine. With a
  3-copy limit no board beats every other one. Budget sim (no relics, 7 rats): noisy either way.
- **Economy (open, next after the copy limit):** the top player cleared all 20 waves on day 2
  (season 3; day 5 in season 1; sim expects day 6-7); others reached depth 14 and 6. Early clear
  → max scrap every raid → relics on everything. Re-measure clear days after season 5 before
  touching INCOME_CAP, enemy scaling or relic cost. One change per reset.
- Swarm and sacrifice lose almost every maxed matchup with relics (they are early/mid-week boards
  in the budget sim). Watch after the copy limit.

## Branches
- `next-season`: season 5 copy limit (above).
- `wt/v3`: roster v3 candidate on the bg engine (targeting roles), docs/v3-review.md. Healthier
  matchups, fights half as long, replay can't show targeting yet, 14 queue tests to port.
  Recommendation: rework first. Does not fix the mono-rat wall on its own.

## History (short)
- Season 1 (11-02): launch roster; GitHub ran rounds hours late, Mon-Fri unscored; fixed 11-07.
- Season 2 (11-09): one board all week. Roster v2 slipped a week (scheduled sessions had no repo
  access); shipped 11-15 via Supabase-started v2-launch.yml.
- Season 3 (11-16): roster v2, 3 boards nightly, Sugondeez Nutts won every night.
- Bugs fixed: decimal health_diff into an int column; crown for a 0-point lone board; Sluice-Bulwark
  art missing.

## To do
- Run the 2026-11-23 season-release SQL in Supabase (Jesper).
- Update the design page to roster v2 (+ copy limit after 11-30).
- The night -1/0/+1 attack shift is per slot (Jesper: keep). App has no test setup.
