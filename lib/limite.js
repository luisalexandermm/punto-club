'use strict';
/* =====================================================================
   Límite de intentos por conexión (IP) — protege contra quien intenta, desde la
   consola del navegador o con un programa, adivinar la contraseña del panel,
   probar cupones al azar o llenar la tienda de pedidos falsos.

   Se guarda en Supabase (tabla "intentos"), así funciona aunque Vercel use varias
   copias del servidor. Si la tabla todavía no existe (falta ejecutar
   lib/migracion-seguridad-2026-11.sql), usa la memoria del servidor como respaldo.
   La IP nunca se guarda tal cual: solo una huella (hash) que no se puede revertir.
   ===================================================================== */
const crypto = require('crypto');

/* IP del visitante. En Vercel, x-real-ip / x-forwarded-for los pone Vercel (el
   navegador no puede falsificarlos). */
function ipDe(req) {
  const h = (req && req.headers) || {};
  return String(h['x-real-ip'] || h['x-vercel-forwarded-for'] || h['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '')
    .split(',')[0].trim() || 'desconocida';
}
const huella = ip => crypto.createHash('sha256').update('pc-ip|' + (process.env.TOKEN_SECRET || 'punto-club') + '|' + ip).digest('hex').slice(0, 24);
const quienDe = req => huella(ipDe(req));

/* ---- respaldo en memoria ---- */
const mem = new Map();
function memCount(accion, quien, minutos) {
  const now = Date.now(), k = accion + '|' + (quien || '*');
  const h = (mem.get(k) || []).filter(t => now - t < minutos * 60e3);
  mem.set(k, h);
  return h.length;
}
function memAdd(accion, quien) {
  if (mem.size > 5000) mem.clear();
  [accion + '|' + quien, accion + '|*'].forEach(k => { const h = mem.get(k) || []; h.push(Date.now()); mem.set(k, h); });
}

let sinTabla = false;
const esFaltaTabla = e => e && /intentos/.test(e.message || '') && /(does not exist|schema cache|relation|find the table)/i.test(e.message || '');

/* Cuántos intentos de "accion" hubo en los últimos "minutos" (de esa conexión, o de todas si quien es null) */
async function cuenta(supabase, accion, quien, minutos) {
  if (!sinTabla) {
    let q = supabase.from('intentos').select('id', { count: 'exact', head: true })
      .eq('accion', accion).gte('at', new Date(Date.now() - minutos * 60e3).toISOString());
    if (quien) q = q.eq('quien', quien);
    const { count, error } = await q;
    if (!error) return count || 0;
    if (esFaltaTabla(error)) sinTabla = true;
    else console.error('[limite] no se pudo contar:', error.message);
  }
  return memCount(accion, quien, minutos);
}

/* Anota un intento */
async function anotar(supabase, accion, quien) {
  memAdd(accion, quien);
  if (sinTabla) return;
  const { error } = await supabase.from('intentos').insert({ accion, quien });
  if (error) { if (esFaltaTabla(error)) sinTabla = true; else console.error('[limite] no se pudo anotar:', error.message); return; }
  // De vez en cuando se borran los registros viejos (más de 3 días)
  if (Math.random() < 0.03) {
    supabase.from('intentos').delete().lt('at', new Date(Date.now() - 3 * 864e5).toISOString()).then(() => {}, () => {});
  }
}

/* Atajo: ¿esta conexión ya pasó el límite? Si no, anota el intento. */
async function limitar(supabase, req, accion, max, minutos) {
  const quien = quienDe(req);
  if (await cuenta(supabase, accion, quien, minutos) >= max) return true;
  await anotar(supabase, accion, quien);
  return false;
}

/* Respuesta estándar 429 */
function demasiados(res, minutos, texto) {
  res.setHeader('Retry-After', String(minutos * 60));
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(429).json({ error: texto || `Demasiados intentos. Espera ${minutos} minutos e intenta de nuevo.` });
}

module.exports = { ipDe, quienDe, cuenta, anotar, limitar, demasiados, tablaLista: () => !sinTabla };
