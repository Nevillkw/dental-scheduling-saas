import Link from "next/link";
import { cookies } from "next/headers";

import { getServiceClient } from "@/lib/supabase/service";
import { getDictionary, getLocaleFromCookie, LOCALE_COOKIE } from "@/lib/i18n";
import { DEMO_DEFAULT_SLUG } from "@/lib/demo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { NavButtons } from "@/components/NavButtons";
import { DemoBanner } from "@/components/DemoBanner";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const locale = getLocaleFromCookie(cookies().get(LOCALE_COOKIE)?.value);
  const t = getDictionary(locale);

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
      <div className="mb-4 flex items-center justify-between gap-4">
        <NavButtons back={t.common.navBack} forward={t.common.navForward} />
        <LanguageSwitcher locale={locale} />
      </div>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {t.home.badge}
      </p>
      <h1 className="text-4xl font-semibold uppercase tracking-tight">{t.home.title}</h1>
      <p className="mb-6 mt-4 max-w-prose text-sm">{t.home.intro}</p>

      <DemoBanner dict={t.demo} slug={DEMO_DEFAULT_SLUG} />

      <h2 className="mt-4 border-b border-border pb-2 text-sm font-semibold uppercase tracking-wide">
        {t.home.clinicsHeading}
      </h2>

      {configError ? (
        <p className="mt-4 border border-border bg-secondary p-4 text-sm">
          {t.home.configError}
        </p>
      ) : tenants.length === 0 ? (
        <p className="mt-4 border border-border p-4 text-sm">{t.home.noTenants}</p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {tenants.map((tenant) => (
            <li key={tenant.slug}>
              <Link
                href={`/${tenant.slug}`}
                className="flex items-center justify-between border border-border p-4 transition-colors hover:bg-secondary"
              >
                <span className="font-semibold uppercase tracking-wide">{tenant.name}</span>
                <span className="text-xs text-muted-foreground">/{tenant.slug} →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
