'use strict';
/* FIRST 10 — promoción de apertura de Punto Club.
   Los primeros 10 clientes con pago confirmado reciben $10.000 de descuento en esa misma compra,
   automáticamente (sin código), si sus productos suman desde $110.000.

   Cómo se cuentan los cupos (tabla first10_cupos, lib/migracion-promo-apertura-2026-11.sql):
   - Hay una fila por cupo (1..10). Al registrar un pedido que cumple, se RESERVA un cupo libre
     con un UPDATE condicional (solo si sigue libre): si dos compras llegan a la vez por el último
     cupo, Postgres deja que solo una lo tome. El celular es único: un descuento por cliente.
   - El cupo pasa a CONFIRMADO cuando el pedido pasa a "Pago confirmado". Hasta entonces no se
     gasta: si el pedido se cancela, o pasan `horas` sin que el cliente reporte su pago, se libera.
   - Al confirmar el último cupo la promo queda "FIRST 10 AGOTADO".
   Configuración (activa, cupos, valor, mínimo, horas de reserva): settings.promo_apertura,
   editable en el panel (Ajustes → FIRST 10). */
const crypto = require('crypto');

const DEF = { activa: false, cupos: 10, valor: 10000, minimo: 110000, horas: 24, cerradaAuto: false };
const PAGADOS = ['Pago confirmado', 'Hacia el taller', 'En preparación', 'Enviado', 'Entregado'];
const TABLA = 'first10_cupos';

const entero = (v, min, max, def) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
function sanitize(p) {
  p = p && typeof p === 'object' ? p : {};
  return {
    activa: p.activa === true,
    cupos: entero(p.cupos, 1, 100, DEF.cupos),
    valor: entero(p.valor, 1000, 500000, DEF.valor),
    minimo: entero(p.minimo, 0, 10000000, DEF.minimo),
    horas: entero(p.horas, 1, 168, DEF.horas),
    cerradaAuto: p.cerradaAuto === true
  };
}
const money = n => '$' + Number(n || 0).toLocaleString('es-CO');
const LIBRE = { order_id: null, telefono: null, estado: null, reservado_at: null, confirmado_at: null, pago_reportado: false };

async function leerConf(supabase) {
  const { data, error } = await supabase.from('settings').select('promo_apertura').eq('id', 'app').single()
    .then(r => r, e => ({ data: null, error: e }));
  if (error) return { conf: sanitize(null), listo: false };
  return { conf: sanitize(data && data.promo_apertura), listo: true };
}
const guardarConf = (supabase, conf) => supabase.from('settings').update({ promo_apertura: sanitize(conf) }).eq('id', 'app');

