// End-to-end logic test (no UI). Run with a LIVE target (local or production):
//   node --env-file=.env.local scripts/full-loop-test.mjs
//
// Tests: book_slot (pending) -> double-booking guard (23505) -> real Stripe
// session -> signed completed webhook -> status 'confirmed' -> webhook replay
// (idempotency). Cleans up the test row at the end.

import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SK = process.env.STRIPE_SECRET_KEY;
const WHSEC = process.env.STRIPE_WEBHOOK_SECRET;
const APP = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const sb = createClient(URL, SVC, { auth: { persistSession: false } });
const stripe = new Stripe(SK);

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) {
    console.log(`  PASS  ${name}`);
    pass++;
  } else {
    console.log(`  FAIL  ${name}`);
    fail++;
  }
}

async function postWebhook(sessionId) {
  const event = {
    id: "evt_test_" + Math.random().toString(36).slice(2),
    object: "event",
    type: "checkout.session.completed",
    data: { object: { id: sessionId, object: "checkout.session" } },
  };
  const payload = JSON.stringify(event);
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: WHSEC });
  const res = await fetch(`${APP}/api/webhooks/stripe`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": header },
    body: payload,
  });
  return res.status;
}

async function statusOf(id) {
  const { data } = await sb.from("bookings").select("status").eq("id", id).maybeSingle();
  return data?.status ?? null;
}

async function main() {
  console.log("== Full-loop test ==");

  // tenant + doctor
  const { data: tenant } = await sb
    .from("tenants")
    .select("id, name")
    .eq("slug", "klinika-alfa")
    .single();
  const { data: doctor } = await sb
    .from("doctors")
    .select("id, name")
    .eq("tenant_id", tenant.id)
    .limit(1)
    .single();
  console.log(`Tenant: ${tenant.name} | Doctor: ${doctor.name}`);

  // unique future slot (skips grid validation — this tests the RPC)
  const startTime = new Date(
    Date.now() + 180 * 86400000 + Math.floor(Math.random() * 1e7)
  ).toISOString();

  // A) book_slot -> pending
  const { data: bookingId, error: e1 } = await sb.rpc("book_slot", {
    p_tenant_id: tenant.id,
    p_doctor_id: doctor.id,
    p_patient_name: "Test Patient",
    p_start_time: startTime,
  });
  check("book_slot returns id (pending)", !e1 && typeof bookingId === "string");
  check("status = pending", (await statusOf(bookingId)) === "pending");

  // B) second booking for the same slot -> 23505
  const { error: e2 } = await sb.rpc("book_slot", {
    p_tenant_id: tenant.id,
    p_doctor_id: doctor.id,
    p_patient_name: "Second Patient",
    p_start_time: startTime,
  });
  check("double-booking blocked (23505)", e2?.code === "23505");

  // C) real Stripe session + save session.id
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    client_reference_id: bookingId,
    metadata: { booking_id: bookingId, tenant_id: tenant.id, doctor_id: doctor.id },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "pln",
          unit_amount: 15000,
          product_data: { name: `Visit — ${doctor.name}` },
        },
      },
    ],
    success_url: `${APP}/klinika-alfa/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP}/klinika-alfa/cancel`,
  });
  check("Stripe session created", !!session.id && !!session.url);
  await sb.from("bookings").update({ stripe_session_id: session.id }).eq("id", bookingId);

  // D) signed completed webhook -> confirmed
  const code1 = await postWebhook(session.id);
  check("completed webhook -> HTTP 200", code1 === 200);
  check("status = confirmed", (await statusOf(bookingId)) === "confirmed");

  // E) replay the same webhook -> still confirmed, no error
  const code2 = await postWebhook(session.id);
  check("webhook replay -> HTTP 200 (idempotent)", code2 === 200);
  check("status still confirmed", (await statusOf(bookingId)) === "confirmed");

  // F) cleanup
  await sb.from("bookings").delete().eq("id", bookingId);
  check("test row deleted", (await statusOf(bookingId)) === null);

  console.log(`\n== Result: ${pass} PASS / ${fail} FAIL ==`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
