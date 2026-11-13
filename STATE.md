# State (replaced each session)

Updated 2026-11-05. The design page (Claude Docs, https://claude.ai/artifact/L64C6UcKBkCQ9obFk2pSyQ)
is the only design document. Claude owns development and balance; Jesper relays player
feedback and decides the game idea, gameplay loop and rat theme. Roster/balance method:
`.claude/skills/roster-review/SKILL.md`.

**Live:** https://jelledenmark.github.io/we-ride-at-dawn-2/ (master), /dev/ (dev). Deploys on push
to either. Default branch master. Season 1 (week of 2026-11-02) runs the launch roster.

**Ops:** nightly round `.github/workflows/league-nightly.yml`. Season 1 scored NO rounds: GitHub ran
every scheduled run 4-5 h late (00:48-02:08 Copenhagen), outside the old 21:30-24:00 window. Since
2026-11-07: primary trigger is a daily Claude scheduled task that dispatches the workflow at 21:52
Copenhagen; fallback is the 4 UTC cron entries, which now score 21:30-05:59 (same ride date until the
06:00 rollover). Proper fix LIVE 2026-11-07 (as WRAD1 did): Supabase pg_cron job 'league-nightly-trigger'
(supabase/migrations/2026-11-07-league-pg-cron.sql, token = Vault secret 'github_pat') dispatches
with scheduled=true at 19:40 and 20:40 UTC. Its runs show as workflow_dispatch at :40 past. Once one
has scored a round, the 21:52 Claude dispatch task ("WRAD2: dispatch the nightly league round")
can be disabled. First round ever scored: 2026-11-07 (3 boards), after fixing health_diff being
written as a decimal into an int column (2a30ae9). Old notes: closed round = no-op, also scores the `dev-` season silently,
no standings post below 2 boards). Discord posts: commit a payload to `scripts/discord/` and run
the "Discord post" workflow. Secrets: SUPABASE_SERVICE_ROLE_KEY (sb_secret_, sent as apikey only),
DISCORD_BOT_TOKEN. No pg_cron.
**WRAD1 retired 2026-11-06:** `/we-ride-at-dawn/` (+ `/dev/`) redirects here. Its repo no longer
pings Supabase, so this repo's keep-alive is the only one for the shared project. WRAD1's
discord-feedback edge function still serves the #wrad feedback panel: don't delete it. Supabase tables `league_*` (migration in supabase/migrations).

**Branches:**
- `wt/v2` — roster v2, tested (208 core tests, app builds), NOT live. Ships after Sunday
  2026-11-08's final round; patch notes `scripts/discord/patch-2.1.json` post Monday 06:10
  (both scheduled as tasks).
- `wt/bg` — prototype Battlegrounds-style combat (`RULES.combat = 'bg'`: each side's next attacker
  hits a random foe or a taunt, hits are traded; per-side seeded RNG keeps duels seat-fair).
  Adds `taunt`, `targeting` (weakest/strongest sniper), `cleave`. Based on an early v2 commit:
  rebase onto v2 before use.

**Roster v2 (13 rats):** Swarm: Gutter Runt 2 (scavenges +3 scrap/raid, one counts), Rat-Piper 4,
Brood-Mother 6 (3 pups). Plague: Plague-Bearer 4, Draughtsman Moe 8 (poisons the hardest hitter),
Rot-Chemist 6 (new; faint: hits every foe for 1/3/9). Sacrifice: Gnawer 4 (+3 attack behind),
Corpse-Glutton 6 (grows up to 4x), Bone-Priest 7. Bruiser: Dire-Rat 8 (4/4, armor 2),
MD Rattyfock 6, Press-Kin 5, Ward-Weaver 7. Removed Dawn-Runt, Dusk-Runt. Rules: pups arrive at the
summoner's tier with a fixed litter; revived rats come back hollow at half health; buffs scale
1/2/3 (stats 1/3/9); foe-targeting faint effects land before own-board ones (seat fairness).

**v2 sim (budget mode, 6 seeds):** each budget has 2-3 strategies with real shares. Open: Moe and
Dire-Rat on 92-100% of late (400) boards; Sacrifice thin under some seeds; Bone-Priest central.
Economy: 14 raids/day finishes day 6-7; 24/day day 4-5; one scavenging runt ~+1 wave of depth.

