// Seeds a few 'confirmed' demo bookings so the staff panel isn't empty and the
// calendar shows some taken slots. Idempotent (skips a slot that's already active).
//   node --env-file=.env.local scripts/seed-demo-bookings.mjs

import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const TZ = "Europe/Warsaw";

function tzOffsetMs(instant) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(instant);
  const m = {};
  for (const x of p) if (x.type !== "literal") m[x.type] = parseInt(x.value, 10);
  const hour = m.hour === 24 ? 0 : m.hour;
  return Date.UTC(m.year, m.month - 1, m.day, hour, m.minute, m.second) - instant.getTime();
}
function warsawWallToUtc(y, mo, d, h, mi) {
  const guess = Date.UTC(y, mo - 1, d, h, mi, 0);
  return new Date(guess - tzOffsetMs(new Date(guess)));
}
function warsawDateParts(instant) {
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(instant);
  const [y, m, d] = s.split("-").map((x) => parseInt(x, 10));
  return { y, m, d };
}
// Flattened future working-day slots (Mon-Fri 9:00-16:30), same instants as the app grid.
function futureSlots(count) {
  const now = Date.now();
  const out = [];
  let cur = warsawDateParts(new Date());
  let guard = 0;
  while (out.length < count && guard < 31) {
    guard++;
    const dow = new Date(Date.UTC(cur.y, cur.m - 1, cur.d)).getUTCDay();
    if (dow !== 0 && dow !== 6) {
      for (let h = 9; h < 17 && out.length < count; h++) {
        for (let mi = 0; mi < 60 && out.length < count; mi += 30) {
          const t = warsawWallToUtc(cur.y, cur.m, cur.d, h, mi);
          if (t.getTime() > now) out.push(t.toISOString());
        }
      }
    }
    const nx = new Date(Date.UTC(cur.y, cur.m - 1, cur.d) + 86400000);
    cur = { y: nx.getUTCFullYear(), m: nx.getUTCMonth() + 1, d: nx.getUTCDate() };
  }
  return out;
}

const NAMES = ["Jan Kowalski", "Anna Nowak", "Piotr Wiśniewski", "Maria Wójcik", "Tomasz Lewandowski"];

// (tenant slug) -> list of { slotIndex, doctorIndex }
const PLAN = {
  "klinika-alfa": [
    { slot: 1, doctor: 0 },
    { slot: 4, doctor: 1 },
    { slot: 9, doctor: 0 },
  ],
  "klinika-beta": [
    { slot: 2, doctor: 0 },
    { slot: 11, doctor: 0 },
  ],
};

async function seedTenant(slug, plan, slots, nameOffset) {
  const { data: tenant } = await sb.from("tenants").select("id, name").eq("slug", slug).maybeSingle();
  if (!tenant) { console.log(`skip ${slug} (no tenant)`); return; }
  const { data: doctors } = await sb
    .from("doctors").select("id, name").eq("tenant_id", tenant.id).order("name");
  if (!doctors || doctors.length === 0) { console.log(`skip ${slug} (no doctors)`); return; }

  let i = 0;
  for (const p of plan) {
    const startTime = slots[p.slot];
    const doctor = doctors[p.doctor % doctors.length];
    const patient = NAMES[(nameOffset + i) % NAMES.length];
    i++;
    if (!startTime) continue;

    const { data: existing } = await sb
      .from("bookings")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("doctor_id", doctor.id)
      .eq("start_time", startTime)
      .in("status", ["pending", "confirmed"])
      .maybeSingle();
    if (existing) { console.log(`= exists  ${slug} ${doctor.name} ${startTime}`); continue; }

    const { error } = await sb.from("bookings").insert({
      tenant_id: tenant.id,
      doctor_id: doctor.id,
      patient_name: patient,
      start_time: startTime,
      status: "confirmed",
    });
    console.log(error ? `! error   ${slug} ${startTime}: ${error.message}` : `+ added   ${slug} ${doctor.name} ${startTime} (${patient})`);
  }
}

async function main() {
  const slots = futureSlots(20);
  if (slots.length === 0) { console.log("No future slots."); return; }
  await seedTenant("klinika-alfa", PLAN["klinika-alfa"], slots, 0);
  await seedTenant("klinika-beta", PLAN["klinika-beta"], slots, 3);
  console.log("Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
