// Mechanic tests assert exact numbers, so they run on this fixed set of stats
// instead of the live balance numbers (which change week to week). Import it
// first in any test file that hard-codes a unit's stats or ability magnitudes.
import { UNIT_DEFS, type Effect, type UnitDef } from '../../src/data/units';

const stats: Record<string, { attack: number; health: number; effect?: Partial<Effect> }> = {
  'gutter-runt': { attack: 1, health: 1 },
  'rat-piper': { attack: 1, health: 2, effect: { count: 1 } as Partial<Effect> },
  'brood-mother': { attack: 2, health: 3, effect: { count: 2 } as Partial<Effect> },
  'plague-bearer': { attack: 2, health: 2, effect: { stacks: 1 } as Partial<Effect> },
  'draughtsman-moe': { attack: 3, health: 3, effect: { stacks: 2 } as Partial<Effect> },
  gnawer: { attack: 3, health: 1, effect: { attack: 2, health: 0 } as Partial<Effect> },
  'corpse-glutton': { attack: 3, health: 2, effect: { maxGains: 4 } as Partial<Effect> },
  'bone-priest': { attack: 1, health: 4 },
  'dire-rat': { attack: 4, health: 5 },
  'md-rattyfock': { attack: 2, health: 6, effect: { attack: 1, health: 1 } as Partial<Effect> },
  'press-kin': { attack: 2, health: 4, effect: { attack: 2, health: 2 } as Partial<Effect> },
  'ward-weaver': { attack: 1, health: 3 },
  'dawn-runt': { attack: 1, health: 2 },
  'dusk-runt': { attack: 1, health: 2, effect: { attack: 0, health: 2 } as Partial<Effect> },
};

for (const [id, s] of Object.entries(stats)) {
  const def: UnitDef | undefined = UNIT_DEFS[id];
  if (!def) continue; // retired roster entries
  def.attack = s.attack;
  def.health = s.health;
  if (s.effect && def.ability) Object.assign(def.ability.effect, s.effect);
}
