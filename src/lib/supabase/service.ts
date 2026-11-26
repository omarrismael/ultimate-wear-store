import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./client";

/**
 * Optional service-role Supabase client — bypasses RLS when
 * SUPABASE_SERVICE_ROLE_KEY is configured in the server environment.
 * Returns null when only the publishable key is present so routes can
 * gracefully fall back to the authenticated session client.
 */
export function createOptionalServiceClient(): SupabaseClient | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;

  const { url } = getSupabaseEnv();
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
