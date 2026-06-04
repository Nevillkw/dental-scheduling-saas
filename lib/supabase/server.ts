import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Klient #2: AUTHENTICATED (personel).
 * Cookie-based SSR. RLS dziala po claimie app_metadata.tenant_id z JWT,
 * wiec personel `clinic-a` nie widzi danych `clinic-b`.
 */
export function createSupabaseServerClient() {
  const cookieStore = cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Wywolane z Server Component bez mozliwosci zapisu cookies — ignorujemy.
          // Odswiezenie sesji obsluguje middleware.
        }
      },
    },
  });
}
