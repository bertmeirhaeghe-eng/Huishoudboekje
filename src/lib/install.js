// De app op het beginscherm zetten (installeren als app).
// Chrome en Edge op Android en computer geven een 'beforeinstallprompt'; die bewaren we
// zodat de knop in Meer het installatievenster kan openen. Safari (iPhone/iPad) kent dat
// niet: daar tonen we de stappen via de Deel-knop.

let deferred = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; notify(); });
  window.addEventListener('appinstalled', () => { deferred = null; notify(); });
}

export function isInstalled() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.matchMedia?.('(display-mode: fullscreen)').matches
    || window.navigator.standalone === true;
}

// iPhone en iPad (iPadOS meldt zich als Mac, maar heeft een aanraakscherm).
export function isApple(ua = navigator.userAgent, touch = navigator.maxTouchPoints || 0) {
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touch > 1);
}

export function canPrompt() { return !!deferred; }

export async function promptInstall() {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  e.prompt();
  const { outcome } = await e.userChoice.catch(() => ({}));
  notify();
  return outcome === 'accepted';
}

export function onInstallChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