/* Deja exactamente las filas 1..cupos (las sobrantes solo se borran si están libres) */
async function prepararCupos(supabase, cupos) {
  const filas = Array.from({ length: cupos }, (_, i) => ({ slot: i + 1 }));
  const { error } = await supabase.from(TABLA).upsert(filas, { onConflict: 'slot', ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  await supabase.from(TABLA).delete().gt('slot', cupos).is('order_id', null);
}

/* Reservas sin pago reportado que pasaron de `horas`: el cupo vuelve a quedar libre */
async function liberarVencidas(supabase, horas) {
  const limite = new Date(Date.now() - horas * 3600000).toISOString();
  await supabase.from(TABLA).update(LIBRE).eq('estado', 'reservado').eq('pago_reportado', false).lt('reservado_at', limite)
    .then(() => {}, () => {});
}

async function leerCupos(supabase) {
  const { data, error } = await supabase.from(TABLA).select('*').order('slot');
  if (error) throw new Error(error.message);
  return data || [];
}

/* Estado completo (panel). listo = false si falta la migración. */
async function estado(supabase) {
  const { conf, listo } = await leerConf(supabase);
  const base = { ...conf, listo: false, confirmados: 0, reservados: 0, disponibles: conf.cupos, agotado: false, lista: [] };
  if (!listo) return base;
  try {
    await liberarVencidas(supabase, conf.horas);
    const filas = (await leerCupos(supabase)).filter(f => f.slot <= conf.cupos || f.order_id);
    const confirmados = filas.filter(f => f.estado === 'confirmado').length;
    const reservados = filas.filter(f => f.estado === 'reservado').length;
    return {
      ...conf, listo: true, confirmados, reservados,
      disponibles: Math.max(0, conf.cupos - confirmados - reservados),
      agotado: confirmados >= conf.cupos,
      lista: filas.filter(f => f.order_id).map(f => ({ slot: f.slot, pedido: f.order_id, estado: f.estado, reservadoAt: f.reservado_at, confirmadoAt: f.confirmado_at, pagoReportado: !!f.pago_reportado }))
    };
  } catch (e) { return base; }
}

/* Lo que ve la tienda. null = la promo no se muestra (apagada a mano o sin migración). */
async function publico(supabase) {
  const e = await estado(supabase).catch(() => null);
  if (!e || !e.listo) return null;
  if (!e.activa && !e.agotado) return null;
  return { cupos: e.cupos, disponibles: e.agotado ? 0 : e.disponibles, confirmados: e.confirmados, reservados: e.reservados, valor: e.valor, minimo: e.minimo, horas: e.horas, agotado: e.agotado };
}

/* Intenta tomar un cupo libre para `orderId`. Devuelve { ok, slot } o { ok:false, motivo }. */
async function tomarCupo(supabase, conf, orderId, tel) {
  const { data: mio } = await supabase.from(TABLA).select('slot,order_id').eq('telefono', tel).maybeSingle().then(r => r, () => ({ data: null }));
  if (mio && mio.order_id !== orderId) return { ok: false, motivo: 'cliente' };
  if (mio) return { ok: true, slot: mio.slot };
  const { data: libres } = await supabase.from(TABLA).select('slot').is('order_id', null).lte('slot', conf.cupos).order('slot');
  for (const { slot } of libres || []) {
    const { data, error } = await supabase.from(TABLA)
      .update({ order_id: orderId, telefono: tel, estado: 'reservado', reservado_at: new Date().toISOString(), confirmado_at: null, pago_reportado: false })
      .eq('slot', slot).is('order_id', null).select('slot');
    if (error && /duplicate|unique/i.test(error.message)) return { ok: false, motivo: 'cliente' };
    if (error) throw new Error(error.message);
    if (data && data.length) return { ok: true, slot };
    // Otra compra tomó este cupo en el mismo instante: se prueba el siguiente
  }
  return { ok: false, motivo: 'agotado' };
}

const MOTIVOS = {
  cliente: 'FIRST 10 es un descuento por cliente y este celular ya lo tiene en otro pedido.',
  agotado: 'Los cupos de FIRST 10 se acaban de agotar (o están reservados por pedidos pendientes de pago).',
  cupon: 'FIRST 10 no se acumula con cupones. Quita el cupón si prefieres el descuento FIRST 10.',
  minimo: null, apagada: null
};

/* Al registrar un pedido. Nunca lanza. Devuelve:
   { aplica: true, valor, token, horas } → descuento reservado (hay que llamar asignar() o soltar())
   { aplica: false, mensaje }            → mensaje para el cliente (o null si la promo no le interesa) */
async function reservar(supabase, { telefono, subtotal, conCupon }) {
  try {
    const { conf, listo } = await leerConf(supabase);
    if (!listo || !conf.activa) return { aplica: false, mensaje: null };
    if (subtotal < conf.minimo) return { aplica: false, mensaje: null };
    if (conCupon) return { aplica: false, mensaje: MOTIVOS.cupon };
    const tel = String(telefono || '').replace(/\D/g, '');
    if (!tel) return { aplica: false, mensaje: null };
    await liberarVencidas(supabase, conf.horas);
    const token = 'tmp-' + crypto.randomBytes(6).toString('hex');
    const r = await tomarCupo(supabase, conf, token, tel);
    if (!r.ok) return { aplica: false, mensaje: MOTIVOS[r.motivo] };
    return { aplica: true, valor: Math.min(conf.valor, subtotal), token, horas: conf.horas, slot: r.slot };
  } catch (e) {
    console.error('[first10] reservar:', e.message);
    return { aplica: false, mensaje: null };
  }
}
const asignar = (supabase, token, numero) => supabase.from(TABLA).update({ order_id: numero }).eq('order_id', token).then(() => {}, e => console.error('[first10] asignar', numero, e.message));
const soltar = (supabase, orderId) => supabase.from(TABLA).update(LIBRE).eq('order_id', orderId).then(() => {}, () => {});

/* El cliente reportó su pago: su reserva ya no vence sola */
const pagoReportado = (supabase, orderId) => supabase.from(TABLA).update({ pago_reportado: true }).eq('order_id', orderId).eq('estado', 'reservado').then(() => {}, () => {});

const tieneFirst10 = o => !!((o.pricing || (o.customer || {}).pricing || {}).first10);

/* Pago confirmado: el cupo reservado pasa a confirmado. Nunca lanza. Devuelve
   { confirmado, quedan, agotado } | { sinCupo: true } (la reserva venció y otro tomó el cupo) | null */
async function confirmar(supabase, order) {
  try {
    if (!tieneFirst10(order)) return null;
    const { conf, listo } = await leerConf(supabase);
    if (!listo) return null;
    const tel = String((order.customer || {}).telefono || '').replace(/\D/g, '');
    let { data: fila } = await supabase.from(TABLA).select('slot,estado').eq('order_id', order.id).maybeSingle();
    if (!fila) {
      // Su reserva venció o se canceló antes: se intenta tomar otro cupo para respetar el precio pagado
      await liberarVencidas(supabase, conf.horas);
      const r = await tomarCupo(supabase, conf, order.id, tel);
      if (!r.ok) return { sinCupo: true };
      fila = { slot: r.slot, estado: 'reservado' };
    }
    if (fila.estado !== 'confirmado') {
      await supabase.from(TABLA).update({ estado: 'confirmado', confirmado_at: new Date().toISOString() }).eq('slot', fila.slot);
    }
    const { count } = await supabase.from(TABLA).select('slot', { count: 'exact', head: true }).eq('estado', 'confirmado');
    const confirmados = count || 0;
    const agotado = confirmados >= conf.cupos;
    if (agotado && conf.activa) await guardarConf(supabase, { ...conf, activa: false, cerradaAuto: true }).then(() => {}, () => {});
    return { confirmado: true, quedan: Math.max(0, conf.cupos - confirmados), agotado };
  } catch (e) {
    console.error('[first10] confirmar', order && order.id, e.message);
    return null;
  }
}

/* Pedido cancelado: su cupo (reservado o confirmado) vuelve a quedar libre. Nunca lanza. */
async function liberarPedido(supabase, order) {
  try {
    if (!tieneFirst10(order)) return null;
    await soltar(supabase, order.id);
    const { conf, listo } = await leerConf(supabase);
    if (listo && conf.cerradaAuto && !conf.activa) await guardarConf(supabase, { ...conf, activa: true, cerradaAuto: false });
    return { liberado: true };
  } catch (e) {
    console.error('[first10] liberar', order && order.id, e.message);
    return null;
  }
}

module.exports = { DEF, PAGADOS, TABLA, sanitize, leerConf, guardarConf, prepararCupos, estado, publico, reservar, asignar, soltar, pagoReportado, confirmar, liberarPedido, tieneFirst10, money };
