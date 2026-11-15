import { useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { PotIllustration } from './Illustrations.jsx';
import { addDays, checkIngredients, ingredientLine, mondayOf, parseIngredient, parseRecipeText, shoppingForWeek, weekDays } from '../lib/kitchen.js';
import { todayISO } from '../lib/format.js';

const DAY = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const DAY_LONG = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
const MON = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const d = (iso) => new Date(iso + 'T12:00:00');
const short = (iso) => `${d(iso).getDate()} ${MON[d(iso).getMonth()]}`;

export default function Kitchen({ home, tab, setTab, toast, openRecipe, setOpenRecipe, focusDate }) {
  const [editing, setEditing] = useState(null); // null | {} (nieuw) | recept

  if (editing) {
    return (
      <RecipeEditor
        recipe={editing}
        onCancel={() => setEditing(null)}
        onSave={async (r) => {
          const saved = await home.act.saveRecipe(r);
          setEditing(null);
          setTab('recepten');
          setOpenRecipe(saved?.id || r.id || null);
          toast('Recept bewaard');
        }}
      />
    );
  }

  const recipe = openRecipe && home.recipes.find((r) => r.id === openRecipe);
  if (recipe) {
    return <RecipeView home={home} recipe={recipe} toast={toast} onBack={() => setOpenRecipe(null)} onEdit={() => setEditing(recipe)} />;
  }

  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <h1>{tab === 'recepten' ? 'Recepten' : 'Weekmenu'}</h1>
      <div className="seg" role="group" aria-label="Keuken">
        <button aria-pressed={tab !== 'recepten'} onClick={() => setTab('menu')}>Weekmenu</button>
        <button aria-pressed={tab === 'recepten'} onClick={() => setTab('recepten')}>Recepten{home.recipes.length ? ` (${home.recipes.length})` : ''}</button>
      </div>
      {tab === 'recepten'
        ? <RecipeList home={home} onOpen={setOpenRecipe} onNew={() => setEditing({})} />
        : <WeekMenu key={focusDate || 'nu'} focusDate={focusDate} home={home} toast={toast} onOpenRecipe={(id) => { setTab('recepten'); setOpenRecipe(id); }} />}
    </div>
  );
}

// ───────────── Weekmenu ─────────────

function WeekMenu({ home, toast, onOpenRecipe, focusDate }) {
  const today = todayISO();
  const [monday, setMonday] = useState(mondayOf(focusDate || today));
  const [day, setDay] = useState(null);
  const [shop, setShop] = useState(false);
  const days = weekDays(monday);
  const thisWeek = monday === mondayOf(today);

  const missing = useMemo(() => shoppingForWeek(days, home.menu, home.recipes, home.pantry, home.shopping), [days.join(), home]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="spread">
        <button className="icon-btn" onClick={() => setMonday(addDays(monday, -7))} aria-label="Vorige week"><Icon name="back" /></button>
        <div style={{ textAlign: 'center' }}>
          <div className="bold">{thisWeek ? 'Deze week' : monday === addDays(mondayOf(today), 7) ? 'Volgende week' : `Week van ${short(monday)}`}</div>
          <div className="tiny muted">{short(days[0])} tot {short(days[6])}</div>
        </div>
        <button className="icon-btn" onClick={() => setMonday(addDays(monday, 7))} aria-label="Volgende week"><Icon name="next" /></button>
      </div>

      <div className="week stagger" key={monday}>
        {days.map((iso) => {
          const m = home.menu.find((x) => x.date === iso);
          const r = m?.recipe_id && home.recipes.find((x) => x.id === m.recipe_id);
          const need = r ? checkIngredients(r.ingredients || [], home.pantry, home.shopping).filter((i) => i.state === 'kopen' || i.state === 'bijna').length : 0;
          return (
            <button key={iso} className={'day' + (iso === today ? ' today' : '') + (m ? ' planned' : '')} onClick={() => setDay(iso)}>
              <span className="day-badge"><b>{DAY[d(iso).getDay()]}</b><span>{d(iso).getDate()}</span></span>
              <span className="grow" style={{ minWidth: 0 }}>
                <span className="meal">{m ? m.meal : 'Nog niets gepland'}</span>
                {r && <span className="tiny muted" style={{ display: 'block' }}>{need ? `${need} ${need === 1 ? 'ding' : 'dingen'} te kopen` : 'Alles in huis'}</span>}
              </span>
              {r?.photo ? <img className="thumb" src={r.photo} alt="" /> : <Icon name={m ? 'pot' : 'plus'} size={20} />}
            </button>
          );
        })}
      </div>

      <button className="btn" disabled={!missing.length} onClick={() => setShop(true)}>
        <Icon name="cart" /> {missing.length ? `Boodschappen voor deze week (${missing.length})` : 'Alles voor deze week is in huis'}
      </button>
      <span className="tiny muted" style={{ textAlign: 'center' }}>Kies bij een dag een recept, dan kijk ik in de voorraad wat je nog moet kopen.</span>

      {day && <DaySheet home={home} date={day} onClose={() => setDay(null)} onOpenRecipe={onOpenRecipe} />}
      {shop && (
        <PickSheet
          title="Op de boodschappenlijst zetten"
          items={missing.map((m) => ({ name: m.name, qty: m.qty, sub: m.sources.join(', '), source: m.sources.join(', ') }))}
          onClose={() => setShop(false)}
          onAdd={async (list) => { const n = await home.act.addShopping(list); setShop(false); toast(`${n} ${n === 1 ? 'ding' : 'dingen'} op de boodschappenlijst`); }}
        />
      )}
    </div>
  );
}

