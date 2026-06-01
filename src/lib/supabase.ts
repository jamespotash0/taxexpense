// Supabase clients (TSNAP-004).
//
// - `supabase`      : anon-key client. Subject to RLS (DEC-001 = default-deny),
//                     so it can read/write nothing until per-table policies exist.
//                     Kept for future client-side / RLS-scoped use.
// - `supabaseAdmin` : service-role client. Bypasses RLS. SERVER-ONLY — importing
//                     it into a client component would leak the service role key.
//                     All server data access goes through this + lib/db.orgScoped().
//
// We construct clients lazily so a missing env var fails at first use with a clear
// message instead of crashing module load (which would break the whole build).

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PUBLIC_ENV, requireEnv } from './env';

let _anon: SupabaseClient | null = null;
let _admin: SupabaseClient | null = null;

/** Anon-key client (RLS-bound). */
export function getSupabase(): SupabaseClient {
  if (_anon) return _anon;
  if (!PUBLIC_ENV.supabaseUrl || !PUBLIC_ENV.supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  _anon = createClient(PUBLIC_ENV.supabaseUrl, PUBLIC_ENV.supabaseAnonKey, {
    auth: { persistSession: false },
  });
  return _anon;
}

/** Service-role client (bypasses RLS). SERVER-ONLY. */
export function getSupabaseAdmin(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('getSupabaseAdmin() must never be called in the browser.');
  }
  if (_admin) return _admin;
  const url = PUBLIC_ENV.supabaseUrl || requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  _admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  return _admin;
}
