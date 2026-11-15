import { UNIT_DEFS, RELIC_DEFS, type BuildState, type BoardUnit, type Lineup } from '@wrad/core';

/** Cost of rats retired from the roster, so a stale save can still be refunded. */
const RETIRED_COST: Record<string, number> = { 'dawn-runt': 4, 'dusk-runt': 4 };

const isKnownUnit = (id: string) => Object.prototype.hasOwnProperty.call(UNIT_DEFS, id);
const isKnownRelic = (id: string) => Object.prototype.hasOwnProperty.call(RELIC_DEFS, id);

function refund(u: BoardUnit): number {
  const cost = RETIRED_COST[u.defId] ?? 0;
  return cost * 3 ** Math.max(0, (u.tier ?? 1) - 1);
}

/** Drop rats/relics the current roster no longer knows; refund the scrap. */
export function sanitizeBuild(build: BuildState): BuildState {
  let refunded = 0;
  const keep = (units: BoardUnit[] | undefined): BoardUnit[] =>
    (units ?? [])
      .filter((u) => {
        if (u && isKnownUnit(u.defId)) return true;
        if (u) refunded += refund(u);
        return false;
      })
      .map((u) => ({ ...u, relicIds: (u.relicIds ?? []).filter(isKnownRelic) }));
  const board = keep(build.board);
  const bench = keep(build.bench);
  const slots = (build.shop?.slots ?? []).map((s) =>
    (s.kind === 'unit' && !isKnownUnit(s.defId)) || (s.kind === 'relic' && !isKnownRelic(s.relicId))
      ? ({ kind: 'empty' } as const)
      : s
  );
  return {
    ...build,
    board,
    bench,
    scrap: build.scrap + refunded,
    teamRelicIds: (build.teamRelicIds ?? []).filter(isKnownRelic),
    shop: { ...build.shop, slots },
  };
}

/** True when every rat in the lineup exists in the current roster. */
export function lineupIsCurrent(lineup: Lineup): boolean {
  return (lineup.units ?? []).every((u) => isKnownUnit(u.defId));
}

/** The lineup with unknown rats and relics removed (for display only). */
export function knownLineup(lineup: Lineup): Lineup {
  return {
    ...lineup,
    units: (lineup.units ?? [])
      .filter((u) => isKnownUnit(u.defId))
      .map((u) => ({ ...u, relicIds: (u.relicIds ?? []).filter(isKnownRelic) })),
    teamRelicIds: (lineup.teamRelicIds ?? []).filter(isKnownRelic),
  };
}
