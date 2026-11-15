import { useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import { BasketIllustration } from './Illustrations.jsx';
import { AISLE_ORDER, aisle } from '../lib/kitchen.js';
import { splitItems } from '../lib/commands.js';

const PLACES = [
  { id: 'kast', name: 'Kast' },
  { id: 'koelkast', name: 'Koelkast' },
  { id: 'diepvries', name: 'Diepvries' },
  { id: 'andere', name: 'Andere' },
];
const STATUS = {
  ok: { label: 'Genoeg', next: 'bijna' },
  bijna: { label: 'Bijna op', next: 'op' },
  op: { label: 'Op', next: 'ok' },
};

export default function Lists({ home, tab, setTab, toast }) {
  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      <h1>{tab === 'voorraad' ? 'Voorraadkast' : 'Boodschappen'}</h1>
      <div className="seg" role="group" aria-label="Lijst">
        <button aria-pressed={tab !== 'voorraad'} onClick={() => setTab('boodschappen')}>Boodschappen{open(home) ? ` (${open(home)})` : ''}</button>
        <button aria-pressed={tab === 'voorraad'} onClick={() => setTab('voorraad')}>Voorraad</button>
      </div>
      {tab === 'voorraad' ? <Pantry home={home} toast={toast} /> : <Shopping home={home} toast={toast} />}
    </div>
  );
}

const open = (home) => home.shopping.filter((s) => !s.done).length;

function AddBar({ placeholder, onAdd, label }) {
  const [text, setText] = useState('');
  return (
    <form
      className="row"
      onSubmit={(e) => {
        e.preventDefault();
        const t = text.trim();
        if (!t) return;
        onAdd(t);
        setText('');
      }}
    >
      <input className="input grow" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={label} maxLength={200} enterKeyHint="done" />
      <button className="btn" disabled={!text.trim()} aria-label="Toevoegen" style={{ minHeight: 50, padding: '0 16px' }}><Icon name="plus" /></button>
    </form>
  );
}

