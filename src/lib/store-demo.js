// Proefmodus: alles blijft op dit toestel (localStorage). Handig om te proberen zonder Supabase.

const KEY = 'boekje-demo-v1';
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function save(db) {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {}
  listeners.forEach((fn) => fn());
}

function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
}

function seed() {
  const hid = 'demo-household';
  return {
    user: { id: 'demo-user', email: 'proef@toestel' },
    household: { id: hid, name: 'Ons gezin', invite_code: 'PROEF1', role: 'eigenaar', members: [{ user_id: 'demo-user', display_name: 'Ik', role: 'eigenaar' }] },
    entries: [],
    budgets: [],
    rows: {},
  };
}

function db() {
  let d = load();
  if (!d) { d = seed(); save(d); }
  return d;
}

export const demoStore = {
  mode: 'demo',
  async getUser() { return db().user; },
  onAuth() { return () => {}; },
  async signIn() {}, async signUp() {}, async signOut() {},
  async getMyHousehold() { return db().household; },
  async createHousehold() { return db().household; },
  async joinHousehold() { return db().household; },
  async updateMyName(_hid, name) {
    const d = db();
    d.household.members[0].display_name = name;
    save(d);
  },
  async listEntries(_hid, from, to) {
    return db().entries.filter((e) => e.date >= from && e.date <= to);
  },
  async addEntry(entry) {
    const d = db();
    const row = { ...entry, id: uid(), created_by: d.user.id, created_at: new Date().toISOString() };
    d.entries.push(row);
    save(d);
    return row;
  },
  async addEntries(list) {
    const d = db();
    for (const entry of list) d.entries.push({ ...entry, id: uid(), created_by: d.user.id, created_at: new Date().toISOString() });
    save(d);
    return list.length;
  },
  async deleteEntry(id) {
    const d = db();
    d.entries = d.entries.filter((e) => e.id !== id);
    save(d);
  },
  async listBudgets() { return db().budgets; },
  async setBudget(hid, book, category, cents) {
    const d = db();
    d.budgets = d.budgets.filter((b) => !(b.book === book && b.category === category));
    if (cents > 0) d.budgets.push({ household_id: hid, book, category, amount_cents: cents });
    save(d);
  },
  async listRows(table) { return (db().rows || {})[table] || []; },
  async addRows(table, rows) {
    const d = db();
    d.rows = d.rows || {};
    const made = rows.map((r) => ({ id: uid(), created_at: new Date().toISOString(), ...r }));
    d.rows[table] = [...(d.rows[table] || []), ...made];
    save(d);
    return made;
  },
  async updateRow(table, id, patch) {
    const d = db();
    const list = (d.rows || {})[table] || [];
    const i = list.findIndex((r) => r.id === id);
    if (i < 0) return null;
    list[i] = { ...list[i], ...patch };
    save(d);
    return list[i];
  },
  async deleteRows(table, ids) {
    const d = db();
    d.rows = d.rows || {};
    d.rows[table] = (d.rows[table] || []).filter((r) => !ids.includes(r.id));
    save(d);
  },
  async setMenu(hid, date, meal, recipeId = null, slot = 'avond') {
    const d = db();
    d.rows = d.rows || {};
    const list = (d.rows.menu_days || []).filter((m) => !(m.date === date && (m.slot || 'avond') === slot));
    if (meal) list.push({ household_id: hid, date, slot, meal, recipe_id: recipeId });
    d.rows.menu_days = list;
    save(d);
  },
  async setCalendarUrl() { throw new Error('De agenda koppelen kan alleen als de app aan Supabase gekoppeld is.'); },
  // Proefmodus: een agenda om te proberen kan je klaarzetten in 'boekje-demo-ics'.
  async hasCalendar() { try { return Boolean(localStorage.getItem('boekje-demo-ics')); } catch { return false; } },
  async calendarIcs() { try { return localStorage.getItem('boekje-demo-ics'); } catch { return null; } },
  async setPhotoAlbums() { throw new Error('Foto-albums koppelen kan alleen als de app aan Supabase gekoppeld is.'); },
  async photoAlbumCount() { return 0; },
  async scanPantryPhoto() { const e = new Error('geen-ai'); e.code = 'geen-ai'; throw e; },
  async albumPhotos() {
    // In de proefmodus kan je zelf foto's klaarzetten (handig om de ruststand te proberen).
    try { return JSON.parse(localStorage.getItem('boekje-demo-fotos') || '[]'); } catch { return []; }
  },
  subscribe(_hid, fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  reset() { localStorage.removeItem(KEY); listeners.forEach((fn) => fn()); },
};
