'use strict';
/*
  ساخت نسخه‌ی استاتیک فروشگاه برای GitHub Pages
  اجرا:  node build-static.js            (خروجی در پوشه‌ی docs)
         node build-static.js --base=/نام-مخزن --site=https://user.github.io/نام-مخزن
  تنظیمات ثابت را می‌توانید در static.config.json بنویسید.
*/
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const U = require('./lib/util');
const { Store } = require('./lib/db');
const seedMod = require('./lib/seed');
const shop = require('./lib/shop');
const V = require('./lib/views');

const ROOT = __dirname;
let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'static.config.json'), 'utf8')); } catch { /* optional */ }
const arg = n => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : undefined; };

let BASE = String(arg('base') ?? process.env.BASE ?? cfg.base ?? '').trim().replace(/\/+$/, '');
if (BASE && !BASE.startsWith('/')) BASE = '/' + BASE;
const SITE = String(arg('site') ?? process.env.SITE_URL ?? cfg.siteUrl ?? '').trim().replace(/\/+$/, '');
const OUT = path.resolve(arg('out') || cfg.out || path.join(ROOT, 'docs'));
const DATA = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const VER = require('./package.json').version + '.' + Math.floor(Date.now() / 1000).toString(36);

/* ---------- دیتابیس (روی یک کپی موقت؛ داده‌ی اصلی دست نمی‌خورد) ---------- */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shop-static-'));
const hasData = fs.existsSync(path.join(DATA, 'db.json'));
if (hasData) fs.copyFileSync(path.join(DATA, 'db.json'), path.join(tmp, 'db.json'));
const db = new Store(tmp);
if (db.fresh) seedMod.seed(db);
seedMod.syncTexts(db);
db.d.settings.shop = Object.assign({}, db.d.settings.shop, { perPage: 100000 }); // همه‌ی محصولات در یک صفحه؛ فیلتر و مرتب‌سازی سمت مرورگر
clearTimeout(db.timer);

const S = db.settings();
const warn = [];
if (!hasData) warn.push('پوشه‌ی data/ پیدا نشد؛ از داده‌ی نمونه استفاده شد. برای داده‌ی واقعی ابتدا سرور را اجرا و در پنل ادمین محصولات را وارد کنید.');
if (S.maintenance) warn.push('«حالت به‌روزرسانی» در تنظیمات روشن است؛ در نسخه‌ی استاتیک نادیده گرفته می‌شود.');

/* ---------- ابزارها ---------- */
const u = encodeURIComponent;
const write = (rel, content) => { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content); };
const copyDir = (src, dst, skip = () => false) => {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (skip(e)) continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d, skip); else fs.copyFileSync(s, d);
  }
};

