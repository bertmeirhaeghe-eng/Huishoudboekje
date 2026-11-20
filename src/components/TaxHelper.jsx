import { useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { QUICK, adviseFor, estimate, fromAi } from '../lib/advice.js';
import { store } from '../lib/store.js';
import { money, parseAmount } from '../lib/format.js';

const VERDICT = {
  zaak: { label: 'Meestal op de zaak', cls: 'zaak' },
  deels: { label: 'Deels op de zaak', cls: 'deels' },
  prive: { label: 'Privé', cls: 'prive' },
  twijfel: { label: 'Hangt ervan af', cls: 'twijfel' },
};

export default function TaxHelper({ onBack, onBook }) {
  const [q, setQ] = useState('');
  const [amount, setAmount] = useState('');
  const [asked, setAsked] = useState('');
  // Antwoord van de AI: { q, status: 'laden' | 'ok' | 'mis', topic, reden }
  const [ai, setAi] = useState(null);
  const cache = useRef(new Map());
  const latest = useRef('');

  const ask = (text) => {
    const x = text.trim();
    if (!x) return;
    setAsked(x);
    latest.current = x;
    const key = x.toLowerCase();
    if (cache.current.has(key)) { setAi({ q: x, ...cache.current.get(key) }); return; }
    setAi({ q: x, status: 'laden' });
    store.adviseAI(x)
      .then((raw) => {
        const t = fromAi(raw);
        const r = t ? { status: 'ok', topic: t } : { status: 'mis', reden: 'De AI gaf geen bruikbaar antwoord.' };
        cache.current.set(key, r);
        return r;
      })
      .catch((e) => ({ status: 'mis', reden: e?.reden || e?.message || '' }))
      .then((r) => { if (latest.current === x) setAi({ q: x, ...r }); });
  };

  const loading = ai?.q === asked && ai.status === 'laden';
  const topic = !asked || loading ? null : ai?.q === asked && ai.status === 'ok' ? ai.topic : adviseFor(asked);
  const fallback = Boolean(topic && !topic.ai && ai?.q === asked && ai.status === 'mis');
  const cents = parseAmount(amount);
  const est = topic && cents ? estimate(topic, cents) : null;
  const v = topic && VERDICT[topic.verdict];

  return (
    <div className="stack" style={{ maxWidth: 640 }}>
      <div className="row">
        <button className="icon-btn" onClick={onBack} aria-label="Terug"><Icon name="back" /></button>
        <h1>Privé of zaak?</h1>
      </div>
      <span className="small muted">Twijfel je of je een aankoop beter via de vennootschap doet? Typ wat je wil kopen.</span>
      <form className="row" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
        <input className="input grow" value={q} maxLength={120} placeholder="bv. nieuwe laptop" onChange={(e) => setQ(e.target.value)} aria-label="Wat wil je kopen?" />
        <button className="btn blue" disabled={!q.trim() || loading} style={{ minHeight: 50 }}>Check</button>
      </form>
      <div className="chips-wrap">
        {QUICK.map((x) => <button key={x} className="pill" aria-pressed={asked === x} disabled={loading} onClick={() => { setQ(x); ask(x); }}>{x}</button>)}
      </div>

      {loading && (
        <section className="card stack advice thinking" aria-live="polite" style={{ gap: 10 }}>
          <span className="verdict">Even nadenken…</span>
          <span className="small muted">De AI bekijkt of “{asked}” privé of zaak is.</span>
          <div className="think-bar" />
        </section>
      )}

      {topic && (
        <section className={'card stack advice ' + v.cls} key={asked} style={{ gap: 12 }}>
          <div className="spread">
            <span className="verdict">{v.label}</span>
            {topic.pct != null && <span className="pct">{topic.pct}% aftrekbaar</span>}
          </div>
          {topic.ai && <span className="tiny muted ai-tag">✨ Antwoord van de AI ({topic.bron})</span>}
          {fallback && <span className="tiny muted">AI niet beschikbaar{ai.reden ? ` (${ai.reden.charAt(0).toLowerCase()}${ai.reden.slice(1).replace(/\.$/, '')})` : ''}. Dit zijn de vaste vuistregels.</span>}
          <h2>{topic.title}</h2>
          <p className="small" style={{ margin: 0, lineHeight: 1.5 }}>{topic.why}</p>
          {topic.tips.length > 0 && <ul className="tips">{topic.tips.map((t) => <li key={t}>{t}</li>)}</ul>}
          {topic.btw != null && topic.verdict !== 'prive' && (
            <span className="tiny muted">Btw terugvragen: {topic.btw ? 'ja, als je vennootschap btw-plichtig is' : 'nee'}.</span>
          )}

          {topic.pct != null && topic.verdict !== 'prive' && (
            <div className="stack" style={{ gap: 8 }}>
              <label className="field">Wat kost het ongeveer (met btw)?
                <input className="input" inputMode="decimal" value={amount} placeholder="bv. 1200" onChange={(e) => setAmount(e.target.value)} />
              </label>
              {est && (
                <div className="calc">
                  {est.vatBack > 0 && <div className="spread small"><span>Btw terug</span><b>{money(est.vatBack)}</b></div>}
                  <div className="spread small"><span>Aftrekbaar als kost</span><b>{money(est.deductible)}</b></div>
                  <div className="spread small"><span>Minder vennootschapsbelasting</span><b>{money(est.taxLow)} tot {money(est.taxHigh)}</b></div>
                  <div className="spread small bold" style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}><span>Kost je zaak ongeveer</span><span>{money(est.netCost)}</span></div>
                  <span className="tiny muted">Ruwe schatting met 21% btw en een belastingtarief van 20% tot 25%.</span>
                </div>
              )}
            </div>
          )}

          <div className="row">
            {topic.verdict !== 'prive' && <button className="btn blue grow" onClick={() => onBook({ book: 'zaak', category: topic.cat, amount_cents: cents || 0, note: asked })}><Icon name="briefcase" /> Boek op de zaak</button>}
            <button className="btn ghost grow" onClick={() => onBook({ book: 'gezin', category: null, amount_cents: cents || 0, note: asked })}><Icon name="home" /> Boek privé</button>
          </div>
        </section>
      )}

      <div className="notice">Dit zijn vuistregels en inschattingen (ook die van de AI), geen fiscaal advies. Regels veranderen, zeker voor wagens. Vraag het bij grote aankopen eerst aan je boekhouder, en zorg altijd voor een factuur op naam van de vennootschap met het btw-nummer.</div>
    </div>
  );
}
