// Foto's voor de ruststand van het weekbord, uit gedeelde Google Foto's-albums.
// De database haalt de lijst op (de browser mag dat niet rechtstreeks bij Google).
import { useEffect, useState } from 'react';
import { store } from './store.js';
import { sizedPhoto } from './board.js';

const CACHE_KEY = 'boekje-fotos';
const MAX_AGE = 6 * 3600000;

let memo = null; // { list, at }

export function forgetPhotos() {
  memo = null;
  try { localStorage.removeItem(CACHE_KEY); } catch {}
}

async function loadList() {
  if (memo && Date.now() - memo.at < MAX_AGE) return memo.list;
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (c && Array.isArray(c.list) && Date.now() - c.at < MAX_AGE) { memo = c; return c.list; }
  } catch {}
  const list = (await store.albumPhotos()) || [];
  memo = { list, at: Date.now() };
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(memo)); } catch {}
  return list;
}

export function usePhotos() {
  const [photos, setPhotos] = useState([]);
  useEffect(() => {
    let alive = true;
    const run = () => loadList().then((list) => {
      if (!alive) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = window.screen.width * dpr;
      const h = window.screen.height * dpr;
      const side = Math.max(w, h);
      setPhotos(list.map((u) => (/googleusercontent\.com/.test(u) ? sizedPhoto(u, side, side) : u)));
    }).catch(() => {});
    run();
    const t = setInterval(run, MAX_AGE);
    return () => { alive = false; clearInterval(t); };
  }, []);
  return photos;
}
