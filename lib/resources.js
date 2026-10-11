'use strict';
const fs = require('fs');
const path = require('path');
const U = require('./util');
const shop = require('./shop');
const { HttpError, str, int, numOrNull, uniqueSlug, cleanHtml, color, safeLink } = U;
const bad = m => new HttpError(400, m);
const nextOrder = (list, pred = () => true) => list.filter(pred).reduce((m, r) => Math.max(m, r.order || 0), 0) + 1;
const orderOf = (b, old, list, pred) => (b.order === '' || b.order == null) ? (old ? old.order : nextOrder(list, pred)) : int(b.order);
const adminsLeft = (db, exceptId) => db.col('users').filter(u => u.role === 'admin' && u.active !== false && u.id !== exceptId).length;

/* هر منبع: perm (دسترسی)، coded (دارای کد)، label (فیلد اصلی)، search، filters، group (برای جابجایی)،
   clean (اعتبارسنجی)، out (خروجی لیست)، one (خروجی تکی)، onDelete، noCreate/noUpdate/noDelete */
const RES = {
  categories: {
    perm: 'categories', coded: true, label: 'name', search: ['name', 'slug'], tree: true, group: r => r.parent || 0,
    clean(b, old, db) {
      const name = str(b.name, 120);
      if (!name) throw bad('نام دسته را وارد کنید.');
      let parent = int(b.parent);
      if (parent && !db.get('categories', parent)) parent = 0;
      if (old && parent) {
        let x = parent, guard = 0;
        while (x && guard++ < 50) {
          if (x === old.id) throw bad('یک دسته نمی‌تواند زیرمجموعه‌ی خودش (یا زیرمجموعه‌های خودش) باشد.');
          x = (db.get('categories', x) || {}).parent || 0;
        }
      }
      const list = db.col('categories');
      return {
        name, slug: uniqueSlug(list, b.slug || name, old && old.id, 'category'), parent,
        image: str(b.image, 300), description: str(b.description, 2000),
        order: orderOf(b, old, list, r => (r.parent || 0) === parent),
        active: b.active !== false, metaTitle: str(b.metaTitle, 120), metaDesc: str(b.metaDesc, 300),
      };
    },
    onDelete(rec, db) {
      for (const c of db.col('categories')) if (c.parent === rec.id) c.parent = rec.parent || 0;
      for (const p of db.col('products')) p.categories = (p.categories || []).filter(i => i !== rec.id);
    },
    out: (r, db) => ({ ...r, count: db.col('products').filter(p => (p.categories || []).includes(r.id)).length }),
  },

  products: {
    perm: 'products', coded: true, label: 'title', search: ['title', 'sku', 'slug'],
    filters: {
      status: (r, v) => r.status === v,
      category: (r, v) => (r.categories || []).includes(+v),
      stock: (r, v, db) => {
        const s = shop.stockOf(r);
        if (v === 'out') return s != null && s <= 0;
        if (v === 'low') return s != null && s > 0 && s <= db.settings().shop.lowStock;
        return true;
      },
    },
    clean(b, old, db) {
      const title = str(b.title, 200);
      if (!title) throw bad('عنوان محصول را وارد کنید.');
      const price = Math.max(0, int(b.price));
      let sale = Math.max(0, int(b.salePrice));
      if (sale >= price) sale = 0;
      const options = [];
      for (const o of (Array.isArray(b.options) ? b.options : []).slice(0, 3)) {
        const name = str(o && o.name, 40);
        const values = [...new Set((Array.isArray(o && o.values) ? o.values : []).map(v => str(v, 40)).filter(Boolean))].slice(0, 30);
        if (name && values.length && !options.some(x => x.name === name)) options.push({ name, values });
      }
      const variants = [];
      if (options.length) {
        const seen = new Set();
        let maxId = Math.max(0, ...(Array.isArray(b.variants) ? b.variants : []).map(v => int(v && v.id)), ...((old && old.variants) || []).map(v => v.id));
        for (const v of (Array.isArray(b.variants) ? b.variants : []).slice(0, 200)) {
          const combo = {};
          let ok = true;
          for (const o of options) {
            const val = v && v.combo && v.combo[o.name];
            if (!o.values.includes(val)) { ok = false; break; }
            combo[o.name] = val;
          }
          if (!ok) continue;
          const key = options.map(o => combo[o.name]).join('\u0001');
          if (seen.has(key)) continue;
          seen.add(key);
          let id = int(v.id);
          if (!id || variants.some(x => x.id === id)) id = ++maxId;
          variants.push({ id, combo, sku: str(v.sku, 60), price: numOrNull(v.price), salePrice: numOrNull(v.salePrice), stock: numOrNull(v.stock), active: v.active !== false });
        }
        if (!variants.length) throw bad('برای محصول دارای گزینه (سایز، رنگ و...) باید تنوع‌ها ساخته شوند.');
      }
      const cats = [...new Set((Array.isArray(b.categories) ? b.categories : []).map(x => int(x)))].filter(id => db.get('categories', id));
      const images = (Array.isArray(b.images) ? b.images : []).map(s => str(s, 300)).filter(s => /^(\/|https?:\/\/)/.test(s)).slice(0, 20);
      const specs = (Array.isArray(b.specs) ? b.specs : []).map(s => ({ k: str(s && s.k, 80), v: str(s && s.v, 300) })).filter(s => s.k && s.v).slice(0, 40);
      return {
        title, slug: uniqueSlug(db.col('products'), b.slug || title, old && old.id, 'product'),
        status: b.status === 'draft' ? 'draft' : 'published', featured: !!b.featured, categories: cats,
        price, salePrice: sale, sku: str(b.sku, 60), stock: options.length ? null : numOrNull(b.stock),
        images, shortDesc: str(b.shortDesc, 500), desc: cleanHtml(b.desc), sizeChart: cleanHtml(b.sizeChart), specs,
        options, variants, metaTitle: str(b.metaTitle, 120), metaDesc: str(b.metaDesc, 300),
      };
    },
    out: (r, db) => {
      const i = shop.pinfo(r);
      return {
        id: r.id, code: r.code, title: r.title, slug: r.slug, status: r.status, featured: !!r.featured, sku: r.sku,
        image: (r.images || [])[0] || '', price: i.min, max: i.max, onSale: i.onSale, stock: shop.stockOf(r), variants: (r.variants || []).length,
        categories: (r.categories || []).map(id => (db.get('categories', id) || {}).name).filter(Boolean), createdAt: r.createdAt,
      };
    },
  },

  orders: {
    perm: 'orders', noCreate: true, noUpdate: true, adminDelete: true, search: [],
    match: (r, q) => String(r.number) === q || U.norm(r.tracking).includes(q) || U.norm(r.customer.name).includes(q) || r.customer.phone.includes(q),
    filters: { status: (r, v) => r.status === v },
    out: r => ({
      id: r.id, number: r.number, tracking: r.tracking, status: r.status, name: r.customer.name, phone: r.customer.phone, city: r.customer.city,
      total: r.total, qty: r.items.reduce((s, i) => s + i.qty, 0), payment: r.payment.title, createdAt: r.createdAt,
    }),
  },

  coupons: {
    perm: 'coupons', label: 'code', search: ['code'],
    filters: { active: (r, v) => String(r.active !== false) === v },
    clean(b, old, db) {
      const code = str(b.code, 30).toUpperCase().replace(/[^A-Z0-9_-]/g, '');
      if (code.length < 3) throw bad('کد تخفیف باید حداقل ۳ حرف یا عدد انگلیسی باشد.');
      if (db.col('coupons').some(c => c.code === code && c.id !== (old && old.id))) throw bad('این کد قبلاً ثبت شده است.');
      const type = b.type === 'fixed' ? 'fixed' : 'percent';
      let amount = Math.max(0, int(b.amount));
      if (type === 'percent') amount = Math.min(100, amount);
      if (!amount) throw bad('مقدار تخفیف را وارد کنید.');
      return {
        code, type, amount, minOrder: Math.max(0, int(b.minOrder)), maxDiscount: Math.max(0, int(b.maxDiscount)),
        usageLimit: Math.max(0, int(b.usageLimit)), expires: /^\d{4}-\d{2}-\d{2}$/.test(String(b.expires || '')) ? b.expires : '',
        active: b.active !== false, used: old ? old.used || 0 : 0,
      };
    },
  },

  shipping: {
    perm: 'shipping', coded: true, label: 'name', search: ['name'], group: () => 0,
    clean(b, old, db) {
      const name = str(b.name, 80);
      if (!name) throw bad('نام روش ارسال را وارد کنید.');
      return { name, cost: Math.max(0, int(b.cost)), freeOver: Math.max(0, int(b.freeOver)), description: str(b.description, 200), order: orderOf(b, old, db.col('shipping')), active: b.active !== false };
    },
  },

  banners: {
    perm: 'banners', coded: true, label: 'title', search: ['title', 'subtitle'], group: () => 0,
    clean(b, old, db) {
      const title = str(b.title, 120);
      if (!title) throw bad('عنوان بنر را وارد کنید.');
      return {
        title, subtitle: str(b.subtitle, 200), buttonText: str(b.buttonText, 40), link: safeLink(b.link), image: str(b.image, 300),
        bg: color(b.bg, '#1b1f2a'), order: orderOf(b, old, db.col('banners')), active: b.active !== false,
      };
    },
  },

  pages: {
    perm: 'pages', coded: true, label: 'title', search: ['title', 'slug'], filters: { status: (r, v) => r.status === v },
    clean(b, old, db) {
      const title = str(b.title, 150);
      if (!title) throw bad('عنوان صفحه را وارد کنید.');
      return { title, slug: uniqueSlug(db.col('pages'), b.slug || title, old && old.id, 'page'), content: cleanHtml(b.content), status: b.status === 'draft' ? 'draft' : 'published', order: int(b.order), metaTitle: str(b.metaTitle, 120), metaDesc: str(b.metaDesc, 300) };
    },
  },

  menu_items: {
    perm: 'menu_items', coded: true, label: 'label', search: ['label', 'url'], filters: { menu: (r, v) => r.menu === v }, group: r => r.menu,
    clean(b, old, db) {
      const label = str(b.label, 80);
      if (!label) throw bad('عنوان آیتم منو را وارد کنید.');
      const url = safeLink(b.url);
      if (!url) throw bad('آدرس لینک معتبر نیست (مثال: /shop یا https://...).');
      const menu = b.menu === 'footer' ? 'footer' : 'header';
      return { menu, label, url, order: orderOf(b, old, db.col('menu_items'), r => r.menu === menu), active: b.active !== false, newTab: !!b.newTab };
    },
  },

  texts: {
    perm: 'texts', coded: true, label: 'value', search: ['value', 'label', 'key', 'group'], noCreate: true, noDelete: true,
    filters: { group: (r, v) => r.group === v },
    clean: b => ({ value: str(b.value, 2000) }),
  },

  users: {
    perm: 'users', label: 'name', search: ['name', 'username'],
    out: r => ({ id: r.id, name: r.name, username: r.username, role: r.role, active: r.active !== false, createdAt: r.createdAt }),
    one: r => ({ id: r.id, name: r.name, username: r.username, role: r.role, active: r.active !== false }),
    clean(b, old, db) {
      const name = str(b.name, 80);
      if (!name) throw bad('نام را وارد کنید.');
      const username = str(b.username, 40).toLowerCase();
      if (!/^[a-z0-9_.]{3,40}$/.test(username)) throw bad('نام کاربری باید انگلیسی باشد (حروف کوچک، عدد، نقطه و _ ؛ حداقل ۳ کاراکتر).');
      if (db.col('users').some(x => x.username === username && x.id !== (old && old.id))) throw bad('این نام کاربری قبلاً استفاده شده است.');
      const role = ['admin', 'manager', 'editor'].includes(b.role) ? b.role : 'editor';
      const active = b.active !== false;
      const out = { name, username, role, active };
      if (b.password) {
        if (String(b.password).length < 8) throw bad('رمز عبور باید حداقل ۸ کاراکتر باشد.');
        out.pass = U.hashPw(String(b.password));
        out.mustChange = false;
      } else if (!old) throw bad('برای کاربر جدید رمز عبور لازم است.');
      if (old && old.role === 'admin' && (role !== 'admin' || !active) && adminsLeft(db, old.id) === 0) throw bad('حداقل یک مدیرکل فعال باید وجود داشته باشد.');
      return out;
    },
    onDelete(rec, db, me) {
      if (me && rec.id === me.id) throw bad('حساب خودتان را نمی‌توانید حذف کنید.');
      if (rec.role === 'admin' && adminsLeft(db, rec.id) === 0) throw bad('حداقل یک مدیرکل فعال باید وجود داشته باشد.');
      for (const [t, s] of Object.entries(db.d.sessions)) if (s.uid === rec.id) delete db.d.sessions[t];
    },
  },

  media: {
    perm: 'media', label: 'name', search: ['name'], noCreate: true, noUpdate: true,
    onDelete(rec, db) {
      const f = path.join(db.uploads, path.basename(rec.file || ''));
      if (rec.file && f.startsWith(db.uploads)) { try { fs.unlinkSync(f); } catch { /* already gone */ } }
    },
  },
};

