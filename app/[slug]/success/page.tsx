import Link from "next/link";
import { cookies } from "next/headers";

import { getDictionary, getLocaleFromCookie, LOCALE_COOKIE } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type Props = {
  params: { slug: string };
  searchParams: { session_id?: string };
};

export default function SuccessPage({ params, searchParams }: Props) {
  const t = getDictionary(getLocaleFromCookie(cookies().get(LOCALE_COOKIE)?.value)).success;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <div className="w-full border-2 border-border p-8 shadow-brutal">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {t.status}
        </p>
        <h1 className="mt-2 text-3xl font-bold uppercase tracking-tight">{t.title}</h1>
        <p className="mt-4 text-sm">{t.body}</p>
        {searchParams.session_id && (
          <p className="mt-4 break-all border-2 border-border bg-secondary px-3 py-2 text-[10px] uppercase tracking-wide">
            {t.sessionLabel} {searchParams.session_id}
          </p>
        )}
        <Link
          href={`/${params.slug}`}
          className="mt-6 inline-block border-2 border-border bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wide text-primary-foreground"
        >
          {t.back}
        </Link>
      </div>
    </main>
  );
}
