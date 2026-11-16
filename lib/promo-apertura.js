'use strict';
/* Promoción de apertura: los primeros N pedidos con pago confirmado (por defecto 10) ganan
   un cupón de un solo uso para su próxima compra (por defecto $10.000, en compras desde $150.000).

   - La configuración vive en settings.promo_apertura (lib/migracion-promo-apertura-2026-11.sql).
   - Cada premio es un cupón normal de la tabla coupons, con código APERTURA-XXXXX, secreto
     (no se muestra en la tienda), de 1 uso, con compra mínima y fecha de vencimiento.
   - El contador son los cupones APERTURA- activos. Al entregar el último, la promo se apaga sola.
   - Si un pedido premiado se cancela y su cupón no se ha usado, el cupón se desactiva y el
     cupo se libera (si la promo se había apagado sola, se vuelve a encender).
   - Un mismo celular gana una sola vez, y un pedido pagado con un cupón APERTURA- no gana otro. */
const crypto = require('crypto');

const PREFIJO = 'APERTURA-';
const DEF = { activa: false, cupos: 10, valor: 10000, minimo: 150000, dias: 60, cerradaAuto: false };
const PAGADOS = ['Pago confirmado', 'Hacia el taller', 'En preparación', 'Enviado', 'Entregado'];

const entero = (v, min, max, def) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
function sanitize(p) {
  p = p && typeof p === 'object' ? p : {};
  return {
    activa: p.activa === true,
    cupos: entero(p.cupos, 1, 500, DEF.cupos),
    valor: entero(p.valor, 1000, 500000, DEF.valor),
    minimo: entero(p.minimo, 0, 10000000, DEF.minimo),
    dias: entero(p.dias, 1, 365, DEF.dias),
    cerradaAuto: p.cerradaAuto === true
  };
}

const money = n => '$' + Number(n || 0).toLocaleString('es-CO');
const fecha = iso => new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' });
function condiciones(conf, venceIso) {
  return `Premio de la promoción de apertura de Punto Club para los primeros ${conf.cupos} pedidos con pago confirmado. ` +
    `Descuento de ${money(conf.valor)} en una próxima compra en la tienda en línea, para compras desde ${money(conf.minimo)} en productos ` +
    `(sin contar envío ni caja personalizada). Se usa una sola vez, vence el ${fecha(venceIso)}, no se cambia por dinero ` +
    `y no se acumula con otros cupones. Si el pedido que ganó el premio se cancela, el cupón se anula.`;
}

/* Lee la configuración. listo = false si falta la migración (la promo queda apagada). */
async function leerConf(supabase) {
  const { data, error } = await supabase.from('settings').select('promo_apertura').eq('id', 'app').single()
    .then(r => r, e => ({ data: null, error: e }));
  if (error) return { conf: sanitize(null), listo: false };
  return { conf: sanitize(data && data.promo_apertura), listo: true };
}
const guardarConf = (supabase, conf) => supabase.from('settings').update({ promo_apertura: sanitize(conf) }).eq('id', 'app');

/* Premios entregados = cupones APERTURA- activos */
async function contar(supabase) {
  const { count, error } = await supabase.from('coupons').select('code', { count: 'exact', head: true })
    .like('code', PREFIJO + '%').eq('active', true);
  if (error) throw new Error(error.message);
  return count || 0;
}

async function estado(supabase) {
  const { conf, listo } = await leerConf(supabase);
  let entregados = 0;
  try { entregados = await contar(supabase); } catch (e) { /* sin tabla de cupones: 0 */ }
  return { ...conf, listo, entregados, quedan: Math.max(0, conf.cupos - entregados) };
}

/* Lo que ve la tienda: solo si está activa y quedan cupos */
async function publico(supabase) {
  try {
    const e = await estado(supabase);
    if (!e.listo || !e.activa || !e.quedan) return null;
    return { cupos: e.cupos, quedan: e.quedan, valor: e.valor, minimo: e.minimo, dias: e.dias };
  } catch (e) { return null; }
}

const nuevoCodigo = () => {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += abc[crypto.randomInt(abc.length)];
  return PREFIJO + s;
};
const guardarPremio = (supabase, order, premio) =>
  supabase.from('orders').update({ customer: { ...(order.customer || {}), premioApertura: premio } }).eq('id', order.id);

