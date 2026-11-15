// Vaste categorieën per boekje (gezin of zaak) en soort (uitgave of inkomst).
// "icon" verwijst naar een icoon in components/Icon.jsx.

export const CATEGORIES = {
  gezin: {
    uit: [
      { id: 'boodschappen', name: 'Boodschappen', icon: 'cart' },
      { id: 'auto', name: 'Auto & tanken', icon: 'car' },
      { id: 'wonen', name: 'Wonen & energie', icon: 'home' },
      { id: 'kinderen', name: 'Kinderen', icon: 'child' },
      { id: 'vrije_tijd', name: 'Vrije tijd', icon: 'ball' },
      { id: 'gezondheid', name: 'Gezondheid', icon: 'heart' },
      { id: 'uit_eten', name: 'Uit eten', icon: 'fork' },
      { id: 'kleding', name: 'Kleding', icon: 'shirt' },
      { id: 'verzekering', name: 'Verzekering', icon: 'shield' },
      { id: 'abonnement', name: 'Abonnementen', icon: 'repeat' },
      { id: 'cadeaus', name: 'Cadeaus', icon: 'gift' },
      { id: 'andere', name: 'Andere', icon: 'dots' },
    ],
    in: [
      { id: 'loon', name: 'Loon', icon: 'wallet' },
      { id: 'groeipakket', name: 'Groeipakket', icon: 'child' },
      { id: 'terugbetaling', name: 'Terugbetaling', icon: 'repeat' },
      { id: 'andere_in', name: 'Andere', icon: 'dots' },
    ],
  },
  zaak: {
    uit: [
      { id: 'it_materiaal', name: 'IT-materiaal', icon: 'laptop' },
      { id: 'bbq_materiaal', name: 'BBQ-materiaal', icon: 'flame' },
      { id: 'ingredienten', name: 'Ingrediënten', icon: 'cart' },
      { id: 'auto_zaak', name: 'Auto', icon: 'car' },
      { id: 'resto_klant', name: 'Resto met klant', icon: 'fork' },
      { id: 'opleiding', name: 'Opleiding', icon: 'book' },
      { id: 'telefoon', name: 'Telefoon & internet', icon: 'phone' },
      { id: 'boekhouder', name: 'Boekhouder', icon: 'calc' },
      { id: 'loon_prive', name: 'Loon naar privé', icon: 'wallet' },
      { id: 'andere_zaak', name: 'Andere', icon: 'dots' },
    ],
    in: [
      { id: 'factuur_it', name: 'Factuur IT', icon: 'laptop' },
      { id: 'workshop', name: 'BBQ-workshop', icon: 'flame' },
      { id: 'catering', name: 'Catering', icon: 'fork' },
      { id: 'andere_zaak_in', name: 'Andere', icon: 'dots' },
    ],
  },
};

const index = {};
for (const book of Object.keys(CATEGORIES)) {
  for (const type of Object.keys(CATEGORIES[book])) {
    for (const c of CATEGORIES[book][type]) index[c.id] = { ...c, book, type };
  }
}

export function category(id) {
  return index[id] || { id, name: id, icon: 'dots' };
}

export function categoriesFor(book, type) {
  return CATEGORIES[book]?.[type] || [];
}
