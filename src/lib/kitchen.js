// Keuken: ingrediënten herkennen, vergelijken met de voorraadkast en recepten uit tekst halen.
// Alles werkt op het toestel, zonder internet.

// ───────────── Namen vergelijken ─────────────

const strip = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Woorden die niets zeggen over wát het is.
const ADJECTIVES = new Set(['vers', 'verse', 'gehakte', 'fijn', 'fijne', 'fijngesneden', 'gesneden', 'grote', 'groot', 'kleine', 'klein', 'middelgrote', 'rode', 'rood', 'witte', 'wit', 'gele', 'geel', 'groene', 'groen', 'zwarte', 'zwart', 'bruine', 'bruin', 'halfvolle', 'volle', 'magere', 'gemalen', 'gedroogde', 'gedroogd', 'geraspte', 'geraspt', 'zachte', 'koude', 'warme', 'lauwe', 'biologische', 'bio', 'extra', 'vierge', 'ongezouten', 'gezouten', 'zoete', 'zure', 'diepvries', 'blik', 'enkele', 'paar', 'wat', 'stuk', 'stuks', 'van', 'de', 'het', 'een', 'en', 'of', 'met', 'naar', 'smaak', 'optioneel', 'eventueel']);

// Een woord tot zijn kern brengen: "tomaten" en "tomaat" worden allebei "tomat".
export function wordKey(w) {
  let k = strip(w).replace(/[^a-z]/g, '');
  if (k === 'eieren' || k === 'eitje' || k === 'eitjes') return 'ei';
  if (k === 'look' || k === 'lookje' || k === 'teentjeslook') return 'knoflok';
  if (k.length > 5 && k.endsWith('tjes')) k = k.slice(0, -4);
  else if (k.length > 4 && k.endsWith('jes')) k = k.slice(0, -3);
  if (k.length > 3 && k.endsWith('en')) k = k.slice(0, -2);
  else if (k.length > 3 && k.endsWith('s')) k = k.slice(0, -1);
  else if (k.length > 3 && k.endsWith('e')) k = k.slice(0, -1);
  return k.replace(/([aeou])\1/g, '$1');
}

// De kernwoorden van een naam, zonder hoeveelheden en bijvoeglijke naamwoorden.
export function nameKeys(name) {
  const words = strip(name).replace(/\(.*?\)/g, ' ').split(/[^a-z]+/).filter(Boolean);
  const core = words.filter((w) => !ADJECTIVES.has(w));
  return (core.length ? core : words).map(wordKey).filter((k) => k.length >= 2);
}

function keysMatch(a, b) {
  if (a === b) return true;
  if (a.length < 3 || b.length < 3) return false;
  // Samengestelde woorden: "kippenbouillon" past bij "bouillon", "olijfolie" bij "olie".
  // Het voorste deel moet zelf een woord kunnen zijn ("friet" bevat "iet", maar dat telt niet).
  // Korte woorden zoals "lok" zitten ook in "tomatenblok"; daarom pas vanaf 4 letters (olie uitgezonderd).
  const [long, short] = a.length >= b.length ? [a, b] : [b, a];
  if (short.length < 4 && short !== 'oli') return false;
  return long.endsWith(short) && long.length - short.length >= 3;
}

export function sameThing(a, b) {
  const ka = nameKeys(a);
  const kb = nameKeys(b);
  if (!ka.length || !kb.length) return false;
  // Het laatste kernwoord is meestal het eigenlijke product ("rode ui" -> ui).
  const headA = ka[ka.length - 1];
  const headB = kb[kb.length - 1];
  return keysMatch(headA, headB) || ka.some((x) => keysMatch(x, headB)) || kb.some((x) => keysMatch(x, headA));
}

// Wat iedereen altijd heeft.
const ALWAYS = ['water', 'kraantjeswater', 'ijsblokjes'];

export function findInPantry(name, pantry) {
  return pantry.find((p) => sameThing(name, p.name)) || null;
}

// Per ingrediënt: hebben we het, of moet het gekocht worden?
export function checkIngredients(ingredients, pantry, shopping = []) {
  return ingredients.map((ing) => {
    if (ALWAYS.some((a) => sameThing(ing.name, a))) return { ...ing, state: 'heb', item: null };
    const item = findInPantry(ing.name, pantry);
    const onList = shopping.find((s) => !s.done && sameThing(ing.name, s.name)) || null;
    let state = 'kopen';
    if (item && item.status === 'ok') state = 'heb';
    else if (item && item.status === 'bijna') state = 'bijna';
    if (state !== 'heb' && onList) state = 'op-lijst';
    return { ...ing, state, item, onList };
  });
}

