import Link from "next/link";

import type { Dict } from "@/lib/i18n";
import { DEMO_STAFF, DEMO_TEST_CARD, isDemo } from "@/lib/demo";

/**
 * Self-serve hint for non-technical visitors: test card + staff credentials.
 * Server Component; only rendered in demo mode (NEXT_PUBLIC_DEMO="1").
 */
export function DemoBanner({ dict, slug }: { dict: Dict["demo"]; slug: string }) {
  if (!isDemo()) return null;
  const staff = DEMO_STAFF[slug];

  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 border-2 border-dashed border-border bg-secondary px-3 py-2 text-xs">
      <span className="border-2 border-border bg-primary px-1.5 py-0.5 font-bold uppercase tracking-wide text-primary-foreground">
        {dict.badge}
      </span>

      <span>
        <span className="text-muted-foreground">{dict.testCard}:</span>{" "}
        <span className="font-bold tabular-nums">{DEMO_TEST_CARD}</span>
      </span>

      {staff && (
        <>
          <span>
            <span className="text-muted-foreground">{dict.staff}:</span>{" "}
            <span className="font-bold">{staff.email}</span>
            {" / "}
            <span className="font-bold">{staff.password}</span>
          </span>
          <Link
            href={`/${slug}/staff`}
            className="font-bold uppercase tracking-wide underline underline-offset-2"
          >
            {dict.openPanel}
          </Link>
        </>
      )}

      <span className="text-muted-foreground">{dict.noCharge}</span>
    </div>
  );
}
