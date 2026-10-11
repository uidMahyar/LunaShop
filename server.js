'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const os = require('os');
const crypto = require('crypto');

const U = require('./lib/util');
const { Store } = require('./lib/db');
const seedMod = require('./lib/seed');
const shop = require('./lib/shop');
const V = require('./lib/views');
const R = require('./lib/resources');
const { HttpError, str, int } = U;

const ROOT = __dirname;
const PORT = +process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DATA = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const PUB = path.join(ROOT, 'public');
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const VER = require('./package.json').version + '.' + Math.floor(Date.now() / 1000).toString(36);

/* ---------- دیتابیس ---------- */
const db = new Store(DATA);
const firstLogin = db.fresh ? seedMod.seed(db) : null;
seedMod.syncTexts(db);
db.flush();
db.backupDaily();

/* ---------- دسترسی‌ها ---------- */
const PERMS = {
  manager: ['dashboard', 'products', 'categories', 'orders', 'coupons', 'shipping', 'media'],
  editor: ['dashboard', 'pages', 'banners', 'menu_items', 'texts', 'media'],
};
const can = (u, perm) => u.role === 'admin' || (PERMS[u.role] || []).includes(perm);
const pubUser = u => ({ id: u.id, name: u.name, username: u.username, role: u.role, mustChange: !!u.mustChange, perms: u.role === 'admin' ? ['*'] : PERMS[u.role] || [] });

/* ---------- مسیریاب ---------- */
const routes = [];
function route(method, pattern, handler, opts = {}) {
  const keys = [];
  const src = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\/:([a-z]+)/gi, (m, k) => { keys.push(k); return '/([^/]+)'; });
  routes.push({ method, re: new RegExp('^' + src + '/?$'), keys, handler, opts });
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
};
const CSP = "default-src 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'";
const BASE_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'same-origin', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()' };

function send(req, res, status, type, body, extra = {}) {
  const headers = { ...BASE_HEADERS, 'Content-Type': type, ...extra };
  if (type.startsWith('text/html')) headers['Content-Security-Policy'] = CSP;
  if (type.startsWith('application/json') && !headers['Cache-Control']) headers['Cache-Control'] = 'no-store';
  let buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  if (buf.length > 1024 && /\b(gzip)\b/.test(req.headers['accept-encoding'] || '') && /^(text\/|application\/(json|javascript|xml))/.test(type)) {
    buf = zlib.gzipSync(buf);
    headers['Content-Encoding'] = 'gzip';
    headers.Vary = 'Accept-Encoding';
  }
  headers['Content-Length'] = buf.length;
  res.writeHead(status, headers);
  res.end(buf);
}

const plain404 = (req, res) => send(req, res, 404, 'text/plain; charset=utf-8', 'Not found');

