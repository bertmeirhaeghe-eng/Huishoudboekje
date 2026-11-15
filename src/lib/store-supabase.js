// Gedeelde gegevens via Supabase. De beveiliging zit in de database-regels (supabase/schema.sql).
import { createClient } from '@supabase/supabase-js';

export function createSupabaseStore(url, anonKey) {
  const sb = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } });

  const must = ({ data, error }) => {
    if (error) throw new Error(translate(error.message));
    return data;
  };

  return {
    mode: 'cloud',
    async getUser() {
      const { data } = await sb.auth.getSession();
      return data.session?.user || null;
    },
    onAuth(fn) {
      const { data } = sb.auth.onAuthStateChange((_e, session) => fn(session?.user || null));
      return () => data.subscription.unsubscribe();
    },
    async signIn(email, password) {
      must(await sb.auth.signInWithPassword({ email, password }));
    },
    async signUp(email, password) {
      const data = must(await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.href.split('#')[0] } }));
      return { needsConfirm: !data.session };
    },
    async signOut() { await sb.auth.signOut(); },

    async getMyHousehold() {
      const user = await this.getUser();
      if (!user) return null;
      const mine = must(await sb.from('household_members').select('household_id, role').eq('user_id', user.id).limit(1));
      if (!mine.length) return null;
      const hid = mine[0].household_id;
      const h = must(await sb.from('households').select('id, name, invite_code').eq('id', hid).single());
      const members = must(await sb.from('household_members').select('user_id, display_name, role').eq('household_id', hid));
      return { ...h, role: mine[0].role, members };
    },
    async createHousehold(name, displayName) {
      must(await sb.rpc('create_household', { p_name: name, p_display_name: displayName }));
      return this.getMyHousehold();
    },
    async joinHousehold(code, displayName) {
      must(await sb.rpc('join_household', { p_code: code.trim().toUpperCase(), p_display_name: displayName }));
      return this.getMyHousehold();
    },
    async updateMyName(hid, name) {
      const user = await this.getUser();
      must(await sb.from('household_members').update({ display_name: name }).eq('household_id', hid).eq('user_id', user.id));
    },

    async listEntries(hid, from, to) {
      return must(await sb.from('entries').select('*').eq('household_id', hid).gte('date', from).lte('date', to).order('date', { ascending: false }));
    },
    async addEntry(entry) {
      return must(await sb.from('entries').insert(entry).select().single());
    },
    async deleteEntry(id) {
      must(await sb.from('entries').delete().eq('id', id));
    },
    async listBudgets(hid) {
      return must(await sb.from('budgets').select('*').eq('household_id', hid));
    },
    async setBudget(hid, book, category, cents) {
      if (cents > 0) {
        must(await sb.from('budgets').upsert({ household_id: hid, book, category, amount_cents: cents }));
      } else {
        must(await sb.from('budgets').delete().eq('household_id', hid).eq('book', book).eq('category', category));
      }
    },
    // Live: als een gezinslid iets toevoegt, ververst het scherm vanzelf.
    subscribe(hid, fn) {
      const ch = sb
        .channel('boekje-' + hid)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'entries', filter: `household_id=eq.${hid}` }, fn)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets', filter: `household_id=eq.${hid}` }, fn)
        .subscribe();
      return () => sb.removeChannel(ch);
    },
  };
}

function translate(msg) {
  const m = String(msg || '');
  if (/Invalid login credentials/i.test(m)) return 'E-mail of wachtwoord klopt niet.';
  if (/Email not confirmed/i.test(m)) return 'Bevestig eerst je e-mailadres via de mail die je kreeg.';
  if (/already registered/i.test(m)) return 'Dit e-mailadres heeft al een account. Log gewoon in.';
  if (/Password should be at least/i.test(m)) return 'Kies een wachtwoord van minstens 6 tekens.';
  if (/invite code/i.test(m)) return 'Die uitnodigingscode bestaat niet.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Geen verbinding. Probeer het zo meteen opnieuw.';
  return m;
}
