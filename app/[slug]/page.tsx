import Link from "next/link";
import { notFound } from "next/navigation";

import { getServiceClient } from "@/lib/supabase/service";
import { generateGrid } from "@/lib/slots";
import { BookingCalendar } from "./BookingCalendar";

// Dane zalezne od czasu i bazy — bez prerenderu statycznego.
export const dynamic = "force-dynamic";

type PageProps = { params: { slug: string } };

export default async function ClinicPage({ params }: PageProps) {
  const { slug } = params;
  const supabase = getServiceClient();

  // 1) Slug -> tenant (autorytatywnie, service-role).
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle();
  if (!tenant) notFound();

  // 2) Lekarze tenanta.
  const { data: doctors } = await supabase
    .from("doctors")
    .select("id, name")
    .eq("tenant_id", tenant.id)
    .order("name", { ascending: true });

  // 3) Grid (stala konfiguracja, przyszle sloty).
  const days = generateGrid();

  // 4) Aktywne bookingi (dostepnosc = grid - aktywne).
  //    "Aktywny" = confirmed LUB (pending i jeszcze niewygasly).
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
      // pending liczy sie tylko gdy blokada wciaz wazna (inaczej JIT go zwolni).
      return b.expires_at != null && new Date(b.expires_at as string).getTime() > now;
    })
    .map(
      (b) =>
        `${b.doctor_id as string}|${new Date(b.start_time as string).toISOString()}`
    );

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8 flex items-end justify-between border-b-2 border-border pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Rezerwacja wizyty
          </p>
          <h1 className="text-3xl font-bold uppercase tracking-tight">{tenant.name}</h1>
        </div>
        <Link
          href={`/${slug}/staff`}
          className="border-2 border-border px-3 py-2 text-xs font-bold uppercase tracking-wide hover:bg-secondary"
        >
          Panel personelu →
        </Link>
      </header>

      {!doctors || doctors.length === 0 ? (
        <p className="border-2 border-border p-4 text-sm">
          Brak lekarzy w tej klinice.
        </p>
      ) : (
        <BookingCalendar
          slug={slug}
          tenantId={tenant.id}
          doctors={doctors}
          days={days}
          initialTaken={initialTaken}
        />
      )}
    </main>
  );
}
