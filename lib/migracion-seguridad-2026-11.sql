-- ============================================================
--  Punto Club — protección contra intentos repetidos (noviembre 2026)
--  Guarda los intentos (ingreso al panel, pedidos, cupones, PQR) para frenar a
--  quien intente adivinar la contraseña o llenar la tienda de pedidos falsos.
--  No guarda la IP: solo una huella (hash) que no se puede revertir.
--  Ejecútalo una vez en Supabase → SQL Editor. Se puede repetir sin daño.
-- ============================================================

create table if not exists intentos (
  id     bigserial primary key,
  accion text not null,
  quien  text not null,
  at     timestamptz not null default now()
);
create index if not exists intentos_accion_quien_at on intentos (accion, quien, at desc);
create index if not exists intentos_at on intentos (at);

-- Nadie puede leerla ni escribirla desde el navegador: solo el servidor (clave secreta)
alter table intentos enable row level security;
