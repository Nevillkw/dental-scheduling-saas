/**
 * Demo data for the public showcase. Rendered only when NEXT_PUBLIC_DEMO="1"
 * (so a real deployment never leaks demo credentials). Used server-side only
 * (DemoBanner is a Server Component), so it stays out of the client bundle.
 */

export const DEMO_TEST_CARD = "4242 4242 4242 4242";
export const DEMO_DEFAULT_SLUG = "klinika-alfa";

export type DemoStaff = { email: string; password: string };

// Test-mode staff accounts, published intentionally for the live demo.
export const DEMO_STAFF: Record<string, DemoStaff> = {
  "klinika-alfa": { email: "alfa@klinika.test", password: "test" },
  "klinika-beta": { email: "beta@klinika.test", password: "test" },
};

export function isDemo(): boolean {
  return process.env.NEXT_PUBLIC_DEMO === "1";
}
