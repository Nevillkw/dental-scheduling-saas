-- =============================================================================
-- Multi-tenant Dental Scheduling — SCHEMA (review before apply: Step 2)
-- Run in Supabase: SQL Editor -> paste -> Run.
-- =============================================================================

create type booking_status as enum ('pending', 'confirmed', 'expired', 'refunded');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
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
create index doctors_tenant_idx on doctors (tenant_id);

create table bookings (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  doctor_id         uuid not null references doctors(id) on delete cascade,
  patient_name      text not null,
  start_time        timestamptz not null,
  status            booking_status not null default 'pending',
  stripe_session_id text unique,
  expires_at        timestamptz,                 -- set for 'pending' = now()+15min
  created_at        timestamptz not null default now()
);

-- ATOMIC GUARD: at most one ACTIVE booking per slot.
-- Static predicate => IMMUTABLE-safe (NO now()!).
create unique index unique_active_booking
  on bookings (tenant_id, doctor_id, start_time)
  where status in ('pending', 'confirmed');

create index bookings_status_expires_idx on bookings (status, expires_at);  -- for the JIT sweep
create index bookings_lookup_idx on bookings (tenant_id, doctor_id, start_time);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table tenants  enable row level security;
alter table doctors  enable row level security;
alter table bookings enable row level security;

-- claim: (auth.jwt()->'app_metadata'->>'tenant_id')::uuid

create policy staff_read_tenant on tenants for select to authenticated
  using (id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

create policy staff_read_doctors on doctors for select to authenticated
  using (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

create policy staff_read_bookings on bookings for select to authenticated
  using (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- anon: ZERO policies => default deny. service_role bypasses RLS (Server Actions + webhook).

-- ---------------------------------------------------------------------------
-- RPC: atomic booking inside a SINGLE transaction.
-- Step 1 (JIT): free an expired hold on exactly this slot.
-- Step 2: reserve. The partial unique index => 23505 when the slot is taken.
-- Called only by service_role from the Server Action.
-- ---------------------------------------------------------------------------
create or replace function book_slot(
  p_tenant_id   uuid,
  p_doctor_id   uuid,
  p_patient_name text,
  p_start_time  timestamptz
) returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  update bookings set status = 'expired'
   where tenant_id  = p_tenant_id
     and doctor_id  = p_doctor_id
     and start_time = p_start_time
     and status     = 'pending'
     and expires_at < now();

  insert into bookings (tenant_id, doctor_id, patient_name, start_time, status, expires_at)
  values (p_tenant_id, p_doctor_id, p_patient_name, p_start_time, 'pending', now() + interval '15 minutes')
  returning id into v_id;

  return v_id;
end;
$$;

-- Only service_role may reserve. anon/authenticated have no access.
revoke all on function book_slot(uuid, uuid, text, timestamptz) from public;
grant execute on function book_slot(uuid, uuid, text, timestamptz) to service_role;
