import type { NextRequest } from "next/server";
import type Stripe from "stripe";

import { getStripe } from "@/lib/stripe";
import { getServiceClient } from "@/lib/supabase/service";
import { broadcastSlot } from "@/lib/supabase/broadcast";

// The Stripe SDK needs the Node runtime; we read the raw body via req.text().
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const whsec = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !whsec) {
    return new Response("Missing webhook signature/secret.", { status: 400 });
  }

  // RAW body — required to verify the signature (constructEvent).
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    // constructEvent: signature + 300s tolerance => replay protection out of the box.
    event = getStripe().webhooks.constructEvent(rawBody, sig, whsec);
  } catch {
    return new Response("Invalid signature.", { status: 400 });
  }

  const supabase = getServiceClient();

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const sid = session.id;

      // GUARDED IDEMPOTENT UPDATE: confirm only while still pending.
      // Replay/duplicate => 0 rows, no side effects.
      const { data, error } = await supabase
        .from("bookings")
        .update({ status: "confirmed" })
        .eq("stripe_session_id", sid)
        .eq("status", "pending")
        .select("id");
      if (error) throw error;

      if (!data || data.length === 0) {
        // 0 rows: either already confirmed (replay), or paid-after-expiry.
        const { data: row } = await supabase
          .from("bookings")
          .select("id, status")
          .eq("stripe_session_id", sid)
          .maybeSingle();

        if (row && row.status === "expired") {
          // EDGE: paid after the hold expired. Log it; refund is documented in the README.
          console.error("[stripe webhook] paid-after-expiry", {
            stripe_session_id: sid,
            booking_id: row.id,
          });
        }
      }
    } else if (event.type === "checkout.session.expired") {
      // NICE-TO-HAVE: free the pending slot and emit "freed".
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
    // Transient error => 500 => Stripe retries delivery.
    return new Response("Webhook handler error.", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
