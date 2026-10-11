'use strict';
const crypto = require('crypto');

class HttpError extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}
const bad = (msg, status = 400) => new HttpError(status, msg);

/* ---------- متن و اعداد ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const FA = '۰۱۲۳۴۵۶۷۸۹', AR = '٠١٢٣٤٥٦٧٨٩';
const digits = s => String(s ?? '').replace(/[۰-۹]/g, d => FA.indexOf(d)).replace(/[٠-٩]/g, d => AR.indexOf(d));
const fixFa = s => String(s ?? '').replace(/ي/g, 'ی').replace(/ك/g, 'ک');
const norm = s => fixFa(digits(s)).toLowerCase().replace(/[\u200c\u064B-\u065F\u0670]/g, '').trim();
const slugify = s => fixFa(digits(s)).toLowerCase()
  .replace(/[\u064B-\u065F\u0670]/g, '')
  .replace(/[^\p{L}\p{N}\u200c]+/gu, '-').replace(/\u200c/g, '-')
  .replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
const str = (v, max = 300) => (v == null ? '' : String(v)).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
const int = (v, d = 0) => {
  if (v === '' || v == null) return d;
  const n = Math.trunc(Number(digits(v).replace(/[,٬\s]/g, '')));
  return Number.isFinite(n) ? n : d;
};
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const numOrNull = v => (v === '' || v == null) ? null : Math.max(0, int(v));
const money = n => Number(n || 0).toLocaleString('fa-IR');
const pn = n => String(n).replace(/\d/g, d => FA[d]);
const color = (v, d) => /^#[0-9a-f]{6}$/i.test(String(v || '')) ? String(v) : d;
const safeLink = v => { v = str(v, 500); return /^(https?:\/\/|\/|#|mailto:|tel:)/i.test(v) ? v : ''; };

const normPhone = s => {
  let p = digits(s).replace(/[^\d+]/g, '');
  if (p.startsWith('+98')) p = '0' + p.slice(3);
  else if (p.startsWith('0098')) p = '0' + p.slice(4);
  else if (p.startsWith('98') && p.length === 12) p = '0' + p.slice(2);
  return p;
};
const isMobile = p => /^09\d{9}$/.test(p);

function uniqueSlug(list, base, selfId, fallback = 'item') {
  const s = slugify(base) || fallback;
  let out = s, n = 1;
  while (list.some(r => r.slug === out && r.id !== selfId)) out = `${s}-${++n}`;
  return out;
}

/* ---------- امنیت ---------- */
const hashPw = pw => {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt$${salt}$${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
};
const checkPw = (pw, stored) => {
  try {
    const [t, salt, h] = String(stored).split('$');
    if (t !== 'scrypt') return false;
    const a = crypto.scryptSync(pw, salt, 64), b = Buffer.from(h, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { return false; }
};
const token = () => crypto.randomBytes(32).toString('hex');
const TA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const trackingCode = () => Array.from({ length: 8 }, () => TA[crypto.randomInt(TA.length)]).join('');
const randomPassword = () => Array.from({ length: 10 }, () => TA[crypto.randomInt(TA.length)]).join('');

const parseCookies = h => {
  const out = {};
  for (const p of String(h || '').split(';')) {
    const i = p.indexOf('=');
    if (i < 1) continue;
    try { out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); } catch { /* ignore */ }
  }
  return out;
};

function limiter(max, ms) {
  const m = new Map();
  return key => {
    const now = Date.now();
    const a = (m.get(key) || []).filter(t => now - t < ms);
    if (a.length >= max) { m.set(key, a); return false; }
    a.push(now); m.set(key, a);
    if (m.size > 5000) for (const [k, v] of m) if (!v.length || now - v[v.length - 1] > ms) m.delete(k);
    return true;
  };
}

/* ---------- پاک‌سازی HTML (متن‌های غنی) ---------- */
const OK_TAGS = new Set('p br strong b em i u s ul ol li h2 h3 h4 blockquote a img table thead tbody tr th td hr span div figure figcaption'.split(' '));
const OK_ATTR = { a: ['href', 'target', 'title'], img: ['src', 'alt', 'width', 'height'], td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan'], '*': ['dir', 'style'] };
function cleanHtml(html) {
  html = String(html ?? '').slice(0, 200000)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed|noscript|template|svg|math)\b[\s\S]*?<\/\1\s*>/gi, '');
  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (m, tag, rest) => {
    tag = tag.toLowerCase();
    if (!OK_TAGS.has(tag)) return '';
    if (m[1] === '/') return `</${tag}>`;
    const allowed = [...(OK_ATTR[tag] || []), ...OK_ATTR['*']];
    let out = '', blank = false, hasSrc = false;
    for (const a of rest.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
      const name = a[1].toLowerCase();
      let val = a[2] ?? a[3] ?? a[4] ?? '';
      if (!allowed.includes(name)) continue;
      if (name === 'href' && !/^\s*(https?:|mailto:|tel:|\/|#)/i.test(val)) continue;
      if (name === 'src' && !/^\s*(https?:|\/)/i.test(val)) continue;
      if (name === 'src') hasSrc = true;
      if (name === 'style') { const t = /^\s*text-align:\s*(right|left|center|justify)\s*;?\s*$/i.exec(val); if (!t) continue; val = `text-align: ${t[1].toLowerCase()}`; }
      if (name === 'target') { if (val !== '_blank') continue; blank = true; }
      out += ` ${name}="${esc(val.replace(/&amp;/g, '&'))}"`;
    }
    if (tag === 'img' && !hasSrc) return '';
    if (tag === 'a' && blank) out += ' rel="noopener noreferrer"';
    return `<${tag}${out}>`;
  });
}

/* ---------- تاریخ (تهران / شمسی) ---------- */
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' });
const dayKey = ts => dayFmt.format(ts);
const jdFmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
const jd = ts => jdFmt.format(ts);

module.exports = {
  HttpError, bad, esc, digits, norm, slugify, str, int, clamp, numOrNull, money, pn, color, safeLink,
  normPhone, isMobile, uniqueSlug, hashPw, checkPw, token, trackingCode, randomPassword, parseCookies,
  limiter, cleanHtml, dayKey, jd,
};
