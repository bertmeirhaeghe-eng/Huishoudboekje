// Supabase Edge Function "voorraad-foto": kijkt met Claude naar een foto van de kast,
// koelkast of diepvries en geeft terug welke producten erop staan.
// De Anthropic-sleutel staat als geheim (ANTHROPIC_API_KEY) in Supabase, nooit in de app zelf.
// Alleen wie aangemeld is in het huishoudboekje mag deze functie gebruiken.
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const SCHEMA = {
  type: 'object',
  properties: {
    plaats: { type: 'string', enum: ['kast', 'koelkast', 'diepvries', 'andere'] },
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
- Gok niet: wat je niet kunt herkennen laat je weg. Geen meubels, borden of potten zonder inhoud die je niet herkent.`;

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

  if (!Deno.env.get('ANTHROPIC_API_KEY')) return json({ error: 'niet-ingesteld', reden: 'De sleutel ANTHROPIC_API_KEY staat nog niet in Supabase.' }, 503);

  let body: { image?: string; mediaType?: string; known?: string[] };
  try { body = await req.json(); } catch { return json({ error: 'Geen foto ontvangen.' }, 400); }
  const image = String(body.image || '');
  if (!image || image.length > 7_000_000) return json({ error: 'Geen of te grote foto.' }, 400);
  const mediaType = ['image/jpeg', 'image/png', 'image/webp'].includes(String(body.mediaType)) ? body.mediaType : 'image/jpeg';
  const known = (Array.isArray(body.known) ? body.known : []).map((s) => String(s).slice(0, 80)).slice(0, 300);

  const client = new Anthropic();
  try {
    const res = await client.messages.create({
      model: 'claude-haiku-5-5',
      max_tokens: 4000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
          { type: 'text', text: known.length ? `Wat het gezin al in de voorraad heeft: ${known.join(', ')}.\nWelke producten zie je op deze foto?` : 'Welke producten zie je op deze foto?' },
        ],
      }],
    } as never);
    if (res.stop_reason === 'refusal') return json({ error: 'Ik kon deze foto niet bekijken.' }, 422);
    const text = res.content.find((b: { type: string }) => b.type === 'text') as { text: string } | undefined;
    const out = JSON.parse(text?.text || '{}');
    return json({ plaats: out.plaats || 'kast', items: Array.isArray(out.items) ? out.items.slice(0, 80) : [] });
  } catch (e) {
    // De echte fout komt in de Logs van de functie in Supabase.
    console.error('voorraad-foto:', e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
      return json({ error: 'niet-ingesteld', reden: 'Anthropic weigert de sleutel. Kijk of ANTHROPIC_API_KEY klopt.' }, 503);
    }
    if (e instanceof Anthropic.BadRequestError && /credit|balance/i.test(e.message)) {
      return json({ error: 'niet-ingesteld', reden: 'Er staat geen tegoed meer op het Anthropic-account.' }, 503);
    }
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Even te druk, probeer het zo opnieuw.' }, 429);
    if (e instanceof Anthropic.APIError) return json({ error: `De AI gaf een fout (${e.status}).` }, 502);
    return json({ error: 'Er ging iets mis bij het bekijken van de foto.' }, 500);
  }
});
