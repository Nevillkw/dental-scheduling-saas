"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type StaffAuthState = { error: string | null };

export async function signIn(
  _prev: StaffAuthState,
  formData: FormData
): Promise<StaffAuthState> {
  const slug = String(formData.get("slug") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!slug || !email || !password) {
    return { error: "Podaj email i haslo." };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "Nieprawidlowy email lub haslo." };
  }

  redirect(`/${slug}/staff`);
}

export async function signOut(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "").trim();
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(`/${slug}/staff`);
}