function DaySheet({ home, date, onClose, onOpenRecipe }) {
  const m = home.menu.find((x) => x.date === date);
  const [text, setText] = useState(m?.meal || '');
  const [rid, setRid] = useState(m?.recipe_id || null);
  const save = async (meal, recipeId) => { await home.act.setMenu(date, meal, recipeId); onClose(); };
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Wat eten we?" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '88dvh', overflowY: 'auto' }}>
        <div className="spread">
          <div>
            <div className="tiny muted">{DAY_LONG[d(date).getDay()]} {short(date)}</div>
            <h2>Wat eten we?</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Sluiten" style={{ background: 'var(--bg)' }}><Icon name="close" /></button>
        </div>
        <form className="row" onSubmit={(e) => { e.preventDefault(); if (text.trim()) save(text, rid); }}>
          <input className="input grow" value={text} maxLength={120} placeholder="bv. Soep met brood" onChange={(e) => { setText(e.target.value); setRid(null); }} aria-label="Maaltijd" />
          <button className="btn" disabled={!text.trim()} style={{ minHeight: 50 }}>OK</button>
        </form>
        {home.recipes.length > 0 && (
          <>
            <span className="tiny bold muted">Of kies een recept</span>
            <div className="chips-wrap">
              {home.recipes.map((r) => (
                <button key={r.id} className="pill" aria-pressed={rid === r.id} onClick={() => save(r.title, r.id)}>{r.title}</button>
              ))}
            </div>
          </>
        )}
        {m?.recipe_id && <button className="btn ghost" onClick={() => { onClose(); onOpenRecipe(m.recipe_id); }}><Icon name="book" /> Recept bekijken</button>}
        {m && <button className="btn danger" onClick={() => save('', null)}><Icon name="trash" /> Leegmaken</button>}
      </div>
    </div>
  );
}

function PickSheet({ title, items, onClose, onAdd }) {
  const [on, setOn] = useState(() => items.map(() => true));
  const count = on.filter(Boolean).length;
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} style={{ maxHeight: '88dvh', overflowY: 'auto' }}>
        <div className="spread">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Sluiten" style={{ background: 'var(--bg)' }}><Icon name="close" /></button>
        </div>
        <div className="card list" style={{ background: 'var(--bg)' }}>
          {items.map((it, i) => (
            <div key={it.name} className={'check-row' + (on[i] ? '' : ' off')}>
              <button className="check" role="checkbox" aria-checked={on[i]} onClick={() => setOn((o) => o.map((x, j) => (j === i ? !x : x)))}>
                <span className="box"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                <span className="grow">
                  <span className="name">{it.qty ? `${it.qty} ` : ''}{it.name}</span>
                  {it.sub && <span className="tiny muted" style={{ display: 'block' }}>{it.sub}</span>}
                </span>
              </button>
            </div>
          ))}
        </div>
        <button className="btn" disabled={!count} onClick={() => onAdd(items.filter((_, i) => on[i]))}><Icon name="cart" /> {count} op de lijst zetten</button>
      </div>
    </div>
  );
}

