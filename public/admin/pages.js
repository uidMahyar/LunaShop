(() => {
'use strict';
const AD = window.AD;
const { h, api, fmt, jd, ico, chip, toast, ask, busy, codeBadge, STAT, STAT_KIND, CFG } = AD;
const pnum = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
AD.pnum = pnum;
const go = (path, q) => { const s = new URLSearchParams(Object.entries(q || {}).filter(([, v]) => v !== '' && v != null)).toString(); location.hash = '#/' + path + (s ? '?' + s : ''); };
AD.go = go;
const dateFa = iso => new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'medium', timeZone: 'Asia/Tehran' }).format(new Date(iso + 'T12:00:00+03:30'));
const money = n => `${fmt(n)} تومان`;
const yesno = r => chip(r.active === false ? 'غیرفعال' : 'فعال', r.active === false ? '' : 'ok');
const link = (name, r, text) => h('a', { class: 'rowlink', href: `#/${name}/${r.id}` }, text);
const label = (C, r) => (C.label ? C.label(r) : r.name || r.title || r.code || r.label || '#' + r.id);
const PUB = [['published', 'منتشر شده'], ['draft', 'پیش‌نویس']];
const ROLES = [['admin', 'مدیرکل'], ['manager', 'مدیر فروشگاه'], ['editor', 'ویرایشگر محتوا']];
const ROLE_FA = Object.fromEntries(ROLES);
AD.PUB = PUB;

/* ================= تعریف بخش‌ها ================= */
CFG.categories = {
  title: 'دسته‌ها', one: 'دسته', move: true, afterSave: () => AD.dropCats(),
  bulk: [['activate', 'فعال‌سازی'], ['deactivate', 'غیرفعال‌سازی'], ['delete', 'حذف', true]],
  viewUrl: r => '/category/' + encodeURIComponent(r.slug),
  cols: [
    { t: 'نام', cell: r => h('span', { style: { paddingInlineStart: (r.depth || 0) * 20 + 'px' } }, r.depth ? '↳ ' : '', link('categories', r, r.name), ' ', codeBadge(r)) },
    { t: 'نامک', cell: r => h('span', { class: 'muted', dir: 'ltr' }, r.slug) },
    { t: 'محصولات', cell: r => fmt(r.count) },
    { t: 'وضعیت', cell: yesno },
  ],
  fields: [
    { k: 'name', t: 'نام دسته', req: true },
    { k: 'slug', t: 'نامک (آدرس)', ltr: true, help: 'خالی بگذارید تا خودکار از نام ساخته شود.' },
    { k: 'parent', t: 'دسته‌ی والد', type: 'catparent' },
    { k: 'image', t: 'تصویر', type: 'image' },
    { k: 'description', t: 'توضیح کوتاه', type: 'textarea' },
    { k: 'active', t: 'فعال (نمایش در سایت)', type: 'bool' },
    { k: 'metaTitle', t: 'عنوان سئو', help: 'اختیاری' },
    { k: 'metaDesc', t: 'توضیح سئو', type: 'textarea', rows: 2 },
  ],
};

CFG.coupons = {
  title: 'کدهای تخفیف', one: 'کد تخفیف', defaults: { type: 'percent' },
  bulk: [['activate', 'فعال‌سازی'], ['deactivate', 'غیرفعال‌سازی'], ['delete', 'حذف', true]],
  filters: [{ k: 'active', t: 'وضعیت', opts: [['', 'همه'], ['true', 'فعال'], ['false', 'غیرفعال']] }],
  cols: [
    { t: 'کد', cell: r => link('coupons', r, h('b', { dir: 'ltr' }, r.code)) },
    { t: 'تخفیف', cell: r => (r.type === 'percent' ? `${fmt(r.amount)}٪` : money(r.amount)) },
    { t: 'حداقل سفارش', cell: r => (r.minOrder ? fmt(r.minOrder) : '—') },
    { t: 'استفاده', cell: r => fmt(r.used || 0) + (r.usageLimit ? ' از ' + fmt(r.usageLimit) : '') },
    { t: 'انقضا', cell: r => (r.expires ? dateFa(r.expires) : '—') },
    { t: 'وضعیت', cell: yesno },
  ],
  fields: [
    { k: 'code', t: 'کد (انگلیسی)', ltr: true, req: true, help: 'مثلاً OFF20 — حروف و عدد انگلیسی.' },
    { k: 'type', t: 'نوع تخفیف', type: 'select', opts: [['percent', 'درصدی'], ['fixed', 'مبلغ ثابت (تومان)']] },
    { k: 'amount', t: 'مقدار تخفیف', type: 'number', req: true, help: 'درصد (۱ تا ۱۰۰) یا مبلغ به تومان' },
    { k: 'minOrder', t: 'حداقل مبلغ سفارش', type: 'number', help: '۰ = بدون محدودیت' },
    { k: 'maxDiscount', t: 'سقف تخفیف (برای درصدی)', type: 'number', help: '۰ = بدون سقف' },
    { k: 'usageLimit', t: 'حداکثر دفعات استفاده', type: 'number', help: '۰ = نامحدود' },
    { k: 'expires', t: 'تاریخ انقضا', type: 'date', help: 'خالی = بدون انقضا' },
    { k: 'active', t: 'فعال', type: 'bool' },
  ],
};

CFG.shipping = {
  title: 'روش‌های ارسال', one: 'روش ارسال', move: true,
  cols: [
    { t: 'نام', cell: r => h('span', {}, link('shipping', r, r.name), ' ', codeBadge(r)) },
    { t: 'هزینه', cell: r => (r.cost ? money(r.cost) : 'رایگان') },
    { t: 'رایگان از مبلغ', cell: r => (r.freeOver ? money(r.freeOver) : '—') },
    { t: 'وضعیت', cell: yesno },
  ],
  fields: [
    { k: 'name', t: 'نام روش ارسال', req: true },
    { k: 'cost', t: 'هزینه (تومان)', type: 'number', help: '۰ = رایگان' },
    { k: 'freeOver', t: 'ارسال رایگان برای سفارش‌های بالاتر از', type: 'number', help: '۰ = غیرفعال' },
    { k: 'description', t: 'توضیح (مثلاً زمان تحویل)' },
    { k: 'active', t: 'فعال', type: 'bool' },
  ],
};