/* ---------- کدها ---------- */
const CODED = [
  { col: 'texts', field: 'value', type: 'متن سایت' },
  { col: 'categories', field: 'name', type: 'دسته' },
  { col: 'products', field: 'title', type: 'محصول' },
  { col: 'banners', field: 'title', type: 'بنر' },
  { col: 'pages', field: 'title', type: 'صفحه' },
  { col: 'menu_items', field: 'label', type: 'منو' },
  { col: 'shipping', field: 'name', type: 'روش ارسال' },
];

function codeRows(db) {
  const rows = [];
  for (const k of CODED) for (const r of db.col(k.col)) if (r.code) rows.push({ code: r.code, col: k.col, id: r.id, type: k.type, label: k.col === 'texts' ? r.label : '', group: r.group || '', value: r[k.field] || '', def: k.col === 'texts' ? r.def : undefined });
  return rows.sort((a, b) => a.code - b.code);
}

function applyCodes(db, changes) {
  const map = new Map();
  for (const k of CODED) for (const r of db.col(k.col)) if (r.code) map.set(r.code, { r, field: k.field, col: k.col });
  const missing = [];
  let applied = 0;
  for (const [code, val] of Object.entries(changes || {})) {
    const hit = map.get(+code);
    const v = str(val, hit && hit.col === 'texts' ? 2000 : 200);
    if (!hit || (!v && hit.col !== 'texts')) { missing.push(code); continue; }
    hit.r[hit.field] = v;
    hit.r.updatedAt = Date.now();
    applied++;
  }
  if (applied) db.save();
  return { applied, missing };
}

