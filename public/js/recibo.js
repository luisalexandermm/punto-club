(function () {
  var $ = function (id) { return document.getElementById(id); };
  var N = window.NEGOCIO || {};
  var money = function (n) { return '$' + Math.round(Number(n) || 0).toLocaleString('es-CO'); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var p = new URLSearchParams(location.search);
  var numero = String(p.get('pedido') || '').toUpperCase().trim(), c = String(p.get('c') || '').replace(/\D/g, '').slice(-4);

  function ask(msg) {
    $('askForm').hidden = false; $('n').value = numero; $('c').value = c;
    if (msg) { $('askErr').textContent = msg; $('askErr').hidden = false; }
  }
  $('askForm').addEventListener('submit', function (e) {
    e.preventDefault();
    location.search = '?pedido=' + encodeURIComponent($('n').value.trim().toUpperCase()) + '&c=' + encodeURIComponent($('c').value.replace(/\D/g, ''));
  });
  if (!/^KS-\d{8}-\d{4}$/.test(numero) || !/^\d{4}$/.test(c)) { ask(); return; }

  fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ numero: numero, ultimos4: c }) })
    .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'No encontramos ese pedido.'); return d; }); })
    .then(pintar)
    .catch(function (e) { ask(e instanceof TypeError ? 'No pudimos consultar en este momento. Revisa tu conexión.' : e.message); });

  function pintar(d) {
    document.title = 'Recibo ' + d.numero + ' — Punto Club';
    var fecha = new Date(d.createdAt).toLocaleString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    var rows = d.items.map(function (i) {
      return '<tr><td>' + esc(i.brand + ' ' + i.name) + '<br><small>Talla ' + esc(i.size) + (i.color ? ' · ' + esc(i.color) : '') + '</small><br><span class="nobox">' + (d.empaque === 'Con caja' ? 'Con caja personalizada' : 'Sin caja') + '</span></td><td class="num">' + esc(i.qty) + '</td><td class="num">' + money(i.price) + '</td><td class="num">' + money(i.price * i.qty) + '</td></tr>';
    }).join('');
    var sub = d.items.reduce(function (s, i) { return s + i.price * i.qty; }, 0);
    var foot = '<tr><td colspan="3">Subtotal productos</td><td class="num">' + money(sub) + '</td></tr>';
    if (d.promoSavings) foot += '<tr><td colspan="3">Ahorro por promociones (ya incluido en los precios)</td><td class="num">-' + money(d.promoSavings) + '</td></tr>';
    if (d.discount) foot += '<tr><td colspan="3">Cupón ' + esc(d.couponCode) + '</td><td class="num">-' + money(d.discount) + '</td></tr>';
    if (d.first10) foot += '<tr><td colspan="3">Descuento FIRST 10 (promoción de apertura)</td><td class="num">-' + money(d.first10) + '</td></tr>';
    if (d.envio != null) foot += '<tr><td colspan="3">' + (d.entrega === 'Recoger' ? 'Recoger en la tienda' : d.entrega === 'Domicilio' ? 'Domicilio' : 'Envío nacional') + '</td><td class="num">' + (d.envio ? money(d.envio) : 'Gratis') + '</td></tr>';
    if (d.caja) foot += '<tr><td colspan="3">Caja personalizada</td><td class="num">' + money(d.caja) + '</td></tr>';
    foot += '<tr class="grand"><td colspan="3">Total</td><td class="num">' + money(d.totalConEnvio) + '</td></tr>';
    var pagoTxt = d.pago === 'Contraentrega'
      ? 'Contraentrega: ' + money(d.pagarAhora) + ' por transferencia y ' + money(d.saldoContraentrega) + ' al recibir'
      : d.pago === 'En tienda' ? 'Separado: ' + money(d.saldoContraentrega) + ' al recoger en la tienda'
      : d.pago === 'Wompi' ? 'En línea (Wompi): ' + money(d.pagarAhora || d.totalConEnvio)
      : 'Transferencia o QR: ' + money(d.pagarAhora || d.totalConEnvio) + ' antes de la entrega';
    $('out').innerHTML =
      '<div class="tools"><button class="btn" type="button" id="print">Descargar o imprimir (PDF)</button><a class="btn btn--line" href="/?pedido=' + encodeURIComponent(d.numero) + '&c=' + encodeURIComponent(c) + '#pedidos">Ver en Mis pedidos</a></div>' +
      '<article class="rc" aria-labelledby="rcTitle">' +
      '<div class="rc-top"><div><img src="/img/punto-club-negro.png" alt="Punto Club" width="215" height="46">' +
      '<div class="rc-biz"><span data-negocio="responsable"></span> · NIT <span data-negocio="nit"></span><br><span data-negocio="direccion"></span>, <span data-negocio="ciudad"></span><br>WhatsApp <span data-negocio="telefonoVisible"></span> · <span data-negocio="correo"></span></div></div>' +
      '<div class="rc-no"><small id="rcTitle">Recibo de pedido</small><b>' + esc(d.numero) + '</b><br><span class="rc-st">' + esc(d.statusLabel) + '</span></div></div>' +
      '<dl class="rc-grid"><div><dt>Fecha</dt><dd>' + esc(fecha) + '</dd></div><div><dt>Cliente</dt><dd>' + esc(d.nombre) + '</dd></div>' +
      '<div><dt>Entrega</dt><dd>' + esc(d.direccion) + (d.entrega === 'Recoger' ? '' : ', ' + esc(d.ciudad) + (d.departamento ? ', ' + esc(d.departamento) : '')) + '</dd></div><div><dt>Forma de pago</dt><dd>' + esc(pagoTxt) + '</dd></div>' +
      (d.guia ? '<div><dt>Guía de envío</dt><dd>' + esc(d.guia) + (d.transportadora ? ' (' + esc(d.transportadora) + ')' : '') + '</dd></div>' : '') + '</dl>' +
      '<div class="table-wrap"><table><caption class="sr-only">Productos del pedido</caption><thead><tr><th scope="col">Producto</th><th scope="col" class="num">Cant.</th><th scope="col" class="num">Precio</th><th scope="col" class="num">Valor</th></tr></thead><tbody>' + rows + '</tbody><tfoot>' + foot + '</tfoot></table></div>' +
      '<p class="rc-legal"><b>Empaque: ' + (d.empaque === 'Con caja' ? 'con caja personalizada' : 'sin caja (protegido en bolsa)') + '.</b> Precios en pesos colombianos con impuestos incluidos. Tienes derecho de retracto dentro de los 5 días hábiles siguientes a la entrega y garantía legal de 1 año; consulta <a href="/cambios-y-devoluciones.html">cambios, garantía y retracto</a>. ' +
      'Este documento es un recibo del pedido y <b>no reemplaza la factura electrónica de venta</b>; si la necesitas, pídela por WhatsApp con este número.</p>' +
      '</article>';
    if (N.pintar) N.pintar();
    $('print').addEventListener('click', function () { window.print(); });
    $('contenido').focus();
  }
})();
