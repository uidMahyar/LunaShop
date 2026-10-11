'use strict';
const U = require('./util');
const { HttpError, str, int, clamp } = U;

const STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];
const byOrder = (a, b) => (a.order || 0) - (b.order || 0) || a.id - b.id;
const eff = (price, sale) => (sale > 0 && sale < price ? sale : price);
const live = db => db.col('products').filter(p => p.status === 'published');
const hasVar = p => p.options && p.options.length && (p.variants || []).some(v => v.active !== false);
const vLabel = v => Object.values(v.combo || {}).join(' / ');

function vPrice(p, v) {
  const regular = v && v.price != null ? v.price : p.price;
  const sale = v && v.salePrice != null ? v.salePrice : (v && v.price != null ? 0 : p.salePrice);
  return { regular, final: eff(regular, sale || 0) };
}

function pinfo(p) {
  if (!hasVar(p)) {
    const pr = vPrice(p, null);
    return { min: pr.final, max: pr.final, regular: pr.regular, onSale: pr.final < pr.regular, range: false, inStock: p.stock == null || p.stock > 0, variable: false };
  }
  const vs = p.variants.filter(v => v.active !== false);
  const avail = vs.filter(v => v.stock == null || v.stock > 0);
  const list = (avail.length ? avail : vs).map(v => vPrice(p, v));
  const min = Math.min(...list.map(x => x.final)), max = Math.max(...list.map(x => x.final));
  const best = list.find(x => x.final === min);
  return { min, max, regular: best.regular, onSale: list.some(x => x.final < x.regular), range: min !== max, inStock: avail.length > 0, variable: true };
}

function stockOf(p) {
  if (hasVar(p)) {
    const vs = p.variants.filter(v => v.active !== false);
    if (vs.some(v => v.stock == null)) return null;
    return vs.reduce((s, v) => s + (v.stock || 0), 0);
  }
  return p.stock;
}

/* ---------- کد تخفیف ---------- */
function checkCoupon(db, code, subtotal) {
  const c = db.col('coupons').find(x => x.code === code);
  if (!c || c.active === false) return { ok: false, msg: 'کد تخفیف معتبر نیست.' };
  if (c.expires && U.dayKey(Date.now()) > c.expires) return { ok: false, msg: 'مهلت استفاده از این کد تمام شده است.' };
  if (c.usageLimit > 0 && (c.used || 0) >= c.usageLimit) return { ok: false, msg: 'ظرفیت استفاده از این کد تکمیل شده است.' };
  if (c.minOrder > 0 && subtotal < c.minOrder) return { ok: false, msg: `حداقل مبلغ سفارش برای این کد ${U.money(c.minOrder)} است.` };
  let d = c.type === 'percent' ? Math.floor(subtotal * c.amount / 100) : c.amount;
  if (c.type === 'percent' && c.maxDiscount > 0) d = Math.min(d, c.maxDiscount);
  return { ok: true, coupon: c, discount: clamp(d, 0, subtotal) };
}

/* ---------- قیمت‌گذاری سبد (همیشه سمت سرور) ---------- */
function priceCart(db, body = {}) {
  const S = db.settings();
  const merged = new Map();
  for (const it of (Array.isArray(body.items) ? body.items.slice(0, 60) : [])) {
    const k = `${int(it.p)}:${int(it.v)}`;
    const q = clamp(int(it.q, 1), 1, 99);
    merged.set(k, { p: int(it.p), v: int(it.v), q: Math.min(99, (merged.get(k)?.q || 0) + q) });
  }
  const lines = [];
  let subtotal = 0;
  for (const it of merged.values()) {
    const p = db.get('products', it.p);
    if (!p || p.status !== 'published') continue;
    let v = null;
    if (hasVar(p)) { v = (p.variants || []).find(x => x.id === it.v && x.active !== false); if (!v) continue; }
    const { regular, final } = vPrice(p, v);
    const stock = v ? v.stock : p.stock;
    lines.push({
      p: p.id, v: v ? v.id : 0, title: p.title, slug: p.slug, image: (p.images || [])[0] || '',
      variant: v ? vLabel(v) : '', price: final, regular, qty: it.q, stock, ok: stock == null || stock >= it.q, sum: final * it.q,
    });
    subtotal += final * it.q;
  }
  let discount = 0, coupon = '', couponMsg = '';
  const code = str(body.coupon, 40).toUpperCase();
  if (code && lines.length) {
    const r = checkCoupon(db, code, subtotal);
    if (r.ok) { discount = r.discount; coupon = r.coupon.code; couponMsg = 'ok'; } else couponMsg = r.msg;
  }
  const net = subtotal - discount;
  const ship = db.col('shipping').filter(s => s.active !== false).sort(byOrder)
    .map(s => ({ id: s.id, name: s.name, desc: s.description || '', cost: s.freeOver > 0 && net >= s.freeOver ? 0 : s.cost }));
  const chosen = ship.find(s => s.id === int(body.ship)) || ship[0] || null;
  const shipCost = chosen ? chosen.cost : 0;
  return {
    lines, subtotal, discount, coupon, couponMsg, ship, shipId: chosen ? chosen.id : 0, shipCost, total: net + shipCost,
    minOrder: S.shop.minOrder, ok: lines.length > 0 && lines.every(l => l.ok),
  };
}