function parseCodeLines(text) {
  const out = {};
  for (const line of String(text || '').split(/\r?\n/)) {
    const m = /^\s*(?:code|کد)?\s*([0-9۰-۹٠-٩]+)\s*(?:=|:|：|→|->|=>)\s*(.+?)\s*$/i.exec(line);
    if (m) out[U.digits(m[1])] = m[2];
  }
  return out;
}

/* ---------- تنظیمات ---------- */
function cleanSettings(b, cur, D) {
  const g = (o, k, max = 300) => str(o && o[k], max);
  const s = { ...cur };
  s.contact = { phone: g(b.contact, 'phone', 40), email: g(b.contact, 'email', 100), address: g(b.contact, 'address', 300), hours: g(b.contact, 'hours', 100) };
  s.social = { instagram: g(b.social, 'instagram', 120), telegram: g(b.social, 'telegram', 120), whatsapp: g(b.social, 'whatsapp', 120), eitaa: g(b.social, 'eitaa', 120) };
  const t = b.theme || {};
  s.theme = {
    primary: color(t.primary, D.theme.primary), accent: color(t.accent, D.theme.accent), sale: color(t.sale, D.theme.sale),
    radius: U.clamp(int(t.radius, 6), 0, 24), logo: g(t, 'logo'), favicon: g(t, 'favicon'),
  };
  s.seo = { title: g(b.seo, 'title', 120), description: g(b.seo, 'description', 300) };
  const sh = b.shop || {};
  s.shop = {
    perPage: U.clamp(int(sh.perPage, 12) || 12, 4, 60), lowStock: U.clamp(int(sh.lowStock, 3), 0, 1000),
    showOutOfStock: !!sh.showOutOfStock, catsInHeader: !!sh.catsInHeader, minOrder: Math.max(0, int(sh.minOrder)),
  };
  const p = b.payments || {};
  s.payments = {
    cod: { enabled: !!(p.cod && p.cod.enabled), title: g(p.cod, 'title', 60) || D.payments.cod.title },
    card: { enabled: !!(p.card && p.card.enabled), title: g(p.card, 'title', 60) || D.payments.card.title, number: g(p.card, 'number', 30), owner: g(p.card, 'owner', 80) },
  };
  s.maintenance = !!b.maintenance;
  return s;
}

module.exports = { RES, CODED, codeRows, applyCodes, parseCodeLines, cleanSettings };