**bg vs queue (same roster, untuned):** bg is seat-fair, raids still work (depth about equal,
swarm -1 wave), fights ~45% shorter (9 vs 16 rounds). Diversity not better yet: swarm 71% at
budget 150, bruiser 49% at 400. Value is the design space (taunt/sniper/cleave, random targets
could replace the -1/0/+1 night shift).

**2026-11-13: roster v2 slipped a week.** The scheduled tasks created 2026-11-05/07 started fresh
sessions with no write access to this repo (no add_repo, GitHub 403 on push and workflow runs), so the
2026-11-08 deploy stopped and the 2026-11-09 patch notes correctly did not post; the daily checks and the
v3 branch work did nothing. Season 2 runs the launch roster. v2 (branch wt/v2, master merged, 211 tests,
builds) now deploys Sun 2026-11-15 22:40 after season 2's final round, notes post Mon 2026-11-16 06:10
(patch-2.1.json, retitled "Season 3"). All WRAD2 tasks now fire into one Claude session that has push
access: daily ops 09:41, v2 deploy, notes, v3 branch work Tue 11-17, reset review + recap Sat 11-21.
Re-tested 2026-11-13 after Jesper widened GitHub access: a fresh session still cannot attach the repo
(its own permission check refuses add_repo when no person started it), so every WRAD2 task, incl. the
monthly review, is bound to the one session with access. v2 launch posts: teaser Sat 11-14 12:07
(v2-teaser-sat.json), teaser Sun 11-15 17:13 (v2-teaser-sun.json), patch notes Mon 06:10, first-duel
reminder with the live board count Mon 18:07. Season with no points now gets no crown (eb379f0). Rounds were unaffected: pg_cron scored season 1's finale on 11-08;
season 2 has had a single board all week, so no duels.

**Jesper away ~2026-11-07 to 2026-11-22 (his decision 2026-11-07):** roster v2 stays live until he
is back. No new combat engine or roster overhaul; v3 is built and tested on branch `wt/v3` only, with
a review note (docs/v3-review.md) for his return. Small numeric tweaks at a Monday reset are allowed
if the data clearly calls for them. Bug fixes ship right away. Rule-level ideas wait for him.
Scheduled while away: daily ops check 09:41 (round, deploys, issue triage, bug fixes); v3 branch
work Tue 11-10; reset reviews Sat 11-14 and Sat 11-21 (the second writes a recap for Jesper).

**Next (week of 2026-11-09):** (superseded by the away plan above: build v3 on `wt/v3`, do not ship) design roster v3 for the bg engine (every rat gets a targeting
role: taunt tanks, snipers, cleavers, rats that profit from random hits); ship on 2026-11-16 only
if it beats v2 in the budget sim AND replays read clearly on a phone; otherwise keep the queue
engine. Use season-2 real boards and player feedback. The replay (ReplayPlayer) has not been
checked with bg events.

**Scheduled tasks (each starts a fresh session):** deploy v2 Sun 2026-11-08 22:40 (waits for the
final round to close); post patch notes Mon 2026-11-09 06:10 (only if v2 is live); monthly roster
review on the 3rd, 14:37 Copenhagen (follows the roster-review skill). Scheduled sessions run
without connectors (no Claude Docs), so design-page updates may land in "To do" here instead.

**Player feedback:** players use the Discord "Feedback & Support" panel in #wrad (old discord-feedback
edge function, stores rows in Supabase public.feedback). `.github/workflows/feedback-to-issues.yml`
files new rows (from 2026-11-03) as GitHub issues every 6 hours (needs-triage + player-bug/feedback/
question; text only, no Discord identity). Read open issues before any balance change.

**Feedback 2026-11-07 (Jesper):** players clear all 20 waves fast, much earlier than the sim's
day 6-7 (14 raids/day). Check real clear days (league_boards.cleared_at vs season start) at the
2026-11-14 reset review. If confirmed, the levers are numeric (enemy scaling, INCOME_CAP), not
WAVE_COUNT. Re-check after v2 is live: v2 changes the economy (scavenging runt).

**Known gaps:** app has no test setup; sanitizer in packages/app/src/roster.ts verified manually.
The night -1/0/+1 attack shift is per slot (Jesper: keep), visible in "Tonight's duel".
