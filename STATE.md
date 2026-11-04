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

**Next:** first real data from players. Watch Dusk-Runt and Rattyfock share on real boards.
