-- =============================================================================
-- SEED — 2 tenanty + lekarze. Idempotentny (mozna uruchamiac wielokrotnie).
-- Uruchom PO schema.sql.
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
-- KONTA PERSONELU (zakladane RECZNIE — brak UI tozsamosci).
--
-- 1) Supabase Dashboard -> Authentication -> Users -> "Add user":
--      alfa@klinika.test  /  haslo
--      beta@klinika.test  /  haslo
--    (zaznacz "Auto Confirm User").
--
-- 2) Powiaz konto z tenantem (tenant_id ląduje w JWT app_metadata):
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
-- 3) Po zmianie app_metadata uzytkownik musi zalogowac sie ponownie,
--    aby nowy JWT zawieral claim tenant_id.
-- =============================================================================
