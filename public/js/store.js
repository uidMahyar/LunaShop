(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const fa = n => Number(n || 0).toLocaleString('fa-IR');
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const CART = 'shop_cart', COUPON = 'shop_coupon';

/* ---------- ذخیره‌سازی (با پشتیبان حافظه برای مرورگرهای محدود) ---------- */
const mem = {};
const lsGet = k => { try { return localStorage.getItem(k); } catch { return mem[k] || null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { mem[k] = v; } };
const getCart = () => { try { const a = JSON.parse(lsGet(CART) || '[]'); return Array.isArray(a) ? a.filter(i => i && i.p && i.q > 0) : []; } catch { return []; } };
const setCart = a => { lsSet(CART, JSON.stringify(a)); badge(); };
const badge = () => {
  const n = getCart().reduce((s, i) => s + i.q, 0);
  $$('[data-cart-count]').forEach(b => { b.textContent = fa(n); b.hidden = !n; });
};
const labels = () => { try { return JSON.parse($('#labels').textContent); } catch { return {}; } };
let toastT;
const toast = msg => {
  $$('.toast').forEach(t => t.remove());
  const t = el('div', 'toast', msg);
  t.setAttribute('role', 'status');
  document.body.append(t);
  clearTimeout(toastT);
  toastT = setTimeout(() => t.remove(), 2600);
};
const priceCart = async (items, coupon, ship) => {
  const r = await fetch('/api/cart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items, coupon, ship }) });
  if (!r.ok) throw new Error('cart');
  return r.json();
};

/* ---------- منوی کشویی ---------- */
$$('[data-open]').forEach(b => b.addEventListener('click', () => $('#' + b.dataset.open).classList.add('open')));
$$('[data-close]').forEach(b => b.addEventListener('click', () => $('#' + b.dataset.close).classList.remove('open')));
$$('.drawer').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.classList.remove('open'); }));
document.addEventListener('keydown', e => { if (e.key === 'Escape') $$('.drawer.open').forEach(d => d.classList.remove('open')); });

/* فیلترها روی دسکتاپ همیشه باز */
if (matchMedia('(min-width:821px)').matches) $$('details.flt').forEach(d => { d.open = true; });

