(() => {
'use strict';
const AD = window.AD = { views: {}, CFG: {}, state: { me: null } };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* سازنده‌ی DOM امن (متن همیشه به‌صورت text درج می‌شود) */
const h = (tag, attrs, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k in e && k !== 'list' && k !== 'form') e[k] = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) { if (c == null || c === false) continue; e.append(c.nodeType ? c : document.createTextNode(c)); }
  return e;
};
AD.$ = $; AD.$$ = $$; AD.h = h;

const fmt = n => Number(n || 0).toLocaleString('fa-IR');
const jdf = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
const jd = ts => (ts ? jdf.format(ts) : '—');
const debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
AD.fmt = fmt; AD.jd = jd; AD.debounce = debounce;
AD.STAT = { pending: 'در انتظار بررسی', processing: 'در حال آماده‌سازی', shipped: 'ارسال شده', delivered: 'تحویل شده', cancelled: 'لغو شده', returned: 'مرجوع شده' };
AD.STAT_KIND = { pending: 'warn', processing: 'info', shipped: 'info', delivered: 'ok', cancelled: 'bad', returned: 'bad' };

/* ---------- آیکون‌ها ---------- */
const ICONS = {
  home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z',
  bag: 'M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0',
  box: 'M21 8l-9-5-9 5v8l9 5 9-5zM3.3 7.5L12 12.5l8.7-5M12 22V12.5',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  tag: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01',
  truck: 'M1 3h13v13H1zM14 8h4l3 3v5h-7zM5.5 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18.5 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  image: 'M3 3h18v18H3zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8',
  menu: 'M3 6h18M3 12h18M3 18h18',
  hash: 'M4 9h16M4 15h16M10 3L8 21M16 3l-2 18',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  wrench: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  plus: 'M12 5v14M5 12h14',
  trash: 'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
  up: 'M18 15l-6-6-6 6', down: 'M6 9l6 6 6-6', left: 'M15 18l-6-6 6-6', right: 'M9 18l6-6-6-6',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  x: 'M18 6L6 18M6 6l12 12', check: 'M20 6L9 17l-5-5',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  copy: 'M9 9h11v11H9zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
  print: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
  external: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3',
  undo: 'M3 7v6h6M3 13a9 9 0 1 0 3-7',
};
const ico = (n, cls) => h('span', { class: 'ico' + (cls ? ' ' + cls : ''), html: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[n] || ''}"/></svg>` });
AD.ico = ico;

/* ---------- API ---------- */
AD.api = async (method, url, body) => {
  const opt = { method, headers: { 'X-Requested-With': 'shop' }, credentials: 'same-origin' };
  if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  let r;
  try { r = await fetch('/api/admin' + url, opt); } catch { throw new Error('ارتباط با سرور برقرار نشد.'); }
  let d = null;
  try { d = await r.json(); } catch { /* بدنه‌ی غیر JSON */ }
  if (r.status === 401 && !url.startsWith('/login') && !url.startsWith('/me') && AD.onLogout) { AD.onLogout(); throw new Error((d && d.error) || 'نشست شما تمام شده است.'); }
  if (!r.ok) throw new Error((d && d.error) || 'خطایی رخ داد.');
  return d;
};

/* ---------- پیام، پنجره، تأیید ---------- */
AD.toast = (msg, bad) => {
  let box = $('#toasts');
  if (!box) { box = h('div', { id: 'toasts', 'aria-live': 'polite' }); document.body.append(box); }
  const t = h('div', { class: 'toast' + (bad ? ' bad' : '') }, msg);
  box.append(t);
  setTimeout(() => t.remove(), bad ? 6000 : 3200);
};
AD.modal = ({ title, body, actions = [], wide, onclose }) => {
  const onkey = e => { if (e.key === 'Escape') close(); };
  const close = () => { veil.remove(); document.removeEventListener('keydown', onkey); if (onclose) onclose(); };
  const veil = h('div', { class: 'mveil', onclick: e => { if (e.target === veil) close(); } },
    h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true' },
      h('div', { class: 'mh' }, h('b', {}, title), h('button', { class: 'ibtn', type: 'button', onclick: close, 'aria-label': 'بستن' }, ico('x'))),
      h('div', { class: 'mb' }, body),
      actions.length ? h('div', { class: 'mf' }, actions) : null));
  document.body.append(veil);
  document.addEventListener('keydown', onkey);
  return { close, el: veil };
};
AD.ask = (msg, { ok = 'تأیید', danger = false } = {}) => new Promise(res => {
  let m;
  const done = v => { res(v); m.close(); };
  m = AD.modal({
    title: 'تأیید', onclose: () => res(false), body: h('p', {}, msg),
    actions: [h('button', { class: 'btn ghost', type: 'button', onclick: () => done(false) }, 'انصراف'), h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), type: 'button', onclick: () => done(true) }, ok)],
  });
});
AD.busy = async (btn, fn) => {
  if (btn.disabled) return;
  btn.disabled = true;
  try { return await fn(); } catch (e) { AD.toast(e.message, true); } finally { btn.disabled = false; }
};
AD.chip = (text, kind) => h('span', { class: 'chip ' + (kind || '') }, text);
AD.codeBadge = r => (r && r.code ? h('span', { class: 'code', title: 'کد این مورد' }, 'کد ' + fmt(r.code).replace(/٬/g, '')) : null);

