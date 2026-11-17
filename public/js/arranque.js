/* La pantalla de carga se muestra en cada apertura (web y PWA).
   Si /js/loader.js no llega a cargar, este respaldo la quita a los 6 s. */
document.documentElement.classList.add('k-loading');
setTimeout(function () {
  if (window.KairoLoader) return;
  var l = document.getElementById('kLoader'); if (l) l.remove();
  document.documentElement.classList.remove('k-loading');
  var a = document.getElementById('app'); if (a) a.removeAttribute('inert');
  window.dispatchEvent(new Event('kairo:ready'));
}, 6000);

/* Antes estaban escritos dentro del HTML (onerror / onsubmit). Ahora viven aquí para que la
   política de seguridad pueda bloquear cualquier código insertado en la página. */
// Si el logo no carga, se muestra el nombre en texto
document.addEventListener('error', function (e) {
  var t = e.target;
  if (t && t.tagName === 'IMG' && t.parentNode && t.parentNode.classList && t.parentNode.classList.contains('brand')) t.parentNode.classList.add('brand--txt');
}, true);
// El buscador filtra mientras se escribe: Enter no debe recargar la página
document.addEventListener('submit', function (e) { if (e.target && e.target.id === 'searchForm') e.preventDefault(); }, true);

/* ---------- Modo oscuro ----------
   Se aplica aquí (en el <head>, antes de pintar) para que no haya un destello blanco.
   La elección de cada cliente se guarda en su celular; sin elección, la tienda arranca en claro. */
(function () {
  var K = 'kairo.tema';
  var root = document.documentElement;
  function guardado() { try { return localStorage.getItem(K); } catch (e) { return null; } }
  function aplicar(t) {
    var dark = t === 'dark';
    if (dark) root.setAttribute('data-theme', 'dark'); else root.removeAttribute('data-theme');
    var cs = document.querySelector('meta[name="color-scheme"]'); if (cs) cs.setAttribute('content', dark ? 'dark' : 'only light');
    var b = document.getElementById('themeFab');
    if (b) { b.setAttribute('aria-pressed', dark ? 'true' : 'false'); b.setAttribute('aria-label', dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'); }
  }
  aplicar(guardado());
  document.addEventListener('DOMContentLoaded', function () { aplicar(guardado()); });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#themeFab'); if (!b) return;
    var t = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(K, t); } catch (x) { }
    aplicar(t);
  });
})();