CFG.banners = {
  title: 'بنرها (اسلایدر صفحه اصلی)', one: 'بنر', move: true,
  bulk: [['activate', 'فعال‌سازی'], ['deactivate', 'غیرفعال‌سازی'], ['delete', 'حذف', true]],
  cols: [
    { t: '', cell: r => h('span', { class: 'swatch', style: { background: r.bg } }, r.image ? h('img', { src: r.image, alt: '' }) : null) },
    { t: 'عنوان', cell: r => h('span', {}, link('banners', r, r.title), ' ', codeBadge(r)) },
    { t: 'لینک', cell: r => h('span', { class: 'muted', dir: 'ltr' }, r.link || '—') },
    { t: 'وضعیت', cell: yesno },
  ],
  fields: [
    { k: 'title', t: 'عنوان بنر', req: true },
    { k: 'subtitle', t: 'متن زیر عنوان' },
    { k: 'buttonText', t: 'متن دکمه', help: 'خالی = بدون دکمه' },
    { k: 'link', t: 'لینک بنر', ltr: true, help: 'مثلاً /shop یا /category/نامک یا https://...' },
    { k: 'image', t: 'تصویر بنر', type: 'image', help: 'اندازه‌ی پیشنهادی ۱۶۰۰×۶۰۰ (اختیاری؛ بدون تصویر از رنگ زمینه استفاده می‌شود)' },
    { k: 'bg', t: 'رنگ زمینه', type: 'color' },
    { k: 'active', t: 'فعال', type: 'bool' },
  ],
};

CFG.pages = {
  title: 'صفحات', one: 'صفحه', defaults: { content: '' },
  viewUrl: r => '/page/' + encodeURIComponent(r.slug),
  bulk: [['publish', 'انتشار'], ['draft', 'پیش‌نویس'], ['delete', 'حذف', true]],
  filters: [{ k: 'status', t: 'وضعیت', opts: [['', 'همه'], ...PUB] }],
  cols: [
    { t: 'عنوان', cell: r => h('span', {}, link('pages', r, r.title), ' ', codeBadge(r)) },
    { t: 'نامک', cell: r => h('span', { class: 'muted', dir: 'ltr' }, '/page/' + r.slug) },
    { t: 'وضعیت', cell: r => chip(r.status === 'draft' ? 'پیش‌نویس' : 'منتشر شده', r.status === 'draft' ? '' : 'ok') },
    { t: 'آخرین ویرایش', cell: r => jd(r.updatedAt) },
  ],
  fields: [
    { k: 'title', t: 'عنوان صفحه', req: true },
    { k: 'slug', t: 'نامک (آدرس)', ltr: true, help: 'خالی = خودکار' },
    { k: 'content', t: 'محتوا', type: 'rich' },
    { k: 'status', t: 'وضعیت', type: 'select', opts: PUB },
    { k: 'metaTitle', t: 'عنوان سئو' },
    { k: 'metaDesc', t: 'توضیح سئو', type: 'textarea', rows: 2 },
  ],
};

CFG.menu_items = {
  title: 'منوها (هدر و فوتر)', one: 'آیتم منو', move: true, defaults: { menu: 'header' },
  bulk: [['activate', 'فعال‌سازی'], ['deactivate', 'غیرفعال‌سازی'], ['delete', 'حذف', true]],
  filters: [{ k: 'menu', t: 'منو', opts: [['', 'همه'], ['header', 'منوی بالا'], ['footer', 'منوی پایین']] }],
  cols: [
    { t: 'عنوان', cell: r => h('span', {}, link('menu_items', r, r.label), ' ', codeBadge(r)) },
    { t: 'آدرس', cell: r => h('span', { class: 'muted', dir: 'ltr' }, r.url) },
    { t: 'منو', cell: r => chip(r.menu === 'footer' ? 'پایین' : 'بالا') },
    { t: 'وضعیت', cell: yesno },
  ],
  fields: [
    { k: '_pick', t: 'انتخاب سریع صفحه/دسته', type: 'select', virtual: true, help: 'با انتخاب، عنوان و آدرس خودکار پر می‌شود.', opts: () => [['', '— انتخاب کنید —'], ...(CFG.menu_items._quick || [])] },
    { k: 'menu', t: 'محل نمایش', type: 'select', opts: [['header', 'منوی بالای سایت'], ['footer', 'منوی پایین سایت']] },
    { k: 'label', t: 'عنوان', req: true },
    { k: 'url', t: 'آدرس لینک', ltr: true, req: true, help: 'مثلاً /shop یا https://...' },
    { k: 'newTab', t: 'باز شدن در تب جدید', type: 'bool' },
    { k: 'active', t: 'فعال', type: 'bool' },
  ],
  prepare: async () => {
    const [cats, pages] = await Promise.all([AD.cats(), api('GET', '/r/pages?per=200').catch(() => ({ items: [] }))]);
    CFG.menu_items._quick = [['/shop|فروشگاه', 'فروشگاه (همه محصولات)'], ['/track|پیگیری سفارش', 'پیگیری سفارش'], ['/cart|سبد خرید', 'سبد خرید'], ...pages.items.map(p => [`/page/${encodeURIComponent(p.slug)}|${p.title}`, 'صفحه: ' + p.title]), ...cats.map(c => [`/category/${encodeURIComponent(c.slug)}|${c.name}`, 'دسته: ' + '— '.repeat(c.depth || 0) + c.name])];
  },
  onForm: form => {
    form.handles._pick.el.onchange = e => {
      const [url, ...rest] = e.target.value.split('|');
      if (!url) return;
      form.handles.url.set(url);
      if (!form.handles.label.get()) form.handles.label.set(rest.join('|'));
    };
  },
};

