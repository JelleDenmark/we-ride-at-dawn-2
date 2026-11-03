# State (replaced each session)

Updated 2026-11-03. The design page is the only design document.

**Repo:** started from old repo v0.6.5 (`17f11c1`). Duel, nightly round and
seat-fair resolution are ported (`duel.ts`, `league.ts`, `sim.ts`). PvE output
is byte-identical to v0.6.5 (golden hashes pass).

**Check:** `npm run duel-sim -w @wrad/core` (swing / evolve / matrix). Run before Monday.

**Balance (launch roster, 14 units, numbers only):** duel-sim now averages NIGHTS=4
night-variation seeds and pools SEEDS=3 evolve runs. Bruiser core, Rat-Piper, Plague-Bearer,
Moe, Gnawer, Brood-Mother retuned (see git log). Evolved boards, seeds pooled: top unit
60-90% (Dusk-Runt, MD Rattyfock; Dawn-Runt strongest in swing at +14-17), trio together 0-16%.
Corpse-Glutton cap is 3 (76% of tier-1 boards, 3% at tier 2, weak at tier 3).
Dusk-Runt is +1 health, not +2 (+2 swing was +31). Poison is capped by a duel being one wave
(one front foe), so extra stacks beyond ~4 do nothing.
**Open:** Bone-Priest and Gutter-Runt/Ward-Weaver are weak in swing (-6..-15); Sacrifice loses
to most at tier 3; Dusk/Dawn/Rattyfock still over 60% at some tiers. Economy: 14/day median day 7,
earliest 6; 24/day median 5, earliest 4.
- Not started: economy (20 waves, 12 scrap cap), (app UI for standings, tonight's duel, open boards and duel replay is now built, against the league_* contract).
