export type Side = 'horde' | 'gauntlet';

export type Archetype = 'swarm' | 'brute' | 'armored' | 'plague';

/**
 * Tier (star-level) power multiplier applied to a unit's own base ATTACK
 * and HEALTH (issue #22). Merging costs scrap super-linearly — 3 copies ->
 * one t2, 3 t2s -> one t3, i.e. 9x the scrap of a single t1 — so a flat
 * `x tier` curve (1x/2x/3x) made merging mostly a board-space play, not a
 * power one. Each tier step is now >=3x the previous step's power: 1x / 3x
 * / 9x (`3^(tier-1)`), matching the requested factor and the actual scrap
 * spent. Applied uniformly to attack and health (Jesper, 2026-07-09): the
 * owner wants a much deeper, more rewarding late-game curve, up to and
 * including players regularly pushing `WAVE_COUNT = 45` — a full-power
 * curve on both stats is the intended lever for that, not a limitation to
 * design around. See `HANDOFF.md`'s compounding-law section before adding
 * any *new* trigger effect that scales off these bigger numbers.
 */
export function tierAttackMultiplier(tier: number): number {
  return Math.pow(3, tier - 1);
}

/** Same curve as `tierAttackMultiplier` — see its doc comment. */
export function tierHealthMultiplier(tier: number): number {
  return Math.pow(3, tier - 1);
}

/**
 * LEGACY (roster v2): no longer used by the sim — a revive now raises the ally
 * hollow at `ceil(maxHealth * RULES.reviveFraction)`. Kept exported only until
 * the app stops importing it for its ability text.
 *
 * HP a Bone-Priest's `revive` used to return the raised ally at, by tier (issue
 * #53). Deliberately NOT `tierHealthMultiplier` or any other flat multiplier
 * of a base value — `revive` fires exactly once per Bone-Priest instance
 * (its own `faint` trigger, which a unit only hits once), so unlike
 * per-battle-recurring effects there's no compounding risk in a steep,
 * hand-tuned curve here. A flat `health * tier` (1/2/3) made merging this
 * unit nearly pointless since the ability only ever pays out once; this
 * table (1/2/3) makes tiering up actually matter. Callers must still cap
 * the result at the revived corpse's own `maxHealth` — see the `revive`
 * case in sim.ts's `applyEffect`.
 */
export function reviveHpForTier(tier: number): number {
  const table = [1, 2, 3];
  return table[tier - 1] ?? table[table.length - 1];
}

/**
 * Number of the front rat's incoming hits Ward-Weaver's `blockFrontHits`
 * blocks per wave, by tier (issue #56). Same shape as `reviveHpForTier` — a
 * small explicit table, not a multiplier of a base value — because this
 * magnitude resets every wave (see the compounding-law note on
 * `blockCharges` in sim.ts) rather than compounding like `tierAttackMultiplier`.
 * Deliberately flat-ish (1/1/2), not `tierAttackMultiplier`'s 3^(tier-1) curve:
 * a wave only has so many meaningful hits to block, so a steep curve here
 * would just let a t3 Ward-Weaver no-sell an entire early wave.
 */
export function blockHitsForTier(tier: number): number {
  const table = [1, 1, 2];
  return table[tier - 1] ?? table[table.length - 1];
}

/**
 * Poison stacks applied by Plague-Bearer's `poisonFrontEnemy` (`startOfWave`)
 * and Draughtsman Moe's (x2) (`startOfWave`), by tier (issue #62,
 * folding in #59's table). Same shape as `reviveHpForTier`/`blockHitsForTier`
 * — a small explicit table, not a multiplier of a base value.
 *
 * Safe under the compounding law for the same reason as `blockHitsForTier`:
 * poison stacks reset every wave (`waveClear`), so unlike `gainStats` or any
 * other permanently-accumulating effect on a per-wave trigger, a steep
 * per-tier jump here cannot snowball across the 45-wave battle — each wave
 * starts the count fresh.
 *
 * Deliberately `[1, 3, 5]`, NOT `tierAttackMultiplier`'s full `3^(tier-1)`
 * curve (which would give 1/3/9). A full exponential jump would make poison
 * a dominant, matchup-agnostic answer regardless of enemy archetype —
 * flat, depth-independent damage that ignores armor and doesn't need to
 * out-scale enemy health the way attack does. That risk is exactly the
 * still-open question flagged in `scripts/depth-scaling.ts` report section
 * "4) Poison-leaning vs attack-leaning roster": poison's flat/depth-independent
 * nature was left as a report-only, not-yet-resolved finding, not something
 * to resolve by picking a magnitude here. `[1, 3, 5]` is a moderate,
 * hand-tuned middle ground between the old flat `stacks * tier` (1/2/3) and
 * the full exponential curve.
 */