CFG.users = {
  title: 'کاربران', one: 'کاربر', defaults: { role: 'editor' },
  cols: [
    { t: 'نام', cell: r => link('users', r, r.name) },
    { t: 'نام کاربری', cell: r => h('span', { dir: 'ltr' }, r.username) },
    { t: 'نقش', cell: r => chip(ROLE_FA[r.role] || r.role, r.role === 'admin' ? 'info' : '') },
    { t: 'وضعیت', cell: yesno },
  ],
  fields: [
    { k: 'name', t: 'نام نمایشی', req: true },
    { k: 'username', t: 'نام کاربری (انگلیسی)', ltr: true, req: true },
    { k: 'password', t: 'رمز عبور', type: 'password', virtual: false, help: 'برای کاربر جدید الزامی است؛ هنگام ویرایش خالی بگذارید تا تغییر نکند. حداقل ۸ کاراکتر.' },
    { k: 'role', t: 'نقش', type: 'select', opts: ROLES, help: 'مدیرکل: همه‌چیز — مدیر فروشگاه: محصولات و سفارش‌ها — ویرایشگر: محتوا (صفحات، بنرها، منوها، کدها)' },
    { k: 'active', t: 'فعال', type: 'bool' },
  ],
};

CFG.orders = {
  title: 'سفارش‌ها', one: 'سفارش', create: false, del: false,
  tabs: { k: 'status', items: Object.entries(STAT) },
  label: r => 'سفارش ' + pnum(r.number),
  cols: [
    { t: 'شماره', cell: r => link('orders', r, '#' + pnum(r.number)) },
    { t: 'تاریخ', cell: r => jd(r.createdAt) },
    { t: 'مشتری', cell: r => h('span', {}, r.name, h('br'), h('small', { class: 'muted', dir: 'ltr' }, r.phone)) },
    { t: 'شهر', cell: r => r.city },
    { t: 'تعداد', cell: r => fmt(r.qty) },
    { t: 'مبلغ', cell: r => money(r.total) },
    { t: 'پرداخت', cell: r => r.payment },
    { t: 'وضعیت', cell: r => chip(STAT[r.status], STAT_KIND[r.status]) },
  ],
};

/* ================= نمای لیست ================= */
async function listView(name, q) {
  const C = CFG[name];
  if (C.prepare) await C.prepare();
  const params = new URLSearchParams();
  ['q', 'page', 'sort', 'dir'].concat((C.filters || []).map(f => f.k), C.tabs ? [C.tabs.k] : []).forEach(k => { if (q[k]) params.set(k, q[k]); });
  const d = await api('GET', `/r/${name}?${params}`);
  const sel = new Set();
  const reload = () => AD.render();
  const root = h('div', { class: 'page' });
  root.append(h('div', { class: 'pagehead' }, h('h1', {}, C.title, ' ', h('small', { class: 'muted' }, fmt(d.total))), C.create === false ? null : h('a', { class: 'btn primary', href: `#/${name}/new` }, ico('plus'), `افزودن ${C.one}`)));

  if (C.tabs && d.counts) {
    root.append(h('div', { class: 'tabs' }, [['', 'همه', d.counts.all], ...C.tabs.items.map(([k, l]) => [k, l, d.counts[k]])].map(([k, l, n]) =>
      h('a', { class: 'tab' + ((q[C.tabs.k] || '') === k ? ' on' : ''), href: '#/' + name + (k ? `?${C.tabs.k}=${k}` : '') }, l, h('b', {}, fmt(n))))));
  }

  const qin = h('input', { type: 'search', placeholder: 'جستجو...', value: q.q || '', onkeydown: e => { if (e.key === 'Enter') go(name, { ...q, q: qin.value.trim(), page: '' }); } });
  const bar = h('div', { class: 'toolbar' }, h('div', { class: 'sbox' }, qin, h('button', { class: 'btn', type: 'button', onclick: () => go(name, { ...q, q: qin.value.trim(), page: '' }) }, ico('search'), 'جستجو')),
    (C.filters || []).map(f => h('select', { 'aria-label': f.t, onchange: e => go(name, { ...q, [f.k]: e.target.value, page: '' }) }, (typeof f.opts === 'function' ? f.opts() : f.opts).map(([v, l]) => h('option', { value: v, selected: (q[f.k] || '') === v }, l)))),
    q.q ? h('a', { class: 'btn ghost', href: '#/' + name }, 'پاک‌کردن جستجو') : null);
  root.append(bar);

  const selInfo = h('span', { class: 'muted' });
  const bulkBox = h('div', { class: 'bulk', hidden: true }, selInfo, (C.bulk || []).map(([act, l, danger]) => h('button', { class: 'btn sm ' + (danger ? 'danger ghost' : 'ghost'), type: 'button', onclick: async e => {
    if (danger && !(await ask(`${fmt(sel.size)} مورد انتخاب‌شده «${l}» شود؟ این کار قابل بازگشت نیست.`, { ok: l, danger: true }))) return;
    await busy(e.currentTarget, async () => { const r = await api('POST', `/r/${name}/bulk`, { action: act, ids: [...sel] }); toast(`${fmt(r.done)} مورد انجام شد${r.failed ? ` (${fmt(r.failed)} مورد انجام نشد)` : ''}.`); if (C.afterSave) C.afterSave(); reload(); });
  } }, l)));
  const refreshBulk = () => { bulkBox.hidden = !sel.size; selInfo.textContent = `${fmt(sel.size)} مورد انتخاب شده`; };
  if (C.bulk) root.append(bulkBox);

  const allCk = h('input', { type: 'checkbox', 'aria-label': 'انتخاب همه', onchange: e => { tbody.querySelectorAll('input.rk').forEach((c, i) => { c.checked = e.target.checked; e.target.checked ? sel.add(d.items[i].id) : sel.delete(d.items[i].id); }); refreshBulk(); } });
  const canDel = C.del !== false && !(name === 'orders');
  const tbody = h('tbody', {}, d.items.map(r => h('tr', {},
    C.bulk ? h('td', { class: 'ck' }, h('input', { type: 'checkbox', class: 'rk', onchange: e => { e.target.checked ? sel.add(r.id) : sel.delete(r.id); refreshBulk(); } })) : null,
    C.cols.map(c => h('td', {}, c.cell(r))),
    (C.move || canDel) ? h('td', { class: 'act' },
      C.move && !q.q ? [h('button', { class: 'ibtn', type: 'button', title: 'بالاتر', onclick: async () => { await api('POST', `/r/${name}/${r.id}/move`, { dir: -1 }).catch(e => toast(e.message, true)); if (C.afterSave) C.afterSave(); reload(); } }, ico('up')), h('button', { class: 'ibtn', type: 'button', title: 'پایین‌تر', onclick: async () => { await api('POST', `/r/${name}/${r.id}/move`, { dir: 1 }).catch(e => toast(e.message, true)); if (C.afterSave) C.afterSave(); reload(); } }, ico('down'))] : null,
      canDel ? h('button', { class: 'ibtn bad', type: 'button', title: 'حذف', onclick: async () => { if (!(await ask(`«${label(C, r)}» حذف شود؟`, { ok: 'حذف', danger: true }))) return; try { await api('DELETE', `/r/${name}/${r.id}`); toast('حذف شد.'); if (C.afterSave) C.afterSave(); reload(); } catch (e) { toast(e.message, true); } } }, ico('trash')) : null) : null)));
  const table = h('table', { class: 'tbl' }, h('thead', {}, h('tr', {}, C.bulk ? h('th', { class: 'ck' }, allCk) : null, C.cols.map(c => h('th', {}, c.t)), (C.move || canDel) ? h('th', { class: 'act' }) : null)), tbody);
  root.append(h('div', { class: 'card tw' }, d.items.length ? table : h('p', { class: 'empty' }, q.q || Object.keys(q).length ? 'موردی پیدا نشد.' : `هنوز ${C.one}ی ثبت نشده است.`)));

  if (d.pages > 1) root.append(h('div', { class: 'pager' },
    h('button', { class: 'btn ghost sm', type: 'button', disabled: d.page <= 1, onclick: () => go(name, { ...q, page: d.page - 1 }) }, ico('right'), 'قبلی'),
    h('span', {}, `صفحه ${fmt(d.page)} از ${fmt(d.pages)}`),
    h('button', { class: 'btn ghost sm', type: 'button', disabled: d.page >= d.pages, onclick: () => go(name, { ...q, page: d.page + 1 }) }, 'بعدی', ico('left'))));
  return root;
}

