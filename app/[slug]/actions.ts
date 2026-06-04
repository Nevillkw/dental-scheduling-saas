"use server";

import { redirect } from "next/navigation";

import { getServiceClient } from "@/lib/supabase/service";
import { getStripe, CONSULTATION_AMOUNT_GROSZE, CONSULTATION_CURRENCY } from "@/lib/stripe";
import { broadcastSlot } from "@/lib/supabase/broadcast";
import { generateGrid } from "@/lib/slots";

export type BookingState = { error: string | null };

const POSTGRES_UNIQUE_VIOLATION = "23505";

/**
 * Server Action bookingu (anon, autorytatywnie po stronie serwera).
 * Kolejnosc: INSERT pending (rezerwacja przez index, atomowo w RPC)
 * -> Stripe Checkout -> zapis session.id -> Broadcast -> redirect do Stripe.
 */
export async function createBooking(
  _prev: BookingState,
  formData: FormData
): Promise<BookingState> {
  const slug = String(formData.get("slug") ?? "").trim();
  const doctorId = String(formData.get("doctorId") ?? "").trim();
  const startTime = String(formData.get("startTime") ?? "").trim();
  const patientName = String(formData.get("patientName") ?? "").trim();

  if (!slug || !doctorId || !startTime) {
    return { error: "Nieprawidlowe dane formularza." };
  }
  if (patientName.length < 2) {
    return { error: "Podaj imie i nazwisko (min. 2 znaki)." };
  }

  const supabase = getServiceClient();

  // 1) Slug -> tenant_id (autorytatywnie).
  const { data: tenant, error: tErr } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (tErr) return { error: "Blad serwera. Sprobuj ponownie." };
  if (!tenant) return { error: "Nie znaleziono kliniki." };

  // 2) Lekarz musi nalezec do tego tenanta.
  const { data: doctor, error: dErr } = await supabase
    .from("doctors")
    .select("id, name")
    .eq("id", doctorId)
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  if (dErr) return { error: "Blad serwera. Sprobuj ponownie." };
  if (!doctor) return { error: "Nie znaleziono lekarza." };

  // 3) start_time musi byc realnym, przyszlym slotem z gridu (anti-tamper).
  const validSlot = generateGrid().some((day) =>
    day.slots.some((s) => s.startTime === startTime)
  );
  if (!validSlot) {
    return { error: "Termin jest nieaktualny. Odswiez i wybierz ponownie." };
  }

  // 4) Atomowa rezerwacja: JIT expire + insert pending w jednej transakcji.
  const { data: bookingId, error: bErr } = await supabase.rpc("book_slot", {
    p_tenant_id: tenant.id,
    p_doctor_id: doctor.id,
    p_patient_name: patientName,
    p_start_time: startTime,
  });

  if (bErr) {
    if (bErr.code === POSTGRES_UNIQUE_VIOLATION) {
      return { error: "Slot wlasnie zostal zajety. Wybierz inny termin." };
    }
    return { error: "Nie udalo sie zarezerwowac. Sprobuj ponownie." };
  }

  const id = bookingId as string;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // 5) Stripe Checkout Session. Pending juz trzyma slot przez index.
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
            product_data: { name: `Wizyta — ${doctor.name}` },
          },
        },
      ],
      success_url: `${appUrl}/${slug}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/${slug}/cancel`,
    });

    if (!session.url) throw new Error("Brak URL sesji Stripe.");
    checkoutUrl = session.url;

    // Zapis session.id na wierszu (guard: tylko jesli wciaz pending).
    await supabase
      .from("bookings")
      .update({ stripe_session_id: session.id })
      .eq("id", id)
      .eq("status", "pending");
  } catch {
    // Stripe padl — zwalniamy slot natychmiast (zamiast czekac na JIT/expiry).
    await supabase
      .from("bookings")
      .update({ status: "expired" })
      .eq("id", id)
      .eq("status", "pending");
    return { error: "Platnosc niedostepna. Sprobuj ponownie za chwile." };
  }

  // 6) Broadcast: slot znika u innych klientow natychmiast.
  await broadcastSlot({
    tenantId: tenant.id,
    doctorId: doctor.id,
    startTime,
    event: "taken",
  });

  // 7) Redirect do Stripe (redirect() rzuca NEXT_REDIRECT — poza try/catch!).
  redirect(checkoutUrl);
}
