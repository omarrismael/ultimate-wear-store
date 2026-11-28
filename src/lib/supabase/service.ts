import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./client";

/**
 * Optional service-role Supabase client — bypasses RLS when a real
 * SUPABASE_SERVICE_ROLE_KEY is configured in the server environment.
 * Guards against empty strings or accidentally reusing the publishable key.
 */
export function createOptionalServiceClient(): SupabaseClient | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceKey || serviceKey.startsWith("sb_publishable_")) return null;

  const { url, key: publishableKey } = getSupabaseEnv();
  if (serviceKey === publishableKey) return null;

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
