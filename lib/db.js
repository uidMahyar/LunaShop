'use strict';
const fs = require('fs');
const path = require('path');
const { DEFAULT_SETTINGS } = require('./seed');

function merge(base, over) {
  const o = Array.isArray(base) ? [...base] : { ...base };
  for (const k of Object.keys(over || {})) {
    const b = base && base[k], v = over[k];
    o[k] = (b && typeof b === 'object' && !Array.isArray(b) && v && typeof v === 'object' && !Array.isArray(v)) ? merge(b, v) : v;
  }
  return o;
}

class Store {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'db.json');
    this.uploads = path.join(dir, 'uploads');
    this.rev = 0;
    this.timer = null;
    fs.mkdirSync(this.uploads, { recursive: true });
    fs.mkdirSync(path.join(dir, 'backups'), { recursive: true });
    this.fresh = !fs.existsSync(this.file);
    this.d = this.fresh
      ? { meta: { ids: {}, code: 0, orderNo: 1000, created: Date.now() }, settings: {}, sessions: {} }
      : JSON.parse(fs.readFileSync(this.file, 'utf8'));
    this.d.meta = this.d.meta || { ids: {}, code: 0, orderNo: 1000 };
    this.d.sessions = this.d.sessions || {};
    this.d.settings = this.d.settings || {};
  }

  col(n) { return this.d[n] || (this.d[n] = []); }
  settings() { return merge(DEFAULT_SETTINGS, this.d.settings); }
  nextCode() { return ++this.d.meta.code; }

  nextId(n) {
    const ids = this.d.meta.ids;
    const max = this.col(n).reduce((m, r) => Math.max(m, r.id || 0), 0);
    ids[n] = Math.max(ids[n] || 0, max) + 1;
    return ids[n];
  }

  add(n, rec, coded = false) {
    rec.id = this.nextId(n);
    if (coded) rec.code = this.nextCode();
    rec.createdAt = rec.updatedAt = Date.now();
    this.col(n).push(rec);
    this.save();
    return rec;
  }

  get(n, id) { id = +id; return this.col(n).find(r => r.id === id); }

  put(n, id, patch) {
    const r = this.get(n, id);
    if (!r) return null;
    Object.assign(r, patch, { updatedAt: Date.now() });
    this.save();
    return r;
  }

  del(n, id) {
    const a = this.col(n), i = a.findIndex(r => r.id === +id);
    if (i < 0) return false;
    a.splice(i, 1);
    this.save();
    return true;
  }

  save() {
    this.rev++;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 150);
  }

  flush() {
    clearTimeout(this.timer);
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.d));
    try { fs.renameSync(tmp, this.file); } catch { fs.copyFileSync(tmp, this.file); fs.unlinkSync(tmp); }
  }

  backupDaily() {
    try {
      const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const dir = path.join(this.dir, 'backups'), f = path.join(dir, `db-${day}.json`);
      if (!fs.existsSync(f) && fs.existsSync(this.file)) fs.copyFileSync(this.file, f);
      const all = fs.readdirSync(dir).filter(x => /^db-\d{8}\.json$/.test(x)).sort();
      while (all.length > 14) fs.unlinkSync(path.join(dir, all.shift()));
    } catch (e) { console.error('backup:', e.message); }
  }

  replaceAll(data) {
    this.d = data;
    this.d.meta = this.d.meta || { ids: {}, code: 0, orderNo: 1000 };
    this.d.sessions = {};
    this.d.settings = this.d.settings || {};
    this.save();
    this.flush();
  }
}

module.exports = { Store, merge };
