"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";

import { getServiceClient } from "@/lib/supabase/service";
import { getStripe, CONSULTATION_AMOUNT_GROSZE, CONSULTATION_CURRENCY } from "@/lib/stripe";
import { broadcastSlot } from "@/lib/supabase/broadcast";
import { generateGrid } from "@/lib/slots";
import { getDictionary, getLocaleFromCookie, LOCALE_COOKIE } from "@/lib/i18n";

export type BookingState = { error: string | null };

const POSTGRES_UNIQUE_VIOLATION = "23505";

/**
 * App origin from request headers — works on any Vercel domain (production
 * and preview). Falls back to env / localhost for safety.
 */
function resolveAppUrl(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? "https";
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/**
 * Booking Server Action (anonymous, authoritative on the server).
 * Order: INSERT pending (reserved via index, atomically inside the RPC)
 * -> Stripe Checkout -> save session.id -> Broadcast -> redirect to Stripe.
 */
export async function createBooking(
  _prev: BookingState,
  formData: FormData
): Promise<BookingState> {
  const t = getDictionary(getLocaleFromCookie(cookies().get(LOCALE_COOKIE)?.value));

  const slug = String(formData.get("slug") ?? "").trim();
  const doctorId = String(formData.get("doctorId") ?? "").trim();
  const startTime = String(formData.get("startTime") ?? "").trim();
  const patientName = String(formData.get("patientName") ?? "").trim();

  if (!slug || !doctorId || !startTime) {
    return { error: t.errors.invalidForm };
  }
  if (patientName.length < 2) {
    return { error: t.errors.nameTooShort };
  }

  const supabase = getServiceClient();

  // 1) slug -> tenant_id (authoritative).
  const { data: tenant, error: tErr } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (tErr) return { error: t.errors.serverError };
  if (!tenant) return { error: t.errors.clinicNotFound };

  // 2) Doctor must belong to this tenant.
  const { data: doctor, error: dErr } = await supabase
    .from("doctors")
    .select("id, name")
    .eq("id", doctorId)
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  if (dErr) return { error: t.errors.serverError };
  if (!doctor) return { error: t.errors.doctorNotFound };

  // 3) start_time must be a real, future grid slot (anti-tamper).
  //    The slot set is locale-independent, so the default grid is fine here.
  const validSlot = generateGrid().some((day) =>
    day.slots.some((s) => s.startTime === startTime)
  );
  if (!validSlot) {
    return { error: t.errors.slotStale };
  }

  // 4) Atomic reservation: JIT expire + insert pending in a single transaction.
  const { data: bookingId, error: bErr } = await supabase.rpc("book_slot", {
    p_tenant_id: tenant.id,
    p_doctor_id: doctor.id,
    p_patient_name: patientName,
    p_start_time: startTime,
  });

  if (bErr) {
    if (bErr.code === POSTGRES_UNIQUE_VIOLATION) {
      return { error: t.errors.slotTaken };
    }
    return { error: t.errors.bookingFailed };
  }

  const id = bookingId as string;
  const appUrl = resolveAppUrl();

  // 5) Stripe Checkout Session. The pending row already holds the slot via index.
  let checkoutUrl: string;
  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      client_reference_id: id,
      metadata: {
        booking_id: id,
        tenant_id: tenant.id,
        doctor_id: doctor.id,
        start_time: startTime,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: CONSULTATION_CURRENCY,
            unit_amount: CONSULTATION_AMOUNT_GROSZE,
            product_data: { name: `${t.stripe.visit} — ${doctor.name}` },
          },
        },
      ],
      success_url: `${appUrl}/${slug}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/${slug}/cancel`,
    });

    if (!session.url) throw new Error("Missing Stripe session URL.");
    checkoutUrl = session.url;

    // Save session.id on the row (guard: only while still pending).
    await supabase
      .from("bookings")
      .update({ stripe_session_id: session.id })
      .eq("id", id)
      .eq("status", "pending");
  } catch {
    // Stripe failed — free the slot immediately (instead of waiting for JIT/expiry).
    await supabase
      .from("bookings")
      .update({ status: "expired" })
      .eq("id", id)
      .eq("status", "pending");
    return { error: t.errors.paymentUnavailable };
  }

  // 6) Broadcast: the slot disappears for other clients immediately.
  await broadcastSlot({
    tenantId: tenant.id,
    doctorId: doctor.id,
    startTime,
    event: "taken",
  });

  // 7) Redirect to Stripe (redirect() throws NEXT_REDIRECT — outside try/catch!).
  redirect(checkoutUrl);
}
