/* =====================================================================
   DATOS DEL NEGOCIO — Punto Club
   ---------------------------------------------------------------------
   Este es el ÚNICO lugar donde se escriben los datos legales del negocio.
   La tienda, el pie de página y todas las páginas legales los leen de aquí.

   ⚠️  Todo campo vacío ('') aparece en el sitio como  [COMPLETAR: …]
       para que no se publique nada inventado. Llénalos con los datos
       EXACTOS que figuran en tu RUT / Cámara de Comercio antes de publicar.
   ===================================================================== */
window.NEGOCIO = {
  /* Identificación (Ley 1480 de 2011, art. 50, y Ley 1581 de 2012) */
  nombreComercial: 'Punto Club',
  responsable: 'Luis Alexander',
  nit: '',                  // NIT con dígito de verificación, ej. 1234567890-1
  matriculaMercantil: '',   // Opcional: número de matrícula en Cámara de Comercio (déjalo vacío si no aplica)
  direccion: 'Quibdó',      // Domicilio del negocio (no es un punto de venta: por ahora solo hay envíos nacionales)
  ciudad: 'Chocó',
  correo: 'contacto.maturanainnovate@gmail.com',
  whatsapp: '573145312045', // Solo números, con indicativo 57
  telefonoVisible: '314 531 2045',
  horario: '8:00 a. m. – 5:00 p. m.',
  // Redes sociales: URL completa (vacío = no se muestra el ícono)
  facebook: 'https://www.facebook.com/share/1FSPQ3Qq7C/',
  tiktok: 'https://www.tiktok.com/@punto_club',
  instagram: 'https://www.instagram.com/punt.oclub/',

  /* Pago con Nequi / Bre-B. El QR está en /img/nequi-qr.png.
     El cliente ve este nombre y esta llave para confirmar a quién le paga. */
  nequiTitular: 'Luis Moreno',
  nequiLlave: '@3145312045',

  /* Condiciones comerciales que SOLO tú puedes definir */
  plazoEntrega: 'sin caja, de 1 a 10 días hábiles según el departamento (de 1 a 3 en Cali, Medellín, Bogotá y el Eje Cafetero); con caja personalizada, de 6 a 18 días hábiles, porque el par pasa por nuestro taller en Quibdó. Se cuentan desde que confirmamos el pago, y la tienda te muestra el plazo de tu departamento antes de pedir', // Debe coincidir con la tabla de lib/envios.js. Máximo legal: 30 días calendario
  envioNacional: 25000,     // Valor del envío a toda Colombia. Debe coincidir con Panel → Ajustes → Envío nacional
  plazoCambioTallaDias: '', // Días para cambios de talla por gusto (voluntario). Vacío = [COMPLETAR]

  /* Empaque: el cliente elige al pedir. Debe coincidir con lib/empaque.js (el servidor cobra con ese valor) */
  cajaPrecio: 10000,                  // Valor de la caja personalizada, por cada par
  // Los días de entrega (sin caja y con caja, por departamento) están en lib/envios.js

  /* Aviso de precios en la tienda (vacío = no se muestra) */
  avisoPrecio: 'Precio de apertura + Black Friday',

  /* Versión de las políticas. Si cambias los textos legales, cambia esta fecha:
     queda guardada junto a cada pedido como prueba de lo que aceptó el cliente. */
  versionPoliticas: '2026-11-14'
};

(function () {
  var N = window.NEGOCIO;
  var etiquetas = {
    responsable: 'nombre o razón social del RUT', nit: 'NIT', direccion: 'dirección física',
    ciudad: 'ciudad', correo: 'correo de atención', horario: 'horario de atención',
    plazoEntrega: 'plazo de entrega', plazoCambioTallaDias: 'días para cambio de talla'
  };
  var faltantes = Object.keys(etiquetas).filter(function (k) { return !String(N[k] || '').trim(); });
  N.faltantes = faltantes;
  if (faltantes.length && window.console) {
    console.warn('[Punto Club] Faltan datos del negocio en /js/negocio.js:', faltantes.join(', '));
  }

  function valor(k) {
    if (k === 'whatsappLink') return 'https://wa.me/' + N.whatsapp;
    if (k === 'envioNacional') return '$' + Number(N[k] || 0).toLocaleString('es-CO');
    if (k === 'fechaPoliticas') {
      var p = String(N.versionPoliticas).split('-');
      var meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
      return Number(p[2]) + ' de ' + meses[Number(p[1]) - 1] + ' de ' + p[0];
    }
    return N[k];
  }

  function pintar() {
    document.querySelectorAll('[data-negocio]').forEach(function (el) {
      var k = el.getAttribute('data-negocio');
      var v = valor(k);
      if (v === undefined || v === null || String(v).trim() === '') {
        if (el.hasAttribute('data-opcional')) { el.closest('[data-fila]') ? el.closest('[data-fila]').remove() : el.remove(); return; }
        el.innerHTML = '';
        var m = document.createElement('mark');
        m.className = 'pendiente';
        m.textContent = '[COMPLETAR: ' + (etiquetas[k] || k) + ']';
        el.appendChild(m);
        return;
      }
      if (el.tagName === 'A') {
        if (k === 'correo') el.href = 'mailto:' + v;
        if (k === 'telefonoVisible' || k === 'whatsappLink') el.href = 'https://wa.me/' + N.whatsapp;
        if (k === 'instagram' || k === 'facebook' || k === 'tiktok') { el.href = v; el.hidden = false; return; }
      }
      el.textContent = v;
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pintar);
  else pintar();
  N.pintar = pintar;
})();