/* ---------- ویرایشگر متن غنی ---------- */
AD.rich = html => {
  let htmlMode = false;
  const ed = h('div', { class: 'rte', contentEditable: 'true', dir: 'rtl', html: html || '' });
  const src = h('textarea', { class: 'rte-src', dir: 'ltr', hidden: true });
  const cmd = (c, v) => { ed.focus(); document.execCommand(c, false, v); };
  const btn = (label, title, fn) => h('button', { type: 'button', class: 'rb', title, onmousedown: e => e.preventDefault(), onclick: fn }, label);
  const bar = h('div', { class: 'rbar' },
    btn('B', 'ضخیم', () => cmd('bold')), btn('I', 'کج', () => cmd('italic')), btn('U', 'زیرخط', () => cmd('underline')),
    btn('H2', 'عنوان بزرگ', () => cmd('formatBlock', '<h2>')), btn('H3', 'عنوان کوچک', () => cmd('formatBlock', '<h3>')), btn('¶', 'پاراگراف', () => cmd('formatBlock', '<p>')),
    btn('•', 'فهرست نقطه‌ای', () => cmd('insertUnorderedList')), btn('۱.', 'فهرست شماره‌دار', () => cmd('insertOrderedList')),
    btn('راست', 'راست‌چین', () => cmd('justifyRight')), btn('وسط', 'وسط‌چین', () => cmd('justifyCenter')), btn('چپ', 'چپ‌چین', () => cmd('justifyLeft')),
    btn('لینک', 'افزودن لینک', () => { const u = prompt('آدرس لینک (https://...):'); if (u) cmd('createLink', u); }),
    btn('تصویر', 'افزودن تصویر از رسانه‌ها', async () => { const sel = window.getSelection(); const rg = sel.rangeCount ? sel.getRangeAt(0) : null; const urls = await AD.pickMedia({}); if (urls[0]) { ed.focus(); if (rg) { sel.removeAllRanges(); sel.addRange(rg); } cmd('insertImage', urls[0]); } }),
    btn('جدول', 'افزودن جدول', () => cmd('insertHTML', '<table><thead><tr><th>سایز</th><th>ستون ۲</th><th>ستون ۳</th></tr></thead><tbody><tr><td>S</td><td></td><td></td></tr><tr><td>M</td><td></td><td></td></tr><tr><td>L</td><td></td><td></td></tr></tbody></table><p><br></p>')),
    btn('پاک', 'حذف قالب‌بندی', () => cmd('removeFormat')),
    btn('HTML', 'نمایش/ویرایش کد HTML', () => {
      htmlMode = !htmlMode;
      if (htmlMode) src.value = ed.innerHTML; else ed.innerHTML = src.value;
      ed.hidden = htmlMode; src.hidden = !htmlMode;
    }));
  ed.addEventListener('paste', e => { e.preventDefault(); const t = (e.clipboardData || window.clipboardData).getData('text/plain'); document.execCommand('insertText', false, t); });
  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch { /* ignore */ }
  return { el: h('div', { class: 'rich-box' }, bar, ed, src), get: () => (htmlMode ? src.value : ed.innerHTML), set: v => { ed.innerHTML = v || ''; src.value = v || ''; } };
};

/* ---------- رسانه ---------- */
async function prepImage(file) {
  if (file.type === 'image/gif' || !/^image\//.test(file.type)) return file;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const sc = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  if (sc === 1 && file.size < 900 * 1024) return file;
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  let blob = await new Promise(r => c.toBlob(r, 'image/webp', 0.86));
  if (!blob || blob.type !== 'image/webp') blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.86));
  return blob || file;
}
const readURL = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });

