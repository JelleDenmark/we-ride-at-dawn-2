import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { UNIT_DEFS } from '../src/data/units';
import { ENEMY_POOL } from '../src/data/enemies';

// Every unit that can appear on a board or in a replay ships with art. The app
// reads packages/app/src/replay/art/<id>.svg; a missing file falls back to a
// blank tile and a plain rectangle in the replay. Relics have no portraits.
const artDir = fileURLToPath(new URL('../../app/src/replay/art/', import.meta.url));
const art = new Set(readdirSync(artDir).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4)));

describe('unit art', () => {
  it('every rat and summon has an SVG portrait', () => {
    const missing = Object.keys(UNIT_DEFS).filter((id) => !art.has(id));
    expect(missing, `add packages/app/src/replay/art/<id>.svg for: ${missing.join(', ')}`).toEqual([]);
  });
  it('every enemy has an SVG portrait', () => {
    const missing = ENEMY_POOL.map((e) => e.id).filter((id) => !art.has(id));
    expect(missing, `add packages/app/src/replay/art/<id>.svg for: ${missing.join(', ')}`).toEqual([]);
  });
});
