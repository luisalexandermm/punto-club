'use strict';
/* Empaque del pedido: el cliente elige al pedir.
   - Sin caja: el par va protegido en bolsa. Sale apenas se confirma el pago.
   - Con caja personalizada: CAJA_PRECIO por cada par y unos días más de alistamiento.
   Debe coincidir con cajaPrecio y cajaDiasExtra de public/js/negocio.js */
const CAJA_PRECIO = 10000;
const CAJA_DIAS_EXTRA = '2 a 3 días hábiles';
const EMPAQUES = ['Sin caja', 'Con caja'];

const empaqueDe = v => (v === 'Con caja' ? 'Con caja' : 'Sin caja');
const pares = items => (items || []).reduce((s, i) => s + (Number(i.qty) || 1), 0);
const valorCaja = (empaque, items) => (empaque === 'Con caja' ? CAJA_PRECIO * pares(items) : 0);

module.exports = { CAJA_PRECIO, CAJA_DIAS_EXTRA, EMPAQUES, empaqueDe, valorCaja };
