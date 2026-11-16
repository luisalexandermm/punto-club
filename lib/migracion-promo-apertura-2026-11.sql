-- ============================================================
--  Punto Club — promoción de apertura (noviembre 2026)
--  Los primeros 10 pedidos con pago confirmado ganan un cupón de
--  $10.000 para su próxima compra (desde $150.000). Se configura y
--  se enciende en el panel: Ajustes → Promo de apertura.
--  Ejecútalo una vez en Supabase → SQL Editor. Se puede repetir sin daño.
-- ============================================================

alter table settings add column if not exists promo_apertura jsonb
  default '{"activa": false, "cupos": 10, "valor": 10000, "minimo": 150000, "dias": 60}'::jsonb;

update settings
   set promo_apertura = '{"activa": false, "cupos": 10, "valor": 10000, "minimo": 150000, "dias": 60}'::jsonb
 where id = 'app' and promo_apertura is null;