function Shopping({ home, toast }) {
  const { shopping, act } = home;
  const todo = shopping.filter((s) => !s.done);
  const done = shopping.filter((s) => s.done);
  const groups = useMemo(() => {
    const g = new Map();
    for (const s of todo) {
      const a = aisle(s.name);
      if (!g.has(a)) g.set(a, []);
      g.get(a).push(s);
    }
    return AISLE_ORDER.filter((a) => g.has(a)).map((a) => [a, g.get(a)]);
  }, [todo]);

  async function add(text) {
    const items = splitItems(text);
    const n = await act.addShopping(items.length ? items : [{ name: text }]);
    if (!n) toast('Dat staat al op de lijst');
  }

  async function tick(item) {
    const p = await act.toggleShopping(item);
    if (p) toast(`${p.name} staat weer op "genoeg" in de voorraad`);
  }

  async function share() {
    const text = 'Boodschappen:\n' + todo.map((s) => `- ${s.qty ? s.qty + ' ' : ''}${s.name}`).join('\n');
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); toast('Lijst gekopieerd'); }
    } catch {}
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      <AddBar placeholder="bv. melk, 6 eieren en brood" label="Iets op de lijst zetten" onAdd={add} />
      {todo.length === 0 && (
        <div className="card empty">
          <BasketIllustration />
          <b>{done.length ? 'Alles gekocht, goed bezig!' : 'De lijst is leeg'}</b>
          <span className="small muted">Typ hierboven, of tik op de microfoon en zeg "melk en eieren op de lijst".</span>
        </div>
      )}
      <div className="stack stagger" style={{ gap: 12 }}>
        {groups.map(([name, items]) => (
          <div key={name} className="stack" style={{ gap: 6 }}>
            <span className="tiny bold muted" style={{ paddingLeft: 4 }}>{name}</span>
            <div className="card list">
              {items.map((s) => <ShopRow key={s.id} item={s} onTick={() => tick(s)} onDelete={() => act.deleteShopping(s.id)} />)}
            </div>
          </div>
        ))}
      </div>
      {todo.length > 0 && <button className="btn ghost" onClick={share}><Icon name="share" /> Lijst doorsturen</button>}
      {done.length > 0 && (
        <div className="stack" style={{ gap: 6 }}>
          <div className="spread">
            <span className="tiny bold muted" style={{ paddingLeft: 4 }}>In het karretje ({done.length})</span>
            <button className="tiny bold link" onClick={() => act.clearDone()}>Wis afgevinkt</button>
          </div>
          <div className="card list done-list">
            {done.map((s) => <ShopRow key={s.id} item={s} onTick={() => tick(s)} onDelete={() => act.deleteShopping(s.id)} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function ShopRow({ item, onTick, onDelete }) {
  return (
    <div className={'check-row' + (item.done ? ' done' : '')}>
      <button className="check" role="checkbox" aria-checked={item.done} onClick={onTick} aria-label={item.name}>
        <span className="box"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
        <span className="grow">
          <span className="name">{item.name}</span>
          {(item.qty || item.source) && <span className="tiny muted" style={{ display: 'block' }}>{[item.qty, item.source && `voor ${item.source}`].filter(Boolean).join(' · ')}</span>}
        </span>
      </button>
      <button className="icon-btn ghosted" onClick={onDelete} aria-label={`${item.name} verwijderen`}><Icon name="close" size={18} /></button>
    </div>
  );
}

function Pantry({ home, toast }) {
  const { pantry, act } = home;
  const [place, setPlace] = useState('kast');
  const [edit, setEdit] = useState(null);
  const low = pantry.filter((p) => p.status !== 'ok');

  async function add(text) {
    const items = splitItems(text);
    const n = await act.addPantry((items.length ? items : [{ name: text }]).map((i) => ({ name: i.name, place })));
    if (!n) toast('Dat staat al in de voorraad');
  }

  async function cycle(item) {
    const next = STATUS[item.status].next;
    const added = await act.setPantryStatus(item, next);
    if (added) toast(`${item.name} staat op de boodschappenlijst`);
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="seg small-seg" role="group" aria-label="Plaats">
        {PLACES.map((p) => <button key={p.id} aria-pressed={place === p.id} onClick={() => setPlace(p.id)}>{p.name}</button>)}
      </div>
      <AddBar placeholder={`Iets in de ${PLACES.find((p) => p.id === place).name.toLowerCase()} zetten`} label="Iets in de voorraad zetten" onAdd={add} />
      <div className="small muted">Tik op een product om aan te duiden of het bijna op of op is. Dan komt het vanzelf op de boodschappenlijst.</div>
      {low.length > 0 && <div className="notice">{low.length === 1 ? '1 product is' : `${low.length} producten zijn`} bijna op of op.</div>}
      {pantry.length === 0 && (
        <div className="card empty">
          <BasketIllustration />
          <b>Nog niets in de voorraad</b>
          <span className="small muted">Zet erin wat je meestal in huis hebt: pasta, rijst, melk, eieren… Dan zie je bij elk recept wat je nog moet kopen.</span>
        </div>
      )}
      <div className="stack stagger" style={{ gap: 12 }}>
        {PLACES.map((pl) => {
          const items = pantry.filter((p) => p.place === pl.id);
          if (!items.length) return null;
          return (
            <div key={pl.id} className="stack" style={{ gap: 6 }}>
              <span className="tiny bold muted" style={{ paddingLeft: 4 }}>{pl.name}</span>
              <div className="pantry">
                {items.map((p) => (
                  <button key={p.id} className={'pantry-item ' + p.status} onClick={() => cycle(p)} onContextMenu={(e) => { e.preventDefault(); setEdit(p); }} aria-label={`${p.name}: ${STATUS[p.status].label}. Tik om te wijzigen.`}>
                    <span className="dot" />
                    <span className="grow name">{p.name}</span>
                    <span className="state">{STATUS[p.status].label}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {pantry.length > 0 && <button className="btn ghost" onClick={() => setEdit('kies')}><Icon name="edit" /> Voorraad aanpassen of verwijderen</button>}
      {edit && <PantryEdit home={home} item={edit === 'kies' ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function PantryEdit({ home, item, onClose }) {
  const [pick, setPick] = useState(item);
  const [name, setName] = useState(item?.name || '');
  const [place, setPlace] = useState(item?.place || 'kast');
  const choose = (p) => { setPick(p); setName(p.name); setPlace(p.place); };
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Voorraad aanpassen" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85dvh', overflowY: 'auto' }}>
        <div className="spread">
          <h2>{pick ? pick.name : 'Wat wil je aanpassen?'}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Sluiten" style={{ background: 'var(--bg)' }}><Icon name="close" /></button>
        </div>
        {!pick ? (
          <div className="chips-wrap">
            {home.pantry.map((p) => <button key={p.id} className="pill" onClick={() => choose(p)}>{p.name}</button>)}
          </div>
        ) : (
          <>
            <label className="field">Naam<input className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></label>
            <div className="seg small-seg" role="group" aria-label="Plaats">
              {PLACES.map((p) => <button key={p.id} aria-pressed={place === p.id} onClick={() => setPlace(p.id)}>{p.name}</button>)}
            </div>
            <button className="btn" disabled={!name.trim()} onClick={async () => { await home.act.updatePantry(pick.id, { name: name.trim(), place }); onClose(); }}><Icon name="check" /> Bewaren</button>
            <button className="btn danger" onClick={async () => { await home.act.deletePantry(pick.id); onClose(); }}><Icon name="trash" /> Uit de voorraad halen</button>
          </>
        )}
      </div>
    </div>
  );
}