// ───────────── Recepten ─────────────

function RecipeList({ home, onOpen, onNew }) {
  const [q, setQ] = useState('');
  const list = home.recipes.filter((r) => !q || r.title.toLowerCase().includes(q.toLowerCase()) || (r.ingredients || []).some((i) => i.name.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="stack" style={{ gap: 12 }}>
      <button className="btn" onClick={onNew}><Icon name="camera" /> Nieuw recept (foto of tekst)</button>
      {home.recipes.length > 3 && <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Zoek op naam of ingrediënt" aria-label="Zoeken" />}
      {home.recipes.length === 0 && (
        <div className="card empty">
          <PotIllustration />
          <b>Nog geen recepten</b>
          <span className="small muted">Neem een foto van een recept uit een boek of tijdschrift. Ik lees de titel, de ingrediënten en de bereiding voor je in.</span>
        </div>
      )}
      <div className="recipes stagger">
        {list.map((r) => {
          const need = checkIngredients(r.ingredients || [], home.pantry, home.shopping).filter((i) => i.state === 'kopen' || i.state === 'bijna').length;
          return (
            <button key={r.id} className="recipe-card" onClick={() => onOpen(r.id)}>
              {r.photo ? <img src={r.photo} alt="" /> : <span className="ph"><Icon name="pot" size={34} /></span>}
              <span className="body">
                <b>{r.title}</b>
                <span className={'tiny ' + (need ? 'need' : 'have')}>{(r.ingredients || []).length ? (need ? `${need} te kopen` : 'Alles in huis') : 'Geen ingrediënten'}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const STATE = {
  heb: { label: 'in huis', cls: 'have', icon: 'check' },
  bijna: { label: 'bijna op', cls: 'low', icon: 'cart' },
  kopen: { label: 'kopen', cls: 'need', icon: 'cart' },
  'op-lijst': { label: 'op de lijst', cls: 'listed', icon: 'list' },
};

function RecipeView({ home, recipe, toast, onBack, onEdit }) {
  const [plan, setPlan] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const checked = checkIngredients(recipe.ingredients || [], home.pantry, home.shopping);
  const toBuy = checked.filter((i) => i.state === 'kopen' || i.state === 'bijna');

  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      <div className="spread">
        <button className="icon-btn" onClick={onBack} aria-label="Terug"><Icon name="back" /></button>
        <button className="btn ghost" onClick={onEdit} style={{ minHeight: 44 }}><Icon name="edit" size={18} /> Aanpassen</button>
      </div>
      {recipe.photo && <img className="recipe-hero" src={recipe.photo} alt="" />}
      <div>
        <h1>{recipe.title}</h1>
        {recipe.servings && <span className="small muted">Voor {recipe.servings} {recipe.servings === 1 ? 'persoon' : 'personen'}</span>}
      </div>

      <section className="card stack" style={{ gap: 4 }}>
        <div className="spread" style={{ marginBottom: 6 }}>
          <h2>Ingrediënten</h2>
          <span className="tiny muted">vergeleken met je voorraad</span>
        </div>
        {checked.length === 0 && <span className="small muted">Nog geen ingrediënten. Tik op Aanpassen om ze toe te voegen.</span>}
        <div className="stagger">
          {checked.map((i, k) => (
            <div key={k} className={'ing ' + STATE[i.state].cls}>
              <span className="ing-ico"><Icon name={STATE[i.state].icon} size={16} stroke={2.4} /></span>
              <span className="grow">{i.qty && <b>{i.qty} </b>}{i.name}{i.note ? <span className="muted">, {i.note}</span> : null}</span>
              <span className="tiny bold">{STATE[i.state].label}</span>
            </div>
          ))}
        </div>
      </section>

      {toBuy.length > 0 && (
        <button className="btn" onClick={async () => { const n = await home.act.addShopping(toBuy.map((i) => ({ name: i.name, qty: i.qty })), recipe.title); toast(n ? `${n} ${n === 1 ? 'ding' : 'dingen'} op de boodschappenlijst` : 'Alles stond al op de lijst'); }}>
          <Icon name="cart" /> Zet wat ontbreekt op de lijst ({toBuy.length})
        </button>
      )}
      <button className="btn ghost" onClick={() => setPlan(true)}><Icon name="calendar" /> Op het weekmenu zetten</button>

      {recipe.steps && (
        <section className="card stack" style={{ gap: 10 }}>
          <h2>Bereiding</h2>
          <ol className="steps">{recipe.steps.split('\n').filter(Boolean).map((s, i) => <li key={i}>{s}</li>)}</ol>
        </section>
      )}

      {!confirm
        ? <button className="btn danger" onClick={() => setConfirm(true)}><Icon name="trash" /> Recept verwijderen</button>
        : (
          <div className="row">
            <button className="btn ghost grow" onClick={() => setConfirm(false)}>Nee</button>
            <button className="btn danger grow" onClick={async () => { await home.act.deleteRecipe(recipe.id); onBack(); }}>Ja, verwijderen</button>
          </div>
        )}

      {plan && <PlanSheet home={home} recipe={recipe} onClose={() => setPlan(false)} onDone={(iso) => { setPlan(false); toast(`${recipe.title} staat op ${DAY_LONG[d(iso).getDay()].toLowerCase()} ${short(iso)}`); }} />}
    </div>
  );
}

function PlanSheet({ home, recipe, onClose, onDone }) {
  const today = todayISO();
  const days = Array.from({ length: 10 }, (_, i) => addDays(today, i));
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Welke dag?" onClick={(e) => e.stopPropagation()}>
        <div className="spread">
          <h2>Welke dag?</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Sluiten" style={{ background: 'var(--bg)' }}><Icon name="close" /></button>
        </div>
        <div className="plan-days">
          {days.map((iso) => {
            const m = home.menu.find((x) => x.date === iso);
            return (
              <button key={iso} className="plan-day" onClick={async () => { await home.act.setMenu(iso, recipe.title, recipe.id); onDone(iso); }}>
                <b>{iso === today ? 'Vandaag' : DAY_LONG[d(iso).getDay()]}</b>
                <span className="tiny muted">{short(iso)}{m ? ` · nu: ${m.meal}` : ''}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ───────────── Recept invoeren ─────────────

function RecipeEditor({ recipe, onCancel, onSave }) {
  const [title, setTitle] = useState(recipe.title || '');
  const [servings, setServings] = useState(recipe.servings ? String(recipe.servings) : '');
  const [ings, setIngs] = useState((recipe.ingredients || []).map(ingredientLine).join('\n'));
  const [steps, setSteps] = useState(recipe.steps || '');
  const [photo, setPhoto] = useState(recipe.photo || null);
  const [paste, setPaste] = useState(false);
  const [pasted, setPasted] = useState('');
  const [ocr, setOcr] = useState(null); // { step, pct }
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const cam = useRef(null);
  const gal = useRef(null);
  const isNew = !recipe.id;

  function fill(text) {
    const r = parseRecipeText(text);
    if (r.title && !title.trim()) setTitle(r.title);
    if (r.servings && !servings) setServings(String(r.servings));
    if (r.ingredients.length) setIngs((v) => (v.trim() ? v.trim() + '\n' : '') + r.ingredients.map(ingredientLine).join('\n'));
    if (r.steps) setSteps((v) => (v.trim() ? v.trim() + '\n' : '') + r.steps);
    return r;
  }

  async function onPhoto(file) {
    if (!file) return;
    setError('');
    try {
      const { thumbnail, readText } = await import('../lib/ocr.js');
      if (!photo) setPhoto(await thumbnail(file));
      setOcr({ step: 'laden', pct: 0 });
      const text = await readText(file, setOcr);
      const r = fill(text);
      if (!r.ingredients.length && !r.steps) setError('Ik kon weinig lezen op deze foto. Probeer een scherpere foto, recht van boven en met genoeg licht. Of plak de tekst.');
    } catch (e) {
      setError(/fetch|network|load/i.test(e.message || '') ? 'Het leesprogramma kon niet laden. De eerste keer heb je internet nodig.' : e.message || 'Lezen lukte niet.');
    } finally {
      setOcr(null);
    }
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      await onSave({
        id: recipe.id,
        title: title.trim(),
        servings: servings ? Number(servings) : null,
        ingredients: ings.split('\n').map(parseIngredient).filter(Boolean),
        steps: steps.trim() || null,
        photo,
      });
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ maxWidth: 720, gap: 14 }}>
      <div className="spread">
        <button className="icon-btn" onClick={onCancel} aria-label="Annuleren"><Icon name="close" /></button>
        <h2>{isNew ? 'Nieuw recept' : 'Recept aanpassen'}</h2>
        <span style={{ width: 44 }} />
      </div>

      <div className="photo-pick">
        {photo ? <img src={photo} alt="Foto van het recept" /> : <span className="ph"><Icon name="camera" size={34} /></span>}
        <div className="stack grow" style={{ gap: 8 }}>
          <button className="btn" onClick={() => cam.current?.click()} disabled={!!ocr}><Icon name="camera" /> Foto nemen</button>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn ghost grow" onClick={() => gal.current?.click()} disabled={!!ocr} style={{ minHeight: 44, padding: '0 10px' }}>Uit galerij</button>
            <button className="btn ghost grow" onClick={() => setPaste((p) => !p)} disabled={!!ocr} style={{ minHeight: 44, padding: '0 10px' }}><Icon name="text" size={18} /> Tekst plakken</button>
          </div>
        </div>
        <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ''; }} />
        <input ref={gal} type="file" accept="image/*" hidden onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ''; }} />
      </div>

      {ocr && (
        <div className="card stack" style={{ gap: 8 }} aria-live="polite">
          <span className="small bold">{ocr.step === 'laden' ? 'Leesprogramma klaarzetten… (de eerste keer duurt dit even)' : 'Ik lees het recept…'}</span>
          <div className="meter"><span style={{ width: `${ocr.step === 'laden' ? Math.max(5, ocr.pct / 3) : 33 + ocr.pct * 0.67}%`, animation: 'none', transition: 'width .3s' }} /></div>
        </div>
      )}

      {paste && (
        <div className="card stack" style={{ gap: 8 }}>
          <span className="small muted">Plak hier een recept, bv. van een website of uit een bericht.</span>
          <textarea className="input area" rows={6} value={pasted} onChange={(e) => setPasted(e.target.value)} aria-label="Recepttekst" />
          <button className="btn" disabled={!pasted.trim()} onClick={() => { fill(pasted); setPasted(''); setPaste(false); }}><Icon name="sparkle" /> Inlezen</button>
        </div>
      )}

      {error && <div className="error">{error}</div>}

      <div className="row" style={{ alignItems: 'flex-end' }}>
        <label className="field grow">Naam<input className="input" value={title} maxLength={120} placeholder="bv. Spaghetti bolognese" onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="field" style={{ width: 110 }}>Personen<input className="input" inputMode="numeric" value={servings} maxLength={2} onChange={(e) => setServings(e.target.value.replace(/\D/g, ''))} /></label>
      </div>
      <label className="field">
        Ingrediënten <span className="tiny muted" style={{ fontWeight: 400 }}>één per regel, bv. "200 g bloem"</span>
        <textarea className="input area" rows={8} value={ings} onChange={(e) => setIngs(e.target.value)} />
      </label>
      <label className="field">
        Bereiding <span className="tiny muted" style={{ fontWeight: 400 }}>één stap per regel</span>
        <textarea className="input area" rows={8} value={steps} onChange={(e) => setSteps(e.target.value)} />
      </label>
      <span className="tiny muted">Controleer even wat ik las: van een foto lezen is niet altijd perfect.</span>
      <button className="btn" disabled={!title.trim() || busy || !!ocr} onClick={save}><Icon name="check" /> {busy ? 'Bewaren…' : 'Recept bewaren'}</button>
    </div>
  );
}
