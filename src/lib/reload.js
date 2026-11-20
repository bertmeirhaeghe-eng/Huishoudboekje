// Na een update staan de stukjes van de vorige versie niet meer online. Had je de app nog open,
// dan lukt het openen van een scherm (bv. de voorraadfoto) niet meer. Dan laden we de app één keer opnieuw.
const KEY = 'boekje-herladen';

export function isChunkError(err) {
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload|Loading chunk .* failed/i.test(String(err?.message || err || ''));
}

// Geeft true als de app nu herlaadt. Maximaal één keer per 30 seconden, zodat het nooit blijft herladen.
export function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 30000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
