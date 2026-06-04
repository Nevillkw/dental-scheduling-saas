"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Client #1: ANON (browser).
 * Used ONLY to subscribe to Broadcast channels (realtime).
 * Anon has no RLS policies => it reads no tables.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
