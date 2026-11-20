// Supabase Edge Function "voorraad-foto" (in Supabase geplaatst als "swift-responder"):
// kijkt naar een foto van de kast, koelkast of diepvries en geeft terug welke producten erop staan.
// Standaard met Google Gemini (geheim GEMINI_API_KEY, gratis versie). Staat er geen Gemini-sleutel,
// of lukt Gemini niet, en staat er wel ANTHROPIC_API_KEY, dan kijkt Claude.
// De sleutels staan als geheim in Supabase, nooit in de app zelf.
// Alleen wie aangemeld is in het huishoudboekje mag deze functie gebruiken.
// Lukt het helemaal niet, dan leest de app zelf de etiketten.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const PLACES = ['kast', 'koelkast', 'diepvries', 'andere'];

// Schema voor het antwoord (Gemini gebruikt de OpenAPI-vorm, Claude JSON Schema).
const GEMINI_SCHEMA = {
  type: 'OBJECT',
  properties: {
    plaats: { type: 'STRING', enum: PLACES },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          status: { type: 'STRING', enum: ['ok', 'bijna'] },
        },
        required: ['name', 'status'],
      },
    },
  },
  required: ['plaats', 'items'],
  propertyOrdering: ['plaats', 'items'],
};

const CLAUDE_SCHEMA = {
  type: 'object',
  properties: {
    plaats: { type: 'string', enum: PLACES },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          status: { type: 'string', enum: ['ok', 'bijna'] },
        },
        required: ['name', 'status'],
        additionalProperties: false,
      },
    },
  },
  required: ['plaats', 'items'],
  additionalProperties: false,
};

const SYSTEM = `Je helpt een Vlaams gezin hun voorraadkast bij te houden. Je krijgt een foto van een kast, koelkast, diepvries of berging.
Noem elk voedingsproduct of huishoudproduct dat je duidelijk ziet, één keer per soort.
- Gebruik korte, gewone Nederlandse namen zoals een gezin ze op een boodschappenlijst zet: "pasta", "rijst", "tomatensaus", "olijfolie", "melk", "eieren", "koffie". Geen merknamen, geen gewicht.
- Is het duidelijk een specifieke soort, gebruik die: "spaghetti", "basmatirijst", "kikkererwten in blik".
- Staat een product al in de lijst van wat het gezin heeft, gebruik dan precies die naam.
- status "bijna" alleen als je ziet dat de verpakking bijna leeg is; anders "ok".
- plaats: waar de foto genomen is (kast, koelkast, diepvries of andere).
- Gok niet: wat je niet kunt herkennen laat je weg. Geen meubels, borden of potten zonder inhoud die je niet herkent.
Antwoord enkel met een JSON-object met de velden plaats en items (elk item heeft name en status).`;

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
async function askGemini(key: string, parts: unknown[]) {
  const own = (Deno.env.get('GEMINI_MODEL') || '').trim();
  const models = [own, 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-flash-lite-latest', 'gemini-2.5-flash-lite'].filter((m, i, a) => m && a.indexOf(m) === i);
  let last: AiError | null = null;
  for (const model of models) {
    for (const withSchema of [true, false]) {
      const generationConfig: Record<string, unknown> = { temperature: 0.1, maxOutputTokens: 8192, responseMimeType: 'application/json' };
      if (withSchema) generationConfig.responseSchema = GEMINI_SCHEMA;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: [{ role: 'user', parts }],
          generationConfig,
        }),
      });
      if (!res.ok) {
        const msg = await googleError(res);
        console.error(`voorraad-foto: ${model}${withSchema ? '' : ' (zonder schema)'} gaf ${res.status}: ${msg}`);
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
      const out = (cand?.content?.parts || []).filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought).map((p: { text: string }) => p.text).join('');
      if (!out) {
        const why = data?.promptFeedback?.blockReason || cand?.finishReason || 'leeg';
        console.error(`voorraad-foto: ${model} gaf geen tekst (${why})`);
        last = new AiError(422, `Gemini ${model}: geen tekst (${why})`, `Gemini gaf geen tekst (${why})`);
        break;
      }
      try {
        return parseJson(out);
      } catch (e) {
        console.error(`voorraad-foto: ${model} antwoord niet leesbaar: ${out.slice(0, 300)}`);
        last = e instanceof AiError ? e : new AiError(422, String(e), 'het antwoord was geen geldig formaat');
      }
    }
  }
  throw last || new AiError(404, 'Geen Gemini-model gevonden.', 'geen Gemini-model gevonden');
}

