import Link from "next/link";

export const dynamic = "force-dynamic";

type Props = {
  params: { slug: string };
  searchParams: { session_id?: string };
};

export default function SuccessPage({ params, searchParams }: Props) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <div className="w-full border-2 border-border p-8 shadow-brutal">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Status
        </p>
        <h1 className="mt-2 text-3xl font-bold uppercase tracking-tight">
          Platnosc przyjeta
        </h1>
        <p className="mt-4 text-sm">
          Dziekujemy. Twoja rezerwacja jest potwierdzana automatycznie po
          zaksiegowaniu platnosci (webhook Stripe).
        </p>
        {searchParams.session_id && (
          <p className="mt-4 break-all border-2 border-border bg-secondary px-3 py-2 text-[10px] uppercase tracking-wide">
            sesja: {searchParams.session_id}
          </p>
        )}
        <Link
          href={`/${params.slug}`}
          className="mt-6 inline-block border-2 border-border bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wide text-primary-foreground"
        >
          ← Wroc do kalendarza
        </Link>
      </div>
    </main>
  );
}
