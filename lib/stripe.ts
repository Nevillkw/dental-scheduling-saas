import Stripe from "stripe";

/** Lazy init — keeps the build green when the key is missing from env. */
let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY.");
  // apiVersion omitted => SDK uses the account's version.
  cached = new Stripe(key);
  return cached;
}

/** Consultation price in grosze (Test Mode). */
export const CONSULTATION_AMOUNT_GROSZE = 15000; // 150.00 PLN
export const CONSULTATION_CURRENCY = "pln";
