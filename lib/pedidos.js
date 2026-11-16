'use strict';
/* =====================================================================
   Pedidos de Punto Club: número legible, estados y seguimiento.
   ===================================================================== */

/* Etapas del pedido, en orden. "Cancelado" es aparte (corta el recorrido).
   "Hacia el taller" solo existe en pedidos con caja: el par viaja de la fábrica (Cali)
   al taller de Quibdó, donde se personaliza la caja, y de ahí sale hacia el cliente. */
const STEPS = [
  { key: 'Recibido',        label: 'Pedido recibido' },
  { key: 'Pago confirmado', label: 'Pago confirmado' },
  { key: 'Hacia el taller', label: 'En camino a nuestro taller', soloCaja: true },
  { key: 'En preparación',  label: 'En preparación' },
  { key: 'Enviado',         label: 'Enviado' },
  { key: 'Entregado',       label: 'Entregado' }
];
const STATUSES = [...STEPS.map(s => s.key), 'Cancelado'];

/* Etapas que aplican a un pedido según su empaque */
const stepsFor = c => STEPS.filter(s => !s.soloCaja || (c || {}).empaque === 'Con caja');
const statusOk = (status, c) => status === 'Cancelado' || stepsFor(c).some(s => s.key === status);

/* Estados que existían antes (Nuevo, Confirmado) se traducen a los nuevos */
function normalizeStatus(s) {
  if (s === 'Nuevo' || !s) return 'Recibido';
  if (s === 'Confirmado') return 'Pago confirmado';
  return STATUSES.includes(s) ? s : 'Recibido';
}

/* Número de pedido: PC-AAAAMMDD-#### (PC = Punto Club). Fecha de Colombia.
   Los pedidos hechos antes del cambio de nombre empiezan por KS- y siguen siendo válidos. */
const ORDER_RE = /^(?:PC|KS)-\d{8}-\d{4}$/;
function makeOrderNumber(now = new Date()) {
  const co = new Date(now.getTime() - 5 * 3600e3); // UTC-5
  const ymd = co.toISOString().slice(0, 10).replace(/-/g, '');
  const n = String(Math.floor(1000 + Math.random() * 9000));
  return `PC-${ymd}-${n}`;
}

/* Lee el seguimiento guardado (columna tracking o, si no existe, dentro de customer) */
function trackingOf(order) {
  const t = order.tracking || (order.customer && order.customer.tracking) || {};
  return { history: Array.isArray(t.history) ? t.history : [], guia: t.guia || '', transportadora: t.transportadora || '', nota: t.nota || '', link: linkOk(t.link) };
}

/* Enlace de rastreo: el que pegue la tienda en el panel o, si no hay, la página oficial
   de rastreo de la transportadora (solo las verificadas; ahí el cliente pega su guía). */
