# State (replaced each session)

Updated 2026-11-05. The design page (Claude Docs, https://claude.ai/artifact/L64C6UcKBkCQ9obFk2pSyQ)
is the only design document. Claude owns development and balance; Jesper relays player
feedback and decides the game idea, gameplay loop and rat theme. Roster/balance method:
`.claude/skills/roster-review/SKILL.md`.

**Live:** https://jelledenmark.github.io/we-ride-at-dawn-2/ (master), /dev/ (dev). Deploys on push
to either. Default branch master. Season 1 (week of 2026-11-02) runs the launch roster.

**Ops:** nightly round `.github/workflows/league-nightly.yml` (4 UTC cron entries, scheduled runs
only score 21:30-24:00 Copenhagen, closed round = no-op, also scores the `dev-` season silently,
no standings post below 2 boards). Discord posts: commit a payload to `scripts/discord/` and run
the "Discord post" workflow. Secrets: SUPABASE_SERVICE_ROLE_KEY (sb_secret_, sent as apikey only),
DISCORD_BOT_TOKEN. No pg_cron. Supabase tables `league_*` (migration in supabase/migrations).

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

**Next (week of 2026-11-09):** design roster v3 for the bg engine (every rat gets a targeting
role: taunt tanks, snipers, cleavers, rats that profit from random hits); ship on 2026-11-16 only
if it beats v2 in the budget sim AND replays read clearly on a phone; otherwise keep the queue
engine. Use season-2 real boards and player feedback. The replay (ReplayPlayer) has not been
checked with bg events.

**Scheduled tasks (each starts a fresh session):** deploy v2 Sun 2026-11-08 22:40 (waits for the
final round to close); post patch notes Mon 2026-11-09 06:10 (only if v2 is live); monthly roster
review on the 3rd, 14:37 Copenhagen (follows the roster-review skill). Scheduled sessions run
without connectors (no Claude Docs), so design-page updates may land in "To do" here instead.

**Known gaps:** app has no test setup; sanitizer in packages/app/src/roster.ts verified manually.
The night -1/0/+1 attack shift is per slot (Jesper: keep), visible in "Tonight's duel".
