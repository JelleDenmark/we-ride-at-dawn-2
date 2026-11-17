/**
 * COMBAT=bg / COMBAT=queue picks the combat engine for a balance run; unset
 * keeps RULES.combat's default. Roster v3's targeting roles (taunt, snipers,
 * cleave) live in data/units.ts and only act in bg combat.
 */
import { RULES } from '../../src/sim';

if (process.env.COMBAT === 'bg' || process.env.COMBAT === 'queue') RULES.combat = process.env.COMBAT;
export const COMBAT = RULES.combat;
