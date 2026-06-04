import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Klient #3: SERVICE-ROLE.
 * Uzywany WYLACZNIE po stronie serwera (Server Actions + webhook Stripe).
 * Omija RLS — autorytatywnie tlumaczy slug -> tenant_id i zapisuje bookingi.
 * Nigdy nie importowac do kodu klienckiego.
 */
let cached: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Brak konfiguracji: NEXT_PUBLIC_SUPABASE_URL i/lub SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  cached = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
