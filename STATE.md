# State (replaced each session)

Updated 2026-11-03. The design page is the only design document.

**Repo:** started from old repo v0.6.5 (`17f11c1`). Duel, nightly round and
seat-fair resolution are ported (`duel.ts`, `league.ts`, `sim.ts`). PvE output
is byte-identical to v0.6.5 (golden hashes pass).

**Check:** `npm run duel-sim -w @wrad/core` (swing / evolve / matrix). Run before Monday.

**Done:** Corpse-Glutton growth cap, 4 gains per battle. Evolved boards: the
Brood-Mother + Bone-Priest + Corpse-Glutton trio went from 95-100% (tiers 1-2,
uncapped) to 0% at tiers 1, 2 and 3.

**Open after the cap:**
- Corpse-Glutton alone is on 100% of tier-1 evolved boards. Try cap 3 or a tier-scaled cap.
- Bone-Priest is on 0% of boards with the cap. Brood-Mother ~0-5%. May need a small buff.
- MD Rattyfock + Warren-Warden (same mechanics) are on 90-100% of evolved boards. Dropping Warren-Warden is already in the design; check Rattyfock alone afterwards.
- Roster still to do: skins (Moe for Blight-Witch, Rattyfock for Warren-Warden), Dawn-Runt +1 attack, buff Rat-Piper and Plague-Bearer.
- Not started: economy (20 waves, 12 scrap cap), (app UI for standings, tonight's duel, open boards and duel replay is now built, against the league_* contract).
