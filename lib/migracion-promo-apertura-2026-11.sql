-- ============================================================
--  Punto Club — FIRST 10, promoción de apertura (noviembre 2026)
--  Los primeros 10 clientes con pago confirmado reciben $10.000 de
--  descuento automático en su compra (productos desde $110.000).
--  Se configura y se enciende en el panel: Ajustes → FIRST 10.
--  Ejecútalo una vez en Supabase → SQL Editor. Se puede repetir sin daño.
-- ============================================================

-- 1. Configuración (empieza APAGADA: la enciendes en el panel)
alter table settings add column if not exists promo_apertura jsonb
  default '{"activa": false, "cupos": 10, "valor": 10000, "minimo": 110000, "horas": 24}'::jsonb;

update settings
   set promo_apertura = '{"activa": false, "cupos": 10, "valor": 10000, "minimo": 110000, "horas": 24}'::jsonb
 where id = 'app' and (promo_apertura is null or not (promo_apertura ? 'horas'));

-- 2. Los cupos: una fila por cupo. Un cupo se reserva con un UPDATE que solo funciona si
--    sigue libre, así dos compras al mismo tiempo nunca se quedan con el mismo cupo.
--    El celular es único: un descuento por cliente.
create table if not exists first10_cupos (
  slot           integer primary key,
  order_id       text unique,
  telefono       text unique,
  estado         text check (estado in ('reservado', 'confirmado')),
  reservado_at   timestamptz,
  confirmado_at  timestamptz,
  pago_reportado boolean not null default false
);

insert into first10_cupos (slot)
select g from generate_series(1, 10) g
on conflict (slot) do nothing;

-- Solo el servidor (llave de servicio) lee y escribe los cupos
alter table first10_cupos enable row level security;
