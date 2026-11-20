// Supabase Edge Function "klusjes-agenda": zet klusjes met een datum in de gekoppelde Google Agenda,
// en past ze daar aan als de datum (of de naam) verandert. Wordt de datum gewist of het klusje
// verwijderd, dan verdwijnt het ook uit de agenda.
//
// Geheimen in Supabase (Edge Functions → Secrets), nooit in de app zelf:
//   GOOGLE_CLIENT_ID      de Client ID van de OAuth-client (Google Cloud, type Web application)
//   GOOGLE_CLIENT_SECRET  het Client secret van diezelfde client
// Optioneel:
//   GOOGLE_REDIRECT_URL   adres van de app (standaard https://bertmeirhaeghe-eng.github.io/Huishoudboekje/)
//
// Alleen de eigenaar van het gezin kan Google koppelen of de agenda kiezen. Iedereen van het gezin
// kan klusjes inplannen: de functie zet ze dan in de agenda die de eigenaar koppelde.
// De toestemming van Google wordt bewaard in de tabel google_links, die de app zelf niet kan lezen.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const env = (k: string, d = '') => Deno.env.get(k) || d;
const REDIRECT = () => env('GOOGLE_REDIRECT_URL', 'https://bertmeirhaeghe-eng.github.io/Huishoudboekje/');
const SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly';
const CAL = 'https://www.googleapis.com/calendar/v3';
const TZ = 'Europe/Brussels';

class Fout extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) { super(message); this.code = code; this.status = status; }
}

const ready = () => Boolean(env('GOOGLE_CLIENT_ID').trim() && env('GOOGLE_CLIENT_SECRET').trim());
function mustBeReady() {
  if (!env('GOOGLE_CLIENT_ID').trim()) throw new Fout('niet-ingesteld', 'Het geheim GOOGLE_CLIENT_ID staat nog niet in Supabase.', 503);
  if (!env('GOOGLE_CLIENT_SECRET').trim()) throw new Fout('niet-ingesteld', 'Het geheim GOOGLE_CLIENT_SECRET staat nog niet in Supabase.', 503);
}

// ───────────── Google: aanmelden en toegangssleutel ─────────────

async function tokenRequest(params: Record<string, string>) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env('GOOGLE_CLIENT_ID').trim(), client_secret: env('GOOGLE_CLIENT_SECRET').trim(), ...params }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('google token', res.status, JSON.stringify(data).slice(0, 300));
    if (data.error === 'invalid_grant') throw new Fout('verlopen', 'De toestemming van Google is verlopen of ingetrokken. Koppel Google Agenda opnieuw.', 409);
    if (data.error === 'invalid_client' || data.error === 'unauthorized_client') throw new Fout('niet-ingesteld', 'Google herkent de app niet. Kijk of GOOGLE_CLIENT_ID en GOOGLE_CLIENT_SECRET kloppen.', 503);
    if (data.error === 'redirect_uri_mismatch') throw new Fout('niet-ingesteld', 'Het adres van de app staat niet bij "Authorized redirect URIs" in Google Cloud.', 503);
    throw new Fout('google', 'Google gaf een fout bij het aanmelden. Probeer het later opnieuw.', 502);
  }
  return data as Record<string, unknown>;
}

let access: { token: string; until: number; refresh: string } | null = null;
async function accessToken(refresh: string) {
  if (access && access.refresh === refresh && access.until > Date.now() + 60_000) return access.token;
  const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: refresh });
  access = { token: String(t.access_token), until: Date.now() + Number(t.expires_in || 3600) * 1000, refresh };
  return access.token;
}

