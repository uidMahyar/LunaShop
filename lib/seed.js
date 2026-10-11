'use strict';
const fs = require('fs');
const path = require('path');
const U = require('./util');

const DEFAULT_SETTINGS = {
  contact: { phone: '', email: '', address: '', hours: '' },
  social: { instagram: '', telegram: '', whatsapp: '', eitaa: '' },
  theme: { primary: '#1b1f2a', accent: '#3b5bdb', sale: '#d92d20', radius: 6, logo: '', favicon: '' },
  seo: { title: '', description: '' },
  shop: { perPage: 12, lowStock: 3, showOutOfStock: true, catsInHeader: true, minOrder: 0 },
  payments: {
    cod: { enabled: true, title: 'پرداخت در محل' },
    card: { enabled: true, title: 'کارت به کارت', number: '', owner: '' },
  },
  maintenance: false,
};

/* هر متن سایت یک «کد» دارد؛ ترتیب این لیست = شماره‌ی کد (کد ۱ = نام سایت).
   [کلید، گروه، توضیح محل استفاده، مقدار پیش‌فرض] */
const TEXTS = [
  ['site_name', 'عمومی', 'نام سایت', 'نام فروشگاه'],
  ['site_slogan', 'عمومی', 'شعار سایت', 'شعار فروشگاه شما اینجا'],
  ['currency', 'عمومی', 'واحد پول', 'تومان'],
  ['topbar', 'هدر و فوتر', 'نوار بالای سایت', 'ارسال به سراسر کشور'],
  ['search_ph', 'هدر و فوتر', 'متن داخل کادر جستجو', 'جستجوی محصولات...'],
  ['cart_link', 'هدر و فوتر', 'لینک سبد خرید در هدر', 'سبد خرید'],
  ['menu_cats', 'هدر و فوتر', 'عنوان دسته‌ها در منوی موبایل', 'دسته‌بندی‌ها'],
  ['footer_about_title', 'هدر و فوتر', 'عنوان ستون اول فوتر', 'درباره ما'],
  ['footer_about_text', 'هدر و فوتر', 'متن ستون اول فوتر', 'این متن را از پنل مدیریت (بخش کدها) تغییر دهید.'],
  ['footer_links_title', 'هدر و فوتر', 'عنوان ستون لینک‌های فوتر', 'دسترسی سریع'],
  ['footer_contact_title', 'هدر و فوتر', 'عنوان ستون تماس', 'تماس با ما'],
  ['footer_phone_label', 'هدر و فوتر', 'برچسب تلفن', 'تلفن'],
  ['footer_email_label', 'هدر و فوتر', 'برچسب ایمیل', 'ایمیل'],
  ['footer_address_label', 'هدر و فوتر', 'برچسب آدرس', 'آدرس'],
  ['footer_copy', 'هدر و فوتر', 'متن کپی‌رایت', 'تمامی حقوق این سایت محفوظ است.'],
  ['breadcrumb_home', 'هدر و فوتر', 'اولین بخش مسیر صفحه', 'خانه'],
  ['home_cats_title', 'صفحه اصلی', 'عنوان بخش دسته‌ها', 'دسته‌بندی‌ها'],
  ['home_featured_title', 'صفحه اصلی', 'عنوان بخش محصولات ویژه', 'محصولات ویژه'],
  ['home_new_title', 'صفحه اصلی', 'عنوان بخش جدیدترین‌ها', 'جدیدترین محصولات'],
  ['view_all', 'صفحه اصلی', 'لینک «مشاهده همه»', 'مشاهده همه'],
  ['shop_title', 'لیست محصولات', 'عنوان صفحه فروشگاه', 'فروشگاه'],
  ['search_title', 'لیست محصولات', 'عنوان نتایج جستجو', 'نتایج جستجو'],
  ['filter_title', 'لیست محصولات', 'عنوان بخش فیلترها', 'فیلترها'],
  ['filter_cats', 'لیست محصولات', 'فیلتر: دسته‌بندی', 'دسته‌بندی'],
  ['filter_price', 'لیست محصولات', 'فیلتر: محدوده قیمت', 'محدوده قیمت'],
  ['filter_min', 'لیست محصولات', 'فیلتر: حداقل', 'از'],
  ['filter_max', 'لیست محصولات', 'فیلتر: حداکثر', 'تا'],
  ['filter_only_stock', 'لیست محصولات', 'فیلتر: فقط موجود', 'فقط کالاهای موجود'],
  ['filter_apply', 'لیست محصولات', 'دکمه اعمال فیلتر', 'اعمال فیلتر'],
  ['filter_clear', 'لیست محصولات', 'دکمه حذف فیلترها', 'حذف فیلترها'],
  ['sort_label', 'لیست محصولات', 'برچسب مرتب‌سازی', 'مرتب‌سازی'],
  ['sort_new', 'لیست محصولات', 'مرتب‌سازی: جدیدترین', 'جدیدترین'],
  ['sort_cheap', 'لیست محصولات', 'مرتب‌سازی: ارزان‌ترین', 'ارزان‌ترین'],
  ['sort_pricey', 'لیست محصولات', 'مرتب‌سازی: گران‌ترین', 'گران‌ترین'],
  ['no_products', 'لیست محصولات', 'پیام خالی بودن لیست', 'محصولی پیدا نشد.'],
  ['page_prev', 'لیست محصولات', 'صفحه قبلی', 'قبلی'],
  ['page_next', 'لیست محصولات', 'صفحه بعدی', 'بعدی'],
  ['badge_sale', 'لیست محصولات', 'نشان حراج', 'حراج'],
  ['badge_out', 'لیست محصولات', 'نشان ناموجود', 'ناموجود'],
  ['price_from', 'لیست محصولات', 'پیش از قیمت (محصول دارای تنوع)', 'از'],
  ['product_sku', 'صفحه محصول', 'برچسب کد کالا', 'کد کالا'],
  ['product_cats', 'صفحه محصول', 'برچسب دسته‌بندی', 'دسته‌بندی'],
  ['product_qty', 'صفحه محصول', 'برچسب تعداد', 'تعداد'],
  ['add_to_cart', 'صفحه محصول', 'دکمه افزودن به سبد', 'افزودن به سبد خرید'],
  ['choose_option', 'صفحه محصول', 'متن انتخاب گزینه', 'انتخاب کنید'],
  ['need_options', 'صفحه محصول', 'پیام انتخاب نکردن گزینه‌ها', 'لطفاً همه‌ی گزینه‌ها را انتخاب کنید.'],
  ['unavailable_combo', 'صفحه محصول', 'پیام ترکیب ناموجود', 'این ترکیب در حال حاضر موجود نیست.'],
  ['low_stock', 'صفحه محصول', 'پیام موجودی کم ({n} = تعداد)', 'تنها {n} عدد باقی مانده است.'],
  ['added_ok', 'صفحه محصول', 'پیام افزوده‌شدن به سبد', 'به سبد خرید اضافه شد.'],
  ['tab_desc', 'صفحه محصول', 'عنوان بخش توضیحات', 'توضیحات'],
  ['tab_specs', 'صفحه محصول', 'عنوان بخش مشخصات', 'مشخصات'],
  ['tab_size', 'صفحه محصول', 'عنوان بخش جدول سایز', 'جدول سایز'],
  ['related_title', 'صفحه محصول', 'عنوان محصولات مرتبط', 'محصولات مرتبط'],
  ['cart_title', 'سبد و پرداخت', 'عنوان صفحه سبد خرید', 'سبد خرید'],
  ['cart_empty', 'سبد و پرداخت', 'پیام خالی بودن سبد', 'سبد خرید شما خالی است.'],
  ['cart_continue', 'سبد و پرداخت', 'دکمه ادامه‌ی خرید', 'ادامه‌ی خرید'],
  ['cart_remove', 'سبد و پرداخت', 'دکمه حذف از سبد', 'حذف'],
  ['cart_product', 'سبد و پرداخت', 'ستون محصول', 'محصول'],
  ['cart_price', 'سبد و پرداخت', 'ستون قیمت', 'قیمت'],
  ['cart_sum', 'سبد و پرداخت', 'ستون جمع', 'جمع'],
  ['cart_subtotal', 'سبد و پرداخت', 'جمع کالاها', 'جمع کالاها'],
  ['cart_discount', 'سبد و پرداخت', 'تخفیف', 'تخفیف'],
  ['cart_shipping', 'سبد و پرداخت', 'هزینه ارسال', 'هزینه‌ی ارسال'],
  ['cart_total', 'سبد و پرداخت', 'مبلغ قابل پرداخت', 'مبلغ قابل پرداخت'],
  ['coupon_label', 'سبد و پرداخت', 'کادر کد تخفیف', 'کد تخفیف دارید؟'],
  ['coupon_apply', 'سبد و پرداخت', 'دکمه اعمال کد تخفیف', 'اعمال کد'],
  ['coupon_ok', 'سبد و پرداخت', 'پیام موفقیت کد تخفیف', 'کد تخفیف اعمال شد.'],
  ['free_word', 'سبد و پرداخت', 'کلمه رایگان', 'رایگان'],
  ['go_checkout', 'سبد و پرداخت', 'دکمه ادامه و ثبت سفارش', 'ادامه و ثبت سفارش'],
  ['checkout_title', 'سبد و پرداخت', 'عنوان صفحه ثبت سفارش', 'ثبت سفارش'],
  ['f_name', 'سبد و پرداخت', 'فرم: نام', 'نام و نام خانوادگی'],
  ['f_phone', 'سبد و پرداخت', 'فرم: موبایل', 'شماره موبایل'],
  ['f_email', 'سبد و پرداخت', 'فرم: ایمیل', 'ایمیل (اختیاری)'],
  ['f_province', 'سبد و پرداخت', 'فرم: استان', 'استان'],
  ['f_city', 'سبد و پرداخت', 'فرم: شهر', 'شهر'],
  ['f_address', 'سبد و پرداخت', 'فرم: آدرس', 'آدرس کامل'],
  ['f_postal', 'سبد و پرداخت', 'فرم: کد پستی', 'کد پستی'],
  ['f_note', 'سبد و پرداخت', 'فرم: توضیحات', 'توضیحات سفارش (اختیاری)'],
  ['ship_title', 'سبد و پرداخت', 'عنوان روش ارسال', 'روش ارسال'],
  ['pay_title', 'سبد و پرداخت', 'عنوان روش پرداخت', 'روش پرداخت'],
  ['place_order', 'سبد و پرداخت', 'دکمه ثبت نهایی', 'ثبت نهایی سفارش'],
  ['success_title', 'سبد و پرداخت', 'عنوان سفارش موفق', 'سفارش شما ثبت شد'],
  ['success_text', 'سبد و پرداخت', 'متن سفارش موفق', 'از خرید شما سپاسگزاریم. سفارش شما به‌زودی بررسی می‌شود.'],
  ['success_code', 'سبد و پرداخت', 'برچسب کد پیگیری', 'کد پیگیری سفارش'],
  ['success_card', 'سبد و پرداخت', 'راهنمای کارت به کارت', 'لطفاً مبلغ سفارش را به کارت زیر واریز کنید و رسید را برای ما ارسال کنید.'],
  ['track_title', 'پیگیری سفارش', 'عنوان صفحه پیگیری', 'پیگیری سفارش'],
  ['track_code', 'پیگیری سفارش', 'برچسب کد پیگیری', 'کد پیگیری'],
  ['track_btn', 'پیگیری سفارش', 'دکمه پیگیری', 'پیگیری'],
  ['track_notfound', 'پیگیری سفارش', 'پیام پیدا نشدن سفارش', 'سفارشی با این مشخصات پیدا نشد.'],
  ['track_status', 'پیگیری سفارش', 'برچسب وضعیت سفارش', 'وضعیت سفارش'],
  ['st_pending', 'وضعیت سفارش', 'وضعیت: در انتظار', 'در انتظار بررسی'],
  ['st_processing', 'وضعیت سفارش', 'وضعیت: در حال آماده‌سازی', 'در حال آماده‌سازی'],
  ['st_shipped', 'وضعیت سفارش', 'وضعیت: ارسال شده', 'ارسال شده'],
  ['st_delivered', 'وضعیت سفارش', 'وضعیت: تحویل شده', 'تحویل داده شده'],
  ['st_cancelled', 'وضعیت سفارش', 'وضعیت: لغو شده', 'لغو شده'],
  ['st_returned', 'وضعیت سفارش', 'وضعیت: مرجوع شده', 'مرجوع شده'],
  ['page_404', 'پیام‌ها', 'پیام صفحه پیدا نشد', 'صفحه‌ای که دنبالش بودید پیدا نشد.'],
  ['back_home', 'پیام‌ها', 'دکمه بازگشت به خانه', 'بازگشت به صفحه‌ی اصلی'],
  ['maintenance', 'پیام‌ها', 'پیام حالت به‌روزرسانی سایت', 'سایت در حال به‌روزرسانی است. لطفاً کمی بعد مراجعه کنید.'],
  ['err_generic', 'پیام‌ها', 'پیام خطای عمومی', 'خطایی رخ داد. دوباره تلاش کنید.'],
];

