import CatIcon from './CatIcon.jsx';
import Icon from './Icon.jsx';
import { category, tone } from '../lib/categories.js';
import { money } from '../lib/format.js';

// Uitgaven per categorie: één gekleurde balk (het geheel) en daaronder elke categorie met haar deel.
// Met onPick wordt een rij aantikbaar (bv. om de boekingen te filteren).
export default function CategorySplit({ totals, total, picked, onPick, compare, emptyText = 'Nog geen uitgaven.' }) {
  if (!totals.length) return <div className="card small muted">{emptyText}</div>;
  const max = totals[0][1] || 1;
  // De balk: de 5 grootste, de rest samen in grijs.
  const head = totals.slice(0, 5);
  const rest = totals.slice(5).reduce((a, [, v]) => a + v, 0);
  return (
    <div className="card stack cat-split" style={{ gap: 14 }}>
      <div className="split-bar" role="img" aria-label={totals.map(([id, v]) => `${category(id).name} ${Math.round((v / total) * 100)}%`).join(', ')}>
        {head.map(([id, v], i) => (
          <span key={id} title={`${category(id).name}: ${money(v)}`} style={{ flexGrow: v, background: tone(id)[0], animationDelay: `${i * 0.05}s` }} />
        ))}
        {rest > 0 && <span title={`Overige: ${money(rest)}`} style={{ flexGrow: rest, background: '#AEB6BF' }} />}
      </div>
      <div className="stack stagger" style={{ gap: 4 }}>
        {totals.map(([id, v]) => {
          const share = total ? Math.round((v / total) * 100) : 0;
          const on = picked === id;
          const delta = compare?.[id];
          const Row = onPick ? 'button' : 'div';
          return (
            <Row key={id} className={'cat-row' + (on ? ' on' : '') + (onPick ? ' tap' : '')} {...(onPick ? { onClick: () => onPick(on ? null : id), 'aria-pressed': on } : {})}>
              <CatIcon id={id} size={18} />
              <span className="grow" style={{ minWidth: 0 }}>
                <span className="spread small" style={{ marginBottom: 6 }}>
                  <span className="bold ellipsis">{category(id).name}</span>
                  <span><b>{money(v, { round: v >= 100000 })}</b> <span className="muted">· {share}%</span></span>
                </span>
                <span className="meter thin"><span style={{ width: `${Math.max(2, Math.round((v / max) * 100))}%`, background: tone(id)[0] }} /></span>
                {delta && (
                  <span className={'tiny delta ' + (delta.up ? 'up' : 'down')}>
                    <Icon name={delta.up ? 'up' : 'down'} size={12} stroke={2.6} /> {delta.text}
                  </span>
                )}
              </span>
            </Row>
          );
        })}
      </div>
    </div>
  );
}