/* ---------- اسلایدر بنر ---------- */
$$('[data-slider]').forEach(root => {
  const sl = $('.slides', root), dots = $$('.dots button', root), n = sl.children.length;
  const dir = getComputedStyle(sl).direction === 'rtl' ? -1 : 1;
  const idx = () => Math.round(Math.abs(sl.scrollLeft) / (sl.clientWidth || 1));
  const mark = () => dots.forEach((d, i) => d.classList.toggle('on', i === idx()));
  const go = i => sl.scrollTo({ left: dir * i * sl.clientWidth, behavior: 'smooth' });
  sl.addEventListener('scroll', () => requestAnimationFrame(mark), { passive: true });
  dots.forEach((d, i) => d.addEventListener('click', () => go(i)));
  mark();
  if (n < 2 || matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  let t = setInterval(() => go((idx() + 1) % n), 5500);
  const stop = () => { clearInterval(t); t = null; };
  root.addEventListener('pointerdown', stop);
  root.addEventListener('mouseenter', stop);
  root.addEventListener('mouseleave', () => { if (!t) t = setInterval(() => go((idx() + 1) % n), 5500); });
});

/* ---------- گالری و صفحه‌ی محصول ---------- */
$$('.thumb').forEach(t => t.addEventListener('click', () => {
  $('#gmain').src = t.dataset.src;
  $$('.thumb').forEach(x => x.classList.toggle('on', x === t));
}));

const pdataEl = $('#pdata');
if (pdataEl) {
  const pd = JSON.parse(pdataEl.textContent);
  const priceEl = $('#pprice'), msgEl = $('#pmsg'), addBtn = $('#add'), qtyEl = $('#qty');
  const curTxt = ($('small', priceEl) || {}).textContent || '';
  const sel = {};
  const say = (t, ok) => { msgEl.textContent = t || ''; msgEl.classList.toggle('ok', !!ok); };
  const inStock = v => v.stock == null || v.stock > 0;
  const renderPrice = (price, regular, from) => {
    priceEl.textContent = '';
    if (regular > price) priceEl.append(el('s', 'was', fa(regular)));
    priceEl.append(el('span', 'now', (from ? from + ' ' : '') + fa(price)), ' ', el('small', '', curTxt));
  };
  const match = () => pd.variants.find(v => pd.options.every(o => v.combo[o.name] === sel[o.name]));
  const refresh = () => {
    $$('.optg').forEach(g => {
      const name = g.dataset.opt;
      $$('.opt', g).forEach(b => {
        const ok = pd.variants.some(v => inStock(v) && v.combo[name] === b.dataset.val && pd.options.every(o => o.name === name || !sel[o.name] || v.combo[o.name] === sel[o.name]));
        b.disabled = !ok;
        if (!ok && sel[name] === b.dataset.val) { delete sel[name]; b.setAttribute('aria-pressed', 'false'); }
      });
    });
    const full = pd.options.every(o => sel[o.name]);
    const v = full ? match() : null;
    if (v) { renderPrice(v.price, v.regular); say(v.stock != null && v.stock > 0 && v.stock <= 5 ? pd.msgs.low.replace('{n}', fa(v.stock)) : ''); } else { renderPrice(pd.price, pd.regular, pd.from); if (full) say(pd.msgs.unavail); else say(''); }
  };
  if (pd.variable) {
    $$('.opt').forEach(b => b.addEventListener('click', () => {
      const name = b.closest('.optg').dataset.opt;
      if (sel[name] === b.dataset.val) { delete sel[name]; b.setAttribute('aria-pressed', 'false'); } else {
        sel[name] = b.dataset.val;
        $$('.opt', b.closest('.optg')).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      }
      refresh();
    }));
    refresh();
  }
  $$('[data-q]').forEach(b => b.addEventListener('click', () => { qtyEl.value = Math.max(1, Math.min(99, (parseInt(qtyEl.value, 10) || 1) + +b.dataset.q)); }));
  addBtn.addEventListener('click', () => {
    let vid = 0, max = pd.stock;
    if (pd.variable) {
      const v = match();
      if (!v) { say(pd.options.every(o => sel[o.name]) ? pd.msgs.unavail : pd.msgs.need); return; }
      vid = v.id; max = v.stock;
    }
    const q = Math.max(1, Math.min(99, parseInt(qtyEl.value, 10) || 1));
    const cart = getCart(), it = cart.find(x => x.p === pd.id && x.v === vid), have = it ? it.q : 0;
    if (max != null && have + q > max) { say(max - have > 0 ? pd.msgs.low.replace('{n}', fa(max - have)) : pd.msgs.out); return; }
    if (it) it.q += q; else cart.push({ p: pd.id, v: vid, q });
    setCart(cart);
    say(pd.msgs.added, true);
    toast(pd.msgs.added);
  });
}

/* ---------- صفحه‌ی سبد خرید ---------- */
const lineEl = (l, L, onQty, onRemove) => {
  const row = el('div', 'li');
  const img = el('a', 'li-img');
  img.href = '/product/' + encodeURIComponent(l.slug);
  const im = new Image();
  im.src = l.image || '/static/img/ph.svg'; im.alt = '';
  img.append(im);
  const info = el('div');
  const t = el('a', 'li-t', l.title);
  t.href = img.href;
  info.append(t);
  if (l.variant) info.append(el('div', 'li-v', l.variant));
  info.append(el('div', 'li-p', `${fa(l.price)} ${L.currency}`));
  if (!l.ok) info.append(el('div', 'li-warn', l.stock > 0 ? (L.low_stock || '').replace('{n}', fa(l.stock)) : L.badge_out));
  const side = el('div', 'li-side');
  const qty = el('div', 'qty');
  const minus = el('button', '', '−'), plus = el('button', '', '+');
  minus.type = plus.type = 'button';
  const inp = el('input');
  inp.type = 'number'; inp.min = 1; inp.max = 99; inp.value = l.qty;
  minus.addEventListener('click', () => onQty(l, l.qty - 1));
  plus.addEventListener('click', () => onQty(l, l.qty + 1));
  inp.addEventListener('change', () => onQty(l, parseInt(inp.value, 10) || 1));
  qty.append(minus, inp, plus);
  const rm = el('button', 'li-rm', L.cart_remove);
  rm.type = 'button';
  rm.addEventListener('click', () => onRemove(l));
  side.append(qty, el('div', 'li-sum', `${fa(l.sum)} ${L.currency}`), rm);
  row.append(img, info, side);
  return row;
};
const setQty = (l, q) => { const c = getCart(), it = c.find(x => x.p === l.p && x.v === l.v); if (it) it.q = Math.max(1, Math.min(99, q)); setCart(c); };
const drop = l => setCart(getCart().filter(x => !(x.p === l.p && x.v === l.v)));
const emptyEl = L => { const d = el('div', 'empty'); d.append(el('p', '', L.cart_empty)); const a = el('a', 'btn', L.cart_continue); a.href = '/shop'; d.append(a); return d; };
const sumRow = (k, v, cls) => { const r = el('div', 'sum-row' + (cls ? ' ' + cls : '')); r.append(el('span', '', k), el('span', '', v)); return r; };

const cartRoot = $('#cart-root');
if (cartRoot) {
  const L = labels();
  const draw = async () => {
    const cart = getCart();
    if (!cart.length) { cartRoot.replaceChildren(emptyEl(L)); return; }
    let d;
    try { d = await priceCart(cart, lsGet(COUPON) || ''); } catch { cartRoot.textContent = 'خطا در دریافت اطلاعات سبد. صفحه را دوباره بارگذاری کنید.'; return; }
    if (d.lines.length !== cart.length) setCart(d.lines.map(l => ({ p: l.p, v: l.v, q: l.qty })));
    if (!d.lines.length) { cartRoot.replaceChildren(emptyEl(L)); return; }
    const grid = el('div', 'cart-grid'), list = el('div');
    d.lines.forEach(l => list.append(lineEl(l, L, (x, q) => { setQty(x, q); draw(); }, x => { drop(x); draw(); })));
    const side = el('aside', 'sum');
    const cf = el('form', 'coupon'), ci = el('input');
    ci.placeholder = L.coupon_label; ci.value = lsGet(COUPON) || ''; ci.dir = 'ltr';
    const cb = el('button', 'btn alt', L.coupon_apply);
    cb.type = 'submit';
    cf.append(ci, cb);
    cf.addEventListener('submit', e => { e.preventDefault(); lsSet(COUPON, ci.value.trim().toUpperCase() || null); draw(); });
    side.append(sumRow(L.cart_subtotal, `${fa(d.subtotal)} ${L.currency}`));
    if (d.discount) side.append(sumRow(L.cart_discount, `− ${fa(d.discount)} ${L.currency}`));
    side.append(cf);
    if (d.couponMsg) side.append(el('p', 'cmsg' + (d.couponMsg === 'ok' ? ' ok' : ''), d.couponMsg === 'ok' ? L.coupon_ok : d.couponMsg));
    side.append(sumRow(L.cart_total, `${fa(d.subtotal - d.discount)} ${L.currency}`, 'total'));
    const low = d.minOrder > 0 && d.subtotal < d.minOrder;
    if (low) side.append(el('p', 'cmsg', `حداقل مبلغ سفارش ${fa(d.minOrder)} ${L.currency} است.`));
    const go = el('a', 'btn big', L.go_checkout);
    go.href = '/checkout';
    if (!d.ok || low) { go.setAttribute('aria-disabled', 'true'); go.addEventListener('click', e => e.preventDefault()); }
    side.append(go);
    grid.append(list, side);
    cartRoot.replaceChildren(grid);
  };
  draw();
}

/* ---------- صفحه‌ی ثبت سفارش ---------- */
const form = $('#co-form');
if (form) {
  const L = labels(), sumEl = $('#co-sum'), shipEl = $('#ship-list'), errEl = $('#co-err'), btn = $('#co-btn');
  let shipId = 0, data = null;
  const render = async () => {
    const cart = getCart();
    if (!cart.length) { form.replaceWith(emptyEl(L)); sumEl.remove(); return; }
    try { data = await priceCart(cart, lsGet(COUPON) || '', shipId); } catch { errEl.textContent = L.err_generic; return; }
    if (!data.lines.length) { form.replaceWith(emptyEl(L)); sumEl.remove(); return; }
    shipId = data.shipId;
    shipEl.replaceChildren(...data.ship.map(s => {
      const lab = el('label', 'radio'), r = el('input');
      r.type = 'radio'; r.name = 'ship'; r.value = s.id; r.checked = s.id === shipId;
      r.addEventListener('change', () => { shipId = s.id; render(); });
      lab.append(r, el('span', '', s.name), el('small', '', s.cost ? `${fa(s.cost)} ${L.currency}` : L.free_word));
      return lab;
    }));
    sumEl.replaceChildren(
      ...data.lines.map(l => { const r = el('div', 'sl'); r.append(el('span', '', `${l.title}${l.variant ? ' (' + l.variant + ')' : ''} × ${fa(l.qty)}`), el('span', '', fa(l.sum))); return r; }),
      sumRow(L.cart_subtotal, `${fa(data.subtotal)} ${L.currency}`),
      ...(data.discount ? [sumRow(L.cart_discount, `− ${fa(data.discount)} ${L.currency}`)] : []),
      sumRow(L.cart_shipping, data.shipCost ? `${fa(data.shipCost)} ${L.currency}` : L.free_word),
      sumRow(L.cart_total, `${fa(data.total)} ${L.currency}`, 'total'),
    );
  };
  render();
  form.addEventListener('submit', async e => {
    e.preventDefault();
    errEl.textContent = '';
    if (!data || !data.ok) { errEl.textContent = 'موجودی برخی کالاها کافی نیست. ابتدا سبد خرید را اصلاح کنید.'; return; }
    const v = id => (form.elements[id] ? form.elements[id].value : '');
    const pay = form.querySelector('input[name=payment]:checked');
    btn.disabled = true;
    try {
      const r = await fetch('/api/order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: getCart(), coupon: lsGet(COUPON) || '', ship: shipId, payment: pay ? pay.value : '',
          customer: { name: v('name'), phone: v('phone'), email: v('email'), province: v('province'), city: v('city'), address: v('address'), postal: v('postal'), note: v('note') },
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || L.err_generic);
      lsSet(CART, '[]'); lsSet(COUPON, null);
      location.href = '/order-done?code=' + encodeURIComponent(j.tracking);
    } catch (x) { errEl.textContent = x.message; btn.disabled = false; }
  });
}

badge();
})();
