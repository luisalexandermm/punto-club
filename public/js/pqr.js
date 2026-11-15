(function () {
  var form = document.getElementById('pqrForm');
  var out = document.getElementById('resultado');
  var btn = document.getElementById('enviar');
  var params = new URLSearchParams(location.search);
  if (params.get('pedido')) document.getElementById('pedido').value = params.get('pedido').slice(0, 40);
  if (params.get('tipo')) document.getElementById('tipo').value = params.get('tipo');

  function setError(fieldIds, errId, msg) {
    var err = document.getElementById(errId);
    fieldIds.forEach(function (id) { document.getElementById(id).setAttribute('aria-invalid', msg ? 'true' : 'false'); });
    err.textContent = msg || ''; err.hidden = !msg;
  }
  function val(id) { return document.getElementById(id).value.trim(); }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var errores = [];
    var checks = [
      [['tipo'], 'tipo-err', val('tipo') ? '' : 'Elige el tipo de solicitud.'],
      [['nombre'], 'nombre-err', val('nombre') ? '' : 'Escribe tu nombre.'],
      [['celular', 'correo'], 'contacto-err', (val('celular') || val('correo')) ? ((val('correo') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val('correo'))) ? 'El correo no parece válido. Revisa que tenga @ y un dominio.' : '') : 'Escribe un celular o un correo para poder responderte.'],
      [['mensaje'], 'mensaje-err', val('mensaje').length >= 10 ? '' : 'Cuéntanos un poco más (mínimo 10 caracteres).'],
      [['autorizo'], 'autorizo-err', document.getElementById('autorizo').checked ? '' : 'Necesitamos tu autorización para responderte.']
    ];
    checks.forEach(function (c) { setError(c[0], c[1], c[2]); if (c[2]) errores.push(c[0][0]); });
    if (errores.length) { document.getElementById(errores[0]).focus(); return; }

    btn.disabled = true; btn.textContent = 'Enviando…'; out.innerHTML = '';
    try {
      var r = await fetch('/api/pqr', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: val('tipo'), nombre: val('nombre'), pedido: val('pedido'),
          celular: val('celular'), correo: val('correo'), mensaje: val('mensaje'),
          autorizacion: { datos: true, version: window.NEGOCIO.versionPoliticas }
        })
      });
      var ct = r.headers.get('content-type') || '';
      var d = ct.indexOf('application/json') > -1 ? await r.json() : {};
      if (!r.ok || !d.radicado) throw new Error(d.error || 'No se pudo registrar');
      form.reset();
      out.innerHTML = '';
      var p = document.createElement('p'); p.className = 'callout ok';
      p.innerHTML = '<b>Solicitud recibida.</b> Tu número de radicado es <b></b>. Guárdalo para hacer seguimiento.';
      p.querySelectorAll('b')[1].textContent = d.radicado;
      out.appendChild(p);
    } catch (err) {
      var wa = 'https://wa.me/' + window.NEGOCIO.whatsapp + '?text=' + encodeURIComponent(val('tipo') + ' — ' + val('mensaje'));
      out.innerHTML = '<p class="callout">No pudimos registrar tu solicitud en este momento. Puedes enviarla por <a target="_blank" rel="noopener">WhatsApp</a> y pedir tu número de radicado.</p>';
      out.querySelector('a').href = wa;
    } finally {
      btn.disabled = false; btn.textContent = 'Enviar solicitud';
      out.focus();
    }
  });
})();
