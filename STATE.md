# State (replaced each session)

Updated 2026-11-04. The design page is the only design document. Claude owns the
game day to day (balance, ops); Jesper decides rules and features and relays player feedback.

**Live:** https://jelledenmark.github.io/we-ride-at-dawn-2/ (master), /dev/ (dev). Deploys on
push to either. Default branch master.

**Nightly round:** `.github/workflows/league-nightly.yml`, GitHub schedule 4x per evening (UTC);
scheduled runs only score 21:30-24:00 Copenhagen, so winter/summer time needs no edit. A closed
round is a no-op. Scores the season and the `dev-` season (no posts). No standings post with
fewer than 2 boards. Secrets: SUPABASE_SERVICE_ROLE_KEY (sb_secret_, sent as apikey only),
DISCORD_BOT_TOKEN. pg_cron trigger not set up (SQL at end of the league migration).
Dry run 2026-11-04: OK, 0 boards.

**Balance check:** `npm run duel-sim -w @wrad/core` (swing / evolve / matrix) before Monday.
One small change per week, at the Monday reset.

**Launch balance (sim, tiers 1-3):** top evolved units Dusk-Runt 70-95%, MD Rattyfock 51-74%,
Dawn-Runt up to 60%. Trio together 0-16%. Corpse-Glutton cap 3. Dusk-Runt +1 health (design
said +2; +2 sat on every board). Weak: Bone-Priest, Gutter-Runt, Ward-Weaver; Sacrifice weak at
tier 3. Poison is capped by a duel being one front foe. Economy: 14 raids/day finishes day 6-7;
24/day day 4-5.

**Roster review 2026-11-04 (sim, not shipped; target Monday 2026-11-09 reset):**
Structural causes found: pups always summon at tier 1 and combat cap is deployed+2, so Swarm
cannot scale; a revived Brood-Mother/Gnawer re-fires its faint effect (Bone-Priest = "dies
twice", the real trio engine); buffs scale 1/3/9 like stats, so board-wide buffers win; Dawn/Dusk
Runt fit every board; Plague-Bearer and Moe share one mechanic; armor scales 2/4/6 vs 1/3/9 stats.
Best structure tested: remove Dawn/Dusk-Runt; pups take summoner tier (count no longer x tier);
revived rats come back hollow (no ability) at 50% HP; buffs scale 1/2/3; Moe poisons the
highest-attack enemy. With it each tier has a different leader and every strategy has a counter.
Rejected: poison carry-over on death and Moe poison-all (stall/rot combos, 90-100% of boards).
Numbers still swing (Moe, Dire-Rat, Brood-Mother count) and need a tuning pass in duel-sim.

**Next:** first real data from players. Watch Dusk-Runt and Rattyfock share on real boards.
