---
name: roster-review
description: How to shake up or review the We Ride at Dawn 2 roster (rats, rules, relics, economy) — the first-principles method, the sim workflow and its pitfalls, and how a change ships at a Monday reset. Use for "rethink the roster", "new unit", "is X too strong", the periodic roster review, or before any balance change bigger than one number.
---

# Roster review

Claude owns balance and day-to-day development. Jesper relays player feedback
and has the final word on the game idea, the gameplay loop and the rat theme;
everything inside that (units, rules, numbers, limits) is ours to change.
Read `STATE.md` first: it has the current roster state, open problems and what
the last review concluded.

## Fixed points (never change without Jesper)
- Weekly season; most league points by Sunday wins. 3 per duel win, 1 per draw.
- Hourly raids are the economy that gears you up for duels; clearing waves scores nothing.
- Nightly 22:00 round robin; every board fights every board; replays must be exact.
- Rats, grimy sewer theme, terse voice.

The design page's hard limits (15 units, 9 relics, 10 effect types) are guides,
not walls: loosen them when it clearly helps, and say so.

## Method: structure before numbers
1. **Start from the engine, not the unit list.** Ask what a fight actually is
   (who can hit whom, when abilities fire, what scales with tier), what raids
   are for, and which counters the mechanics make possible. Most past "balance"
   problems were rules, not numbers: pups that never scaled, a revive that let
   Brood-Mother die twice, buffs scaling 1/3/9 across a whole board, "each wave"
   abilities that fire once in a one-wave duel.
2. **Give every strategy a job and a natural counter that comes from mechanics**
   (area damage beats wide boards; armor-ignoring poison beats big bodies; death
   engines feed on poison). Each strategy needs at least one bad matchup.
3. **Kill redundancy.** Two rats with the same mechanic, or a generic buffer that
   fits every board, will dominate or be dead weight. Each rat needs a reason to
   exist that no other rat covers.
4. **Make raids a decision.** At least one economy choice (e.g. the scavenging
   Gutter Runt) that trades duel strength for scrap, bounded so it never pays for
   itself every raid.
5. **Only then tune numbers**, a few at a time, in the sim.

## The sim (`npm run duel-sim -w @wrad/core`)
- Boards evolve under a scrap BUDGET (40 early / 150 mid / 400 late week; a rat
  at tier t costs cost x 3^(t-1)). Never judge balance at a fixed tier: that
  ignores cost and made cheap rats look worthless and expensive ones free.
- Report per budget: each rat's share of winning boards, the strategy split, a
  strategy matrix. Goal: 2-3+ strategies with real shares at every budget, no rat
  on nearly every board, every strategy has a loss.
- `SET="rat.field=v,rat.fx.attack=v,rules.reviveFraction=v"` overrides numbers
  without editing files; `SEEDLIST=` changes evolve seeds; `COMBAT=bg` (on the
  Battlegrounds branch) switches the combat model.
- Runs are noisy (each evolve converges on its own optimum). Re-check any
  conclusion with fresh seeds before locking it. When neighbouring configs only
  swap which rat peaks, stop tuning: real boards decide the rest.
- Economy: `npx tsx packages/core/scripts/economy.ts` (env RUNTS). Target: a
  strong player (14 raids/day) does not finish the board before day 6; a casual
  (6/day) has a decent board by day 3.
- After any engine change, the duel seat-fairness tests (mirror draws, seat swap
  never changes the winner) must pass. Effects that hit the other side must land
  for both sides before either side's own-board effects (summons, revives).

## Rejected ideas (and why)
- Poison carrying over when its rat dies; poison on the whole enemy line (even
  1 stack): stall/rot combos on 90-100% of boards. Use a one-time burst instead.
- Armor scaling 1/3/9: Bruiser dominance.

## Shipping a change
- Small number changes: at most one per week, at the Monday 06:00 reset.
- Big changes (rules, new or removed rats): ship as a full season change, also at
  a reset, with patch notes in #wrad (`scripts/discord/*.json` + the "Discord
  post" workflow). Deploy only AFTER Sunday's final round has closed: the new
  roster's board validation would drop old-roster boards from a late round.
- Every new rat, summon or enemy ships with art: `packages/app/src/replay/art/<id>.svg`,
  64x64 viewBox, hand-drawn in the existing style (flat fills, dark #1a222b outlines,
  the sewer palette; compare with 3-4 neighbours in a screenshot on a dark background
  before committing). It is the shop/board portrait and the replay sprite. Make the art
  part of the design, not an afterthought: it should show what the rat does (Rot-Chemist's
  flask, Sluice-Bulwark's gate shield). `packages/core/test/art.test.ts` fails without it.
  Relics have no portraits.
- Saved builds and stored league boards can contain removed rats:
  `packages/app/src/roster.ts` sanitizes them (add retired ids + costs there).
- Update the design page (Claude Docs, https://claude.ai/artifact/L64C6UcKBkCQ9obFk2pSyQ)
  and `STATE.md` after shipping.
- Patch-note voice: what changed for the player, numbers they recognise, why,
  no internal ids, sentences start with a capital.

## Periodic review
A scheduled task runs this review every four weeks. Each time: read `STATE.md`
and player feedback (open GitHub issues labelled player-bug/feedback/question,
filed from the Discord panel), check the last seasons' real final boards (league_results)
against the sim's predictions, run the full sim, and decide whether the next
reset needs a number change, a rule change, or nothing. Record the conclusion in
`STATE.md`.
