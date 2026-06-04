-- =============================================================================
-- SEED — 2 tenants + doctors. Idempotent (safe to run multiple times).
-- Run AFTER schema.sql.
-- =============================================================================

insert into tenants (name, slug) values
  ('Klinika Alfa', 'klinika-alfa'),
  ('Klinika Beta', 'klinika-beta')
on conflict (slug) do nothing;

insert into doctors (tenant_id, name)
select t.id, x.name
from tenants t
join (values
  ('klinika-alfa', 'Dr Anna Kowalska'),
  ('klinika-alfa', 'Dr Piotr Nowak'),
  ('klinika-beta', 'Dr Ewa Wisniewska')
) as x(slug, name) on x.slug = t.slug
where not exists (
  select 1 from doctors d where d.tenant_id = t.id and d.name = x.name
);

-- =============================================================================
-- STAFF ACCOUNTS (created MANUALLY — no identity UI).
--
-- 1) Supabase Dashboard -> Authentication -> Users -> "Add user":
--      alfa@klinika.test  /  password
--      beta@klinika.test  /  password
--    (tick "Auto Confirm User").
--
-- 2) Link the account to a tenant (tenant_id lands in the JWT app_metadata):
--
--    update auth.users
--    set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
--        || jsonb_build_object('tenant_id',
--             (select id from tenants where slug = 'klinika-alfa'))
--    where email = 'alfa@klinika.test';
--
--    update auth.users
--    set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
--        || jsonb_build_object('tenant_id',
--             (select id from tenants where slug = 'klinika-beta'))
--    where email = 'beta@klinika.test';
--
-- 3) After changing app_metadata the user must sign in again so the new JWT
--    contains the tenant_id claim.
-- =============================================================================
