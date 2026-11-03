<script lang="ts">
  import { UNIT_DEFS, RELIC_DEFS, unitStats, type Lineup } from '@wrad/core';
  import { ART_URL } from './art';

  // A read-only board: front rat first. attackMod (the night's -1/0/+1) shows on the attack number.
  let { board }: { board: Lineup } = $props();
</script>

<div class="bv" role="list">
  {#each board.units as u}
    {@const def = UNIT_DEFS[u.defId]}
    {#if def}
      {@const s = unitStats({ defId: u.defId, tier: u.tier ?? 1, relicIds: u.relicIds ?? [] })}
      {@const mod = u.attackMod ?? 0}
      <div class="tile" role="listitem">
        {#if ART_URL[u.defId]}<img class="portrait" src={ART_URL[u.defId]} alt="" />{/if}
        <span class="name">{def.name}{(u.tier ?? 1) > 1 ? ` ★${u.tier}` : ''}</span>
        <span class="stats">
          {s.attack + mod}/{s.health}
          {#if mod !== 0}<em class:up={mod > 0} class:down={mod < 0}>{mod > 0 ? '+1' : '-1'}</em>{/if}
        </span>
        {#if (u.relicIds ?? []).length > 0}
          <span class="sub">✦ {(u.relicIds ?? []).map((r) => RELIC_DEFS[r]?.name ?? r).join(', ')}</span>
        {/if}
      </div>
    {/if}
  {:else}
    <p class="none">No rats.</p>
  {/each}
</div>
{#if (board.teamRelicIds ?? []).length > 0}
  <p class="team">✦ {(board.teamRelicIds ?? []).map((r) => RELIC_DEFS[r]?.name ?? r).join(', ')}</p>
{/if}

<style>
  .bv {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
    gap: 6px;
  }
  .tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 0;
    padding: 6px 3px;
    background: #1d1610;
    border: 1px solid #3a2c1f;
    border-radius: 8px;
    text-align: center;
  }
  .portrait {
    width: 36px;
    height: 36px;
    object-fit: contain;
  }
  .name {
    font-size: 11px;
    line-height: 1.15;
    overflow-wrap: anywhere;
  }
  .stats {
    font-size: 14px;
    font-weight: bold;
    color: #f0e6d2;
  }
  em {
    font-style: normal;
    font-size: 10px;
  }
  em.up {
    color: #7fb069;
  }
  em.down {
    color: #d8452e;
  }
  .sub,
  .team {
    font-size: 10px;
    color: var(--ink-dim);
    line-height: 1.2;
  }
  .team {
    margin: 6px 0 0;
  }
  .none {
    margin: 0;
    font-size: 13px;
    color: var(--ink-dim);
  }
</style>
