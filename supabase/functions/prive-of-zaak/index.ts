// Supabase Edge Function "prive-of-zaak": laat een AI inschatten of een aankoop
// beter privé of via de vennootschap gebeurt.
// Standaard met Google Gemini (geheim GEMINI_API_KEY). Staat er geen Gemini-sleutel maar wel
// ANTHROPIC_API_KEY (zoals voor de voorraadfoto), dan gebruikt ze Claude.
// De sleutels staan als geheim in Supabase, nooit in de app zelf.
// Alleen wie aangemeld is in het huishoudboekje mag deze functie gebruiken.
// Lukt het niet, dan valt de app zelf terug op de vaste vuistregels.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const CATS = ['it_materiaal', 'bbq_materiaal', 'ingredienten', 'auto_zaak', 'resto_klant', 'opleiding', 'telefoon', 'boekhouder', 'andere_zaak'];

const SYSTEM = `Je helpt een Vlaams gezin met een eigen Belgische vennootschap (BV). De vennootschap doet IT-consultancy en catering en BBQ-workshops.
De gebruiker typt iets dat hij wil kopen. Zeg of dat beter privé of via de vennootschap gaat, volgens de Belgische fiscale regels voor vennootschappen.

Antwoord in eenvoudig Vlaams Nederlands, kort en concreet, zonder vakjargon. Spreek de gebruiker aan met "je".
- verdict: "zaak" (normaal volledig beroepskost), "deels" (deels aftrekbaar of gemengd gebruik), "prive" (privé), "twijfel" (hangt echt af van hoe het gebruikt wordt).
- pct: het aftrekbare percentage als beroepskost (0 tot 100). Gebruik -1 als het niet met één getal te zeggen is (bv. auto's).
- btw: true als de vennootschap de btw normaal kan terugvragen.
- cat: de best passende categorie van de zaak: ${CATS.join(', ')}.
- title: een korte titel (max. 5 woorden) voor de soort aankoop.
- why: 1 tot 3 zinnen uitleg, toegepast op deze aankoop en deze zaak.
- tips: 0 tot 3 korte, praktische tips (bv. wat je moet bijhouden, waar je op let, wanneer de boekhouder vragen).

Vuistregels die je moet volgen:
- Een kost is aftrekbaar als hij gemaakt wordt om inkomsten te verwerven, met een factuur op naam van de vennootschap.
- Gemengd gebruik (ook privé) is meestal alleen voor het beroepsdeel aftrekbaar; privégebruik van materiaal van de zaak kan een voordeel alle aard geven.
- Restaurant met klanten of leveranciers: 69% aftrekbaar, btw niet terug. Alleen of met het gezin uit eten is privé.
- Relatiegeschenken en recepties: 50% aftrekbaar; btw enkel terug voor kleine geschenken tot € 50 excl. btw.
- Gewone kleding is privé, ook als je ze voor je werk draagt. Echte werkkledij (koksvest, schort, veiligheidsschoenen) is zaak.
- IT-materiaal, software, telefoon en internet: zaak, met een klein forfaitair voordeel alle aard bij privégebruik.
- Materiaal voor workshops en catering is zaak. Iets dat vooral thuis staat en privé gebruikt wordt (zoals een BBQ of buitenkeuken in de eigen tuin) is privé of hooguit deels, en de fiscus kijkt kritisch.
- Verbouwingen en inrichting van de eigen woning zijn privé, tenzij een deel aantoonbaar en uitsluitend voor de zaak dient (bv. een apart lokaal voor workshops), en dan best na overleg met de boekhouder.
- Auto's: hangt af van de wagen, de uitstoot en de besteldatum; elektrische wagens zijn het gunstigst. Gebruik "deels" en pct -1, en raad de boekhouder aan.
- Fiets van de zaak: aftrekbaar en gunstig. Opleidingen die bij het werk passen: zaak. Hobby, vakantie, sport, gezin: privé.
- Bij grote of twijfelachtige aankopen: zeg dat ze het vooraf aan de boekhouder vragen.

Verzin geen regels of bedragen waar je niet zeker van bent; zeg dan liever "twijfel". Dit is geen fiscaal advies, de boekhouder heeft het laatste woord.
Gaat de vraag niet over een aankoop of uitgave, antwoord dan met verdict "twijfel" en leg kort uit dat je enkel aankopen inschat.`;

// Schema voor het antwoord (Gemini gebruikt de OpenAPI-vorm, Claude JSON Schema).
const GEMINI_SCHEMA = {
  type: 'OBJECT',
  properties: {
    verdict: { type: 'STRING', enum: ['zaak', 'deels', 'prive', 'twijfel'] },
    pct: { type: 'INTEGER' },
    btw: { type: 'BOOLEAN' },
    cat: { type: 'STRING', enum: CATS },
    title: { type: 'STRING' },
    why: { type: 'STRING' },
    tips: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['verdict', 'pct', 'btw', 'cat', 'title', 'why', 'tips'],
  propertyOrdering: ['verdict', 'pct', 'btw', 'cat', 'title', 'why', 'tips'],
};

const CLAUDE_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['zaak', 'deels', 'prive', 'twijfel'] },
    pct: { type: 'integer' },
    btw: { type: 'boolean' },
    cat: { type: 'string', enum: CATS },
    title: { type: 'string' },
    why: { type: 'string' },
    tips: { type: 'array', items: { type: 'string' } },
  },
  required: ['verdict', 'pct', 'btw', 'cat', 'title', 'why', 'tips'],
  additionalProperties: false,
};

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

