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
import { runRound } from './lib/league-round';

const dry = process.argv.slice(2).some((a) => a === '--dry' || a === 'dry');
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
