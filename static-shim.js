(() => {
'use strict';
/* جایگزین سمت مرورگر برای /api/cart و /api/order و فیلتر لیست محصولات (نسخه‌ی استاتیک) */
const B = document.documentElement.dataset.base || '';
const $ = (s, r = document) => r.querySelector(s);
const FA = '۰۱۲۳۴۵۶۷۸۹', AR = '٠١٢٣٤٥٦٧٨٩';
const digits = s => String(s ?? '').replace(/[۰-۹]/g, d => FA.indexOf(d)).replace(/[٠-٩]/g, d => AR.indexOf(d));
const fixFa = s => String(s ?? '').replace(/ي/g, 'ی').replace(/ك/g, 'ک');
const norm = s => fixFa(digits(s)).toLowerCase().replace(/[\u200c\u064B-\u065F\u0670]/g, '').trim();
const str = (v, max = 300) => (v == null ? '' : String(v)).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
const int = (v, d = 0) => {
  if (v === '' || v == null) return d;
  const n = Math.trunc(Number(digits(v).replace(/[,٬\s]/g, '')));
  return Number.isFinite(n) ? n : d;
};
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const fa = n => Number(n || 0).toLocaleString('fa-IR');
const pn = n => String(n).replace(/\d/g, d => FA[d]);
const normPhone = s => {
  let p = digits(s).replace(/[^\d+]/g, '');
  if (p.startsWith('+98')) p = '0' + p.slice(3);
  else if (p.startsWith('0098')) p = '0' + p.slice(4);
  else if (p.startsWith('98') && p.length === 12) p = '0' + p.slice(2);
  return p;
};
const isMobile = p => /^09\d{9}$/.test(p);
const dayKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(Date.now());

class HttpErr extends Error { constructor(s, m) { super(m); this.status = s; } }

/* ---------- ذخیره‌سازی ---------- */
const mem = {};
const lsGet = k => { try { return localStorage.getItem(k); } catch { return mem[k] || null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { mem[k] = v; } };
const ORD = 'shop_orders';
const getOrders = () => { try { const a = JSON.parse(lsGet(ORD) || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } };
const saveOrder = o => lsSet(ORD, JSON.stringify([o, ...getOrders()].slice(0, 20)));

/* ---------- داده‌ی عمومی ---------- */
let dataP;
const data = () => dataP || (dataP = fetch(B + '/static/data/shop-data.json').then(r => { if (!r.ok) throw new Error('data'); return r.json(); }));

const sha256 = async s => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
};

/* ---------- قیمت‌گذاری سبد (همان منطق سرور) ---------- */
const eff = (price, sale) => (sale > 0 && sale < price ? sale : price);
const hasVar = p => p.options && p.options.length && (p.variants || []).some(v => v.active !== false);
const vLabel = v => Object.values(v.combo || {}).join(' / ');
const vPrice = (p, v) => {
  const regular = v && v.price != null ? v.price : p.price;
  const sale = v && v.salePrice != null ? v.salePrice : (v && v.price != null ? 0 : p.salePrice);
  return { regular, final: eff(regular, sale || 0) };
};

async function checkCoupon(D, code, subtotal) {
  let c = null;
  try { c = D.coupons[await sha256(code)]; } catch { /* بدون crypto.subtle */ }
  if (!c || !c.active) return { ok: false, msg: 'کد تخفیف معتبر نیست.' };
  if (c.expires && dayKey() > c.expires) return { ok: false, msg: 'مهلت استفاده از این کد تمام شده است.' };
  if (c.minOrder > 0 && subtotal < c.minOrder) return { ok: false, msg: `حداقل مبلغ سفارش برای این کد ${fa(c.minOrder)} است.` };
  let d = c.type === 'percent' ? Math.floor(subtotal * c.amount / 100) : c.amount;
  if (c.type === 'percent' && c.maxDiscount > 0) d = Math.min(d, c.maxDiscount);
  return { ok: true, discount: clamp(d, 0, subtotal) };
}

async function priceCart(body = {}) {
  const D = await data();
  const merged = new Map();
  for (const it of (Array.isArray(body.items) ? body.items.slice(0, 60) : [])) {
    const k = `${int(it.p)}:${int(it.v)}`;
    const q = clamp(int(it.q, 1), 1, 99);
    merged.set(k, { p: int(it.p), v: int(it.v), q: Math.min(99, (merged.get(k)?.q || 0) + q) });
  }
  const lines = [];
  let subtotal = 0;
  for (const it of merged.values()) {
    const p = D.products[it.p];
    if (!p) continue;
    let v = null;
    if (hasVar(p)) { v = (p.variants || []).find(x => x.id === it.v && x.active !== false); if (!v) continue; }
    const { regular, final } = vPrice(p, v);
    const stock = v ? v.stock : p.stock;
    lines.push({ p: p.id, v: v ? v.id : 0, title: p.title, slug: p.slug, image: p.image || '', variant: v ? vLabel(v) : '', price: final, regular, qty: it.q, stock, ok: stock == null || stock >= it.q, sum: final * it.q });
    subtotal += final * it.q;
  }
  let discount = 0, coupon = '', couponMsg = '';
  const code = str(body.coupon, 40).toUpperCase();
  if (code && lines.length) {
    const r = await checkCoupon(D, code, subtotal);
    if (r.ok) { discount = r.discount; coupon = code; couponMsg = 'ok'; } else couponMsg = r.msg;
  }
  const net = subtotal - discount;
  const ship = D.shipping.map(s => ({ id: s.id, name: s.name, desc: s.desc, cost: s.freeOver > 0 && net >= s.freeOver ? 0 : s.cost }));
  const chosen = ship.find(s => s.id === int(body.ship)) || ship[0] || null;
  const shipCost = chosen ? chosen.cost : 0;
  return { lines, subtotal, discount, coupon, couponMsg, ship, shipId: chosen ? chosen.id : 0, shipCost, total: net + shipCost, minOrder: D.minOrder, ok: lines.length > 0 && lines.every(l => l.ok) };
}

/* ---------- ثبت سفارش (ذخیره در مرورگر؛ ارسال برای فروشگاه از صفحه‌ی بعد) ---------- */
const TA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const trackingCode = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), n => TA[n % TA.length]).join('');

async function createOrder(body) {
  const D = await data();
  const c = body.customer || {};
  const customer = {
    name: str(c.name, 80), phone: normPhone(c.phone), email: str(c.email, 100),
    province: str(c.province, 40), city: str(c.city, 40), address: str(c.address, 500),
    postal: digits(str(c.postal, 20)).replace(/\D/g, ''), note: str(c.note, 500),
  };
  if (customer.name.length < 3) throw new HttpErr(400, 'نام و نام خانوادگی را وارد کنید.');
  if (!isMobile(customer.phone)) throw new HttpErr(400, 'شماره موبایل معتبر نیست (مثال: 09123456789).');
  if (customer.province.length < 2 || customer.city.length < 2) throw new HttpErr(400, 'استان و شهر را وارد کنید.');
  if (customer.address.length < 8) throw new HttpErr(400, 'آدرس کامل را وارد کنید.');
  if (customer.postal && customer.postal.length !== 10) throw new HttpErr(400, 'کد پستی باید ۱۰ رقم باشد.');
  if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) throw new HttpErr(400, 'ایمیل معتبر نیست.');

  const cart = await priceCart(body);
  if (!cart.lines.length) throw new HttpErr(400, 'سبد خرید خالی است.');
  const lack = cart.lines.find(l => !l.ok);
  if (lack) throw new HttpErr(409, `موجودی «${lack.title}${lack.variant ? ' - ' + lack.variant : ''}» کافی نیست.`);
  if (D.minOrder > 0 && cart.subtotal < D.minOrder) throw new HttpErr(400, `حداقل مبلغ سفارش ${fa(D.minOrder)} است.`);
  if (!cart.shipId) throw new HttpErr(400, 'هیچ روش ارسالی فعال نیست.');
  const method = str(body.payment, 10);
  const pm = D.payments[method];
  if (!pm || !pm.enabled) throw new HttpErr(400, 'روش پرداخت انتخاب‌شده معتبر نیست.');

  const ship = cart.ship.find(s => s.id === cart.shipId);
  const order = {
    tracking: trackingCode(), createdAt: Date.now(),
    items: cart.lines.map(l => ({ title: l.title, variant: l.variant, price: l.price, qty: l.qty })),
    subtotal: cart.subtotal, discount: cart.discount, coupon: cart.coupon,
    shipping: { name: ship.name, cost: ship.cost }, total: cart.total,
    payment: { method, title: pm.title }, customer,
  };
  saveOrder(order);
  return { ok: true, tracking: order.tracking };
}

