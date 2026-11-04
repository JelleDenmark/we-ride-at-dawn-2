/**
 * Fight length and raid depth for maxed boards (7 rats, all tier 3, no relics),
 * to compare combat modes:
 *
 *   npx tsx scripts/combat-compare.ts              # queue
 *   COMBAT=bg npx tsx scripts/combat-compare.ts    # Battlegrounds-style rounds
 *
 * Fight length is rounds per duel (queue: one clash per tick; bg: both sides'
 * attackers swing in the same round, so two clash events per round). Raid depth
 * is waves cleared against the gauntlet, over SAMPLES dates.
 */
import { COMBAT } from './lib/combat-mode';
import type { Lineup } from '../src/data/units';
import { simulate, simulateDuelRounds } from './lib/duel-rounds';
import { generateGauntlet, WAVE_COUNT } from '../src/gauntlet';

const SAMPLES = Number(process.env.SAMPLES ?? 200);
const NIGHTS = Number(process.env.NIGHTS ?? 5);
const COMPS: Record<string, string[]> = {
  swarm: ['rat-piper', 'rat-piper', 'brood-mother', 'brood-mother', 'corpse-glutton', 'rat-piper', 'brood-mother'],
  plague: ['dire-rat', 'plague-bearer', 'plague-bearer', 'rot-chemist', 'draughtsman-moe', 'draughtsman-moe', 'ward-weaver'],
  sacrifice: ['gnawer', 'gnawer', 'corpse-glutton', 'gnawer', 'bone-priest', 'corpse-glutton', 'bone-priest'],
  bruiser: ['dire-rat', 'md-rattyfock', 'press-kin', 'dire-rat', 'press-kin', 'dire-rat', 'ward-weaver'],
};
const maxed = (ids: string[]): Lineup => ({ units: ids.map((defId) => ({ defId, tier: 3 })), combatCap: ids.length + 2 });

console.log(`combat=${COMBAT}  maxed boards: 7 rats, tier 3, no relics`);
const names = Object.keys(COMPS);
const lengths: number[] = [];
for (const a of names) for (const b of names) {
  if (a >= b) continue;
  for (let n = 0; n < NIGHTS; n++) lengths.push(simulateDuelRounds(maxed(COMPS[a]), maxed(COMPS[b]), `n${n}`));
}
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
console.log(`duel length (rounds): avg ${mean(lengths).toFixed(1)}  max ${Math.max(...lengths)}  over ${lengths.length} duels`);

console.log(`raid depth (waves cleared of ${WAVE_COUNT}, ${SAMPLES} raids):`);
for (const [name, ids] of Object.entries(COMPS)) {
  const depths: number[] = [];
  let rounds = 0;
  for (let s = 0; s < SAMPLES; s++) {
    const date = new Date(Date.parse('2026-11-02T12:00:00Z') + s * 86_400_000).toISOString().slice(0, 10);
    const { events, result } = simulate(maxed(ids), generateGauntlet(date, 7, s % 24));
    depths.push(result.wavesCleared);
    rounds += events.filter((e) => e.type === 'clash').length / (COMBAT === 'bg' ? 2 : 1) / Math.max(1, result.wavesCleared + 1);
  }
  depths.sort((x, y) => x - y);
  console.log(`  ${name.padEnd(10)} avg ${mean(depths).toFixed(2)}  p5 ${depths[Math.floor(SAMPLES * 0.05)]}  max ${depths[SAMPLES - 1]}  rounds/wave ${(rounds / SAMPLES).toFixed(1)}`);
}
