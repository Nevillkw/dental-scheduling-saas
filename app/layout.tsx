import type { Metadata } from "next";
import { cookies } from "next/headers";

import { getLocaleFromCookie, LOCALE_COOKIE } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "DENTAL // Booking",
  description: "Multi-tenant dental scheduling — brutalist MVP",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = getLocaleFromCookie(cookies().get(LOCALE_COOKIE)?.value);
  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
