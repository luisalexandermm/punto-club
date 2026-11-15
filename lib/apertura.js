'use strict';
/* Gran apertura: hasta esta hora la tienda no muestra productos ni precios, ni recibe pedidos.
   Hora de Colombia (-05:00). Para cambiarla sin tocar el código: variable APERTURA en Vercel,
   p. ej. 2026-11-16T00:00:00-05:00. Para abrir ya: APERTURA=ya */
const POR_DEFECTO = '2026-11-16T00:00:00-05:00';

function apertura() {
  const v = String(process.env.APERTURA || '').trim();
  if (/^(ya|abierta|0)$/i.test(v)) return null;
  const d = new Date(v || POR_DEFECTO);
  return isNaN(d) ? new Date(POR_DEFECTO) : d;
}

/* null si ya abrió; si no, la fecha de apertura en ISO */
function cerrada(now = new Date()) {
  const d = apertura();
  return d && now < d ? d.toISOString() : null;
}

module.exports = { cerrada };
