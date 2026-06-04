import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client #3: SERVICE-ROLE.
 * Server-only (Server Actions + Stripe webhook). Bypasses RLS — authoritatively
 * translates slug -> tenant_id and writes bookings. Never import into client code.
 */
let cached: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing config: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  cached = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