async function gcal(token: string, method: string, path: string, body?: unknown) {
  const res = await fetch(CAL + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return { status: 204, data: null };
  const data = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    console.error('google calendar', method, path, res.status, JSON.stringify(data).slice(0, 300));
    if (res.status === 401) throw new Fout('verlopen', 'De toestemming van Google is verlopen. Koppel Google Agenda opnieuw.', 409);
    if (res.status === 403 && /accessNotConfigured|has not been used|disabled/i.test(JSON.stringify(data))) {
      throw new Fout('niet-ingesteld', 'De Google Calendar API staat nog niet aan in Google Cloud.', 503);
    }
    if (res.status === 403) throw new Fout('google', 'Google laat niet toe om in deze agenda te schrijven. Kies een andere agenda.', 403);
    throw new Fout('google', `Google Agenda gaf een fout (${res.status}). Probeer het later opnieuw.`, 502);
  }
  return { status: res.status, data: data as Record<string, any> };
}

// ───────────── Een klusje als afspraak ─────────────

const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
function plusHour(time: string) {
  const [h, m] = time.split(':').map(Number);
  const t = h * 60 + m + 60;
  return { time: `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`, nextDay: t >= 1440 };
}

type Chore = { id: string; household_id: string; title: string; note: string | null; planned_date: string | null; planned_time: string | null; done: boolean; gcal_event_id: string | null; gcal_calendar_id: string | null };

function eventFor(c: Chore) {
  const summary = `${c.done ? '✓ ' : ''}Klusje: ${c.title}`;
  const description = [c.note, 'Uit de klusjeslijst van het huishoudboekje.'].filter(Boolean).join('\n\n');
  const base = { summary, description, status: 'confirmed', extendedProperties: { private: { klusje: c.id } } };
  if (!c.planned_time) return { ...base, start: { date: c.planned_date }, end: { date: addDays(c.planned_date!, 1) } };
  const end = plusHour(c.planned_time);
  return {
    ...base,
    start: { dateTime: `${c.planned_date}T${c.planned_time}:00`, timeZone: TZ },
    end: { dateTime: `${end.nextDay ? addDays(c.planned_date!, 1) : c.planned_date}T${end.time}:00`, timeZone: TZ },
  };
}

const evPath = (cal: string, id?: string) => `/calendars/${encodeURIComponent(cal)}/events${id ? '/' + encodeURIComponent(id) : ''}`;

