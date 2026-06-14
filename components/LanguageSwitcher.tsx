"use client";

import { useRouter } from "next/navigation";

import { LOCALES, LOCALE_COOKIE, type Locale } from "@/lib/i18n";

/**
 * Toggles the locale cookie and refreshes Server Components so they re-render
 * with the new dictionary. No full reload, no extra deps.
 */
export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter();

  function setLocale(next: Locale) {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
    router.refresh();
  }

  return (
    <div className="flex border border-border" role="group" aria-label="Language">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          aria-pressed={l === locale}
          className={[
            "px-2 py-1 text-xs font-semibold uppercase",
            l === locale ? "bg-primary text-primary-foreground" : "bg-background hover:bg-secondary",
          ].join(" ")}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
