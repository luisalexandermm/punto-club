'use strict';
/* POST /api/mercadopago — pago en línea con Mercado Pago (Checkout Pro, API de Orders).
   1. Aviso (webhook) de Mercado Pago: { type: "order", data: { id } } → se consulta la orden en la API.
   2. { accion: 'verificar', numero, ultimos4 }: el cliente volvió de Mercado Pago y la tienda pregunta el resultado.
   3. { accion: 'checkout', numero, ultimos4 }: nuevo intento de pago (p. ej. si el anterior fue rechazado).
   El pedido solo pasa a "Pago confirmado" si la API dice "processed" y el valor coincide. */
const supabase = require('../lib/supabase');
const { ok, err, allowCors } = require('../lib/helpers');
const { ORDER_RE, normalizeStatus, trackingOf } = require('../lib/pedidos');
const mp = require('../lib/mercadopago');
const { sendWhatsApp, adminWhatsApp } = require('../lib/whatsapp');
const { notifyOrder, pushReady } = require('../lib/push');
const promoApertura = require('../lib/promo-apertura');

const money = n => '$' + Number(n || 0).toLocaleString('es-CO');

/* Aplica el estado de una orden de Mercado Pago a su pedido */
async function aplicarOrden(mo) {
  const numero = String((mo && mo.external_reference) || '');
  if (!ORDER_RE.test(numero)) return { error: 'Referencia desconocida', status: 404 };
  const { data: o, error } = await supabase.from('orders').select('*').eq('id', numero).maybeSingle();
  if (error || !o) return { error: 'Pedido no encontrado', status: 404 };
  const c = o.customer || {};
  const status = normalizeStatus(o.status);
  const pricing = o.pricing || c.pricing || {};
  const esperado = Math.round(Number(pricing.pagarAhora != null ? pricing.pagarAhora : o.total));
  const estado = mp.estadoDe(mo);
  const result = { numero, estado, orderStatus: status };

  // Sin cambios desde la última consulta: no se toca nada
  if (c.mercadopago && c.mercadopago.orderId === mo.id && c.mercadopago.status === mo.status) return result;
  // Un pedido ya pagado no se cambia por una orden vieja que falló o se canceló
  if (c.mercadopago && c.mercadopago.estado === 'APPROVED' && estado !== 'APPROVED') return result;

  const pagado = mp.pagadoDe(mo);
  const aprobado = estado === 'APPROVED' && String(mo.currency || 'COP') === 'COP' && Math.round(pagado) === esperado;
  if (estado === 'APPROVED' && !aprobado) console.error(`Mercado Pago: valor no coincide en ${numero}: ${pagado} vs ${esperado}`);
  const now = new Date().toISOString();
  const mercadopago = {
    orderId: mo.id, status: mo.status, statusDetail: mo.status_detail || '',
    estado: aprobado || estado !== 'APPROVED' ? estado : 'REVISAR',
    metodo: mp.metodoDe(mo), valor: pagado, at: now
  };
  const update = { customer: { ...c, mercadopago } };
  const confirmar = aprobado && status === 'Recibido';
  if (confirmar) {
    const t = trackingOf(o);
    update.status = 'Pago confirmado';
    update.tracking = { ...t, history: [...t.history, { status: 'Pago confirmado', at: now, via: 'Mercado Pago' }] };
  }
  let { error: ue } = await supabase.from('orders').update(update).eq('id', numero);
  if (ue && update.tracking && /tracking/i.test(ue.message) && /column/i.test(ue.message)) {
    const { tracking, ...rest } = update;
    ({ error: ue } = await supabase.from('orders').update({ ...rest, customer: { ...rest.customer, tracking } }).eq('id', numero));
  }
  if (ue) { console.error('Mercado Pago: no se pudo actualizar', numero, ue.message); return { error: 'No se pudo actualizar el pedido', status: 500 }; }

  if (confirmar) {
    result.orderStatus = 'Pago confirmado';
    const pedido = { ...o, ...update, customer: update.customer };
    const f10 = await promoApertura.confirmar(supabase, pedido);
    await Promise.all([
      sendWhatsApp(adminWhatsApp(), `Pago aprobado en Mercado Pago\nPedido ${numero} · ${money(pagado)}${mercadopago.metodo ? ' · ' + mercadopago.metodo : ''}\n${c.nombre || ''} · ${c.ciudad || ''}, ${c.departamento || ''}` + (f10 && f10.sinCupo ? '\n⚠️ FIRST 10: su reserva venció y ya no quedan cupos.' : '')),
      c.telefono ? sendWhatsApp('+57' + c.telefono, `Punto Club: recibimos tu pago de ${money(pagado)} para el pedido ${numero}. Ya lo estamos preparando.`) : false,
      pushReady() ? notifyOrder(supabase, pedido, 'Pago confirmado', update.tracking, { first10: !!(f10 && f10.confirmado) }) : 0
    ].map(p => Promise.resolve(p).catch(() => false)));
  }
  return result;
}

