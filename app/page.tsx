import Link from "next/link";

import { getServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let tenants: { slug: string; name: string }[] = [];
  let configError = false;

  try {
    const supabase = getServiceClient();
    const { data } = await supabase
      .from("tenants")
      .select("slug, name")
      .order("name", { ascending: true });
    tenants = data ?? [];
  } catch {
    configError = true;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
        Multi-tenant SaaS · demo
      </p>
      <h1 className="mt-1 text-4xl font-bold uppercase tracking-tight">
        Dental // Rezerwacje
      </h1>
      <p className="mt-4 max-w-prose text-sm">
        Każda klinika to osobny tenant pod ścieżką <code>/[slug]</code>. Izolacja
        twarda po RLS, rezerwacje atomowe (partial unique index), dostępność na
        żywo (Broadcast), płatność przez Stripe Checkout.
      </p>

      <h2 className="mt-10 border-b-2 border-border pb-2 text-sm font-bold uppercase tracking-wide">
        Kliniki
      </h2>

      {configError ? (
        <p className="mt-4 border-2 border-border bg-secondary p-4 text-sm">
          Brak konfiguracji Supabase. Uzupełnij <code>.env.local</code> i wykonaj{" "}
          <code>supabase/schema.sql</code> + <code>seed.sql</code>.
        </p>
      ) : tenants.length === 0 ? (
        <p className="mt-4 border-2 border-border p-4 text-sm">
          Brak tenantów. Uruchom <code>supabase/seed.sql</code>.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {tenants.map((t) => (
            <li key={t.slug}>
              <Link
                href={`/${t.slug}`}
                className="flex items-center justify-between border-2 border-border p-4 shadow-brutal-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
              >
                <span className="font-bold uppercase tracking-wide">{t.name}</span>
                <span className="text-xs text-muted-foreground">/{t.slug} →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
