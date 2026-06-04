# Dental Scheduling SaaS — multi-tenant

**Live:** https://dental-scheduling-saas.vercel.app · **Repo:** https://github.com/Nevillkw/dental-scheduling-saas

Production-ready rdzeń systemu rezerwacji wizyt dla wielu klinik (multi-tenant),
zbudowany wg [`SPEC.md`](./SPEC.md). Demonstruje 4 kompetencje:

1. **App Router** (Next.js 14, Server Components + Server Actions)
2. **Strict multi-tenant isolation** — twardo po RLS na claimie JWT
3. **Atomic double-booking prevention** — partial unique index + JIT staleness w transakcji
4. **Real-time UI** — Supabase Broadcast per-tenant

## Stack

- Next.js 14 (App Router, TypeScript)
- Supabase (Postgres + Auth + Realtime)
- Tailwind + komponenty w stylu shadcn/ui (brutalist: czarno-biało-szary, kwadratowy)
- Stripe Checkout (Test Mode)

---

## Architektura w skrócie

| Obszar | Decyzja |
|---|---|
| **Routing tenantów** | Ścieżka `/[slug]/...` (dynamiczny segment App Routera). |
| **Auth / RLS** | Hybryda. Personel: Supabase Auth, `tenant_id` w `app_metadata` → JWT → RLS. Pacjent: anonimowy, obsługiwany przez **Server Actions** (serwer tłumaczy slug → `tenant_id`). |
| **Sloty** | Grid ze stałej konfiguracji (Pon–Pt 9:00–17:00, co 30 min, `Europe/Warsaw`). Dostępność = grid − aktywne bookingi. Brak tabeli grafików. |
| **Double-booking** | Partial unique index `(tenant_id, doctor_id, start_time) WHERE status IN ('pending','confirmed')` + JIT expire w RPC `book_slot` (jedna transakcja). Bez crona/workerów. |
| **Booking ⇄ Stripe** | INSERT `pending` (rezerwacja przez index) **przed** redirectem do Stripe. Drugi równoległy klient odbija się od indeksu. |
| **Realtime** | **Broadcast** per-tenant (`clinic:{tenantId}:doctor:{doctorId}`), nie `postgres_changes`. Anon nie czyta tabel. |
| **Webhook** | Surowe body + `constructEvent` (podpis + 300 s tolerancji ⇒ ochrona przed replay). Service-role. Guarded idempotent UPDATE `WHERE stripe_session_id=$ AND status='pending'`. |

**3 klienty Supabase:**
- `lib/supabase/client.ts` — **anon** (przeglądarka): tylko subskrypcja Broadcast.
- `lib/supabase/server.ts` — **authenticated** (personel, SSR cookies): bezpośredni odczyt z RLS.
- `lib/supabase/service.ts` — **service-role** (Server Actions + webhook): omija RLS.

---

## Setup

### 1. Supabase

