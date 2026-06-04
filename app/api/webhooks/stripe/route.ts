import type { NextRequest } from "next/server";
import type Stripe from "stripe";

import { getStripe } from "@/lib/stripe";
import { getServiceClient } from "@/lib/supabase/service";
import { broadcastSlot } from "@/lib/supabase/broadcast";

// Stripe SDK wymaga Node runtime; surowe body czytamy req.text().
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const whsec = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !whsec) {
    return new Response("Brak podpisu/sekretu webhooka.", { status: 400 });
  }

  // SUROWE body — wymagane do weryfikacji podpisu (constructEvent).
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    // constructEvent: podpis + tolerancja 300s => ochrona przed replay.
    event = getStripe().webhooks.constructEvent(rawBody, sig, whsec);
  } catch {
    return new Response("Nieprawidlowy podpis.", { status: 400 });
  }

  const supabase = getServiceClient();

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const sid = session.id;

      // GUARDED IDEMPOTENT UPDATE: confirm tylko jesli wciaz pending.
      // Replay/duplikat => 0 wierszy, brak skutkow ubocznych.
      const { data, error } = await supabase
        .from("bookings")
        .update({ status: "confirmed" })
        .eq("stripe_session_id", sid)
        .eq("status", "pending")
        .select("id");
      if (error) throw error;

      if (!data || data.length === 0) {
        // 0 wierszy: albo juz confirmed (replay), albo paid-after-expiry.
        const { data: row } = await supabase
          .from("bookings")
          .select("id, status")
          .eq("stripe_session_id", sid)
          .maybeSingle();

        if (row && row.status === "expired") {
          // EDGE: zaplacil po wygasnieciu. Logujemy; refund udokumentowany w README.
          console.error("[stripe webhook] paid-after-expiry", {
            stripe_session_id: sid,
            booking_id: row.id,
          });
        }
      }
    } else if (event.type === "checkout.session.expired") {
      // NICE-TO-HAVE: zwolnij pending i wyemituj "freed".
      const session = event.data.object as Stripe.Checkout.Session;
      const sid = session.id;

      const { data, error } = await supabase
        .from("bookings")
        .update({ status: "expired" })
        .eq("stripe_session_id", sid)
        .eq("status", "pending")
        .select("tenant_id, doctor_id, start_time");
      if (error) throw error;

      if (data && data.length > 0) {
        const b = data[0];
        await broadcastSlot({
          tenantId: b.tenant_id as string,
          doctorId: b.doctor_id as string,
          startTime: new Date(b.start_time as string).toISOString(),
          event: "freed",
        });
      }
    }
  } catch {
    // Blad przejsciowy => 500 => Stripe ponowi dostawe.
    return new Response("Blad obslugi webhooka.", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
