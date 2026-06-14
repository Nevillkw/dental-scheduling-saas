"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Browser-style history navigation: Back / Forward. Uses the App Router's
 * soft navigation, so transitions stay client-side and smooth.
 */
export function NavButtons({ back, forward }: { back: string; forward: string }) {
  const router = useRouter();

  return (
    <div className="flex border border-border" role="group" aria-label="History navigation">
      <button
        type="button"
        onClick={() => router.back()}
        aria-label={back}
        className="flex items-center gap-1 px-2 py-1 text-xs font-semibold uppercase tracking-wide hover:bg-secondary"
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="hidden sm:inline">{back}</span>
      </button>
      <button
        type="button"
        onClick={() => router.forward()}
        aria-label={forward}
        className="flex items-center gap-1 border-l border-border px-2 py-1 text-xs font-semibold uppercase tracking-wide hover:bg-secondary"
      >
        <span className="hidden sm:inline">{forward}</span>
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