export function poisonStacksForTier(tier: number): number {
  const table = [1, 3, 5];
  return table[tier - 1] ?? table[table.length - 1];
}

export type Effect =
  | { kind: 'summon'; unitId: string; count: number }
  /**
   * Buffs the rat(s) behind the source (or `all` of them) by
   * `attack`/`health`, scaled by `tierAttackMultiplier`/`tierHealthMultiplier`
   * (issue #58) rather than a flat `* tier` — Gnawer wires this to `faint`,
   * MD Rattyfock wires it to `startOfBattle`; both trigger
   * kinds fire exactly once per unit instance, ever, so the steeper
   * `3^(tier-1)` curve can't accumulate across the 45-wave battle the way a
   * per-wave-recurring effect could (see the compounding-law note above the
   * `Ability` interface). A flat `* tier` left tiering these units up nearly
   * pointless since the payout only ever lands once — same rationale as
   * `reviveHpForTier`.
   */
  | { kind: 'buffBehind'; attack: number; health: number; all?: boolean }
  /**
   * Buffs BOTH board neighbors (index-1 and index+1), whichever exist. At
   * the front only the "behind" neighbor exists; at the back only the
   * "front" neighbor exists; a middle placement hits both — the first
   * effect in the game where being in the middle is strictly better than
   * an edge. See `buffAdjacent`'s application in sim.ts for the
   * compounding-law note (it's `startOfBattle`-gated, same shape as
   * `buffBehind` on MD Rattyfock). Magnitude scales via
   * `tierAttackMultiplier`/`tierHealthMultiplier` (issue #58), same
   * fire-once reasoning as `buffBehind`.
   */
  | { kind: 'buffAdjacent'; attack: number; health: number }
  /** `stacks` multiplies `poisonStacksForTier` (Plague-Bearer 1, Draughtsman Moe 2). */
  | { kind: 'poisonFrontEnemy'; stacks: number }
  | { kind: 'poisonTarget'; stacks: number }
  /** `maxGains`: how many times this unit may grow in one battle (absent = unlimited). */
  | { kind: 'gainStats'; attack: number; health: number; maxGains?: number }
  /**
   * HP is NOT carried on the effect — it's looked up per-tier via
   * `reviveHpForTier` at apply time (issue #53), then capped at the
   * revived corpse's own `maxHealth`. See `reviveHpForTier`'s doc comment
   * for why a steep table is safe here despite the compounding law.
   */
  | { kind: 'revive' }
  /**
   * Ward-Weaver (issue #56). Grants this side a per-wave pool of "block the
   * next incoming hit to whichever unit is currently front" charges, sized
   * by `blockHitsForTier(tier)` (1/2/3). Always wired to `startOfWave`, and
   * the pool is reset to 0 at the top of every wave before this fires — see
   * `blockCharges` in sim.ts for the full compounding-law note and the
   * `Math.max` (never summed) anti-stacking rule for multiple Ward-Weavers.
   */
  | { kind: 'blockFrontHits' }
  /** Poisons the living enemy with the highest attack (first in line on a tie). */
  | { kind: 'poisonStrongest'; stacks: number }
  /** One hit on every living enemy for `amount` x 1/3/9 (ignores armor). Rot-Chemist, on faint. */
  | { kind: 'damageAllEnemies'; amount: number };

/**
 * Real-world half-day bucket, Copenhagen local time (issue #12) — matches the
 * existing Monday 06:00 CET season-reset convention. Resolved by the app
 * layer from the wall clock and threaded in via `Lineup.timeOfDay`;
 * `simulate` itself never reads `Date.now()`/`new Date()`, so this stays
 * fully deterministic for tests and golden logs (they pass, or omit,
 * `timeOfDay` explicitly).
 */
export type TimeOfDay = 'beforeNoon' | 'afterNoon';

