  /* El seguimiento ahora vive dentro de la tienda, en "Mis pedidos".
     Esta página solo redirige (los enlaces viejos y los de WhatsApp siguen funcionando). */
  (function () {
    var p = new URLSearchParams(location.search), q = new URLSearchParams();
    if (p.get('pedido')) q.set('pedido', p.get('pedido'));
    if (p.get('c')) q.set('c', p.get('c'));
    var s = q.toString();
    location.replace('/' + (s ? '?' + s : '') + '#pedidos');
  })();
