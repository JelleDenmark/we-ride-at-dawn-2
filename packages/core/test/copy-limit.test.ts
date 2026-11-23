import { describe, expect, it } from 'vitest';
import { validateBoard } from '../src/league';
import {
  newBuild, buyUnit, deployUnit, swapWithBench, MAX_COPIES_ON_BOARD, overCopyLimit,
  type BuildState, type ActionResult,
} from '../src/shop';

const must = (r: ActionResult) => { if (!r.ok) throw new Error(r.reason); return r; };
const dire = (tier: number) => ({ defId: 'dire-rat', tier, relicIds: [] as string[] });
const runt = (tier = 1) => ({ defId: 'gutter-runt', tier, relicIds: [] as string[] });
const withShop = (s: BuildState, defId: string): BuildState => ({
  ...s,
  shop: { ...s.shop, slots: [{ kind: 'unit', defId }, ...s.shop.slots.slice(1)], frozen: s.shop.frozen.map(() => false) },
});

describe('copy limit: at most 3 of the same rat on the board', () => {
  it('is 3', () => expect(MAX_COPIES_ON_BOARD).toBe(3));

  it('a 4th copy bought goes to the bench, not the board', () => {
    const s = withShop({ ...newBuild('2026-11-30', 7), scrap: 100, board: [dire(2), dire(2), dire(3)], bench: [] }, 'dire-rat');
    const after = must(buyUnit(s, 0)).state;
    expect(after.board.filter((u) => u.defId === 'dire-rat')).toHaveLength(3);
    expect(after.bench).toEqual([dire(1)]);
  });

  it('a bought copy that completes a trio still merges onto the board', () => {
    const s = withShop({ ...newBuild('2026-11-30', 7), scrap: 100, board: [dire(1), dire(1), dire(3)], bench: [] }, 'dire-rat');
    const after = must(buyUnit(s, 0)).state;
    expect(after.board.filter((u) => u.defId === 'dire-rat').map((u) => u.tier).sort()).toEqual([2, 3]);
  });

  it('deploying a 4th copy from the bench is refused', () => {
    const s = { ...newBuild('2026-11-30', 7), board: [dire(2), dire(2), dire(3)], bench: [dire(3)] };
    const r = deployUnit(s, 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/at most 3/);
  });

  it('deploying the copy that completes a trio is allowed', () => {
    const s = { ...newBuild('2026-11-30', 7), board: [dire(1), dire(1), dire(3)], bench: [dire(1)] };
    const after = must(deployUnit(s, 0)).state;
    expect(overCopyLimit(after.board)).toBeUndefined();
  });

  it('swapping in a 4th copy is refused', () => {
    const s = { ...newBuild('2026-11-30', 7), board: [dire(2), dire(2), dire(3), runt()], bench: [dire(3)] };
    expect(swapWithBench(s, 3, 0).ok).toBe(false);
  });

  it('league validation drops a board with 4 copies and keeps one with 3', () => {
    const units = (n: number) => [...Array.from({ length: n }, () => dire(3)), runt()];
    expect(validateBoard({ units: units(3) }).ok).toBe(true);
    const r = validateBoard({ units: units(4) });
    expect(r.ok).toBe(false);
  });
});