/* ================= نمای فرم ================= */
async function formView(name, id) {
  const C = CFG[name];
  if (C.prepare) await C.prepare();
  const isNew = !id || id === 'new';
  const rec = isNew ? { active: true, status: 'published', ...(C.defaults || {}) } : await api('GET', `/r/${name}/${id}`);
  const form = AD.buildForm(C.fields, rec);
  if (C.onForm) C.onForm(form, rec);
  const saveBtn = h('button', { class: 'btn primary', type: 'submit' }, ico('check'), 'ذخیره');
  const remove = async () => {
    if (!(await ask(`«${label(C, rec)}» حذف شود؟`, { ok: 'حذف', danger: true }))) return;
    try { await api('DELETE', `/r/${name}/${id}`); toast('حذف شد.'); if (C.afterSave) C.afterSave(); go(name); } catch (e) { toast(e.message, true); }
  };
  return h('form', {
    class: 'page narrow', novalidate: true,
    onsubmit: async e => {
      e.preventDefault();
      await busy(saveBtn, async () => {
        const body = form.get();
        const saved = isNew ? await api('POST', `/r/${name}`, body) : await api('PUT', `/r/${name}/${id}`, body);
        toast('ذخیره شد.');
        if (C.afterSave) C.afterSave();
        if (isNew) go(`${name}/${saved.id}`); else AD.render();
      });
    },
  },
  h('div', { class: 'pagehead' }, h('h1', {}, isNew ? `افزودن ${C.one}` : `ویرایش ${C.one}`, ' ', codeBadge(rec)), h('a', { class: 'btn ghost', href: `#/${name}` }, 'بازگشت به فهرست')),
  h('div', { class: 'card' }, form.el),
  h('div', { class: 'actions' }, saveBtn,
    !isNew && C.viewUrl ? h('a', { class: 'btn ghost', href: C.viewUrl(rec), target: '_blank', rel: 'noopener' }, ico('external'), 'مشاهده در سایت') : null,
    !isNew ? h('button', { class: 'btn danger ghost', type: 'button', onclick: remove }, ico('trash'), 'حذف') : null));
}
AD.listView = listView;
AD.formView = formView;

