/* Pantalla "En construcción · Gran apertura".
   La tienda la muestra mientras el servidor diga que aún no abre (settings.apertura).
   Los productos y precios NO llegan al navegador antes de la hora: el servidor no los envía.
   Al llegar a cero, recarga y la tienda aparece. */
(function () {
  'use strict';
  var TZ = 'America/Bogota';
  var SHOE = 'M60 106 L58 44 Q58 22 80 22 L98 22 Q110 22 116 34 Q124 50 142 46 L178 34 Q188 31 194 40 L208 62 Q216 74 234 78 L258 84 Q284 90 286 103 L286 106 Z';
  var LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><rect x="4.5" y="10" width="15" height="11" rx="2.5" fill="currentColor"/></svg>';

  function fmt(d, o) { try { return new Intl.DateTimeFormat('es-CO', Object.assign({ timeZone: TZ }, o)).format(d); } catch (e) { return ''; } }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* Repisas con tenis a los lados (dibujados, no fotos de productos reales) */
  function shelf(side) {
    var cols = ['#f2f2f2', '#e9e9e9', '#f4f4f4', '#dcdcdc', '#efefef', '#e4e4e4'];
    var acc = ['#1f1f1f', '#3cff2a', '#d8262f', '#1f1f1f', '#3cff2a', '#1f1f1f'];
    var rows = '';
    for (var i = 0; i < 6; i++) {
      var y = 40 + i * 118;
      rows += '<g transform="translate(' + (side === 'l' ? 22 : 30) + ' ' + y + ') scale(.62)' + (side === 'l' ? '' : ' translate(300 0) scale(-1 1)') + '">' +
        '<rect x="52" y="108" width="236" height="12" rx="6" fill="#fafafa"/>' +
        '<path d="' + SHOE + '" fill="' + cols[i] + '"/>' +
        '<polygon points="118,98 134,98 166,56 150,56" fill="' + acc[i] + '"/></g>' +
        '<rect x="0" y="' + (y + 80) + '" width="240" height="4" fill="url(#apShelfGlow)"/>';
    }
    return '<svg class="ap__shelf ap__shelf--' + side + '" viewBox="0 0 240 760" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<defs><linearGradient id="apShelfGlow" x1="0" x2="1"><stop offset="0" stop-color="#3cff2a" stop-opacity=".9"/><stop offset="1" stop-color="#3cff2a" stop-opacity=".15"/></linearGradient></defs>' +
      rows + '</svg>';
  }

  /* Lona que cubre la tienda */
  var DRAPE = '<svg class="ap__drape" viewBox="0 0 1000 440" preserveAspectRatio="none" aria-hidden="true">' +
    '<defs>' +
    '<linearGradient id="apCloth" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2d2b"/><stop offset=".45" stop-color="#121413"/><stop offset="1" stop-color="#050605"/></linearGradient>' +
    '<linearGradient id="apSheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
    '<filter id="apSoft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter>' +
    '</defs>' +
    '<path d="M0 440 C55 400 85 340 112 262 C138 186 160 112 228 78 C320 36 420 26 500 26 C580 26 680 36 772 78 C840 112 862 186 888 262 C915 340 945 400 1000 440 Z" fill="url(#apCloth)"/>' +
    '<g filter="url(#apSoft)" fill="none" stroke="url(#apSheen)" stroke-linecap="round">' +
    '<path d="M240 90 C275 200 250 320 200 430" stroke-width="26"/>' +
    '<path d="M380 46 C410 170 395 300 350 430" stroke-width="18"/>' +
    '<path d="M520 30 C540 140 560 280 600 430" stroke-width="22"/>' +
    '<path d="M690 52 C700 170 740 300 800 430" stroke-width="20"/>' +
    '<path d="M790 92 C820 200 860 330 930 430" stroke-width="14"/>' +
    '<path d="M140 250 C300 330 700 330 860 250" stroke-width="10" opacity=".6"/>' +
    '</g>' +
    '<path d="M228 78 C320 36 420 26 500 26 C580 26 680 36 772 78" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="2"/>' +
    '</svg>';

  /* Cinta de seguridad con sus postes */
  var TAPE = '<svg class="ap__tape" viewBox="0 0 1000 260" preserveAspectRatio="none" aria-hidden="true">' +
    '<defs>' +
    '<pattern id="apStripes" width="44" height="44" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="44" height="44" fill="#0c0c0c"/><rect width="22" height="44" fill="#4dff2e"/></pattern>' +
    '<linearGradient id="apPost" x1="0" x2="1"><stop offset="0" stop-color="#0b0b0b"/><stop offset=".45" stop-color="#4a4d4b"/><stop offset="1" stop-color="#0b0b0b"/></linearGradient>' +
    '</defs>' +
    '<path d="M-40 118 Q60 74 132 66 Q500 150 868 66 Q940 74 1040 118" fill="none" stroke="url(#apStripes)" stroke-width="20"/>' +
    '<g><rect x="118" y="50" width="28" height="196" rx="8" fill="url(#apPost)"/><rect x="116" y="74" width="32" height="5" fill="#4dff2e"/><ellipse cx="132" cy="250" rx="46" ry="9" fill="#1b1d1c"/><rect x="114" y="42" width="36" height="14" rx="6" fill="#222"/></g>' +
    '<g><rect x="854" y="50" width="28" height="196" rx="8" fill="url(#apPost)"/><rect x="852" y="74" width="32" height="5" fill="#4dff2e"/><ellipse cx="868" cy="250" rx="46" ry="9" fill="#1b1d1c"/><rect x="850" y="42" width="36" height="14" rx="6" fill="#222"/></g>' +
    '</svg>';

  var HAT = '<svg class="ap__hat" viewBox="0 0 120 80" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round" stroke-linecap="round">' +
    '<path d="M20 56 C20 30 36 14 60 14 C84 14 100 30 100 56"/><path d="M50 15 L50 40 M70 15 L70 40"/><path d="M8 58 H112 V68 H8 Z"/></g></svg>';
  var CAL = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><g fill="currentColor"><rect x="6.5" y="13" width="3" height="2.4" rx=".6"/><rect x="10.5" y="13" width="3" height="2.4" rx=".6"/><rect x="14.5" y="13" width="3" height="2.4" rx=".6"/><rect x="6.5" y="16.6" width="3" height="2.4" rx=".6"/><rect x="10.5" y="16.6" width="3" height="2.4" rx=".6"/></g></svg>';
  var CLOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 6.5V12l3.6 2.4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  var WA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.3-.2Z"/></svg>';

  function show(iso, settings, onOpen) {
    var when = new Date(iso);
    if (isNaN(when)) return;
    var s = settings || {};
    var dia = fmt(when, { day: 'numeric', month: 'long' }).toUpperCase() || '16 DE NOVIEMBRE';
    var diaSem = fmt(when, { weekday: 'long' });
    var hora = fmt(when, { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s+/g, ' ').replace(/ /g, ' ').toUpperCase() || '12:00 A. M.';
    var wa = String(s.whatsapp || '').replace(/\D/g, '');
    var waHref = wa ? 'https://wa.me/' + wa + '?text=' + encodeURIComponent('Hola Punto Club 👋 Quiero saber más de la gran apertura del ' + dia.toLowerCase() + '.') : '';

    var el = document.createElement('section');
    el.className = 'ap'; el.id = 'apertura';
    el.setAttribute('aria-labelledby', 'apTitle');
    el.innerHTML =
      '<div class="ap__bg" aria-hidden="true"><i class="ap__glow"></i><i class="ap__beams"></i>' + shelf('l') + shelf('r') + '<i class="ap__floor"></i></div>' +
      '<header class="ap__top">' +
        '<span class="ap__logo"><img src="img/punto-club-blanco.png" alt="Punto Club Sneakers" width="179" height="38"></span>' +
        '<nav class="ap__nav" aria-label="Secciones (se abren en la gran apertura)">' +
          '<span class="ap__navi is-on">Inicio</span>' +
          ['Catálogo', 'Hombre', 'Mujer'].map(function (n) { return '<button type="button" class="ap__navi" data-ap-lock aria-disabled="true">' + LOCK + n + '</button>'; }).join('') +
        '</nav>' +
        (waHref ? '<a class="ap__wa" href="' + esc(waHref) + '" target="_blank" rel="noopener">' + WA + '<span>Escríbenos</span></a>' : '') +
      '</header>' +
      '<div class="ap__stage">' +
        '<div class="ap__sign"><img src="img/punto-club-blanco.png" alt="" width="179" height="38"><i class="ap__spot ap__spot--l"></i><i class="ap__spot ap__spot--r"></i></div>' +
        '<div class="ap__cover">' + DRAPE +
          '<div class="ap__cover-in">' + HAT +
            '<p class="ap__plate"><span>EN CONSTRUCCIÓN</span></p>' +
            '<i class="ap__hazard" aria-hidden="true"></i>' +
            '<p class="ap__sub">Estamos preparando<br>una mejor experiencia</p>' +
          '</div>' + TAPE +
        '</div>' +
        '<div class="ap__led" aria-hidden="true"><b class="ap__chev">///</b><span class="ap__ledtxt" id="apLed">EN PROCESO</span><b class="ap__chev">///</b></div>' +
      '</div>' +
      '<div class="ap__info">' +
        '<h1 class="ap__h" id="apTitle">Gran apertura</h1>' +
        '<p class="ap__date">' + CAL + '<span>' + esc(dia) + '</span></p>' +
        '<p class="ap__time"><i></i>' + CLOCK + '<span>' + esc(hora) + '</span><i></i></p>' +
        '<p class="ap__lbl">La tienda estará disponible en:</p>' +
        '<div class="ap__cd" role="timer" aria-live="off" id="apCd">' +
          '<div class="ap__box"><b data-u="d">00</b><small>Días</small></div><span class="ap__sep" aria-hidden="true">:</span>' +
          '<div class="ap__box"><b data-u="h">00</b><small>Horas</small></div><span class="ap__sep" aria-hidden="true">:</span>' +
          '<div class="ap__box"><b data-u="m">00</b><small>Minutos</small></div><span class="ap__sep" aria-hidden="true">:</span>' +
          '<div class="ap__box"><b data-u="s">00</b><small>Segundos</small></div>' +
        '</div>' +
        '<p class="ap__note">Abrimos el ' + esc(diaSem) + ' ' + esc(dia.toLowerCase()) + ' a las ' + esc(hora.toLowerCase()) + ' (hora de Colombia). Aquí mismo verás todos los modelos y precios.</p>' +
        '<p class="ap__toast" id="apToast" role="status" aria-live="polite"></p>' +
      '</div>';

    document.body.appendChild(el);
    document.documentElement.classList.add('ap-on');
    var app = document.getElementById('app');
    function lock() { if (app) { app.setAttribute('inert', ''); app.setAttribute('aria-hidden', 'true'); } }
    lock();
    // La pantalla de carga libera la tienda al terminar: la volvemos a bloquear
    window.addEventListener('kairo:ready', function () { lock(); setTimeout(lock, 50); });
    document.title = 'Gran apertura · ' + (s.storeName || 'Punto Club');

    /* Secciones bloqueadas */
    var toast = el.querySelector('#apToast'), tt;
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ap-lock]'); if (!b) return;
      b.classList.remove('is-shake'); void b.offsetWidth; b.classList.add('is-shake');
      toast.textContent = b.textContent.trim() + ' se abre el ' + dia.toLowerCase() + ' a las ' + hora.toLowerCase().replace(/\.?$/, '.');
      toast.classList.add('on'); clearTimeout(tt); tt = setTimeout(function () { toast.classList.remove('on'); }, 2600);
    });

    /* Letrero LED: alterna mensajes */
    var msgs = ['EN PROCESO', 'GRAN APERTURA', dia.replace(' DE ', ' ').slice(0, 14), 'MUY PRONTO'], mi = 0, led = el.querySelector('#apLed');
    var ledT = setInterval(function () {
      mi = (mi + 1) % msgs.length;
      led.classList.add('off');
      setTimeout(function () { led.textContent = msgs[mi]; led.classList.remove('off'); }, 260);
    }, 3200);

    /* Cuenta regresiva */
    var cells = {}; ['d', 'h', 'm', 's'].forEach(function (u) { cells[u] = el.querySelector('[data-u="' + u + '"]'); });
    var cd = el.querySelector('#apCd'), lastMin = -1, opened = false;
    function tick() {
      var ms = when.getTime() - Date.now();
      if (ms <= 0) {
        ['d', 'h', 'm', 's'].forEach(function (u) { cells[u].textContent = '00'; });
        if (!opened) { opened = true; clearInterval(ledT); led.textContent = '¡ABRIMOS!'; el.classList.add('is-open'); setTimeout(onOpen || function () { location.reload(); }, 1400); }
        return;
      }
      var t = Math.floor(ms / 1000), d = Math.floor(t / 86400), h = Math.floor(t % 86400 / 3600), m = Math.floor(t % 3600 / 60), sec = t % 60;
      var v = { d: pad(d), h: pad(h), m: pad(m), s: pad(sec) };
      for (var u in v) if (cells[u].textContent !== v[u]) { cells[u].textContent = v[u]; if (u !== 's' || !matchMedia('(prefers-reduced-motion: reduce)').matches) { cells[u].classList.remove('tick'); void cells[u].offsetWidth; cells[u].classList.add('tick'); } }
      if (m !== lastMin) { lastMin = m; cd.setAttribute('aria-label', 'Faltan ' + d + ' días, ' + h + ' horas y ' + m + ' minutos'); }
    }
    tick(); setInterval(tick, 1000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
  }

  /* Aviso discreto para el administrador que revisa la tienda antes de abrir */
  function preview(iso) {
    var d = new Date(iso); if (isNaN(d)) return;
    var b = document.createElement('div');
    b.className = 'ap-preview'; b.setAttribute('role', 'status');
    b.innerHTML = '<b>Vista previa del administrador.</b> Los clientes ven «En construcción» hasta el ' +
      esc(fmt(d, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', hour12: true })) + '. Aún no pueden comprar.';
    document.body.appendChild(b);
  }

  window.PCApertura = { show: show, preview: preview };
})();