/**
 * `startOfBattle` fires **once per unit instance, ever** — on the first wave
 * that unit is present for. `startOfWave` fires at the top of **every** wave.
 *
 * The distinction is load-bearing. `simulate` runs 45 waves against one
 * persistent horde, so any *permanent* effect on a per-wave trigger compounds
 * ~45× without bound: four tier-3 MD Rattyfocks re-buffing "+1/+1 to all
 * behind" every wave took a 6-attack rat to 241 and full-cleared the gauntlet.
 * Rule of thumb: **`startOfWave` is only for effects that do not accumulate** —
 * summoning a body that will die, re-applying poison that clears at `waveClear`.
 * Anything that permanently raises a stat belongs on `startOfBattle`.
 *
 * Enemies are re-instantiated every wave, so their `startOfBattle` abilities
 * still fire each wave for free — the per-instance flag makes this automatic.
 *
 * Ward-Weaver's `blockFrontHits` (issue #56) used to be a bespoke
 * per-attack-tick trigger (`watchFrontAttack`), removed once its mechanic
 * changed from "every Nth attack landed" to "block the first N hits each
 * wave" — that reset-every-wave shape is exactly what `startOfWave` is for,
 * so it no longer needs its own trigger kind. See `blockCharges` in sim.ts.
 */
export interface Ability {
  trigger: 'startOfBattle' | 'startOfWave' | 'faint' | 'afterAttack' | 'allyFaint';
  effect: Effect;
}

export interface UnitDef {
  id: string;
  name: string;
  attack: number;
  health: number;
  cost: number;
  desc?: string;
  archetype?: Archetype;
  ability?: Ability;
  /**
   * Flat armor: subtract this from every incoming **attack** hit (scaled by
   * tier, like every other magnitude). Poison bypasses it — armor doesn't stop
   * rot. A hit always lands for at least 1, so armor can never make a unit
   * immortal (cf. the Bone-Priest self-revive lesson). Strong against swarms of
   * small hits, near-useless against brutes.
   */
  damageReduction?: number;
  /** Extra scrap per raid while this rat is on the board, x tier. The economy rat. */
  scavenge?: number;
}

export interface LineupUnit {
  defId: string;
  tier?: number;
  relicIds?: string[];
  /** Flat attack shift applied before the fight (the nightly -1/0/+1 seed variation). */
  attackMod?: number;
}

export interface Lineup {
  units: LineupUnit[];
  teamRelicIds?: string[];
  /**
   * How many bodies this side may hold *during combat*, summons included.
   * Callers building from a `BuildState` (see `lineupFromBuild`/
   * `combatCapForBuild` in shop.ts) set this to `units.length + 2` — always
   * larger than however many rats were actually deployed, so a summoner is
   * never starved by a full warren, but never banks more than 2 spare slots
   * either (issue #69). Omitted = `BOARD_CAP`, which keeps every pre-existing
   * golden log byte-identical.
   */
  combatCap?: number;
  /**
   * Real-world half-day (issue #12). No longer gates anything; kept as an
   * optional field so old lineups stay valid. Omitted = any lineup that predates or doesn't care about
   * time-of-day (every golden log, every existing test) behaves exactly as
   * it did before this field existed. The app layer resolves this from the
   * wall clock (see `copenhagenSeconds`/`timeOfDayAt` in App.svelte);
   * `simulate` never reads the clock itself.
   */
  timeOfDay?: TimeOfDay;
}