// ───────────── Ingrediënten en recepten uit tekst ─────────────

const UNIT = 'kg|kilo|gram|gr|g|mg|liter|l|dl|cl|ml|eetlepels?|el|theelepels?|tl|koffielepels?|kl|stuks?|st|teentjes?|teen|takjes?|blikjes?|blik|zakjes?|zak|bosjes?|bos|potjes?|pot|plakjes?|plakken|sneetjes?|kopjes?|kop|snufje|snuifje|mespuntje|scheutje|scheut|handvol|stengels?|blaadjes|bladeren|pakjes?|pak|rollen|rol|bekers?|bekertjes?|glazen|glas|bollen|bol|kwart|halve|hele';
const NUM = '\\d+(?:[.,]\\d+)?(?:\\s*(?:-|tot|à|a)\\s*\\d+(?:[.,]\\d+)?)?|\\d+\\s*\\/\\s*\\d+|[½¼¾⅓⅔]|een\\s+half|een\\s+halve|anderhalve?|een|twee|drie|vier|vijf|zes|zeven|acht|negen|tien|enkele|paar';
const QTY_RE = new RegExp(`^((?:${NUM})\\s*(?:(?:${UNIT})\\b\\.?)?(?:\\s+(?:${UNIT})\\b\\.?)?|(?:${UNIT})\\b\\.?)\\s*`, 'i');

