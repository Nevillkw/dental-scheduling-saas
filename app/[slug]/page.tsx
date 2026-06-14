import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { getServiceClient } from "@/lib/supabase/service";
import { generateGrid } from "@/lib/slots";
import { getDictionary, getLocaleFromCookie, LOCALE_COOKIE } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { NavButtons } from "@/components/NavButtons";
import { DemoBanner } from "@/components/DemoBanner";
import { BookingCalendar } from "./BookingCalendar";

// Time- and DB-dependent — no static prerender.
export const dynamic = "force-dynamic";

type PageProps = { params: { slug: string } };

export default async function ClinicPage({ params }: PageProps) {
  const { slug } = params;
  const locale = getLocaleFromCookie(cookies().get(LOCALE_COOKIE)?.value);
  const t = getDictionary(locale);
  const supabase = getServiceClient();

  // 1) slug -> tenant (authoritative, service-role).
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle();
  if (!tenant) notFound();

  // 2) Tenant's doctors.
  const { data: doctors } = await supabase
    .from("doctors")
    .select("id, name")
    .eq("tenant_id", tenant.id)
    .order("name", { ascending: true });

  // 3) Grid (static config, future slots).
  const days = generateGrid(locale);

  // 4) Active bookings (availability = grid - active).
  //    "Active" = confirmed OR (pending and not yet expired).
  const nowIso = new Date().toISOString();
  const { data: bookings } = await supabase
    .from("bookings")
    .select("doctor_id, start_time, status, expires_at")
    .eq("tenant_id", tenant.id)
    .in("status", ["pending", "confirmed"])
    .gte("start_time", nowIso);

  const now = Date.now();
  const initialTaken: string[] = (bookings ?? [])
    .filter((b) => {
      if (b.status === "confirmed") return true;
      // pending only counts while the hold is still valid (otherwise JIT frees it).
      return b.expires_at != null && new Date(b.expires_at as string).getTime() > now;
    })
    .map(
      (b) =>
        `${b.doctor_id as string}|${new Date(b.start_time as string).toISOString()}`
    );

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <NavButtons back={t.common.navBack} forward={t.common.navForward} />
          <Link
            href="/"
            className="border border-border px-3 py-1 text-xs font-semibold uppercase tracking-wide hover:bg-secondary"
          >
            ← {t.common.toClinics}
          </Link>
        </div>
        <LanguageSwitcher locale={locale} />
      </div>

      <header className="mb-8 flex items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t.clinic.bookingHeading}
          </p>
          <h1 className="text-3xl font-semibold uppercase tracking-tight">{tenant.name}</h1>
        </div>
        <Link
          href={`/${slug}/staff`}
          className="border border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide hover:bg-secondary"
        >
          {t.clinic.staffPanelLink}
        </Link>
      </header>

      <DemoBanner dict={t.demo} slug={slug} />

      {!doctors || doctors.length === 0 ? (
        <p className="border border-border p-4 text-sm">{t.clinic.noDoctors}</p>
      ) : (
        <BookingCalendar
          slug={slug}
          tenantId={tenant.id}
          doctors={doctors}
          days={days}
          initialTaken={initialTaken}
          locale={locale}
          dict={t}
        />
      )}
    </main>
  );
}
