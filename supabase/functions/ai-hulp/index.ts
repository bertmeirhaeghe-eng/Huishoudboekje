// Supabase Edge Function "ai-hulp": Google Gemini helpt het huishoudboekje met twee dingen.
//   action "categorie": voor verrichtingen van de bank de best passende categorie kiezen.
//   action "inzichten": bij de cijfers van een maand of jaar een korte samenvatting en tips geven.
// Standaard met Google Gemini (geheim GEMINI_API_KEY, gratis versie). Staat er geen Gemini-sleutel,
// of lukt Gemini niet, en staat er wel ANTHROPIC_API_KEY, dan gebruikt ze Claude.
// De sleutels staan als geheim in Supabase, nooit in de app zelf.
// Alleen wie aangemeld is in het huishoudboekje mag deze functie gebruiken.
// Lukt het niet, dan gebruikt de app gewoon haar vaste regels en tips.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const clean = (s: unknown, max: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

class AiError extends Error {
  constructor(public status: number, message: string, public uitleg = '') { super(message); }
}

// Het eerste JSON-object uit een antwoord halen (ook als het tussen ```json ... ``` staat).
function parseJson(text: string) {
  const a = text.indexOf('{');
  const b = text.lastIndexOf('}');
  if (a < 0 || b <= a) throw new AiError(422, `Geen JSON in antwoord: ${text.slice(0, 200)}`, 'het antwoord was geen geldig formaat');
  return JSON.parse(text.slice(a, b + 1));
}

// Foutmelding van Google leesbaar maken.
async function googleError(res: Response) {
  const raw = await res.text();
  let msg = raw;
  try { msg = JSON.parse(raw)?.error?.message || raw; } catch { /* geen JSON */ }
  return String(msg).replace(/\s+/g, ' ').slice(0, 220);
}

type Task = { system: string; user: string; gemini: unknown; claude: unknown; tokens: number };

// Gemini: eerst het model uit het geheim GEMINI_MODEL (als dat er is), anders de "laatste Flash".
// Bestaat een model niet (meer) of weigert het de vraag, dan proberen we het volgende.
// Lukt het met het vaste antwoordschema niet, dan vragen we gewoon om JSON.
async function askGemini(key: string, t: Task) {
  const own = (Deno.env.get('GEMINI_MODEL') || '').trim();
  const models = [own, 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-flash-lite-latest', 'gemini-2.5-flash-lite'].filter((m, i, a) => m && a.indexOf(m) === i);
  let last: AiError | null = null;
  for (const model of models) {
    for (const withSchema of [true, false]) {
      // Ruim genoeg: de nieuwe Gemini-modellen "denken" eerst, en dat telt mee.
      const generationConfig: Record<string, unknown> = { temperature: 0.2, maxOutputTokens: t.tokens, responseMimeType: 'application/json' };
      if (withSchema) generationConfig.responseSchema = t.gemini;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: t.system }] },
          contents: [{ role: 'user', parts: [{ text: t.user }] }],
          generationConfig,
        }),
      });
      if (!res.ok) {
        const msg = await googleError(res);
        console.error(`ai-hulp: ${model}${withSchema ? '' : ' (zonder schema)'} gaf ${res.status}: ${msg}`);
        // Sleutel fout, quotum op of land niet toegelaten: geen zin om verder te proberen.
        if (res.status === 401 || res.status === 403 || res.status === 429 || /api key|location|region|country|billing|quota/i.test(msg)) {
          throw new AiError(res.status, `Gemini ${res.status}: ${msg}`, msg);
        }
        last = new AiError(res.status, `Gemini ${model} ${res.status}: ${msg}`, msg);
        if (res.status === 400 && withSchema) continue; // nog eens zonder schema
        break; // volgend model
      }
      const data = await res.json();
      const cand = data?.candidates?.[0];
      const text = (cand?.content?.parts || []).filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought).map((p: { text: string }) => p.text).join('');
      if (!text) {
        const why = data?.promptFeedback?.blockReason || cand?.finishReason || 'leeg';
        console.error(`ai-hulp: ${model} gaf geen tekst (${why})`);
        last = new AiError(422, `Gemini ${model}: geen tekst (${why})`, `Gemini gaf geen tekst (${why})`);
        break;
      }
      try {
        return { ...parseJson(text), bron: 'Gemini' };
      } catch (e) {
        console.error(`ai-hulp: ${model} antwoord niet leesbaar: ${text.slice(0, 300)}`);
        last = e instanceof AiError ? e : new AiError(422, String(e), 'het antwoord was geen geldig formaat');
      }
    }
  }
  throw last || new AiError(404, 'Geen Gemini-model gevonden.', 'geen Gemini-model gevonden');
}

