// Hulp van de AI (Supabase-functie "ai-hulp", standaard Google Gemini):
// categorieën voorstellen bij het importeren, en tips bij de inzichten.
// Pure functies, zodat ze te testen zijn. Lukt de AI niet, dan blijft alles zoals de vaste regels het deden.
import { categoriesFor, category } from './categories.js';
import { money } from './format.js';

// De "Andere"-categorie van een boekje en soort: daar valt iets in als de vaste regels het niet weten.
export const fallbackCat = (book, type) => {
  const cats = categoriesFor(book, type);
  return cats[cats.length - 1]?.id;
};

// Welke rijen van het importscherm vragen we aan de AI? Enkel wat in "Andere" viel en niet al in het boekje staat.
export function rowsForAi(rows, book) {
  return (rows || []).filter((r) => !r.dup && !r.own && !r.cash && r.catBy !== 'jij' && r.category === fallbackCat(book, r.type));
}

// Wat we doorsturen: geen rekeningnummers, enkel de omschrijving, het soort verrichting en het bedrag.
export function aiCategoryRequest(rows, book) {
  const pick = (list) => list.map((c) => ({ id: c.id, name: c.name }));
  return {
    book,
    cats: { uit: pick(categoriesFor(book, 'uit')), in: pick(categoriesFor(book, 'in')) },
    items: rows.map((r) => ({
      id: r.i,
      type: r.type,
      amount: r.amount_cents,
      text: [r.note, r.kind].filter(Boolean).join(' · ').replace(/\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}\b/g, '').slice(0, 160),
    })),
  };
}

// Het antwoord van de AI toepassen. Wat de gebruiker intussen zelf koos, blijft staan.
export function applyAiCategories(rows, items, book) {
  const pick = new Map();
  for (const it of items || []) pick.set(Number(it.id), String(it.cat || ''));
  return rows.map((r) => {
    const cat = pick.get(r.i);
    if (!cat || r.catBy === 'jij' || r.category !== fallbackCat(book, r.type)) return r;
    if (cat === r.category || !categoriesFor(book, r.type).some((c) => c.id === cat)) return r;
    return { ...r, category: cat, catBy: 'ai' };
  });
}

// In stukjes, zodat één vraag niet te groot wordt.
export function chunks(list, size = 100) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

// ───────────── Inzichten ─────────────

const eur = (c) => money(c, { round: true });

// Een kort, leesbaar overzicht van de cijfers voor de AI. Geen namen of rekeningnummers,
// enkel totalen per categorie en de omschrijving van de grootste uitgaven.
export function insightFacts(a, book) {
  const lines = [];
  const per = a.perMonth ? ' (gemiddeld per maand)' : '';
  lines.push(`Boekje: ${book === 'zaak' ? 'zaak (vennootschap)' : 'gezin'}.`);
  lines.push(`Periode: ${a.label}${a.cap ? `, nog bezig: we zijn op dag ${a.cap}` : ''}. ${a.count} boekingen.`);
  lines.push(`Inkomsten: ${eur(a.total.income)}. Uitgaven: ${eur(a.total.expense)}.${a.perMonth ? ` Per maand: in ${eur(a.cur.income)}, uit ${eur(a.cur.expense)}.` : ''}`);
  if (a.hasPrev) lines.push(`Vorige periode: in ${eur(a.prev.income)}, uit ${eur(a.prev.expense)}.`);
  const rows = a.rows.filter((r) => r.now > 0 || r.usual > 0).slice(0, 12);
  if (rows.length) {
    lines.push(`Uitgaven per categorie${per}${a.hasBase ? ', met tussen haakjes wat gewoonlijk' : ''}:`);
    for (const r of rows) lines.push(`- ${category(r.id).name}: ${eur(r.now)}${a.hasBase && r.usual != null ? ` (gewoonlijk ${eur(r.usual)})` : ''}`);
  }
  if (a.outliers.length) {
    lines.push('Wat de app al zag:');
    for (const o of a.outliers.slice(0, 5)) lines.push(`- ${o.title}: ${o.text}`);
  }
  const big = a.periodEntries.filter((e) => e.type === 'uit').sort((x, y) => y.amount_cents - x.amount_cents).slice(0, 8);
  if (big.length) {
    lines.push('Grootste uitgaven:');
    for (const e of big) lines.push(`- ${eur(e.amount_cents)}, ${category(e.category).name}${e.note ? `: ${String(e.note).slice(0, 60)}` : ''}`);
  }
  const w = a.weekday || [];
  const tw = w.reduce((s, v) => s + v, 0);
  if (tw > 0) {
    const DAYS = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'];
    const i = w.indexOf(Math.max(...w));
    lines.push(`Duurste weekdag: ${DAYS[i]} (${Math.round((w[i] / tw) * 100)}% van de uitgaven).`);
  }
  return lines.join('\n').slice(0, 6000);
}

const clean = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

// Antwoord van de AI netjes maken. Klopt het niet, dan null (en toont de app enkel haar eigen tips).
export function fromAiInsight(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const tips = (Array.isArray(raw.tips) ? raw.tips : [])
    .map((t) => ({ title: clean(t?.titel, 70), text: clean(t?.tekst, 400), tone: ['good', 'warn', 'info'].includes(t?.toon) ? t.toon : 'info' }))
    .filter((t) => t.title && t.text)
    .slice(0, 4);
  const summary = clean(raw.samenvatting, 400);
  if (!summary && !tips.length) return null;
  return { summary, tips, bron: clean(raw.bron, 20) || 'AI' };
}

// ───────────── Recept van een foto ─────────────

// Antwoord van de AI omzetten naar wat het receptscherm verwacht. Niets bruikbaars: null.
export function fromAiRecipe(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const title = clean(raw.titel, 120).replace(/[.:]+$/, '') || null;
  const n = Math.round(Number(raw.personen));
  const servings = n > 0 && n < 100 ? n : null;
  const ingredients = (Array.isArray(raw.ingredienten) ? raw.ingredienten : [])
    .map((i) => {
      const name = clean(i?.naam, 80).replace(/[.;:,]+$/, '');
      if (!name) return null;
      return { qty: clean(i?.hoeveelheid, 30) || null, name: name.charAt(0).toLowerCase() + name.slice(1), note: clean(i?.opmerking, 80) || null };
    })
    .filter(Boolean)
    .slice(0, 60);
  const steps = (Array.isArray(raw.stappen) ? raw.stappen : [])
    .map((s) => clean(s, 1200).replace(/^(\d+[.)]|stap\s*\d+[:.]?)\s*/i, ''))
    .filter(Boolean)
    .join('\n');
  if (!ingredients.length && !steps) return null;
  return { title, servings, ingredients, steps, bron: clean(raw.bron, 20) || 'AI' };
}
