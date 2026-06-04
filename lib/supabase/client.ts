"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Klient #1: ANON (przegladarka).
 * Uzywany WYLACZNIE do subskrypcji kanalow Broadcast (realtime).
 * Anon nie ma zadnych polityk RLS => nie czyta zadnych tabel.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
