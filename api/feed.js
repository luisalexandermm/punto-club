'use strict';
/* GET /feed.xml — catálogo de productos para Google Merchant Center (RSS 2.0 con atributos g:).
   En Merchant Center: Productos → Fuentes → Agregar fuente → Archivo (URL) → https://TU-DOMINIO/feed.xml
   Cada color de un modelo es un producto aparte (mismo item_group_id), con su propia foto.
   Los productos sin foto no se envían: Google exige una imagen real del producto. */
const supabase = require('../lib/supabase');
const { productPrice, isLive, productLive } = require('../lib/pricing');
const { loadEnvio } = require('../lib/envios');
const { siteUrl } = require('../lib/wompi');

const xml = s => String(s == null ? '' : s)
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const cop = n => `${Math.round(Number(n) || 0)}.00 COP`;
const GENERO = { hombre: 'male', mujer: 'female', unisex: 'unisex', 'niño': 'unisex', 'niña': 'unisex' };

module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.statusCode = 405; return res.end(); }
  const base = siteUrl(req);
  const abs = u => { const s = String(u || '').trim(); return /^https:\/\//.test(s) ? s : /^\/[^\s]*$/.test(s) ? base + s : ''; };

  const [{ data: products, error: pe }, { data: promos, error: me }, envio] = await Promise.all([
    supabase.from('products').select('*').eq('active', true).order('position'),
    supabase.from('promos').select('*').eq('active', true),
    loadEnvio(supabase)
  ]);
  if (pe || me) { res.statusCode = 500; res.setHeader('Content-Type', 'text/plain; charset=utf-8'); return res.end('Error al leer la base de datos'); }

  const now = new Date();
  const live = (promos || []).filter(p => isLive(p, now));
  const items = [];

  const cerrada = require('../lib/apertura').cerrada(now);
  for (const p of cerrada ? [] : (products || []).filter(x => productLive(x, now))) {
    const pr = productPrice(p, live, now);
    const titulo = [p.brand, p.name].filter(Boolean).join(' ').replace(new RegExp('^(' + String(p.brand || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')\\s+\\1\\b', 'i'), '$1');
    const categoria = p.category || (p.shape === 's-boot' ? 'Botas' : 'Tenis');
    const desc = String(p.description || '').trim() || `${titulo}. ${categoria}${p.gender && !/unisex/i.test(p.gender) ? ' para ' + String(p.gender).toLowerCase() : ''}. Envío a toda Colombia.`;
    const colores = Array.isArray(p.colors) && p.colors.length ? p.colors : [null];
    const enStock = Number(p.stock) > 0;

    for (const c of colores) {
      const img = abs((c && c.image) || p.image);
      if (!img) continue;
      const tallas = c && Array.isArray(c.sizes) && c.sizes.length ? c.sizes : p.sizes || [];
      const id = c && colores.length > 1 ? `${p.id}-${c.n}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').slice(0, 50) : String(p.id).slice(0, 50);
      const link = `${base}/?producto=${encodeURIComponent(p.id)}${c && colores.length > 1 ? '&color=' + encodeURIComponent(c.n) : ''}`;
      const extra = p.colors && p.colors.length > 1 ? p.colors.map(x => abs(x && x.image)).filter(u => u && u !== img).slice(0, 10) : [];
      items.push(`<item>
<g:id>${xml(id)}</g:id>
<g:title>${xml((titulo + (c && colores.length > 1 ? ' ' + c.n : '')).slice(0, 150))}</g:title>
<g:description>${xml(desc.slice(0, 5000))}</g:description>
<g:link>${xml(link)}</g:link>
<g:image_link>${xml(img)}</g:image_link>
${extra.map(u => `<g:additional_image_link>${xml(u)}</g:additional_image_link>`).join('\n')}
<g:availability>${enStock && tallas.length ? 'in_stock' : 'out_of_stock'}</g:availability>
<g:price>${cop(pr.list)}</g:price>
${pr.final < pr.list ? `<g:sale_price>${cop(pr.final)}</g:sale_price>` : ''}
<g:brand>${xml(p.brand || 'Punto Club')}</g:brand>
<g:condition>new</g:condition>
<g:identifier_exists>no</g:identifier_exists>
<g:google_product_category>187</g:google_product_category>
<g:product_type>${xml(categoria + (p.gender ? ' > ' + p.gender : ''))}</g:product_type>
<g:age_group>adult</g:age_group>
<g:gender>${GENERO[String(p.gender || 'unisex').toLowerCase()] || 'unisex'}</g:gender>
${c ? `<g:color>${xml(c.n)}</g:color>` : ''}
<g:item_group_id>${xml(String(p.id).slice(0, 50))}</g:item_group_id>
<g:shipping><g:country>CO</g:country><g:price>${cop(envio)}</g:price></g:shipping>
</item>`.replace(/\n{2,}/g, '\n'));
    }
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>Punto Club</title>
<link>${xml(base)}/</link>
<description>Catálogo de Punto Club</description>
${items.join('\n')}
</channel>
</rss>
`;
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=900');
  res.end(req.method === 'HEAD' ? '' : body);
};
