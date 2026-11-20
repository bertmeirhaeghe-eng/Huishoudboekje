// Gedeelde gegevens via Supabase. De beveiliging zit in de database-regels (supabase/schema.sql).
import { createClient } from '@supabase/supabase-js';
import { BANK_FUNCTION, CHORES_FUNCTION, PANTRY_FUNCTION } from './config.js';

export function createSupabaseStore(url, anonKey) {
  const sb = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Komt de bank terug naar de app (?code=…&state=…, of ?error=…&state=…), dan is dat geen aanmelding.
      detectSessionInUrl: (u, p) => !u.searchParams.get('state') && Boolean(p.access_token || p.error || p.error_description || p.error_code),
    },
  });

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
      // Supabase geeft per keer hoogstens 1000 rijen terug: daarom in stukken ophalen.
      const out = [];
      for (let i = 0; ; i += 1000) {
        const part = must(await sb.from('entries').select('*').eq('household_id', hid).gte('date', from).lte('date', to)
          .order('date', { ascending: false }).order('id').range(i, i + 999));
        out.push(...part);
        if (part.length < 1000) return out;
      }
    },
    async addEntry(entry) {
      return must(await sb.from('entries').insert(entry).select().single());
    },
    async addEntries(list) {
      const out = [];
      for (let i = 0; i < list.length; i += 200) out.push(...must(await sb.from('entries').insert(list.slice(i, i + 200)).select('id')));
      return out.length;
    },
    async updateEntry(id, patch) {
      return must(await sb.from('entries').update(patch).eq('id', id).select().single());
    },
    async deleteEntry(id) {
      must(await sb.from('entries').delete().eq('id', id));
    },
    async deleteEntries(ids) {
      for (let i = 0; i < ids.length; i += 200) must(await sb.from('entries').delete().in('id', ids.slice(i, i + 200)));
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
    // De echte rekeningstand per boekje. Bestaat de tabel nog niet (schema.sql nog niet opnieuw uitgevoerd),
    // dan bewaart de app de stand voorlopig op dit toestel.
    async listBalances(hid) {
      const { data, error } = await sb.from('balances').select('*').eq('household_id', hid);
      if (error) { if (missingTable(error)) return localBalances(hid); throw new Error(error.message); }
      return data;
    },
    async setBalance(hid, book, asOf, cents) {
      const row = { household_id: hid, book, as_of: asOf, amount_cents: cents, updated_at: new Date().toISOString() };
      const { error } = await sb.from('balances').upsert(row);
      if (error) { if (missingTable(error)) return saveLocalBalance(row); throw new Error(error.message); }
      return 'db';
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
    async setMenu(hid, date, meal, recipeId = null, slot = 'avond') {
      const t = sb.from('menu_days');
      let res = meal
        ? await t.upsert({ household_id: hid, date, slot, meal, recipe_id: recipeId }, { onConflict: 'household_id,date,slot' })
        : await t.delete().eq('household_id', hid).eq('date', date).eq('slot', slot);
      // Database nog zonder middag/avond? Dan werkt het avondeten zoals vroeger.
      if (res.error && /slot|no unique or exclusion constraint/i.test(res.error.message)) {
        if (slot !== 'avond') throw new Error('Voor middag en avond moet je eerst de nieuwe schema.sql uitvoeren in Supabase.');
        res = meal
          ? await sb.from('menu_days').upsert({ household_id: hid, date, meal, recipe_id: recipeId })
          : await sb.from('menu_days').delete().eq('household_id', hid).eq('date', date);
      }
      must(res);
    },

    // Google Agenda via het geheime iCal-adres. Het adres blijft in de database;
    // de app krijgt enkel de inhoud van de agenda terug.
    async setCalendarUrl(url) { must(await sb.rpc('set_calendar_url', { p_url: url })); },
    async hasCalendar() { return Boolean(must(await sb.rpc('has_calendar'))); },
    async calendarIcs() { return must(await sb.rpc('calendar_ics')); },

    // Gedeelde Google Foto's-albums voor de ruststand van het weekbord.
    async setPhotoAlbums(urls) { must(await sb.rpc('set_photo_albums', { p_urls: urls })); },
    async photoAlbumCount() { return Number(must(await sb.rpc('photo_album_count'))) || 0; },
    async albumPhotos() { return must(await sb.rpc('album_photos')) || []; },

    // Foto van de voorraadkast laten bekijken door de AI (Supabase-functie "voorraad-foto").
    // Is die functie (nog) niet ingesteld, dan geven we 'geen-ai' terug zodat de app etiketten leest.
    async scanPantryPhoto(payload) {
      const { data, error } = await sb.functions.invoke(PANTRY_FUNCTION, { body: payload });
      if (!error) return data;
      const res = error.context;
      let msg = '';
      let reden = '';
      try { const b = await res.json(); msg = b.error || ''; reden = b.reden || ''; } catch { /* geen JSON */ }
      if (!res || res.status === 404 || res.status === 503 || msg === 'niet-ingesteld' || error.name === 'FunctionsFetchError' || error.name === 'FunctionsRelayError') {
        if (!reden) {
          if (res?.status === 404) reden = 'De functie voorraad-foto is niet gevonden in Supabase.';
          else if (error.name !== 'FunctionsHttpError') reden = 'De functie voorraad-foto is niet bereikbaar.';
        }
        const e = new Error('geen-ai'); e.code = 'geen-ai'; e.reden = reden; throw e;
      }
      throw new Error(msg || 'De foto kon niet bekeken worden.');
    },

    // Bank rechtstreeks (Supabase-functie "bank-koppeling", via Enable Banking). Alleen lezen.
    // action: status | start | finish | fetch | saved | unlink. Een fout heeft .code (bv. 'verlopen', 'niet-ingesteld').
    async bank(action, body = {}) {
      const { data, error } = await sb.functions.invoke(BANK_FUNCTION, { body: { action, ...body } });
      if (!error) return data;
      const res = error.context;
      let code = '';
      let reden = '';
      try { const b = await res.json(); code = b.error || ''; reden = b.reden || ''; } catch { /* geen JSON */ }
      if (!code) {
        if (res?.status === 404) { code = 'niet-ingesteld'; reden = 'De functie bank-koppeling is nog niet geplaatst in Supabase.'; }
        else if (error.name !== 'FunctionsHttpError') { code = 'niet-ingesteld'; reden = 'De functie bank-koppeling is niet bereikbaar.'; }
      }
      const e = new Error(reden || 'Het ophalen bij de bank lukte niet.');
      e.code = code || 'fout';
      throw e;
    },

    // Klusjes: zonder de grote foto (die halen we pas op als je een klusje opent).
    async listChores(hid) {
      return must(await sb.from('chores')
        .select('id, household_id, title, note, thumb, planned_date, planned_time, done, done_at, gcal_event_id, gcal_dirty, created_at')
        .eq('household_id', hid).limit(2000));
    },
    async chorePhoto(id) {
      return must(await sb.from('chores').select('photo').eq('id', id).maybeSingle())?.photo || null;
    },
    // Klusjes in Google Agenda (Supabase-functie "klusjes-agenda").
    // action: status | start | finish | calendars | set-calendar | sync | remove | unlink.
    // Een fout heeft .code (bv. 'niet-ingesteld', 'verlopen', 'niet-gekoppeld').
    async choresAgenda(action, body = {}) {
      const { data, error } = await sb.functions.invoke(CHORES_FUNCTION, { body: { action, ...body } });
      if (!error) return data;
      const res = error.context;
      let code = '';
      let reden = '';
      try { const b = await res.json(); code = b.error || ''; reden = b.reden || ''; } catch { /* geen JSON */ }
      if (!code) {
        if (res?.status === 404) { code = 'niet-ingesteld'; reden = 'De functie klusjes-agenda is nog niet geplaatst in Supabase.'; }
        else if (error.name !== 'FunctionsHttpError') { code = 'niet-ingesteld'; reden = 'De functie klusjes-agenda is niet bereikbaar.'; }
      }
      const e = new Error(reden || 'Google Agenda bijwerken lukte niet.');
      e.code = code || 'fout';
      throw e;
    },

    // Live: als een gezinslid iets toevoegt, ververst het scherm vanzelf.
    subscribe(hid, fn, tables = ['entries', 'budgets']) {
      // Elke keer een eigen kanaal: Supabase geeft bij dezelfde naam het bestaande (al gestarte) kanaal terug,
      // en daar nog een luisteraar aan toevoegen laat de app crashen.
      subs += 1;
      let ch = sb.channel('boekje-' + tables.join('-') + '-' + hid + '-' + subs);
      for (const table of tables) ch = ch.on('postgres_changes', { event: '*', schema: 'public', table, filter: `household_id=eq.${hid}` }, fn);
      ch.subscribe();
      return () => sb.removeChannel(ch);
    },
  };
}

