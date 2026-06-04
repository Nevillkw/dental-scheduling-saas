import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Odswieza sesje personelu (Supabase Auth) na kazdym zadaniu, tak by
 * Server Components mialy aktualny JWT. Trasowanie tenantow po slugu
 * (`/[slug]/...`) realizuje dynamiczny segment App Routera — middleware
 * tylko utrzymuje cookies sesji przy zyciu.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Bez konfiguracji nie probujemy odswiezac sesji (np. podczas builda).
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Wywolanie getUser() wyzwala odswiezenie tokenu jezeli trzeba.
  await supabase.auth.getUser();

  return response;
}