async function askClaude(key: string, t: Task) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-5-5',
      max_tokens: Math.min(t.tokens, 8000),
      output_config: { effort: 'low', format: { type: 'json_schema', schema: t.claude } },
      system: t.system,
      messages: [{ role: 'user', content: t.user }],
    }),
  });
  if (!res.ok) throw new AiError(res.status, `Claude ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = (data?.content || []).find((b: { type: string }) => b.type === 'text')?.text;
  if (!text) throw new AiError(422, 'Claude gaf geen antwoord.');
  return { ...parseJson(text), bron: 'Claude' };
}

async function ask(t: Task) {
  const gemini = Deno.env.get('GEMINI_API_KEY');
  const claude = Deno.env.get('ANTHROPIC_API_KEY');
  let err: unknown = null;
  if (gemini) {
    try { return await askGemini(gemini, t); } catch (e) { err = e; }
  }
  if (claude) {
    try { return await askClaude(claude, t); } catch (e) { err = err || e; }
  }
  throw err;
}

// ───────────── Categorie kiezen ─────────────

type Cat = { id: string; name: string };
type Item = { id: number; type: 'in' | 'uit'; text: string; amount: number };

function categoryTask(book: string, cats: { in: Cat[]; uit: Cat[] }, items: Item[]): Task {
  const ids = [...new Set([...cats.uit, ...cats.in].map((c) => c.id))];
  const list = (cs: Cat[]) => cs.map((c) => `${c.id} (${c.name})`).join(', ');
  const zaak = book === 'zaak';
  const system = `Je helpt een Vlaams gezin hun huishoudboekje bij te houden. Je krijgt verrichtingen van hun Belgische bankrekening (${zaak ? 'de rekening van hun vennootschap: IT-consultancy, catering en BBQ-workshops' : 'de gezinsrekening'}).
Kies voor elke verrichting de best passende categorie.
- Uitgaven (type "uit") krijgen een van deze categorieën: ${list(cats.uit)}.
- Inkomsten (type "in") krijgen een van deze categorieën: ${list(cats.in)}.
- Gebruik je kennis van Belgische en Nederlandse winkels, ketens, webshops, energieleveranciers, verzekeraars, mutualiteiten, scholen en diensten.
- "POS", "Bancontact", "betaling met kaart" en plaatsnamen zijn ruis; kijk naar de naam van de winkel of de begunstigde.
- Weet je het echt niet, kies dan de categorie "andere" van die soort (de laatste in de lijst). Gok niet wild.
Antwoord enkel met een JSON-object {"items": [{"id": <nummer>, "cat": "<categorie-id>"}]}, met elk nummer precies één keer.`;
  const user = 'Verrichtingen:\n' + items.map((i) => `${i.id} | ${i.type} | € ${(i.amount / 100).toFixed(2)} | ${i.text}`).join('\n');
  return {
    system,
    user,
    tokens: 16384,
    gemini: {
      type: 'OBJECT',
      properties: { items: { type: 'ARRAY', items: { type: 'OBJECT', properties: { id: { type: 'INTEGER' }, cat: { type: 'STRING', enum: ids } }, required: ['id', 'cat'], propertyOrdering: ['id', 'cat'] } } },
      required: ['items'],
    },
    claude: {
      type: 'object',
      properties: { items: { type: 'array', items: { type: 'object', properties: { id: { type: 'integer' }, cat: { type: 'string', enum: ids } }, required: ['id', 'cat'], additionalProperties: false } } },
      required: ['items'],
      additionalProperties: false,
    },
  };
}

function readCats(raw: unknown): Cat[] {
  return (Array.isArray(raw) ? raw : []).slice(0, 40)
    .map((c) => ({ id: clean((c as Cat)?.id, 40), name: clean((c as Cat)?.name, 60) }))
    .filter((c) => /^[a-z_]+$/.test(c.id));
}

async function categorie(body: Record<string, unknown>) {
  const book = body.book === 'zaak' ? 'zaak' : 'gezin';
  const raw = (body.cats || {}) as { in?: unknown; uit?: unknown };
  const cats = { in: readCats(raw.in), uit: readCats(raw.uit) };
  if (!cats.in.length || !cats.uit.length) return json({ error: 'fout', reden: 'Geen categorieën ontvangen.' }, 400);
  const items: Item[] = (Array.isArray(body.items) ? body.items : []).slice(0, 150).map((x) => {
    const i = x as Record<string, unknown>;
    return { id: Number(i.id), type: i.type === 'in' ? 'in' : 'uit', text: clean(i.text, 160), amount: Math.abs(Math.round(Number(i.amount) || 0)) } as Item;
  }).filter((i) => Number.isInteger(i.id) && i.text);
  if (!items.length) return json({ items: [] });

  const out = await ask(categoryTask(book, cats, items));
  const ok = { in: new Set(cats.in.map((c) => c.id)), uit: new Set(cats.uit.map((c) => c.id)) };
  const type = new Map(items.map((i) => [i.id, i.type]));
  const res = (Array.isArray(out.items) ? out.items : [])
    .map((r: { id?: unknown; cat?: unknown }) => ({ id: Number(r?.id), cat: String(r?.cat || '') }))
    .filter((r: { id: number; cat: string }) => type.has(r.id) && ok[type.get(r.id)!].has(r.cat));
  return json({ items: res, bron: out.bron });
}

// ───────────── Inzichten ─────────────

const TONES = ['good', 'warn', 'info'];

function insightTask(book: string, facts: string): Task {
  const zaak = book === 'zaak';
  const system = `Je bent een vriendelijke, nuchtere budgetcoach voor een Vlaams gezin${zaak ? ' met een eigen vennootschap (IT-consultancy, catering en BBQ-workshops). Je kijkt nu naar het boekje van de zaak' : ''}.
Je krijgt de cijfers van hun huishoudboekje voor een periode: inkomsten, uitgaven per categorie, hoe dat zich verhoudt tot gewoonlijk, en de grootste uitgaven.
Schrijf in eenvoudig Vlaams Nederlands, zonder vakjargon, en spreek hen aan met "je".
- samenvatting: 1 of 2 korte zinnen: wat is het belangrijkste dat opvalt in deze periode?
- tips: 2 tot 4 concrete, haalbare tips die echt over hun cijfers gaan (noem de categorie of de uitgave en het bedrag). Geen algemene open deuren.
  Elke tip heeft een titel (max. 6 woorden), een tekst (1 of 2 zinnen) en een toon: "good" (iets dat goed gaat), "warn" (iets om op te letten) of "info".
- Begin minstens één tip positief als er iets goed gaat.
- Verzin geen cijfers: gebruik alleen de bedragen die je krijgt. Bedragen schrijf je als "€ 123".
- Een lopende maand is nog niet voorbij: oordeel daar voorzichtig over.
Antwoord enkel met een JSON-object met de velden samenvatting en tips.`;
  return {
    system,
    user: facts,
    tokens: 8192,
    gemini: {
      type: 'OBJECT',
      properties: {
        samenvatting: { type: 'STRING' },
        tips: { type: 'ARRAY', items: { type: 'OBJECT', properties: { titel: { type: 'STRING' }, tekst: { type: 'STRING' }, toon: { type: 'STRING', enum: TONES } }, required: ['titel', 'tekst', 'toon'], propertyOrdering: ['titel', 'tekst', 'toon'] } },
      },
      required: ['samenvatting', 'tips'],
      propertyOrdering: ['samenvatting', 'tips'],
    },
    claude: {
      type: 'object',
      properties: {
        samenvatting: { type: 'string' },
        tips: { type: 'array', items: { type: 'object', properties: { titel: { type: 'string' }, tekst: { type: 'string' }, toon: { type: 'string', enum: TONES } }, required: ['titel', 'tekst', 'toon'], additionalProperties: false } },
      },
      required: ['samenvatting', 'tips'],
      additionalProperties: false,
    },
  };
}

async function inzichten(body: Record<string, unknown>) {
  const book = body.book === 'zaak' ? 'zaak' : 'gezin';
  // De app stuurt al een kort, leesbaar overzicht van de cijfers (geen rekeningnummers).
  const facts = String(body.facts || '').slice(0, 6000).trim();
  if (!facts) return json({ error: 'fout', reden: 'Geen cijfers ontvangen.' }, 400);
  const out = await ask(insightTask(book, facts));
  const tips = (Array.isArray(out.tips) ? out.tips : [])
    .map((t: { titel?: unknown; tekst?: unknown; toon?: unknown }) => ({ titel: clean(t?.titel, 70), tekst: clean(t?.tekst, 400), toon: TONES.includes(String(t?.toon)) ? String(t?.toon) : 'info' }))
    .filter((t: { titel: string; tekst: string }) => t.titel && t.tekst)
    .slice(0, 4);
  const samenvatting = clean(out.samenvatting, 400);
  if (!samenvatting && !tips.length) throw new AiError(422, 'Leeg antwoord.', 'het antwoord was leeg');
  return json({ samenvatting, tips, bron: out.bron });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Alleen POST.' }, 405);

  // Wie vraagt dit? Alleen aangemelde gebruikers.
  const auth = req.headers.get('Authorization') || '';
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: who } = await sb.auth.getUser(auth.replace(/^Bearer\s+/i, ''));
  if (!who?.user) return json({ error: 'Meld je eerst aan.' }, 401);

  if (!Deno.env.get('GEMINI_API_KEY') && !Deno.env.get('ANTHROPIC_API_KEY')) {
    return json({ error: 'niet-ingesteld', reden: 'De sleutel GEMINI_API_KEY staat nog niet in Supabase.' }, 503);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'fout', reden: 'Geen vraag ontvangen.' }, 400); }

  try {
    if (body.action === 'categorie') return await categorie(body);
    if (body.action === 'inzichten') return await inzichten(body);
    return json({ error: 'fout', reden: 'Onbekende vraag.' }, 400);
  } catch (e) {
    // De echte fout komt in de Logs van de functie in Supabase.
    console.error('ai-hulp:', e instanceof Error ? e.message : e);
    const status = e instanceof AiError ? e.status : 500;
    const msg = String((e as Error)?.message || '');
    const uitleg = e instanceof AiError ? e.uitleg : '';
    if (/API key|API_KEY/i.test(msg)) return json({ error: 'niet-ingesteld', reden: 'Google weigert de sleutel. Kijk of GEMINI_API_KEY klopt.' }, 503);
    if (/location|region|country/i.test(msg)) return json({ error: 'niet-ingesteld', reden: 'Google laat de gratis versie hier niet toe. Zet facturatie aan in Google AI Studio.' }, 503);
    if (status === 401 || status === 403) return json({ error: 'niet-ingesteld', reden: 'De AI weigert de sleutel. Kijk of die klopt in Supabase.' }, 503);
    if (status === 429) return json({ error: 'druk', reden: 'Even te veel AI-vragen na elkaar (gratis limiet van Google). Probeer het straks opnieuw.' }, 429);
    return json({ error: 'fout', reden: uitleg ? `De AI gaf geen bruikbaar antwoord: ${uitleg}` : 'De AI gaf geen bruikbaar antwoord.' }, 502);
  }
});
