// Supabase-gegevens van het gezin. De publishable (anon) sleutel is bedoeld om publiek te zijn:
// de beveiliging zit in de toegangsregels van de database (supabase/schema.sql).
// Een .env.local (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) gaat voor, handig om te testen.
export const SUPABASE_URL = 'https://jzztsspjpdhafcjfsbig.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_Fnf-FjXunlfzAIChnooZgQ_r9uDdD5Q';

// Google Agenda: de "Client ID" van een OAuth-client (type Webtoepassing) uit Google Cloud.
// Ook die is publiek bedoeld. Leeg = de app opent Google Agenda met de afspraak al ingevuld.
export const GOOGLE_CLIENT_ID = import.meta.env?.VITE_GOOGLE_CLIENT_ID || '';

// Naam (slug) van de Supabase-functie die voorraadfoto's bekijkt (in Supabase heet ze "voorraad-foto").
// https://<project>.supabase.co/functions/v1/<deze-naam>
export const PANTRY_FUNCTION = import.meta.env?.VITE_PANTRY_FUNCTION || 'swift-responder';

// Naam (slug) van de Supabase-functie die verrichtingen bij de bank ophaalt (Enable Banking).
export const BANK_FUNCTION = import.meta.env?.VITE_BANK_FUNCTION || 'bank-koppeling';

// Naam (slug) van de Supabase-functie die klusjes in Google Agenda zet.
export const CHORES_FUNCTION = import.meta.env?.VITE_CHORES_FUNCTION || 'klusjes-agenda';

// Naam (slug) van de Supabase-functie die met AI inschat of iets privé of zaak is.
export const ADVICE_FUNCTION = import.meta.env?.VITE_ADVICE_FUNCTION || 'prive-of-zaak';

// Naam (slug) van de Supabase-functie die met AI categorieën voorstelt en tips geeft bij de inzichten.
export const AI_FUNCTION = import.meta.env?.VITE_AI_FUNCTION || 'ai-hulp';
