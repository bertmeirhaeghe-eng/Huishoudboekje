// Kleine voorkeuren die op dit toestel bewaard worden.

const EARLY_KEY = 'boekje-vroege-inkomsten';

// Hoeveel dagen voor het einde van de maand een inkomst al voor de volgende maand telt (0 = uit).
export function getEarlyDays() {
  try {
    const v = localStorage.getItem(EARLY_KEY);
    if (v != null && /^\d+$/.test(v)) return Math.min(10, Number(v));
  } catch {}
  return 3;
}

export function setEarlyDays(n) {
  try { localStorage.setItem(EARLY_KEY, String(n)); } catch {}
}
