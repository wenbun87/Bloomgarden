import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "./env";

// Service-role client for the Worker — bypasses RLS so we can write the
// shared briefs and portfolio tables. Never ship this key to the client.
export function adminClient(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