// ───────────── De functie ─────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Alleen POST.' }, 405);

  try {
    const auth = req.headers.get('Authorization') || '';
    const url = env('SUPABASE_URL');
    const user = createClient(url, env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: auth } } });
    const { data: who } = await user.auth.getUser(auth.replace(/^Bearer\s+/i, ''));
    if (!who?.user) throw new Fout('aanmelden', 'Meld je eerst aan.', 401);
    const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
    const { data: mem } = await admin.from('household_members').select('household_id, role').eq('user_id', who.user.id).limit(1);
    const hid = mem?.[0]?.household_id;
    if (!hid) throw new Fout('aanmelden', 'Je hoort nog bij geen gezin.', 403);
    const isOwner = mem![0].role === 'eigenaar';
    const ownerOnly = () => { if (!isOwner) throw new Fout('eigenaar', 'Alleen de eigenaar van het gezin kan Google Agenda koppelen.', 403); };

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* leeg */ }
    const action = String(body.action || 'status');

    const { data: link, error: linkErr } = await admin.from('google_links').select('*').eq('household_id', hid).maybeSingle();
    if (linkErr) {
      if (/google_links/.test(linkErr.message)) throw new Fout('database', 'De database mist nog de tabel google_links. Voer schema.sql opnieuw uit in Supabase.', 503);
      throw linkErr;
    }
    const save = async (patch: Record<string, unknown>) => {
      const { error } = await admin.from('google_links').upsert({ household_id: hid, ...patch, updated_at: new Date().toISOString() });
      if (error) throw error;
    };
    const status = (l = link) => ({ ready: ready(), linked: Boolean(l?.refresh_token), calendar: l?.refresh_token ? (l.calendar_name || 'Hoofdagenda') : null, owner: isOwner });

    if (action === 'status') return json(status());

    if (action === 'start') {
      ownerOnly(); mustBeReady();
      const state = 'g.' + crypto.randomUUID();
      await save({ pending_state: state, pending_at: new Date().toISOString() });
      const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      u.searchParams.set('client_id', env('GOOGLE_CLIENT_ID').trim());
      u.searchParams.set('redirect_uri', REDIRECT());
      u.searchParams.set('response_type', 'code');
      u.searchParams.set('scope', SCOPES);
      u.searchParams.set('access_type', 'offline');
      u.searchParams.set('prompt', 'consent');
      u.searchParams.set('include_granted_scopes', 'true');
      u.searchParams.set('state', state);
      return json({ url: u.toString() });
    }

    if (action === 'finish') {
      ownerOnly(); mustBeReady();
      const code = String(body.code || '');
      const state = String(body.state || '');
      if (!code) throw new Fout('google', 'Google gaf geen toestemming terug.', 400);
      if (!link?.pending_state || link.pending_state !== state) throw new Fout('google', 'Deze koppeling hoort niet bij jouw aanvraag. Begin opnieuw met Google Agenda koppelen.', 400);
      const t = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT() });
      if (!String(t.scope || '').includes('calendar.events')) throw new Fout('google', 'Je gaf geen toestemming om afspraken te maken. Koppel opnieuw en vink het vakje voor Google Agenda aan.', 400);
      const refresh = String(t.refresh_token || link.refresh_token || '');
      if (!refresh) throw new Fout('google', 'Google gaf geen blijvende toestemming. Probeer opnieuw te koppelen.', 400);
      access = { token: String(t.access_token), until: Date.now() + Number(t.expires_in || 3600) * 1000, refresh };
      // Nieuwe koppeling: begin met de hoofdagenda, tenzij er al een agenda gekozen was.
      const patch = { refresh_token: refresh, pending_state: null, pending_at: null, linked_by: who.user.id, calendar_id: link.calendar_id || 'primary', calendar_name: link.calendar_name || 'Hoofdagenda' };
      await save(patch);
      // Wat al een datum had, mag nu meteen in de agenda.
      await admin.from('chores').update({ gcal_dirty: true }).eq('household_id', hid).not('planned_date', 'is', null).is('gcal_event_id', null);
      return json(status({ ...link, ...patch }));
    }

    if (action === 'unlink') {
      ownerOnly();
      if (link?.refresh_token) { try { await fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(link.refresh_token), { method: 'POST' }); } catch { /* niet erg */ } }
      await save({ refresh_token: null });
      return json(status({ ...link, refresh_token: null }));
    }

    // Vanaf hier is een koppeling nodig.
    if (!link?.refresh_token) {
      if (action === 'sync') return json({ ...status(), synced: 0 });
      if (action !== 'remove') throw new Fout('niet-gekoppeld', 'Google Agenda is nog niet gekoppeld.', 409);
    }
    if (link?.refresh_token) mustBeReady();
    const token = link?.refresh_token ? await accessToken(link.refresh_token) : '';

    if (action === 'calendars') {
      ownerOnly();
      const { data } = await gcal(token, 'GET', '/users/me/calendarList?minAccessRole=writer');
      const list = (data?.items || []).map((c: Record<string, any>) => ({ id: c.primary ? 'primary' : c.id, name: c.summaryOverride || c.summary, primary: Boolean(c.primary), color: c.backgroundColor || null }));
      return json({ calendars: list, current: link!.calendar_id });
    }

    if (action === 'set-calendar') {
      ownerOnly();
      const id = String(body.id || 'primary');
      const name = String(body.name || '').slice(0, 120) || 'Hoofdagenda';
      await save({ calendar_id: id, calendar_name: name });
      // Alles wat al ingepland is, verhuist mee naar de nieuwe agenda.
      await admin.from('chores').update({ gcal_dirty: true }).eq('household_id', hid).not('gcal_event_id', 'is', null);
      return json(status({ ...link, calendar_id: id, calendar_name: name }));
    }

    const removeEvent = async (c: Chore) => {
      if (!c.gcal_event_id || !token) return;
      await gcal(token, 'DELETE', evPath(c.gcal_calendar_id || link!.calendar_id, c.gcal_event_id));
    };

    if (action === 'remove') {
      // Klusje weg: eerst uit de agenda, dan uit de lijst.
      const id = String(body.id || '');
      const { data: c } = await admin.from('chores').select('*').eq('id', id).eq('household_id', hid).maybeSingle();
      if (c) {
        if (!body.keepEvent) await removeEvent(c as Chore);
        const { error } = await admin.from('chores').delete().eq('id', id).eq('household_id', hid);
        if (error) throw error;
      }
      return json({ ok: true });
    }

    if (action === 'sync') {
      // Alle klusjes die gewijzigd zijn sinds de laatste keer (of de gevraagde).
      const ids = Array.isArray(body.ids) ? (body.ids as unknown[]).map(String).slice(0, 100) : null;
      let q = admin.from('chores').select('id, household_id, title, note, planned_date, planned_time, done, gcal_event_id, gcal_calendar_id').eq('household_id', hid);
      q = ids && ids.length ? q.in('id', ids) : q.eq('gcal_dirty', true);
      const { data: rows, error } = await q.limit(100);
      if (error) {
        if (/chores/.test(error.message)) throw new Fout('database', 'De database mist nog de tabel chores. Voer schema.sql opnieuw uit in Supabase.', 503);
        throw error;
      }
      const cal = link!.calendar_id || 'primary';
      let synced = 0;
      const failed: string[] = [];
      for (const c of (rows || []) as Chore[]) {
        try {
          let patch: Record<string, unknown> = { gcal_dirty: false };
          if (!c.planned_date) {
            await removeEvent(c);
            patch = { ...patch, gcal_event_id: null, gcal_calendar_id: null };
          } else {
            const ev = eventFor(c);
            let made: Record<string, any> | null = null;
            if (c.gcal_event_id && (c.gcal_calendar_id || cal) === cal) {
              const r = await gcal(token, 'PUT', evPath(cal, c.gcal_event_id), ev);
              // In Google zelf verwijderd? Dan maken we het opnieuw.
              made = r.status === 404 || r.status === 410 || r.data?.status === 'cancelled' ? null : r.data;
              if (made === null) made = (await gcal(token, 'POST', evPath(cal), ev)).data;
            } else {
              if (c.gcal_event_id) await removeEvent(c); // andere agenda gekozen: oude afspraak weg
              // Staat het er toch al (bv. twee toestellen tegelijk)? Dan dat bijwerken in plaats van een dubbel.
              const found = await gcal(token, 'GET', `${evPath(cal)}?privateExtendedProperty=${encodeURIComponent('klusje=' + c.id)}&maxResults=5`);
              const same = (found.data?.items || []).find((x: Record<string, any>) => x.status !== 'cancelled');
              made = same
                ? (await gcal(token, 'PUT', evPath(cal, same.id), ev)).data
                : (await gcal(token, 'POST', evPath(cal), ev)).data;
            }
            if (!made?.id) throw new Fout('google', 'Google Agenda gaf geen afspraak terug.', 502);
            patch = { ...patch, gcal_event_id: made.id, gcal_calendar_id: cal };
          }
          await admin.from('chores').update(patch).eq('id', c.id).eq('household_id', hid);
          synced++;
        } catch (e) {
          if (e instanceof Fout && (e.code === 'verlopen' || e.code === 'niet-ingesteld')) throw e;
          console.error('sync klusje', c.id, e);
          failed.push(c.title);
        }
      }
      return json({ ...status(), synced, failed });
    }

    throw new Fout('onbekend', 'Onbekende vraag.', 400);
  } catch (e) {
    if (e instanceof Fout) return json({ error: e.code, reden: e.message }, e.status);
    console.error(e);
    return json({ error: 'fout', reden: 'Er ging iets mis met Google Agenda. Probeer het later opnieuw.' }, 500);
  }
});
