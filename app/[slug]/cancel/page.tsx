import Link from "next/link";

export const dynamic = "force-dynamic";

type Props = { params: { slug: string } };

export default function CancelPage({ params }: Props) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <div className="w-full border-2 border-border p-8 shadow-brutal">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Status
        </p>
        <h1 className="mt-2 text-3xl font-bold uppercase tracking-tight">
          Platnosc anulowana
        </h1>
        <p className="mt-4 text-sm">
          Rezerwacja nie zostala oplacona. Wstepna blokada slotu wygasnie
          automatycznie po 15 minutach i termin wroci do puli.
        </p>
        <Link
          href={`/${params.slug}`}
          className="mt-6 inline-block border-2 border-border bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wide text-primary-foreground"
        >
          ← Wybierz inny termin
        </Link>
      </div>
    </main>
  );
}
