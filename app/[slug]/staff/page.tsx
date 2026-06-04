import { notFound } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { formatSlotLabel } from "@/lib/slots";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { LoginForm } from "./LoginForm";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

type Props = { params: { slug: string } };

type BookingRow = {
  patient_name: string;
  start_time: string;
  status: string;
  doctors: { name: string } | { name: string }[] | null;
};

function doctorName(d: BookingRow["doctors"]): string {
  if (!d) return "—";
  return Array.isArray(d) ? (d[0]?.name ?? "—") : d.name;
}

export default async function StaffPage({ params }: Props) {
  const { slug } = params;

  // Sprawdz, czy slug w ogole istnieje (service-role, bez RLS).
  const svc = getServiceClient();
  const { data: tenant } = await svc
    .from("tenants")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle();
  if (!tenant) notFound();

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Niezalogowany => formularz logowania.
  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-4">
        <LoginForm slug={slug} />
      </main>
    );
  }

  // Zalogowany, ale claim tenant_id != tenant tego slugu => odmowa.
  // RLS i tak nie pokaze cudzych danych; to czytelny komunikat.
  const claimTenant = (user.app_metadata as { tenant_id?: string } | undefined)?.tenant_id;
  if (claimTenant !== tenant.id) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="border-2 border-border p-8 shadow-brutal">
          <h1 className="text-2xl font-bold uppercase">Brak dostepu</h1>
          <p className="mt-2 text-sm">
            To konto nie nalezy do kliniki <strong>{tenant.name}</strong>.
          </p>
          <form action={signOut} className="mt-4">
            <input type="hidden" name="slug" value={slug} />
            <Button type="submit" variant="outline">
              Wyloguj
            </Button>
          </form>
        </div>
      </main>
    );
  }

  // Odczyt BEZPOSREDNI przez authenticated client — RLS-JWT gwarantuje izolacje.
  const nowIso = new Date().toISOString();
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("patient_name, start_time, status, doctors(name)")
    .gte("start_time", nowIso)
    .order("start_time", { ascending: true })
    .returns<BookingRow[]>();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex items-end justify-between border-b-2 border-border pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Panel personelu · {user.email}
          </p>
          <h1 className="text-3xl font-bold uppercase tracking-tight">{tenant.name}</h1>
        </div>
        <form action={signOut}>
          <input type="hidden" name="slug" value={slug} />
          <Button type="submit" variant="outline">
            Wyloguj
          </Button>
        </form>
      </header>

      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide">
        Nadchodzace wizyty
      </h2>

      {error ? (
        <p className="border-2 border-border p-4 text-sm">
          Blad odczytu danych.
        </p>
      ) : !bookings || bookings.length === 0 ? (
        <p className="border-2 border-border p-4 text-sm">Brak nadchodzacych wizyt.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Termin</TableHead>
              <TableHead>Lekarz</TableHead>
              <TableHead>Pacjent</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((b, i) => (
              <TableRow key={`${b.start_time}-${i}`}>
                <TableCell className="font-bold tabular-nums">
                  {formatSlotLabel(b.start_time)}
                </TableCell>
                <TableCell>{doctorName(b.doctors)}</TableCell>
                <TableCell>{b.patient_name}</TableCell>
                <TableCell>
                  <span className="border-2 border-border px-2 py-0.5 text-xs font-bold uppercase">
                    {b.status}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
