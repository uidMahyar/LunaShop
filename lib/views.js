'use strict';
const U = require('./util');
const shop = require('./shop');
const { esc, money, pn } = U;
const { byOrder, pinfo } = shop;

const ICON = {
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
  bag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>',
};
const u = encodeURIComponent;
const PH = '/static/img/ph.svg';
const jsonEmbed = o => JSON.stringify(o).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

/* ---------- زمینه‌ی رندر ---------- */
function makeCtx(db, { codes = false } = {}) {
  const S = db.settings();
  const tmap = new Map(db.col('texts').map(t => [t.key, t]));
  const raw = (k, vars) => {
    const t = tmap.get(k);
    let v = t ? t.value : k;
    if (vars) for (const x of Object.keys(vars)) v = v.split(`{${x}}`).join(vars[x]);
    return v;
  };
  const wrap = (s, code) => (codes && code ? `<span class="cw" data-c="${code}">${s}</span>` : s);
  const T = (k, vars) => wrap(esc(raw(k, vars)), tmap.get(k) && tmap.get(k).code);
  const N = (rec, f = 'name') => wrap(esc(rec[f]), rec.code);
  const cats = db.col('categories').filter(c => c.active !== false).sort(byOrder);
  const menu = m => db.col('menu_items').filter(i => i.menu === m && i.active !== false).sort(byOrder);
  return { db, S, T, raw, N, cats, menu, codes, cur: raw('currency') };
}

const descendants = (cats, id) => {
  const out = [id];
  for (let i = 0; i < out.length; i++) for (const c of cats) if (c.parent === out[i] && !out.includes(c.id)) out.push(c.id);
  return out;
};
const imgOf = p => (p.images && p.images[0]) || PH;
const priceLine = (c, i) => `${i.onSale ? `<s class="was">${money(i.regular)}</s>` : ''}<span class="now">${i.range ? c.T('price_from') + ' ' : ''}${money(i.min)}</span> <small>${esc(c.cur)}</small>`;