/* ================= پیشخوان ================= */
AD.views.dashboard = async () => {
  const d = await api('GET', '/dashboard');
  const max = Math.max(1, ...d.chart.map(x => x.revenue));
  const dayFa = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric', timeZone: 'Asia/Tehran' });
  const tile = (t, v, sub, href) => h('a', { class: 'tile', href: href || null }, h('span', { class: 'muted' }, t), h('b', {}, v), sub ? h('small', { class: 'muted' }, sub) : null);
  const quick = [['orders', 'سفارش‌ها', 'bag'], ['products', 'محصولات', 'box'], ['categories', 'دسته‌ها', 'folder'], ['banners', 'بنرها', 'image'], ['codes', 'کدها و متن‌ها', 'hash'], ['settings', 'تنظیمات', 'sliders']].filter(([p]) => AD.can(p === 'codes' ? 'texts' : p));
  return h('div', { class: 'page' },
    h('div', { class: 'pagehead' }, h('h1', {}, 'پیشخوان')),
    h('div', { class: 'tiles' },
      tile('سفارش امروز', fmt(d.today), null, '#/orders'),
      tile('در انتظار بررسی', fmt(d.pending), 'سفارش', '#/orders?status=pending'),
      tile('فروش ۳۰ روز اخیر', fmt(d.rev30), 'تومان'),
      tile('محصولات', fmt(d.products), `${fmt(d.published)} منتشر شده`, '#/products')),
    h('div', { class: 'card' }, h('h3', {}, 'فروش ۱۴ روز اخیر'),
      d.chart.some(x => x.revenue) ? h('div', { class: 'bars' }, d.chart.map(x => h('div', { class: 'bar', title: `${x.day} — ${fmt(x.orders)} سفارش، ${fmt(x.revenue)} تومان` }, h('i', { style: { height: Math.max(3, x.revenue / max * 100) + '%' } }), h('span', {}, dayFa.format(new Date(x.day + 'T12:00:00+03:30')))))) : h('p', { class: 'muted' }, 'هنوز فروشی ثبت نشده است.')),
    h('div', { class: 'cols2' },
      h('div', { class: 'card' }, h('h3', {}, 'آخرین سفارش‌ها'), d.latest.length ? h('table', { class: 'tbl' }, h('tbody', {}, d.latest.map(o => h('tr', {}, h('td', {}, h('a', { class: 'rowlink', href: `#/orders/${o.id}` }, '#' + pnum(o.number))), h('td', {}, o.name), h('td', {}, money(o.total)), h('td', {}, chip(STAT[o.status], STAT_KIND[o.status])))))) : h('p', { class: 'muted' }, 'سفارشی ثبت نشده است.')),
      h('div', { class: 'card' }, h('h3', {}, 'موجودی کم'), d.low.length ? h('table', { class: 'tbl' }, h('tbody', {}, d.low.map(p => h('tr', {}, h('td', {}, h('a', { class: 'rowlink', href: `#/products/${p.id}` }, p.title)), h('td', {}, p.stock <= 0 ? chip('ناموجود', 'bad') : chip(fmt(p.stock) + ' عدد', 'warn')))))) : h('p', { class: 'muted' }, 'همه‌ی محصولات موجودی کافی دارند.'))),
    quick.length ? h('div', { class: 'quick' }, quick.map(([p, t, i]) => h('a', { class: 'btn ghost', href: '#/' + p }, ico(i), t))) : null);
};

/* ================= جزئیات سفارش ================= */
AD.views.order = async id => {
  let o = await api('GET', `/r/orders/${id}`);
  const root = h('div', { class: 'page' });
  const draw = () => {
    const c = o.customer;
    const stSel = h('select', {}, Object.entries(STAT).map(([k, l]) => h('option', { value: k, selected: o.status === k }, l)));
    const stNote = h('textarea', { rows: 2, placeholder: 'یادداشت داخلی (اختیاری)' });
    const stBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => busy(stBtn, async () => { o = await api('POST', `/orders/${o.id}/status`, { status: stSel.value, note: stNote.value }); toast('وضعیت ثبت شد.'); draw(); }) }, 'ثبت وضعیت');
    const noteIn = h('input', { type: 'text', placeholder: 'یادداشت جدید...' });
    const noteBtn = h('button', { class: 'btn ghost', type: 'button', onclick: () => busy(noteBtn, async () => { if (!noteIn.value.trim()) return; o = await api('POST', `/orders/${o.id}/note`, { text: noteIn.value }); draw(); }) }, 'افزودن');
    const row = (k, v) => h('div', { class: 'kv' }, h('span', { class: 'muted' }, k), h('b', {}, v));
    root.replaceChildren(
      h('div', { class: 'pagehead' }, h('h1', {}, 'سفارش #' + pnum(o.number), ' ', chip(STAT[o.status], STAT_KIND[o.status])),
        h('div', { class: 'row' }, h('button', { class: 'btn ghost no-print', type: 'button', onclick: () => print() }, ico('print'), 'چاپ'), h('a', { class: 'btn ghost no-print', href: '#/orders' }, 'بازگشت'))),
      h('div', { class: 'cols2 wide-l' },
        h('div', {},
          h('div', { class: 'card tw' }, h('h3', {}, 'اقلام سفارش'), h('table', { class: 'tbl' },
            h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, 'محصول'), h('th', {}, 'قیمت'), h('th', {}, 'تعداد'), h('th', {}, 'جمع'))),
            h('tbody', {}, o.items.map(i => h('tr', {}, h('td', { class: 'thumbc' }, i.image ? h('img', { src: i.image, alt: '' }) : null), h('td', {}, i.title, i.variant ? h('div', { class: 'muted' }, i.variant) : null), h('td', {}, fmt(i.price)), h('td', {}, fmt(i.qty)), h('td', {}, fmt(i.price * i.qty)))))),
          h('div', { class: 'totals' }, row('جمع کالاها', money(o.subtotal)), o.discount ? row('تخفیف' + (o.coupon ? ` (${o.coupon})` : ''), '− ' + money(o.discount)) : null, row('ارسال: ' + o.shipping.name, o.shipping.cost ? money(o.shipping.cost) : 'رایگان'), row('مبلغ نهایی', money(o.total)), row('روش پرداخت', o.payment.title))),
          h('div', { class: 'card' }, h('h3', {}, 'یادداشت‌های داخلی'), o.notes.length ? h('ul', { class: 'notes' }, o.notes.map(n => h('li', {}, h('div', {}, n.text), h('small', { class: 'muted' }, `${n.by} — ${jd(n.at)}`)))) : h('p', { class: 'muted' }, 'یادداشتی ثبت نشده است.'), h('div', { class: 'row no-print' }, noteIn, noteBtn))),
        h('div', {},
          h('div', { class: 'card' }, h('h3', {}, 'مشتری'), row('نام', c.name), row('موبایل', h('a', { href: 'tel:' + c.phone, dir: 'ltr' }, c.phone)), c.email ? row('ایمیل', h('span', { dir: 'ltr' }, c.email)) : null, row('استان / شهر', `${c.province} / ${c.city}`), row('آدرس', c.address), c.postal ? row('کد پستی', h('span', { dir: 'ltr' }, c.postal)) : null, c.note ? row('توضیح مشتری', c.note) : null),
          h('div', { class: 'card no-print' }, h('h3', {}, 'تغییر وضعیت'), stSel, stNote, stBtn),
          h('div', { class: 'card' }, h('h3', {}, 'کد پیگیری'), h('div', { class: 'row' }, h('b', { class: 'trk', dir: 'ltr' }, o.tracking), h('button', { class: 'ibtn no-print', type: 'button', title: 'کپی', onclick: () => { navigator.clipboard && navigator.clipboard.writeText(o.tracking); toast('کپی شد.'); } }, ico('copy'))), h('small', { class: 'muted' }, 'ثبت: ' + jd(o.createdAt))),
          h('div', { class: 'card' }, h('h3', {}, 'تاریخچه'), h('ol', { class: 'hist' }, o.history.map(x => h('li', {}, h('b', {}, STAT[x.s]), h('small', { class: 'muted' }, `${x.by} — ${jd(x.at)}`))))),
          AD.state.me.role === 'admin' ? h('button', { class: 'btn danger ghost no-print', type: 'button', onclick: async () => { if (await ask('این سفارش برای همیشه حذف شود؟ (موجودی کالاها تغییر نمی‌کند)', { ok: 'حذف', danger: true })) { await api('DELETE', `/r/orders/${o.id}`); toast('حذف شد.'); go('orders'); } } }, ico('trash'), 'حذف سفارش') : null)));
  };
  draw();
  return root;
};

