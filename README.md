# Dental Scheduling SaaS — multi-tenant

**Language:** English · [Polski](./README.pl.md)

**Live:** https://dental.arturmrowicki.pl · **Repo:** https://github.com/Nevillkw/dental-scheduling-saas

A production-ready core of a multi-tenant dental appointment booking system, built per
[`SPEC.md`](./SPEC.md). It demonstrates 4 competencies:

1. **App Router** (Next.js 14, Server Components + Server Actions)
2. **Strict multi-tenant isolation** — hard, enforced by RLS on a JWT claim
3. **Atomic double-booking prevention** — partial unique index + JIT staleness in a transaction
4. **Real-time UI** — Supabase Broadcast per tenant

The UI ships **bilingual (PL/EN)** with a switcher (cookie-persisted locale).

## 🔎 Try it live

No setup needed — it's deployed and runs in **Stripe test mode** (no real charges).

**1. Book an appointment**
- Open a clinic: [Alfa Clinic](https://dental.arturmrowicki.pl/klinika-alfa) · [Beta Clinic](https://dental.arturmrowicki.pl/klinika-beta)
- Pick a free time slot, type any name, click **Book and pay**.
- On Stripe, pay with the test card **`4242 4242 4242 4242`**, any future expiry date, any CVC.
- You return to a confirmation page; the booking is confirmed automatically (Stripe webhook).

**2. See it in the staff panel**

| Clinic | Staff panel | Email | Password |
|---|---|---|---|
| Alfa | [/klinika-alfa/staff](https://dental.arturmrowicki.pl/klinika-alfa/staff) | `alfa@klinika.test` | `test` |
| Beta | [/klinika-beta/staff](https://dental.arturmrowicki.pl/klinika-beta/staff) | `beta@klinika.test` | `test` |

Each clinic sees **only its own** appointments (strict isolation enforced by the database). Sign in to Alfa and you won't see Beta's bookings.

**3. See real-time in action** — open the same clinic in two browser windows side by side; book a slot in one and it disappears in the other instantly.

**4. Extras** — top-right **PL / EN** toggle switches language; **← Back / Forward →** buttons navigate history.

> On the live site the test card and demo logins are also shown in a banner, so anyone can try it without reading this.

---

## Stack

- Next.js 14 (App Router, TypeScript)
- Supabase (Postgres + Auth + Realtime)
- Tailwind + shadcn/ui-style components (brutalist: black/white/gray, square)
- Stripe Checkout (Test Mode)

---

## Architecture at a glance

| Area | Decision |
|---|---|
| **Tenant routing** | `/[slug]/...` path (App Router dynamic segment). |
| **Auth / RLS** | Hybrid. Staff: Supabase Auth, `tenant_id` in `app_metadata` → JWT → RLS. Patient: anonymous, handled by **Server Actions** (the server translates slug → `tenant_id`). |
| **Slots** | Grid from a static config (Mon–Fri 9:00–17:00, every 30 min, `Europe/Warsaw`). Availability = grid − active bookings. No schedule table. |
| **Double-booking** | Partial unique index `(tenant_id, doctor_id, start_time) WHERE status IN ('pending','confirmed')` + JIT expire inside the `book_slot` RPC (single transaction). No cron/workers. |
| **Booking ⇄ Stripe** | INSERT `pending` (reserved via the index) **before** redirecting to Stripe. A second concurrent client bounces off the index. |
| **Realtime** | **Broadcast** per tenant (`clinic:{tenantId}:doctor:{doctorId}`), not `postgres_changes`. Anon reads no tables. |
| **Webhook** | Raw body + `constructEvent` (signature + 300s tolerance ⇒ replay protection). Service-role. Guarded idempotent UPDATE `WHERE stripe_session_id=$ AND status='pending'`. |

**3 Supabase clients:**
- `lib/supabase/client.ts` — **anon** (browser): Broadcast subscription only.
- `lib/supabase/server.ts` — **authenticated** (staff, SSR cookies): direct read under RLS.
- `lib/supabase/service.ts` — **service-role** (Server Actions + webhook): bypasses RLS.

---

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor** → paste and run [`supabase/schema.sql`](./supabase/schema.sql) (review before apply!).
3. Run [`supabase/seed.sql`](./supabase/seed.sql) — creates 2 tenants (`klinika-alfa`, `klinika-beta`) and doctors.
4. **Staff accounts** (no identity UI — created manually):
   - **Authentication → Users → Add user**, e.g. `alfa@klinika.test` / password, tick *Auto Confirm User*. Repeat for `beta@klinika.test`.
   - Link the account to a tenant (snippet at the end of `seed.sql`):
     ```sql
     update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
         || jsonb_build_object('tenant_id', (select id from tenants where slug = 'klinika-alfa'))
     where email = 'alfa@klinika.test';
     ```
   - After changing `app_metadata` the user must sign in **again** (new JWT with the claim).
5. **Realtime / Broadcast** works out of the box — channels are public, no extra config.
6. From **Project Settings → API** copy `Project URL`, `anon public key`, `service_role key` → into `.env.local`.

### 2. Stripe (Test Mode)

1. [dashboard.stripe.com](https://dashboard.stripe.com) → **Test** mode.
2. Copy the **Secret key** (`sk_test_...`) → `STRIPE_SECRET_KEY`.
3. Webhook (local) — [Stripe CLI](https://stripe.com/docs/stripe-cli):
   ```bash
   stripe login
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
   The CLI prints `whsec_...` — that is `STRIPE_WEBHOOK_SECRET`.
   (Production: **Developers → Webhooks → Add endpoint** → `https://your-domain/api/webhooks/stripe`, events `checkout.session.completed`, `checkout.session.expired`.)

### 3. Env + run

```bash
cp .env.local.example .env.local   # fill in the values
npm install
npm run dev
```

Required variables (`.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Open:
- `http://localhost:3000` — list of clinics
- `http://localhost:3000/klinika-alfa` — public booking calendar
- `http://localhost:3000/klinika-alfa/staff` — staff panel (read-only)

Stripe test card: `4242 4242 4242 4242`, any future date, any CVC.

A quick end-to-end check of the booking logic (no UI):
```bash
node --env-file=.env.local scripts/full-loop-test.mjs
```

---

## How it works

### Booking flow (anonymous → `createBooking` Server Action)
1. The Server Action translates `slug → tenant_id`, validates the doctor and the slot (anti-tamper against the grid).
2. The `book_slot` RPC, in a **single transaction**: JIT-expire an expired hold on this slot → INSERT `pending` (`expires_at = now()+15min`). The partial unique index ⇒ `23505` = "slot taken".
3. A Stripe Checkout Session is created (`metadata.booking_id`, `client_reference_id`); `session.id` is saved on the row.
4. **Broadcast** `{ start_time }` (event `taken`) → the slot disappears for other clients live.
5. Redirect to Stripe.

### Webhook flow (`/api/webhooks/stripe`)
- `checkout.session.completed` → **guarded idempotent UPDATE** `status='confirmed' WHERE stripe_session_id=$ AND status='pending'`. Replay = 0 rows, no effect. 0 rows + a row in `expired` ⇒ log `paid-after-expiry`.
- `checkout.session.expired` *(nice-to-have)* → `pending` → `expired` + Broadcast `freed`.
- Bad signature ⇒ 400. Transient error ⇒ 500 (Stripe retries). OK ⇒ 200.

### Staff panel
Email/password sign-in (Supabase Auth, SSR cookies) → read-only table of upcoming appointments. **Direct** read via the authenticated client; **RLS-JWT** guarantees `klinika-alfa` cannot see `klinika-beta` data. No realtime, no CRUD.

### Internationalization (PL/EN)
A cookie (`locale`) holds the language; Server Components read it and pass the dictionary slice down (`lib/i18n.ts`). The `LanguageSwitcher` flips the cookie and `router.refresh()`-es. Server Action error messages are localized too. No external i18n dependency.

---

## Deployment (Vercel)

Live: **https://dental.arturmrowicki.pl** (deployed via `vercel --prod`).

Environment variables set in the Vercel project (Production): `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`.

- The **production webhook** is a separate endpoint in Stripe (Test Mode) at
  `https://<domain>/api/webhooks/stripe` (events `checkout.session.completed`,
  `checkout.session.expired`). Its `whsec` is a **different** secret than the local `stripe listen`.
- `success_url` / `cancel_url` are derived from request headers, so they work on any Vercel
  domain (production and preview).
- **GitHub auto-deploy:** install the Vercel GitHub App for the repo under *Settings → Git*
  (the repo is under a different GitHub account than the Vercel team — needs manual authorization).
  Without it, deploy via CLI: `vercel --prod`.

---

## Known Limitations & Enterprise Upgrade Path

- **Paid-after-expiry refund** — detected and logged; automatic `stripe.refunds.create` deliberately deferred beyond the MVP.
- **Per-doctor schedules** — currently a global working-hours constant (`lib/slots.ts`).
- **Tenant subdomains** (`clinic.app.com`) — requires Pro + wildcard DNS; this uses path routing.
- **Private Realtime channels** — Broadcast is public (payload without PII, only `start_time`); channel authorization is an upgrade.
- **"Freed" broadcast after a `pending` expires** — the slot returns for other clients only on refresh / the next booking attempt (or via `checkout.session.expired`). For freshness, the calendar treats `pending` with `expires_at < now()` as free (the JIT step frees it atomically on booking anyway).

---

## Structure

```
app/
  page.tsx                      # list of clinics
  [slug]/
    page.tsx                    # public calendar (Server Component)
    BookingCalendar.tsx         # client: realtime Broadcast + form
    actions.ts                  # Server Action: book_slot → Stripe → broadcast
    success/ , cancel/          # returns from Stripe Checkout
    staff/                      # sign-in + read-only table (RLS)
  api/webhooks/stripe/route.ts  # webhook (raw body, constructEvent, idempotent)
lib/
  supabase/                     # 3 clients + middleware + broadcast (REST)
  slots.ts                      # grid Mon–Fri 9–17, Europe/Warsaw → UTC
  stripe.ts                     # lazy Stripe client + price
  i18n.ts                       # PL/EN dictionaries + helpers
components/
  ui/                           # button/input/label/card/table (brutalist)
  LanguageSwitcher.tsx          # PL/EN toggle (cookie + refresh)
supabase/
  schema.sql                    # tables + index + RLS + book_slot RPC
  seed.sql                      # 2 tenants + doctors + staff-account instructions
scripts/
  full-loop-test.mjs            # end-to-end logic test
  seed-demo-bookings.mjs        # seed example confirmed bookings
components/DemoBanner.tsx         # demo hint (test card + logins), gated by NEXT_PUBLIC_DEMO
middleware.ts                    # staff session refresh
```
