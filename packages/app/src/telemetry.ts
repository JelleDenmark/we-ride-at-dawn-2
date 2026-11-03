import { CHANNEL } from './env';

// The publishable key is designed to be public: row-level security on the
// server limits what anon can read and write.
export const SUPABASE_URL = 'https://wvrllhiktnkvbpclmrpq.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_6S2kGgYAI2gRLhfRxXBY3A_E_mIgpAi';
export const APP_VERSION = `2.0.0${CHANNEL === 'dev' ? '-dev' : ''}`;

const DEVICE_KEY = 'wrad2-device-id';

/** Stable anonymous id for this device. The league hashes it into the public player id. */
export function deviceId(): string {
  let id: string | null = null;
  try {
    id = localStorage.getItem(DEVICE_KEY);
  } catch {
    // Storage blocked: fall through to a session-only id.
  }
  if (!id) {
    id = crypto.randomUUID();
    try {
      localStorage.setItem(DEVICE_KEY, id);
    } catch {
      // Non-fatal.
    }
  }
  return id;
}
