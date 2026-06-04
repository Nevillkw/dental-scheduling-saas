# Multi-tenant Dental Scheduling SaaS — Finalna specyfikacja (po grillu)

> Wersja zsyntetyzowana z `prompt.txt` po sesji stress-testu decyzji.
> Wszystkie decyzje poniżej są **zablokowane** i wzajemnie spójne. Odstępstwa wymagają świadomej zmiany.

## Cel
Funkcjonalny, production-ready rdzeń na Vercel w 1–2 dni, demonstrujący 4 kompetencje:
App Router, **strict** multi-tenant isolation, **atomic** double-booking prevention, real-time UI.

## Stack
- Next.js 14+ (App Router, TypeScript)
- Supabase (Postgres + Auth + Realtime)
- Tailwind + shadcn/ui — brutalist, minimal, czarno-biało-szary, kwadratowy
- Stripe Checkout (Test Mode)

---

## Zablokowane decyzje architektoniczne

| # | Gałąź | Decyzja |
|---|-------|---------|
| 1 | **Routing tenantów** | Po ścieżce: `app.com/[slug]/...` (dynamiczny segment App Routera). Subdomeny = future enhancement (wymaga Pro + wildcard DNS). |
| 2 | **Auth / RLS** | **Hybryda.** Personel: Supabase Auth, `tenant_id` w `app_metadata` → JWT → RLS twardo po claimie. Pacjent: anonimowy, obsługiwany **Server Actions** (serwer autorytatywnie tłumaczy slug → `tenant_id`). **Zero UI tożsamości** (konta personelu zakładane ręcznie w Supabase). Panel personelu = **read-only** tabela. |
| 3 | **Model slotów** | Grid ze **stałej konfiguracyjnej** (Pon–Pt 9:00–17:00, co 30 min). Dostępność = grid − aktywne bookingi. Brak tabeli grafików. |
| 4 | **Atomic double-booking** | **Partial unique index** na `(tenant_id, doctor_id, start_time) WHERE status IN ('pending','confirmed')` + **JIT staleness resolution** w transakcji bookingu + `expires_at`. Bez crona, bez workerów. |
| 5 | **Ordering booking⇄Stripe** | INSERT `pending` (rezerwacja przez index) **przed** redirectem do Stripe. Drugi równoległy klient odbija się od indeksu → nigdy nie dochodzi do podwójnej płatności. |
| 6 | **Realtime** | **Broadcast** per-tenant, NIE postgres_changes. Anon nie czyta tabel. Server Component renderuje dostępność początkową; Server Action broadcastuje `{ start_time }` na `clinic:{tenantId}:doctor:{doctorId}` przy rezerwacji. |
| 7 | **Webhook Stripe** | Surowe body + `constructEvent` (podpis + tolerancja 300s ⇒ replay z pudełka). Service-role client. **Guarded idempotent UPDATE** `WHERE stripe_session_id=$1 AND status='pending'`. Edge „zapłacił-po-wygaśnięciu" → log + refund **udokumentowany w README** (nie implementowany w MVP). |

### Asercje (defaulty, nie osobne rozwidlenia)
- `start_time` = `timestamptz` (UTC); grid generowany w jednej zaszytej strefie (`Europe/Warsaw`) — deterministyczny do instantu.
- 3 klienty Supabase: **anon** (tylko subskrypcja Broadcast), **authenticated** (personel, RLS-JWT, bezpośredni odczyt), **service-role** (Server Actions + webhook).
- RLS dla `anon` = **brak polityk** = default deny. Anon nie dotyka żadnej tabeli.
- Broadcast „taken" przy insercie `pending`. „Freed" (po wygaśnięciu) = nice-to-have z `checkout.session.expired`.

---

## Schema (SQL do wspólnego review — Step 2)