const res = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
window.__shopApi = async (name, opts) => {
  try {
    const body = JSON.parse((opts && opts.body) || '{}');
    if (name === 'cart') return res(200, await priceCart(body));
    if (name === 'order') return res(200, await createOrder(body));
    return res(404, { error: 'پیدا نشد.' });
  } catch (e) {
    return res(e.status || 500, { error: e instanceof HttpErr ? e.message : 'خطا در بارگذاری اطلاعات فروشگاه. صفحه را دوباره باز کنید.' });
  }
};

/* ---------- متن سفارش و دکمه‌های ارسال ---------- */
function orderText(o, cur) {
  const c = o.customer;
  const lines = [
    `سفارش جدید — کد پیگیری: ${o.tracking}`,
    '',
    `نام: ${c.name}`, `موبایل: ${c.phone}`,
    `آدرس: ${c.province}، ${c.city}، ${c.address}${c.postal ? ' (کدپستی ' + c.postal + ')' : ''}`,
    ...(c.email ? [`ایمیل: ${c.email}`] : []),
    '', '— کالاها —',
    ...o.items.map((i, n) => `${n + 1}) ${i.title}${i.variant ? ' (' + i.variant + ')' : ''} × ${fa(i.qty)} = ${fa(i.price * i.qty)} ${cur}`),
    '',
    `جمع کالاها: ${fa(o.subtotal)} ${cur}`,
    ...(o.discount ? [`تخفیف${o.coupon ? ' (' + o.coupon + ')' : ''}: ${fa(o.discount)} ${cur}`] : []),
    `ارسال (${o.shipping.name}): ${o.shipping.cost ? fa(o.shipping.cost) + ' ' + cur : 'رایگان'}`,
    `مبلغ نهایی: ${fa(o.total)} ${cur}`,
    `روش پرداخت: ${o.payment.title}`,
    ...(c.note ? ['', `توضیحات: ${c.note}`] : []),
  ];
  return lines.join('\n');
}

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const link = (cls, text, href, blank) => { const a = el('a', cls, text); a.href = href; if (blank) { a.target = '_blank'; a.rel = 'noopener'; } return a; };

