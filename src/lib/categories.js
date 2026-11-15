// Vaste categorieën per boekje (gezin of zaak) en soort (uitgave of inkomst).
// "icon" verwijst naar een icoon in components/Icon.jsx.

export const CATEGORIES = {
  gezin: {
    uit: [
      { id: 'boodschappen', tone: 'green', name: 'Boodschappen', icon: 'cart' },
      { id: 'auto', tone: 'blue', name: 'Auto & tanken', icon: 'car' },
      { id: 'wonen', tone: 'teal', name: 'Wonen & energie', icon: 'home' },
      { id: 'kinderen', tone: 'pink', name: 'Kinderen', icon: 'child' },
      { id: 'vrije_tijd', tone: 'purple', name: 'Vrije tijd', icon: 'ball' },
      { id: 'gezondheid', tone: 'red', name: 'Gezondheid', icon: 'heart' },
      { id: 'uit_eten', tone: 'orange', name: 'Uit eten', icon: 'fork' },
      { id: 'kleding', tone: 'pink', name: 'Kleding', icon: 'shirt' },
      { id: 'verzekering', tone: 'teal', name: 'Verzekering', icon: 'shield' },
      { id: 'abonnement', tone: 'purple', name: 'Abonnementen', icon: 'repeat' },
      { id: 'cadeaus', tone: 'yellow', name: 'Cadeaus', icon: 'gift' },
      { id: 'andere', tone: 'gray', name: 'Andere', icon: 'dots' },
    ],
    in: [
      { id: 'loon', tone: 'green', name: 'Loon', icon: 'wallet' },
      { id: 'groeipakket', tone: 'pink', name: 'Groeipakket', icon: 'child' },
      { id: 'terugbetaling', tone: 'teal', name: 'Terugbetaling', icon: 'repeat' },
      { id: 'andere_in', tone: 'gray', name: 'Andere', icon: 'dots' },
    ],
  },
  zaak: {
    uit: [
      { id: 'it_materiaal', tone: 'blue', name: 'IT-materiaal', icon: 'laptop' },
      { id: 'bbq_materiaal', tone: 'orange', name: 'BBQ-materiaal', icon: 'flame' },
      { id: 'ingredienten', tone: 'green', name: 'Ingrediënten', icon: 'cart' },
      { id: 'auto_zaak', tone: 'teal', name: 'Auto', icon: 'car' },
      { id: 'resto_klant', tone: 'yellow', name: 'Resto met klant', icon: 'fork' },
      { id: 'opleiding', tone: 'purple', name: 'Opleiding', icon: 'book' },
      { id: 'telefoon', tone: 'blue', name: 'Telefoon & internet', icon: 'phone' },
      { id: 'boekhouder', tone: 'gray', name: 'Boekhouder', icon: 'calc' },
      { id: 'loon_prive', tone: 'green', name: 'Loon naar privé', icon: 'wallet' },
      { id: 'andere_zaak', tone: 'gray', name: 'Andere', icon: 'dots' },
    ],
    in: [
      { id: 'factuur_it', tone: 'blue', name: 'Factuur IT', icon: 'laptop' },
      { id: 'workshop', tone: 'orange', name: 'BBQ-workshop', icon: 'flame' },
      { id: 'catering', tone: 'yellow', name: 'Catering', icon: 'fork' },
      { id: 'andere_zaak_in', tone: 'gray', name: 'Andere', icon: 'dots' },
    ],
  },
};

const index = {};
for (const book of Object.keys(CATEGORIES)) {
  for (const type of Object.keys(CATEGORIES[book])) {
    for (const c of CATEGORIES[book][type]) index[c.id] = { ...c, book, type };
  }
}

// Kleur per categorie: [lijnkleur, zachte achtergrond].
export const TONES = {
  green: ['#0B7A5E', '#DDF3EA'],
  blue: ['#2856A6', '#E3ECFA'],
  teal: ['#0E6E86', '#DDF1F6'],
  pink: ['#B32C68', '#FBE4EE'],
  purple: ['#6A3DBA', '#EEE7FB'],
  red: ['#B42318', '#FDE7E4'],
  orange: ['#C24E14', '#FDEADF'],
  yellow: ['#8A5D00', '#FAEFD2'],
  gray: ['#4B5563', '#ECEFF2'],
};

export function tone(id) {
  return TONES[category(id).tone] || TONES.gray;
}

export function category(id) {
  return index[id] || { id, name: id, icon: 'dots', tone: 'gray' };
}

export function categoriesFor(book, type) {
  return CATEGORIES[book]?.[type] || [];
}
