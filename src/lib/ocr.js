// Tekst van een foto lezen, op het toestel zelf (Tesseract). Gratis, geen account nodig.
// De eerste keer laadt de telefoon het leesprogramma en het Nederlandse taalpakket (samen ongeveer 7 MB)
// van onze eigen site; daarna zit het in de cache.

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve(img); setTimeout(() => URL.revokeObjectURL(url), 1000); };
    img.onerror = () => reject(new Error('Deze foto kan ik niet openen.'));
    img.src = url;
  });
}

function draw(img, max, filter) {
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  const ctx = c.getContext('2d');
  if (filter) ctx.filter = filter;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

// Klein fotootje om bij het recept te tonen.
export async function thumbnail(file) {
  const img = await loadImage(file);
  return draw(img, 360).toDataURL('image/jpeg', 0.72);
}

export async function readText(file, onProgress = () => {}) {
  const img = await loadImage(file);
  const canvas = draw(img, 2200, 'grayscale(1) contrast(1.35)');
  onProgress({ step: 'laden', pct: 0 });
  const { createWorker } = await import('tesseract.js');
  const base = new URL('ocr/', document.baseURI).href;
  const worker = await createWorker('nld', 1, {
    workerPath: base + 'worker.min.js',
    corePath: base,
    langPath: base,
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress({ step: 'lezen', pct: Math.round(m.progress * 100) });
      else if (/loading|initializ/.test(m.status)) onProgress({ step: 'laden', pct: Math.round((m.progress || 0) * 100) });
    },
  });
  try {
    const { data } = await worker.recognize(canvas);
    return data.text || '';
  } finally {
    await worker.terminate();
  }
}