// Gemini: eerst het model uit het geheim GEMINI_MODEL (als dat er is), anders de "laatste Flash".
// Bestaat een model niet (meer) of weigert het de vraag, dan proberen we het volgende.
// Lukt het met het vaste antwoordschema niet, dan vragen we gewoon om JSON.
async function askGemini(key: string, question: string) {
  const own = (Deno.env.get('GEMINI_MODEL') || '').trim();
  const models = [own, 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-flash-lite-latest', 'gemini-2.5-flash-lite'].filter((m, i, a) => m && a.indexOf(m) === i);
  let last: AiError | null = null;
  for (const model of models) {
    for (const withSchema of [true, false]) {
      const generationConfig: Record<string, unknown> = { temperature: 0.2, maxOutputTokens: 8192, responseMimeType: 'application/json' };
      if (withSchema) generationConfig.responseSchema = GEMINI_SCHEMA;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: [{ role: 'user', parts: [{ text: `Wat ik wil kopen: ${question}\nAntwoord enkel met een JSON-object met de velden verdict, pct, btw, cat, title, why en tips.` }] }],
          generationConfig,
        }),
      });
      if (!res.ok) {
        const msg = await googleError(res);
        console.error(`prive-of-zaak: ${model}${withSchema ? '' : ' (zonder schema)'} gaf ${res.status}: ${msg}`);
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
      const parts = cand?.content?.parts || [];
      const text = parts.filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought).map((p: { text: string }) => p.text).join('');
      if (!text) {
        const why = data?.promptFeedback?.blockReason || cand?.finishReason || 'leeg';
        console.error(`prive-of-zaak: ${model} gaf geen tekst (${why})`);
        last = new AiError(422, `Gemini ${model}: geen tekst (${why})`, `Gemini gaf geen tekst (${why})`);
        break;
      }
      try {
        return { ...parseJson(text), bron: 'Gemini' };
      } catch (e) {
        console.error(`prive-of-zaak: ${model} antwoord niet leesbaar: ${text.slice(0, 300)}`);
        last = e instanceof AiError ? e : new AiError(422, String(e), 'het antwoord was geen geldig formaat');
      }
    }
  }
  throw last || new AiError(404, 'Geen Gemini-model gevonden.', 'geen Gemini-model gevonden');
}

async function askClaude(key: string, question: string) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-5-5',
      max_tokens: 1500,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: CLAUDE_SCHEMA } },
      system: SYSTEM,
      messages: [{ role: 'user', content: `Wat ik wil kopen: ${question}` }],
    }),
  });
  if (!res.ok) throw new AiError(res.status, `Claude ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = (data?.content || []).find((b: { type: string }) => b.type === 'text')?.text;
  if (!text) throw new AiError(422, 'Claude gaf geen antwoord.');
  return { ...parseJson(text), bron: 'Claude' };
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

  const gemini = Deno.env.get('GEMINI_API_KEY');
  const claude = Deno.env.get('ANTHROPIC_API_KEY');
  if (!gemini && !claude) return json({ error: 'niet-ingesteld', reden: 'De sleutel GEMINI_API_KEY staat nog niet in Supabase.' }, 503);

  let body: { question?: string };
  try { body = await req.json(); } catch { return json({ error: 'Geen vraag ontvangen.' }, 400); }
  const question = String(body.question || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!question) return json({ error: 'Geen vraag ontvangen.' }, 400);

  try {
    const out = gemini ? await askGemini(gemini, question) : await askClaude(claude!, question);
    return json(out);
  } catch (e) {
    // De echte fout komt in de Logs van de functie in Supabase.
    console.error('prive-of-zaak:', e instanceof Error ? e.message : e);
    const status = e instanceof AiError ? e.status : 500;
    const msg = String((e as Error)?.message || '');
    const uitleg = e instanceof AiError ? e.uitleg : '';
    if (/API key|API_KEY/i.test(msg)) {
      return json({ error: 'niet-ingesteld', reden: 'Google weigert de sleutel. Kijk of GEMINI_API_KEY klopt.' }, 503);
    }
    if (/location|region|country/i.test(msg)) {
      return json({ error: 'niet-ingesteld', reden: 'Google laat de gratis versie hier niet toe. Zet facturatie aan in Google AI Studio.' }, 503);
    }
    if (status === 401 || status === 403) return json({ error: 'niet-ingesteld', reden: 'De AI weigert de sleutel. Kijk of die klopt in Supabase.' }, 503);
    if (status === 429) return json({ error: 'druk', reden: 'Even te veel vragen na elkaar (gratis limiet). Probeer het zo opnieuw.' }, 429);
    return json({ error: 'fout', reden: uitleg ? `De AI gaf geen bruikbaar antwoord: ${uitleg}` : 'De AI gaf geen bruikbaar antwoord.' }, 502);
  }
});
