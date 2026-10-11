(() => {
'use strict';
const AD = window.AD;
const { h, api, fmt, ico, chip, toast, ask, busy, codeBadge, CFG } = AD;

CFG.products = {
  title: 'محصولات', one: 'محصول',
  viewUrl: r => '/product/' + encodeURIComponent(r.slug),
  bulk: [['publish', 'انتشار'], ['draft', 'پیش‌نویس'], ['feature', 'ویژه‌کردن'], ['unfeature', 'حذف از ویژه‌ها'], ['delete', 'حذف', true]],
  prepare: async () => { CFG.products._cats = await AD.cats(); },
  filters: [
    { k: 'status', t: 'وضعیت', opts: [['', 'همه وضعیت‌ها'], ...AD.PUB] },
    { k: 'stock', t: 'موجودی', opts: [['', 'همه موجودی‌ها'], ['low', 'موجودی کم'], ['out', 'ناموجود']] },
    { k: 'category', t: 'دسته', opts: () => [['', 'همه دسته‌ها'], ...(CFG.products._cats || []).map(c => [String(c.id), '— '.repeat(c.depth || 0) + c.name])] },
  ],
  cols: [
    { t: '', cell: r => h('span', { class: 'swatch sq' }, r.image ? h('img', { src: r.image, alt: '' }) : null) },
    { t: 'محصول', cell: r => h('span', {}, h('a', { class: 'rowlink', href: `#/products/${r.id}` }, r.title), ' ', codeBadge(r), r.sku ? h('div', { class: 'muted', dir: 'ltr' }, r.sku) : null) },
    { t: 'دسته', cell: r => r.categories.join('، ') || '—' },
    { t: 'قیمت', cell: r => h('span', {}, (r.max > r.price ? 'از ' : '') + fmt(r.price), r.onSale ? ' ' : null, r.onSale ? chip('حراج', 'bad') : null) },
    { t: 'موجودی', cell: r => (r.stock == null ? 'نامحدود' : r.stock <= 0 ? chip('ناموجود', 'bad') : fmt(r.stock)) },
    { t: 'وضعیت', cell: r => h('span', {}, chip(r.status === 'draft' ? 'پیش‌نویس' : 'منتشر شده', r.status === 'draft' ? '' : 'ok'), r.featured ? ' ' : null, r.featured ? chip('ویژه', 'info') : null) },
  ],
};

const card = (title, ...kids) => h('div', { class: 'card' }, title ? h('h3', {}, title) : null, ...kids);
const keyOf = (opts, combo) => opts.map(o => combo[o.name]).join('\u0001');

AD.views.productForm = async id => {
  const isNew = !id || id === 'new';
  const rec = isNew ? { status: 'published', featured: false, categories: [], images: [], specs: [], options: [], variants: [] } : await api('GET', `/r/products/${id}`);
  await AD.cats();

  const F = {};
  const mk = (d, v) => { F[d.k] = AD.fld(d, v); return F[d.k]; };
  mk({ k: 'title', t: 'عنوان محصول', req: true, max: 200 }, rec.title);
  mk({ k: 'slug', t: 'نامک (آدرس)', ltr: true, help: 'خالی = خودکار' }, rec.slug);
  mk({ k: 'shortDesc', t: 'توضیح کوتاه', type: 'textarea', rows: 2 }, rec.shortDesc);
  mk({ k: 'desc', t: 'توضیحات کامل', type: 'rich' }, rec.desc);
  mk({ k: 'price', t: 'قیمت (تومان)', type: 'number', req: true, help: 'برای محصول دارای تنوع، قیمت پایه است و هر تنوع می‌تواند قیمت جدا داشته باشد.' }, rec.price);
  mk({ k: 'salePrice', t: 'قیمت با تخفیف (تومان)', type: 'number', help: 'خالی یا ۰ = بدون تخفیف' }, rec.salePrice || '');
  mk({ k: 'sku', t: 'کد کالا (SKU)', ltr: true }, rec.sku);
  mk({ k: 'stock', t: 'موجودی', type: 'number', help: 'خالی = نامحدود' }, rec.stock == null ? '' : rec.stock);
  mk({ k: 'sizeChart', t: 'جدول سایز (اختیاری)', type: 'rich' }, rec.sizeChart);
  mk({ k: 'metaTitle', t: 'عنوان سئو' }, rec.metaTitle);
  mk({ k: 'metaDesc', t: 'توضیح سئو', type: 'textarea', rows: 2 }, rec.metaDesc);
  mk({ k: 'status', t: 'وضعیت', type: 'select', opts: AD.PUB }, rec.status);
  mk({ k: 'featured', t: 'محصول ویژه (نمایش در صفحه اصلی)', type: 'bool' }, rec.featured);
  mk({ k: 'categories', t: '', type: 'catmulti' }, rec.categories);

  /* ---- تصاویر ---- */
  let images = [...(rec.images || [])];
  const gal = h('div', { class: 'gallery' });
  const drawGal = () => {
    const mv = (i, d) => { const j = i + d; if (j < 0 || j >= images.length) return; [images[i], images[j]] = [images[j], images[i]]; drawGal(); };
    gal.replaceChildren(...images.map((u, i) => h('div', { class: 'gi' + (i ? '' : ' main') }, h('img', { src: u, alt: '' }), i ? null : h('span', { class: 'mainbadge' }, 'اصلی'),
      h('div', { class: 'gbtn' }, h('button', { type: 'button', class: 'ibtn', title: 'جلوتر', onclick: () => mv(i, -1) }, ico('right')), h('button', { type: 'button', class: 'ibtn', title: 'عقب‌تر', onclick: () => mv(i, 1) }, ico('left')), h('button', { type: 'button', class: 'ibtn bad', title: 'حذف', onclick: () => { images.splice(i, 1); drawGal(); } }, ico('x'))))),
    h('button', { type: 'button', class: 'gadd', onclick: async () => { const urls = await AD.pickMedia({ multiple: true }); urls.forEach(u => { if (!images.includes(u)) images.push(u); }); drawGal(); } }, ico('plus'), 'افزودن تصویر'));
  };
  drawGal();

  /* ---- گزینه‌ها و تنوع‌ها ---- */
  let options = (rec.options || []).map(o => ({ name: o.name, values: o.values.join('، ') }));
  let variants = (rec.variants || []).map(v => ({ id: v.id, combo: { ...v.combo }, sku: v.sku || '', price: v.price == null ? '' : v.price, salePrice: v.salePrice == null ? '' : v.salePrice, stock: v.stock == null ? '' : v.stock, active: v.active !== false }));
  const optBox = h('div', { class: 'opts-ed' }), varBox = h('div', { class: 'varbox' });
  const parseOptions = () => {
    const seen = new Set();
    return options.map(o => ({ name: o.name.trim(), values: [...new Set(o.values.split(/[,،\n]/).map(x => x.trim()).filter(Boolean))] })).filter(o => o.name && o.values.length && !seen.has(o.name) && seen.add(o.name));
  };
  const drawVariants = () => {
    F.stock.row.hidden = variants.length > 0;
    if (!variants.length) { varBox.replaceChildren(h('p', { class: 'muted' }, 'اگر محصول سایز یا رنگ دارد، گزینه‌ها را بالا تعریف کنید و «ساخت تنوع‌ها» را بزنید؛ در غیر این صورت این بخش را خالی بگذارید.')); return; }
    const bp = h('input', { type: 'text', inputMode: 'numeric', dir: 'ltr', placeholder: 'قیمت' }), bs = h('input', { type: 'text', inputMode: 'numeric', dir: 'ltr', placeholder: 'موجودی' });
    const rows = variants.map(v => {
      const inp = (k, ph) => h('input', { type: 'text', inputMode: k === 'sku' ? null : 'numeric', dir: 'ltr', value: v[k], placeholder: ph, oninput: e => { v[k] = e.target.value; } });
      return h('tr', {}, h('td', {}, Object.values(v.combo).join(' / ')), h('td', {}, inp('sku', 'SKU')), h('td', {}, inp('price', 'قیمت محصول')), h('td', {}, inp('salePrice', 'بدون حراج')), h('td', {}, inp('stock', 'نامحدود')),
        h('td', { class: 'ck' }, h('input', { type: 'checkbox', checked: v.active, onchange: e => { v.active = e.target.checked; } })));
    });
    varBox.replaceChildren(
      h('div', { class: 'bulkrow' }, h('span', { class: 'muted' }, 'اعمال به همه‌ی تنوع‌ها:'), bp, bs, h('button', { type: 'button', class: 'btn ghost sm', onclick: () => { variants.forEach(v => { if (bp.value.trim()) v.price = bp.value.trim(); if (bs.value.trim()) v.stock = bs.value.trim(); }); drawVariants(); } }, 'اعمال')),
      h('div', { class: 'tw' }, h('table', { class: 'tbl vars' }, h('thead', {}, h('tr', {}, ['تنوع', 'SKU', 'قیمت', 'قیمت حراج', 'موجودی', 'فعال'].map(x => h('th', {}, x)))), h('tbody', {}, rows))));
  };
  const regen = () => {
    const opts = parseOptions();
    if (!opts.length) { variants = []; drawVariants(); return; }
    let combos = [{}];
    for (const o of opts) combos = combos.flatMap(c => o.values.map(v => ({ ...c, [o.name]: v })));
    const old = new Map(variants.filter(v => opts.every(o => v.combo && v.combo[o.name] != null)).map(v => [keyOf(opts, v.combo), v]));
    variants = combos.map(combo => { const o = old.get(keyOf(opts, combo)); return o ? { ...o, combo } : { combo, sku: '', price: '', salePrice: '', stock: '', active: true }; });
    drawVariants();
  };
  const drawOpts = () => {
    optBox.replaceChildren(...options.map((o, i) => h('div', { class: 'optrow' },
      h('input', { type: 'text', placeholder: 'نام گزینه (مثلاً سایز)', value: o.name, oninput: e => { o.name = e.target.value; } }),
      h('input', { type: 'text', placeholder: 'مقدارها با ویرگول جدا شوند: S، M، L', value: o.values, oninput: e => { o.values = e.target.value; } }),
      h('button', { type: 'button', class: 'ibtn bad', title: 'حذف گزینه', onclick: () => { options.splice(i, 1); drawOpts(); regen(); } }, ico('trash')))),
    h('div', { class: 'row' },
      options.length < 3 ? h('button', { type: 'button', class: 'btn ghost sm', onclick: () => { options.push({ name: '', values: '' }); drawOpts(); } }, ico('plus'), 'افزودن گزینه') : null,
      h('button', { type: 'button', class: 'btn sm', onclick: regen }, 'ساخت / به‌روزرسانی تنوع‌ها')));
  };
  drawOpts(); drawVariants();

  /* ---- مشخصات ---- */
  let specs = (rec.specs || []).map(s => ({ k: s.k, v: s.v }));
  const specBox = h('div', { class: 'specs-ed' });
  const drawSpecs = () => {
    specBox.replaceChildren(...specs.map((s, i) => h('div', { class: 'optrow' },
      h('input', { type: 'text', placeholder: 'عنوان (مثلاً جنس)', value: s.k, oninput: e => { s.k = e.target.value; } }),
      h('input', { type: 'text', placeholder: 'مقدار', value: s.v, oninput: e => { s.v = e.target.value; } }),
      h('button', { type: 'button', class: 'ibtn bad', onclick: () => { specs.splice(i, 1); drawSpecs(); } }, ico('trash')))),
    h('button', { type: 'button', class: 'btn ghost sm', onclick: () => { specs.push({ k: '', v: '' }); drawSpecs(); } }, ico('plus'), 'افزودن مشخصه'));
  };
  drawSpecs();

  /* ---- ذخیره ---- */
  const collect = () => {
    regen();
    return {
      title: F.title.get(), slug: F.slug.get(), shortDesc: F.shortDesc.get(), desc: F.desc.get(), price: F.price.get(), salePrice: F.salePrice.get(), sku: F.sku.get(), stock: F.stock.get(),
      sizeChart: F.sizeChart.get(), metaTitle: F.metaTitle.get(), metaDesc: F.metaDesc.get(), status: F.status.get(), featured: F.featured.get(), categories: F.categories.get(),
      images, specs, options: parseOptions(),
      variants: variants.map(v => ({ id: v.id, combo: v.combo, sku: v.sku, price: v.price, salePrice: v.salePrice, stock: v.stock, active: v.active })),
    };
  };
  const saveBtn = h('button', { class: 'btn primary', type: 'submit' }, ico('check'), 'ذخیره');
  const save2 = h('button', { class: 'btn primary', type: 'submit' }, ico('check'), 'ذخیره‌ی محصول');
  const remove = async () => {
    if (!(await ask(`«${rec.title}» حذف شود؟`, { ok: 'حذف', danger: true }))) return;
    try { await api('DELETE', `/r/products/${rec.id}`); toast('حذف شد.'); AD.go('products'); } catch (e) { toast(e.message, true); }
  };
  return h('form', {
    class: 'page', novalidate: true,
    onsubmit: e => {
      e.preventDefault();
      busy(saveBtn, async () => {
        const body = collect();
        const saved = isNew ? await api('POST', '/r/products', body) : await api('PUT', `/r/products/${rec.id}`, body);
        toast('محصول ذخیره شد.');
        if (isNew) AD.go('products/' + saved.id); else AD.render();
      });
    },
  },
  h('div', { class: 'pagehead' }, h('h1', {}, isNew ? 'افزودن محصول' : 'ویرایش محصول', ' ', codeBadge(rec)), h('a', { class: 'btn ghost', href: '#/products' }, 'بازگشت به فهرست')),
  h('div', { class: 'pwrap' },
    h('div', { class: 'pmain' },
      card('اطلاعات اصلی', F.title.row, F.slug.row, F.shortDesc.row, F.desc.row),
      card('تصاویر', h('p', { class: 'muted' }, 'تصویر اول، تصویر اصلی محصول است. ترتیب را با فلش‌ها عوض کنید.'), gal),
      card('قیمت و موجودی', h('div', { class: 'fgrid' }, F.price.row, F.salePrice.row, F.sku.row, F.stock.row)),
      card('گزینه‌ها و تنوع‌ها (سایز، رنگ و...)', optBox, varBox),
      card('مشخصات فنی', specBox),
      card('جدول سایز', F.sizeChart.row),
      card('سئو', F.metaTitle.row, F.metaDesc.row)),
    h('div', { class: 'pside' },
      card('انتشار', F.status.row, F.featured.row, h('div', { class: 'actions col' }, saveBtn,
        !isNew ? h('a', { class: 'btn ghost', href: '/product/' + encodeURIComponent(rec.slug), target: '_blank', rel: 'noopener' }, ico('external'), 'مشاهده در سایت') : null,
        !isNew ? h('button', { class: 'btn danger ghost', type: 'button', onclick: remove }, ico('trash'), 'حذف محصول') : null)),
      card('دسته‌بندی‌ها', F.categories.row))),
  h('div', { class: 'savebar' }, save2));
};
})();