```sql
create type booking_status as enum ('pending','confirmed','expired','refunded');

create table tenants (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  created_at timestamptz not null default now()
);

create table doctors (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);
create index on doctors (tenant_id);

create table bookings (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  doctor_id         uuid not null references doctors(id) on delete cascade,
  patient_name      text not null,
  start_time        timestamptz not null,
  status            booking_status not null default 'pending',
  stripe_session_id text unique,
  expires_at        timestamptz,                 -- ustawiany dla 'pending' = now()+15min
  created_at        timestamptz not null default now()
);

-- ATOMOWY STRAŻNIK: co najwyżej jeden AKTYWNY booking na slot.
-- Predykat statyczny => IMMUTABLE-safe (BEZ now()!).
create unique index unique_active_booking
  on bookings (tenant_id, doctor_id, start_time)
  where status in ('pending','confirmed');

create index on bookings (status, expires_at);  -- pod JIT sweep
```

### RLS
```sql
alter table tenants  enable row level security;
alter table doctors  enable row level security;
alter table bookings enable row level security;

-- claim: (auth.jwt()->'app_metadata'->>'tenant_id')::uuid

create policy staff_read_tenant   on tenants  for select to authenticated
  using (id        = (auth.jwt()->'app_metadata'->>'tenant_id')::uuid);
create policy staff_read_doctors  on doctors  for select to authenticated
  using (tenant_id = (auth.jwt()->'app_metadata'->>'tenant_id')::uuid);
create policy staff_read_bookings on bookings for select to authenticated
  using (tenant_id = (auth.jwt()->'app_metadata'->>'tenant_id')::uuid);

-- anon: ZERO polityk => default deny. service_role omija RLS (Server Actions + webhook).
```

---

## Flow bookingu (anon, Server Action, service-role, jedna transakcja)
```sql
-- 1) zwolnij wygasłą blokadę dokładnie na tym slocie
update bookings set status='expired'
 where tenant_id=$t and doctor_id=$d and start_time=$s
   and status='pending' and expires_at < now();

-- 2) zarezerwuj
insert into bookings (tenant_id, doctor_id, patient_name, start_time, status, expires_at)
values ($t,$d,$name,$s,'pending', now() + interval '15 minutes')
returning id;          -- unique_violation (23505) => "Slot zajęty"
```
3. Utwórz Stripe Checkout Session (`metadata.booking_id`, `client_reference_id`), zapisz `session.id` na wierszu.
4. **Broadcast** `{ start_time }` na `clinic:{tenantId}:doctor:{doctorId}` → slot znika u innych.
5. Redirect do Stripe.

## Flow webhooka (hardened)
```ts
const event = stripe.webhooks.constructEvent(await req.text(), sig, WHSEC); // surowe body!
if (event.type === 'checkout.session.completed') {
  const sid = event.data.object.id;            // service-role client
  // UPDATE bookings SET status='confirmed' WHERE stripe_session_id=sid AND status='pending'
  // 0 wierszy + istnieje wiersz z sid w stanie 'expired' => log "paid-after-expiry" (refund: README)
}
return 200; // zły podpis => 400; błąd przejściowy => 500
```

## Panel personelu
Nagi formularz logowania (Email/Hasło/Submit) → strona z **read-only** tabelą shadcn nadchodzących wizyt. Odczyt bezpośredni przez authenticated client; RLS-JWT gwarantuje, że `clinic-a` nie widzi `clinic-b`. Bez realtime, bez CRUD.

---

## Known Limitations & Enterprise Upgrade Path (do README)
- **Paid-after-expiry refund** — wykryty, logowany; automatyczny `stripe.refunds.create` świadomie odłożony.
- **Grafiki per-lekarz** — obecnie globalna stała godzin pracy.
- **Subdomeny tenantów** — wymaga Pro + wildcard DNS.
- **Private Realtime channels** — Broadcast jest publiczny (payload bez PII); autoryzacja kanałów = upgrade.
- **„Freed" broadcast** po wygaśnięciu pending — slot wraca u innych dopiero przy odświeżeniu / następnej rezerwacji.

## Kolejność realizacji
1. **Step 1** — scaffold Next.js + shadcn + 3 klienty Supabase + middleware sluga.
2. **Step 2** — SQL powyżej (schema + index + RLS) — **review przed apply**, potem seed: 2 tenanty, lekarze, 2 konta personelu z `tenant_id` w `app_metadata`.
3. **Step 3** — Server Action bookingu + Stripe Checkout + webhook + Broadcast + publiczny kalendarz + panel personelu.
