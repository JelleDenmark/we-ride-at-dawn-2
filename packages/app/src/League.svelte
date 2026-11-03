<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { applyNightVariation, simulateDuel, currentRideDate, type Lineup } from '@wrad/core';
  import BoardView from './BoardView.svelte';
  import { ReplayPlayer } from './replay/ReplayPlayer';
  import {
    submitBoard,
    fetchStandings,
    fetchLatestRound,
    fetchBoardOf,
    cachedPlayerId,
    type StandingRow,
    type Round,
  } from './league';

  let {
    seasonId,
    lineup,
    playerName,
    bestDepth,
    fullClear,
    onrename,
  }: {
    seasonId: string;
    lineup: Lineup;
    playerName: string;
    bestDepth: number;
    fullClear: boolean;
    onrename: () => void;
  } = $props();

  const ROUND_HOUR = 22;

  function copenhagenSeconds(now: Date): number {
    const p = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Copenhagen',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .format(now)
      .split(':')
      .map(Number);
    return (p[0] % 24) * 3600 + p[1] * 60 + p[2];
  }

  function addDay(date: string): string {
    return new Date(Date.parse(`${date}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  }

  function fmt(sec: number): string {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(sec % 60).padStart(2, '0')}s`;
  }

  let now = $state(Date.now());
  let playerId = $state<string | null>(cachedPlayerId());
  let standings = $state<StandingRow[]>([]);
  let round = $state<Round | null>(null);
  let loaded = $state(false);
  let busy = $state(false);

  const secsToRound = $derived.by(() => {
    const left = ROUND_HOUR * 3600 - copenhagenSeconds(new Date(now));
    return left > 0 ? left : left + 86_400;
  });
  // The ride date flips at 06:00; the 22:00 round belongs to the calendar day it runs on.
  const tonightSeed = $derived.by(() => {
    const d = new Date(now);
    const ride = currentRideDate(d);
    return copenhagenSeconds(d) < 6 * 3600 ? addDay(ride) : ride;
  });
  // Sunday's round (season Monday + 6) is the last of the season.
  const finalNight = $derived(tonightSeed === [1, 2, 3, 4, 5, 6].reduce((d) => addDay(d), seasonId));

  const tonightBoard = $derived<Lineup>(
    playerId && lineup.units.length > 0 ? applyNightVariation(lineup, tonightSeed, playerId) : lineup
  );

  async function refresh() {
    busy = true;
    try {
      const [s, r] = await Promise.all([fetchStandings(seasonId), fetchLatestRound(seasonId)]);
      standings = s;
      round = r;
    } finally {
      busy = false;
      loaded = true;
    }
  }

  // Submit after any board change, debounced. Failures are silent: retried on the next change.
  let lastSig = '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const board = lineup;
    const name = playerName;
    const best = bestDepth;
    const season = seasonId;
    if (!name || board.units.length === 0) return;
    const sig = JSON.stringify([season, name, best, board]);
    if (sig === lastSig) return;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const id = await submitBoard({ seasonId: season, name, board, bestDepth: best });
      if (id) {
        lastSig = sig;
        playerId = id;
        void refresh();
      }
    }, 2000);
    return () => clearTimeout(timer);
  });

  $effect(() => {
    void seasonId;
    void refresh();
  });

  onMount(() => {
    const t = setInterval(() => (now = Date.now()), 1000);
    const r = setInterval(() => void refresh(), 60_000);
    return () => {
      clearInterval(t);
      clearInterval(r);
    };
  });

  // Open boards: anyone's latest snapshot.
  let open = $state<{ name: string; board: Lineup; round: string } | null>(null);
  let opening = $state(false);
  async function openBoard(pid: string, name: string) {
    opening = true;
    open = null;
    try {
      const inRound = round?.results.find((r) => r.player_id === pid);
      const row = inRound ?? (await fetchBoardOf(seasonId, pid));
      if (row) open = { name, board: row.board, round: row.round_id.split('#').pop() ?? '' };
      else open = { name, board: { units: [] }, round: '' };
    } finally {
      opening = false;
    }
  }

  // Duel replay: pick any pair from the latest round.
  let pickA = $state('');
  let pickB = $state('');
  $effect(() => {
    const rs = round?.results ?? [];
    if (rs.length < 2) return;
    if (!rs.some((r) => r.player_id === pickA) || !rs.some((r) => r.player_id === pickB) || pickA === pickB) {
      const mine = rs.find((r) => r.player_id === playerId);
      pickA = mine ? mine.player_id : rs[0].player_id;
      pickB = (rs.find((r) => r.player_id !== pickA) as (typeof rs)[number]).player_id;
    }
  });

  let duelOpen = $state(false);
  let duelStage: HTMLDivElement | undefined = $state();
  let duelPlayer: ReplayPlayer | undefined;
  let duelSpeed = $state(1);
  let duelNote = $state('');
  let duelRunning = $state(false);

  async function watchDuel() {
    if (!round || pickA === pickB) return;
    // Seat order = player id order, the order the nightly round scores in.
    const [x, y] = [pickA, pickB].sort();
    const ra = round.results.find((r) => r.player_id === x);
    const rb = round.results.find((r) => r.player_id === y);
    if (!ra || !rb) return;
    const seed = round.nightSeed;
    const { events, result } = simulateDuel(
      applyNightVariation(ra.board, seed, ra.player_id),
      applyNightVariation(rb.board, seed, rb.player_id)
    );
    const end =
      result.winner === 'draw'
        ? 'DRAW'
        : `${(result.winner === 'a' ? ra : rb).name.toUpperCase()} WINS · ${Math.max(result.healthA, result.healthB)} HP LEFT`;
    duelNote = result.winner === 'draw' ? 'Draw. One point each.' : `${(result.winner === 'a' ? ra : rb).name} takes it. 3 points.`;
    duelOpen = true;
    await tick();
    if (!duelStage) return;
    if (!duelPlayer) {
      duelPlayer = new ReplayPlayer();
      await duelPlayer.init(duelStage);
    }
    duelPlayer.speed = duelSpeed;
    duelRunning = true;
    await duelPlayer.play(events, { horde: ra.name, gauntlet: rb.name, end });
    duelRunning = false;
  }

  function closeDuel() {
    if (duelPlayer) duelPlayer.destroy();
    duelPlayer = undefined;
    duelOpen = false;
    duelRunning = false;
  }

  function setDuelSpeed(s: number) {
    duelSpeed = s;
    if (duelPlayer) duelPlayer.speed = s;
  }