function sendButtons(D, o, text) {
  const ch = D.channels, box = el('div', 'send-btns');
  const enc = encodeURIComponent(text);
  if (ch.whatsapp) box.append(link('btn', 'ارسال در واتس‌اپ', `https://wa.me/${ch.whatsapp}?text=${enc}`, true));
  const copyThen = (label, href) => {
    const b = el('button', 'btn', label); b.type = 'button';
    b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(text); b.textContent = 'کپی شد؛ در حال باز کردن…'; } catch { b.textContent = 'متن را دستی کپی کنید'; }
      window.open(href, '_blank', 'noopener');
    });
    return b;
  };
  if (ch.telegram) box.append(copyThen('کپی و ارسال در تلگرام', ch.telegram));
  if (ch.eitaa) box.append(copyThen('کپی و ارسال در ایتا', ch.eitaa));
  if (ch.email) box.append(link('btn alt', 'ارسال با ایمیل', `mailto:${ch.email}?subject=${encodeURIComponent('سفارش ' + o.tracking)}&body=${enc}`));
  if (ch.phone) box.append(link('btn alt', 'پیامک', `sms:${ch.phone}?body=${enc}`));
  const cp = el('button', 'btn alt', 'کپی متن سفارش'); cp.type = 'button';
  cp.addEventListener('click', async () => { try { await navigator.clipboard.writeText(text); cp.textContent = 'کپی شد'; } catch { cp.textContent = 'متن را دستی کپی کنید'; } });
  box.append(cp);
  return box;
}

function renderOrder(D, o, root, withTitle) {
  const L = D.labels, text = orderText(o, L.currency);
  if (withTitle) { root.append(el('h1', '', L.success_title), el('p', '', L.success_text)); }
  const trk = el('div', 'trk'); trk.append(el('span', '', L.success_code)); const b = el('b', '', o.tracking); b.dir = 'ltr'; trk.append(b);
  root.append(trk);
  const warn = el('div', 'ord-warn');
  warn.append(el('b', '', 'مهم: '), document.createTextNode('سفارش شما هنوز برای فروشگاه ارسال نشده است. با یکی از دکمه‌های زیر متن سفارش را برای ما بفرستید تا ثبت و پیگیری شود.'));
  root.append(warn);
  if (o.payment.method === 'card') {
    const n = el('div', 'notice'); n.append(el('p', '', L.success_card));
    if (D.payments.card.number) { const c = el('div', 'cardno', D.payments.card.number); c.dir = 'ltr'; n.append(c); }
    if (D.payments.card.owner) n.append(el('div', '', D.payments.card.owner));
    const t = el('div'); t.append(el('b', '', fa(o.total)), document.createTextNode(' ' + L.currency)); n.append(t);
    root.append(n);
  }
  root.append(sendButtons(D, o, text));
  const ta = el('textarea', 'ord-txt'); ta.readOnly = true; ta.rows = 12; ta.value = text;
  root.append(ta);
}

