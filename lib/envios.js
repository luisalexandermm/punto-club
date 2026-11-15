'use strict';
/* =====================================================================
   Envíos nacionales de Punto Club: una tarifa fija para toda Colombia.
   - El valor se edita en el panel (Ajustes → Envío nacional) y se guarda en
     settings.envio_nacional. Si la columna no existe todavía, se usa ENVIO_BASE.
   - El servidor nunca cobra fuera del rango MIN_ENVIO … MAX_ENVIO.
   ===================================================================== */
const ENVIO_BASE = 25000;
const MIN_ENVIO = 0;
const MAX_ENVIO = 100000;

/* Departamentos de Colombia (y Bogotá D.C.), en el orden en que se muestran */
const DEPARTAMENTOS = [
  'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bogotá D.C.', 'Bolívar', 'Boyacá', 'Caldas', 'Caquetá',
  'Casanare', 'Cauca', 'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca', 'Guainía', 'Guaviare', 'Huila',
  'La Guajira', 'Magdalena', 'Meta', 'Nariño', 'Norte de Santander', 'Putumayo', 'Quindío', 'Risaralda',
  'San Andrés y Providencia', 'Santander', 'Sucre', 'Tolima', 'Valle del Cauca', 'Vaupés', 'Vichada'
];

/* =====================================================================
   Plazos estimados de entrega, en días hábiles contados desde que se confirma el pago.
   - Sin caja: el par sale directo de la fábrica en Cali hacia el cliente.
   - Con caja: Cali → Quibdó (CALI_QUIBDO) + personalización de la caja en Quibdó
     (PERSONALIZACION) + Quibdó → cliente.
   Por departamento: [desde Cali], [desde Quibdó]. Son tiempos de paquetería terrestre
   (Servientrega, Interrapidísimo, Coordinadora, Envía); ajústalos si la transportadora cambia.
   ===================================================================== */
const CALI_QUIBDO = [3, 5];
const PERSONALIZACION = [2, 3];
const TRAMOS = {
  'Amazonas': [[6, 10], [6, 10]], 'Antioquia': [[2, 3], [2, 4]], 'Arauca': [[4, 7], [5, 8]],
  'Atlántico': [[3, 5], [4, 6]], 'Bogotá D.C.': [[2, 3], [3, 5]], 'Bolívar': [[3, 5], [4, 6]],
  'Boyacá': [[3, 5], [3, 5]], 'Caldas': [[2, 3], [2, 4]], 'Caquetá': [[3, 5], [4, 6]],
  'Casanare': [[3, 5], [4, 6]], 'Cauca': [[1, 3], [4, 6]], 'Cesar': [[3, 5], [4, 6]],
  'Chocó': [[3, 5], [1, 3]], 'Córdoba': [[3, 5], [4, 6]], 'Cundinamarca': [[2, 4], [3, 5]],
  'Guainía': [[6, 10], [6, 10]], 'Guaviare': [[4, 7], [5, 8]], 'Huila': [[2, 4], [3, 5]],
  'La Guajira': [[4, 6], [4, 6]], 'Magdalena': [[3, 5], [4, 6]], 'Meta': [[3, 4], [4, 6]],
  'Nariño': [[2, 4], [4, 6]], 'Norte de Santander': [[3, 5], [3, 5]], 'Putumayo': [[3, 5], [4, 6]],
  'Quindío': [[1, 3], [2, 4]], 'Risaralda': [[1, 3], [2, 4]], 'San Andrés y Providencia': [[6, 10], [6, 10]],
  'Santander': [[3, 5], [3, 5]], 'Sucre': [[3, 5], [4, 6]], 'Tolima': [[2, 3], [3, 5]],
  'Valle del Cauca': [[1, 2], [2, 4]], 'Vaupés': [[6, 10], [6, 10]], 'Vichada': [[6, 10], [6, 10]]
};
const SIN_DATO = [[3, 6], [4, 8]]; // por si llega un departamento que no está en la tabla

/* Plazo total [mínimo, máximo] en días hábiles para un departamento y un empaque */
function diasEntrega(depto, empaque) {
  const [cali, quibdo] = TRAMOS[depto] || SIN_DATO;
  if (empaque !== 'Con caja') return cali.slice();
  return [0, 1].map(i => CALI_QUIBDO[i] + PERSONALIZACION[i] + quibdo[i]);
}
const textoDias = ([a, b]) => (a === b ? `${a}` : `${a} a ${b}`) + ' días hábiles';
const plazoEntrega = (depto, empaque) => textoDias(diasEntrega(depto, empaque));

/* Tabla ya calculada para la tienda (/api/catalog): { depto: { sin: [a, b], con: [a, b] } } */
function tablaPlazos() {
  const t = {};
  for (const d of DEPARTAMENTOS) t[d] = { sin: diasEntrega(d, 'Sin caja'), con: diasEntrega(d, 'Con caja') };
  return t;
}

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');

/* Nombre oficial del departamento a partir de lo que escriba o elija el cliente ('' si no existe) */
function departamento(v) {
  const n = norm(v);
  return DEPARTAMENTOS.find(d => norm(d) === n) || '';
}

/* Valor de envío seguro: redondeado a centenas y dentro del rango */
function precioEnvio(v) {
  if (v === null || v === undefined || v === '' || !Number.isFinite(Number(v))) return ENVIO_BASE;
  return Math.min(MAX_ENVIO, Math.max(MIN_ENVIO, Math.round(Number(v) / 100) * 100));
}

async function loadEnvio(supabase) {
  try {
    const { data, error } = await supabase.from('settings').select('envio_nacional').eq('id', 'app').single();
    return precioEnvio(error ? null : data && data.envio_nacional);
  } catch {
    return ENVIO_BASE;
  }
}

module.exports = {
  ENVIO_BASE, MIN_ENVIO, MAX_ENVIO, DEPARTAMENTOS, departamento, precioEnvio, loadEnvio,
  CALI_QUIBDO, PERSONALIZACION, diasEntrega, textoDias, plazoEntrega, tablaPlazos
};