/* افزودن متن‌های جاافتاده (برای نسخه‌های بعدی) بدون دست‌زدن به متن‌های ویرایش‌شده */
function syncTexts(db) {
  const list = db.col('texts');
  for (const [key, group, label, value] of TEXTS) {
    const t = list.find(x => x.key === key);
    if (t) { t.group = group; t.label = label; t.def = value; }
    else db.add('texts', { key, group, label, value, def: value }, true);
  }
}

const SIZE_TABLE = '<table><thead><tr><th>سایز</th><th>دور کمر</th><th>دور سینه</th><th>قد</th></tr></thead><tbody>' +
  ['S', 'M', 'L', 'XL'].map(s => `<tr><td>${s}</td><td>—</td><td>—</td><td>—</td></tr>`).join('') + '</tbody></table>';
const LOREM = '<p>توضیحات این محصول را از پنل مدیریت ویرایش کنید.</p>';

function seed(db) {
  syncTexts(db);

  /* دسته‌های پیش‌فرض (بدون نام مشخص) */
  const cats = [];
  for (let i = 1; i <= 6; i++) cats.push(db.add('categories', { name: `دسته ${U.pn(i)}`, slug: `cat-${i}`, parent: 0, image: '', description: '', order: i, active: true, metaTitle: '', metaDesc: '' }, true));
  for (let i = 1; i <= 2; i++) db.add('categories', { name: `زیردسته ${U.pn(1)}-${U.pn(i)}`, slug: `cat-1-${i}`, parent: cats[0].id, image: '', description: '', order: i, active: true, metaTitle: '', metaDesc: '' }, true);

  /* بنرها */
  db.add('banners', { title: 'عنوان بنر اول', subtitle: 'متن توضیحی بنر را از پنل تغییر دهید', buttonText: 'مشاهده محصولات', link: '/shop', image: '', bg: '#1b1f2a', order: 1, active: true }, true);
  db.add('banners', { title: 'عنوان بنر دوم', subtitle: 'برای هر بنر تصویر یا رنگ پس‌زمینه تعیین کنید', buttonText: '', link: '', image: '', bg: '#3b5bdb', order: 2, active: true }, true);

  /* صفحات */
  const pages = [['درباره ما', 'about'], ['تماس با ما', 'contact'], ['قوانین و مقررات', 'terms']];
  for (const [title, slug] of pages) db.add('pages', { title, slug, content: LOREM, status: 'published', order: 0, metaTitle: '', metaDesc: '' }, true);

  /* منوها */
  const hm = [['خانه', '/'], ['فروشگاه', '/shop'], ['درباره ما', '/page/about'], ['تماس با ما', '/page/contact']];
  hm.forEach(([label, url], i) => db.add('menu_items', { menu: 'header', label, url, order: i + 1, active: true, newTab: false }, true));
  const fm = [['قوانین و مقررات', '/page/terms'], ['پیگیری سفارش', '/track'], ['سبد خرید', '/cart']];
  fm.forEach(([label, url], i) => db.add('menu_items', { menu: 'footer', label, url, order: i + 1, active: true, newTab: false }, true));

  /* روش‌های ارسال */
  db.add('shipping', { name: 'پست پیشتاز', cost: 60000, freeOver: 2000000, description: 'تحویل ۳ تا ۵ روز کاری', order: 1, active: true }, true);
  db.add('shipping', { name: 'پیک موتوری', cost: 90000, freeOver: 0, description: 'فقط داخل شهر', order: 2, active: true }, true);

  /* محصولات نمونه (قابل حذف یکجا از «ابزارها») */
  const prods = [
    { price: 450000, sale: 0, stock: 12, featured: true },
    { price: 780000, sale: 650000, stock: 5, featured: true },
    { price: 1250000, sale: 0, stock: null, featured: true, opts: [{ name: 'سایز', values: ['S', 'M', 'L'] }, { name: 'رنگ', values: ['مشکی', 'سفید'] }] },
    { price: 320000, sale: 0, stock: 0, featured: false },
    { price: 990000, sale: 790000, stock: 8, featured: false, opts: [{ name: 'سایز', values: ['M', 'L', 'XL'] }] },
    { price: 560000, sale: 0, stock: 20, featured: false },
    { price: 2100000, sale: 0, stock: 3, featured: false },
    { price: 275000, sale: 0, stock: 40, featured: false },
  ];
  const top = db.col('categories').filter(c => !c.parent);
  prods.forEach((d, i) => {
    const n = U.pn(i + 1);
    const p = {
      title: `محصول ${n}`, slug: `product-${i + 1}`, status: 'published', featured: !!d.featured,
      categories: [top[i % top.length].id], price: d.price, salePrice: d.sale, sku: `P-${100 + i + 1}`, stock: d.stock,
      images: [], shortDesc: 'توضیح کوتاه محصول نمونه.', desc: LOREM, sizeChart: d.opts ? SIZE_TABLE : '',
      specs: [{ k: 'جنس', v: '—' }, { k: 'کشور سازنده', v: '—' }], options: d.opts || [], variants: [],
      metaTitle: '', metaDesc: '', demo: true,
    };
    if (d.opts) {
      let combos = [{}];
      for (const o of d.opts) combos = combos.flatMap(c => o.values.map(v => ({ ...c, [o.name]: v })));
      p.variants = combos.map((combo, k) => ({ id: k + 1, combo, sku: '', price: null, salePrice: null, stock: k % 5 === 4 ? 0 : 10, active: true }));
    }
    db.add('products', p, true);
  });

  /* ادمین اولیه */
  const pw = U.randomPassword();
  db.add('users', { name: 'مدیر سایت', username: 'admin', pass: U.hashPw(pw), role: 'admin', active: true, mustChange: true });
  try { fs.writeFileSync(path.join(db.dir, 'FIRST_LOGIN.txt'), `username: admin\npassword: ${pw}\n(this file can be deleted after you change the password)\n`); } catch { /* ignore */ }
  return { username: 'admin', password: pw };
}

module.exports = { DEFAULT_SETTINGS, TEXTS, seed, syncTexts };
