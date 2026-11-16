-- ============================================================
--  Punto Club — programar la publicación de zapatos (noviembre 2026)
--  Un zapato con fecha de publicación no aparece en la tienda (ni se puede
--  comprar) hasta ese momento. Vacío = se publica apenas se guarda.
--  Las promociones y los cupones ya se programan con "Empieza" y "Termina".
--  Ejecútalo una vez en Supabase → SQL Editor. Se puede repetir sin daño.
-- ============================================================

alter table products add column if not exists publish_at timestamptz;