/* ================= کدها ================= */
AD.views.codes = async q => {
  const params = new URLSearchParams();
  ['q', 'type', 'page'].forEach(k => { if (q[k]) params.set(k, q[k]); });
  const d = await api('GET', `/codes?${params}`);
  const dirty = {};
  const root = h('div', { class: 'page' });
  const saveAll = h('button', { class: 'btn primary', type: 'button', disabled: true }, ico('check'), 'ذخیره‌ی تغییرات');
  const count = () => { const n = Object.keys(dirty).length; saveAll.disabled = !n; saveAll.lastChild.textContent = n ? `ذخیره‌ی ${fmt(n)} تغییر` : 'ذخیره‌ی تغییرات'; };
  saveAll.onclick = () => busy(saveAll, async () => { const r = await api('PUT', '/codes', { changes: dirty }); toast(`${fmt(r.applied)} مورد ذخیره شد.` + (r.missing.length ? ` (کدهای نامعتبر: ${r.missing.join('، ')})` : '')); AD.dropCats(); AD.render(); });
  const qin = h('input', { type: 'search', placeholder: 'جستجوی کد یا متن...', value: q.q || '', onkeydown: e => { if (e.key === 'Enter') go('codes', { ...q, q: qin.value.trim(), page: '' }); } });
  const types = [{ col: '', type: 'همه' }, ...d.cols];
  const rows = d.items.map(r => {
    const long = r.value.length > 48;
    const inp = long ? h('textarea', { rows: 2, value: r.value }) : h('input', { type: 'text', value: r.value });
    const tr = h('tr', {}, h('td', {}, h('span', { class: 'code big' }, pnum(r.code))), h('td', {}, chip(r.type)), h('td', { class: 'muted' }, r.label || r.type, r.group ? h('small', {}, ' · ' + r.group) : null), h('td', { class: 'grow' }, inp),
      h('td', { class: 'act' }, r.col === 'texts' && r.def !== undefined && r.value !== r.def ? h('button', { class: 'ibtn', type: 'button', title: 'بازگشت به متن پیش‌فرض', onclick: () => { inp.value = r.def; inp.dispatchEvent(new Event('input')); } }, ico('undo')) : null));
    inp.addEventListener('input', () => { if (inp.value === r.value) delete dirty[r.code]; else dirty[r.code] = inp.value; tr.classList.toggle('dirty', inp.value !== r.value); count(); });
    return tr;
  });
  root.append(
    h('div', { class: 'pagehead' }, h('h1', {}, 'کدها (متن‌های سایت)'), saveAll),
    h('div', { class: 'card hint' }, 'هر نام و متن سایت یک کد دارد (کد ۱ = نام سایت). اینجا مقدار هر کد را عوض کنید، یا در چت بگویید «کد ۱ را بکن فلان». برای دیدن کد روی خود صفحه‌ی سایت، از بالای پنل «سایت با کدها» را باز کنید.'),
    h('div', { class: 'toolbar' }, h('div', { class: 'sbox' }, qin, h('button', { class: 'btn', type: 'button', onclick: () => go('codes', { ...q, q: qin.value.trim(), page: '' }) }, ico('search'), 'جستجو')),
      h('div', { class: 'tabs inline' }, types.map(t => h('a', { class: 'tab' + ((q.type || '') === t.col ? ' on' : ''), href: '#/codes' + (t.col ? `?type=${t.col}` : '') }, t.type)))),
    h('div', { class: 'card tw' }, rows.length ? h('table', { class: 'tbl codes' }, h('thead', {}, h('tr', {}, ['کد', 'نوع', 'محل استفاده', 'مقدار', ''].map(x => h('th', {}, x)))), h('tbody', {}, rows)) : h('p', { class: 'empty' }, 'موردی پیدا نشد.')),
    d.pages > 1 ? h('div', { class: 'pager' }, h('button', { class: 'btn ghost sm', type: 'button', disabled: d.page <= 1, onclick: () => go('codes', { ...q, page: d.page - 1 }) }, ico('right'), 'قبلی'), h('span', {}, `صفحه ${fmt(d.page)} از ${fmt(d.pages)}`), h('button', { class: 'btn ghost sm', type: 'button', disabled: d.page >= d.pages, onclick: () => go('codes', { ...q, page: d.page + 1 }) }, 'بعدی', ico('left'))) : null);
  return root;
};

