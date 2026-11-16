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
    async addEntries(list) {
      const out = [];
      for (let i = 0; i < list.length; i += 200) out.push(...must(await sb.from('entries').insert(list.slice(i, i + 200)).select('id')));
      return out.length;
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
    // Thuis (stap 4): boodschappen, voorraad, recepten, weekmenu.
    async listRows(table, hid) {
      check(table);
      return must(await sb.from(table).select('*').eq('household_id', hid).limit(2000));
    },
    async addRows(table, rows) {
      check(table);
      return must(await sb.from(table).insert(rows).select());
    },
    async updateRow(table, id, patch) {
      check(table);
      return must(await sb.from(table).update(patch).eq('id', id).select().single());
    },
    async deleteRows(table, ids) {
      check(table);
      if (ids.length) must(await sb.from(table).delete().in('id', ids));
    },
    async setMenu(hid, date, meal, recipeId = null) {
      if (meal) must(await sb.from('menu_days').upsert({ household_id: hid, date, meal, recipe_id: recipeId }));
      else must(await sb.from('menu_days').delete().eq('household_id', hid).eq('date', date));
    },

    // Google Agenda via het geheime iCal-adres. Het adres blijft in de database;
    // de app krijgt enkel de inhoud van de agenda terug.
    async setCalendarUrl(url) { must(await sb.rpc('set_calendar_url', { p_url: url })); },
    async hasCalendar() { return Boolean(must(await sb.rpc('has_calendar'))); },
    async calendarIcs() { return must(await sb.rpc('calendar_ics')); },

    // Live: als een gezinslid iets toevoegt, ververst het scherm vanzelf.
    subscribe(hid, fn, tables = ['entries', 'budgets']) {
      let ch = sb.channel('boekje-' + tables.join('-') + '-' + hid);
      for (const table of tables) ch = ch.on('postgres_changes', { event: '*', schema: 'public', table, filter: `household_id=eq.${hid}` }, fn);
      ch.subscribe();
      return () => sb.removeChannel(ch);
    },
  };
}

const HOME_TABLES = ['shopping_items', 'pantry_items', 'recipes', 'menu_days'];
function check(table) {
  if (!HOME_TABLES.includes(table)) throw new Error('Onbekende lijst: ' + table);
}

function translate(msg) {
  const m = String(msg || '');
  if (/Invalid login credentials/i.test(m)) return 'E-mail of wachtwoord klopt niet.';
  if (/Email not confirmed/i.test(m)) return 'Bevestig eerst je e-mailadres via de mail die je kreeg.';
  if (/already registered/i.test(m)) return 'Dit e-mailadres heeft al een account. Log gewoon in.';
  if (/Password should be at least/i.test(m)) return 'Kies een wachtwoord van minstens 6 tekens.';
  if (/household_secrets_ical_url_check/i.test(m)) return 'Dat is geen geheim iCal-adres van Google Agenda. Het begint met https://calendar.google.com/calendar/ical/ en eindigt op .ics.';
  if (/only the owner can set the calendar/i.test(m)) return 'Alleen de eigenaar van het gezin kan de agenda koppelen.';
  if (/calendar fetch failed/i.test(m)) return 'Google Agenda gaf geen antwoord. Klopt het geheime adres nog?';
  if (/function .*(calendar_ics|has_calendar|set_calendar_url).* does not exist|Could not find the function/i.test(m)) return 'De database mist nog de agenda-functies. Voer schema.sql opnieuw uit in Supabase.';
  if (/invite code/i.test(m)) return 'Die uitnodigingscode bestaat niet.';
  if (/relation .* does not exist|Could not find the table/i.test(m)) return 'De database mist nog de nieuwe tabellen. Voer schema.sql opnieuw uit in Supabase.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Geen verbinding. Probeer het zo meteen opnieuw.';
  return m;
}
