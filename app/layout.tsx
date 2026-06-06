import type { Metadata } from "next";
import { cookies } from "next/headers";

import { getLocaleFromCookie, LOCALE_COOKIE } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://dental-scheduling-saas.vercel.app"),
  title: "DENTAL // Booking — multi-tenant SaaS demo",
  description:
    "Multi-tenant dental appointment booking. Strict RLS isolation, atomic double-booking prevention, live availability (Broadcast), Stripe Checkout. Next.js 14 + Supabase.",
  openGraph: {
    title: "DENTAL // Booking — multi-tenant SaaS demo",
    description:
      "Strict multi-tenant isolation, atomic double-booking, live availability, Stripe Checkout. Next.js 14 + Supabase.",
    url: "https://dental-scheduling-saas.vercel.app",
    siteName: "Dental Scheduling SaaS",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DENTAL // Booking — multi-tenant SaaS demo",
    description:
      "Strict multi-tenant isolation, atomic double-booking, live availability, Stripe Checkout.",
  },
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
