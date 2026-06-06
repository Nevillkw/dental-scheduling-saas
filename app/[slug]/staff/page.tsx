import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { formatSlotLabel } from "@/lib/slots";
import { getDictionary, getLocaleFromCookie, LOCALE_COOKIE } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { NavButtons } from "@/components/NavButtons";
import { DemoBanner } from "@/components/DemoBanner";
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
  const locale = getLocaleFromCookie(cookies().get(LOCALE_COOKIE)?.value);
  const t = getDictionary(locale);

  // Check the slug exists at all (service-role, no RLS).
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

  // Not signed in => login form.
  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-4 px-4">
        <div className="flex w-full max-w-sm items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <NavButtons back={t.common.navBack} forward={t.common.navForward} />
            <Link
              href={`/${slug}`}
              className="border-2 border-border px-3 py-1 text-xs font-bold uppercase tracking-wide hover:bg-secondary"
            >
              ← {t.common.toCalendar}
            </Link>
          </div>
          <LanguageSwitcher locale={locale} />
        </div>
        <div className="w-full max-w-sm">
          <DemoBanner dict={t.demo} slug={slug} />
        </div>
        <LoginForm slug={slug} dict={t.staff} />
      </main>
    );
  }

  // Signed in, but the claim tenant_id != this slug's tenant => deny.
  // RLS would hide other tenants' data anyway; this is a clear message.
  const claimTenant = (user.app_metadata as { tenant_id?: string } | undefined)?.tenant_id;
  if (claimTenant !== tenant.id) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="border-2 border-border p-8 shadow-brutal">
          <h1 className="text-2xl font-bold uppercase">{t.staff.accessDenied}</h1>
          <p className="mt-2 text-sm">
            {t.staff.accessDeniedBody.replace("{clinic}", tenant.name)}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Link
              href={`/${slug}`}
              className="border-2 border-border px-3 py-2 text-xs font-bold uppercase tracking-wide hover:bg-secondary"
            >
              ← {t.common.toCalendar}
            </Link>
            <form action={signOut}>
              <input type="hidden" name="slug" value={slug} />
              <Button type="submit" variant="outline">
                {t.common.logout}
              </Button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  // DIRECT read via the authenticated client — RLS-JWT guarantees isolation.
  const nowIso = new Date().toISOString();
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("patient_name, start_time, status, doctors(name)")
    .gte("start_time", nowIso)
    .order("start_time", { ascending: true })
    .returns<BookingRow[]>();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <NavButtons back={t.common.navBack} forward={t.common.navForward} />
          <Link
            href={`/${slug}`}
            className="border-2 border-border px-3 py-1 text-xs font-bold uppercase tracking-wide hover:bg-secondary"
          >
            ← {t.common.toCalendar}
          </Link>
        </div>
        <LanguageSwitcher locale={locale} />
      </div>

      <header className="mb-6 flex items-end justify-between gap-4 border-b-2 border-border pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {t.staff.panelLabel.replace("{email}", user.email ?? "")}
          </p>
          <h1 className="text-3xl font-bold uppercase tracking-tight">{tenant.name}</h1>
        </div>
        <form action={signOut}>
          <input type="hidden" name="slug" value={slug} />
          <Button type="submit" variant="outline">
            {t.common.logout}
          </Button>
        </form>
      </header>

      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide">{t.staff.upcoming}</h2>

      {error ? (
        <p className="border-2 border-border p-4 text-sm">{t.staff.readError}</p>
      ) : !bookings || bookings.length === 0 ? (
        <p className="border-2 border-border p-4 text-sm">{t.staff.noBookings}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.staff.colTime}</TableHead>
              <TableHead>{t.staff.colDoctor}</TableHead>
              <TableHead>{t.staff.colPatient}</TableHead>
              <TableHead>{t.staff.colStatus}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((b, i) => (
              <TableRow key={`${b.start_time}-${i}`}>
                <TableCell className="font-bold tabular-nums">
                  {formatSlotLabel(b.start_time, locale)}
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
