(() => {
'use strict';
const AD = window.AD;
const { h, $, api, ico } = AD;
const app = $('#app');

const NAV = [
  { id: 'dashboard', t: 'پیشخوان', i: 'home' },
  { g: 'فروشگاه' },
  { id: 'orders', t: 'سفارش‌ها', i: 'bag' },
  { id: 'products', t: 'محصولات', i: 'box' },
  { id: 'categories', t: 'دسته‌ها', i: 'folder' },
  { id: 'coupons', t: 'کدهای تخفیف', i: 'tag' },
  { id: 'shipping', t: 'روش‌های ارسال', i: 'truck' },
  { g: 'محتوا' },
  { id: 'banners', t: 'بنرها', i: 'image' },
  { id: 'pages', t: 'صفحات', i: 'file' },
  { id: 'menu_items', t: 'منوها', i: 'menu' },
  { id: 'media', t: 'رسانه‌ها', i: 'image' },
  { id: 'codes', t: 'کدها (متن‌ها)', i: 'hash' },
  { g: 'سیستم' },
  { id: 'users', t: 'کاربران', i: 'users' },
  { id: 'settings', t: 'تنظیمات', i: 'sliders' },
  { id: 'tools', t: 'ابزارها', i: 'wrench' },
];
const CODE_PERMS = ['texts', 'products', 'categories', 'banners', 'pages', 'menu_items', 'shipping'];
AD.can = p => { const m = AD.state.me; return !!m && (m.perms.includes('*') || m.perms.includes(p)); };
const allowed = id => (id === 'codes' ? CODE_PERMS.some(AD.can) : AD.can(id));

const parse = () => {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  let parts = [];
  try { parts = path.split('/').filter(Boolean).map(decodeURIComponent); } catch { parts = []; }
  return { parts, q: Object.fromEntries(new URLSearchParams(qs || '')) };
};
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

let token = 0, lastHash = null;
AD.render = async () => {
  if (!AD.state.me || AD.state.me.mustChange) return;
  const { parts, q } = parse();
  const name = parts[0] || 'dashboard';
  const view = $('#view');
  if (!view) return;
  const my = ++token;
  $('#side').classList.remove('open');
  document.querySelectorAll('.side a.nl').forEach(a => a.classList.toggle('on', a.dataset.id === name));
  view.replaceChildren(h('div', { class: 'loading' }, 'در حال بارگذاری...'));
  try {
    let node;
    if (!allowed(name === 'dashboard' ? 'dashboard' : name)) node = h('div', { class: 'page' }, h('div', { class: 'card' }, h('p', { class: 'empty' }, 'به این بخش دسترسی ندارید.')));
    else if (name === 'dashboard') node = await AD.views.dashboard(q);
    else if (name === 'orders') node = parts[1] ? await AD.views.order(parts[1]) : await AD.listView('orders', q);
    else if (name === 'products') node = parts[1] ? await AD.views.productForm(parts[1]) : await AD.listView('products', q);
    else if (['media', 'codes', 'settings', 'tools'].includes(name)) node = await AD.views[name](q);
    else if (own(AD.CFG, name)) node = parts[1] ? await AD.formView(name, parts[1]) : await AD.listView(name, q);
    else node = h('div', { class: 'page' }, h('div', { class: 'card' }, h('p', { class: 'empty' }, 'صفحه پیدا نشد.')));
    if (my !== token) return;
    view.replaceChildren(node);
    if (location.hash !== lastHash) window.scrollTo(0, 0);
    lastHash = location.hash;
  } catch (e) {
    if (my === token) view.replaceChildren(h('div', { class: 'page' }, h('div', { class: 'card err' }, e.message || 'خطا')));
  }
};

function buildShell() {
  const me = AD.state.me;
  const items = [];
  let pendingGroup = null;
  for (const n of NAV) {
    if (n.g) { pendingGroup = n.g; continue; }
    if (!allowed(n.id)) continue;
    if (pendingGroup) { items.push(h('h4', {}, pendingGroup)); pendingGroup = null; }
    items.push(h('a', { class: 'nl', href: '#/' + n.id, 'data-id': n.id }, ico(n.i), n.t));
  }
  const side = h('aside', { class: 'side', id: 'side' }, h('a', { class: 'logo', href: '#/dashboard' }, h('b', {}, 'پنل مدیریت'), h('small', {}, 'فروشگاه')), items);
  const codeIn = h('input', {
    type: 'search', placeholder: 'برو به کد...', inputMode: 'numeric', 'aria-label': 'برو به کد',
    onkeydown: e => { if (e.key === 'Enter' && codeIn.value.trim()) { AD.go('codes', { q: codeIn.value.trim() }); codeIn.value = ''; } },
  });
  const logout = h('button', { class: 'btn ghost sm', type: 'button', onclick: async () => { try { await api('POST', '/logout'); } catch { /* ignore */ } showLogin(); } }, ico('logout'), h('span', { class: 'hide-m' }, 'خروج'));
  const top = h('header', { class: 'top' },
    h('button', { class: 'ibtn menu', type: 'button', 'aria-label': 'منو', onclick: () => side.classList.toggle('open') }, ico('menu')),
    CODE_PERMS.some(AD.can) ? h('div', { class: 'tsearch', title: 'عدد کد را بنویسید و Enter بزنید' }, ico('hash'), codeIn) : null,
    h('div', { class: 'tright' },
      h('a', { class: 'btn ghost sm', href: '/', target: '_blank', rel: 'noopener' }, ico('external'), h('span', { class: 'hide-m' }, 'مشاهده سایت')),
      h('a', { class: 'btn ghost sm', href: '/?codes=1', target: '_blank', rel: 'noopener', title: 'سایت را با نمایش کد روی هر متن باز می‌کند' }, ico('eye'), h('span', { class: 'hide-m' }, 'سایت با کدها')),
      h('span', { class: 'muted hide-m' }, me.name), logout));
  app.replaceChildren(h('div', { class: 'shell' }, side, h('div', { class: 'main-col' }, top, h('main', { id: 'view' })), h('div', { class: 'veil', onclick: () => side.classList.remove('open') })));
}

function showLogin(msg) {
  AD.state.me = null;
  const u = h('input', { type: 'text', autocomplete: 'username', dir: 'ltr', required: true, 'aria-label': 'نام کاربری' });
  const p = h('input', { type: 'password', autocomplete: 'current-password', dir: 'ltr', required: true, 'aria-label': 'رمز عبور' });
  const err = h('div', { class: 'lerr', role: 'alert' }, msg || '');
  const btn = h('button', { class: 'btn primary block', type: 'submit' }, 'ورود');
  app.replaceChildren(h('div', { class: 'login' }, h('form', {
    class: 'lcard',
    onsubmit: async e => {
      e.preventDefault();
      err.textContent = '';
      btn.disabled = true;
      try { AD.state.me = await api('POST', '/login', { username: u.value, password: p.value }); boot(); } catch (x) { err.textContent = x.message; } finally { btn.disabled = false; }
    },
  }, h('h1', {}, 'ورود به پنل مدیریت'), h('label', { class: 'fld' }, h('span', { class: 'lbl' }, 'نام کاربری'), u), h('label', { class: 'fld' }, h('span', { class: 'lbl' }, 'رمز عبور'), p), err, btn)));
  u.focus();
}

function showMustChange() {
  const cur = h('input', { type: 'password', autocomplete: 'current-password', dir: 'ltr', required: true });
  const nw = h('input', { type: 'password', autocomplete: 'new-password', dir: 'ltr', required: true });
  const nw2 = h('input', { type: 'password', autocomplete: 'new-password', dir: 'ltr', required: true });
  const err = h('div', { class: 'lerr', role: 'alert' });
  const btn = h('button', { class: 'btn primary block', type: 'submit' }, 'ذخیره و ورود');
  app.replaceChildren(h('div', { class: 'login' }, h('form', {
    class: 'lcard',
    onsubmit: async e => {
      e.preventDefault();
      err.textContent = '';
      if (nw.value !== nw2.value) { err.textContent = 'تکرار رمز جدید یکسان نیست.'; return; }
      btn.disabled = true;
      try { await api('POST', '/password', { current: cur.value, next: nw.value }); boot(); } catch (x) { err.textContent = x.message; } finally { btn.disabled = false; }
    },
  }, h('h1', {}, 'تعیین رمز عبور جدید'), h('p', { class: 'muted' }, 'برای امنیت، رمز اولیه را باید همین حالا عوض کنید.'),
  h('label', { class: 'fld' }, h('span', { class: 'lbl' }, 'رمز فعلی (رمز اولیه)'), cur), h('label', { class: 'fld' }, h('span', { class: 'lbl' }, 'رمز جدید (حداقل ۸ کاراکتر)'), nw), h('label', { class: 'fld' }, h('span', { class: 'lbl' }, 'تکرار رمز جدید'), nw2), err, btn)));
  cur.focus();
}

async function boot() {
  try { AD.state.me = await api('GET', '/me'); } catch { showLogin(); return; }
  if (AD.state.me.mustChange) { showMustChange(); return; }
  buildShell();
  AD.render();
}
AD.onLogout = () => showLogin('نشست شما تمام شده است. دوباره وارد شوید.');
window.addEventListener('hashchange', () => AD.render());
boot();
})();
