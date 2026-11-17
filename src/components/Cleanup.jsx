import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import CatIcon from './CatIcon.jsx';
import { findDuplicates } from '../lib/dedupe.js';
import { dayLabel, money } from '../lib/format.js';
import { store } from '../lib/store.js';

const PAGE = 80;

// Dubbele boekingen opruimen. Eerst tonen, dan pas na een tweede bevestiging verwijderen.
export default function Cleanup({ household, onBack, onDone }) {
  const [groups, setGroups] = useState(null);
  const [on, setOn] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [show, setShow] = useState(PAGE);

  useEffect(() => {
    store.listEntries(household.id, '2000-01-01', '2099-12-31')
      .then((all) => {
        const g = findDuplicates(all);
        setGroups(g);
        setOn(Object.fromEntries(g.map((x) => [x.key, x.sure])));
      })
      .catch((e) => setError(e.message));
  }, [household.id]);

  const chosen = useMemo(() => (groups || []).filter((g) => on[g.key]), [groups, on]);
  const ids = chosen.flatMap((g) => g.remove.map((e) => e.id));
  const sum = chosen.reduce((a, g) => a + g.remove.length * g.keep[0].amount_cents * (g.keep[0].type === 'in' ? 1 : -1), 0);
  const unsure = (groups || []).filter((g) => !g.sure && !g.sameLoad).length;
  const same = (groups || []).filter((g) => g.sameLoad);
  const allSame = same.length > 0 && same.every((g) => on[g.key]);

  async function remove() {
    setBusy(true);
    setError('');
    try {
      await store.deleteEntries(ids);
      onDone(ids.length);
    } catch (e) {
      setError(e.message);
      setBusy(false);
      setConfirm(false);
    }
  }

  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <div className="row">
        <button className="icon-btn" onClick={onBack} aria-label="Terug"><Icon name="back" /></button>
        <h1>Dubbels opruimen</h1>
      </div>

      <span className="small muted">Twee boekingen met dezelfde dag, hetzelfde bedrag en dezelfde omschrijving in hetzelfde boekje, die op een ander moment in het boekje kwamen, tellen als dubbel. Eén ervan blijft altijd staan. Kwam iets twee keer binnen met één en dezelfde import, dan staat het hier ook, maar niet aangevinkt: dat kunnen echt twee koffies zijn.</span>

      {error && <div className="error">{error}</div>}
      {!groups && !error && <div className="card small muted">Alle boekingen nakijken…</div>}

      {groups && !groups.length && <div className="card small">Geen dubbels gevonden. Alles staat er maar één keer in.</div>}

      {groups && groups.length > 0 && (
        <>
          <section className="card stack" style={{ gap: 8 }}>
            <div className="spread small"><span>Gevonden dubbels</span><b>{groups.reduce((a, g) => a + g.remove.length, 0)}</b></div>
            <div className="spread small"><span>Aangevinkt om te verwijderen</span><b>{ids.length}</b></div>
            <div className="spread small muted"><span>Effect op je saldo in het boekje</span><span>{sum >= 0 ? '− ' : '+ '}{money(Math.abs(sum))}</span></div>
            {unsure > 0 && <span className="tiny muted">{unsure} zelf of met je stem ingegeven: die staan niet aangevinkt, kijk ze even na.</span>}
            {same.length > 0 && (
              <>
                <span className="tiny muted">{same.length === 1 ? '1 boeking kwam' : `${same.length} boekingen kwamen`} twee keer binnen met dezelfde import. Stond je bankbestand dubbel? Vink ze dan allemaal aan.</span>
                <button className="btn ghost" onClick={() => setOn((o) => ({ ...o, ...Object.fromEntries(same.map((g) => [g.key, !allSame])) }))}>
                  {allSame ? 'Die van dezelfde import weer uitvinken' : `Ook die ${same.length} van dezelfde import aanvinken`}
                </button>
              </>
            )}
          </section>

          <div className="card list">
            {groups.slice(0, show).map((g) => {
              const e = g.keep[0];
              const total = g.keep.length + g.remove.length;
              return (
                <div className="import-row" key={g.key}>
                  <button className="check" role="checkbox" aria-checked={!!on[g.key]} onClick={() => setOn((o) => ({ ...o, [g.key]: !o[g.key] }))} aria-label={e.note || e.category} style={{ flex: '0 0 auto', minHeight: 44, padding: 0 }}>
                    <span className="box"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                  </button>
                  <CatIcon id={e.category} size={18} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="spread" style={{ gap: 8 }}>
                      <span className="bold ellipsis">{e.note || 'Zonder omschrijving'}</span>
                      <span className={'amt' + (e.type === 'in' ? ' in' : '')}>{e.type === 'in' ? '+ ' : '− '}{money(e.amount_cents)}</span>
                    </div>
                    <span className="tiny muted">{dayLabel(e.date)}{e.book === 'zaak' ? ' · zaak' : ''} · staat er {total}×, {g.keep.length === 1 ? '1 blijft' : `${g.keep.length} blijven`}{g.sure ? '' : g.sameLoad ? ' · zelfde import, nakijken' : ' · zelf ingegeven, nakijken'}</span>
                  </div>
                </div>
              );
            })}
          </div>
          {groups.length > show && <button className="btn ghost" onClick={() => setShow((s) => s + PAGE)}>Toon meer ({groups.length - show})</button>}

          {!confirm ? (
            <button className="btn" disabled={!ids.length} onClick={() => setConfirm(true)} style={{ position: 'sticky', bottom: 'calc(var(--nav-h) + 12px + env(safe-area-inset-bottom))' }}>
              <Icon name="check" /> {ids.length} dubbels verwijderen
            </button>
          ) : (
            <section className="card stack" style={{ gap: 10, position: 'sticky', bottom: 'calc(var(--nav-h) + 12px + env(safe-area-inset-bottom))' }}>
              <b>{ids.length} boekingen definitief verwijderen?</b>
              <span className="small muted">Dit kan je niet ongedaan maken. Van elke dubbel blijft er één staan.</span>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn ghost grow" disabled={busy} onClick={() => setConfirm(false)}>Annuleren</button>
                <button className="btn grow" disabled={busy} onClick={remove}>{busy ? 'Verwijderen…' : 'Ja, verwijderen'}</button>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