/* ================= تنظیمات ================= */
AD.views.settings = async () => {
  const s = await api('GET', '/settings');
  const F = (k, t, o = {}) => ({ k, t, ...o });
  const sections = [
    ['اطلاعات تماس (نمایش در فوتر)', [F('contact.phone', 'تلفن', { ltr: true }), F('contact.email', 'ایمیل', { ltr: true }), F('contact.address', 'آدرس'), F('contact.hours', 'ساعت کاری')]],
    ['شبکه‌های اجتماعی', [F('social.instagram', 'اینستاگرام', { ltr: true, help: 'نام کاربری یا آدرس کامل' }), F('social.telegram', 'تلگرام', { ltr: true }), F('social.whatsapp', 'واتس‌اپ (شماره)', { ltr: true }), F('social.eitaa', 'ایتا', { ltr: true })]],
    ['ظاهر سایت', [F('theme.logo', 'لوگو', { type: 'image', help: 'اگر لوگو انتخاب نشود، نام سایت (کد ۱) نمایش داده می‌شود.' }), F('theme.favicon', 'آیکون سایت (فاوآیکون)', { type: 'image' }), F('theme.primary', 'رنگ اصلی', { type: 'color' }), F('theme.accent', 'رنگ تأکیدی', { type: 'color' }), F('theme.sale', 'رنگ حراج', { type: 'color' }), F('theme.radius', 'گردی گوشه‌ها (۰ تا ۲۴)', { type: 'number' })]],
    ['فروشگاه', [F('shop.perPage', 'تعداد محصول در هر صفحه', { type: 'number' }), F('shop.lowStock', 'آستانه‌ی «موجودی کم»', { type: 'number' }), F('shop.minOrder', 'حداقل مبلغ سفارش (تومان)', { type: 'number', help: '۰ = بدون محدودیت' }), F('shop.showOutOfStock', 'نمایش محصولات ناموجود', { type: 'bool' }), F('shop.catsInHeader', 'نمایش دسته‌های اصلی زیر هدر', { type: 'bool' })]],
    ['پرداخت', [F('payments.cod.enabled', 'فعال: پرداخت در محل', { type: 'bool' }), F('payments.cod.title', 'عنوان پرداخت در محل'), F('payments.card.enabled', 'فعال: کارت به کارت', { type: 'bool' }), F('payments.card.title', 'عنوان کارت به کارت'), F('payments.card.number', 'شماره کارت', { ltr: true }), F('payments.card.owner', 'نام صاحب حساب')]],
    ['سئو', [F('seo.title', 'عنوان پیش‌فرض سایت'), F('seo.description', 'توضیح پیش‌فرض سایت', { type: 'textarea', rows: 2 })]],
    ['پیشرفته', [F('maintenance', 'حالت به‌روزرسانی (سایت فقط برای مدیر باز باشد)', { type: 'bool' })]],
  ];
  const forms = sections.map(([, fields]) => AD.buildForm(fields, s));
  const saveBtn = h('button', { class: 'btn primary', type: 'submit' }, ico('check'), 'ذخیره‌ی تنظیمات');
  return h('form', {
    class: 'page narrow', novalidate: true,
    onsubmit: e => { e.preventDefault(); busy(saveBtn, async () => { const body = {}; forms.forEach(f => { const o = f.get(); Object.keys(o).forEach(k => { body[k] = typeof o[k] === 'object' && !Array.isArray(o[k]) ? { ...(body[k] || {}), ...o[k] } : o[k]; }); }); await api('PUT', '/settings', body); toast('تنظیمات ذخیره شد.'); }); },
  },
  h('div', { class: 'pagehead' }, h('h1', {}, 'تنظیمات'), saveBtn),
  h('div', { class: 'card hint' }, 'نام فروشگاه، شعار و همه‌ی متن‌های سایت از بخش ', h('a', { href: '#/codes' }, 'کدها'), ' تغییر می‌کنند.'),
  sections.map(([t], i) => h('div', { class: 'card' }, h('h3', {}, t), forms[i].el)),
  h('div', { class: 'actions' }, h('button', { class: 'btn primary', type: 'submit' }, ico('check'), 'ذخیره‌ی تنظیمات')));
};

