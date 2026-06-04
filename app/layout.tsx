import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DENTAL // Rezerwacje",
  description: "Multi-tenant dental scheduling — brutalist MVP",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