AD.upload = async files => {
  const out = [];
  let i = 0;
  for (const f of [...files]) {
    i++;
    if (!/^image\//.test(f.type)) { AD.toast(`«${f.name}» تصویر نیست.`, true); continue; }
    try {
      AD.toast(`در حال بارگذاری ${fmt(i)} از ${fmt(files.length)}...`);
      const blob = await prepImage(f);
      out.push(await AD.api('POST', '/media', { name: f.name, data: await readURL(blob) }));
    } catch (e) { AD.toast(`«${f.name}»: ${e.message}`, true); }
  }
  return out;
};

AD.mediaGrid = (items, { select, onpick } = {}) => items.map(m => {
  const on = select && select.has(m.url);
  const card = h('button', { type: 'button', class: 'mcard' + (on ? ' on' : ''), title: m.name, onclick: () => onpick(m, card) }, h('img', { src: m.url, alt: '', loading: 'lazy' }), h('span', {}, m.name));
  return card;
});

AD.pickMedia = ({ multiple = false } = {}) => new Promise(res => {
  const chosen = new Set();
  const grid = h('div', { class: 'mgrid' });
  const more = h('button', { type: 'button', class: 'btn ghost', hidden: true }, 'نمایش بیشتر');
  let page = 0, m;
  const load = async () => {
    page++;
    const d = await AD.api('GET', `/r/media?per=40&page=${page}`);
    grid.append(...AD.mediaGrid(d.items, {
      select: chosen,
      onpick: (rec, card) => {
        if (!multiple) { res([rec.url]); m.close(); return; }
        if (chosen.has(rec.url)) chosen.delete(rec.url); else chosen.add(rec.url);
        card.classList.toggle('on', chosen.has(rec.url));
        okBtn.textContent = `انتخاب (${fmt(chosen.size)})`;
      },
    }));
    if (!d.items.length && page === 1) grid.append(h('p', { class: 'muted' }, 'هنوز تصویری بارگذاری نشده است. با دکمه‌ی «بارگذاری تصویر» شروع کنید.'));
    more.hidden = page >= d.pages;
  };
  more.onclick = () => AD.busy(more, load);
  const file = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
  file.onchange = async () => {
    const up = await AD.upload(file.files);
    if (up.length) { grid.replaceChildren(); page = 0; await load(); }
    file.value = '';
  };
  const okBtn = h('button', { type: 'button', class: 'btn primary', onclick: () => { res([...chosen]); m.close(); } }, 'انتخاب (۰)');
  m = AD.modal({
    title: 'انتخاب از رسانه‌ها', wide: true, onclose: () => res([...chosen]),
    body: h('div', {}, h('div', { class: 'tools' }, h('button', { type: 'button', class: 'btn', onclick: () => file.click() }, ico('upload'), 'بارگذاری تصویر'), file), grid, h('div', { class: 'center' }, more)),
    actions: multiple ? [okBtn] : [],
  });
  load().catch(e => AD.toast(e.message, true));
});

/* ---------- دسته‌ها (کش) ---------- */
let catCache = null;
AD.cats = async force => { if (!catCache || force) catCache = (await AD.api('GET', '/r/categories?per=500')).items; return catCache; };
AD.dropCats = () => { catCache = null; };

/* ---------- فیلدهای فرم ---------- */
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const setPath = (o, p, v) => { const ks = p.split('.'); let a = o; ks.slice(0, -1).forEach(k => { a = a[k] = a[k] || {}; }); a[ks[ks.length - 1]] = v; };

const FT = {
  text: (d, v) => { const i = h('input', { type: 'text', value: v ?? '', placeholder: d.ph || '', dir: d.ltr ? 'ltr' : null, maxLength: d.max || 300 }); return { el: i, get: () => i.value, set: x => { i.value = x ?? ''; } }; },
  number: (d, v) => { const i = h('input', { type: 'text', inputMode: 'numeric', value: v ?? '', placeholder: d.ph || '', dir: 'ltr' }); return { el: i, get: () => i.value, set: x => { i.value = x ?? ''; } }; },
  password: (d, v) => { const i = h('input', { type: 'password', autocomplete: 'new-password', value: v ?? '', placeholder: d.ph || '', dir: 'ltr' }); return { el: i, get: () => i.value, set: x => { i.value = x ?? ''; } }; },
  date: (d, v) => { const i = h('input', { type: 'date', value: v || '', dir: 'ltr' }); return { el: i, get: () => i.value, set: x => { i.value = x || ''; } }; },
  color: (d, v) => { const i = h('input', { type: 'color', value: v || '#000000', class: 'colorin' }); return { el: i, get: () => i.value, set: x => { i.value = x || '#000000'; } }; },
  textarea: (d, v) => { const i = h('textarea', { rows: d.rows || 3, value: v ?? '', placeholder: d.ph || '' }); return { el: i, get: () => i.value, set: x => { i.value = x ?? ''; } }; },
  bool: (d, v) => { const i = h('input', { type: 'checkbox', checked: !!v }); return { el: i, get: () => i.checked, set: x => { i.checked = !!x; } }; },
  select: (d, v) => {
    const opts = typeof d.opts === 'function' ? d.opts() : d.opts;
    const s = h('select', {}, opts.map(([val, lab]) => h('option', { value: val }, lab)));
    s.value = String(v ?? opts[0][0]);
    return { el: s, get: () => s.value, set: x => { s.value = String(x ?? opts[0][0]); } };
  },
  image: (d, v) => {
    let url = v || '';
    const img = h('img', { alt: '', hidden: !url, src: url || null });
    const draw = () => { img.hidden = !url; if (url) img.src = url; else img.removeAttribute('src'); rm.hidden = !url; };
    const pick = h('button', { type: 'button', class: 'btn ghost sm', onclick: async () => { const u = await AD.pickMedia({}); if (u[0]) { url = u[0]; draw(); } } }, ico('image'), 'انتخاب تصویر');
    const rm = h('button', { type: 'button', class: 'btn ghost sm', onclick: () => { url = ''; draw(); } }, 'حذف');
    const box = h('div', { class: 'imgfld' }, img, h('div', { class: 'row' }, pick, rm));
    draw();
    return { el: box, get: () => url, set: x => { url = x || ''; draw(); } };
  },
  rich: (d, v) => { const r = AD.rich(v); return { el: r.el, get: r.get, set: r.set }; },
};
FT.catparent = (d, v, ctx) => {
  const s = h('select', {}, h('option', { value: '0' }, '— بدون والد (دسته‌ی اصلی) —'));
  AD.cats().then(list => {
    const banned = new Set();
    if (ctx && ctx.rec && ctx.rec.id) {
      banned.add(ctx.rec.id);
      list.forEach(c => { if (banned.has(c.parent)) banned.add(c.id); });
      list.forEach(c => { if (banned.has(c.parent)) banned.add(c.id); });
    }
    list.filter(c => !banned.has(c.id)).forEach(c => s.append(h('option', { value: String(c.id) }, '— '.repeat(c.depth || 0) + c.name)));
    s.value = String(v || 0);
  }).catch(() => {});
  return { el: s, get: () => s.value, set: x => { s.value = String(x || 0); } };
};
FT.catmulti = (d, v) => {
  const sel = new Set(v || []);
  const box = h('div', { class: 'checks' }, h('span', { class: 'muted' }, 'در حال بارگذاری...'));
  AD.cats().then(list => {
    box.replaceChildren(...list.map(c => h('label', { class: 'chk', style: { paddingInlineStart: (c.depth || 0) * 16 + 'px' } },
      h('input', { type: 'checkbox', checked: sel.has(c.id), onchange: e => { e.target.checked ? sel.add(c.id) : sel.delete(c.id); } }), c.name)));
    if (!list.length) box.append(h('span', { class: 'muted' }, 'هنوز دسته‌ای ساخته نشده است.'));
  }).catch(() => {});
  return { el: box, get: () => [...sel], set: x => { sel.clear(); (x || []).forEach(i => sel.add(i)); } };
};

AD.fld = (d, val, ctx) => {
  const hd = FT[d.type || 'text'](d, val, ctx);
  const isBool = d.type === 'bool';
  hd.row = isBool
    ? h('div', { class: 'fld' + (d.wide ? ' wide' : '') }, h('label', { class: 'chk' }, hd.el, h('span', {}, d.t)), d.help && h('small', { class: 'muted' }, d.help))
    : h('div', { class: 'fld' + (d.wide || d.type === 'rich' || d.type === 'textarea' ? ' wide' : '') }, h('label', {}, h('span', { class: 'lbl' }, d.t, d.req && h('i', {}, ' *')), d.type === 'rich' || d.type === 'image' || d.type === 'catmulti' ? null : hd.el), d.type === 'rich' || d.type === 'image' || d.type === 'catmulti' ? hd.el : null, d.help && h('small', { class: 'muted' }, d.help));
  return hd;
};

/* ساخت فرم از روی تعریف فیلدها (کلیدهای نقطه‌دار برای تنظیمات تو در تو) */
AD.buildForm = (fields, rec) => {
  const handles = {};
  const el = h('div', { class: 'fgrid' });
  for (const d of fields) {
    const hd = AD.fld(d, d.virtual ? undefined : getPath(rec, d.k), { rec });
    handles[d.k] = hd;
    el.append(hd.row);
  }
  const get = () => { const o = {}; for (const d of fields) if (!d.virtual) setPath(o, d.k, handles[d.k].get()); return o; };
  return { el, get, handles };
};
})();
