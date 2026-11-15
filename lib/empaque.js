'use strict';
/* Empaque del pedido: el cliente elige al pedir.
   - Sin caja: el par va protegido en bolsa y sale directo de la fábrica en Cali.
   - Con caja personalizada: CAJA_PRECIO por cada par. El par pasa por Quibdó para
     personalizar la caja; los días de cada tramo están en lib/envios.js.
   CAJA_PRECIO debe coincidir con cajaPrecio de public/js/negocio.js */
const CAJA_PRECIO = 10000;
const EMPAQUES = ['Sin caja', 'Con caja'];

const empaqueDe = v => (v === 'Con caja' ? 'Con caja' : 'Sin caja');
const pares = items => (items || []).reduce((s, i) => s + (Number(i.qty) || 1), 0);
const valorCaja = (empaque, items) => (empaque === 'Con caja' ? CAJA_PRECIO * pares(items) : 0);

module.exports = { CAJA_PRECIO, EMPAQUES, empaqueDe, valorCaja };