// "200 g bloem, gezeefd" -> { qty: '200 g', name: 'bloem', note: 'gezeefd' }
export function parseIngredient(line) {
  let t = String(line || '')
    .replace(/^[\s\-–•*·●▪◦>]+(?=\S)/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return null;
  let qty = null;
  const m = t.match(QTY_RE);
  if (m && m[1].trim() && t.length > m[0].length) {
    qty = m[1].trim().replace(/\s+/g, ' ');
    t = t.slice(m[0].length);
  }
  t = t.replace(/^(?:van\s+|de\s+|het\s+)/i, '');
  let note = null;
  const cut = t.search(/,|\s\((?!.*\))|\s\(/);
  if (cut > 0) {
    note = t.slice(cut).replace(/^[,\s(]+|[)\s]+$/g, '') || null;
    t = t.slice(0, cut);
  }
  const smaak = t.match(/\s+(naar smaak|optioneel|eventueel)\s*$/i);
  if (smaak) { note = note ? `${note}, ${smaak[1]}` : smaak[1]; t = t.slice(0, smaak.index); }
  const name = t.trim().replace(/[.;:]$/, '');
  if (!name || name.length > 60 || !/[a-zà-ÿ]{2}/i.test(name)) return null;
  return { qty, name: name.charAt(0).toLowerCase() + name.slice(1), note };
}

const ING_HEAD = /^(ingredi[eë]nten|ingredients|benodigdheden|wat heb je nodig|je hebt nodig|nodig|boodschappen)\b[^a-z]*$/i;
const STEP_HEAD = /^(bereiding(swijze)?|werkwijze|instructies|aan de slag|zo maak je het|zo maak je dit|stappen|methode|recept)\b[^a-z]*$/i;
const SERV_RE = /(?:voor\s+)?(\d{1,2})\s*(?:personen|persoon|pers\.?|porties|portie|eters)\b/i;
const NOISE = /^(\d+\s*(min(uten)?|u(ur)?|kcal|calorie[eë]n)\b|bereidingstijd|kooktijd|wachttijd|moeilijkheid|voedingswaarde|tip\b)/i;

function looksLikeIngredient(line) {
  if (line.length > 70) return false;
  if (/^[\-–•*·●▪◦]/.test(line)) return true;
  return QTY_RE.test(line) && !/^\d+[.)]\s/.test(line);
}

// Leest een recept uit vrije tekst (geplakt of van een foto) in.
export function parseRecipeText(text) {
  const lines = String(text || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/[|_~^`]+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((l) => l && (l.match(/[a-zà-ÿ]/gi) || []).length >= Math.min(3, l.length / 3));

  let servings = null;
  for (const l of lines) {
    const m = l.match(SERV_RE);
    if (m) { servings = Number(m[1]); break; }
  }

  const ingIdx = lines.findIndex((l) => ING_HEAD.test(l));
  const stepIdx = lines.findIndex((l) => STEP_HEAD.test(l));

  let title = null;
  const titleEnd = [ingIdx, stepIdx].filter((i) => i >= 0).reduce((a, b) => Math.min(a, b), lines.length);
  for (let i = 0; i < titleEnd; i++) {
    const l = lines[i];
    if (l.length >= 3 && l.length <= 80 && !SERV_RE.test(l) && !NOISE.test(l) && !looksLikeIngredient(l)) { title = l; break; }
  }

  let ingLines = [];
  let stepLines = [];
  if (ingIdx >= 0) {
    const end = stepIdx > ingIdx ? stepIdx : lines.length;
    ingLines = lines.slice(ingIdx + 1, end);
    if (stepIdx > ingIdx) stepLines = lines.slice(stepIdx + 1);
    else if (stepIdx >= 0) stepLines = lines.slice(stepIdx + 1, ingIdx);
    else {
      // Geen kop "bereiding": ingrediënten lopen tot de eerste lange zin.
      const k = ingLines.findIndex((l) => l.length > 70 || /^\d+[.)]\s/.test(l));
      if (k >= 0) { stepLines = ingLines.slice(k); ingLines = ingLines.slice(0, k); }
    }
  } else {
    for (const l of lines) {
      if (l === title || SERV_RE.test(l) && l.length < 30) continue;
      if (STEP_HEAD.test(l)) continue;
      if (looksLikeIngredient(l)) ingLines.push(l);
      else if (l.length > 25) stepLines.push(l);
    }
  }

  const ingredients = ingLines
    .filter((l) => !NOISE.test(l) && !SERV_RE.test(l))
    .map(parseIngredient)
    .filter(Boolean)
    // "zout en peper" zijn twee dingen.
    .flatMap((i) => (!i.qty && /^[a-zà-ÿ]+ en [a-zà-ÿ]+$/i.test(i.name) ? i.name.split(' en ').map((n) => ({ ...i, name: n })) : [i]));

  const steps = joinSteps(stepLines.filter((l) => !NOISE.test(l)));

  return { title: title ? tidyTitle(title) : null, servings, ingredients, steps };
}

function tidyTitle(t) {
  const s = t.replace(/[.:]+$/, '').trim();
  if (s === s.toUpperCase() && /[A-Z]/.test(s)) return s.charAt(0) + s.slice(1).toLowerCase();
  return s;
}

// Regels die bij elkaar horen weer samenvoegen tot stappen.
function joinSteps(lines) {
  const out = [];
  for (const l of lines) {
    const isNew = /^(\d+[.)]|stap\s*\d+|[\-–•*])\s*/i.test(l) || !out.length || /[.!:]$/.test(out[out.length - 1]);
    const clean = l.replace(/^(\d+[.)]|stap\s*\d+[:.]?|[\-–•*])\s*/i, '');
    if (isNew) out.push(clean);
    else out[out.length - 1] += ' ' + clean;
  }
  return out.join('\n');
}

export function ingredientLine(i) {
  return [i.qty, i.name].filter(Boolean).join(' ') + (i.note ? `, ${i.note}` : '');
}

// ───────────── Winkelrayons ─────────────

const AISLES = [
  ['Groenten & fruit', ['appel', 'peer', 'banaan', 'sinaasappel', 'appelsien', 'citroen', 'limoen', 'druif', 'aardbei', 'framboos', 'kiwi', 'mango', 'ananas', 'meloen', 'tomaat', 'komkommer', 'sla', 'spinazie', 'wortel', 'ui', 'sjalot', 'look', 'knoflook', 'prei', 'paprika', 'courgette', 'aubergine', 'broccoli', 'bloemkool', 'kool', 'spruit', 'champignon', 'paddenstoel', 'aardappel', 'patat', 'avocado', 'selder', 'venkel', 'radijs', 'peterselie', 'basilicum', 'bieslook', 'koriander', 'munt', 'tijm', 'rozemarijn', 'groente', 'fruit', 'erwt', 'boon', 'mais', 'gember', 'pompoen', 'witloof', 'asperge']],
  ['Brood & bakkerij', ['brood', 'stokbrood', 'baguette', 'pistolet', 'croissant', 'koffiekoek', 'wrap', 'beschuit', 'toast', 'cramique', 'sandwich']],
  ['Zuivel & eieren', ['melk', 'boter', 'kaas', 'yoghurt', 'room', 'slagroom', 'mascarpone', 'mozzarella', 'parmezaan', 'feta', 'ricotta', 'platte kaas', 'pudding', 'ei', 'karnemelk', 'skyr']],
  ['Vlees & vis', ['kip', 'kipfilet', 'gehakt', 'vlees', 'biefstuk', 'steak', 'varken', 'rund', 'lam', 'worst', 'spek', 'ham', 'salami', 'zalm', 'tonijn', 'vis', 'kabeljauw', 'garnaal', 'scampi', 'mosselen', 'burger', 'ribbetjes', 'kotelet', 'filet', 'saté']],
  ['Voorraadkast', ['pasta', 'spaghetti', 'macaroni', 'penne', 'lasagne', 'rijst', 'couscous', 'quinoa', 'bloem', 'meel', 'suiker', 'zout', 'peper', 'olie', 'azijn', 'saus', 'ketchup', 'mayonaise', 'mosterd', 'bouillon', 'kruiden', 'paprikapoeder', 'kaneel', 'curry', 'tomatenpuree', 'passata', 'blik', 'soep', 'honing', 'confituur', 'choco', 'hagelslag', 'muesli', 'granola', 'cornflakes', 'havermout', 'koffie', 'thee', 'cacao', 'noot', 'rozijn', 'chips', 'koek', 'chocolade', 'bakpoeder', 'gist', 'vanille', 'sojasaus', 'pesto']],
  ['Diepvries', ['diepvries', 'ijs', 'frieten', 'friet', 'kroket', 'pizza', 'vissticks', 'spinazie diepvries']],
  ['Drank', ['water', 'spuitwater', 'cola', 'limonade', 'fruitsap', 'sap', 'bier', 'wijn', 'cava', 'frisdrank', 'ice tea']],
  ['Huishouden & verzorging', ['wc-papier', 'toiletpapier', 'keukenrol', 'afwas', 'vaatwas', 'wasmiddel', 'wasverzachter', 'zeep', 'shampoo', 'tandpasta', 'tandenborstel', 'deo', 'luiers', 'doekjes', 'vuilniszak', 'afvalzak', 'batterij', 'aluminiumfolie', 'folie', 'zakje', 'kaars', 'lamp', 'spons']],
];

export const AISLE_ORDER = [...AISLES.map((a) => a[0]), 'Andere'];

export function aisle(name) {
  for (const [label, words] of AISLES) {
    if (words.some((w) => sameThing(name, w))) return label;
  }
  return 'Andere';
}

// ───────────── Weken ─────────────

export function mondayOf(iso) {
  const d = new Date(iso + 'T12:00:00');
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  return isoOf(d);
}

export function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return isoOf(d);
}

function isoOf(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function weekDays(monday) {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

// Twee maaltijden per dag. Oude rijen zonder 'slot' zijn avondeten.
export const SLOTS = ['middag', 'avond'];
export const SLOT_LABEL = { middag: "'s Middags", avond: "'s Avonds" };
export const slotOf = (m) => (m?.slot === 'middag' ? 'middag' : 'avond');
export const mealFor = (menu, date, slot) => menu.find((x) => x.date === date && slotOf(x) === slot) || null;
export const mealsOn = (menu, date) => SLOTS.map((s) => mealFor(menu, date, s)).filter(Boolean);

// Wat moet er gekocht worden voor alle recepten van deze week?
export function shoppingForWeek(days, menu, recipes, pantry, shopping) {
  const out = [];
  for (const date of days) {
    for (const m of menu.filter((x) => x.date === date)) {
    const r = m.recipe_id && recipes.find((x) => x.id === m.recipe_id);
    if (!r) continue;
    for (const ing of checkIngredients(r.ingredients || [], pantry, shopping)) {
      if (ing.state === 'heb' || ing.state === 'op-lijst') continue;
      const same = out.find((o) => sameThing(o.name, ing.name));
      if (same) { if (!same.sources.includes(r.title)) same.sources.push(r.title); continue; }
      out.push({ name: ing.name, qty: ing.qty, state: ing.state, sources: [r.title] });
    }
    }
  }
  return out;
}
