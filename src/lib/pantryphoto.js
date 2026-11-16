// Voorraad van een foto: de foto klaarmaken, en wat de AI (of het etiketten lezen) vond
// omzetten in een lijstje dat je kunt nakijken voor het in de voorraad gaat.
import { sameThing, findInPantry } from './kitchen.js';

const PLACES = ['kast', 'koelkast', 'diepvries', 'andere'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Foto verkleinen tot ongeveer 1500 pixels: scherp genoeg om etiketten te lezen, klein genoeg om snel te versturen.
export async function prepareImage(file, max = 1536) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Deze foto kan ik niet openen.'));
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL('image/jpeg', 0.85);
    return { data: dataUrl.split(',')[1], mediaType: 'image/jpeg' };
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

// Wat gevonden is -> nakijklijst. Dubbels eruit; wat al in de voorraad staat krijgt die naam en plaats.
export function reviewList(found, pantry, place = 'kast') {
  const out = [];
  for (const f of found || []) {
    const name = String(f?.name || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    if (name.length < 2 || out.some((o) => sameThing(o.name, name))) continue;
    const have = findInPantry(name, pantry);
    const status = f.status === 'bijna' ? 'bijna' : 'ok';
    out.push({
      key: out.length,
      name: have ? have.name : cap(name),
      place: have ? have.place : PLACES.includes(f.place) ? f.place : place,
      status,
      existing: have || null,
      // Staat het er al en verandert er niets, dan hoeft er niets te gebeuren.
      keep: !have || have.status !== status,
    });
  }
  return out;
}

// Zonder AI: etiketten lezen en de woorden vergelijken met gewone producten en met wat al in de voorraad staat.
const PRODUCTS = ('pasta,spaghetti,macaroni,penne,tagliatelle,lasagnebladen,rijst,basmatirijst,couscous,quinoa,bulgur,noedels,bloem,suiker,' +
  'bruine suiker,zout,peper,paprikapoeder,kerrie,oregano,basilicum,tijm,kaneel,nootmuskaat,bouillon,olijfolie,zonnebloemolie,azijn,' +
  'mosterd,mayonaise,ketchup,sojasaus,tomatensaus,passata,tomatenpuree,tomatenblokjes,pesto,honing,confituur,choco,pindakaas,' +
  'hagelslag,koffie,thee,cacao,cornflakes,muesli,havermout,granola,beschuiten,crackers,koekjes,chips,chocolade,noten,amandelen,' +
  'rozijnen,kikkererwten,linzen,kidneybonen,witte bonen,erwten,mais,tonijn,sardienen,soep,melk,yoghurt,platte kaas,kaas,boter,' +
  'margarine,room,slagroom,eieren,ham,kip,gehakt,worst,spek,zalm,appelsap,sinaasappelsap,bruiswater,cola,limonade,bier,wijn,brood,' +
  'wraps,tortilla,aardappelen,uien,knoflook,wortelen,tomaten,komkommer,sla,paprika,courgette,appels,bananen,citroen,spinazie,' +
  'frieten,pizza,ijs,vissticks,bakpoeder,vanillesuiker,gist,rijstwafels,wc-papier,keukenrol,afwasmiddel,vaatwastabletten,' +
  'wasmiddel,tandpasta,shampoo,zeep,vuilniszakken,aluminiumfolie').split(',');

export function guessFromLabels(text, pantry) {
  const t = ' ' + String(text || '').toLowerCase().replace(/[^a-zà-ÿ\s-]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
  const words = t.trim().split(' ').filter((w) => w.length >= 3);
  // Langste namen eerst, zodat "bruine suiker" vóór "suiker" komt.
  const names = [...pantry.map((p) => p.name), ...PRODUCTS].sort((a, b) => b.length - a.length);
  const seen = [];
  for (const n of names) {
    const low = n.toLowerCase();
    const hit = low.includes(' ') ? t.includes(` ${low} `) : words.some((w) => w === low || (w.length >= 4 && low.length >= 4 && sameThing(w, low)));
    if (hit && !seen.some((s) => sameThing(s, n))) seen.push(n);
  }
  return seen.map((name) => ({ name, status: 'ok' }));
}