let subs = 0;

const missingTable = (e) => e.code === '42P01' || e.code === 'PGRST205' || /balances/.test(e.message || '') && /(exist|schema cache|find)/i.test(e.message || '');
const BAL_KEY = 'boekje-rekeningstand';
function localBalances(hid) {
  try { return (JSON.parse(localStorage.getItem(BAL_KEY) || '[]') || []).filter((b) => b.household_id === hid); } catch { return []; }
}
function saveLocalBalance(row) {
  try {
    const all = (JSON.parse(localStorage.getItem(BAL_KEY) || '[]') || []).filter((b) => !(b.household_id === row.household_id && b.book === row.book));
    localStorage.setItem(BAL_KEY, JSON.stringify([...all, row]));
  } catch {}
  return 'toestel';
}

const HOME_TABLES = ['shopping_items', 'pantry_items', 'recipes', 'menu_days', 'chores'];
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
  if (/(album_photos|photo_album_count|set_photo_albums)/i.test(m) && /does not exist|Could not find the function/i.test(m)) return 'De database mist nog de foto-functies. Voer schema.sql opnieuw uit in Supabase.';
  if (/photo albums: only the owner/i.test(m)) return 'Alleen de eigenaar van het gezin kan de foto-albums instellen.';
  if (/photo albums: invalid link/i.test(m)) return 'Dat is geen link naar een gedeeld Google Foto\'s-album. Die begint met https://photos.app.goo.gl/ of https://photos.google.com/share/.';
  if (/function .*(calendar_ics|has_calendar|set_calendar_url).* does not exist|Could not find the function/i.test(m)) return 'De database mist nog de agenda-functies. Voer schema.sql opnieuw uit in Supabase.';
  if (/invite code/i.test(m)) return 'Die uitnodigingscode bestaat niet.';
  if (/chores/i.test(m) && /does not exist|Could not find the table|schema cache/i.test(m)) return 'De database mist nog de tabel voor klusjes. Voer schema.sql opnieuw uit in Supabase.';
  if (/chores_photo_check|chores_thumb_check/i.test(m)) return 'Deze foto is te groot. Probeer een andere.';
  if (/relation .* does not exist|Could not find the table/i.test(m)) return 'De database mist nog de nieuwe tabellen. Voer schema.sql opnieuw uit in Supabase.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Geen verbinding. Probeer het zo meteen opnieuw.';
  return m;
}