const RASTREO = {
  servientrega: 'https://www.servientrega.com/wps/portal/rastreo-envio',
  coordinadora: 'https://coordinadora.com/rastreo/rastreo-de-guia/'
};
function linkOk(u) {
  const s = String(u || '').trim();
  try { return s && new URL(s).protocol === 'https:' && s.length <= 300 && !/[\s"'<>]/.test(s) ? s : ''; } catch { return ''; }
}
function rastreoUrl(t) {
  if (t.link) return t.link;
  const k = String(t.transportadora || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const hit = Object.keys(RASTREO).find(x => k.includes(x));
  return hit ? RASTREO[hit] : '';
}

/* Nombre de cada etapa según cómo se entrega y se paga el pedido */
function stepLabel(s, c) {
  if (s.key === 'Pago confirmado' && c.pago === 'Contraentrega') return 'Anticipo confirmado';
  if (s.key === 'Pago confirmado' && c.pago === 'En tienda') return 'Pedido separado';
  if (s.key === 'En preparación' && c.empaque === 'Con caja') return 'Personalizando tu caja';
  if (s.key === 'Enviado' && c.entrega === 'Nacional' && c.empaque === 'Con caja') return 'Salió del taller · va hacia ti';
  if (s.key === 'Enviado' && c.entrega === 'Recoger') return 'Listo para recoger';
  if (s.key === 'Enviado' && c.entrega === 'Domicilio') return 'Domicilio en camino';
  if (s.key === 'Enviado' && c.entrega === 'Nacional') return 'Enviado por transportadora';
  if (s.key === 'Entregado' && c.entrega === 'Recoger') return 'Recogido';
  return s.label;
}

/* Recorrido para mostrar al cliente: done / current / todo */
function buildSteps(order) {
  const status = normalizeStatus(order.status);
  const t = trackingOf(order);
  const steps = stepsFor(order.customer);
  const idx = steps.findIndex(s => s.key === status);
  const at = key => {
    const h = [...t.history].reverse().find(x => x.status === key);
    if (h) return h.at;
    return key === 'Recibido' ? order.created_at : null;
  };
  return steps.map((s, i) => ({
    key: s.key,
    label: stepLabel(s, order.customer || {}),
    state: status === 'Cancelado' ? 'todo' : i < idx ? 'done' : i === idx ? (i === steps.length - 1 ? 'done' : 'current') : 'todo',
    at: i <= idx ? at(s.key) : null
  }));
}

/* Identificador anónimo del dispositivo del cliente ("Mis pedidos" sin cuenta).
   El navegador genera un valor aleatorio; en la base solo se guarda su hash. */
function clienteHash(v) {
  const s = String(v || '');
  if (!/^[A-Za-z0-9_-]{22,64}$/.test(s)) return '';
  return require('crypto').createHash('sha256').update('kairo-cliente:' + s).digest('hex');
}

const maskAddress = s => {
  const t = String(s || '');
  return t.length <= 8 ? t : t.slice(0, 8) + '…';
};

/* Resumen público de un pedido para "Mis pedidos" (sin datos sensibles) */
function publicOrder(o) {
  const c = o.customer || {};
  const status = normalizeStatus(o.status);
  const t = trackingOf(o);
  const steps = buildSteps(o);
  const cur = steps.find(s => s.state === 'current') || steps[steps.length - 1];
  const pricing = o.pricing || c.pricing || {};
  return {
    numero: o.id, createdAt: o.created_at,
    ultimos4: String(c.telefono || '').replace(/\D/g, '').slice(-4),
    nombre: String(c.nombre || '').split(' ')[0],
    pago: c.pago || '', entrega: c.entrega || '', empaque: c.empaque || 'Sin caja', plazo: c.plazo || '', ciudad: c.ciudad || '', departamento: c.departamento || '', direccion: c.entrega === 'Recoger' ? 'Recoge en la tienda' : maskAddress(c.direccion),
    status, statusLabel: status === 'Cancelado' ? 'Cancelado' : cur.label,
    steps, guia: t.guia, transportadora: t.transportadora, nota: t.nota, rastreo: t.guia ? rastreoUrl(t) : '',
    pagoReportado: c.pagoReportado ? { at: c.pagoReportado.at, hasComprobante: !!c.pagoReportado.comprobantePath } : null,
    items: (o.items || []).map(i => ({ id: i.id, brand: i.brand, name: i.name, size: i.size, color: i.color, qty: i.qty, price: i.price, image: i.image || '' })),
    pricing: {
      promoSavings: pricing.promoSavings || 0,
      discount: pricing.coupon ? pricing.coupon.discount : 0,
      couponCode: pricing.coupon ? pricing.coupon.code : '',
      first10: pricing.first10 ? pricing.first10.descuento : 0, // FIRST 10: descuento de apertura
      envio: pricing.envio != null ? pricing.envio : null,
      caja: pricing.caja || 0,
      freeShipping: !!pricing.freeShipping,
      total: pricing.total != null ? pricing.total : o.total,
      totalConEnvio: pricing.totalConEnvio != null ? pricing.totalConEnvio : o.total,
      pagarAhora: pricing.pagarAhora || 0,
      saldoContraentrega: pricing.saldoContraentrega || 0
    }
  };
}

module.exports = { ORDER_RE, linkOk, rastreoUrl, stepLabel, STEPS, STATUSES, stepsFor, statusOk, normalizeStatus, makeOrderNumber, trackingOf, buildSteps, clienteHash, publicOrder };
