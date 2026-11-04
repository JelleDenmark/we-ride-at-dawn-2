/**
 * COMBAT=bg switches the engine to Battlegrounds-style rounds for a balance run.
 * The rat tweaks below exist ONLY for a fair first look at bg mode (a taunt and
 * a sniper to give the new targeting rules something to chew on); they are set
 * here, never in the data files.
 */
import { UNIT_DEFS } from '../../src/data/units';
import { RULES } from '../../src/sim';

export const COMBAT = process.env.COMBAT === 'bg' ? 'bg' : 'queue';

if (COMBAT === 'bg') {
  RULES.combat = 'bg';
  UNIT_DEFS['dire-rat'].taunt = true;
  UNIT_DEFS['draughtsman-moe'].targeting = 'strongest';
}
