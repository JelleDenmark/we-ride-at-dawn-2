# We Ride at Dawn 2

A grimy rat-board league. Build a board. Every night at 22:00 Copenhagen every board duels every other board. Win 3 points, draw 1, loss 0. Most league points by Sunday wins the season. Monday 06:00 it resets.

Between rounds the horde raids a weekly gauntlet every hour for scrap. Scrap buys, merges and reorders rats. Clearing waves never scores points. A full clear earns a badge.

Play: `https://jelledenmark.github.io/we-ride-at-dawn-2/` (built from `master`) and `/dev/` (built from `dev`).

The design page (external) is the only design doc. [`STATE.md`](./STATE.md) is where things stand. [`CONTEXT.md`](./CONTEXT.md) is the short glossary.

## Layout

- `packages/core`: deterministic game logic (seeding, combat sim, duel, league scoring, shop). No UI, no I/O. Vitest.
- `packages/app`: Svelte 5, PixiJS v8 and a PWA. League client in `src/league.ts`. No game rules here.
- `supabase/`: backend for the league (`league_*` tables, RPC, round runner).

## Run

```
npm test         # core tests
npm run dev      # app dev server
npm run build    # app production build
npm run duel-sim -w @wrad/core -- swing|evolve|matrix   # weekly balance check
```