/* ---------- ثبت سفارش ---------- */
function createOrder(db, body, ip) {
  const S = db.settings();
  const c = body.customer || {};
  const customer = {
    name: str(c.name, 80), phone: U.normPhone(c.phone), email: str(c.email, 100),
    province: str(c.province, 40), city: str(c.city, 40), address: str(c.address, 500),
    postal: U.digits(str(c.postal, 20)).replace(/\D/g, ''), note: str(c.note, 500),
  };
  if (customer.name.length < 3) throw new HttpError(400, 'نام و نام خانوادگی را وارد کنید.');
  if (!U.isMobile(customer.phone)) throw new HttpError(400, 'شماره موبایل معتبر نیست (مثال: 09123456789).');
  if (customer.province.length < 2 || customer.city.length < 2) throw new HttpError(400, 'استان و شهر را وارد کنید.');
  if (customer.address.length < 8) throw new HttpError(400, 'آدرس کامل را وارد کنید.');
  if (customer.postal && customer.postal.length !== 10) throw new HttpError(400, 'کد پستی باید ۱۰ رقم باشد.');
  if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) throw new HttpError(400, 'ایمیل معتبر نیست.');

  const cart = priceCart(db, body);
  if (!cart.lines.length) throw new HttpError(400, 'سبد خرید خالی است.');
  const lack = cart.lines.find(l => !l.ok);
  if (lack) throw new HttpError(409, `موجودی «${lack.title}${lack.variant ? ' - ' + lack.variant : ''}» کافی نیست.`);
  if (S.shop.minOrder > 0 && cart.subtotal < S.shop.minOrder) throw new HttpError(400, `حداقل مبلغ سفارش ${U.money(S.shop.minOrder)} است.`);
  if (!cart.shipId) throw new HttpError(400, 'هیچ روش ارسالی فعال نیست.');

  const method = str(body.payment, 10);
  const pm = S.payments[method];
  if (!pm || !pm.enabled) throw new HttpError(400, 'روش پرداخت انتخاب‌شده معتبر نیست.');

  for (const l of cart.lines) {
    const p = db.get('products', l.p);
    if (l.v) { const v = p.variants.find(x => x.id === l.v); if (v.stock != null) v.stock -= l.qty; } else if (p.stock != null) p.stock -= l.qty;
  }
  if (cart.coupon) { const cp = db.col('coupons').find(x => x.code === cart.coupon); if (cp) cp.used = (cp.used || 0) + 1; }

  let tracking;
  do { tracking = U.trackingCode(); } while (db.col('orders').some(o => o.tracking === tracking));
  const ship = cart.ship.find(s => s.id === cart.shipId);
  return db.add('orders', {
    number: ++db.d.meta.orderNo, tracking, status: 'pending',
    items: cart.lines.map(l => ({ p: l.p, v: l.v, title: l.title, variant: l.variant, image: l.image, price: l.price, regular: l.regular, qty: l.qty })),
    subtotal: cart.subtotal, discount: cart.discount, coupon: cart.coupon,
    shipping: { id: ship.id, name: ship.name, cost: ship.cost }, total: cart.total,
    payment: { method, title: pm.title }, customer, notes: [], stockRestored: false, ip,
    history: [{ s: 'pending', at: Date.now(), by: 'مشتری' }],
  });
}

function restock(db, order, sign) {
  for (const it of order.items) {
    const p = db.get('products', it.p);
    if (!p) continue;
    if (it.v) { const v = (p.variants || []).find(x => x.id === it.v); if (v && v.stock != null) v.stock = Math.max(0, v.stock + sign * it.qty); } else if (p.stock != null) p.stock = Math.max(0, p.stock + sign * it.qty);
  }
}

function setStatus(db, order, status, by) {
  if (!STATUSES.includes(status)) throw new HttpError(400, 'وضعیت نامعتبر است.');
  if (order.status === status) return order;
  const dead = s => s === 'cancelled' || s === 'returned';
  if (dead(status) && !order.stockRestored) { restock(db, order, +1); order.stockRestored = true; } else if (!dead(status) && order.stockRestored) { restock(db, order, -1); order.stockRestored = false; }
  order.status = status;
  order.history.push({ s: status, at: Date.now(), by });
  order.updatedAt = Date.now();
  db.save();
  return order;
}

/* ---------- پیشخوان ---------- */
function dashboard(db) {
  const S = db.settings();
  const orders = db.col('orders');
  const valid = o => o.status !== 'cancelled' && o.status !== 'returned';
  const today = U.dayKey(Date.now());
  const days = [];
  for (let i = 13; i >= 0; i--) days.push(U.dayKey(Date.now() - i * 864e5));
  const perDay = Object.fromEntries(days.map(d => [d, { day: d, orders: 0, revenue: 0 }]));
  let rev30 = 0;
  for (const o of orders) {
    const k = U.dayKey(o.createdAt);
    if (perDay[k]) { perDay[k].orders++; if (valid(o)) perDay[k].revenue += o.total; }
    if (valid(o) && Date.now() - o.createdAt < 30 * 864e5) rev30 += o.total;
  }
  const prods = db.col('products');
  const low = prods.filter(p => { const s = stockOf(p); return s != null && s <= S.shop.lowStock; })
    .map(p => ({ id: p.id, title: p.title, stock: stockOf(p) })).sort((a, b) => a.stock - b.stock).slice(0, 8);
  const counts = {};
  for (const s of STATUSES) counts[s] = orders.filter(o => o.status === s).length;
  return {
    today: orders.filter(o => U.dayKey(o.createdAt) === today).length,
    pending: counts.pending, rev30, counts,
    products: prods.length, published: prods.filter(p => p.status === 'published').length,
    categories: db.col('categories').length, chart: days.map(d => perDay[d]), low,
    latest: [...orders].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8)
      .map(o => ({ id: o.id, number: o.number, name: o.customer.name, total: o.total, status: o.status, at: o.createdAt })),
  };
}

module.exports = { STATUSES, byOrder, eff, live, hasVar, vLabel, vPrice, pinfo, stockOf, checkCoupon, priceCart, createOrder, setStatus, dashboard };
