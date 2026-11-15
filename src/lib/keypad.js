// Logica van het cijferklavier bij Toevoegen.
export function pressKey(current, key) {
  if (key === '⌫') return current.length > 1 ? current.slice(0, -1) : '0';
  if (key === ',') return current.includes(',') ? current : current + ',';
  const [, dec] = current.split(',');
  if (dec !== undefined && dec.length >= 2) return current; // max 2 cijfers na de komma
  if (current.replace(',', '').length >= 8) return current;
  return current === '0' ? key : current + key;
}
