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

// Dit toestel (bv. de tablet in de keuken) opent meteen het weekbord.
const BOARD_KEY = 'boekje-start-bord';
export function startsOnBoard() {
  if (typeof location !== 'undefined' && /(^#|[?&])bord\b/.test(location.hash + location.search)) return true;
  try { return localStorage.getItem(BOARD_KEY) === '1'; } catch { return false; }
}
export function setStartsOnBoard(on) { try { if (on) localStorage.setItem(BOARD_KEY, '1'); else localStorage.removeItem(BOARD_KEY); } catch {} }
