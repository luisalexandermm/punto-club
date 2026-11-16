'use strict';
/* Mercado Pago — Checkout Pro con la API de Orders.
   - Al registrar un pedido con pago "MercadoPago" se crea una orden en Mercado Pago (POST /v1/orders)
     y el cliente va a pagar a su página segura (checkout_url). Al terminar vuelve a la tienda.
   - El pedido SOLO pasa a "Pago confirmado" cuando la tienda consulta la orden en la API de
     Mercado Pago (GET /v1/orders/{id}) y ve status "processed", la referencia correcta y el valor exacto.
     El aviso (webhook) y el regreso del cliente solo disparan esa consulta: nunca se les cree solos.
   Variables (Vercel → Settings → Environment Variables):
     MP_ACCESS_TOKEN     Access Token (Tus integraciones → la aplicación → Credenciales). Secreto.
     MP_WEBHOOK_SECRET   Opcional: clave secreta de Webhooks, para validar la firma de los avisos.
     SITE_URL            Opcional: https://tu-dominio (si no, se usa el dominio de la petición).
   Montos en pesos colombianos: Mercado Pago solo acepta enteros ("150000", sin decimales). */
const crypto = require('crypto');
const { siteUrl } = require('./wompi');

const API = 'https://api.mercadopago.com';
const mpReady = () => !!String(process.env.MP_ACCESS_TOKEN || '').trim();

async function llamar(method, path, body) {
  const r = await fetch(API + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + String(process.env.MP_ACCESS_TOKEN || '').trim(),
      'Content-Type': 'application/json',
      'X-Idempotency-Key': crypto.randomUUID()
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const txt = await r.text();
  let data = null; try { data = JSON.parse(txt); } catch (e) { data = { raw: txt.slice(0, 300) }; }
  return { status: r.status, data };
}

/* Crea la orden de pago. Devuelve { id, url } o lanza un error con el detalle de Mercado Pago. */
async function crearOrden(req, { numero, amount, customer = {} }) {
  const total = String(Math.round(Number(amount)));
  const ultimos4 = String(customer.telefono || '').replace(/\D/g, '').slice(-4);
  const vuelta = estado => `${siteUrl(req)}/?mp=${estado}&pedido=${encodeURIComponent(numero)}&c=${ultimos4}`;
  const body = {
    type: 'online',
    processing_mode: 'manual',
    external_reference: numero,
    total_amount: total,
    description: `Punto Club — pedido ${numero}`,
    // Una sola línea con el total exacto: así la suma siempre coincide aunque haya descuentos, envío o caja
    items: [{ title: `Pedido ${numero} — Punto Club`, unit_price: total, quantity: 1 }],
    config: { online: { success_url: vuelta('ok'), failure_url: vuelta('error'), pending_url: vuelta('pendiente'), auto_return: 'approved' } }
  };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.correo || '')) body.payer = { email: customer.correo };
  let r = await llamar('POST', '/v1/orders', body);
  // Si Mercado Pago no acepta el correo del cliente, se intenta sin él (el cliente lo escribe allá)
  if (r.status >= 400 && body.payer) { delete body.payer; r = await llamar('POST', '/v1/orders', body); }
  if (r.status >= 300 || !r.data || !r.data.checkout_url) {
    const det = r.data && r.data.errors ? JSON.stringify(r.data.errors).slice(0, 300) : JSON.stringify(r.data).slice(0, 300);
    throw new Error(`Mercado Pago respondió ${r.status}: ${det}`);
  }
  return { id: r.data.id, url: r.data.checkout_url };
}

/* Consulta una orden. Devuelve el objeto de Mercado Pago o null. */
async function obtenerOrden(id) {
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(String(id || ''))) return null;
  const r = await llamar('GET', '/v1/orders/' + encodeURIComponent(id));
  return r.status === 200 ? r.data : null;
}

/* Estado resumido para la tienda (mismos nombres que usaba el pago en línea anterior) */
function estadoDe(o) {
  const s = o && o.status;
  if (s === 'processed') return 'APPROVED';
  if (s === 'failed') return 'DECLINED';
  if (s === 'canceled' || s === 'expired') return 'VOIDED';
  if (s === 'refunded') return 'VOIDED';
  return 'PENDING'; // created, processing, action_required
}
/* Medio de pago, si la orden lo trae (tarjeta, PSE…) */
function metodoDe(o) {
  const p = o && o.transactions && Array.isArray(o.transactions.payments) && o.transactions.payments[0];
  const m = p && p.payment_method;
  return m ? String(m.type || m.id || '').slice(0, 40) : '';
}
/* Valor pagado: total_paid_amount si existe; si no, la suma de los pagos acreditados */
function pagadoDe(o) {
  if (o && o.total_paid_amount != null && Number(o.total_paid_amount) > 0) return Number(o.total_paid_amount);
  const pays = (o && o.transactions && o.transactions.payments) || [];
  const sum = pays.filter(p => p.status === 'processed' || p.status_detail === 'accredited').reduce((s, p) => s + Number(p.paid_amount || p.amount || 0), 0);
  return sum || Number((o && o.total_amount) || 0);
}

/* Firma del aviso (webhook). Si no hay MP_WEBHOOK_SECRET configurado, no se valida
   (no pasa nada grave: el aviso solo hace que la tienda consulte la orden en la API). */
function firmaValida(req, dataId) {
  const secret = String(process.env.MP_WEBHOOK_SECRET || '').trim();
  if (!secret) return true;
  const h = String(req.headers['x-signature'] || '');
  const parts = Object.fromEntries(h.split(',').map(x => x.split('=').map(s => s.trim())).filter(x => x.length === 2));
  if (!parts.ts || !parts.v1) return false;
  const reqId = String(req.headers['x-request-id'] || '');
  const ok = id => {
    let manifest = `id:${id};`;
    if (reqId) manifest += `request-id:${reqId};`;
    manifest += `ts:${parts.ts};`;
    const calc = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
    return calc.length === parts.v1.length && crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(parts.v1));
  };
  return ok(String(dataId)) || ok(String(dataId).toLowerCase());
}

module.exports = { mpReady, crearOrden, obtenerOrden, estadoDe, metodoDe, pagadoDe, firmaValida };