async function askClaude(key: string, image: string, mediaType: string, question: string) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-5-5',
      max_tokens: 4000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: CLAUDE_SCHEMA } },
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
          { type: 'text', text: question },
        ],
      }],
    }),
  });
  if (!res.ok) {
    const raw = (await res.text()).slice(0, 300);
    console.error(`voorraad-foto: Claude gaf ${res.status}: ${raw}`);
    throw new AiError(res.status, `Claude ${res.status}: ${raw}`, /credit|balance/i.test(raw) ? 'geen tegoed meer op het Anthropic-account' : '');
  }
  const data = await res.json();
  if (data?.stop_reason === 'refusal') throw new AiError(422, 'Claude weigerde de foto.', 'de AI kon deze foto niet bekijken');
  const text = (data?.content || []).find((b: { type: string }) => b.type === 'text')?.text;
  if (!text) throw new AiError(422, 'Claude gaf geen antwoord.');
  return parseJson(text);
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

  let body: { image?: string; data?: string; mediaType?: string; known?: string[] };
  try { body = await req.json(); } catch { return json({ error: 'Geen foto ontvangen.' }, 400); }
  // De foto als base64 (zonder "data:image/jpeg;base64," ervoor). Oudere app-versies stuurden ze als "data".
  const image = String(body.image || body.data || '').replace(/^data:[^,]*,/, '');
  if (!image || image.length > 7_000_000) return json({ error: 'Geen of te grote foto.' }, 400);
  const mediaType = ['image/jpeg', 'image/png', 'image/webp'].includes(String(body.mediaType)) ? String(body.mediaType) : 'image/jpeg';
  const known = (Array.isArray(body.known) ? body.known : []).map((s) => String(s).slice(0, 80)).slice(0, 300);
  const question = known.length ? `Wat het gezin al in de voorraad heeft: ${known.join(', ')}.\nWelke producten zie je op deze foto?` : 'Welke producten zie je op deze foto?';

  let out: { plaats?: string; items?: unknown[] } | null = null;
  let bron = '';
  let err: unknown = null;
  if (gemini) {
    try {
      out = await askGemini(gemini, [{ inlineData: { mimeType: mediaType, data: image } }, { text: question }]);
      bron = 'Gemini';
    } catch (e) {
      err = e;
    }
  }
  if (!out && claude) {
    try {
      out = await askClaude(claude, image, mediaType, question);
      bron = 'Claude';
      err = null;
    } catch (e) {
      // Was Gemini al mislukt, dan tonen we liefst die fout (dat is de hoofdsleutel).
      err = err || e;
    }
  }

  if (out) {
    const plaats = PLACES.includes(String(out.plaats)) ? out.plaats : 'kast';
    return json({ plaats, items: Array.isArray(out.items) ? out.items.slice(0, 80) : [], bron });
  }

  // De echte fout komt in de Logs van de functie in Supabase.
  console.error('voorraad-foto:', err instanceof Error ? err.message : err);
  const status = err instanceof AiError ? err.status : 500;
  const msg = String((err as Error)?.message || '');
  const uitleg = err instanceof AiError ? err.uitleg : '';
  // Bij "niet-ingesteld" leest de app zelf de etiketten en toont ze de reden.
  if (/API key|API_KEY/i.test(msg)) return json({ error: 'niet-ingesteld', reden: 'Google weigert de sleutel. Kijk of GEMINI_API_KEY klopt.' }, 503);
  if (/location|region|country/i.test(msg)) return json({ error: 'niet-ingesteld', reden: 'Google laat de gratis versie hier niet toe. Zet facturatie aan in Google AI Studio.' }, 503);
  if (status === 401 || status === 403) return json({ error: 'niet-ingesteld', reden: 'De AI weigert de sleutel. Kijk of die klopt in Supabase.' }, 503);
  if (/tegoed/.test(uitleg)) return json({ error: 'niet-ingesteld', reden: 'Er staat geen tegoed meer op het Anthropic-account.' }, 503);
  if (status === 429) return json({ error: 'druk', reden: 'Even te veel AI-vragen na elkaar (gratis limiet van Google). Probeer het straks opnieuw.' }, 429);
  return json({ error: uitleg ? `De AI gaf geen bruikbaar antwoord: ${uitleg}` : 'Er ging iets mis bij het bekijken van de foto.' }, 502);
});