/* Da el premio si el pedido lo merece. Devuelve { premio, quedan, cerrada } o null. Nunca lanza. */
async function premiar(supabase, order) {
  try {
    const c = order.customer || {};
    if (!PAGADOS.includes(order.status)) return null;
    const previo = c.premioApertura;
    if (previo && !previo.anulado) return null; // ya lo tiene
    const { conf, listo } = await leerConf(supabase);
    if (!listo) return null;
    const pricing = order.pricing || c.pricing || {};
    if (pricing.coupon && String(pricing.coupon.code || '').startsWith(PREFIJO)) return null;
    let entregados = await contar(supabase);

    // Volvió de "Cancelado" a pagado: se reactiva su mismo cupón si todavía hay cupo
    if (previo && previo.anulado) {
      if (entregados >= conf.cupos || new Date(previo.vence) < new Date()) return null;
      const { error } = await supabase.from('coupons').update({ active: true }).eq('code', previo.code);
      if (error) return null;
      const premio = { ...previo, anulado: false };
      await guardarPremio(supabase, order, premio);
      return cerrarSiLleno(supabase, conf, entregados + 1, premio);
    }

    if (!conf.activa || entregados >= conf.cupos) return null;
    // Un mismo celular gana una sola vez
    const tel = String(c.telefono || '').replace(/\D/g, '');
    if (tel) {
      const { data: otros } = await supabase.from('orders').select('id,customer').neq('id', order.id)
        .eq('customer->>telefono', c.telefono).not('customer->premioApertura', 'is', null)
        .then(r => r, () => ({ data: [] }));
      if ((otros || []).some(o => o.customer && o.customer.premioApertura && !o.customer.premioApertura.anulado)) return null;
    }

    const vence = new Date(Date.now() + conf.dias * 86400000).toISOString();
    let code = '', error = null;
    for (let i = 0; i < 4; i++) {
      code = nuevoCodigo();
      ({ error } = await supabase.from('coupons').insert({
        code, type: 'valor', value: conf.valor, min_subtotal: conf.minimo, max_uses: 1, uses: 0,
        ends_at: vence, active: true,
        description: `Premio de apertura (pedido ${order.id}): ${money(conf.valor)} para tu próxima compra`,
        conditions: condiciones(conf, vence)
      }));
      if (!error || !/duplicate|unique/i.test(error.message)) break;
    }
    if (error) { console.error('[promo apertura] no se pudo crear el cupón:', error.message); return null; }
    const premio = { code, valor: conf.valor, minimo: conf.minimo, vence, at: new Date().toISOString() };
    const { error: ue } = await guardarPremio(supabase, order, premio);
    if (ue) console.error('[promo apertura] cupón', code, 'creado pero no anotado en', order.id, ue.message);
    return cerrarSiLleno(supabase, conf, entregados + 1, premio);
  } catch (e) {
    console.error('[promo apertura]', order && order.id, e.message);
    return null;
  }
}
async function cerrarSiLleno(supabase, conf, entregados, premio) {
  const cerrada = entregados >= conf.cupos && conf.activa;
  if (cerrada) await guardarConf(supabase, { ...conf, activa: false, cerradaAuto: true }).then(() => {}, () => {});
  return { premio, quedan: Math.max(0, conf.cupos - entregados), cerrada };
}

/* Pedido cancelado: si su cupón no se ha usado, se anula y el cupo queda libre. Nunca lanza. */
async function anular(supabase, order) {
  try {
    const p = (order.customer || {}).premioApertura;
    if (!p || p.anulado) return null;
    const { data: cup } = await supabase.from('coupons').select('uses').eq('code', p.code).maybeSingle();
    if (cup && Number(cup.uses) > 0) return null; // ya lo usó: no se quita
    await supabase.from('coupons').update({ active: false }).eq('code', p.code);
    await guardarPremio(supabase, order, { ...p, anulado: true });
    const { conf, listo } = await leerConf(supabase);
    if (listo && conf.cerradaAuto && !conf.activa) await guardarConf(supabase, { ...conf, activa: true, cerradaAuto: false });
    return { anulado: p.code };
  } catch (e) {
    console.error('[promo apertura] anular', order && order.id, e.message);
    return null;
  }
}

module.exports = { PREFIJO, DEF, PAGADOS, sanitize, leerConf, guardarConf, contar, estado, publico, premiar, anular };