async function initDone() {
  const root = $('#od'); if (!root) return;
  const D = await data();
  root.replaceChildren();
  const code = (new URLSearchParams(location.search).get('code') || '').toUpperCase();
  const o = getOrders().find(x => x.tracking === code);
  if (!o) { root.append(el('p', '', 'این سفارش روی این دستگاه پیدا نشد. اگر قبلاً سفارش داده‌اید، با فروشگاه تماس بگیرید.'), link('btn', D.labels.back_home, B + '/')); return; }
  renderOrder(D, o, root, true);
  root.append(link('btn alt', D.labels.back_home, B + '/'));
}

async function initTrack() {
  const root = $('#trk'); if (!root) return;
  const D = await data();
  root.replaceChildren();
  const list = getOrders();
  root.append(el('p', 'muted', 'وضعیت سفارش‌ها را از طریق پیام به فروشگاه (با کد پیگیری) بپرسید. سفارش‌های ثبت‌شده روی این دستگاه:'));
  if (!list.length) root.append(el('p', 'empty', 'سفارشی روی این دستگاه ثبت نشده است.'));
  list.forEach(o => {
    const d = el('details'); d.append(el('summary', '', `${o.tracking} — ${new Date(o.createdAt).toLocaleDateString('fa-IR')} — ${fa(o.total)} ${D.labels.currency}`));
    renderOrder(D, o, d, false); root.append(d);
  });
}

/* ---------- فیلتر / مرتب‌سازی / جستجو در لیست محصولات ---------- */
async function initListing() {
  const lst = $('.lst'); if (!lst) return;
  const grid = $('.grid', lst); if (!grid) return;
  const D = await data();
  const idx = new Map(D.index.map(x => [x.s, x]));
  const slugOf = a => { try { return decodeURIComponent(new URL(a.href, location.href).pathname.replace(/\/$/, '').split('/').pop()); } catch { return ''; } };
  const cards = [...grid.querySelectorAll('a.card')].map(a => ({ a, m: idx.get(slugOf(a)) })).filter(x => x.m);
  const q = new URLSearchParams(location.search);
  const text = str(q.get('q'), 80), nt = norm(text);
  const min = int(q.get('min'), 0), max = int(q.get('max'), 0), stock = q.get('stock') === '1';
  const sort = ['cheap', 'pricey'].includes(q.get('sort')) ? q.get('sort') : 'new';

  let list = cards.slice();
  if (nt) list = list.filter(x => x.m.t.includes(nt));
  if (min) list = list.filter(x => x.m.min >= min);
  if (max) list = list.filter(x => x.m.min <= max);
  if (stock) list = list.filter(x => x.m.st);
  list.sort(sort === 'cheap' ? (a, b) => a.m.min - b.m.min : sort === 'pricey' ? (a, b) => b.m.min - a.m.min : (a, b) => b.m.id - a.m.id);
  const shown = new Set(list.map(x => x.a));
  cards.forEach(x => { x.a.hidden = !shown.has(x.a); });
  list.forEach(x => grid.append(x.a));

  const cnt = $('.lst-h .muted', lst); if (cnt) cnt.textContent = pn(list.length);
  const old = $('.empty.js-empty', lst); if (old) old.remove();
  if (!list.length) { const p = el('p', 'empty js-empty', D.labels.no_products); grid.after(p); }

  if (text) {
    const h = $('.lst-h h1', lst); if (h && /search|جستجو/i.test(h.textContent) && !h.textContent.includes('«')) h.textContent += `: «${text}»`;
    const si = $('.search input[name=q]'); if (si) si.value = text;
  }
  const withQuery = extra => { const p = new URLSearchParams(location.search); for (const [k, v] of Object.entries(extra)) { if (v) p.set(k, v); else p.delete(k); } p.delete('page'); const s = p.toString(); return location.pathname + (s ? '?' + s : ''); };
  const keys = ['new', 'cheap', 'pricey'];
  document.querySelectorAll('.sorts a').forEach((a, i) => { const k = keys[i]; if (!k) return; a.href = withQuery({ sort: k === 'new' ? '' : k }); a.classList.toggle('on', sort === k); });
  const form = $('.flt form');
  if (form) {
    for (const [k, v] of [['q', text], ['sort', sort === 'new' ? '' : sort]]) {
      if (v && !form.querySelector(`input[name=${k}]`)) { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = v; form.prepend(i); }
    }
    const clr = form.querySelector('a.btn.alt'); if (clr) clr.href = location.pathname + (text ? '?q=' + encodeURIComponent(text) : '');
  }
}

initListing(); initDone(); initTrack();
})();
