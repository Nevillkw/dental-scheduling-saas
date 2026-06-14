import Link from "next/link";
import { cookies } from "next/headers";

import { getDictionary, getLocaleFromCookie, LOCALE_COOKIE } from "@/lib/i18n";
import { NavButtons } from "@/components/NavButtons";

export const dynamic = "force-dynamic";

type Props = { params: { slug: string } };

export default function CancelPage({ params }: Props) {
  const d = getDictionary(getLocaleFromCookie(cookies().get(LOCALE_COOKIE)?.value));
  const t = d.cancel;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-4 flex w-full items-center justify-between gap-2">
        <NavButtons back={d.common.navBack} forward={d.common.navForward} />
        <Link
          href="/"
          className="border border-border px-3 py-1 text-xs font-semibold uppercase tracking-wide hover:bg-secondary"
        >
          ← {d.common.toClinics}
        </Link>
      </div>

      <div className="w-full border border-border p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t.status}
        </p>
        <h1 className="mt-2 text-3xl font-semibold uppercase tracking-tight">{t.title}</h1>
        <p className="mt-4 text-sm">{t.body}</p>
        <Link
          href={`/${params.slug}`}
          className="mt-6 inline-block border border-border bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground"
        >
          {t.back}
        </Link>
      </div>
    </main>
  );
}
