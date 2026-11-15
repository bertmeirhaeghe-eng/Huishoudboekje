import Icon from './Icon.jsx';
import { category, TONES } from '../lib/categories.js';

// Gekleurd icoontje per categorie; gevuld als het geselecteerd is.
export default function CatIcon({ id, selected = false, size = 22 }) {
  const c = category(id);
  const [fg, bg] = TONES[c.tone] || TONES.gray;
  return (
    <span className={'cat-ico' + (selected ? ' sel' : '')} style={{ background: selected ? fg : bg, color: selected ? '#fff' : fg }}>
      <Icon name={c.icon} size={size} />
    </span>
  );
}
