// Privé of vennootschap? Vuistregels voor een Belgische vennootschap (IT-consultancy en catering/BBQ-workshops).
// Indicatief, geen fiscaal advies: de boekhouder heeft altijd het laatste woord.

// verdict: zaak | deels | prive | twijfel
// pct: aftrekbaar deel als beroepskost; btw: btw terug te vorderen (als de vennootschap btw-plichtig is)
export const TOPICS = [
  {
    id: 'werkkledij', words: ['koksvest', 'koksbuis', 'schort', 'werkkledij', 'werkkleding', 'werkschoenen', 'veiligheidsschoenen', 'kledij met logo', 'kleding met logo'],
    verdict: 'zaak', pct: 100, btw: true, cat: 'bbq_materiaal', title: 'Werkkledij',
    why: 'Echte werkkledij die je enkel voor je werk draagt (koksvest, schort, veiligheidsschoenen) is een beroepskost.',
    tips: ['Liefst met het logo van de zaak erop.', 'Gewone kleding die je ook privé kan dragen, telt niet.'],
  },
  {
    id: 'it', words: ['laptop', 'computer', 'pc', 'macbook', 'scherm', 'monitor', 'tablet', 'ipad', 'printer', 'toetsenbord', 'muis', 'software', 'licentie', 'abonnement software', 'hosting', 'server', 'domeinnaam', 'cloud', 'harde schijf', 'headset', 'webcam', 'docking'],
    verdict: 'zaak', pct: 100, btw: true, cat: 'it_materiaal', title: 'IT-materiaal en software',
    why: 'Voor je IT-consultancy is dit gewoon werkmateriaal: volledig aftrekbaar.',
    tips: ['Duurdere toestellen schrijf je meestal af over 3 jaar, je boekhouder regelt dat.', 'Gebruik je de laptop ook privé, dan telt de fiscus een klein voordeel alle aard (forfait, ongeveer € 72 per jaar).'],
  },
  {
    id: 'gsm', words: ['gsm', 'smartphone', 'iphone', 'telefoon', 'gsm-abonnement', 'telefoonabonnement', 'internet', 'internetabonnement', 'proximus', 'telenet', 'orange', 'mobile vikings', 'wifi'],
    verdict: 'zaak', pct: 100, btw: true, cat: 'telefoon', title: 'Telefoon en internet',
    why: 'De vennootschap mag je gsm en internet betalen. Voor het privégebruik telt een vast voordeel alle aard.',
    tips: ['Forfaits per jaar: smartphone ongeveer € 36, abonnement € 48, internet thuis € 60.', 'Zet het abonnement op naam van de vennootschap.'],
  },
  {
    id: 'bbq', words: ['bbq', 'barbecue', 'grill', 'smoker', 'kamado', 'houtskool', 'briketten', 'rooster', 'pannen', 'messen', 'keukenmateriaal', 'chafing dish', 'koelbox', 'partytent', 'gasbrander'],
    verdict: 'zaak', pct: 100, btw: true, cat: 'bbq_materiaal', title: 'BBQ- en cateringmateriaal',
    why: 'Materiaal voor je workshops en catering is een beroepskost.',
    tips: ['Een BBQ die vooral thuis in de tuin staat, is privé. De fiscus kijkt kritisch naar dubbel gebruik.', 'Houd bij voor welke workshops je het gebruikt.'],
  },
  {
    id: 'ingredienten', words: ['ingrediënten', 'ingredienten', 'vlees voor workshop', 'groothandel', 'makro', 'hanos', 'bidfood', 'voor de workshop', 'voor een workshop', 'voor catering'],
    verdict: 'zaak', pct: 100, btw: true, cat: 'ingredienten', title: 'Ingrediënten voor workshops en catering',
    why: 'Wat je aankoopt om te verwerken voor klanten, is een beroepskost.',
    tips: ['Boodschappen voor het gezin horen privé, ook als je ze in dezelfde winkel koopt: vraag aparte kasbonnen.'],
  },
  {
    id: 'resto', words: ['restaurant met', 'resto met', 'etentje met klant', 'zakenlunch', 'zakendiner', 'lunch met klant', 'diner met klant', 'met een klant', 'met klant'],
    verdict: 'deels', pct: 69, btw: false, cat: 'resto_klant', title: 'Restaurant met een klant',
    why: 'Restaurantkosten met klanten of leveranciers zijn voor 69% aftrekbaar. De btw krijg je niet terug.',
    tips: ['Noteer met wie en waarom je ging eten.', 'Alleen of met het gezin uit eten is privé.'],
  },
  {
    id: 'geschenken', words: ['relatiegeschenk', 'geschenk voor klant', 'cadeau voor klant', 'kerstpakket', 'receptie', 'nieuwjaarsreceptie', 'bloemen voor klant', 'fles wijn voor klant'],
    verdict: 'deels', pct: 50, btw: false, cat: 'andere_zaak', title: 'Relatiegeschenken en recepties',
    why: 'Geschenken voor klanten en receptiekosten zijn voor 50% aftrekbaar.',
    tips: ['Btw terugvragen kan enkel voor kleine geschenken tot € 50 (zonder btw) per stuk.', 'Geschenken met je logo zijn vaak 100% aftrekbaar als reclame.'],
  },
  {
    id: 'auto', words: ['auto', 'wagen', 'bedrijfswagen', 'leasing', 'tanken', 'brandstof', 'diesel', 'benzine', 'laadpaal', 'opladen', 'onderhoud auto', 'banden', 'parking', 'autoverzekering'],
    verdict: 'deels', pct: null, btw: true, cat: 'auto_zaak', title: 'Auto en tanken',
    why: 'Hangt sterk af van de wagen en van wanneer je hem bestelde. Volledig elektrische wagens zijn voorlopig het gunstigst. Voor benzine- en dieselwagens daalt de aftrek naar nul.',
    tips: ['Rijd je er ook privé mee, dan betaal je een voordeel alle aard.', 'Btw op een wagen is meestal maar voor een deel terug te vorderen (vaak 50%).', 'Laat dit zeker vooraf berekenen door je boekhouder.'],
  },
  {
    id: 'fiets', words: ['fiets', 'elektrische fiets', 'speedpedelec', 'bedrijfsfiets'],
    verdict: 'zaak', pct: 100, btw: true, cat: 'andere_zaak', title: 'Fiets',
    why: 'Een fiets van de zaak is fiscaal gunstig: hij is aftrekbaar, en woon-werkverkeer ermee geeft geen voordeel alle aard.',
    tips: ['Vraag je boekhouder hoe het zit met privéritten in het weekend.'],
  },
  {
    id: 'opleiding', words: ['opleiding', 'cursus', 'training', 'certificaat', 'certificering', 'seminarie', 'congres', 'vakbeurs', 'vakboek', 'vakblad', 'webinar', 'udemy', 'workshop volgen'],
    verdict: 'zaak', pct: 100, btw: true, cat: 'opleiding', title: 'Opleiding',
    why: 'Opleidingen die bij je IT- of cateringwerk passen, zijn volledig aftrekbaar.',
    tips: ['Een hobbycursus zonder link met je werk is privé.'],
  },
  {
    id: 'bureau', words: ['bureau', 'bureaustoel', 'thuiskantoor', 'kantoor thuis', 'werkplek', 'bureaulamp', 'boekenkast voor kantoor'],
    verdict: 'zaak', pct: 100, btw: true, cat: 'it_materiaal', title: 'Bureau en thuiskantoor',
    why: 'Meubels voor je werkplek mag de zaak betalen.',
    tips: ['Werk je thuis, dan kan de vennootschap een deel van je woning huren of een vaste onkostenvergoeding geven. Leg dat schriftelijk vast en laat je boekhouder het bedrag bepalen.'],
  },
  {
    id: 'boekhouder', words: ['boekhouder', 'accountant', 'boekhoudsoftware', 'notaris', 'advocaat', 'ondernemingsloket', 'sociaal verzekeringsfonds', 'bankkosten zaak', 'bankrekening zaak'],
    verdict: 'zaak', pct: 100, btw: true, cat: 'boekhouder', title: 'Boekhouder en administratie',
    why: 'Kosten om je zaak te runnen zijn volledig aftrekbaar.',
    tips: [],
  },
  {
    id: 'verzekering_zaak', words: ['beroepsaansprakelijkheid', 'ba uitbating', 'verzekering zaak', 'verzekering materiaal', 'gewaarborgd inkomen'],
    verdict: 'zaak', pct: 100, btw: false, cat: 'andere_zaak', title: 'Beroepsverzekeringen',
    why: 'Verzekeringen voor je activiteit zijn een beroepskost.',
    tips: ['Een hospitalisatieverzekering via de vennootschap kan ook, bespreek het met je boekhouder.'],
  },
  {
    id: 'reclame', words: ['website', 'logo', 'reclame', 'publiciteit', 'flyers', 'visitekaartjes', 'advertentie', 'facebook advertentie', 'google ads', 'beachflag'],
    verdict: 'zaak', pct: 100, btw: true, cat: 'andere_zaak', title: 'Reclame en website',
    why: 'Publiciteit voor je zaak is volledig aftrekbaar.',
    tips: [],
  },
  {
    id: 'kledij', words: ['kleren', 'kleding', 'kledij', 'jeans', 'broek', 'trui', 'hemd', 'kostuum', 'pak', 'jas', 'schoenen', 'kleedje', 'jurk', 't-shirt'],
    verdict: 'prive', pct: 0, btw: false, cat: 'kleding', title: 'Gewone kleding',
    why: 'Gewone kleding is privé, ook als je ze vooral voor je werk draagt.',
    tips: ['Uitzondering: echte werkkledij zoals een koksvest of schort.'],
  },
  {
    id: 'prive', words: ['vakantie', 'reis', 'citytrip', 'uitstap', 'pretpark', 'fitness', 'sport', 'zwembad', 'kapper', 'speelgoed', 'school', 'boodschappen', 'supermarkt', 'meubel', 'zetel', 'tv', 'televisie', 'netflix', 'spotify', 'disney', 'tuin', 'verbouwing', 'keuken thuis', 'huishoudtoestel', 'wasmachine'],
    verdict: 'prive', pct: 0, btw: false, cat: 'andere', title: 'Privé-uitgave',
    why: 'Dit dient je gezin of je vrije tijd, niet je zaak. Laat je dit toch door de zaak betalen, dan wordt het belast als voordeel.',
    tips: [],
  },
];