/** Full spec §5.4 roster. Archetypes: Breed/Swarm, Plague, Sacrifice, Bruiser/Anchor. */
export const UNIT_DEFS: Record<string, UnitDef> = {
  pup: { id: 'pup', name: 'Pup', attack: 1, health: 1, cost: 0 },
  // Roster v2 (2026-11). Four strategies, each with a tool aimed at another's
  // weakness: Swarm (bodies), Plague (armor-ignoring poison), Sacrifice (feeds on
  // its own deaths), Bruiser (big bodies and buffs). Gutter Runt is the economy rat.
  'gutter-runt': {
    id: 'gutter-runt', name: 'Gutter Runt', attack: 2, health: 2, cost: 2,
    desc: 'scavenger: +1 scrap every raid while on the board (scales ★)',
    scavenge: 1,
  },
  'rat-piper': {
    id: 'rat-piper', name: 'Rat-Piper', attack: 1, health: 3, cost: 4,
    desc: 'start of each fight: pipes in a pup of its own ★',
    ability: { trigger: 'startOfWave', effect: { kind: 'summon', unitId: 'pup', count: 1 } },
  },
  'brood-mother': {
    id: 'brood-mother', name: 'Brood-Mother', attack: 2, health: 3, cost: 6,
    desc: 'faint: births 3 pups of her own ★',
    ability: { trigger: 'faint', effect: { kind: 'summon', unitId: 'pup', count: 3 } },
  },
  'corpse-glutton': {
    id: 'corpse-glutton', name: 'Corpse-Glutton', attack: 2, health: 3, cost: 6,
    desc: 'grows +1/+1 when an ally faints, up to 4 times a fight (scales ★)',
    ability: { trigger: 'allyFaint', effect: { kind: 'gainStats', attack: 1, health: 1, maxGains: 4 } },
  },
  'plague-bearer': {
    id: 'plague-bearer', name: 'Plague-Bearer', attack: 2, health: 3, cost: 4,
    desc: 'start of each fight: poisons the front foe (scales ★)',
    ability: { trigger: 'startOfWave', effect: { kind: 'poisonFrontEnemy', stacks: 1 } },
  },
  'draughtsman-moe': {
    id: 'draughtsman-moe', name: 'Draughtsman Moe', attack: 3, health: 4, cost: 8,
    desc: 'start of each fight: poisons the hardest-hitting foe (scales ★)',
    ability: { trigger: 'startOfWave', effect: { kind: 'poisonStrongest', stacks: 1 } },
  },
  'rot-chemist': {
    id: 'rot-chemist', name: 'Rot-Chemist', attack: 1, health: 4, cost: 6,
    desc: 'faint: bursts, hitting every foe for a pup’s health (scales ★)',
    ability: { trigger: 'faint', effect: { kind: 'damageAllEnemies', amount: 1 } },
  },
  gnawer: {
    id: 'gnawer', name: 'Gnawer', attack: 3, health: 1, cost: 4,
    desc: 'faint: the rat behind gets +3 attack (scales ★)',
    ability: { trigger: 'faint', effect: { kind: 'buffBehind', attack: 3, health: 0 } },
  },
  'bone-priest': {
    id: 'bone-priest', name: 'Bone-Priest', attack: 1, health: 4, cost: 7,
    desc: 'faint: raises the first fallen ally at half health, hollow (no ability)',
    ability: { trigger: 'faint', effect: { kind: 'revive' } },
  },
  'dire-rat': {
    id: 'dire-rat', name: 'Dire-Rat', attack: 4, health: 4, cost: 8,
    desc: 'hide like a door: shrugs off 2 from every blow (scales ★)',
    damageReduction: 2,
  },
  'md-rattyfock': {
    id: 'md-rattyfock', name: 'MD Rattyfock', attack: 2, health: 5, cost: 6,
    desc: 'Season 1 survivor; start of fight: every rat behind it gets +1 attack (scales ★)',
    ability: { trigger: 'startOfBattle', effect: { kind: 'buffBehind', attack: 1, health: 0, all: true } },
  },
  'press-kin': {
    id: 'press-kin', name: 'Press-Kin', attack: 2, health: 4, cost: 5,
    desc: 'start of fight: the rats beside it get +1/+1, best in the middle (scales ★)',
    ability: { trigger: 'startOfBattle', effect: { kind: 'buffAdjacent', attack: 1, health: 1 } },
  },
  'ward-weaver': {
    id: 'ward-weaver', name: 'Ward-Weaver', attack: 1, health: 4, cost: 7,
    desc: 'start of each fight: blocks the front rat’s next hit (★3: two hits)',
    ability: { trigger: 'startOfWave', effect: { kind: 'blockFrontHits' } },
  },
};

/** Hardcoded showcase lineup until the shop lands (milestone 4). Index 0 = front. */
export const TEST_HORDE: Lineup = {
  units: [
    { defId: 'gnawer', relicIds: ['rusted-nail'] },
    { defId: 'plague-bearer' },
    { defId: 'corpse-glutton', relicIds: ['fat-tick'] },
    { defId: 'brood-mother' },
    { defId: 'bone-priest', relicIds: ['tail-charm'] },
  ],
  teamRelicIds: ['filth-totem'],
};
