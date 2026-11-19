// Supabase Edge Function "bank-koppeling": haalt verrichtingen rechtstreeks bij Crelan op via
// Enable Banking (open banking, PSD2). Alleen lezen: deze functie kan nooit geld overschrijven.
//
// Geheimen in Supabase (Edge Functions → Secrets), nooit in de app zelf:
//   ENABLE_BANKING_APP_ID       het Application ID uit het Enable Banking Control Panel
//   ENABLE_BANKING_PRIVATE_KEY  de volledige inhoud van het .pem-bestand dat je kreeg
// Optioneel:
//   BANK_REDIRECT_URL  adres van de app (standaard https://bertmeirhaeghe-eng.github.io/Huishoudboekje/)
//   BANK_NAME          naam van de bank bij Enable Banking (standaard Crelan)
//   BANK_COUNTRY       land (standaard BE)
//
// Alleen de eigenaar van het gezin kan de bank koppelen en verrichtingen ophalen.
// De sessie van de bank wordt bewaard in de tabel bank_links, die de app zelf niet kan lezen.
import { createClient } from 'npm:@supabase/supabase-js@2';

const API = 'https://api.enablebanking.com';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const env = (k: string, d = '') => Deno.env.get(k) || d;
const REDIRECT = () => env('BANK_REDIRECT_URL', 'https://bertmeirhaeghe-eng.github.io/Huishoudboekje/');
const MAX_DAYS = 180; // Europese regel: na 180 dagen moet je de toestemming opnieuw geven.
const FIRST_DAYS = 90; // De eerste keer halen we 3 maanden op.
const OVERLAP_DAYS = 10; // Daarna altijd wat overlap: de dubbel-controle in de app haalt wat er al staat eruit.

class Fout extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) { super(message); this.code = code; this.status = status; }
}

// ───────────── Aanmelden bij Enable Banking (JWT, RS256) ─────────────

const b64url = (b: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof b === 'string' ? new TextEncoder().encode(b) : new Uint8Array(b);
  let s = '';
  for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

// Een "RSA PRIVATE KEY" (PKCS#1) inpakken als PKCS#8, want alleen dat kan WebCrypto lezen.
function pkcs1to8(der: Uint8Array): Uint8Array {
  const len = (n: number) => (n < 128 ? [n] : n < 256 ? [0x81, n] : n < 65536 ? [0x82, n >> 8, n & 255] : [0x83, n >> 16, (n >> 8) & 255, n & 255]);
  const algo = [0x02, 0x01, 0x00, 0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const octet = [0x04, ...len(der.length)];
  const body = algo.length + octet.length + der.length;
  return new Uint8Array([0x30, ...len(body), ...algo, ...octet, ...der]);
}

let keyCache: CryptoKey | null = null;
async function privateKey(): Promise<CryptoKey> {
  if (keyCache) return keyCache;
  const pem = env('ENABLE_BANKING_PRIVATE_KEY').replace(/\\n/g, '\n');
  if (!pem.includes('PRIVATE KEY')) throw new Fout('niet-ingesteld', 'Het geheim ENABLE_BANKING_PRIVATE_KEY staat nog niet (goed) in Supabase.', 503);
  const pkcs1 = /BEGIN RSA PRIVATE KEY/.test(pem);
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  let der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  if (pkcs1) der = pkcs1to8(der);
  try {
    keyCache = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  } catch {
    throw new Fout('niet-ingesteld', 'De sleutel in ENABLE_BANKING_PRIVATE_KEY kan niet gelezen worden. Plak de volledige inhoud van het .pem-bestand.', 503);
  }
  return keyCache;
}

async function token(): Promise<string> {
  const appId = env('ENABLE_BANKING_APP_ID').trim();
  if (!appId) throw new Fout('niet-ingesteld', 'Het geheim ENABLE_BANKING_APP_ID staat nog niet in Supabase.', 503);
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ typ: 'JWT', alg: 'RS256', kid: appId }));
  const body = b64url(JSON.stringify({ iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat: now, exp: now + 3600 }));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', await privateKey(), new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(sig)}`;
}

// Wie de app nu gebruikt: zo weet de bank dat er iemand aanwezig is (dan gelden ruimere limieten).
let psu: Record<string, string> = {};

async function eb(method: string, path: string, body?: unknown) {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json', ...psu },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try { data = text ? JSON.parse(text) : {}; } catch { /* geen JSON */ }
  if (!res.ok) {
    console.error('enable banking', method, path, res.status, text.slice(0, 500));
    const msg = String(data.message || data.error || data.detail || '');
    if (res.status === 401 && /application|jwt|token|kid|signature/i.test(msg + text)) {
      throw new Fout('niet-ingesteld', 'Enable Banking herkent de app niet. Kijk of ENABLE_BANKING_APP_ID en de sleutel kloppen.', 503);
    }
    if (/expired|revoked|invalid session|session.*(closed|not found)|EXPIRED|REVOKED|CLOSED/i.test(msg + text) || (res.status === 401 && path.startsWith('/accounts'))) {
      throw new Fout('verlopen', 'De toestemming bij de bank is verlopen. Koppel Crelan opnieuw.', 409);
    }
    if (res.status === 429) throw new Fout('te-vaak', 'De bank laat maar een paar keer per dag ophalen toe. Probeer het later opnieuw.', 429);
    throw new Fout('bank', `De bank gaf een fout (${res.status}). Probeer het later opnieuw.`, 502);
  }
  return data;
}