/* ================= رسانه‌ها ================= */
AD.views.media = async q => {
  const page = +q.page || 1;
  const d = await api('GET', `/r/media?per=48&page=${page}`);
  const file = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, onchange: async () => { const up = await AD.upload(file.files); if (up.length) { toast(`${fmt(up.length)} تصویر بارگذاری شد.`); AD.render(); } } });
  const open = m => {
    const urlIn = h('input', { type: 'text', readOnly: true, value: location.origin + m.url, dir: 'ltr', onfocus: e => e.target.select() });
    const mm = AD.modal({
      title: m.name,
      body: h('div', { class: 'mdet' }, h('img', { src: m.url, alt: '' }), h('div', {}, h('label', { class: 'fld' }, h('span', { class: 'lbl' }, 'آدرس تصویر'), urlIn), h('p', { class: 'muted' }, `${(m.size / 1024).toFixed(0)} کیلوبایت — ${jd(m.createdAt)}`))),
      actions: [h('button', { class: 'btn danger ghost', type: 'button', onclick: async () => { if (await ask('این تصویر حذف شود؟ (در جاهایی که استفاده شده باشد دیگر نمایش داده نمی‌شود)', { ok: 'حذف', danger: true })) { await api('DELETE', `/r/media/${m.id}`); mm.close(); AD.render(); } } }, ico('trash'), 'حذف')],
    });
  };
  return h('div', { class: 'page' },
    h('div', { class: 'pagehead' }, h('h1', {}, 'رسانه‌ها ', h('small', { class: 'muted' }, fmt(d.total))), h('button', { class: 'btn primary', type: 'button', onclick: () => file.click() }, ico('upload'), 'بارگذاری تصویر'), file),
    d.items.length ? h('div', { class: 'mgrid' }, AD.mediaGrid(d.items, { onpick: m => open(m) })) : h('div', { class: 'card' }, h('p', { class: 'empty' }, 'هنوز تصویری بارگذاری نشده است.')),
    d.pages > 1 ? h('div', { class: 'pager' }, h('button', { class: 'btn ghost sm', type: 'button', disabled: page <= 1, onclick: () => go('media', { page: page - 1 }) }, ico('right'), 'قبلی'), h('span', {}, `صفحه ${fmt(page)} از ${fmt(d.pages)}`), h('button', { class: 'btn ghost sm', type: 'button', disabled: page >= d.pages, onclick: () => go('media', { page: page + 1 }) }, 'بعدی', ico('left'))) : null);
};

/* ================= ابزارها ================= */
AD.views.tools = async () => {
  const codesTa = h('textarea', { rows: 5, dir: 'auto', placeholder: '1 = نام جدید فروشگاه\n2 = شعار جدید\nکد ۱۰۱ = لباس زنانه' });
  const codesBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => busy(codesBtn, async () => { const r = await api('PUT', '/codes', { text: codesTa.value }); toast(`${fmt(r.applied)} کد اعمال شد.` + (r.missing.length ? ` (نامعتبر: ${r.missing.join('، ')})` : ''), !r.applied); if (r.applied) { AD.dropCats(); codesTa.value = ''; } }) }, 'اعمال تغییرات');
  const cur = h('input', { type: 'password', autocomplete: 'current-password', dir: 'ltr', placeholder: 'رمز فعلی' }), nw = h('input', { type: 'password', autocomplete: 'new-password', dir: 'ltr', placeholder: 'رمز جدید (حداقل ۸ کاراکتر)' }), nw2 = h('input', { type: 'password', autocomplete: 'new-password', dir: 'ltr', placeholder: 'تکرار رمز جدید' });
  const pwBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => busy(pwBtn, async () => { if (nw.value !== nw2.value) throw new Error('تکرار رمز جدید یکسان نیست.'); await api('POST', '/password', { current: cur.value, next: nw.value }); toast('رمز عبور تغییر کرد.'); cur.value = nw.value = nw2.value = ''; }) }, 'تغییر رمز');
  const rf = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: async () => {
    const f = rf.files[0]; rf.value = '';
    if (!f) return;
    if (!(await ask('با بازیابی، همه‌ی اطلاعات فعلی (محصولات، سفارش‌ها، کاربران، تنظیمات) با فایل پشتیبان جایگزین می‌شود و باید دوباره وارد شوید. ادامه می‌دهید؟', { ok: 'بازیابی', danger: true }))) return;
    try { await api('POST', '/restore', JSON.parse(await f.text())); toast('بازیابی انجام شد.'); setTimeout(() => location.reload(), 800); } catch (e) { toast(e.message, true); }
  } });
  const demoBtn = h('button', { class: 'btn danger ghost', type: 'button', onclick: async () => { if (!(await ask('همه‌ی محصولات نمونه حذف شوند؟ (محصولاتی که خودتان ساخته‌اید حذف نمی‌شوند)', { ok: 'حذف', danger: true }))) return; await busy(demoBtn, async () => { const r = await api('POST', '/tools/clear-demo'); toast(`${fmt(r.removed)} محصول نمونه حذف شد.`); }); } }, ico('trash'), 'حذف محصولات نمونه');
  const sec = (t, ...kids) => h('div', { class: 'card' }, h('h3', {}, t), ...kids);
  return h('div', { class: 'page narrow' }, h('div', { class: 'pagehead' }, h('h1', {}, 'ابزارها')),
    sec('اعمال گروهی تغییر کدها', h('p', { class: 'muted' }, 'هر خط یک تغییر: «شماره‌ی کد = مقدار جدید». می‌توانید همین قالب را از من در چت بگیرید و اینجا بچسبانید.'), codesTa, h('div', { class: 'actions' }, codesBtn)),
    sec('تغییر رمز عبور من', h('div', { class: 'stack' }, cur, nw, nw2), h('div', { class: 'actions' }, pwBtn)),
    sec('پشتیبان‌گیری', h('p', { class: 'muted' }, 'فایل پشتیبان شامل همه‌ی اطلاعات (محصولات، سفارش‌ها، تنظیمات، کاربران) است. تصویرها در پوشه‌ی data/uploads ذخیره می‌شوند؛ برای پشتیبان کامل کل پوشه‌ی data را کپی کنید. هر روز یک نسخه‌ی خودکار در data/backups ساخته می‌شود.'), h('div', { class: 'actions' }, h('a', { class: 'btn', href: '/api/admin/backup' }, ico('download'), 'دانلود پشتیبان'), h('button', { class: 'btn ghost', type: 'button', onclick: () => rf.click() }, ico('upload'), 'بازیابی از فایل'), rf)),
    sec('داده‌های نمونه', h('p', { class: 'muted' }, 'محصولات نمونه‌ی اولیه را یکجا حذف کنید.'), h('div', { class: 'actions' }, demoBtn)));
};
})();
