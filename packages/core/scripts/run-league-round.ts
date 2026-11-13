/**
 * Nightly league round. Scores every board synced for the current season
 * (night seed = ride date), writes league_rounds + league_results, posts to
 * Discord. A second run for a closed round is a no-op.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... npm run league:round -- --dry
 *   SUPABASE_SERVICE_ROLE_KEY=... npm run league:round
 */
import { currentRideDate } from '../src/seed';
import { seasonIdFor } from '../src/shop';
import { runRound, inRoundWindow } from './lib/league-round';

const args = process.argv.slice(2);
const dry = args.some((a) => a === '--dry' || a === 'dry');
if (args.includes('--scheduled') && !inRoundWindow(new Date())) {
  console.log('Outside the 21:30-06:00 Copenhagen window, skipping this scheduled run.');
  process.exit(0);
}
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required (boards are not anon-readable).');
  process.exit(1);
}
const rideDate = currentRideDate();
const season = seasonIdFor(rideDate);
await runRound(fetch, key, { season, rideDate, dry });
// Dev builds play a parallel `dev-` season (see packages/app/src/league.ts).
await runRound(fetch, key, { season: `dev-${season}`, rideDate, dry, notify: false });
