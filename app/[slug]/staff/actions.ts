"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDictionary, getLocaleFromCookie, LOCALE_COOKIE } from "@/lib/i18n";

export type StaffAuthState = { error: string | null };

export async function signIn(
  _prev: StaffAuthState,
  formData: FormData
): Promise<StaffAuthState> {
  const t = getDictionary(getLocaleFromCookie(cookies().get(LOCALE_COOKIE)?.value)).errors;

  const slug = String(formData.get("slug") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!slug || !email || !password) {
    return { error: t.missingCredentials };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: t.invalidCredentials };
  }

  redirect(`/${slug}/staff`);
}

export async function signOut(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "").trim();
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(`/${slug}/staff`);
}
