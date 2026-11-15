'use strict';
/* POST /api/coupon — valida un cupón contra el carrito y devuelve el descuento.
   No reserva el cupón: el uso se descuenta solo cuando se registra el pedido. */
const supabase = require('../lib/supabase');
const { ok, err, allowCors } = require('../lib/helpers');
const { priceCart } = require('../lib/pricing');
const { quienDe, cuenta, anotar, demasiados } = require('../lib/limite');

module.exports = async (req, res) => {
  allowCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return err(res, 'Método no permitido', 405);
  const { code, items } = req.body || {};
  if (!String(code || '').trim()) return err(res, 'Escribe el código del cupón', 400);
  // Freno contra quien prueba códigos al azar: 10 cupones inexistentes cada 30 minutos
  const quien = quienDe(req);
  if (await cuenta(supabase, 'cupon-fallo', quien, 30) >= 10) return demasiados(res, 30, 'Probaste demasiados cupones que no existen. Espera 30 minutos.');
  const r = await priceCart(supabase, items, code);
  if (r.error) {
    if (r.couponError && /no existe/.test(r.error)) await anotar(supabase, 'cupon-fallo', quien);
    return err(res, r.error, r.status || 400);
  }
  ok(res, {
    code: r.coupon.code, description: r.coupon.description, type: r.coupon.type,
    discount: r.coupon.discount, freeShipping: r.coupon.freeShipping, // solo si el CUPÓN da envío gratis
    subtotal: r.subtotal, total: r.total
  });
};