const GENERIC = {
  id: 'algemeen', verdict: 'twijfel', pct: null, btw: null, cat: 'andere_zaak', title: 'Geen vaste regel',
  why: 'Een kost hoort bij de zaak als je hem maakt om inkomsten te verdienen, en als je dat kan aantonen met een factuur op naam van de vennootschap.',
  tips: ['Gebruik je het deels privé? Dan is meestal alleen het beroepsdeel aftrekbaar.', 'Twijfel je bij een grote aankoop? Vraag het vooraf aan je boekhouder.'],
};

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function adviseFor(text) {
  const t = ' ' + norm(text).replace(/[^a-z0-9-]+/g, ' ') + ' ';
  if (!t.trim()) return null;
  let best = null;
  for (const topic of TOPICS) {
    for (const w of topic.words) {
      const nw = norm(w);
      if (t.includes(' ' + nw + ' ') || t.includes(' ' + nw + 's ') || t.includes(' ' + nw + 'en ')) {
        // Langere trefwoorden zijn specifieker: "restaurant met" wint van "restaurant".
        if (!best || nw.length > best.len) best = { topic, len: nw.length };
      }
    }
  }
  return best ? best.topic : GENERIC;
}

// Wat levert het ongeveer op? Bedrag in centen, inclusief 21% btw.
export function estimate(topic, cents) {
  if (!topic || !cents || topic.pct == null) return null;
  const vatRate = 0.21;
  const excl = Math.round(cents / (1 + vatRate));
  const vatBack = topic.btw ? cents - excl : 0;
  const base = topic.btw ? excl : cents;
  const deductible = Math.round(base * (topic.pct / 100));
  return {
    vatBack,
    deductible,
    taxLow: Math.round(deductible * 0.2), // verlaagd tarief kmo
    taxHigh: Math.round(deductible * 0.25), // gewoon tarief
    netCost: cents - vatBack - Math.round(deductible * 0.2),
  };
}

export const QUICK = ['Laptop', 'Gsm-abonnement', 'Houtskool', 'Restaurant met klant', 'Opleiding', 'Koksvest', 'Auto', 'Kleding', 'Bureaustoel', 'Relatiegeschenk'];