/* ---------- قالب کلی ---------- */
function socialUrl(kind, v) {
  v = String(v || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  v = v.replace(/^@/, '');
  if (kind === 'instagram') return 'https://instagram.com/' + v;
  if (kind === 'telegram') return 'https://t.me/' + v;
  if (kind === 'eitaa') return 'https://eitaa.com/' + v;
  if (kind === 'whatsapp') return 'https://wa.me/' + U.normPhone(v).replace(/^0/, '98').replace(/\D/g, '');
  return '';
}

function layout(c, o = {}) {
  const S = c.S, th = S.theme, site = c.raw('site_name');
  const title = o.title ? `${o.title} | ${site}` : (S.seo.title || `${site} - ${c.raw('site_slogan')}`);
  const desc = o.desc || S.seo.description || c.raw('site_slogan');
  const top = c.cats.filter(x => !x.parent);
  const nav = c.menu('header').map(i => `<a href="${esc(i.url)}"${i.newTab ? ' target="_blank" rel="noopener"' : ''}>${c.N(i, 'label')}</a>`).join('');
  const catnav = S.shop.catsInHeader ? top.map(x => `<a href="/category/${u(x.slug)}">${c.N(x)}</a>`).join('') : '';
  const drawerCats = top.map(x => `<a href="/category/${u(x.slug)}">${c.N(x)}</a>`).join('');
  const fmenu = c.menu('footer').map(i => `<a href="${esc(i.url)}">${c.N(i, 'label')}</a>`).join('');
  const ct = S.contact;
  const contact = [
    ct.phone && `<div>${c.T('footer_phone_label')}: <a href="tel:${esc(ct.phone)}" dir="ltr">${esc(ct.phone)}</a></div>`,
    ct.email && `<div>${c.T('footer_email_label')}: <a href="mailto:${esc(ct.email)}" dir="ltr">${esc(ct.email)}</a></div>`,
    ct.address && `<div>${c.T('footer_address_label')}: ${esc(ct.address)}</div>`,
    ct.hours && `<div>${esc(ct.hours)}</div>`,
  ].filter(Boolean).join('');
  const social = Object.entries(S.social).map(([k, v]) => { const h = socialUrl(k, v); return h ? `<a href="${esc(h)}" target="_blank" rel="noopener">${({ instagram: 'اینستاگرام', telegram: 'تلگرام', whatsapp: 'واتس‌اپ', eitaa: 'ایتا' })[k]}</a>` : ''; }).join('');
  const brand = th.logo ? `<img src="${esc(th.logo)}" alt="${esc(site)}" class="logo">` : c.T('site_name');
  return `<!doctype html>
<html lang="fa" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc).slice(0, 300)}">
${o.noindex ? '<meta name="robots" content="noindex,nofollow">' : ''}
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc).slice(0, 200)}">
${o.image ? `<meta property="og:image" content="${esc(o.image)}">` : ''}
${th.favicon ? `<link rel="icon" href="${esc(th.favicon)}">` : ''}
<link rel="stylesheet" href="/static/css/store.css?v=${o.ver}">
<style>:root{--primary:${th.primary};--accent:${th.accent};--sale:${th.sale};--r:${+th.radius || 0}px}</style>
</head><body class="${c.codes ? 'codes' : ''}">
${c.raw('topbar') || c.codes ? `<div class="topbar">${c.T('topbar')}</div>` : ''}
<header class="hd">
  <div class="wrap hd-row">
    <button class="ibtn menu-btn" type="button" data-open="drawer" aria-label="منو">${ICON.menu}</button>
    <a class="brand" href="/">${brand}</a>
    <form class="search" action="/search" role="search"><input name="q" value="${esc(o.q || '')}" placeholder="${esc(c.raw('search_ph'))}" aria-label="${esc(c.raw('search_ph'))}"><button type="submit" aria-label="جستجو">${ICON.search}</button></form>
    <a class="cart-link" href="/cart">${ICON.bag}<span class="cl-t">${c.T('cart_link')}</span><b class="cnt" data-cart-count hidden>0</b></a>
  </div>
  ${nav ? `<nav class="wrap nav" aria-label="منو">${nav}</nav>` : ''}
  ${catnav ? `<nav class="wrap catnav" aria-label="دسته‌ها">${catnav}</nav>` : ''}
</header>
<div class="drawer" id="drawer"><div class="panel">
  <button class="ibtn" type="button" data-close="drawer" aria-label="بستن">${ICON.close}</button>
  <div class="dnav">${nav}</div>
  ${drawerCats ? `<div class="dh">${c.T('menu_cats')}</div><div class="dnav">${drawerCats}</div>` : ''}
</div></div>
<main class="wrap main">${o.body}</main>
<footer class="ft"><div class="wrap">
  <div class="ft-cols">
    <div><h3>${c.T('footer_about_title')}</h3><p>${c.T('footer_about_text')}</p></div>
    <div><h3>${c.T('footer_links_title')}</h3><div class="ft-links">${fmenu}</div></div>
    <div><h3>${c.T('footer_contact_title')}</h3>${contact}<div class="ft-social">${social}</div></div>
  </div>
  <div class="ft-copy">${c.T('footer_copy')}</div>
</div></footer>
${c.codes ? '<a class="codes-off" href="?codes=0">حالت نمایش کدها روشن است — خاموش کردن</a>' : ''}
<script src="/static/js/store.js?v=${o.ver}" defer></script>
</body></html>`;
}

const crumbs = (c, items) => `<nav class="crumbs" aria-label="مسیر"><a href="/">${c.T('breadcrumb_home')}</a>${items.map(i => `<span>›</span>${i.url ? `<a href="${i.url}">${i.label}</a>` : `<span>${i.label}</span>`}`).join('')}</nav>`;

/* ---------- کارت و شبکه‌ی محصول ---------- */
function card(c, p) {
  const i = pinfo(p);
  const tags = (i.onSale && i.inStock ? `<span class="tag">${c.T('badge_sale')}</span>` : '') + (!i.inStock ? `<span class="tag out">${c.T('badge_out')}</span>` : '');
  return `<a class="card" href="/product/${u(p.slug)}"><div class="ph"><img src="${esc(imgOf(p))}" alt="${esc(p.title)}" loading="lazy">${tags}</div><div class="ct">${c.N(p, 'title')}</div><div class="pr">${priceLine(c, i)}</div></a>`;
}
const grid = (c, list) => `<div class="grid">${list.map(p => card(c, p)).join('')}</div>`;
const section = (c, titleKey, list, more) => list.length ? `<section><div class="sec-h"><h2>${c.T(titleKey)}</h2>${more ? `<a href="${more}">${c.T('view_all')}</a>` : ''}</div>${grid(c, list)}</section>` : '';

/* ---------- صفحه‌ی اصلی ---------- */
function home(c) {
  const banners = c.db.col('banners').filter(b => b.active !== false).sort(byOrder);
  const top = c.cats.filter(x => !x.parent);
  const pubs = shop.live(c.db);
  const featured = pubs.filter(p => p.featured).slice(0, 8);
  const latest = [...pubs].sort((a, b) => b.id - a.id).slice(0, 8);
  const slides = banners.map(b => {
    const tag = b.link ? 'a' : 'div';
    return `<${tag} class="slide${b.image ? ' has-img' : ''}" style="background:${esc(b.bg || '#1b1f2a')}"${b.link ? ` href="${esc(b.link)}"` : ''}>${b.image ? `<img src="${esc(b.image)}" alt="" loading="lazy">` : ''}<div class="slide-t"><h2>${c.N(b, 'title')}</h2>${b.subtitle ? `<p>${esc(b.subtitle)}</p>` : ''}${b.buttonText ? `<span class="btn alt">${esc(b.buttonText)}</span>` : ''}</div></${tag}>`;
  }).join('');
  const hero = banners.length ? `<section class="hero" data-slider><div class="slides">${slides}</div>${banners.length > 1 ? `<div class="dots">${banners.map((_, i) => `<button type="button" aria-label="${pn(i + 1)}"></button>`).join('')}</div>` : ''}</section>` : '';
  const rail = top.length ? `<section><div class="sec-h"><h2>${c.T('home_cats_title')}</h2></div><div class="rail">${top.map(x => `<a href="/category/${u(x.slug)}"><span class="circ">${x.image ? `<img src="${esc(x.image)}" alt="" loading="lazy">` : esc([...x.name][0] || '•')}</span>${c.N(x)}</a>`).join('')}</div></section>` : '';
  return { title: '', body: hero + rail + section(c, 'home_featured_title', featured, '/shop') + section(c, 'home_new_title', latest, '/shop') };
}

/* ---------- لیست محصولات / جستجو ---------- */
function listing(c, q, o) {
  const S = c.S, cat = o.cat;
  let list = shop.live(c.db);
  if (cat) { const ids = descendants(c.cats, cat.id); list = list.filter(p => (p.categories || []).some(i => ids.includes(i))); }
  const text = U.str(q.q, 80), nt = U.norm(text);
  if (nt) list = list.filter(p => U.norm(`${p.title} ${p.sku} ${p.shortDesc}`).includes(nt));
  const min = U.int(q.min, 0), max = U.int(q.max, 0), onlyStock = q.stock === '1' || !S.shop.showOutOfStock;
  if (min) list = list.filter(p => pinfo(p).min >= min);
  if (max) list = list.filter(p => pinfo(p).min <= max);
  if (onlyStock) list = list.filter(p => pinfo(p).inStock);
  const sort = ['new', 'cheap', 'pricey'].includes(q.sort) ? q.sort : 'new';
  list.sort(sort === 'cheap' ? (a, b) => pinfo(a).min - pinfo(b).min : sort === 'pricey' ? (a, b) => pinfo(b).min - pinfo(a).min : (a, b) => b.id - a.id);
  const per = S.shop.perPage, pages = Math.max(1, Math.ceil(list.length / per)), page = U.clamp(U.int(q.page, 1), 1, pages);
  const slice = list.slice((page - 1) * per, page * per);
  const base = o.path;
  const link = extra => { const p = new URLSearchParams(); const all = { q: text, min: min || '', max: max || '', stock: q.stock === '1' ? '1' : '', sort: sort === 'new' ? '' : sort, ...extra }; for (const [k, v] of Object.entries(all)) if (v) p.set(k, v); const s = p.toString(); return base + (s ? '?' + s : ''); };

  const subs = cat ? c.cats.filter(x => x.parent === cat.id) : [];
  const tree = parent => c.cats.filter(x => (x.parent || 0) === parent).map(x => `<li><a href="/category/${u(x.slug)}"${cat && cat.id === x.id ? ' class="on"' : ''}>${c.N(x)}</a>${c.cats.some(y => y.parent === x.id) && cat && descendants(c.cats, x.id).includes(cat.id) ? `<ul>${tree(x.id)}</ul>` : ''}</li>`).join('');
  const filters = `<details class="flt" ${(min || max || q.stock) ? 'open' : ''}><summary>${c.T('filter_title')}</summary>
    <form method="get" action="${base}">
      ${text ? `<input type="hidden" name="q" value="${esc(text)}">` : ''}${sort !== 'new' ? `<input type="hidden" name="sort" value="${sort}">` : ''}
      <div class="fg"><b>${c.T('filter_price')}</b><div class="two"><input name="min" inputmode="numeric" placeholder="${esc(c.raw('filter_min'))}" value="${min || ''}"><input name="max" inputmode="numeric" placeholder="${esc(c.raw('filter_max'))}" value="${max || ''}"></div></div>
      <label class="chk"><input type="checkbox" name="stock" value="1" ${q.stock === '1' ? 'checked' : ''}> ${c.T('filter_only_stock')}</label>
      <div class="two"><button class="btn" type="submit">${c.T('filter_apply')}</button><a class="btn alt" href="${base}${text ? '?q=' + u(text) : ''}">${c.T('filter_clear')}</a></div>
    </form></details>`;
  const side = `<aside class="side">${filters}${c.cats.length ? `<div class="fg"><b>${c.T('filter_cats')}</b><ul class="ctree">${tree(0)}</ul></div>` : ''}</aside>`;
  const sortSel = `<div class="sorts"><span>${c.T('sort_label')}:</span>${[['new', 'sort_new'], ['cheap', 'sort_cheap'], ['pricey', 'sort_pricey']].map(([k, t]) => `<a href="${link({ sort: k === 'new' ? '' : k, page: '' })}"${sort === k ? ' class="on"' : ''}>${c.T(t)}</a>`).join('')}</div>`;
  const pager = pages > 1 ? `<nav class="pager">${page > 1 ? `<a href="${link({ page: page - 1 })}">${c.T('page_prev')}</a>` : ''}${Array.from({ length: pages }, (_, i) => i + 1).filter(n => n === 1 || n === pages || Math.abs(n - page) <= 2).map((n, i, a) => `${i && n - a[i - 1] > 1 ? '<span>…</span>' : ''}<a href="${link({ page: n })}"${n === page ? ' class="on"' : ''}>${pn(n)}</a>`).join('')}${page < pages ? `<a href="${link({ page: page + 1 })}">${c.T('page_next')}</a>` : ''}</nav>` : '';
  const heading = o.search ? `${c.T('search_title')}${text ? `: «${esc(text)}»` : ''}` : cat ? c.N(cat) : c.T('shop_title');
  const trail = cat ? [...(cat.parent && c.cats.find(x => x.id === cat.parent) ? [{ label: esc(c.cats.find(x => x.id === cat.parent).name), url: `/category/${u(c.cats.find(x => x.id === cat.parent).slug)}` }] : []), { label: esc(cat.name) }] : [{ label: esc(o.search ? c.raw('search_title') : c.raw('shop_title')) }];
  return {
    title: o.search ? c.raw('search_title') : cat ? (cat.metaTitle || cat.name) : c.raw('shop_title'), desc: cat && (cat.metaDesc || cat.description), noindex: !!o.search, q: text,
    body: `${crumbs(c, trail)}<div class="lst">${side}<div><div class="lst-h"><h1>${heading}</h1><span class="muted">${pn(list.length)}</span></div>
      ${cat && cat.description ? `<p class="muted">${esc(cat.description)}</p>` : ''}
      ${subs.length ? `<div class="chips">${subs.map(x => `<a href="/category/${u(x.slug)}">${c.N(x)}</a>`).join('')}</div>` : ''}
      ${sortSel}${slice.length ? grid(c, slice) : `<p class="empty">${c.T('no_products')}</p>`}${pager}</div></div>`,
  };
}

/* ---------- صفحه‌ی محصول ---------- */
function product(c, p) {
  const info = pinfo(p);
  const imgs = p.images && p.images.length ? p.images : [PH];
  const pcats = (p.categories || []).map(id => c.cats.find(x => x.id === id)).filter(Boolean);
  const first = pcats[0];
  const variants = info.variable ? p.variants.filter(v => v.active !== false).map(v => { const pr = shop.vPrice(p, v); return { id: v.id, combo: v.combo, price: pr.final, regular: pr.regular, stock: v.stock }; }) : [];
  const pdata = {
    id: p.id, variable: info.variable, options: info.variable ? p.options : [], variants, price: info.min, regular: info.regular, stock: p.stock,
    msgs: { need: c.raw('need_options'), unavail: c.raw('unavailable_combo'), low: c.raw('low_stock'), added: c.raw('added_ok'), out: c.raw('badge_out'), add: c.raw('add_to_cart') }, from: info.range ? c.raw('price_from') : '',
  };
  const opts = info.variable ? p.options.map(o => `<div class="optg" data-opt="${esc(o.name)}"><div class="optl">${esc(o.name)}</div><div class="opts">${o.values.map(v => `<button type="button" class="opt" data-val="${esc(v)}" aria-pressed="false">${esc(v)}</button>`).join('')}</div></div>`).join('') : '';
  const lowN = !info.variable && p.stock != null && p.stock > 0 && p.stock <= c.S.shop.lowStock ? `<div class="lowstock">${c.T('low_stock', { n: pn(p.stock) })}</div>` : '';
  const specs = (p.specs || []).length ? `<section class="blk"><h2>${c.T('tab_specs')}</h2><table class="specs">${p.specs.map(s => `<tr><th>${esc(s.k)}</th><td>${esc(s.v)}</td></tr>`).join('')}</table></section>` : '';
  const related = shop.live(c.db).filter(x => x.id !== p.id && first && (x.categories || []).includes(first.id)).slice(0, 4);
  const trail = [...(first ? [{ label: esc(first.name), url: `/category/${u(first.slug)}` }] : []), { label: esc(p.title) }];
  return {
    title: p.metaTitle || p.title, desc: p.metaDesc || p.shortDesc, image: imgs[0] !== PH ? imgs[0] : '',
    body: `${crumbs(c, trail)}
    <article class="pd">
      <div class="gal"><div class="gal-main"><img id="gmain" src="${esc(imgs[0])}" alt="${esc(p.title)}"></div>${imgs.length > 1 ? `<div class="thumbs">${imgs.map((s, i) => `<button type="button" class="thumb${i ? '' : ' on'}" data-src="${esc(s)}"><img src="${esc(s)}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}</div>
      <div class="pi">
        <h1>${c.N(p, 'title')}</h1>
        <div class="meta">${p.sku ? `<span>${c.T('product_sku')}: <b dir="ltr">${esc(p.sku)}</b></span>` : ''}${pcats.length ? `<span>${c.T('product_cats')}: ${pcats.map(x => `<a href="/category/${u(x.slug)}">${esc(x.name)}</a>`).join('، ')}</span>` : ''}</div>
        ${p.shortDesc ? `<p class="short">${esc(p.shortDesc)}</p>` : ''}
        <div class="pdp-price" id="pprice">${priceLine(c, info)}</div>
        ${opts}
        <div class="buy"><div class="qty"><button type="button" data-q="-1" aria-label="-">−</button><input type="number" id="qty" value="1" min="1" max="99" aria-label="${esc(c.raw('product_qty'))}"><button type="button" data-q="1" aria-label="+">+</button></div>
          <button class="btn buy-btn" id="add" type="button" ${info.inStock ? '' : 'disabled'}>${info.inStock ? c.T('add_to_cart') : c.T('badge_out')}</button></div>
        <div id="pmsg" class="pmsg" role="status"></div>${lowN}
      </div>
    </article>
    ${p.desc ? `<section class="blk"><h2>${c.T('tab_desc')}</h2><div class="rich">${p.desc}</div></section>` : ''}
    ${specs}
    ${p.sizeChart ? `<section class="blk"><h2>${c.T('tab_size')}</h2><div class="rich scroll-x">${p.sizeChart}</div></section>` : ''}
    ${related.length ? section(c, 'related_title', related) : ''}
    <script type="application/json" id="pdata">${jsonEmbed(pdata)}</script>`,
  };
}

/* ---------- سبد و پرداخت ---------- */
const labelsJson = (c, keys) => `<script type="application/json" id="labels">${jsonEmbed(Object.fromEntries(keys.map(k => [k, c.raw(k)])))}</script>`;

function cart(c) {
  const keys = ['cart_empty', 'cart_continue', 'cart_remove', 'cart_product', 'cart_price', 'cart_sum', 'cart_subtotal', 'cart_discount', 'cart_shipping', 'cart_total', 'coupon_label', 'coupon_apply', 'coupon_ok', 'free_word', 'go_checkout', 'badge_out', 'currency', 'low_stock', 'err_generic'];
  return { title: c.raw('cart_title'), noindex: true, body: `${crumbs(c, [{ label: c.T('cart_title') }])}<h1>${c.T('cart_title')}</h1><div id="cart-root" class="cart-root"></div><noscript><p class="empty">برای استفاده از سبد خرید جاوااسکریپت را فعال کنید.</p></noscript>${labelsJson(c, keys)}` };
}

function checkout(c) {
  const S = c.S;
  const keys = ['cart_empty', 'cart_continue', 'cart_subtotal', 'cart_discount', 'cart_shipping', 'cart_total', 'free_word', 'currency', 'ship_title', 'place_order', 'err_generic', 'cart_product'];
  const f = (id, k, extra = '') => `<label class="fld"><span>${c.T(k)}</span><input id="${id}" name="${id}" ${extra}></label>`;
  const pays = ['cod', 'card'].filter(m => S.payments[m].enabled).map((m, i) => `<label class="radio"><input type="radio" name="payment" value="${m}" ${i ? '' : 'checked'}> ${esc(S.payments[m].title)}</label>`).join('');
  return {
    title: c.raw('checkout_title'), noindex: true,
    body: `${crumbs(c, [{ label: c.T('cart_title'), url: '/cart' }, { label: c.T('checkout_title') }])}<h1>${c.T('checkout_title')}</h1>
    <div class="co"><form id="co-form" class="co-form" novalidate>
      ${f('name', 'f_name', 'autocomplete="name" required')}${f('phone', 'f_phone', 'type="tel" inputmode="tel" dir="ltr" autocomplete="tel" placeholder="09xxxxxxxxx" required')}
      <div class="two">${f('province', 'f_province', 'required')}${f('city', 'f_city', 'required')}</div>
      <label class="fld"><span>${c.T('f_address')}</span><textarea id="address" name="address" rows="3" required></textarea></label>
      <div class="two">${f('postal', 'f_postal', 'inputmode="numeric" dir="ltr"')}${f('email', 'f_email', 'type="email" dir="ltr"')}</div>
      <label class="fld"><span>${c.T('f_note')}</span><textarea id="note" name="note" rows="2"></textarea></label>
      <h3>${c.T('ship_title')}</h3><div id="ship-list" class="radios"></div>
      <h3>${c.T('pay_title')}</h3><div class="radios">${pays || '<p class="empty">روش پرداختی فعال نیست.</p>'}</div>
      <div id="co-err" class="err" role="alert"></div>
      <button class="btn big" id="co-btn" type="submit">${c.T('place_order')}</button>
    </form><aside class="sum" id="co-sum"></aside></div>${labelsJson(c, keys)}`,
  };
}

function done(c, order) {
  const S = c.S;
  const card = order.payment.method === 'card' ? `<div class="notice"><p>${c.T('success_card')}</p>${S.payments.card.number ? `<div class="cardno" dir="ltr">${esc(S.payments.card.number)}</div>` : ''}${S.payments.card.owner ? `<div>${esc(S.payments.card.owner)}</div>` : ''}<div><b>${money(order.total)}</b> ${esc(c.cur)}</div></div>` : '';
  return {
    title: c.raw('success_title'), noindex: true,
    body: `<div class="done"><h1>${c.T('success_title')}</h1><p>${c.T('success_text')}</p>
      <div class="trk"><span>${c.T('success_code')}</span><b dir="ltr">${esc(order.tracking)}</b></div>
      <div class="muted">${pn(order.number)} · ${U.jd(order.createdAt)}</div>${card}
      <a class="btn alt" href="/track?code=${u(order.tracking)}">${c.T('track_title')}</a> <a class="btn" href="/">${c.T('back_home')}</a></div>`,
  };
}

function track(c, q) {
  const code = U.str(q.code, 20).toUpperCase(), phone = U.normPhone(q.phone);
  let result = '';
  if (code && phone) {
    const o = c.db.col('orders').find(x => x.tracking === code && x.customer.phone === phone);
    if (!o) result = `<p class="err">${c.T('track_notfound')}</p>`;
    else {
      const hist = o.history.map(h => `<li><b>${c.T('st_' + h.s)}</b><span>${U.jd(h.at)}</span></li>`).join('');
      const items = o.items.map(i => `<li>${esc(i.title)}${i.variant ? ` (${esc(i.variant)})` : ''} × ${pn(i.qty)}</li>`).join('');
      result = `<div class="trk-res"><div class="trk"><span>${c.T('track_status')}</span><b>${c.T('st_' + o.status)}</b></div><ol class="tl">${hist}</ol><ul class="items">${items}</ul><div><b>${c.T('cart_total')}:</b> ${money(o.total)} ${esc(c.cur)}</div></div>`;
    }
  }
  return {
    title: c.raw('track_title'), noindex: true,
    body: `<h1>${c.T('track_title')}</h1><form class="trk-form" method="get" action="/track"><label class="fld"><span>${c.T('track_code')}</span><input name="code" value="${esc(code)}" dir="ltr" required></label><label class="fld"><span>${c.T('f_phone')}</span><input name="phone" value="${esc(phone)}" dir="ltr" inputmode="tel" required></label><button class="btn" type="submit">${c.T('track_btn')}</button></form>${result}`,
  };
}

const staticPage = (c, pg) => ({ title: pg.metaTitle || pg.title, desc: pg.metaDesc, body: `${crumbs(c, [{ label: esc(pg.title) }])}<article class="rich page"><h1>${c.N(pg, 'title')}</h1>${pg.content}</article>` });
const notFound = c => ({ title: '404', noindex: true, body: `<div class="done"><h1>۴۰۴</h1><p>${c.T('page_404')}</p><a class="btn" href="/">${c.T('back_home')}</a></div>` });
const maintenance = c => ({ title: c.raw('site_name'), noindex: true, body: `<div class="done"><h1>${c.T('site_name')}</h1><p>${c.T('maintenance')}</p></div>` });

module.exports = { makeCtx, layout, home, listing, product, cart, checkout, done, track, staticPage, notFound, maintenance, descendants };