// ───────────── Hulpjes ─────────────

const day = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return day(d); };

type Account = { uid: string; iban: string; name: string; currency: string };
const publicLink = (l: Record<string, unknown> | null) => (l && l.session_id
  ? { linked: true, bank: l.bank, valid_until: l.valid_until, accounts: ((l.accounts as Account[]) || []).map((a) => ({ uid: a.uid, iban: a.iban, name: a.name })) }
  : { linked: false });

// ───────────── De functie ─────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Alleen POST.' }, 405);

  try {
    // Wie vraagt dit? Alleen de eigenaar van een gezin.
    const auth = req.headers.get('Authorization') || '';
    const url = env('SUPABASE_URL');
    const user = createClient(url, env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: auth } } });
    const { data: who } = await user.auth.getUser(auth.replace(/^Bearer\s+/i, ''));
    if (!who?.user) throw new Fout('aanmelden', 'Meld je eerst aan.', 401);
    const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
    const { data: mem } = await admin.from('household_members').select('household_id').eq('user_id', who.user.id).eq('role', 'eigenaar').limit(1);
    const hid = mem?.[0]?.household_id;
    if (!hid) throw new Fout('eigenaar', 'Alleen de eigenaar van het gezin kan de bank koppelen.', 403);

    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
    psu = {};
    if (ip) psu['Psu-Ip-Address'] = ip;
    if (req.headers.get('user-agent')) psu['Psu-User-Agent'] = req.headers.get('user-agent')!.slice(0, 300);

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* leeg */ }
    const action = String(body.action || 'status');

    const { data: link, error: linkErr } = await admin.from('bank_links').select('*').eq('household_id', hid).maybeSingle();
    if (linkErr) {
      if (/bank_links/.test(linkErr.message)) throw new Fout('database', 'De database mist nog de tabel bank_links. Voer schema.sql opnieuw uit in Supabase.', 503);
      throw linkErr;
    }
    const save = async (patch: Record<string, unknown>) => {
      const { error } = await admin.from('bank_links').upsert({ household_id: hid, ...patch, updated_at: new Date().toISOString() });
      if (error) throw error;
    };

    if (action === 'status') {
      const ready = Boolean(env('ENABLE_BANKING_APP_ID') && env('ENABLE_BANKING_PRIVATE_KEY'));
      return json({ ready, ...publicLink(link) });
    }

    if (action === 'start') {
      // Hoe lang mag de toestemming bij deze bank? Hoogstens 180 dagen.
      const bankName = env('BANK_NAME', 'Crelan');
      const country = env('BANK_COUNTRY', 'BE');
      const list = await eb('GET', `/aspsps?country=${encodeURIComponent(country)}&psu_type=personal`);
      const aspsps = (list.aspsps as Array<Record<string, unknown>>) || [];
      const bank = aspsps.find((a) => String(a.name).toLowerCase() === bankName.toLowerCase())
        || aspsps.find((a) => String(a.name).toLowerCase().includes(bankName.toLowerCase()));
      if (!bank) throw new Fout('bank', `${bankName} staat (nog) niet in de lijst van Enable Banking.`, 404);
      const maxSec = Number(bank.maximum_consent_validity) || MAX_DAYS * 86400;
      const validUntil = new Date(Date.now() + Math.min(maxSec, MAX_DAYS * 86400) * 1000 - 60_000).toISOString();
      const state = crypto.randomUUID();
      const res = await eb('POST', '/auth', {
        access: { valid_until: validUntil },
        aspsp: { name: bank.name, country: bank.country || country },
        state,
        redirect_url: REDIRECT(),
        psu_type: 'personal',
      });
      await save({ pending_state: state, pending_at: new Date().toISOString() });
      return json({ url: res.url });
    }

    if (action === 'finish') {
      const code = String(body.code || '');
      const state = String(body.state || '');
      if (!code) throw new Fout('bank', 'De bank gaf geen toestemming terug.', 400);
      if (!link?.pending_state || link.pending_state !== state) throw new Fout('bank', 'Deze koppeling hoort niet bij jouw aanvraag. Begin opnieuw met Crelan koppelen.', 400);
      const s = await eb('POST', '/sessions', { code });
      const accounts: Account[] = ((s.accounts as Array<Record<string, any>>) || []).map((a) => ({
        uid: String(a.uid),
        iban: String(a.account_id?.iban || ''),
        name: String(a.name || a.product || a.details || ''),
        currency: String(a.currency || 'EUR'),
      }));
      if (!accounts.length) throw new Fout('bank', 'De bank gaf geen rekeningen door. Kijk of je de rekening ook gekoppeld hebt in het Enable Banking Control Panel.', 400);
      // Een oude sessie mag weg.
      if (link?.session_id && link.session_id !== s.session_id) { try { await eb('DELETE', `/sessions/${link.session_id}`); } catch { /* niet erg */ } }
      const access = (s.access as Record<string, unknown>) || {};
      await save({
        session_id: s.session_id,
        bank: (s.aspsp as Record<string, unknown>)?.name || env('BANK_NAME', 'Crelan'),
        accounts,
        valid_until: access.valid_until || null,
        pending_state: null,
        pending_at: null,
        linked_by: who.user.id,
      });
      const { data: fresh } = await admin.from('bank_links').select('*').eq('household_id', hid).maybeSingle();
      return json(publicLink(fresh));
    }

    if (action === 'fetch') {
      if (!link?.session_id) throw new Fout('geen-koppeling', 'Crelan is nog niet gekoppeld.', 409);
      if (link.valid_until && Date.parse(link.valid_until) < Date.now()) throw new Fout('verlopen', 'De toestemming bij de bank is verlopen. Koppel Crelan opnieuw.', 409);
      const all = (link.accounts as Account[]) || [];
      const pick = all.filter((a) => !body.account || a.uid === body.account);
      if (!pick.length) throw new Fout('bank', 'Die rekening is niet gekoppeld.', 400);
      const today = day(new Date());
      // Per rekening onthouden tot wanneer we al importeerden (op IBAN, dat blijft hetzelfde bij opnieuw koppelen).
      const fetched = (link.fetched as Record<string, string>) || {};
      const out = [];
      for (const a of pick) {
        const k = a.iban || a.uid;
        const from = fetched[k] ? addDays(fetched[k], -OVERLAP_DAYS) : addDays(today, -FIRST_DAYS);
        const transactions: unknown[] = [];
        let key = '';
        for (let page = 0; page < 30; page++) {
          const q = new URLSearchParams({ date_from: from });
          if (key) q.set('continuation_key', key);
          const r = await eb('GET', `/accounts/${encodeURIComponent(a.uid)}/transactions?${q}`);
          // Alleen wat de app nodig heeft, de rest blijft bij de bank.
          for (const t of (r.transactions as Array<Record<string, any>>) || []) {
            transactions.push({
              entry_reference: t.entry_reference || null,
              status: t.status || null,
              transaction_amount: t.transaction_amount || null,
              credit_debit_indicator: t.credit_debit_indicator || null,
              booking_date: t.booking_date || null,
              value_date: t.value_date || null,
              transaction_date: t.transaction_date || null,
              creditor: t.creditor?.name ? { name: t.creditor.name } : null,
              debtor: t.debtor?.name ? { name: t.debtor.name } : null,
              remittance_information: t.remittance_information || [],
              bank_transaction_code: t.bank_transaction_code?.description ? { description: t.bank_transaction_code.description } : null,
              balance_after_transaction: t.balance_after_transaction || null,
              note: t.note || null,
            });
          }
          key = String(r.continuation_key || '');
          if (!key) break;
        }
        let balances: unknown[] = [];
        try { balances = ((await eb('GET', `/accounts/${encodeURIComponent(a.uid)}/balances`)).balances as unknown[]) || []; } catch (e) {
          if (e instanceof Fout && e.code === 'verlopen') throw e; // zonder saldo gaat het ook
        }
        out.push({ uid: a.uid, iban: a.iban, name: a.name, from, transactions, balances });
      }
      return json({ accounts: out, valid_until: link.valid_until });
    }

    // Na het importeren: onthouden tot waar we zijn, zodat we de volgende keer niet alles opnieuw ophalen.
    if (action === 'saved') {
      if (!link?.session_id) return json({ ok: true });
      const fetched: Record<string, string> = { ...((link.fetched as Record<string, string>) || {}) };
      const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date)) ? String(body.date) : day(new Date());
      for (const a of (link.accounts as Account[]) || []) if (!body.account || a.uid === body.account) fetched[a.iban || a.uid] = date;
      await save({ fetched });
      return json({ ok: true });
    }

    if (action === 'unlink') {
      if (link?.session_id) { try { await eb('DELETE', `/sessions/${link.session_id}`); } catch { /* bij de bank al weg */ } }
      await admin.from('bank_links').delete().eq('household_id', hid);
      return json({ linked: false });
    }

    throw new Fout('bank', 'Onbekende vraag.', 400);
  } catch (e) {
    if (e instanceof Fout) return json({ error: e.code, reden: e.message }, e.status);
    console.error('bank-koppeling:', e);
    return json({ error: 'fout', reden: 'Er ging iets mis bij het ophalen bij de bank.' }, 500);
  }
});