</script>

<section class="league">
  <p class="win">Most league points by Sunday wins.</p>
  <p class="rules">Win 3. Draw 1. Loss 0. Clearing waves scores nothing.</p>

  <div class="head">
    <span class="label">Standings · week of {seasonId}</span>
    <button class="small" onclick={() => void refresh()} disabled={busy}>{busy ? '…' : '↻'}</button>
  </div>
  {#if standings.length === 0}
    <p class="empty">{loaded ? 'Nobody has fought yet. The first round is at 22:00.' : 'Reading the war-drums…'}</p>
  {:else}
    <ol class="rows">
      <li class="row hdr">
        <span class="rank"></span><span class="nm">Rider</span><span class="num">W-D-L</span><span class="pts">Pts</span>
      </li>
      {#each standings as row, i}
        {@const me = row.player_id === playerId}
        <li>
          <button class="row" class:me onclick={() => void openBoard(row.player_id, row.name)}>
            <span class="rank">{i + 1}</span>
            <span class="nm">{row.name}{me ? ' · you' : ''}{me && fullClear ? ' ⚑' : ''}</span>
            <span class="num">{row.wins}-{row.draws}-{row.losses}</span>
            <span class="pts">{row.points}</span>
          </button>
        </li>
      {/each}
    </ol>
    <p class="hint">Tap a rider to open their board.</p>
  {/if}

  <p class="you">
    Riding as <strong>{playerName || '—'}</strong>{fullClear ? ' · ⚑ Cleared the drains' : ''}
    <button class="small" onclick={onrename}>Rename</button>
  </p>

  <div class="card">
    <div class="head">
      <span class="label">Tonight's duel{finalNight ? ' · final round' : ''}</span>
      <span class="count">22:00 in <strong>{fmt(secsToRound)}</strong></span>
    </div>
    <p class="sub">Your board as it will fight. Tonight's seed shifts each rat's attack by -1, 0 or +1.</p>
    <BoardView board={tonightBoard} />
    {#if lineup.units.length === 0}
      <p class="warn">Empty board. You score nothing tonight. Recruit below.</p>
    {:else if !playerId}
      <p class="sub">Not entered yet. Entering when the server answers.</p>
    {/if}
  </div>

  {#if round}
    <div class="card">
      <div class="head">
        <span class="label">Last night · {round.nightSeed}</span>
      </div>
      <ol class="rows">
        {#each round.results.slice(0, 8) as r}
          <li>
            <button class="row" class:me={r.player_id === playerId} onclick={() => void openBoard(r.player_id, r.name)}>
              <span class="rank">{r.rank}</span>
              <span class="nm">{r.name}{r.player_id === playerId ? ' · you' : ''}</span>
              <span class="num">{r.wins}-{r.draws}-{r.losses}</span>
              <span class="pts">+{r.points}</span>
            </button>
          </li>
        {/each}
      </ol>
      {#if round.results.length > 1}
        <div class="pair">
          <select bind:value={pickA} aria-label="First board">
            {#each round.results as r}<option value={r.player_id}>{r.name}</option>{/each}
          </select>
          <span>vs</span>
          <select bind:value={pickB} aria-label="Second board">
            {#each round.results as r}<option value={r.player_id}>{r.name}</option>{/each}
          </select>
        </div>
        <button class="watch" onclick={() => void watchDuel()} disabled={pickA === pickB}>▶ Watch the duel</button>
      {/if}
    </div>
  {/if}
</section>

{#if open || opening}
  <div class="backdrop" role="presentation" onclick={() => { open = null; opening = false; }}>
    <div class="sheet" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()}>
      {#if open}
        <div class="sheet-name">{open.name}</div>
        <p class="sub">{open.round ? `Board as it fought on ${open.round}.` : 'No board on record yet.'}</p>
        <BoardView board={open.board} />
        <button class="small close" onclick={() => (open = null)}>Close</button>
      {:else}
        <p class="sub">Opening the board…</p>
      {/if}
    </div>
  </div>
{/if}

{#if duelOpen}
  <div class="backdrop" role="presentation">
    <div class="sheet wide" role="dialog" aria-modal="true">
      <div class="stage" bind:this={duelStage}></div>
      <div class="ctrl">
        {#each [1, 2, 4] as s}
          <button class="small" class:active={duelSpeed === s} onclick={() => setDuelSpeed(s)}>{s}×</button>
        {/each}
        <button class="small" onclick={() => duelPlayer && (duelPlayer.speed = 1e9)} disabled={!duelRunning}>Skip ⏭</button>
        <button class="small" onclick={closeDuel}>Close</button>
      </div>
      {#if !duelRunning && duelNote}<p class="sub">{duelNote}</p>{/if}
    </div>
  </div>
{/if}

<style>
  .league {
    max-width: 620px;
    margin: 0 auto 18px;
    text-align: left;
  }
  .win {
    margin: 0;
    text-align: center;
    font-size: 17px;
    color: #f0e6d2;
    letter-spacing: 0.5px;
  }
  .rules {
    margin: 2px 0 12px;
    text-align: center;
    font-size: 12px;
    color: var(--ink-dim);
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .label {
    font-size: 12px;
    color: var(--ink-dim);
  }
  .count {
    font-size: 13px;
    color: var(--ink-dim);
  }
  .count strong {
    color: #f0e6d2;
  }
  .card {
    margin-top: 12px;
    padding: 12px 14px 14px;
    border: 1px solid #322820;
    border-radius: 10px;
    background: #14100c;
  }
  .sub,
  .hint,
  .empty {
    margin: 6px 0 8px;
    font-size: 12px;
    color: var(--ink-dim);
  }
  .warn {
    margin: 8px 0 0;
    font-size: 13px;
    color: #d8452e;
  }
  .rows {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
  }
  .row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    width: 100%;
    padding: 6px 8px;
    font-family: inherit;
    font-size: 14px;
    color: var(--ink);
    text-align: left;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }
  li:nth-child(odd) > .row {
    background: #1a140f;
  }
  .row.hdr {
    font-size: 11px;
    color: var(--ink-dim);
    cursor: default;
  }
  li > .row.me {
    background: #2c2415;
    color: #f0e6d2;
    outline: 1px solid #5a4424;
  }
  .rank {
    width: 22px;
    color: var(--ink-dim);
    text-align: right;
    flex: none;
  }
  .nm {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .num {
    font-size: 12px;
    color: var(--ink-dim);
    flex: none;
  }
  .pts {
    width: 34px;
    text-align: right;
    font-weight: bold;
    color: #f0e6d2;
    flex: none;
  }
  .you {
    margin: 10px 0 0;
    font-size: 13px;
    color: var(--ink-dim);
  }
  .small {
    padding: 3px 10px;
    font-family: inherit;
    font-size: 12px;
    color: var(--ink);
    background: #241a14;
    border: 1px solid #4a3520;
    border-radius: 6px;
    cursor: pointer;
  }
  .small.active {
    border-color: var(--accent);
    color: #f0e6d2;
  }
  .small:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .pair {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    font-size: 13px;
    color: var(--ink-dim);
  }
  select {
    flex: 1;
    min-width: 0;
    padding: 6px;
    font-family: inherit;
    font-size: 13px;
    color: var(--ink);
    background: #241a14;
    border: 1px solid #4a3520;
    border-radius: 6px;
  }
  .watch {
    display: block;
    width: 100%;
    margin-top: 10px;
    padding: 10px;
    font-family: inherit;
    font-size: 15px;
    color: #f0e6d2;
    background: var(--accent);
    border: none;
    border-radius: 8px;
    cursor: pointer;
  }
  .watch:disabled {
    opacity: 0.5;
  }
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background: rgba(0, 0, 0, 0.65);
  }
  .sheet {
    width: 100%;
    max-width: 480px;
    max-height: 85vh;
    overflow-y: auto;
    padding: 16px 16px 24px;
    text-align: left;
    background: #1a140f;
    border: 1px solid #4a3520;
    border-bottom: none;
    border-radius: 14px 14px 0 0;
  }
  .sheet.wide {
    max-width: 640px;
  }
  .sheet-name {
    font-size: 17px;
    color: #f0e6d2;
  }
  .close {
    margin-top: 12px;
  }
  .ctrl {
    display: flex;
    gap: 6px;
    margin-top: 8px;
  }
  .stage :global(canvas) {
    width: 100%;
    height: auto;
    border: 1px solid #2a221a;
    border-radius: 6px;
  }
</style>