1. Utwórz projekt na [supabase.com](https://supabase.com).
2. **SQL Editor** → wklej i uruchom [`supabase/schema.sql`](./supabase/schema.sql) (review przed apply!).
3. Uruchom [`supabase/seed.sql`](./supabase/seed.sql) — tworzy 2 tenanty (`klinika-alfa`, `klinika-beta`) i lekarzy.
4. **Konta personelu** (brak UI tożsamości — zakładane ręcznie):
   - **Authentication → Users → Add user**, np. `alfa@klinika.test` / hasło, zaznacz *Auto Confirm User*. Powtórz dla `beta@klinika.test`.
   - Powiąż konto z tenantem (snippet jest na końcu `seed.sql`):
     ```sql
     update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
         || jsonb_build_object('tenant_id', (select id from tenants where slug = 'klinika-alfa'))
     where email = 'alfa@klinika.test';
     ```
   - Po zmianie `app_metadata` użytkownik musi zalogować się **ponownie** (nowy JWT z claimem).
5. **Realtime / Broadcast** działa domyślnie — kanały są publiczne, nie wymaga dodatkowej konfiguracji.
6. Skopiuj z **Project Settings → API**: `Project URL`, `anon public key`, `service_role key` → wklej do `.env.local`.

### 2. Stripe (Test Mode)

1. [dashboard.stripe.com](https://dashboard.stripe.com) → tryb **Test**.
2. Skopiuj **Secret key** (`sk_test_...`) → `STRIPE_SECRET_KEY`.
3. Webhook (lokalnie) — [Stripe CLI](https://stripe.com/docs/stripe-cli):
   ```bash
   stripe login
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
   CLI wypisze `whsec_...` — to `STRIPE_WEBHOOK_SECRET`.
   (Produkcja: **Developers → Webhooks → Add endpoint** → `https://twoja-domena/api/webhooks/stripe`, zdarzenia `checkout.session.completed`, `checkout.session.expired`.)

### 3. Env + uruchomienie

```bash
cp .env.local.example .env.local   # uzupełnij wartości
npm install
npm run dev
```

Wymagane zmienne (`.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Otwórz:
- `http://localhost:3000` — lista klinik
- `http://localhost:3000/klinika-alfa` — publiczny kalendarz rezerwacji
- `http://localhost:3000/klinika-alfa/staff` — panel personelu (read-only)

Karta testowa Stripe: `4242 4242 4242 4242`, dowolna przyszła data, dowolny CVC.

---

## Jak to działa

### Flow rezerwacji (anon → Server Action `createBooking`)
1. Server Action tłumaczy `slug → tenant_id`, waliduje lekarza i slot (anti-tamper wobec gridu).
2. RPC `book_slot` w **jednej transakcji**: JIT-expire wygasłej blokady na tym slocie → INSERT `pending` (`expires_at = now()+15min`). Partial unique index ⇒ `23505` = „slot zajęty".
3. Tworzona jest Stripe Checkout Session (`metadata.booking_id`, `client_reference_id`), `session.id` zapisywany na wierszu.
4. **Broadcast** `{ start_time }` (event `taken`) → slot znika u innych klientów na żywo.
5. Redirect do Stripe.

### Flow webhooka (`/api/webhooks/stripe`)
- `checkout.session.completed` → **guarded idempotent UPDATE** `status='confirmed' WHERE stripe_session_id=$ AND status='pending'`. Replay = 0 wierszy, brak skutków. 0 wierszy + wiersz w `expired` ⇒ log `paid-after-expiry`.
- `checkout.session.expired` *(nice-to-have)* → `pending` → `expired` + Broadcast `freed`.
- Zły podpis ⇒ 400. Błąd przejściowy ⇒ 500 (Stripe ponawia). OK ⇒ 200.

### Panel personelu
Logowanie e-mail/hasło (Supabase Auth, SSR cookies) → read-only tabela nadchodzących wizyt. Odczyt **bezpośredni** przez authenticated client; **RLS-JWT** gwarantuje, że `klinika-alfa` nie widzi danych `klinika-beta`. Bez realtime, bez CRUD.

---

## Deployment (Vercel)

Live: **https://dental-scheduling-saas.vercel.app** (wdrożone przez `vercel --prod`).

Zmienne środowiskowe ustawione w projekcie Vercel (Production): `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`.

- **Webhook produkcyjny** to osobny endpoint w Stripe (Test Mode) na
  `https://<domena>/api/webhooks/stripe` (zdarzenia `checkout.session.completed`,
  `checkout.session.expired`). Jego `whsec` to **inny** sekret niż lokalny `stripe listen`.
- `success_url` / `cancel_url` liczone są z nagłówków żądania, więc działają na każdej
  domenie Vercel (produkcja i preview).
- **Auto-deploy z GitHuba:** zainstaluj aplikację Vercel dla repo w *Settings → Git*
  (repo jest pod kontem GitHub innym niż team Vercel — wymaga ręcznej autoryzacji).
  Bez tego wdrażasz CLI: `vercel --prod`.

---

## Known Limitations & Enterprise Upgrade Path

- **Paid-after-expiry refund** — wykrywany i logowany; automatyczny `stripe.refunds.create` świadomie odłożony poza MVP.
- **Grafiki per-lekarz** — obecnie globalna stała godzin pracy (`lib/slots.ts`).
- **Subdomeny tenantów** (`klinika.app.com`) — wymaga planu Pro + wildcard DNS; tu routing po ścieżce.
- **Private Realtime channels** — Broadcast jest publiczny (payload bez PII, tylko `start_time`); autoryzacja kanałów = upgrade.
- **„Freed" broadcast po wygaśnięciu `pending`** — slot wraca u innych klientów dopiero przy odświeżeniu / następnej próbie rezerwacji (lub przez `checkout.session.expired`). Dla świeżości, kalendarz traktuje `pending` z `expires_at < now()` jako wolny (JIT i tak zwolni go atomowo przy rezerwacji).

---

## Struktura

```
app/
  page.tsx                      # lista klinik
  [slug]/
    page.tsx                    # publiczny kalendarz (Server Component)
    BookingCalendar.tsx         # client: realtime Broadcast + formularz
    actions.ts                  # Server Action: book_slot → Stripe → broadcast
    success/ , cancel/          # powroty ze Stripe Checkout
    staff/                      # logowanie + read-only tabela (RLS)
  api/webhooks/stripe/route.ts  # webhook (raw body, constructEvent, idempotent)
lib/
  supabase/                     # 3 klienty + middleware + broadcast (REST)
  slots.ts                      # grid Pon–Pt 9–17, Europe/Warsaw → UTC
  stripe.ts                     # lazy Stripe client + cena
components/ui/                   # button/input/label/card/table (brutalist)
supabase/
  schema.sql                    # tabele + index + RLS + RPC book_slot
  seed.sql                      # 2 tenanty + lekarze + instrukcja kont
middleware.ts                    # odświeżanie sesji personelu
```
