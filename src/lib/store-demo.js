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
  subscribe(_hid, fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  reset() { localStorage.removeItem(KEY); listeners.forEach((fn) => fn()); },
};