function fixUrl(p) {
  if (p.startsWith('//')) return p;
  const m = /^([^?#]*)([\s\S]*)$/.exec(p);
  let pa = m[1];
  const last = pa.split('/').pop();
  if (!pa.endsWith('/') && !last.includes('.')) pa += '/';
  return BASE + pa + m[2];
}
const prefix = v => (typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') ? BASE + v : v);

function post(html) {
  html = html.replace('<html lang="fa" dir="rtl">', `<html lang="fa" dir="rtl" data-base="${BASE}">`);
  html = html.replace(/<script src="\/static\/js\/store\.js\?v=[^"]*" defer><\/script>/,
    `<script src="/static/js/static-shim.js?v=${VER}" defer></script>\n<script src="/static/js/store.js?v=${VER}" defer></script>`);
  html = html.replace(/(\b(?:href|src|action|data-src|poster)=)(["'])(\/(?!\/)[^"']*)\2/g, (m, a, q, p) => `${a}${q}${fixUrl(p)}${q}`);
  html = html.replace(/url\((["']?)\/(?!\/)/g, (m, q) => `url(${q}${BASE}/`);
  return html;
}

const ctx = () => { const c = V.makeCtx(db); c.admin = false; return c; };
const render = (build, extra = {}) => { const c = ctx(); const out = build(c); return post(V.layout(c, { ...out, ver: VER, ...extra })); };
const safeSeg = s => s && !/[\/\\]|^\.+$/.test(s);

/* ---------- پاک‌سازی خروجی قبلی ---------- */
const GEN = ['index.html', '404.html', 'static', 'uploads', 'shop', 'search', 'category', 'product', 'page', 'cart', 'checkout', 'order-done', 'track', 'robots.txt', 'sitemap.xml', '.nojekyll'];
fs.mkdirSync(OUT, { recursive: true });
for (const n of GEN) fs.rmSync(path.join(OUT, n), { recursive: true, force: true });

/* ---------- فایل‌های ثابت (css/js/img/fonts) + آپلودها ---------- */
copyDir(path.join(ROOT, 'public'), path.join(OUT, 'static'), e => e.name === 'admin');
copyDir(path.join(DATA, 'uploads'), path.join(OUT, 'uploads'));

let css = fs.readFileSync(path.join(OUT, 'static/css/store.css'), 'utf8');
css = css.replace(/url\((["']?)\/static\//g, (m, q) => `url(${q}${BASE}/static/`);
css += `\n[hidden]{display:none!important}
.send-btns{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:14px 0}
.ord-txt{width:100%;max-width:640px;font:13px/1.9 inherit;padding:10px;border:1px solid #d9dde3;border-radius:8px;direction:rtl}
.ord-box{max-width:680px;margin:0 auto;text-align:center}
.ord-warn{background:#fff7e6;border:1px solid #ffd591;border-radius:8px;padding:10px 14px;margin:14px 0;text-align:right}
`;
fs.writeFileSync(path.join(OUT, 'static/css/store.css'), css);

let js = fs.readFileSync(path.join(OUT, 'static/js/store.js'), 'utf8');
const rep = (a, b) => { if (!js.includes(a)) throw new Error('پچ store.js ناموفق بود (کد اصلی تغییر کرده است): ' + a); js = js.split(a).join(b); };
rep("const CART = 'shop_cart'", "const B = document.documentElement.dataset.base || '';\nconst CART = 'shop_cart'");
rep("await fetch('/api/cart', {", "await window.__shopApi('cart', {");
rep("await fetch('/api/order', {", "await window.__shopApi('order', {");
rep("'/product/' + encodeURIComponent(l.slug)", "B + '/product/' + encodeURIComponent(l.slug) + '/'");
rep("l.image || '/static/img/ph.svg'", "l.image || B + '/static/img/ph.svg'");
rep("a.href = '/shop'", "a.href = B + '/shop/'");
rep("go.href = '/checkout'", "go.href = B + '/checkout/'");
rep("location.href = '/order-done?code='", "location.href = B + '/order-done/?code='");
fs.writeFileSync(path.join(OUT, 'static/js/store.js'), js);
fs.copyFileSync(path.join(ROOT, 'static-shim.js'), path.join(OUT, 'static/js/static-shim.js'));

/* ---------- داده‌ی عمومی برای سبد خرید و فیلتر (بدون هیچ داده‌ی خصوصی) ---------- */
const live = shop.live(db);
const products = {}, index = [];
for (const p of live) {
  products[p.id] = {
    id: p.id, title: p.title, slug: p.slug, image: prefix((p.images || [])[0] || ''), price: p.price, salePrice: p.salePrice || 0, stock: p.stock ?? null,
    options: p.options || [],
    variants: (p.variants || []).map(v => ({ id: v.id, combo: v.combo || {}, price: v.price ?? null, salePrice: v.salePrice ?? null, stock: v.stock ?? null, active: v.active !== false })),
  };
  const i = shop.pinfo(p);
  index.push({ s: p.slug, id: p.id, min: i.min, st: i.inStock ? 1 : 0, t: U.norm(`${p.title} ${p.sku} ${p.shortDesc}`) });
}
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const coupons = {};
for (const c of db.col('coupons')) coupons[sha(String(c.code).toUpperCase())] = { type: c.type, amount: c.amount || 0, maxDiscount: c.maxDiscount || 0, minOrder: c.minOrder || 0, expires: c.expires || '', active: c.active !== false };
const shipping = db.col('shipping').filter(s => s.active !== false).sort(shop.byOrder).map(s => ({ id: s.id, name: s.name, desc: s.description || '', cost: s.cost || 0, freeOver: s.freeOver || 0 }));
const c0 = ctx();
const social = (kind, v) => {
  v = String(v || '').trim();
  if (!v) return '';
  const h = v.replace(/^@/, '');
  if (/^https?:\/\//i.test(v)) return v;
  if (kind === 'telegram') return 'https://t.me/' + h;
  if (kind === 'eitaa') return 'https://eitaa.com/' + h;
  if (kind === 'whatsapp') return 'https://wa.me/' + U.normPhone(v).replace(/^0/, '98').replace(/\D/g, '');
  return '';
};
const waNum = S.social.whatsapp ? U.normPhone(S.social.whatsapp).replace(/^0/, '98').replace(/\D/g, '') : '';
const labelKeys = ['success_title', 'success_text', 'success_code', 'success_card', 'back_home', 'track_title', 'no_products', 'currency', 'search_title', 'st_pending'];
const labels = Object.fromEntries(labelKeys.map(k => [k, c0.raw(k)]));
const channels = {
  whatsapp: waNum, telegram: social('telegram', S.social.telegram), eitaa: social('eitaa', S.social.eitaa),
  email: S.contact.email || '', phone: S.contact.phone || '',
};
if (!channels.whatsapp && !channels.telegram && !channels.eitaa && !channels.email && !channels.phone)
  warn.push('هیچ راه ارتباطی (واتس‌اپ، تلگرام، ایتا، ایمیل یا تلفن) در تنظیمات ثبت نشده؛ مشتری نمی‌تواند سفارش را برای شما بفرستد. در پنل ← تنظیمات پر کنید.');
const pay = m => ({ enabled: !!S.payments[m].enabled, title: S.payments[m].title || '', ...(m === 'card' ? { number: S.payments.card.number || '', owner: S.payments.card.owner || '' } : {}) });
const shopData = { minOrder: S.shop.minOrder || 0, products, index, coupons, shipping, payments: { cod: pay('cod'), card: pay('card') }, channels, labels };
write('static/data/shop-data.json', JSON.stringify(shopData));

/* ---------- صفحات ---------- */
const counts = { product: 0, category: 0, page: 0 };
write('index.html', render(c => V.home(c)));
write('shop/index.html', render(c => V.listing(c, {}, { path: '/shop' })));
write('search/index.html', render(c => V.listing(c, {}, { path: '/search', search: true })));
write('cart/index.html', render(c => V.cart(c)));
write('checkout/index.html', render(c => V.checkout(c)));

for (const cat of db.col('categories').filter(x => x.active !== false)) {
  if (!safeSeg(cat.slug)) { warn.push(`دسته‌ی «${cat.name}» نامک نامعتبر دارد و رد شد.`); continue; }
  write(`category/${cat.slug}/index.html`, render(c => V.listing(c, {}, { path: '/category/' + u(cat.slug), cat })));
  counts.category++;
}
for (const p of live) {
  if (!safeSeg(p.slug)) { warn.push(`محصول «${p.title}» نامک نامعتبر دارد و رد شد.`); continue; }
  write(`product/${p.slug}/index.html`, render(c => V.product(c, p)));
  counts.product++;
}
for (const pg of db.col('pages').filter(x => x.status === 'published')) {
  if (!safeSeg(pg.slug)) { warn.push(`صفحه‌ی «${pg.title}» نامک نامعتبر دارد و رد شد.`); continue; }
  write(`page/${pg.slug}/index.html`, render(c => V.staticPage(c, pg)));
  counts.page++;
}

// صفحه‌ی پایان سفارش و پیگیری: محتوا را static-shim.js از روی سفارش ذخیره‌شده در مرورگر مشتری می‌سازد
write('order-done/index.html', render(c => ({ title: c.raw('success_title'), noindex: true, body: '<div class="done ord-box" id="od"><p class="muted">…</p></div>' })));
write('track/index.html', render(c => ({ title: c.raw('track_title'), noindex: true, body: `<h1>${c.T('track_title')}</h1><div class="ord-box" id="trk"><p class="muted">…</p></div>` })));
write('404.html', render(c => V.notFound(c)));

/* ---------- robots / sitemap ---------- */
const sm = [''].concat(['/shop/'], db.col('categories').filter(x => x.active !== false).map(x => `/category/${u(x.slug)}/`), live.map(p => `/product/${u(p.slug)}/`),
  db.col('pages').filter(x => x.status === 'published').map(x => `/page/${u(x.slug)}/`));
write('robots.txt', `User-agent: *\nDisallow: ${BASE}/cart/\nDisallow: ${BASE}/checkout/\nDisallow: ${BASE}/order-done/\nDisallow: ${BASE}/track/\nDisallow: ${BASE}/search/\n${SITE ? `Sitemap: ${SITE}/sitemap.xml\n` : ''}`);
if (SITE) write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sm.map(x => `<url><loc>${SITE}${x || '/'}</loc></url>`).join('\n')}\n</urlset>\n`);
write('.nojekyll', '');

fs.rmSync(tmp, { recursive: true, force: true });

console.log(`\n  ساخت نسخه‌ی استاتیک انجام شد → ${OUT}`);
console.log(`  محصول: ${counts.product} | دسته: ${counts.category} | صفحه: ${counts.page} | مسیر پایه: ${BASE || '(ریشه)'}`);
warn.forEach(w => console.log('  ⚠ ' + w));
console.log('  مرحله‌ی بعد: پوشه‌ی docs را روی GitHub بگذارید و در Settings ← Pages منبع را main و /docs انتخاب کنید.\n');