function serveStatic(req, res, base, rel, cache) {
  let file;
  try { file = path.join(base, decodeURIComponent(rel)); } catch { return plain404(req, res); }
  if (!file.startsWith(base + path.sep)) return plain404(req, res);
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return plain404(req, res);
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const etag = `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, { ETag: etag }); return res.end(); }
    const extra = { 'Cache-Control': cache, ETag: etag };
    if (/^(text\/|application\/(javascript|json|xml)|image\/svg)/.test(type)) return fs.readFile(file, (e, buf) => (e ? plain404(req, res) : send(req, res, 200, type, buf, extra)));
    res.writeHead(200, { ...BASE_HEADERS, 'Content-Type': type, 'Content-Length': st.size, ...extra });
    fs.createReadStream(file).pipe(res);
  });
}

function notFound(req, res) {
  if (req.pathname.startsWith('/api/')) return send(req, res, 404, 'application/json; charset=utf-8', JSON.stringify({ error: 'پیدا نشد.' }));
  try {
    const c = V.makeCtx(db);
    send(req, res, 404, 'text/html; charset=utf-8', V.layout(c, { ...V.notFound(c), ver: VER }));
  } catch { send(req, res, 404, 'text/plain; charset=utf-8', 'Not found'); }
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0, over = false;
    const chunks = [];
    req.on('data', ch => { size += ch.length; if (size > limit) over = true; else chunks.push(ch); });
    req.on('end', () => (over ? reject(new HttpError(413, 'حجم درخواست بیش از حد مجاز است.')) : resolve(Buffer.concat(chunks))));
    req.on('error', reject);
  });
}

/* ---------- نشست و احراز هویت ---------- */
function sessionUser(req) {
  const t = req.cookies.sid;
  if (!t) return null;
  const s = db.d.sessions[t];
  if (!s) return null;
  if (s.exp < Date.now()) { delete db.d.sessions[t]; return null; }
  const u = db.get('users', s.uid);
  return u && u.active !== false ? u : null;
}
const cookie = (req, name, val, maxAge) => {
  const secure = req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted ? '; Secure' : '';
  return `${name}=${encodeURIComponent(val)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
};

const A = (perm, fn) => async (req, res) => {
  const u = sessionUser(req);
  if (!u) throw new HttpError(401, 'وارد حساب کاربری شوید.');
  if (req.method !== 'GET' && req.headers['x-requested-with'] !== 'shop') throw new HttpError(403, 'درخواست نامعتبر است.');
  if (u.mustChange && !req.opts.allowMust) throw new HttpError(403, 'ابتدا رمز عبور اولیه را تغییر دهید.');
  if (perm && !can(u, perm)) throw new HttpError(403, 'به این بخش دسترسی ندارید.');
  return fn(req, res, u);
};

const loginLimit = U.limiter(10, 10 * 60e3);
route('POST', '/api/admin/login', async (req, res) => {
  const b = req.body || {};
  const username = str(b.username, 60).toLowerCase();
  if (!loginLimit(req.ip + '|' + username)) throw new HttpError(429, 'تلاش‌های ناموفق زیاد بود. چند دقیقه بعد دوباره امتحان کنید.');
  const u = db.col('users').find(x => x.username === username);
  if (!u || u.active === false || !U.checkPw(String(b.password || ''), u.pass)) throw new HttpError(401, 'نام کاربری یا رمز عبور درست نیست.');
  for (const [t, s] of Object.entries(db.d.sessions)) if (s.exp < Date.now()) delete db.d.sessions[t];
  const t = U.token();
  db.d.sessions[t] = { uid: u.id, exp: Date.now() + 14 * 864e5 };
  db.save();
  res.setHeader('Set-Cookie', cookie(req, 'sid', t, 14 * 86400));
  send(req, res, 200, 'application/json; charset=utf-8', JSON.stringify(pubUser(u)));
});
const json = (req, res, o, status = 200) => send(req, res, status, 'application/json; charset=utf-8', JSON.stringify(o));

route('POST', '/api/admin/logout', A(null, (req, res) => {
  delete db.d.sessions[req.cookies.sid];
  db.save();
  res.setHeader('Set-Cookie', cookie(req, 'sid', '', 0));
  json(req, res, { ok: true });
}), { allowMust: true });

route('GET', '/api/admin/me', A(null, (req, res, u) => json(req, res, pubUser(u))), { allowMust: true });

route('POST', '/api/admin/password', A(null, (req, res, u) => {
  const b = req.body || {};
  if (!U.checkPw(String(b.current || ''), u.pass)) throw new HttpError(400, 'رمز فعلی درست نیست.');
  const next = String(b.next || '');
  if (next.length < 8) throw new HttpError(400, 'رمز جدید باید حداقل ۸ کاراکتر باشد.');
  if (next === String(b.current)) throw new HttpError(400, 'رمز جدید باید با رمز فعلی فرق داشته باشد.');
  db.put('users', u.id, { pass: U.hashPw(next), mustChange: false });
  for (const [t, s] of Object.entries(db.d.sessions)) if (s.uid === u.id && t !== req.cookies.sid) delete db.d.sessions[t];
  try { fs.unlinkSync(path.join(DATA, 'FIRST_LOGIN.txt')); } catch { /* ignore */ }
  json(req, res, { ok: true });
}), { allowMust: true });

route('GET', '/api/admin/dashboard', A('dashboard', (req, res) => json(req, res, shop.dashboard(db))));

/* ---------- CRUD عمومی ---------- */
function resOf(req, u) {
  const R_ = R.RES[req.params.res];
  if (!R_) throw new HttpError(404, 'بخش پیدا نشد.');
  if (!can(u, R_.perm)) throw new HttpError(403, 'به این بخش دسترسی ندارید.');
  return R_;
}
const cmp = (a, b) => (typeof a === 'number' && typeof b === 'number') ? a - b : String(a ?? '').localeCompare(String(b ?? ''), 'fa');

function flattenTree(list) {
  const out = [];
  const walk = (parent, depth) => {
    list.filter(c => (c.parent || 0) === parent).sort(shop.byOrder).forEach(c => { out.push({ ...c, depth }); walk(c.id, depth + 1); });
  };
  walk(0, 0);
  for (const c of list) if (!out.some(x => x.id === c.id)) out.push({ ...c, depth: 0 });
  return out;
}

route('GET', '/api/admin/r/:res', A(null, (req, res, u) => {
  const name = req.params.res, Rs = resOf(req, u);
  let items = db.col(name).slice();
  const q = U.norm(req.query.q);
  if (q) items = items.filter(r => (Rs.match && Rs.match(r, q)) || (Rs.search || []).some(f => U.norm(r[f]).includes(q)) || (Rs.coded && String(r.code) === q));
  for (const [k, fn] of Object.entries(Rs.filters || {})) { const v = req.query[k]; if (v != null && v !== '') items = items.filter(r => fn(r, v, db)); }
  const sortKey = str(req.query.sort, 30), dir = req.query.dir === 'asc' ? 1 : -1;
  let rows;
  if (Rs.tree && !q && !sortKey) rows = flattenTree(items).map(r => ({ ...(Rs.out ? Rs.out(r, db) : r), depth: r.depth }));
  else {
    rows = items.map(r => (Rs.out ? Rs.out(r, db) : r));
    if (sortKey) rows.sort((a, b) => dir * cmp(a[sortKey], b[sortKey]));
    else if (Rs.group) rows.sort((a, b) => cmp(Rs.group(a), Rs.group(b)) || shop.byOrder(a, b));
    else rows.sort((a, b) => (b.createdAt || b.id) - (a.createdAt || a.id));
  }
  const per = U.clamp(int(req.query.per, Rs.tree ? 500 : 20), 1, 500), total = rows.length, pages = Math.max(1, Math.ceil(total / per)), page = U.clamp(int(req.query.page, 1), 1, pages);
  const out = { items: rows.slice((page - 1) * per, page * per), total, page, per, pages };
  if (name === 'orders') { out.counts = {}; for (const s of shop.STATUSES) out.counts[s] = db.col('orders').filter(o => o.status === s).length; out.counts.all = db.col('orders').length; }
  json(req, res, out);
}));

route('GET', '/api/admin/r/:res/:id', A(null, (req, res, u) => {
  const Rs = resOf(req, u), rec = db.get(req.params.res, req.params.id);
  if (!rec) throw new HttpError(404, 'پیدا نشد.');
  json(req, res, Rs.one ? Rs.one(rec, db) : rec);
}));

route('POST', '/api/admin/r/:res', A(null, (req, res, u) => {
  const Rs = resOf(req, u);
  if (Rs.noCreate || !Rs.clean) throw new HttpError(405, 'ساخت مورد جدید در این بخش ممکن نیست.');
  const rec = db.add(req.params.res, Rs.clean(req.body || {}, null, db, u), !!Rs.coded);
  json(req, res, Rs.one ? Rs.one(rec, db) : rec, 201);
}));

route('PUT', '/api/admin/r/:res/:id', A(null, (req, res, u) => {
  const Rs = resOf(req, u);
  if (Rs.noUpdate || !Rs.clean) throw new HttpError(405, 'ویرایش در این بخش ممکن نیست.');
  const old = db.get(req.params.res, req.params.id);
  if (!old) throw new HttpError(404, 'پیدا نشد.');
  const rec = db.put(req.params.res, old.id, Rs.clean(req.body || {}, old, db, u));
  if (req.params.res === 'users' && rec.active === false) for (const [t, s] of Object.entries(db.d.sessions)) if (s.uid === rec.id) delete db.d.sessions[t];
  json(req, res, Rs.one ? Rs.one(rec, db) : rec);
}));

function removeOne(Rs, name, rec, u) {
  if (Rs.noDelete) throw new HttpError(405, 'حذف در این بخش ممکن نیست.');
  if (Rs.adminDelete && u.role !== 'admin') throw new HttpError(403, 'فقط مدیرکل می‌تواند حذف کند.');
  if (Rs.onDelete) Rs.onDelete(rec, db, u);
  db.del(name, rec.id);
}

route('DELETE', '/api/admin/r/:res/:id', A(null, (req, res, u) => {
  const Rs = resOf(req, u), rec = db.get(req.params.res, req.params.id);
  if (!rec) throw new HttpError(404, 'پیدا نشد.');
  removeOne(Rs, req.params.res, rec, u);
  json(req, res, { ok: true });
}));

route('POST', '/api/admin/r/:res/bulk', A(null, (req, res, u) => {
  const name = req.params.res, Rs = resOf(req, u), b = req.body || {};
  const action = str(b.action, 20);
  if (Rs.noUpdate && action !== 'delete') throw new HttpError(405, 'عملیات پشتیبانی نمی‌شود.');
  let done = 0, failed = 0;
  for (const id of (Array.isArray(b.ids) ? b.ids : []).slice(0, 500)) {
    const rec = db.get(name, int(id));
    if (!rec) continue;
    try {
      if (action === 'delete') removeOne(Rs, name, rec, u);
      else if (action === 'publish' || action === 'draft') { if (!('status' in rec)) continue; rec.status = action === 'publish' ? 'published' : 'draft'; } else if (action === 'activate' || action === 'deactivate') rec.active = action === 'activate';
      else if (action === 'feature' || action === 'unfeature') rec.featured = action === 'feature';
      else throw new HttpError(400, 'عملیات نامعتبر است.');
      done++;
    } catch (e) { if (e instanceof HttpError && e.status === 400 && action !== 'delete') throw e; failed++; }
  }
  db.save();
  json(req, res, { done, failed });
}));

route('POST', '/api/admin/r/:res/:id/move', A(null, (req, res, u) => {
  const name = req.params.res, Rs = resOf(req, u), rec = db.get(name, req.params.id);
  if (!rec) throw new HttpError(404, 'پیدا نشد.');
  if (!Rs.group) throw new HttpError(405, 'جابجایی پشتیبانی نمی‌شود.');
  const dir = (req.body && req.body.dir) < 0 ? -1 : 1;
  const sibs = db.col(name).filter(x => Rs.group(x) === Rs.group(rec)).sort(shop.byOrder);
  sibs.forEach((x, i) => { x.order = i + 1; });
  const i = sibs.indexOf(rec), j = i + dir;
  if (j >= 0 && j < sibs.length) { const t = sibs[i].order; sibs[i].order = sibs[j].order; sibs[j].order = t; }
  db.save();
  json(req, res, { ok: true });
}));

/* ---------- سفارش‌ها ---------- */
route('POST', '/api/admin/orders/:id/status', A('orders', (req, res, u) => {
  const o = db.get('orders', req.params.id);
  if (!o) throw new HttpError(404, 'سفارش پیدا نشد.');
  shop.setStatus(db, o, str(req.body && req.body.status, 20), u.name);
  const note = str(req.body && req.body.note, 500);
  if (note) o.notes.push({ at: Date.now(), by: u.name, text: note });
  db.save();
  json(req, res, o);
}));
route('POST', '/api/admin/orders/:id/note', A('orders', (req, res, u) => {
  const o = db.get('orders', req.params.id), text = str(req.body && req.body.text, 500);
  if (!o) throw new HttpError(404, 'سفارش پیدا نشد.');
  if (!text) throw new HttpError(400, 'متن یادداشت را بنویسید.');
  o.notes.push({ at: Date.now(), by: u.name, text });
  db.save();
  json(req, res, o);
}));

/* ---------- تنظیمات ---------- */
route('GET', '/api/admin/settings', A('settings', (req, res) => json(req, res, db.settings())));
route('PUT', '/api/admin/settings', A('settings', (req, res) => {
  db.d.settings = R.cleanSettings(req.body || {}, db.settings(), seedMod.DEFAULT_SETTINGS);
  db.save();
  json(req, res, db.settings());
}));

/* ---------- رسانه ---------- */
const MAGIC = [
  ['image/png', 'png', b => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47],
  ['image/jpeg', 'jpg', b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ['image/gif', 'gif', b => b.slice(0, 4).toString() === 'GIF8'],
  ['image/webp', 'webp', b => b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP'],
];
route('POST', '/api/admin/media', A('media', (req, res) => {
  const b = req.body || {}, data = String(b.data || '');
  const i = data.indexOf(';base64,');
  if (!data.startsWith('data:image/') || i < 0) throw new HttpError(400, 'فایل تصویر معتبر نیست.');
  const buf = Buffer.from(data.slice(i + 8), 'base64');
  if (!buf.length || buf.length > 8 * 1024 * 1024) throw new HttpError(400, 'حجم تصویر باید کمتر از ۸ مگابایت باشد.');
  const kind = MAGIC.find(m => m[2](buf));
  if (!kind) throw new HttpError(400, 'فقط تصویر PNG، JPG، WEBP و GIF مجاز است.');
  const file = `${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}.${kind[1]}`;
  fs.writeFileSync(path.join(db.uploads, file), buf);
  const rec = db.add('media', { name: str(b.name, 120) || file, file, url: '/uploads/' + file, size: buf.length, mime: kind[0] });
  json(req, res, rec, 201);
}), { limit: 14 * 1024 * 1024 });

/* ---------- کدها ---------- */
route('GET', '/api/admin/codes', A(null, (req, res, u) => {
  const cols = R.CODED.filter(k => can(u, R.RES[k.col].perm));
  let rows = R.codeRows(db).filter(r => cols.some(k => k.col === r.col));
  const q = U.norm(req.query.q), type = str(req.query.type, 20);
  if (type) rows = rows.filter(r => r.col === type);
  if (q) rows = rows.filter(r => String(r.code) === q || U.norm(r.value).includes(q) || U.norm(r.label).includes(q) || U.norm(r.group).includes(q));
  const per = 100, total = rows.length, pages = Math.max(1, Math.ceil(total / per)), page = U.clamp(int(req.query.page, 1), 1, pages);
  json(req, res, { items: rows.slice((page - 1) * per, page * per), total, page, pages, cols: cols.map(k => ({ col: k.col, type: k.type })) });
}));
route('PUT', '/api/admin/codes', A(null, (req, res, u) => {
  const b = req.body || {};
  const changes = b.text != null ? R.parseCodeLines(b.text) : (b.changes || {});
  const allowed = new Set(R.codeRows(db).filter(r => can(u, R.RES[r.col].perm)).map(r => String(r.code)));
  const ok = {}, denied = [];
  for (const [k, v] of Object.entries(changes)) { if (allowed.has(String(+k))) ok[+k] = v; else denied.push(k); }
  const r = R.applyCodes(db, ok);
  json(req, res, { applied: r.applied, missing: [...r.missing, ...denied] });
}));

/* ---------- ابزارها ---------- */
route('GET', '/api/admin/backup', A('tools', (req, res) => {
  const day = U.dayKey(Date.now()).replace(/-/g, '');
  send(req, res, 200, 'application/json; charset=utf-8', JSON.stringify({ ...db.d, sessions: {} }), { 'Content-Disposition': `attachment; filename="shop-backup-${day}.json"` });
}));
route('POST', '/api/admin/restore', A('tools', (req, res) => {
  const d = req.body;
  if (!d || typeof d !== 'object' || !d.meta || !Array.isArray(d.users) || !d.users.length || !Array.isArray(d.texts)) throw new HttpError(400, 'فایل پشتیبان معتبر نیست.');
  db.backupDaily();
  fs.copyFileSync(db.file, path.join(DATA, 'backups', `before-restore-${Date.now()}.json`));
  db.replaceAll(d);
  seedMod.syncTexts(db);
  json(req, res, { ok: true });
}), { limit: 80 * 1024 * 1024 });
route('POST', '/api/admin/tools/clear-demo', A('tools', (req, res) => {
  const before = db.col('products').length;
  db.d.products = db.col('products').filter(p => !p.demo);
  db.save();
  json(req, res, { removed: before - db.col('products').length });
}));

/* ---------- API عمومی ---------- */
route('POST', '/api/cart', (req, res) => json(req, res, shop.priceCart(db, req.body || {})), { limit: 200 * 1024 });
const orderLimit = U.limiter(40, 3600e3);
route('POST', '/api/order', (req, res) => {
  if (db.settings().maintenance) throw new HttpError(503, 'سایت موقتاً در دسترس نیست.');
  if (!orderLimit(req.ip)) throw new HttpError(429, 'تعداد درخواست‌ها از این شبکه زیاد است. کمی بعد دوباره تلاش کنید.');
  const o = shop.createOrder(db, req.body || {}, req.ip);
  json(req, res, { ok: true, tracking: o.tracking, number: o.number });
}, { limit: 200 * 1024 });

/* ---------- صفحات فروشگاه ---------- */
function storefront(build) {
  return (req, res) => {
    const admin = sessionUser(req);
    if (db.settings().maintenance && !admin) {
      const c = V.makeCtx(db);
      return send(req, res, 503, 'text/html; charset=utf-8', V.layout(c, { ...V.maintenance(c), ver: VER }), { 'Retry-After': '3600' });
    }
    if (admin && req.query.codes != null) res.setHeader('Set-Cookie', cookie(req, 'codes', req.query.codes === '1' ? '1' : '0', 86400 * 30));
    const codes = !!admin && (req.query.codes === '1' || (req.query.codes == null && req.cookies.codes === '1'));
    const c = V.makeCtx(db, { codes });
    c.admin = !!admin;
    const out = build(c, req);
    if (!out) { const nf = V.notFound(c); return send(req, res, 404, 'text/html; charset=utf-8', V.layout(c, { ...nf, ver: VER })); }
    send(req, res, out.status || 200, 'text/html; charset=utf-8', V.layout(c, { ...out, ver: VER }));
  };
}

route('GET', '/', storefront(c => V.home(c)));
route('GET', '/shop', storefront((c, req) => V.listing(c, req.query, { path: '/shop' })));
route('GET', '/search', storefront((c, req) => V.listing(c, req.query, { path: '/search', search: true })));
route('GET', '/category/:slug', storefront((c, req) => {
  const cat = c.db.col('categories').find(x => x.slug === req.params.slug && (x.active !== false || c.admin));
  if (!cat) return null;
  if (!c.cats.some(x => x.id === cat.id)) c.cats.push(cat);
  return V.listing(c, req.query, { path: '/category/' + encodeURIComponent(cat.slug), cat });
}));
route('GET', '/product/:slug', storefront((c, req) => {
  const p = c.db.col('products').find(x => x.slug === req.params.slug && (x.status === 'published' || c.admin));
  return p ? V.product(c, p) : null;
}));
route('GET', '/cart', storefront(c => V.cart(c)));
route('GET', '/checkout', storefront(c => V.checkout(c)));
route('GET', '/order-done', storefront((c, req) => {
  const o = c.db.col('orders').find(x => x.tracking === str(req.query.code, 20).toUpperCase());
  return o ? V.done(c, o) : null;
}));
const trackLimit = U.limiter(40, 10 * 60e3);
route('GET', '/track', storefront((c, req) => {
  if (req.query.code && !trackLimit(req.ip)) return { title: '', body: '<p class="err">تعداد درخواست‌ها زیاد است. چند دقیقه بعد تلاش کنید.</p>', status: 429 };
  return V.track(c, req.query);
}));
route('GET', '/page/:slug', storefront((c, req) => {
  const pg = c.db.col('pages').find(x => x.slug === req.params.slug && (x.status === 'published' || c.admin));
  return pg ? V.staticPage(c, pg) : null;
}));

route('GET', '/admin', (req, res) => {
  fs.readFile(path.join(PUB, 'admin', 'index.html'), (e, buf) => (e ? notFound(req, res) : send(req, res, 200, 'text/html; charset=utf-8', buf.toString().replace(/__VER__/g, VER), { 'Cache-Control': 'no-store' })));
});

route('GET', '/robots.txt', (req, res) => send(req, res, 200, 'text/plain; charset=utf-8', `User-agent: *\nDisallow: /admin\nDisallow: /api/\nDisallow: /cart\nDisallow: /checkout\nDisallow: /track\nSitemap: ${origin(req)}/sitemap.xml\n`));
route('GET', '/sitemap.xml', (req, res) => {
  const o = origin(req), url = p => `<url><loc>${U.esc(o + p)}</loc></url>`;
  const urls = ['/', '/shop']
    .concat(db.col('categories').filter(c => c.active !== false).map(c => '/category/' + encodeURIComponent(c.slug)))
    .concat(shop.live(db).map(p => '/product/' + encodeURIComponent(p.slug)))
    .concat(db.col('pages').filter(p => p.status === 'published').map(p => '/page/' + encodeURIComponent(p.slug)));
  send(req, res, 200, 'application/xml; charset=utf-8', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url).join('')}</urlset>`);
});
route('GET', '/favicon.ico', (req, res) => {
  const f = db.settings().theme.favicon;
  if (f) { res.writeHead(302, { Location: f }); return res.end(); }
  res.writeHead(204); res.end();
});
function origin(req) { return (req.headers['x-forwarded-proto'] || (req.socket.encrypted ? 'https' : 'http')) + '://' + (req.headers.host || 'localhost'); }

/* ---------- هسته‌ی درخواست ---------- */
async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  req.pathname = url.pathname;
  req.query = Object.fromEntries(url.searchParams);
  req.cookies = U.parseCookies(req.headers.cookie);
  req.ip = (TRUST_PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '';

  if (req.pathname.startsWith('/static/')) return serveStatic(req, res, PUB, req.pathname.slice(8), req.pathname.startsWith('/static/admin/') ? 'no-cache' : 'public, max-age=3600');
  if (req.pathname.startsWith('/uploads/')) return serveStatic(req, res, db.uploads, req.pathname.slice(9), 'public, max-age=604800');

  const method = req.method === 'HEAD' ? 'GET' : req.method;
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = r.re.exec(req.pathname);
    if (!m) continue;
    req.params = {};
    try { r.keys.forEach((k, i) => { req.params[k] = decodeURIComponent(m[i + 1]); }); } catch { throw new HttpError(400, 'آدرس نامعتبر است.'); }
    req.opts = r.opts;
    req.body = {};
    if (method !== 'GET') {
      const raw = await readBody(req, r.opts.limit || 1024 * 1024);
      if (raw.length && /json/.test(req.headers['content-type'] || '')) {
        try { req.body = JSON.parse(raw.toString('utf8')); } catch { throw new HttpError(400, 'قالب درخواست نامعتبر است.'); }
      }
    }
    return r.handler(req, res);
  }
  return notFound(req, res);
}

const server = http.createServer((req, res) => {
  handle(req, res).catch(err => {
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error('[error]', req.method, req.url, err);
    if (res.headersSent) return res.end();
    const msg = err instanceof HttpError ? err.message : 'خطای داخلی سرور. دوباره تلاش کنید.';
    if ((req.pathname || '').startsWith('/api/')) return send(req, res, status, 'application/json; charset=utf-8', JSON.stringify({ error: msg }));
    send(req, res, status, 'text/plain; charset=utf-8', msg);
  });
});
server.requestTimeout = 60000;

server.on('error', e => {
  console.error(e.code === 'EADDRINUSE' ? `\n  Port ${PORT} is already in use. Close the other program or set another port (PORT=3001).\n` : e);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  const ips = Object.values(os.networkInterfaces()).flat().filter(n => n && n.family === 'IPv4' && !n.internal).map(n => n.address);
  console.log('\n  =========================================');
  console.log('   Shop is running');
  console.log(`   Site : http://localhost:${PORT}`);
  ips.forEach(ip => console.log(`          http://${ip}:${PORT}   (same network / phone)`));
  console.log(`   Admin: http://localhost:${PORT}/admin`);
  if (firstLogin) {
    console.log('  -----------------------------------------');
    console.log('   FIRST LOGIN (saved in data/FIRST_LOGIN.txt)');
    console.log(`   username: ${firstLogin.username}`);
    console.log(`   password: ${firstLogin.password}`);
  }
  console.log('  =========================================\n');
});

const bye = () => { try { db.flush(); } catch { /* ignore */ } process.exit(0); };
process.on('SIGINT', bye);
process.on('SIGTERM', bye);
process.on('uncaughtException', e => console.error('[uncaught]', e));
