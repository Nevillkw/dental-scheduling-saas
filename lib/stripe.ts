import Stripe from "stripe";

/** Lazy init — nie wywracamy builda, gdy brak klucza w env. */
let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Brak STRIPE_SECRET_KEY.");
  // apiVersion pominiety => SDK uzywa wersji konta.
  cached = new Stripe(key);
  return cached;
}

/** Cena konsultacji w groszach (Test Mode). */
export const CONSULTATION_AMOUNT_GROSZE = 15000; // 150,00 zl
export const CONSULTATION_CURRENCY = "pln";