async function pedidoDelCliente(b) {
  const numero = String(b.numero || '').trim().toUpperCase();
  const ultimos4 = String(b.ultimos4 || '').replace(/\D/g, '');
  if (!ORDER_RE.test(numero) || !/^\d{4}$/.test(ultimos4)) return { error: 'Pedido no válido', status: 400 };
  const { data: o } = await supabase.from('orders').select('*').eq('id', numero).maybeSingle();
  const c = (o && o.customer) || {};
  if (!o || !String(c.telefono || '').endsWith(ultimos4)) return { error: 'Pedido no encontrado', status: 404 };
  return { o, c, numero };
}

module.exports = async (req, res) => {
  allowCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return err(res, 'Método no permitido', 405);
  if (!mp.mpReady()) return err(res, 'El pago con Mercado Pago no está disponible en este momento.', 503);
  const b = req.body || {};
  const q = req.query || {};

  /* 1. Aviso (webhook) de Mercado Pago */
  const tipo = b.type || q.type || q.topic;
  if (tipo === 'order' || tipo === 'orders') {
    const id = (b.data && b.data.id) || q['data.id'] || q.id;
    if (!mp.firmaValida(req, id)) return err(res, 'Firma inválida', 401);
    const mo = await mp.obtenerOrden(id); // se confirma con la API, no solo con el aviso
    if (!mo) return ok(res, { ok: true }); // orden ajena o de prueba: se ignora
    const r = await aplicarOrden(mo);
    if (r.error && r.status === 500) return err(res, r.error, 500); // Mercado Pago reintenta
    return ok(res, { ok: true });
  }
  if (b.action || tipo) return ok(res, { ok: true }); // otros avisos (pagos, pruebas del panel)

  /* 2. El cliente volvió de Mercado Pago */
  if (b.accion === 'verificar') {
    const p = await pedidoDelCliente(b);
    if (p.error) return err(res, p.error, p.status);
    const orderId = p.c.mercadopago && p.c.mercadopago.orderId;
    if (!orderId) return err(res, 'Este pedido no tiene un pago con Mercado Pago.', 404);
    const mo = await mp.obtenerOrden(orderId);
    if (!mo) return err(res, 'No pudimos consultar tu pago en Mercado Pago. Intenta de nuevo en unos segundos.', 502);
    const r = await aplicarOrden(mo);
    if (r.error) return err(res, r.error, r.status || 400);
    return ok(res, { numero: r.numero, estado: r.estado, pedido: r.orderStatus || 'Recibido', metodo: mp.metodoDe(mo) });
  }

  /* 3. Nuevo intento de pago para un pedido existente */
  if (b.accion === 'checkout') {
    const p = await pedidoDelCliente(b);
    if (p.error) return err(res, p.error, p.status);
    if (normalizeStatus(p.o.status) !== 'Recibido') return err(res, 'Este pedido ya no está esperando el pago.', 409);
    if (p.c.mercadopago && p.c.mercadopago.estado === 'APPROVED') return err(res, 'Este pedido ya fue pagado.', 409);
    const pricing = p.o.pricing || p.c.pricing || {};
    try {
      const nueva = await mp.crearOrden(req, { numero: p.numero, amount: pricing.pagarAhora != null ? pricing.pagarAhora : p.o.total, customer: p.c });
      const mercadopago = { ...(p.c.mercadopago || {}), orderId: nueva.id, status: 'created', estado: 'PENDING', at: new Date().toISOString() };
      await supabase.from('orders').update({ customer: { ...p.c, mercadopago } }).eq('id', p.numero);
      return ok(res, { checkoutUrl: nueva.url });
    } catch (e) {
      console.error('[mercadopago] checkout', p.numero, e.message);
      return err(res, 'No pudimos abrir Mercado Pago. Intenta de nuevo en unos segundos.', 502);
    }
  }

  return err(res, 'Solicitud no válida', 400);
};

module.exports.aplicarOrden = aplicarOrden;
